/**
 * useCollaborativeEditor Hook
 *
 * Op-based 실시간 협업 편집 훅
 *
 * 핵심 원칙:
 * 1. 로컬 편집 → 즉시 반영 (TipTap이 자체 처리)
 * 2. Transaction의 steps만 추출 → debounce → 서버 전송
 * 3. 원격 steps 수신 → 로컬 적용 (재전송 방지)
 * 4. 서버는 stateless, op만 relay
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Editor, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Step } from '@tiptap/pm/transform';
import {
  EditOperation,
  PresenceOperation,
  StepJSON,
  TOPICS,
  generateClientId,
  getUserColor,
  RemoteUser,
} from '../types/collaborative';
import { useWebSocket } from './useWebSocket';
import { useAuth } from '../AuthContext/AuthContext';
import { updateNotes } from '../api/notes';

// ============================================
// Configuration
// ============================================

const DEBOUNCE_MS = 50;           // Step 배치 전송 딜레이
const PRESENCE_THROTTLE_MS = 100; // Presence 업데이트 쓰로틀
const DB_SAVE_DEBOUNCE_MS = 2000; // DB 저장 딜레이 (2초)

// ============================================
// Hook Interface
// ============================================

interface UseCollaborativeEditorOptions {
  docId: string;
  userId: string;
  username: string;
  initialContent?: any;
  placeholder?: string;
  onSyncStatusChange?: (isSyncing: boolean) => void;
  onUsersChange?: (users: RemoteUser[]) => void;
}

interface UseCollaborativeEditorReturn {
  editor: Editor | null;
  isConnected: boolean;
  isSyncing: boolean;
  remoteUsers: RemoteUser[];
}

// ============================================
// Main Hook
// ============================================

export function useCollaborativeEditor({
  docId,
  userId,
  username,
  initialContent,
  placeholder = 'Start taking notes...',
  onSyncStatusChange,
  onUsersChange,
}: UseCollaborativeEditorOptions): UseCollaborativeEditorReturn {

  // === State ===
  const [isSyncing, setIsSyncing] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);

  // === Refs (렌더링과 무관한 상태) ===
  const clientIdRef = useRef<string>(generateClientId());
  const clientSeqRef = useRef<number>(0);
  const pendingStepsRef = useRef<StepJSON[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dbSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isApplyingRemoteRef = useRef<boolean>(false);
  const lastPresenceRef = useRef<number>(0);
  const userColorRef = useRef<string>(getUserColor(userId));
  const editorRef = useRef<Editor | null>(null);

  // === Auth ===
  const { accessToken } = useAuth();

  // === WebSocket ===
  const { isConnected, subscribe, send } = useWebSocket(docId);

  // ============================================
  // DB 저장 (Debounced)
  // ============================================

  const saveToDatabase = useCallback(async () => {
    if (!editorRef.current || !accessToken) return;

    const content = JSON.stringify(editorRef.current.getJSON());

    try {
      await updateNotes(docId, content, username, accessToken);
      console.log('Notes saved to database');
    } catch (error) {
      console.error('Failed to save notes to database:', error);
    }
  }, [docId, username, accessToken]);

  const debouncedSaveToDatabase = useCallback(() => {
    if (dbSaveTimerRef.current) {
      clearTimeout(dbSaveTimerRef.current);
    }
    dbSaveTimerRef.current = setTimeout(saveToDatabase, DB_SAVE_DEBOUNCE_MS);
  }, [saveToDatabase]);

  // ============================================
  // Step 전송 (Debounced Batch)
  // ============================================

  const flushSteps = useCallback(() => {
    if (pendingStepsRef.current.length === 0) return;
    if (!isConnected) return;

    const steps = [...pendingStepsRef.current];
    pendingStepsRef.current = [];

    const operation: EditOperation = {
      type: 'edit',
      docId,
      userId,
      username,
      clientId: clientIdRef.current,
      clientSeq: ++clientSeqRef.current,
      steps,
      timestamp: Date.now(),
    };

    setIsSyncing(true);
    onSyncStatusChange?.(true);

    send(TOPICS.SEND_EDIT(docId), operation);

    // 전송 완료 표시 (실제로는 ACK 받아야 하지만, stateless라 바로 처리)
    setTimeout(() => {
      setIsSyncing(false);
      onSyncStatusChange?.(false);
    }, 100);
  }, [docId, userId, username, isConnected, send, onSyncStatusChange]);

  const enqueueSteps = useCallback((steps: StepJSON[]) => {
    pendingStepsRef.current.push(...steps);

    // Debounce: 연속 입력을 배치로 묶음
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(flushSteps, DEBOUNCE_MS);
  }, [flushSteps]);

  // ============================================
  // Presence 전송 (Throttled)
  // ============================================

  const sendPresence = useCallback((editorInstance: Editor) => {
    const now = Date.now();
    if (now - lastPresenceRef.current < PRESENCE_THROTTLE_MS) return;
    lastPresenceRef.current = now;

    if (!isConnected) return;

    const { from, to } = editorInstance.state.selection;

    const presence: PresenceOperation = {
      type: 'presence',
      docId,
      userId,
      username,
      clientId: clientIdRef.current,
      cursor: { anchor: from, head: to },
      selection: from !== to ? { from, to } : undefined,
      color: userColorRef.current,
      timestamp: now,
    };

    send(TOPICS.SEND_PRESENCE(docId), presence);
  }, [docId, userId, username, isConnected, send]);

  // ============================================
  // TipTap Editor Setup
  // ============================================

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: initialContent || '',
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content',
      },
    },
    // === Transaction 핸들러 (핵심) ===
    onTransaction: ({ transaction }) => {
      // 1. 원격 적용 중이면 무시 (재전송 방지)
      if (isApplyingRemoteRef.current) return;

      // 2. 실제 문서 변경이 없으면 무시
      if (!transaction.docChanged) return;

      // 3. Steps 추출
      const steps: StepJSON[] = [];
      transaction.steps.forEach((step) => {
        steps.push(step.toJSON() as StepJSON);
      });

      if (steps.length > 0) {
        enqueueSteps(steps);
        // 4. DB에 저장 (debounced)
        debouncedSaveToDatabase();
      }
    },
    onSelectionUpdate: ({ editor: editorInstance }) => {
      sendPresence(editorInstance);
    },
  });

  // ============================================
  // 원격 Steps 적용
  // ============================================

  const applyRemoteSteps = useCallback((operation: EditOperation) => {
    if (!editor) return;

    // 자신이 보낸 건 무시
    if (operation.clientId === clientIdRef.current) return;

    // 재전송 방지 플래그
    isApplyingRemoteRef.current = true;

    try {
      const { state, view } = editor;
      const tr = state.tr;

      // Steps를 순서대로 적용
      for (const stepJSON of operation.steps) {
        try {
          const step = Step.fromJSON(state.schema, stepJSON);
          const result = tr.maybeStep(step);

          if (result.failed) {
            console.warn('Step apply failed:', result.failed);
            // 충돌 시 전체 리로드 필요할 수 있음 (여기서는 무시)
          }
        } catch (err) {
          console.error('Failed to apply step:', err);
        }
      }

      // Transaction 적용 (히스토리에 추가하지 않음)
      if (tr.steps.length > 0) {
        tr.setMeta('addToHistory', false);
        tr.setMeta('remote', true);
        view.dispatch(tr);
      }
    } finally {
      isApplyingRemoteRef.current = false;
    }
  }, [editor]);

  // ============================================
  // 원격 Presence 처리
  // ============================================

  const handleRemotePresence = useCallback((presence: PresenceOperation) => {
    // 자신은 무시
    if (presence.userId === userId) return;

    setRemoteUsers((prev) => {
      const updated = prev.filter((u) => u.clientId !== presence.clientId);
      updated.push({
        userId: presence.userId,
        username: presence.username,
        clientId: presence.clientId,
        color: presence.color,
        cursor: presence.cursor,
        selection: presence.selection,
        activeBlockId: presence.activeBlockId,
        lastSeen: presence.timestamp,
      });
      return updated;
    });
  }, [userId]);

  // ============================================
  // WebSocket 구독
  // ============================================

  useEffect(() => {
    if (!isConnected || !docId) return;

    // Join 알림
    send(TOPICS.SEND_JOIN(docId), {
      type: 'join',
      docId,
      userId,
      username,
      clientId: clientIdRef.current,
      timestamp: Date.now(),
    });

    // Edit 구독
    const unsubEdit = subscribe(TOPICS.RECEIVE_EDIT(docId), (message) => {
      try {
        const operation: EditOperation = JSON.parse(message.body);
        applyRemoteSteps(operation);
      } catch (err) {
        console.error('Failed to parse edit message:', err);
      }
    });

    // Presence 구독
    const unsubPresence = subscribe(TOPICS.RECEIVE_PRESENCE(docId), (message) => {
      try {
        const presenceData: PresenceOperation = JSON.parse(message.body);
        handleRemotePresence(presenceData);
      } catch (err) {
        console.error('Failed to parse presence message:', err);
      }
    });

    // Users 목록 구독
    const unsubUsers = subscribe(TOPICS.RECEIVE_USERS(docId), (message) => {
      try {
        const data = JSON.parse(message.body);
        const users: RemoteUser[] = data.users
          .filter((u: any) => u.userId !== userId)
          .map((u: any) => ({
            ...u,
            lastSeen: u.joinedAt,
          }));
        setRemoteUsers(users);
        onUsersChange?.(users);
      } catch (err) {
        console.error('Failed to parse users message:', err);
      }
    });

    // Cleanup
    return () => {
      // Leave 알림
      send(TOPICS.SEND_LEAVE(docId), {
        type: 'leave',
        docId,
        userId,
        username,
        clientId: clientIdRef.current,
        timestamp: Date.now(),
      });

      unsubEdit();
      unsubPresence();
      unsubUsers();
    };
  }, [isConnected, docId, userId, username, subscribe, send, applyRemoteSteps, handleRemotePresence, onUsersChange]);

  // === 정리 ===
  useEffect(() => {
    onUsersChange?.(remoteUsers);
  }, [remoteUsers, onUsersChange]);

  // === editorRef 업데이트 ===
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // === Cleanup on unmount ===
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        flushSteps(); // 남은 steps 전송
      }
      // DB 저장 타이머 정리 및 최종 저장
      if (dbSaveTimerRef.current) {
        clearTimeout(dbSaveTimerRef.current);
        saveToDatabase(); // 언마운트 시 최종 저장
      }
    };
  }, [flushSteps, saveToDatabase]);

  return {
    editor,
    isConnected,
    isSyncing,
    remoteUsers,
  };
}

export default useCollaborativeEditor;
