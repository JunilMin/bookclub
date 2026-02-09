/**
 * useBlockHistory - Undo/Redo 기능을 위한 히스토리 관리 훅
 *
 * 각 사용자마다 독립적인 스택을 유지하며,
 * 블록 추가/삭제/수정/이동을 추적합니다.
 */

import { useCallback, useRef } from 'react';
import { Block, BlockType } from '../types/blockDocument';

// 히스토리 엔트리 타입
export type HistoryEntryType = 'block_add' | 'block_delete' | 'block_update' | 'block_reorder';

export interface HistoryEntry {
  type: HistoryEntryType;
  blockId: string;
  timestamp: number;
  data: {
    block?: Block;              // 삭제된 블록 복원용 / 추가된 블록 삭제용
    blockType?: BlockType;      // 블록 타입
    previousContent?: string;   // 이전 내용 (update용)
    newContent?: string;        // 새 내용 (redo용)
    afterBlockId?: string | null; // 이전 위치 (삭제/이동 시 복원용)
    previousAfterBlockId?: string | null; // reorder 시 이전 위치
    newAfterBlockId?: string | null;      // reorder 시 새 위치
  };
}

// 최대 히스토리 크기
const MAX_HISTORY_SIZE = 100;

// 텍스트 변경 디바운스 시간 (ms)
const TEXT_CHANGE_DEBOUNCE_MS = 800;

interface UseBlockHistoryOptions {
  // 블록 작업 콜백들
  onAddBlock: (type: BlockType, afterBlockId: string | null, content?: string) => Promise<string | null>;
  onDeleteBlock: (blockId: string) => Promise<void>;
  onUpdateBlock: (blockId: string, content: string) => void;
  onReorderBlock?: (blockId: string, afterBlockId: string | null) => Promise<void>;
  // 현재 블록 상태 조회
  getBlock: (blockId: string) => Block | undefined;
  getBlockOrder: () => string[];
}

interface UseBlockHistoryReturn {
  // 히스토리 푸시 함수들
  pushAddBlock: (blockId: string, block: Block, afterBlockId: string | null) => void;
  pushDeleteBlock: (blockId: string, block: Block, afterBlockId: string | null) => void;
  pushUpdateBlock: (blockId: string, previousContent: string, newContent: string) => void;
  pushReorderBlock: (blockId: string, previousAfterBlockId: string | null, newAfterBlockId: string | null) => void;

  // 텍스트 변경 디바운스 (키 입력마다 호출)
  trackTextChange: (blockId: string, content: string) => void;
  flushTextChange: () => void;

  // Undo/Redo 실행
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;

  // 상태 조회
  canUndo: () => boolean;
  canRedo: () => boolean;

  // 스택 초기화
  clearHistory: () => void;
}

