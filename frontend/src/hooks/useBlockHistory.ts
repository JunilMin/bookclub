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
  const { onAddBlock, onDeleteBlock, onUpdateBlock, onReorderBlock, getBlock: _getBlock, getBlockOrder: _getBlockOrder } = options;

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

  /**
   * 텍스트 변경 플러시 (현재 pending된 변경을 스택에 푸시)
   */
  const flushTextChange = useCallback(() => {
    const pending = pendingTextChangeRef.current;
    if (pending && pending.originalContent !== pending.currentContent) {
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
    }
  }, []);

  /**
   * 텍스트 변경 추적 (디바운스 적용)
   */
  const trackTextChange = useCallback((blockId: string, content: string) => {
    // Undo/Redo 중에는 추적하지 않음
    if (isUndoRedoInProgressRef.current) return;

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

      // 새 pending 시작
      pendingTextChangeRef.current = {
        blockId,
        originalContent: content, // 첫 입력이므로 현재 내용이 원본
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

    const entry = undoStackRef.current.pop();
    if (!entry) return false;

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
            const newBlockId = await onAddBlock(
              entry.data.block.type,
              entry.data.afterBlockId ?? null,
              entry.data.block.content
            );
            // 복원된 블록의 ID가 다를 수 있음 - entry 업데이트
            if (newBlockId && newBlockId !== entry.blockId) {
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

      return true;
    } catch (error) {
      console.error('Undo failed:', error);
      // 실패 시 다시 undo 스택에 넣기
      undoStackRef.current.push(entry);
      return false;
    } finally {
      isUndoRedoInProgressRef.current = false;
    }
  }, [flushTextChange, onAddBlock, onDeleteBlock, onUpdateBlock, onReorderBlock]);

  /**
   * Redo 실행
   */
  const redo = useCallback(async (): Promise<boolean> => {
    const entry = redoStackRef.current.pop();
    if (!entry) return false;

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
            if (newBlockId && newBlockId !== entry.blockId) {
              entry.blockId = newBlockId;
            }
          }
          break;
        }

        case 'block_delete': {
          // 블록 다시 삭제
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
