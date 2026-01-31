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
import UniqueId from '../components/meet/extensions/UniqueId';
import DragHandle, { DRAGGABLE_TYPES } from '../components/meet/extensions/DragHandle';
import { Step } from '@tiptap/pm/transform';
import {
  EditOperation,
  PresenceOperation,
  ReorderOperation,
  LockOperation,
  StepJSON,
  TOPICS,
  generateClientId,
  getUserColor,
  RemoteUser,
  BlockLockState,
} from '../types/collaborative';
import { useWebSocket, UseWebSocketReturn } from './useWebSocket';
import { useAuth } from '../AuthContext/AuthContext';
import { updateNotes, updateBlockOrder } from '../api/notes';

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
  // Optional: custom save function (overrides default updateNotes)
  customSave?: (docId: string, content: string, userId: string, username: string, token: string) => Promise<any>;
  // Optional: callback when block order changes
  onBlockOrderChange?: (blockIds: string[]) => void;
  // Optional: enable drag handle for block reordering
  enableDragHandle?: boolean;
}

interface UseCollaborativeEditorReturn {
  editor: Editor | null;
  isConnected: boolean;
  isSyncing: boolean;
  remoteUsers: RemoteUser[];
  // Block management (v1.5)
  blockOrder: string[];
  blockLocks: Map<string, BlockLockState>;
  reorderBlock: (blockId: string, fromIndex: number, toIndex: number) => void;
  requestLock: (blockId: string) => void;
  releaseLock: (blockId: string) => void;
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
  customSave,
  onBlockOrderChange,
  enableDragHandle = false,
}: UseCollaborativeEditorOptions): UseCollaborativeEditorReturn {

  // === State ===
  const [isSyncing, setIsSyncing] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [isDocumentVisible, setIsDocumentVisible] = useState(!document.hidden);
  const [isEditorFocused, setIsEditorFocused] = useState(false);

  // Block management state (v1.5)
  const [blockOrder, setBlockOrder] = useState<string[]>([]);
  const [blockLocks, setBlockLocks] = useState<Map<string, BlockLockState>>(new Map());
  const blockOrderVersionRef = useRef<number>(0);
  const reorderCallbackRef = useRef<((blockId: string, fromIndex: number, toIndex: number) => void) | null>(null);

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
        // Use customSave if provided, otherwise use default updateNotes
        if (customSave) {
          await customSave(docId, content, userId, username, accessToken);
        } else {
          await updateNotes(docId, content, userId, username, accessToken);
        }
        console.log('[Notes] Saved to database');
      } catch (error) {
        console.error('[Notes] Failed to save to database:', error);
      }
    }, { timeout: 5000 }); // 최대 5초 대기
  }, [docId, userId, username, accessToken, customSave]);

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

  // Block order change handler
  const handleBlocksChange = useCallback((blockIds: string[]) => {
    setBlockOrder(blockIds);
    blockOrderVersionRef.current += 1;
    onBlockOrderChange?.(blockIds);
  }, [onBlockOrderChange]);

  // Debug: uncomment if needed
  // console.log('[useCollaborativeEditor] Creating editor, enableDragHandle:', enableDragHandle);

  const editor = useEditor({
    extensions: [
      // Configure StarterKit to disable nodes that DragHandle will provide with drag support
      StarterKit.configure({
        heading: enableDragHandle ? false : { levels: [1, 2, 3] },
        paragraph: enableDragHandle ? false : {},
        bulletList: enableDragHandle ? false : {},
        orderedList: enableDragHandle ? false : {},
        blockquote: enableDragHandle ? false : {},
        codeBlock: enableDragHandle ? false : {},
        horizontalRule: enableDragHandle ? false : {},
      }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      UtteranceBlock,
      // UniqueId extension for block management (v1.5)
      UniqueId.configure({
        attributeName: 'id',
        types: DRAGGABLE_TYPES,
        onBlocksChange: handleBlocksChange,
      }),
      // DragHandle extension for block reordering (v1.5)
      // When enabled, it provides draggable versions of paragraph, heading, etc.
      DragHandle.configure({
        enabled: enableDragHandle,
        onReorder: (blockId, fromIndex, toIndex) => {
          reorderCallbackRef.current?.(blockId, fromIndex, toIndex);
        },
      }),
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
  // Block Reorder (v1.5)
  // ============================================

  const applyReorderToDocument = useCallback((blockId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    const editorInstance = editorRef.current;
    if (!editorInstance) return;

    const { doc } = editorInstance.state;
    let sourceStart = -1;
    let sourceEnd = -1;

    doc.descendants((node, pos) => {
      if (node.attrs?.id === blockId) {
        sourceStart = pos;
        sourceEnd = pos + node.nodeSize;
        return false;
      }
      return true;
    });

    if (sourceStart === -1 || sourceEnd === -1) return;

    const targetIndex = fromIndex < toIndex ? toIndex + 1 : toIndex;
    let targetPos = -1;
    let currentIndex = 0;

    doc.descendants((node, pos) => {
      if (node.attrs?.id) {
        if (currentIndex === targetIndex) {
          targetPos = pos;
          return false;
        }
        currentIndex++;
      }
      return true;
    });

    if (targetPos === -1) {
      targetPos = doc.content.size;
    }

    if (sourceStart === targetPos) return;

    const { tr } = editorInstance.state;
    const nodeToMove = doc.slice(sourceStart, sourceEnd);

    if (sourceStart < targetPos) {
      tr.insert(targetPos, nodeToMove.content);
      tr.delete(sourceStart, sourceEnd);
    } else {
      tr.delete(sourceStart, sourceEnd);
      tr.insert(targetPos, nodeToMove.content);
    }

    tr.setMeta('addToHistory', false);
    tr.setMeta('remote', true);
    editorInstance.view.dispatch(tr);
  }, []);

  const reorderBlock = useCallback((blockId: string, fromIndex: number, toIndex: number) => {
    if (!isConnected) return;

    // Optimistic update and get new order
    let newBlockOrder: string[] = [];
    setBlockOrder((prev) => {
      const newOrder = [...prev];
      const [removed] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, removed);
      newBlockOrder = newOrder;
      return newOrder;
    });

    const operation: ReorderOperation = {
      type: 'reorder',
      docId,
      userId,
      username,
      clientId: clientIdRef.current,
      blockId,
      fromIndex,
      toIndex,
      baseVersion: blockOrderVersionRef.current,
      timestamp: Date.now(),
    };

    send(TOPICS.SEND_REORDER(docId), operation);
    blockOrderVersionRef.current += 1;

    // Persist block order to database (debounced)
    if (accessToken && newBlockOrder.length > 0) {
      // Use setTimeout to ensure we have the updated block order from setState
      setTimeout(async () => {
        try {
          await updateBlockOrder(docId, newBlockOrder, userId, accessToken);
          console.log('[Notes] Block order persisted to database');
        } catch (error) {
          console.error('[Notes] Failed to persist block order:', error);
        }
      }, 100);
    }
  }, [docId, userId, username, isConnected, send, accessToken]);

  // Update reorder callback ref
  useEffect(() => {
    reorderCallbackRef.current = reorderBlock;
  }, [reorderBlock]);

  const handleRemoteReorder = useCallback((operation: ReorderOperation) => {
    // Ignore own reorder
    if (operation.clientId === clientIdRef.current) return;

    if (editorRef.current) {
      isApplyingRemoteRef.current = true;
      try {
        applyReorderToDocument(operation.blockId, operation.fromIndex, operation.toIndex);
      } finally {
        isApplyingRemoteRef.current = false;
      }
    }

    // Apply remote reorder
    setBlockOrder((prev) => {
      const newOrder = [...prev];
      const currentIndex = newOrder.indexOf(operation.blockId);
      if (currentIndex === -1) return prev;

      newOrder.splice(currentIndex, 1);
      newOrder.splice(operation.toIndex, 0, operation.blockId);
      return newOrder;
    });

    blockOrderVersionRef.current = Math.max(blockOrderVersionRef.current, operation.baseVersion) + 1;
  }, []);

  // ============================================
  // Block Locking (v1.5)
  // ============================================

  // Lock renewal timer refs and functions (defined first to avoid reference errors)
  const lockRenewalRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const stopLockRenewal = useCallback((blockId: string) => {
    const timer = lockRenewalRef.current.get(blockId);
    if (timer) {
      clearTimeout(timer);
      lockRenewalRef.current.delete(blockId);
    }
  }, []);

  const startLockRenewal = useCallback((blockId: string, lockToken: string) => {
    // Clear existing timer
    const existingTimer = lockRenewalRef.current.get(blockId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set renewal timer (renew 7 seconds before 15 second expiry = every 8 seconds)
    const timer = setTimeout(() => {
      if (!isConnected) return;

      const renewOperation: LockOperation = {
        type: 'lock_renew',
        docId,
        userId,
        username,
        clientId: clientIdRef.current,
        blockId,
        lockToken,
        timestamp: Date.now(),
      };

      send(TOPICS.SEND_LOCK(docId), renewOperation);

      // Schedule next renewal
      startLockRenewal(blockId, lockToken);
    }, 8000);

    lockRenewalRef.current.set(blockId, timer);
  }, [docId, userId, username, isConnected, send]);

  const requestLock = useCallback((blockId: string) => {
    if (!isConnected) return;

    const operation: LockOperation = {
      type: 'lock_request',
      docId,
      userId,
      username,
      clientId: clientIdRef.current,
      blockId,
      timestamp: Date.now(),
    };

    send(TOPICS.SEND_LOCK(docId), operation);
  }, [docId, userId, username, isConnected, send]);

  const releaseLock = useCallback((blockId: string) => {
    if (!isConnected) return;

    const currentLock = blockLocks.get(blockId);
    if (!currentLock || currentLock.lockedBy !== userId) return;

    // Stop renewal timer
    stopLockRenewal(blockId);

    const operation: LockOperation = {
      type: 'lock_release',
      docId,
      userId,
      username,
      clientId: clientIdRef.current,
      blockId,
      lockToken: currentLock.lockToken,
      timestamp: Date.now(),
    };

    send(TOPICS.SEND_LOCK(docId), operation);

    // Optimistic update
    setBlockLocks((prev) => {
      const newLocks = new Map(prev);
      newLocks.delete(blockId);
      return newLocks;
    });
  }, [docId, userId, username, isConnected, send, blockLocks, stopLockRenewal]);

  const handleRemoteLock = useCallback((operation: LockOperation & { lockedByUsername?: string }) => {
    switch (operation.type) {
      case 'lock_acquired':
        setBlockLocks((prev) => {
          const newLocks = new Map(prev);
          newLocks.set(operation.blockId, {
            blockId: operation.blockId,
            lockedBy: operation.userId,
            username: operation.username,
            lockToken: operation.lockToken || '',
            lockUntil: operation.lockUntil || Date.now() + 15000,
          });
          return newLocks;
        });

        // If this is our lock, start renewal timer
        if (operation.userId === userId && operation.lockToken) {
          startLockRenewal(operation.blockId, operation.lockToken);
        }
        break;

      case 'lock_release':
        // Stop renewal if it was our lock
        stopLockRenewal(operation.blockId);

        setBlockLocks((prev) => {
          const newLocks = new Map(prev);
          newLocks.delete(operation.blockId);
          return newLocks;
        });
        break;

      case 'lock_release_all' as any:
        // Release all locks for a user (on disconnect)
        setBlockLocks((prev) => {
          const newLocks = new Map(prev);
          newLocks.forEach((lock, blockId) => {
            if (lock.lockedBy === operation.userId) {
              newLocks.delete(blockId);
              // Stop renewal if it was our lock
              if (operation.userId === userId) {
                stopLockRenewal(blockId);
              }
            }
          });
          return newLocks;
        });
        break;

      case 'lock_denied':
        console.warn('[Notes] Lock denied for block:', operation.blockId, operation.reason);
        // Show which user has the lock
        if ((operation as any).lockedByUsername) {
          console.info('[Notes] Block is locked by:', (operation as any).lockedByUsername);
        }
        break;
    }
  }, [userId, startLockRenewal, stopLockRenewal]);

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

    // Reorder 구독 (v1.5)
    const unsubReorder = subscribe(TOPICS.RECEIVE_REORDER(docId), (message) => {
      try {
        const operation: ReorderOperation = JSON.parse(message.body);
        handleRemoteReorder(operation);
      } catch (err) {
        console.error('[Notes] Failed to parse reorder message:', err);
      }
    });

    // Lock 구독 (v1.5)
    const unsubLock = subscribe(TOPICS.RECEIVE_LOCK(docId), (message) => {
      try {
        const operation: LockOperation = JSON.parse(message.body);
        handleRemoteLock(operation);
      } catch (err) {
        console.error('[Notes] Failed to parse lock message:', err);
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
      unsubReorder();
      unsubLock();
    };
  }, [isConnected, docId, userId, username, photoUrl, subscribe, send, applyRemoteSteps, handleRemotePresence, handleRemoteReorder, handleRemoteLock, onUsersChange]);

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
      // Clear all lock renewal timers
      lockRenewalRef.current.forEach((timer) => clearTimeout(timer));
      lockRenewalRef.current.clear();
    };
  }, [flushSteps, saveToDatabase]);

  return {
    editor,
    isConnected,
    isSyncing,
    remoteUsers,
    // Block management (v1.5)
    blockOrder,
    blockLocks,
    reorderBlock,
    requestLock,
    releaseLock,
  };
}

export default useCollaborativeEditor;
