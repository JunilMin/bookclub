/**
 * useBlockDocument Hook
 *
 * Block-based SSOT architecture for collaborative notes
 * Manages block document state, WebSocket sync, and lock-based editing
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { useAuth } from '../AuthContext/AuthContext';
import {
  Block,
  BlockDocument,
  BlockDocumentResponse,
  BlockLockState,
  BlockUpdateOperation,
  BlockAddOperation,
  BlockDeleteOperation,
  BlockEditingState,
  RemoteBlockUser,
  BLOCK_TOPICS,
  generateBlockId,
  createEmptyBlockContent,
  BlockType,
} from '../types/blockDocument';
import { TOPICS, LockOperation, generateClientId } from '../types/collaborative';
import axiosInstance from '../api/axiosInstance';

// ============================================
// Configuration
// ============================================

const LOCK_RENEWAL_INTERVAL = 8000;  // Renew lock every 8 seconds (before 15s expiry)
const BROADCAST_DEBOUNCE = 50;        // Real-time broadcast debounce (very fast)
const DB_SAVE_DEBOUNCE = 2000;        // DB save debounce (slower, for persistence)

// ============================================
// Hook Interface
// ============================================

interface UseBlockDocumentOptions {
  docId: string;
  userId: string;
  username: string;
  photoUrl?: string;
}

interface UseBlockDocumentReturn {
  // Document state
  document: BlockDocument | null;
  blockOrder: string[];
  blocks: Record<string, Block>;
  isLoading: boolean;
  error: string | null;

  // Connection state
  isConnected: boolean;
  isSyncing: boolean;

  // Editing state
  editingBlockId: string | null;
  editingState: BlockEditingState | null;
  locks: Map<string, BlockLockState>;

  // Users
  remoteUsers: RemoteBlockUser[];

  // Block operations
  startEditing: (blockId: string) => Promise<boolean>;
  startEditingOwnBlock: (blockId: string) => boolean; // For newly created blocks (no server lock needed)
  saveBlock: (blockId: string, content: string) => Promise<boolean>;
  broadcastContent: (blockId: string, content: string) => void; // Real-time sync without save
  updateLocalContent: (blockId: string, content: string) => void; // Update local state only
  finishEditing: () => void;
  cancelEditing: () => void;

  // Block CRUD
  addBlock: (type: BlockType, afterBlockId?: string | null, initialContent?: string, options?: { startEditing?: boolean }) => Promise<string | null>;
  deleteBlock: (blockId: string) => Promise<boolean>;
  reorderBlocks: (fromIndex: number, toIndex: number) => void;
  reorderMultiple: (blockIds: string[], targetIndex: number) => void;
  clearAllBlocks: () => Promise<void>;

  // Utilities
  getBlock: (blockId: string) => Block | null;
  isBlockLocked: (blockId: string) => boolean;
  isBlockLockedByMe: (blockId: string) => boolean;
  getBlockLockInfo: (blockId: string) => BlockLockState | null;
}

// ============================================
// Main Hook
// ============================================

export function useBlockDocument({
  docId,
  userId,
  username,
  photoUrl = '',
}: UseBlockDocumentOptions): UseBlockDocumentReturn {

  // === State ===
  const [document, setDocument] = useState<BlockDocument | null>(null);
  const [blockOrder, setBlockOrder] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<Record<string, Block>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Editing state
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingState, setEditingState] = useState<BlockEditingState | null>(null);
  const [locks, setLocks] = useState<Map<string, BlockLockState>>(new Map());

  // Users
  const [remoteUsers, setRemoteUsers] = useState<RemoteBlockUser[]>([]);

  // === Refs ===
  const clientIdRef = useRef<string>(generateClientId());
  const lockRenewalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const broadcastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dbSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContentRef = useRef<{ blockId: string; content: string } | null>(null);

  // Refs to avoid stale closures in subscription handlers
  const editingBlockIdRef = useRef<string | null>(editingBlockId);
  editingBlockIdRef.current = editingBlockId;
  const blocksRef = useRef<Record<string, Block>>(blocks);
  blocksRef.current = blocks;

  // === Auth ===
  const { accessToken } = useAuth();

  // === WebSocket ===
  const { isConnected, subscribe, send } = useWebSocket(docId);

  // Debug: Log connection state changes
  useEffect(() => {
    console.log(`[BlockDocument] WebSocket isConnected changed: ${isConnected}, docId: ${docId}`);
  }, [isConnected, docId]);

  // ============================================
  // Load Initial Document
  // ============================================

  useEffect(() => {
    if (!docId || !accessToken) return;

    const loadDocument = async () => {
      console.log(`[BlockDocument] Loading document for docId: ${docId}`);
      setIsLoading(true);
      setError(null);

      try {
        const response = await axiosInstance.get<BlockDocumentResponse>(
          `/sessions/${docId}/notes`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        const doc = response.data;
        console.log('[BlockDocument] Document loaded:', {
          blockOrder: doc.blockOrder?.length,
          blocks: doc.blocks ? Object.keys(doc.blocks).length : 0,
          migrated: doc.migrated
        });

        setDocument({
          id: doc.id,
          sessionId: doc.sessionId,
          title: doc.title,
          blockOrder: doc.blockOrder || [],
          blocks: doc.blocks || {},
          version: doc.version,
          migrated: doc.migrated,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        });

        setBlockOrder(doc.blockOrder || []);
        setBlocks(doc.blocks || {});

      } catch (err) {
        console.error('[BlockDocument] Failed to load document:', err);
        setError('Failed to load document');
      } finally {
        setIsLoading(false);
      }
    };

    loadDocument();
  }, [docId, accessToken]);

  // ============================================
  // WebSocket Subscriptions
  // ============================================

  useEffect(() => {
    console.log(`[BlockDocument] Subscription effect: isConnected=${isConnected}, docId=${docId}`);
    if (!isConnected || !docId) {
      console.log('[BlockDocument] Skipping subscriptions - not connected or no docId');
      return;
    }
    console.log('[BlockDocument] Setting up WebSocket subscriptions...');

    // Join document
    send(TOPICS.SEND_JOIN(docId), {
      type: 'join',
      docId,
      userId,
      username,
      photoUrl,
      clientId: clientIdRef.current,
      timestamp: Date.now(),
    });

    // Subscribe to block updates
    const unsubBlockUpdate = subscribe(BLOCK_TOPICS.RECEIVE_BLOCK_UPDATE(docId), (message) => {
      try {
        const operation = JSON.parse(message.body) as BlockUpdateOperation;
        handleRemoteBlockUpdate(operation);
      } catch (err) {
        console.error('[BlockDocument] Failed to parse block update:', err);
      }
    });

    // Subscribe to block adds
    const unsubBlockAdd = subscribe(BLOCK_TOPICS.RECEIVE_BLOCK_ADD(docId), (message) => {
      try {
        const operation = JSON.parse(message.body) as BlockAddOperation;
        handleRemoteBlockAdd(operation);
      } catch (err) {
        console.error('[BlockDocument] Failed to parse block add:', err);
      }
    });

    // Subscribe to block deletes
    const unsubBlockDelete = subscribe(BLOCK_TOPICS.RECEIVE_BLOCK_DELETE(docId), (message) => {
      try {
        const operation = JSON.parse(message.body) as BlockDeleteOperation;
        handleRemoteBlockDelete(operation);
      } catch (err) {
        console.error('[BlockDocument] Failed to parse block delete:', err);
      }
    });

    // Subscribe to block preview (real-time sync without DB save)
    const unsubBlockPreview = subscribe(BLOCK_TOPICS.RECEIVE_BLOCK_PREVIEW(docId), (message) => {
      try {
        const operation = JSON.parse(message.body);
        handleRemoteBlockPreview(operation);
      } catch (err) {
        console.error('[BlockDocument] Failed to parse block preview:', err);
      }
    });

    // Subscribe to lock updates
    const unsubLock = subscribe(TOPICS.RECEIVE_LOCK(docId), (message) => {
      try {
        const operation = JSON.parse(message.body) as LockOperation;
        handleRemoteLock(operation);
      } catch (err) {
        console.error('[BlockDocument] Failed to parse lock:', err);
      }
    });

    // Subscribe to reorder updates
    const unsubReorder = subscribe(TOPICS.RECEIVE_REORDER(docId), (message) => {
      try {
        const operation = JSON.parse(message.body);
        handleRemoteReorder(operation);
      } catch (err) {
        console.error('[BlockDocument] Failed to parse reorder:', err);
      }
    });

    // Subscribe to users
    const unsubUsers = subscribe(TOPICS.RECEIVE_USERS(docId), (message) => {
      try {
        const data = JSON.parse(message.body);
        const users: RemoteBlockUser[] = data.users.map((u: any) => ({
          ...u,
          editingBlockId: null,
        }));
        setRemoteUsers(users);
      } catch (err) {
        console.error('[BlockDocument] Failed to parse users:', err);
      }
    });

    // Cleanup
    return () => {
      send(TOPICS.SEND_LEAVE(docId), {
        type: 'leave',
        docId,
        userId,
        username,
        photoUrl,
        clientId: clientIdRef.current,
        timestamp: Date.now(),
      });

      unsubBlockUpdate();
      unsubBlockAdd();
      unsubBlockDelete();
      unsubBlockPreview();
      unsubLock();
      unsubReorder();
      unsubUsers();
    };
  }, [isConnected, docId, userId, username, photoUrl, subscribe, send]);

  // ============================================
  // Remote Operation Handlers
  // ============================================

  const handleRemoteBlockUpdate = useCallback((operation: BlockUpdateOperation) => {
    // Handle rejection
    if ((operation as any).type === 'block_update_rejected') {
      console.warn('[BlockDocument] Block update rejected:', (operation as any).reason);
      // Clear pending save on rejection
      pendingSavesRef.current.delete(operation.blockId);
      if (pendingSavesRef.current.size === 0) {
        setIsSyncing(false);
      }
      return;
    }

    // Handle own updates - update version from server ACK
    if (operation.clientId === clientIdRef.current) {
      // Update version from server response (only if version changed)
      setBlocks((prev) => {
        const block = prev[operation.blockId];
        if (!block) return prev;

        // Skip if version is the same (prevents unnecessary re-renders)
        if (block.version === operation.version) return prev;

        return {
          ...prev,
          [operation.blockId]: {
            ...block,
            version: operation.version, // Update to server-confirmed version
            updatedAt: operation.updatedAt || block.updatedAt,
          },
        };
      });

      pendingSavesRef.current.delete(operation.blockId);
      if (pendingSavesRef.current.size === 0) {
        setIsSyncing(false);
      }
      return;
    }

    // Handle remote updates
    setBlocks((prev) => {
      const block = prev[operation.blockId];
      if (!block) return prev;

      // Only apply if version is newer
      if (operation.version <= block.version) return prev;

      return {
        ...prev,
        [operation.blockId]: {
          ...block,
          content: operation.content,
          version: operation.version,
          updatedAt: operation.updatedAt || block.updatedAt,
        },
      };
    });
  }, []);

  /**
   * Handle real-time content preview from other clients
   * Updates local state immediately without version check (for instant feedback)
   */
  const handleRemoteBlockPreview = useCallback((operation: {
    type: string;
    docId: string;
    blockId: string;
    content: string;
    userId: string;
    username: string;
    clientId: string;
    timestamp: number;
  }) => {
    // Ignore own previews
    if (operation.clientId === clientIdRef.current) return;

    // Ignore if we're editing this block (we have the lock)
    // Use ref to avoid stale closure (subscription doesn't re-run on editingBlockId change)
    if (editingBlockIdRef.current === operation.blockId) return;

    // Update content immediately for real-time feedback
    setBlocks((prev) => {
      const block = prev[operation.blockId];
      if (!block) return prev;

      // Skip if content is the same
      if (block.content === operation.content) return prev;

      return {
        ...prev,
        [operation.blockId]: {
          ...block,
          content: operation.content,
          // Don't update version - this is just a preview
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }, []);

  const handleRemoteBlockAdd = useCallback((operation: BlockAddOperation) => {
    if (!operation.block) return;

    const newBlock = operation.block;
    const tempBlockId = (operation as any).tempBlockId as string | undefined;

    // Handle own add - map tempId to serverId
    if (operation.clientId === clientIdRef.current && tempBlockId) {
      setBlocks((prev) => {
        const updated = { ...prev };
        // Remove temp block if exists
        if (updated[tempBlockId]) {
          delete updated[tempBlockId];
        }
        // Add server block
        updated[newBlock.id] = newBlock;
        return updated;
      });

      setBlockOrder((prev) => {
        // Replace tempId with serverId
        return prev.map(id => id === tempBlockId ? newBlock.id : id);
      });

      // CRITICAL: Also update editingBlockId if we were editing the temp block
      // This prevents the cursor from disappearing when temp ID is replaced with server ID
      setEditingBlockId((prev) => {
        if (prev === tempBlockId) {
          return newBlock.id;
        }
        return prev;
      });

      // Also update editingState if it was for the temp block
      // Include server lock token if provided (from auto-lock in handleBlockAdd)
      const serverLockToken = (operation as any).lockToken as string | undefined;
      const serverLockUntil = (operation as any).lockUntil as number | undefined;

      setEditingState((prev) => {
        if (prev && prev.blockId === tempBlockId) {
          return {
            ...prev,
            blockId: newBlock.id,
            lockToken: serverLockToken || prev.lockToken,
            lockUntil: serverLockUntil || prev.lockUntil,
          };
        }
        return prev;
      });

      // Also update locks map - move lock from tempId to serverId
      setLocks((prev) => {
        const lockInfo = prev.get(tempBlockId);
        if (lockInfo) {
          const newLocks = new Map(prev);
          newLocks.delete(tempBlockId);
          newLocks.set(newBlock.id, {
            ...lockInfo,
            blockId: newBlock.id,
            lockToken: serverLockToken || lockInfo.lockToken,
            lockUntil: serverLockUntil || lockInfo.lockUntil,
          });
          return newLocks;
        }
        return prev;
      });

      // Restart lock renewal with server token and correct blockId
      if (serverLockToken) {
        if (lockRenewalTimerRef.current) {
          clearTimeout(lockRenewalTimerRef.current);
          lockRenewalTimerRef.current = null;
        }
        startLockRenewalRef.current(newBlock.id, serverLockToken);
      }

      return;
    }

    // Handle remote add (from other clients)
    if (operation.clientId === clientIdRef.current) return;

    setBlocks((prev) => ({
      ...prev,
      [newBlock.id]: newBlock,
    }));

    setBlockOrder((prev) => {
      if (prev.includes(newBlock.id)) return prev;

      if (operation.afterBlockId) {
        const index = prev.indexOf(operation.afterBlockId);
        if (index !== -1) {
          const newOrder = [...prev];
          newOrder.splice(index + 1, 0, newBlock.id);
          return newOrder;
        }
      }

      return [...prev, newBlock.id];
    });
  }, []);

  const handleRemoteBlockDelete = useCallback((operation: BlockDeleteOperation) => {
    // Ignore own deletes
    if (operation.clientId === clientIdRef.current) return;

    // Handle rejection
    if ((operation as any).type === 'block_delete_rejected') {
      console.warn('[BlockDocument] Block delete rejected:', (operation as any).reason);
      return;
    }

    setBlocks((prev) => {
      const newBlocks = { ...prev };
      delete newBlocks[operation.blockId];
      return newBlocks;
    });

    setBlockOrder((prev) => prev.filter((id) => id !== operation.blockId));

    // Remove lock if exists
    setLocks((prev) => {
      const newLocks = new Map(prev);
      newLocks.delete(operation.blockId);
      return newLocks;
    });
  }, []);

  const handleRemoteLock = useCallback((operation: LockOperation) => {
    const blockId = operation.blockId;

    switch (operation.type) {
      case 'lock_acquired':
        setLocks((prev) => {
          const newLocks = new Map(prev);
          newLocks.set(blockId, {
            blockId,
            lockedBy: operation.userId,
            username: operation.username,
            lockToken: operation.lockToken || '',
            lockUntil: operation.lockUntil || Date.now() + 15000,
          });
          return newLocks;
        });

        // Update remote users editing state
        setRemoteUsers((prev) =>
          prev.map((u) =>
            u.userId === operation.userId
              ? { ...u, editingBlockId: blockId }
              : u
          )
        );
        break;

      case 'lock_release':
      case 'lock_release_all' as any:
        setLocks((prev) => {
          const newLocks = new Map(prev);
          if (operation.type === 'lock_release') {
            newLocks.delete(blockId);
          } else {
            // Release all locks for user
            newLocks.forEach((lock, id) => {
              if (lock.lockedBy === operation.userId) {
                newLocks.delete(id);
              }
            });
          }
          return newLocks;
        });

        // Update remote users editing state
        setRemoteUsers((prev) =>
          prev.map((u) =>
            u.userId === operation.userId
              ? { ...u, editingBlockId: null }
              : u
          )
        );
        break;
    }
  }, []);

  const handleRemoteReorder = useCallback((operation: {
    type: string;
    docId: string;
    blockId: string;
    fromIndex: number;
    toIndex: number;
    userId: string;
    clientId: string;
  }) => {
    // Ignore own reorder operations
    if (operation.clientId === clientIdRef.current) return;

    setBlockOrder((prev) => {
      const { blockId, fromIndex, toIndex } = operation;
      const currentIndex = prev.indexOf(blockId);

      // If block is not at expected position, use current position
      const actualFromIndex = currentIndex !== -1 ? currentIndex : fromIndex;

      if (actualFromIndex === -1 || actualFromIndex === toIndex) return prev;

      const newOrder = [...prev];
      const [removed] = newOrder.splice(actualFromIndex, 1);
      newOrder.splice(toIndex > actualFromIndex ? toIndex : toIndex, 0, removed);

      return newOrder;
    });
  }, []);

  // ============================================
  // Lock Management
  // ============================================

  const requestLock = useCallback(async (blockId: string): Promise<boolean> => {
    if (!isConnected) return false;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 5000);

      // One-time subscription for lock response
      const checkLockResponse = (message: any) => {
        try {
          const operation = JSON.parse(message.body) as LockOperation;
          if (operation.blockId !== blockId) return;
          if (operation.userId !== userId) return;

          clearTimeout(timeout);

          if (operation.type === 'lock_acquired') {
            setEditingState({
              blockId,
              originalContent: blocks[blockId]?.content || '',
              lockToken: operation.lockToken || '',
              lockUntil: operation.lockUntil || Date.now() + 15000,
            });
            setEditingBlockId(blockId);
            startLockRenewal(blockId, operation.lockToken || '');
            resolve(true);
          } else if (operation.type === 'lock_denied') {
            resolve(false);
          }
        } catch {
          // Ignore parse errors
        }
      };

      const unsub = subscribe(TOPICS.RECEIVE_LOCK(docId), checkLockResponse);

      // Send lock request
      send(TOPICS.SEND_LOCK(docId), {
        type: 'lock_request',
        docId,
        blockId,
        userId,
        username,
        clientId: clientIdRef.current,
        timestamp: Date.now(),
      });

      // Cleanup after timeout
      setTimeout(() => {
        unsub();
      }, 5100);
    });
  }, [isConnected, docId, userId, username, blocks, subscribe, send]);

  const releaseLock = useCallback((blockId: string) => {
    if (!editingState || editingState.blockId !== blockId) return;

    // Stop renewal
    if (lockRenewalTimerRef.current) {
      clearTimeout(lockRenewalTimerRef.current);
      lockRenewalTimerRef.current = null;
    }

    // Send release
    send(TOPICS.SEND_LOCK(docId), {
      type: 'lock_release',
      docId,
      blockId,
      userId,
      username,
      clientId: clientIdRef.current,
      lockToken: editingState.lockToken,
      timestamp: Date.now(),
    });

    setEditingBlockId(null);
    setEditingState(null);
  }, [docId, userId, username, editingState, send]);

  const startLockRenewal = useCallback((blockId: string, lockToken: string) => {
    if (lockRenewalTimerRef.current) {
      clearTimeout(lockRenewalTimerRef.current);
    }

    lockRenewalTimerRef.current = setTimeout(() => {
      if (!isConnected) return;

      send(TOPICS.SEND_LOCK(docId), {
        type: 'lock_renew',
        docId,
        blockId,
        userId,
        username,
        clientId: clientIdRef.current,
        lockToken,
        timestamp: Date.now(),
      });

      // Schedule next renewal
      startLockRenewal(blockId, lockToken);
    }, LOCK_RENEWAL_INTERVAL);
  }, [docId, userId, username, isConnected, send]);

  // Ref for startLockRenewal (needed in subscription handlers to avoid stale closures)
  const startLockRenewalRef = useRef(startLockRenewal);
  startLockRenewalRef.current = startLockRenewal;

  // ============================================
  // Block Operations
  // ============================================

  // Track pending saves for accurate sync status
  const pendingSavesRef = useRef<Set<string>>(new Set());

  /**
   * Finish editing - flush pending saves and release lock
   */
  const finishEditing = useCallback(() => {
    if (!editingBlockId || !editingState) return;

    // Clear broadcast timer
    if (broadcastTimerRef.current) {
      clearTimeout(broadcastTimerRef.current);
      broadcastTimerRef.current = null;
    }

    // Clear DB save timer (prevent double-save after flush)
    if (dbSaveTimerRef.current) {
      clearTimeout(dbSaveTimerRef.current);
      dbSaveTimerRef.current = null;
    }

    // Flush pending content to DB before releasing lock
    if (pendingContentRef.current && pendingContentRef.current.blockId === editingBlockId) {
      const { content } = pendingContentRef.current;
      const block = blocks[editingBlockId];

      if (block && isConnected) {

        // Save to DB immediately
        send(BLOCK_TOPICS.SEND_BLOCK_UPDATE(docId), {
          type: 'block_update',
          docId,
          blockId: editingBlockId,
          content,
          version: block.version,
          userId,
          username,
          clientId: clientIdRef.current,
          timestamp: Date.now(),
        });
      }

      pendingContentRef.current = null;
    }

    // Release lock
    releaseLock(editingBlockId);
  }, [editingBlockId, editingState, blocks, docId, userId, username, isConnected, send, releaseLock]);

  /**
   * Cancel editing - restore original content and release lock
   */
  const cancelEditing = useCallback(() => {
    if (!editingBlockId || !editingState) return;

    // Restore original content
    setBlocks((prev) => ({
      ...prev,
      [editingBlockId]: {
        ...prev[editingBlockId],
        content: editingState.originalContent,
      },
    }));

    // Release lock
    releaseLock(editingBlockId);
  }, [editingBlockId, editingState, releaseLock]);

  const startEditing = useCallback(async (blockId: string): Promise<boolean> => {
    // Already editing this block
    if (editingBlockId === blockId) return true;

    // Finish current editing if any (releases lock without restoring content)
    if (editingBlockId) {
      finishEditing();
    }

    // Check if block exists
    if (!blocks[blockId]) return false;

    // Check if locked by someone else (and lock is not expired)
    const lockInfo = locks.get(blockId);
    if (lockInfo && lockInfo.lockedBy !== userId && lockInfo.lockUntil > Date.now()) {
      return false;
    }

    // Request lock
    return requestLock(blockId);
  }, [editingBlockId, blocks, locks, userId, requestLock, finishEditing]);

  /**
   * Start editing a block we just created (no need to request lock from server)
   * Used after addBlock() to immediately start editing the new block
   * This avoids race conditions with temp ID -> server ID transitions
   */
  const startEditingOwnBlock = useCallback((blockId: string): boolean => {
    // Already editing this block
    if (editingBlockId === blockId) return true;

    // Finish current editing if any (releases lock without restoring content)
    if (editingBlockId) {
      finishEditing();
    }

    // Check if block exists
    if (!blocks[blockId]) return false;

    // Set editing state directly (we own this block)
    // Server auto-registers lock in handleBlockAdd, so we use a local token
    // until the server response updates it via handleRemoteBlockAdd
    const block = blocks[blockId];
    const localToken = `local-${Date.now()}`;
    setEditingState({
      blockId,
      originalContent: block.content,
      lockToken: localToken,
      lockUntil: Date.now() + 60000, // 1 minute local lock (server will override)
    });
    setEditingBlockId(blockId);

    // Don't send lock_acquired to server - server auto-registers lock in handleBlockAdd
    // Don't start lock renewal - will be started with proper server token in handleRemoteBlockAdd

    return true;
  }, [editingBlockId, blocks, finishEditing]);

  const saveBlock = useCallback(async (blockId: string, content: string): Promise<boolean> => {
    if (!editingState || editingState.blockId !== blockId) return false;
    if (!isConnected) return false;

    const block = blocks[blockId];
    if (!block) return false;

    // Track pending save
    pendingSavesRef.current.add(blockId);
    setIsSyncing(true);

    // Send current version (server will increment it)
    const operation: BlockUpdateOperation = {
      type: 'block_update',
      docId,
      blockId,
      content,
      version: block.version, // Send current version, not +1
      userId,
      username,
      clientId: clientIdRef.current,
      timestamp: Date.now(),
    };

    send(BLOCK_TOPICS.SEND_BLOCK_UPDATE(docId), operation);

    // Optimistic update - only update content, let server response update version
    // Skip update if content is the same to prevent unnecessary re-renders
    setBlocks((prev) => {
      const currentBlock = prev[blockId];
      if (!currentBlock) return prev;

      // Skip if content hasn't changed (prevents focus loss during editing)
      if (currentBlock.content === content) return prev;

      return {
        ...prev,
        [blockId]: {
          ...currentBlock,
          content,
          // Don't increment version here - wait for server ACK
          updatedAt: new Date().toISOString(),
        },
      };
    });

    // Syncing will be set to false when we receive the ACK in handleRemoteBlockUpdate
    // Add a fallback timeout to clear syncing state if no response
    setTimeout(() => {
      pendingSavesRef.current.delete(blockId);
      if (pendingSavesRef.current.size === 0) {
        setIsSyncing(false);
      }
    }, 3000);

    return true;
  }, [docId, userId, username, blocks, editingState, isConnected, send]);

  /**
   * Broadcast content changes to other clients without saving to DB
   * Used for real-time sync while typing (debounced 50ms for batching rapid keystrokes)
   */
  const broadcastContent = useCallback((blockId: string, content: string) => {
    if (!isConnected || !editingState || editingState.blockId !== blockId) return;

    // Store pending content
    pendingContentRef.current = { blockId, content };

    // Clear existing broadcast timer
    if (broadcastTimerRef.current) {
      clearTimeout(broadcastTimerRef.current);
    }

    // Debounce broadcast (very short - 50ms)
    broadcastTimerRef.current = setTimeout(() => {
      if (!pendingContentRef.current) return;

      const { blockId: bid, content: cont } = pendingContentRef.current;

      // Send preview message (no DB save, just broadcast)
      send(BLOCK_TOPICS.SEND_BLOCK_PREVIEW(docId), {
        type: 'block_content_preview',
        docId,
        blockId: bid,
        content: cont,
        userId,
        username,
        clientId: clientIdRef.current,
        timestamp: Date.now(),
      });

      // Also schedule DB save (debounced 2 seconds)
      if (dbSaveTimerRef.current) {
        clearTimeout(dbSaveTimerRef.current);
      }
      dbSaveTimerRef.current = setTimeout(() => {
        if (pendingContentRef.current) {
          // Use ref for blocks to get current version (avoid stale closure)
          const block = blocksRef.current[pendingContentRef.current.blockId];
          if (block) {
            // Save to DB
            send(BLOCK_TOPICS.SEND_BLOCK_UPDATE(docId), {
              type: 'block_update',
              docId,
              blockId: pendingContentRef.current.blockId,
              content: pendingContentRef.current.content,
              version: block.version,
              userId,
              username,
              clientId: clientIdRef.current,
              timestamp: Date.now(),
            });
            pendingContentRef.current = null;
          }
        }
      }, DB_SAVE_DEBOUNCE);

      // Don't clear pendingContentRef here - it's needed by:
      // 1. The DB save timer above (fires 2s later)
      // 2. finishEditing() to flush pending content on navigation
    }, BROADCAST_DEBOUNCE);
  }, [docId, userId, username, editingState, isConnected, send]);

  /**
   * Update local content state only (no network request)
   * Used for optimistic UI updates while typing
   */
  const updateLocalContent = useCallback((blockId: string, content: string) => {
    setBlocks((prev) => {
      const block = prev[blockId];
      if (!block) return prev;

      // Skip if content hasn't changed (prevents focus loss during editing)
      if (block.content === content) return prev;

      return {
        ...prev,
        [blockId]: {
          ...block,
          content,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }, []);

  const addBlock = useCallback(async (
    type: BlockType,
    afterBlockId?: string | null,
    initialContent?: string,
    options?: { startEditing?: boolean }
  ): Promise<string | null> => {
    if (!isConnected) return null;

    // Use provided content or create empty content
    const content = initialContent || createEmptyBlockContent(type);
    const tempId = generateBlockId();

    const operation: BlockAddOperation = {
      type: 'block_add',
      docId,
      blockType: type,
      content,
      afterBlockId: afterBlockId || null,
      userId,
      username,
      clientId: clientIdRef.current,
      tempBlockId: tempId, // Send tempId to server for mapping
      timestamp: Date.now(),
    };

    send(BLOCK_TOPICS.SEND_BLOCK_ADD(docId), operation);

    // Optimistic update with temporary ID
    const newBlock: Block = {
      id: tempId,
      type,
      content,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      lockedBy: null,
      lockToken: null,
      lockUntil: null,
    };

    setBlocks((prev) => ({ ...prev, [tempId]: newBlock }));
    setBlockOrder((prev) => {
      if (afterBlockId) {
        const index = prev.indexOf(afterBlockId);
        if (index !== -1) {
          const newOrder = [...prev];
          newOrder.splice(index + 1, 0, tempId);
          return newOrder;
        }
      }
      return [...prev, tempId];
    });

    // If startEditing is requested, set up editing state directly here
    // This avoids React state batching issues where blocks[tempId] isn't available yet
    if (options?.startEditing) {
      // First release any existing lock
      if (editingBlockId) {
        // Clear broadcast timer
        if (broadcastTimerRef.current) {
          clearTimeout(broadcastTimerRef.current);
          broadcastTimerRef.current = null;
        }

        // Flush pending content
        if (pendingContentRef.current && pendingContentRef.current.blockId === editingBlockId) {
          const pendingBlock = blocks[editingBlockId];
          if (pendingBlock && isConnected) {
            if (dbSaveTimerRef.current) {
              clearTimeout(dbSaveTimerRef.current);
              dbSaveTimerRef.current = null;
            }
            send(BLOCK_TOPICS.SEND_BLOCK_UPDATE(docId), {
              type: 'block_update',
              docId,
              blockId: editingBlockId,
              content: pendingContentRef.current.content,
              version: pendingBlock.version,
              userId,
              username,
              clientId: clientIdRef.current,
              timestamp: Date.now(),
            });
          }
          pendingContentRef.current = null;
        }

        // Release old lock
        if (editingState) {
          if (lockRenewalTimerRef.current) {
            clearTimeout(lockRenewalTimerRef.current);
            lockRenewalTimerRef.current = null;
          }
          send(TOPICS.SEND_LOCK(docId), {
            type: 'lock_release',
            docId,
            blockId: editingBlockId,
            userId,
            username,
            clientId: clientIdRef.current,
            lockToken: editingState.lockToken,
            timestamp: Date.now(),
          });
        }
      }

      // Set up editing state for new block
      // Server auto-registers lock in handleBlockAdd, so use local token
      // until server response updates it via handleRemoteBlockAdd
      const lockToken = `local-${Date.now()}`;
      const lockUntil = Date.now() + 60000;

      setEditingState({
        blockId: tempId,
        originalContent: content,
        lockToken,
        lockUntil,
      });
      setEditingBlockId(tempId);

      // Don't send lock_acquired or start lock renewal here
      // Server auto-registers lock in handleBlockAdd
      // handleRemoteBlockAdd will update lockToken and start renewal
    }

    return tempId;
  }, [docId, userId, username, isConnected, send, editingBlockId, editingState, blocks]);

  const deleteBlock = useCallback(async (blockId: string): Promise<boolean> => {
    if (!isConnected) return false;

    // Check if locked by someone else
    const lockInfo = locks.get(blockId);
    if (lockInfo && lockInfo.lockedBy !== userId) {
      return false;
    }

    const operation: BlockDeleteOperation = {
      type: 'block_delete',
      docId,
      blockId,
      userId,
      username,
      clientId: clientIdRef.current,
      timestamp: Date.now(),
    };

    send(BLOCK_TOPICS.SEND_BLOCK_DELETE(docId), operation);

    // Optimistic update
    setBlocks((prev) => {
      const newBlocks = { ...prev };
      delete newBlocks[blockId];
      return newBlocks;
    });
    setBlockOrder((prev) => prev.filter((id) => id !== blockId));

    return true;
  }, [docId, userId, username, locks, isConnected, send]);

  const reorderBlocks = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    if (!isConnected) return;

    setBlockOrder((prev) => {
      const newOrder = [...prev];
      const [removed] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, removed);

      // Send reorder to server (uses existing reorder endpoint)
      send(TOPICS.SEND_REORDER(docId), {
        type: 'reorder',
        docId,
        blockId: removed,
        fromIndex,
        toIndex,
        userId,
        username,
        clientId: clientIdRef.current,
        timestamp: Date.now(),
      });

      return newOrder;
    });
  }, [docId, userId, username, isConnected, send]);

  /**
   * Reorder multiple blocks at once (for multi-block drag)
   * Moves a group of blocks to a new position
   */
  const reorderMultiple = useCallback((blockIds: string[], targetIndex: number) => {
    if (blockIds.length === 0) return;
    if (!isConnected) return;

    setBlockOrder((prev) => {
      // Remove all blocks to move from current positions
      const remaining = prev.filter(id => !blockIds.includes(id));

      // Find the actual insert position after removal
      let insertAt = targetIndex;
      // Count how many blocks before targetIndex were removed
      const removedBefore = prev.slice(0, targetIndex).filter(id => blockIds.includes(id)).length;
      insertAt -= removedBefore;

      // Clamp to valid range
      insertAt = Math.max(0, Math.min(insertAt, remaining.length));

      // Insert all blocks at the target position (maintaining their relative order)
      const orderedBlockIds = prev.filter(id => blockIds.includes(id)); // Keep original relative order
      const newOrder = [
        ...remaining.slice(0, insertAt),
        ...orderedBlockIds,
        ...remaining.slice(insertAt),
      ];

      // Send reorder messages for each block
      orderedBlockIds.forEach((blockId) => {
        const originalIndex = prev.indexOf(blockId);
        const newIndex = newOrder.indexOf(blockId);
        if (originalIndex !== newIndex) {
          send(TOPICS.SEND_REORDER(docId), {
            type: 'reorder',
            docId,
            blockId,
            fromIndex: originalIndex,
            toIndex: newIndex,
            userId,
            username,
            clientId: clientIdRef.current,
            timestamp: Date.now(),
          });
        }
      });

      return newOrder;
    });
  }, [docId, userId, username, isConnected, send]);

  /**
   * Clear all blocks - used when replacing document content (e.g., AI organize)
   * Deletes all blocks locally without sending individual delete operations
   */
  const clearAllBlocks = useCallback(async (): Promise<void> => {
    // Clear local state - blocks will be re-added after this
    setBlocks({});
    setBlockOrder([]);

    // Note: We don't send delete operations for each block
    // because we're about to add new blocks that will replace them
    // The server will handle cleanup when new blocks are saved
  }, []);

  // ============================================
  // Utility Functions
  // ============================================

  const getBlock = useCallback((blockId: string): Block | null => {
    return blocks[blockId] || null;
  }, [blocks]);

  const isBlockLockedFn = useCallback((blockId: string): boolean => {
    const lockInfo = locks.get(blockId);
    if (!lockInfo) return false;
    return lockInfo.lockUntil > Date.now();
  }, [locks]);

  const isBlockLockedByMe = useCallback((blockId: string): boolean => {
    const lockInfo = locks.get(blockId);
    if (!lockInfo) return false;
    return lockInfo.lockedBy === userId && lockInfo.lockUntil > Date.now();
  }, [locks, userId]);

  const getBlockLockInfo = useCallback((blockId: string): BlockLockState | null => {
    return locks.get(blockId) || null;
  }, [locks]);

  // ============================================
  // Cleanup
  // ============================================

  useEffect(() => {
    return () => {
      if (lockRenewalTimerRef.current) {
        clearTimeout(lockRenewalTimerRef.current);
      }
      if (broadcastTimerRef.current) {
        clearTimeout(broadcastTimerRef.current);
      }
      if (dbSaveTimerRef.current) {
        clearTimeout(dbSaveTimerRef.current);
      }
    };
  }, []);

  // ============================================
  // Return
  // ============================================

  return {
    // Document state
    document,
    blockOrder,
    blocks,
    isLoading,
    error,

    // Connection state
    isConnected,
    isSyncing,

    // Editing state
    editingBlockId,
    editingState,
    locks,

    // Users
    remoteUsers,

    // Block operations
    startEditing,
    startEditingOwnBlock,
    saveBlock,
    broadcastContent,
    updateLocalContent,
    finishEditing,
    cancelEditing,

    // Block CRUD
    addBlock,
    deleteBlock,
    reorderBlocks,
    reorderMultiple,
    clearAllBlocks,

    // Utilities
    getBlock,
    isBlockLocked: isBlockLockedFn,
    isBlockLockedByMe,
    getBlockLockInfo,
  };
}

export default useBlockDocument;