export function useBlockHistory(options: UseBlockHistoryOptions): UseBlockHistoryReturn {
  const { onAddBlock, onDeleteBlock, onUpdateBlock, onReorderBlock, getBlock, getBlockOrder: _getBlockOrder } = options;

  // Keep getBlock in a ref so trackTextChange always has the latest version
  const getBlockRef = useRef(getBlock);
  getBlockRef.current = getBlock;

  // 히스토리 스택 (ref로 관리하여 리렌더링 방지)
  const undoStackRef = useRef<HistoryEntry[]>([]);
  const redoStackRef = useRef<HistoryEntry[]>([]);

  // 텍스트 변경 추적용
  const pendingTextChangeRef = useRef<{
    blockId: string;
    originalContent: string;
    currentContent: string;
    timeoutId: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  // Undo/Redo 작업 중인지 추적 (무한 루프 방지)
  const isUndoRedoInProgressRef = useRef(false);

  // Undo/Redo 완료 후 잠시 trackTextChange를 억제 (debouncedAutoSave 30ms가 뒤늦게 fire되는 것 방지)
  const suppressTrackUntilRef = useRef(0);

  // 최근 삭제된 블록 ID 추적 (삭제된 블록에 대한 spurious trackTextChange 방지)
  const deletedBlockIdsRef = useRef<Set<string>>(new Set());

  /**
   * 텍스트 변경 플러시 (현재 pending된 변경을 스택에 푸시)
   */
  const flushTextChange = useCallback(() => {
    const pending = pendingTextChangeRef.current;
    if (pending && pending.originalContent !== pending.currentContent) {
      // 삭제된 블록에 대한 변경은 무시
      if (deletedBlockIdsRef.current.has(pending.blockId)) {
        if (pending.timeoutId) clearTimeout(pending.timeoutId);
        pendingTextChangeRef.current = null;
        return;
      }

      // 블록이 존재하는지 확인 (삭제 후 unmount cleanup에서 생성된 spurious pending 방지)
      const blockExists = getBlockRef.current(pending.blockId);
      if (!blockExists) {
        if (pending.timeoutId) clearTimeout(pending.timeoutId);
        pendingTextChangeRef.current = null;
        return;
      }

      // 타이머 클리어
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }

      // 스택에 푸시
      const entry: HistoryEntry = {
        type: 'block_update',
        blockId: pending.blockId,
        timestamp: Date.now(),
        data: {
          previousContent: pending.originalContent,
          newContent: pending.currentContent,
        },
      };

      undoStackRef.current.push(entry);

      // 최대 크기 제한
      if (undoStackRef.current.length > MAX_HISTORY_SIZE) {
        undoStackRef.current.shift();
      }

      // Redo 스택 클리어 (새 변경이 발생했으므로)
      redoStackRef.current = [];

      // pending 초기화
      pendingTextChangeRef.current = null;
    } else if (pending) {
      // pending exists but no change (originalContent === currentContent)
      if (pending.timeoutId) clearTimeout(pending.timeoutId);
      pendingTextChangeRef.current = null;
    }
  }, []);

  /**
   * 텍스트 변경 추적 (디바운스 적용)
   */
  const trackTextChange = useCallback((blockId: string, content: string) => {
    // Undo/Redo 중에는 추적하지 않음
    if (isUndoRedoInProgressRef.current) return;

    // Undo/Redo 직후 debouncedAutoSave에 의한 호출 억제
    if (Date.now() < suppressTrackUntilRef.current) return;

    // 삭제된 블록에 대한 변경은 무시 (unmount cleanup에서 호출될 수 있음)
    if (deletedBlockIdsRef.current.has(blockId)) return;

    const pending = pendingTextChangeRef.current;

    if (pending && pending.blockId === blockId) {
      // 같은 블록 계속 수정 중 - 타이머 리셋
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }

      pending.currentContent = content;
      pending.timeoutId = setTimeout(() => {
        flushTextChange();
      }, TEXT_CHANGE_DEBOUNCE_MS);
    } else {
      // 다른 블록으로 이동 - 이전 pending 플러시
      if (pending) {
        flushTextChange();
      }

      // 새 pending 시작 - 블록의 현재 상태(수정 전)를 원본으로 저장
      const currentBlock = getBlockRef.current(blockId);
      const originalContent = currentBlock?.content || content;

      pendingTextChangeRef.current = {
        blockId,
        originalContent, // 블록의 수정 전 내용을 원본으로 저장
        currentContent: content,
        timeoutId: null,
      };
    }
  }, [flushTextChange]);

  /**
   * 블록 추가 히스토리 푸시
   */
  const pushAddBlock = useCallback((blockId: string, block: Block, afterBlockId: string | null) => {
    if (isUndoRedoInProgressRef.current) return;

    flushTextChange();

    const entry: HistoryEntry = {
      type: 'block_add',
      blockId,
      timestamp: Date.now(),
      data: {
        block,
        afterBlockId,
      },
    };

    undoStackRef.current.push(entry);
    if (undoStackRef.current.length > MAX_HISTORY_SIZE) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
  }, [flushTextChange]);

  /**
   * 블록 삭제 히스토리 푸시
   */
  const pushDeleteBlock = useCallback((blockId: string, block: Block, afterBlockId: string | null) => {
    if (isUndoRedoInProgressRef.current) return;

    flushTextChange();

    // 삭제된 블록 ID 등록 (이후 unmount cleanup에서의 trackTextChange 방지)
    deletedBlockIdsRef.current.add(blockId);

    const entry: HistoryEntry = {
      type: 'block_delete',
      blockId,
      timestamp: Date.now(),
      data: {
        block,
        afterBlockId,
      },
    };

    undoStackRef.current.push(entry);
    if (undoStackRef.current.length > MAX_HISTORY_SIZE) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];

    // 삭제된 블록에 대한 pending이 생기지 않도록 즉시 클리어
    if (pendingTextChangeRef.current?.blockId === blockId) {
      if (pendingTextChangeRef.current.timeoutId) {
        clearTimeout(pendingTextChangeRef.current.timeoutId);
      }
      pendingTextChangeRef.current = null;
    }
  }, [flushTextChange]);

  /**
   * 블록 수정 히스토리 푸시 (직접 호출용 - 디바운스 없이)
   */
  const pushUpdateBlock = useCallback((blockId: string, previousContent: string, newContent: string) => {
    if (isUndoRedoInProgressRef.current) return;
    if (previousContent === newContent) return;

    flushTextChange();

    const entry: HistoryEntry = {
      type: 'block_update',
      blockId,
      timestamp: Date.now(),
      data: {
        previousContent,
        newContent,
      },
    };

    undoStackRef.current.push(entry);
    if (undoStackRef.current.length > MAX_HISTORY_SIZE) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
  }, [flushTextChange]);

  /**
   * 블록 이동 히스토리 푸시
   */
  const pushReorderBlock = useCallback((blockId: string, previousAfterBlockId: string | null, newAfterBlockId: string | null) => {
    if (isUndoRedoInProgressRef.current) return;

    flushTextChange();

    const entry: HistoryEntry = {
      type: 'block_reorder',
      blockId,
      timestamp: Date.now(),
      data: {
        previousAfterBlockId,
        newAfterBlockId,
      },
    };

    undoStackRef.current.push(entry);
    if (undoStackRef.current.length > MAX_HISTORY_SIZE) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
  }, [flushTextChange]);

  /**
   * Undo 실행
   */
  const undo = useCallback(async (): Promise<boolean> => {
    flushTextChange();

    // Log stack state before pop
    console.log('[History] Undo stack before pop (size=' + undoStackRef.current.length + '):',
      undoStackRef.current.map(e => `${e.type}(${e.blockId.substring(0, 8)})`).join(', '));

    const entry = undoStackRef.current.pop();
    if (!entry) {
      console.log('[History] Undo: stack empty, nothing to undo');
      return false;
    }

    console.log('[History] Undo:', entry.type, 'blockId:', entry.blockId,
      'data.block exists:', !!entry.data.block, 'data.afterBlockId:', entry.data.afterBlockId);
    isUndoRedoInProgressRef.current = true;

    try {
      switch (entry.type) {
        case 'block_add': {
          // 추가된 블록 삭제
          await onDeleteBlock(entry.blockId);
          break;
        }

        case 'block_delete': {
          // 삭제된 블록 복원
          if (entry.data.block) {
            // 삭제된 블록 ID 레지스트리에서 제거 (복원되면 다시 추적 가능하도록)
            deletedBlockIdsRef.current.delete(entry.blockId);

            const newBlockId = await onAddBlock(
              entry.data.block.type,
              entry.data.afterBlockId ?? null,
              entry.data.block.content
            );
            if (!newBlockId) {
              // addBlock failed (e.g., not connected) - put entry back on undo stack
              deletedBlockIdsRef.current.add(entry.blockId);
              undoStackRef.current.push(entry);
              return false;
            }
            // 복원된 블록의 ID가 다를 수 있음 - entry 업데이트
            if (newBlockId !== entry.blockId) {
              entry.blockId = newBlockId;
            }
          }
          break;
        }

        case 'block_update': {
          // 이전 내용으로 복원
          if (entry.data.previousContent !== undefined) {
            onUpdateBlock(entry.blockId, entry.data.previousContent);
          }
          break;
        }

        case 'block_reorder': {
          // 이전 위치로 이동
          if (onReorderBlock && entry.data.previousAfterBlockId !== undefined) {
            await onReorderBlock(entry.blockId, entry.data.previousAfterBlockId);
          }
          break;
        }
      }

      // Redo 스택에 푸시
      redoStackRef.current.push(entry);
      console.log('[History] Undo success → redo stack size:', redoStackRef.current.length);

      return true;
    } catch (error) {
      console.error('[History] Undo failed:', error);
      // 실패 시 다시 undo 스택에 넣기
      undoStackRef.current.push(entry);
      return false;
    } finally {
      isUndoRedoInProgressRef.current = false;
      // debouncedAutoSave (30ms)가 undo 완료 후에 fire되어 spurious pending을 만드는 것 방지
      suppressTrackUntilRef.current = Date.now() + 100;
    }
  }, [flushTextChange, onAddBlock, onDeleteBlock, onUpdateBlock, onReorderBlock]);

  /**
   * Redo 실행
   */
  const redo = useCallback(async (): Promise<boolean> => {
    const entry = redoStackRef.current.pop();
    if (!entry) {
      console.log('[History] Redo: stack empty, nothing to redo');
      return false;
    }
    console.log('[History] Redo:', entry.type, 'blockId:', entry.blockId);

    isUndoRedoInProgressRef.current = true;

    try {
      switch (entry.type) {
        case 'block_add': {
          // 블록 다시 추가
          if (entry.data.block) {
            const newBlockId = await onAddBlock(
              entry.data.block.type,
              entry.data.afterBlockId ?? null,
              entry.data.block.content
            );
            if (!newBlockId) {
              console.warn('[History] Redo block_add: onAddBlock returned null, redo failed');
              redoStackRef.current.push(entry);
              return false;
            }
            if (newBlockId !== entry.blockId) {
              entry.blockId = newBlockId;
            }
          }
          break;
        }

        case 'block_delete': {
          // 블록 다시 삭제
          deletedBlockIdsRef.current.add(entry.blockId);
          await onDeleteBlock(entry.blockId);
          break;
        }

        case 'block_update': {
          // 새 내용으로 적용
          if (entry.data.newContent !== undefined) {
            onUpdateBlock(entry.blockId, entry.data.newContent);
          }
          break;
        }

        case 'block_reorder': {
          // 새 위치로 이동
          if (onReorderBlock && entry.data.newAfterBlockId !== undefined) {
            await onReorderBlock(entry.blockId, entry.data.newAfterBlockId);
          }
          break;
        }
      }

      // Undo 스택에 푸시
      undoStackRef.current.push(entry);

      return true;
    } catch (error) {
      console.error('Redo failed:', error);
      // 실패 시 다시 redo 스택에 넣기
      redoStackRef.current.push(entry);
      return false;
    } finally {
      isUndoRedoInProgressRef.current = false;
      suppressTrackUntilRef.current = Date.now() + 100;
    }
  }, [onAddBlock, onDeleteBlock, onUpdateBlock, onReorderBlock]);

  /**
   * Undo 가능 여부
   */
  const canUndo = useCallback((): boolean => {
    return undoStackRef.current.length > 0 || pendingTextChangeRef.current !== null;
  }, []);

  /**
   * Redo 가능 여부
   */
  const canRedo = useCallback((): boolean => {
    return redoStackRef.current.length > 0;
  }, []);

  /**
   * 히스토리 초기화
   */
  const clearHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    deletedBlockIdsRef.current.clear();
    if (pendingTextChangeRef.current?.timeoutId) {
      clearTimeout(pendingTextChangeRef.current.timeoutId);
    }
    pendingTextChangeRef.current = null;
  }, []);

  return {
    pushAddBlock,
    pushDeleteBlock,
    pushUpdateBlock,
    pushReorderBlock,
    trackTextChange,
    flushTextChange,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  };
}
