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
 *
 * 최적화 (v2):
 * - WebSocket 싱글톤 공유
 * - Debounce/Throttle 증가 (트래픽 감소)
 * - 배치 전송 (maxBatchSize)
 * - requestIdleCallback (메인 스레드 부하 감소)
 * - 탭/포커스 상태에 따른 전송 빈도 조절
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Editor, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import UtteranceBlock from '../components/meet/extensions/UtteranceBlock';
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
import { useWebSocket, UseWebSocketReturn } from './useWebSocket';
import { useAuth } from '../AuthContext/AuthContext';
import { updateNotes } from '../api/notes';

// ============================================
// Configuration (Optimized for voice quality)
// ============================================

const DEBOUNCE_MS_ACTIVE = 250;       // Step 배치 전송 딜레이 (포커스 있을 때)
const DEBOUNCE_MS_INACTIVE = 1000;    // Step 배치 전송 딜레이 (포커스 없을 때)
const PRESENCE_THROTTLE_MS_ACTIVE = 500;   // Presence 업데이트 쓰로틀 (포커스 있을 때)
const PRESENCE_THROTTLE_MS_INACTIVE = 2000; // Presence 업데이트 쓰로틀 (포커스 없을 때)
const DB_SAVE_DEBOUNCE_MS = 3000;     // DB 저장 딜레이 (3초)
const MAX_BATCH_SIZE = 20;            // 최대 배치 크기 (초과 시 즉시 전송)

// ============================================
// requestIdleCallback polyfill
// ============================================

const requestIdleCallback =
  (window as any).requestIdleCallback ||
  ((cb: (deadline: IdleDeadline) => void) => setTimeout(() => cb({
    didTimeout: false,
    timeRemaining: () => 50,
  }), 1));

const cancelIdleCallback =
  (window as any).cancelIdleCallback ||
  ((id: number) => clearTimeout(id));

// ============================================
// Hook Interface
// ============================================

