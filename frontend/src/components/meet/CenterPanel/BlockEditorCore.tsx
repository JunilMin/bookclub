/**
 * BlockEditorCore - Shared block editing UI component
 *
 * Extracts all common block editing logic shared between:
 * - BlockBasedNotes (collaborative/shared notes in MeetRoom)
 * - NoteDetail (personal forked notes)
 *
 * Handles: DnD, marquee selection, block selection, copy/paste,
 * keyboard shortcuts, pending navigation, toolbar, block rendering loop.
 *
 * Parent components provide block data + callbacks (already history-wrapped).
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { TFunction } from 'i18next';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  FiPlus,
  FiBold,
  FiItalic,
  FiList,
  FiCode,
  FiRotateCcw,
  FiRotateCw,
} from 'react-icons/fi';
import { Block, BlockType, BlockLockState } from '../../../types/blockDocument';
import BlockRenderer from './BlockRenderer';
import SortableBlockRenderer from './SortableBlockRenderer';
import { BlockEditorRef } from './BlockEditor';

// ============================================
// Types
// ============================================

export interface BlockEditorCoreProps {
  // Block data (from parent)
  blockOrder: string[];
  blocks: Record<string, Block>;
  editingBlockId: string | null;
  currentUserId: string;

  // Block operation callbacks (parent wraps with history)
  onStartEdit: (blockId: string) => void | Promise<any>;
  onSaveEdit: (blockId: string, content: string) => void;
  onAutoSave: (blockId: string, content: string) => void;
  onCancelEdit: () => void;
  onFinishEditing: () => void;
  onDeleteBlock: (blockId: string) => void | Promise<any>;
  onAddBlock: (type: BlockType, afterBlockId?: string | null, initialContent?: string) => any;
  onSaveAndCreateNext: (blockId: string, content: string, nextBlockType?: BlockType, nextListStart?: number) => void;
  onMoveToPrevBlock: (blockId: string) => void;
  onMoveToNextBlock: (blockId: string) => void;
  onReorderBlocks: (fromIndex: number, toIndex: number) => void;
  onReorderMultiple: (blockIds: string[], targetIndex: number) => void;

  // Undo/Redo
  onUndo: () => Promise<boolean>;
  onRedo: () => Promise<boolean>;
  canUndo: () => boolean;
  canRedo: () => boolean;
  flushTextChange: () => void;

  // Selected blocks delete (parent handles history)
  onDeleteSelectedBlocks: (blockIds: string[]) => void;
  // Tab indent/outdent
  onSaveBlock: (blockId: string, content: string) => void;
  // Reorder history push (optional)
  onHistoryPushReorder?: (blockId: string, prevAfter: string | null, newAfter: string | null) => void;

  // Lock (collaborative only, optional)
  isBlockLocked?: (blockId: string) => boolean;
  isBlockLockedByMe?: (blockId: string) => boolean;
  getBlockLockInfo?: (blockId: string) => BlockLockState | null;

  // Editor ref
  editorRef: React.RefObject<BlockEditorRef | null>;

  // UI customization
  className?: string;
  showToolbar?: boolean;
  disabled?: boolean;
  t: TFunction;
}

// ============================================
// Helper Functions
// ============================================

function extractTextFromNode(node: any): string {
  if (!node) return '';
  if (node.type === 'text' && node.text) return node.text;
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractTextFromNode).join('');
  }
  return '';
}

function extractTextFromTipTap(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractTextFromTipTap).join('');
  }
  return '';
}

function isBlockEmpty(blocks: Record<string, Block>, blockId: string): boolean {
  const block = blocks[blockId];
  if (!block) return false;

  try {
    const parsed = JSON.parse(block.content);
    if (!parsed.content || parsed.content.length === 0) return true;
    if (parsed.content.length === 1) {
      const firstChild = parsed.content[0];
      if (!firstChild.content || firstChild.content.length === 0) return true;
      if (firstChild.content.length === 1 && firstChild.content[0].type === 'text') {
        const text = firstChild.content[0].text || '';
        return text.trim() === '';
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ============================================
// Component
// ============================================

const BlockEditorCore: React.FC<BlockEditorCoreProps> = ({
  blockOrder,
  blocks,
  editingBlockId,
  currentUserId,
  onStartEdit,
  onSaveEdit,
  onAutoSave,
  onCancelEdit,
  onFinishEditing,
  onDeleteBlock,
  onAddBlock,
  onSaveAndCreateNext,
  onMoveToPrevBlock,
  onMoveToNextBlock,
  onReorderBlocks,
  onReorderMultiple,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  flushTextChange,
  onDeleteSelectedBlocks,
  onSaveBlock,
  onHistoryPushReorder,
  isBlockLocked = () => false,
  isBlockLockedByMe = () => false,
  getBlockLockInfo = () => null,
  editorRef,
  className,
  showToolbar = true,
  disabled = false,
  t,
}) => {
  // ============================================
  // Internal State
  // ============================================

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);

  // Block selection state
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());
  const lastFocusedBlockIdRef = useRef<string | null>(null);

  // Marquee selection state
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);
  const blockListRef = useRef<HTMLDivElement>(null);

  // Pending navigation state
  const [pendingEditBlockId, setPendingEditBlockId] = useState<string | null>(null);
  const [isNavigationPending, setIsNavigationPending] = useState(false);
  type PendingActionType = 'enter' | 'backspace' | 'arrowUp' | 'arrowDown';
  const pendingActionRef = useRef<{ type: PendingActionType; count: number } | null>(null);

  // Ref to always access latest blocks (avoids stale closure in setTimeout)
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  // ============================================
  // DnD Sensors
  // ============================================

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ============================================
  // Drag Handlers
  // ============================================

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const draggedId = event.active.id as string;
    setActiveId(draggedId);

    if (!selectedBlockIds.has(draggedId)) {
      setSelectedBlockIds(new Set([draggedId]));
    }
  }, [selectedBlockIds]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const draggedId = active.id as string;
    const overId = over.id as string;

    const blocksToMove = selectedBlockIds.has(draggedId)
      ? blockOrder.filter(id => selectedBlockIds.has(id))
      : [draggedId];

    if (blocksToMove.length === 0) return;

    const overIndex = blockOrder.indexOf(overId);

    if (blocksToMove.length === 1) {
      const fromIndex = blockOrder.indexOf(blocksToMove[0]);
      if (fromIndex !== overIndex) {
        const previousAfterBlockId = fromIndex > 0 ? blockOrder[fromIndex - 1] : null;
        const newAfterBlockId = overIndex > 0 ? blockOrder[overIndex - 1] : null;
        onReorderBlocks(fromIndex, overIndex);
        onHistoryPushReorder?.(blocksToMove[0], previousAfterBlockId, newAfterBlockId);
      }
    } else {
      const firstSelectedIndex = blockOrder.indexOf(blocksToMove[0]);
      const isMovingDown = firstSelectedIndex < overIndex;
      const targetIndex = isMovingDown ? overIndex + 1 : overIndex;
      onReorderMultiple(blocksToMove, targetIndex);
    }
  }, [blockOrder, selectedBlockIds, onReorderBlocks, onReorderMultiple, onHistoryPushReorder]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const multiDragCollisionDetection: CollisionDetection = useCallback((args) => {
    const { active } = args;
    const draggedId = active.id as string;
    const isMultiDrag = selectedBlockIds.has(draggedId) && selectedBlockIds.size > 1;

    if (!isMultiDrag) {
      return closestCenter(args);
    }

    const filteredArgs = {
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => !selectedBlockIds.has(container.id as string) || container.id === draggedId
      ),
    };

    return closestCenter(filteredArgs);
  }, [selectedBlockIds]);

  // ============================================
  // Marquee Selection
  // ============================================

  const getMarqueeRect = useCallback(() => {
    if (!marqueeStart || !marqueeEnd) return null;
    return {
      left: Math.min(marqueeStart.x, marqueeEnd.x),
      top: Math.min(marqueeStart.y, marqueeEnd.y),
      right: Math.max(marqueeStart.x, marqueeEnd.x),
      bottom: Math.max(marqueeStart.y, marqueeEnd.y),
      width: Math.abs(marqueeEnd.x - marqueeStart.x),
      height: Math.abs(marqueeEnd.y - marqueeStart.y),
    };
  }, [marqueeStart, marqueeEnd]);

  const getBlocksInMarquee = useCallback(() => {
    const marqueeRect = getMarqueeRect();
    if (!marqueeRect || !blockListRef.current) return new Set<string>();

    const selectedIds = new Set<string>();
    const blockElements = blockListRef.current.querySelectorAll('[data-block-id]');

    blockElements.forEach((el) => {
      const blockId = el.getAttribute('data-block-id');
      if (!blockId) return;

      const rect = el.getBoundingClientRect();
      const listRect = blockListRef.current!.getBoundingClientRect();

      const blockTop = rect.top - listRect.top + blockListRef.current!.scrollTop;
      const blockBottom = rect.bottom - listRect.top + blockListRef.current!.scrollTop;
      const blockLeft = rect.left - listRect.left;
      const blockRight = rect.right - listRect.left;

      const intersects = !(
        blockRight < marqueeRect.left ||
        blockLeft > marqueeRect.right ||
        blockBottom < marqueeRect.top ||
        blockTop > marqueeRect.bottom
      );

      if (intersects) {
        selectedIds.add(blockId);
      }
    });

    return selectedIds;
  }, [getMarqueeRect]);

  const handleMarqueeMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    const isOnBlock = target.closest('.block-renderer');
    const isOnInteractive = target.closest('button, input, a, [role="button"]');

    if (isOnBlock || isOnInteractive) return;

    // Clicking on empty space - exit editing mode if active
    if (editingBlockId) {
      editorRef.current?.save();
      onFinishEditing();
      return;
    }

    // Start marquee selection
    const listRect = blockListRef.current?.getBoundingClientRect();
    if (!listRect) return;

    const x = e.clientX - listRect.left;
    const y = e.clientY - listRect.top + (blockListRef.current?.scrollTop || 0);

    setMarqueeStart({ x, y });
    setMarqueeEnd({ x, y });
    setIsMarqueeSelecting(true);
    setSelectedBlockIds(new Set());

    e.preventDefault();
  }, [editingBlockId, onFinishEditing, editorRef]);

  // Mouse move effect for marquee
  useEffect(() => {
    if (!isMarqueeSelecting) return;

    const handleMouseMove = (e: MouseEvent) => {
      const listRect = blockListRef.current?.getBoundingClientRect();
      if (!listRect) return;

      const x = e.clientX - listRect.left;
      const y = e.clientY - listRect.top + (blockListRef.current?.scrollTop || 0);

      setMarqueeEnd({ x, y });
      const selectedIds = getBlocksInMarquee();
      setSelectedBlockIds(selectedIds);
    };

    const handleMouseUp = () => {
      if (marqueeStart && marqueeEnd) {
        const width = Math.abs(marqueeEnd.x - marqueeStart.x);
        const height = Math.abs(marqueeEnd.y - marqueeStart.y);
        if (width < 5 && height < 5) {
          setSelectedBlockIds(new Set());
        }
      }

      setIsMarqueeSelecting(false);
      setMarqueeStart(null);
      setMarqueeEnd(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isMarqueeSelecting, getBlocksInMarquee, marqueeStart, marqueeEnd]);

  const clearSelection = useCallback(() => {
    setSelectedBlockIds(new Set());
    setIsMarqueeSelecting(false);
    setMarqueeStart(null);
    setMarqueeEnd(null);
  }, []);

  const selectAllBlocks = useCallback(() => {
    if (editingBlockId) return;
    setSelectedBlockIds(new Set(blockOrder));
  }, [blockOrder, editingBlockId]);

  // ============================================
  // Copy/Paste
  // ============================================

  const copySelectedBlocks = useCallback(async () => {
    if (selectedBlockIds.size === 0) return;

    const selectedInOrder = blockOrder.filter(id => selectedBlockIds.has(id));
    const blocksData = selectedInOrder.map(id => ({
      type: blocks[id]?.type,
      content: blocks[id]?.content,
    })).filter(b => b.type && b.content);

    if (blocksData.length === 0) return;

    const plainText = blocksData.map(b => {
      try {
        const parsed = JSON.parse(b.content!);
        return extractTextFromTipTap(parsed);
      } catch {
        return '';
      }
    }).join('\n\n');

    try {
      const clipboardData = new ClipboardItem({
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([clipboardData]);
      (window as any).__bookclub_clipboard = blocksData;
    } catch {
      await navigator.clipboard.writeText(plainText);
      (window as any).__bookclub_clipboard = blocksData;
    }
  }, [selectedBlockIds, blockOrder, blocks]);

  const pasteBlocks = useCallback(async () => {
    const internalData = (window as any).__bookclub_clipboard;

    if (internalData && Array.isArray(internalData) && internalData.length > 0) {
      let afterBlockId: string | null = null;

      if (editingBlockId) {
        afterBlockId = editingBlockId;
        onFinishEditing();
      } else if (selectedBlockIds.size > 0) {
        const selectedInOrder = blockOrder.filter(id => selectedBlockIds.has(id));
        afterBlockId = selectedInOrder[selectedInOrder.length - 1] || null;
      } else if (lastFocusedBlockIdRef.current && blockOrder.includes(lastFocusedBlockIdRef.current)) {
        afterBlockId = lastFocusedBlockIdRef.current;
      } else {
        afterBlockId = blockOrder[blockOrder.length - 1] || null;
      }

      let insertAfter = afterBlockId;
      for (const blockData of internalData) {
        const newId = await onAddBlock(blockData.type, insertAfter, blockData.content);
        if (newId) {
          insertAfter = newId;
        }
      }

      clearSelection();
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        const lastBlockId = blockOrder[blockOrder.length - 1] || null;
        const content = JSON.stringify({
          type: 'paragraph',
          content: [{ type: 'text', text: text }]
        });
        await onAddBlock('paragraph', lastBlockId, content);
      }
    } catch (err) {
      console.error('[BlockEditorCore] Failed to paste:', err);
    }
  }, [selectedBlockIds, blockOrder, onAddBlock, clearSelection, editingBlockId, onFinishEditing]);

  // ============================================
  // Keyboard Shortcuts
  // ============================================

  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd + Z - Undo
      if (isCtrlOrCmd && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        flushTextChange();
        onUndo();
        return;
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y - Redo
      if ((isCtrlOrCmd && e.key === 'z' && e.shiftKey) || (isCtrlOrCmd && e.key === 'y')) {
        e.preventDefault();
        e.stopPropagation();
        onRedo();
        return;
      }

      // Ctrl/Cmd + V - paste blocks
      if (isCtrlOrCmd && e.key === 'v') {
        const internalData = (window as any).__bookclub_clipboard;
        if (internalData && Array.isArray(internalData) && internalData.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          pasteBlocks();
          return;
        }
      }

      // The rest only applies when NOT editing
      if (editingBlockId) return;

      // Escape - clear selection
      if (e.key === 'Escape') {
        clearSelection();
        return;
      }

      // Ctrl/Cmd + A - select all
      if (isCtrlOrCmd && e.key === 'a') {
        e.preventDefault();
        selectAllBlocks();
        return;
      }

      // Ctrl/Cmd + C - copy
      if (isCtrlOrCmd && e.key === 'c' && selectedBlockIds.size > 0) {
        e.preventDefault();
        copySelectedBlocks();
        return;
      }

      // Delete/Backspace - delete selected blocks
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockIds.size > 0) {
        e.preventDefault();
        if (window.confirm(t('meet_block_delete_selected') || `Delete ${selectedBlockIds.size} selected block(s)?`)) {
          const selectedInOrder = blockOrder.filter(id => selectedBlockIds.has(id));
          onDeleteSelectedBlocks(selectedInOrder);
          clearSelection();
        }
        return;
      }

      // Tab - indent/outdent selected blocks
      if (e.key === 'Tab' && selectedBlockIds.size > 0) {
        e.preventDefault();

        const selectedInOrder = blockOrder.filter(id => selectedBlockIds.has(id));

        if (e.shiftKey) {
          // Shift+Tab: outdent
          selectedInOrder.forEach(id => {
            const block = blocks[id];
            if (!block) return;
            if (block.type === 'bulletList' || block.type === 'orderedList' || block.type === 'taskList') {
              try {
                const parsed = JSON.parse(block.content);
                const textContent = extractTextFromNode(parsed);
                const paragraphContent = JSON.stringify({
                  type: 'paragraph',
                  content: textContent ? [{ type: 'text', text: textContent }] : []
                });
                onSaveBlock(id, paragraphContent);
              } catch { /* ignore */ }
            }
          });
        } else {
          // Tab: indent
          selectedInOrder.forEach(id => {
            const block = blocks[id];
            if (!block) return;
            if (block.type === 'paragraph') {
              try {
                const parsed = JSON.parse(block.content);
                const textContent = extractTextFromNode(parsed);
                const bulletContent = JSON.stringify({
                  type: 'bulletList',
                  content: [{
                    type: 'listItem',
                    content: [{
                      type: 'paragraph',
                      content: textContent ? [{ type: 'text', text: textContent }] : []
                    }]
                  }]
                });
                onSaveBlock(id, bulletContent);
              } catch { /* ignore */ }
            }
          });
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, editingBlockId, selectedBlockIds, clearSelection, selectAllBlocks, copySelectedBlocks, pasteBlocks, t, blockOrder, blocks, onSaveBlock, flushTextChange, onUndo, onRedo, onDeleteSelectedBlocks]);

  // ============================================
  // Pending Navigation System
  // ============================================

  const clearPendingState = useCallback(() => {
    pendingActionRef.current = null;
    setIsNavigationPending(false);
    setPendingEditBlockId(null);
  }, []);

  // Handle pending block transitions
  useEffect(() => {
    if (!pendingEditBlockId || !blocks[pendingEditBlockId]) return;

    const blockId = pendingEditBlockId;
    let cancelled = false;

    const handlePendingEdit = async () => {
      await new Promise(resolve => setTimeout(resolve, 80));

      if (cancelled) return;

      const action = pendingActionRef.current;
      const currentIndex = blockOrder.indexOf(blockId);

      if (!action || action.count <= 0) {
        if (editingBlockId !== blockId) {
          await onStartEdit(blockId);
        }
        if (!cancelled) clearPendingState();
        return;
      }

      action.count--;

      if (editingBlockId === blockId) {
        onFinishEditing();
      }

      switch (action.type) {
        case 'enter':
          try {
            const newBlockId = await onAddBlock('paragraph', blockId);
            if (!cancelled && newBlockId) {
              setPendingEditBlockId(newBlockId);
            } else if (!cancelled) {
              clearPendingState();
            }
          } catch {
            if (!cancelled) clearPendingState();
          }
          break;

        case 'backspace':
          if (isBlockEmpty(blocksRef.current, blockId) && blockOrder.length > 1) {
            const prevBlockId = currentIndex > 0 ? blockOrder[currentIndex - 1] : null;
            await onDeleteBlock(blockId);
            if (!cancelled && prevBlockId) {
              setPendingEditBlockId(prevBlockId);
            } else if (!cancelled) {
              clearPendingState();
            }
          } else {
            if (editingBlockId !== blockId) {
              await onStartEdit(blockId);
            }
            if (!cancelled) clearPendingState();
          }
          break;

        case 'arrowUp': {
          const prevBlockId = currentIndex > 0 ? blockOrder[currentIndex - 1] : null;
          if (!cancelled && prevBlockId) {
            setPendingEditBlockId(prevBlockId);
          } else if (!cancelled) {
            if (editingBlockId !== blockId) {
              await onStartEdit(blockId);
            }
            clearPendingState();
          }
          break;
        }

        case 'arrowDown': {
          const nextBlockId = currentIndex < blockOrder.length - 1 ? blockOrder[currentIndex + 1] : null;
          if (!cancelled && nextBlockId) {
            setPendingEditBlockId(nextBlockId);
          } else if (!cancelled) {
            if (editingBlockId !== blockId) {
              await onStartEdit(blockId);
            }
            clearPendingState();
          }
          break;
        }
      }
    };

    handlePendingEdit();

    return () => { cancelled = true; };
  }, [pendingEditBlockId, blocks, blockOrder, editingBlockId, onStartEdit, onFinishEditing, onAddBlock, onDeleteBlock, clearPendingState]);

  // Global key handler during block transitions
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!pendingEditBlockId) return;

      const currentAction = pendingActionRef.current;
      if (!currentAction) return;

      const activeElement = document.activeElement as HTMLElement | null;
      const isInBlockEditor = activeElement?.closest('.block-editor-wrapper');
      const isProseMirror = activeElement?.classList.contains('ProseMirror');

      if (!isInBlockEditor && !isProseMirror) return;

      let actionType: PendingActionType | null = null;

      if (e.key === 'Enter' && !e.shiftKey) {
        actionType = 'enter';
      } else if (e.key === 'Backspace') {
        actionType = 'backspace';
      } else if (e.key === 'ArrowUp') {
        actionType = 'arrowUp';
      } else if (e.key === 'ArrowDown') {
        actionType = 'arrowDown';
      }

      if (actionType && actionType === currentAction.type) {
        e.preventDefault();
        e.stopPropagation();
        currentAction.count++;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [pendingEditBlockId]);

  // ============================================
  // Internal handlers
  // ============================================

  const handleStartEditInternal = useCallback(async (blockId: string) => {
    if (editingBlockId && editingBlockId !== blockId) {
      editorRef.current?.save();
    }
    clearSelection();
    lastFocusedBlockIdRef.current = blockId;
    await onStartEdit(blockId);
  }, [onStartEdit, editingBlockId, editorRef, clearSelection]);

  const handleDeleteBlockInternal = useCallback(async (blockId: string) => {
    const currentIndex = blockOrder.indexOf(blockId);
    const prevBlockId = currentIndex > 0 ? blockOrder[currentIndex - 1] : null;

    await onDeleteBlock(blockId);

    if (prevBlockId) {
      pendingActionRef.current = { type: 'backspace', count: 0 };
      setIsNavigationPending(true);
      setPendingEditBlockId(prevBlockId);
    }
  }, [blockOrder, onDeleteBlock]);

  const handleMoveToPrevBlockInternal = useCallback((blockId: string) => {
    const currentIndex = blockOrder.indexOf(blockId);
    const prevBlockId = currentIndex > 0 ? blockOrder[currentIndex - 1] : null;

    if (prevBlockId) {
      onFinishEditing();
      pendingActionRef.current = { type: 'arrowUp', count: 0 };
      setIsNavigationPending(true);
      setPendingEditBlockId(prevBlockId);
    }
  }, [blockOrder, onFinishEditing]);

  const handleMoveToNextBlockInternal = useCallback((blockId: string) => {
    const currentIndex = blockOrder.indexOf(blockId);
    const nextBlockId = currentIndex < blockOrder.length - 1 ? blockOrder[currentIndex + 1] : null;

    if (nextBlockId) {
      onFinishEditing();
      pendingActionRef.current = { type: 'arrowDown', count: 0 };
      setIsNavigationPending(true);
      setPendingEditBlockId(nextBlockId);
    }
  }, [blockOrder, onFinishEditing]);

  const handleSaveAndCreateNextInternal = useCallback(
    (blockId: string, content: string, nextBlockType?: BlockType, nextListStart?: number) => {
      onSaveAndCreateNext(blockId, content, nextBlockType, nextListStart);
    },
    [onSaveAndCreateNext]
  );

  const handleAddBlockAtEnd = useCallback(async () => {
    const lastBlockId = blockOrder[blockOrder.length - 1] || null;
    await onAddBlock('paragraph', lastBlockId);
  }, [blockOrder, onAddBlock]);

  // ============================================
  // Block Selection Handler
  // ============================================

  const handleBlockSelect = useCallback((blockId: string, event: React.MouseEvent) => {
    if (event.shiftKey && lastFocusedBlockIdRef.current) {
      const startIdx = blockOrder.indexOf(lastFocusedBlockIdRef.current);
      const endIdx = blockOrder.indexOf(blockId);
      const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
      const rangeIds = blockOrder.slice(from, to + 1);
      setSelectedBlockIds(new Set(rangeIds));
    } else if (event.metaKey || event.ctrlKey) {
      setSelectedBlockIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(blockId)) {
          newSet.delete(blockId);
        } else {
          newSet.add(blockId);
        }
        return newSet;
      });
    } else {
      setSelectedBlockIds(new Set([blockId]));
    }
    lastFocusedBlockIdRef.current = blockId;
  }, [blockOrder]);

  // ============================================
  // Toolbar Actions
  // ============================================

  const toolbarActions = useMemo(() => ({
    toggleBold: () => {
      editorRef.current?.editor?.chain().focus().toggleBold().run();
    },
    toggleItalic: () => {
      editorRef.current?.editor?.chain().focus().toggleItalic().run();
    },
    toggleStrike: () => {
      editorRef.current?.editor?.chain().focus().toggleStrike().run();
    },
    toggleBulletList: () => {
      editorRef.current?.editor?.chain().focus().toggleBulletList().run();
    },
    toggleOrderedList: () => {
      editorRef.current?.editor?.chain().focus().toggleOrderedList().run();
    },
    toggleBlockquote: () => {
      editorRef.current?.editor?.chain().focus().toggleBlockquote().run();
    },
    toggleCodeBlock: () => {
      editorRef.current?.editor?.chain().focus().toggleCodeBlock().run();
    },
    toggleCode: () => {
      editorRef.current?.editor?.chain().focus().toggleCode().run();
    },
    setHeading: (level: 1 | 2 | 3) => {
      editorRef.current?.editor?.chain().focus().toggleHeading({ level }).run();
    },
    isActive: (type: string, attrs?: Record<string, unknown>) => {
      return editorRef.current?.editor?.isActive(type, attrs) || false;
    },
  }), [editorRef]);

  // ============================================
  // Render
  // ============================================

  return (
    <div className={`block-editor-core ${className || ''}`}>
      {/* Editor Toolbar */}
      {showToolbar && (
        <div className="notes-toolbar-container">
          <div className={`notes-toolbar ${editingBlockId ? 'visible' : ''}`}>
            {/* Undo/Redo */}
            <div className="toolbar-group">
              <button
                type="button"
                onClick={() => onUndo()}
                className={`toolbar-btn ${!canUndo() ? 'disabled' : ''}`}
                disabled={!canUndo()}
                title={t('undo') || 'Undo (Ctrl+Z)'}
              >
                <FiRotateCcw size={16} />
              </button>
              <button
                type="button"
                onClick={() => onRedo()}
                className={`toolbar-btn ${!canRedo() ? 'disabled' : ''}`}
                disabled={!canRedo()}
                title={t('redo') || 'Redo (Ctrl+Shift+Z)'}
              >
                <FiRotateCw size={16} />
              </button>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
              <button
                type="button"
                onClick={toolbarActions.toggleBold}
                className={`toolbar-btn ${toolbarActions.isActive('bold') ? 'active' : ''}`}
                title="Bold (Ctrl+B)"
              >
                <FiBold size={16} />
              </button>
              <button
                type="button"
                onClick={toolbarActions.toggleItalic}
                className={`toolbar-btn ${toolbarActions.isActive('italic') ? 'active' : ''}`}
                title="Italic (Ctrl+I)"
              >
                <FiItalic size={16} />
              </button>
              <button
                type="button"
                onClick={toolbarActions.toggleStrike}
                className={`toolbar-btn ${toolbarActions.isActive('strike') ? 'active' : ''}`}
                title="Strikethrough"
              >
                <s>S</s>
              </button>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
              <button
                type="button"
                onClick={() => toolbarActions.setHeading(1)}
                className={`toolbar-btn ${toolbarActions.isActive('heading', { level: 1 }) ? 'active' : ''}`}
                title="Heading 1"
              >
                H1
              </button>
              <button
                type="button"
                onClick={() => toolbarActions.setHeading(2)}
                className={`toolbar-btn ${toolbarActions.isActive('heading', { level: 2 }) ? 'active' : ''}`}
                title="Heading 2"
              >
                H2
              </button>
              <button
                type="button"
                onClick={() => toolbarActions.setHeading(3)}
                className={`toolbar-btn ${toolbarActions.isActive('heading', { level: 3 }) ? 'active' : ''}`}
                title="Heading 3"
              >
                H3
              </button>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
              <button
                type="button"
                onClick={toolbarActions.toggleBulletList}
                className={`toolbar-btn ${toolbarActions.isActive('bulletList') ? 'active' : ''}`}
                title="Bullet List"
              >
                <FiList size={16} />
              </button>
              <button
                type="button"
                onClick={toolbarActions.toggleOrderedList}
                className={`toolbar-btn ${toolbarActions.isActive('orderedList') ? 'active' : ''}`}
                title="Numbered List"
              >
                1.
              </button>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
              <button
                type="button"
                onClick={toolbarActions.toggleBlockquote}
                className={`toolbar-btn ${toolbarActions.isActive('blockquote') ? 'active' : ''}`}
                title="Quote"
              >
                &ldquo;
              </button>
              <button
                type="button"
                onClick={toolbarActions.toggleCodeBlock}
                className={`toolbar-btn ${toolbarActions.isActive('codeBlock') ? 'active' : ''}`}
                title="Code Block"
              >
                <FiCode size={16} />
              </button>
              <button
                type="button"
                onClick={toolbarActions.toggleCode}
                className={`toolbar-btn ${toolbarActions.isActive('code') ? 'active' : ''}`}
                title="Inline Code"
              >
                {'<>'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block List with Drag-and-Drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={multiDragCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={blockOrder}
          strategy={verticalListSortingStrategy}
        >
          <div
            className={`block-list ${activeId ? 'is-dragging' : ''}`}
            ref={blockListRef}
            onMouseDown={handleMarqueeMouseDown}
            style={{ position: 'relative' }}
          >
            {blockOrder.map((blockId) => {
              const block = blocks[blockId];
              if (!block) return null;

              const isCurrentlyEditing = editingBlockId === blockId;

              // Multi-drag logic
              const isMultiDragActive = activeId !== null
                && selectedBlockIds.has(activeId)
                && selectedBlockIds.size > 1;
              const isDraggedBlock = activeId === blockId;
              const isPartOfMultiDrag = isMultiDragActive
                && selectedBlockIds.has(blockId)
                && !isDraggedBlock;

              const additionalDragBlocks = isDraggedBlock && isMultiDragActive
                ? blockOrder
                    .filter(id => selectedBlockIds.has(id) && id !== blockId)
                    .map(id => blocks[id])
                    .filter(Boolean)
                : undefined;

              return (
                <SortableBlockRenderer
                  key={blockId}
                  block={block}
                  isEditing={isCurrentlyEditing}
                  isLocked={isBlockLocked(blockId)}
                  isLockedByMe={isBlockLockedByMe(blockId)}
                  lockInfo={getBlockLockInfo(blockId)}
                  currentUserId={currentUserId}
                  isSelected={selectedBlockIds.has(blockId)}
                  onSelect={(e) => handleBlockSelect(blockId, e)}
                  isPartOfMultiDrag={isPartOfMultiDrag}
                  additionalDragBlocks={additionalDragBlocks}
                  skipKeyboardNavigation={isNavigationPending}
                  onStartEdit={() => handleStartEditInternal(blockId)}
                  onSaveEdit={(content) => onSaveEdit(blockId, content)}
                  onAutoSave={(content) => onAutoSave(blockId, content)}
                  onCancelEdit={onCancelEdit}
                  onDelete={() => handleDeleteBlockInternal(blockId)}
                  onMoveToPrevBlock={() => handleMoveToPrevBlockInternal(blockId)}
                  onMoveToNextBlock={() => handleMoveToNextBlockInternal(blockId)}
                  onCreateBlockAfter={(type) => onAddBlock(type, blockId)}
                  onSaveAndCreateNext={(content, nextBlockType, nextListStart) =>
                    handleSaveAndCreateNextInternal(blockId, content, nextBlockType, nextListStart)
                  }
                  editorRef={isCurrentlyEditing ? editorRef : undefined}
                />
              );
            })}

            {/* Empty space for marquee selection */}
            <div
              className="block-list-empty-space"
              onMouseDown={handleMarqueeMouseDown}
            />

            {/* Marquee Selection Rectangle */}
            {isMarqueeSelecting && marqueeStart && marqueeEnd && (
              <div
                className="marquee-selection"
                style={{
                  position: 'absolute',
                  left: Math.min(marqueeStart.x, marqueeEnd.x),
                  top: Math.min(marqueeStart.y, marqueeEnd.y),
                  width: Math.abs(marqueeEnd.x - marqueeStart.x),
                  height: Math.abs(marqueeEnd.y - marqueeStart.y),
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        </SortableContext>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeId && blocks[activeId] ? (
            <div className="block-drag-overlay">
              {selectedBlockIds.has(activeId) && selectedBlockIds.size > 1 && (
                <div className="drag-count-badge">
                  {selectedBlockIds.size}
                </div>
              )}
              {selectedBlockIds.has(activeId) && selectedBlockIds.size > 1 ? (
                <div className="drag-overlay-blocks-container">
                  {blockOrder
                    .filter(id => selectedBlockIds.has(id))
                    .map((blockId) => (
                      <div key={blockId} className="drag-overlay-block">
                        <BlockRenderer
                          block={blocks[blockId]}
                          isEditing={false}
                          isLocked={false}
                          isLockedByMe={false}
                          lockInfo={null}
                          currentUserId={currentUserId}
                          onStartEdit={() => {}}
                          onSaveEdit={() => {}}
                          onCancelEdit={() => {}}
                          onDelete={() => {}}
                          onCreateBlockAfter={() => {}}
                          isDragging={true}
                        />
                      </div>
                    ))}
                </div>
              ) : (
                <BlockRenderer
                  block={blocks[activeId]}
                  isEditing={false}
                  isLocked={false}
                  isLockedByMe={false}
                  lockInfo={null}
                  currentUserId={currentUserId}
                  onStartEdit={() => {}}
                  onSaveEdit={() => {}}
                  onCancelEdit={() => {}}
                  onDelete={() => {}}
                  onCreateBlockAfter={() => {}}
                  isDragging={true}
                />
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Add Block Button */}
      {!disabled && (
        <div className="block-add-section">
          <button
            type="button"
            className="add-block-btn"
            onClick={handleAddBlockAtEnd}
            title={t('meet_add_block') || 'Add new block'}
          >
            <FiPlus size={16} />
            <span>{t('meet_add_block') || 'Add block'}</span>
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="notes-footer">
        <span className="notes-hint">
          {t('meet_block_notes_hint') ||
            'Click to edit • Drag to select • Ctrl+C/V to copy/paste'}
        </span>
      </div>
    </div>
  );
};

BlockEditorCore.displayName = 'BlockEditorCore';

export default BlockEditorCore;