interface UseCollaborativeEditorOptions {
  docId: string;
  userId: string;
  username: string;
  photoUrl?: string;
  initialContent?: any;
  placeholder?: string;
  onSyncStatusChange?: (isSyncing: boolean) => void;
  onUsersChange?: (users: RemoteUser[]) => void;
  // Optional: external WebSocket (for sharing connection)
  externalWs?: UseWebSocketReturn;
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
  photoUrl = '',
  initialContent,
  placeholder = 'Start taking notes...',
  onSyncStatusChange,
  onUsersChange,
  externalWs,
}: UseCollaborativeEditorOptions): UseCollaborativeEditorReturn {

  // === State ===
  const [isSyncing, setIsSyncing] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [isDocumentVisible, setIsDocumentVisible] = useState(!document.hidden);
  const [isEditorFocused, setIsEditorFocused] = useState(false);

  // === Refs (렌더링과 무관한 상태) ===
  const clientIdRef = useRef<string>(generateClientId());
  const clientSeqRef = useRef<number>(0);
  const pendingStepsRef = useRef<StepJSON[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dbSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleCallbackRef = useRef<number | null>(null);
  const isApplyingRemoteRef = useRef<boolean>(false);
  const lastPresenceRef = useRef<number>(0);
  const userColorRef = useRef<string>(getUserColor(userId));
  const editorRef = useRef<Editor | null>(null);

  // === Auth ===
  const { accessToken } = useAuth();

  // === WebSocket (shared connection) ===
  const internalWs = useWebSocket(docId);
  const ws = externalWs || internalWs;
  const { isConnected, subscribe, send } = ws;

  // ============================================
  // Visibility & Focus Tracking
  // ============================================

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsDocumentVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Get current debounce/throttle values based on state
  const getDebounceMs = useCallback(() => {
    if (!isDocumentVisible) return DEBOUNCE_MS_INACTIVE;
    if (!isEditorFocused) return DEBOUNCE_MS_INACTIVE;
    return DEBOUNCE_MS_ACTIVE;
  }, [isDocumentVisible, isEditorFocused]);

  const getPresenceThrottleMs = useCallback(() => {
    if (!isDocumentVisible) return PRESENCE_THROTTLE_MS_INACTIVE;
    if (!isEditorFocused) return PRESENCE_THROTTLE_MS_INACTIVE;
    return PRESENCE_THROTTLE_MS_ACTIVE;
  }, [isDocumentVisible, isEditorFocused]);

  // ============================================
  // DB 저장 (Debounced + requestIdleCallback)
  // ============================================

  const saveToDatabase = useCallback(async () => {
    if (!editorRef.current || !accessToken) return;

    // Use requestIdleCallback to offload JSON stringify
    if (idleCallbackRef.current) {
      cancelIdleCallback(idleCallbackRef.current);
    }

    idleCallbackRef.current = requestIdleCallback(async () => {
      if (!editorRef.current) return;

      try {
        const content = JSON.stringify(editorRef.current.getJSON());
        await updateNotes(docId, content, userId, username, accessToken);
        console.log('[Notes] Saved to database');
      } catch (error) {
        console.error('[Notes] Failed to save to database:', error);
      }
    }, { timeout: 5000 }); // 최대 5초 대기
  }, [docId, userId, username, accessToken]);

  const debouncedSaveToDatabase = useCallback(() => {
    if (dbSaveTimerRef.current) {
      clearTimeout(dbSaveTimerRef.current);
    }
    dbSaveTimerRef.current = setTimeout(saveToDatabase, DB_SAVE_DEBOUNCE_MS);
  }, [saveToDatabase]);

  // ============================================
  // Step 전송 (Debounced Batch with max size)
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

    // Max batch size exceeded - flush immediately
    if (pendingStepsRef.current.length >= MAX_BATCH_SIZE) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      flushSteps();
      return;
    }

    // Debounce: 연속 입력을 배치로 묶음
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(flushSteps, getDebounceMs());
  }, [flushSteps, getDebounceMs]);

  // ============================================
  // Presence 전송 (Throttled)
  // ============================================

  const sendPresence = useCallback((editorInstance: Editor) => {
    // Skip presence updates when tab is hidden
    if (!isDocumentVisible) return;

    const now = Date.now();
    if (now - lastPresenceRef.current < getPresenceThrottleMs()) return;
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
  }, [docId, userId, username, isConnected, send, isDocumentVisible, getPresenceThrottleMs]);

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
      UtteranceBlock,
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
    onFocus: () => {
      setIsEditorFocused(true);
    },
    onBlur: () => {
      setIsEditorFocused(false);
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
            console.warn('[Notes] Step apply failed:', result.failed);
          }
        } catch (err) {
          console.error('[Notes] Failed to apply step:', err);
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
      photoUrl,
      clientId: clientIdRef.current,
      timestamp: Date.now(),
    });

    // Edit 구독
    const unsubEdit = subscribe(TOPICS.RECEIVE_EDIT(docId), (message) => {
      try {
        const operation: EditOperation = JSON.parse(message.body);
        applyRemoteSteps(operation);
      } catch (err) {
        console.error('[Notes] Failed to parse edit message:', err);
      }
    });

    // Presence 구독
    const unsubPresence = subscribe(TOPICS.RECEIVE_PRESENCE(docId), (message) => {
      try {
        const presenceData: PresenceOperation = JSON.parse(message.body);
        handleRemotePresence(presenceData);
      } catch (err) {
        console.error('[Notes] Failed to parse presence message:', err);
      }
    });

    // Users 목록 구독 (자기 자신 포함)
    const unsubUsers = subscribe(TOPICS.RECEIVE_USERS(docId), (message) => {
      try {
        const data = JSON.parse(message.body);
        const users: RemoteUser[] = data.users
          .map((u: any) => ({
            ...u,
            lastSeen: u.joinedAt,
          }));
        setRemoteUsers(users);
        onUsersChange?.(users);
      } catch (err) {
        console.error('[Notes] Failed to parse users message:', err);
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
        photoUrl,
        clientId: clientIdRef.current,
        timestamp: Date.now(),
      });

      unsubEdit();
      unsubPresence();
      unsubUsers();
    };
  }, [isConnected, docId, userId, username, photoUrl, subscribe, send, applyRemoteSteps, handleRemotePresence, onUsersChange]);

  // === 정리 ===
  useEffect(() => {
    onUsersChange?.(remoteUsers);
  }, [remoteUsers, onUsersChange]);

  // === editorRef 업데이트 ===
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // === Handle beforeunload (refresh/close) ===
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Send leave message synchronously before page unloads
      if (isConnected) {
        send(TOPICS.SEND_LEAVE(docId), {
          type: 'leave',
          docId,
          userId,
          username,
          photoUrl,
          clientId: clientIdRef.current,
          timestamp: Date.now(),
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isConnected, docId, userId, username, photoUrl, send]);

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
      // Idle callback 정리
      if (idleCallbackRef.current) {
        cancelIdleCallback(idleCallbackRef.current);
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
