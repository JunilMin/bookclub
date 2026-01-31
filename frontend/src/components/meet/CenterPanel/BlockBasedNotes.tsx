/**
 * BlockBasedNotes - Main container for block-based collaborative notes
 *
 * Uses Block List as SSOT architecture:
 * - Each block is independently editable with lock-based concurrency
 * - TipTap is used only for editing individual blocks
 * - Drag-and-drop reordering operates on block order array
 * - Toolbar appears at top when editing a block
 * - Includes AI tab for organized notes
 */

import React, { useState, useCallback, useMemo, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  FiUser,
  FiCheck,
  FiCloud,
  FiWifi,
  FiWifiOff,
  FiEdit2,
  FiPlus,
  FiBold,
  FiItalic,
  FiList,
  FiCode,
  FiFileText,
  FiCpu,
  FiLoader,
} from 'react-icons/fi';
import { useBlockDocument } from '../../../hooks/useBlockDocument';
import { BlockType, RemoteBlockUser } from '../../../types/blockDocument';
import BlockRenderer from './BlockRenderer';
import SortableBlockRenderer from './SortableBlockRenderer';
import { BlockEditorRef } from './BlockEditor';
import '../styles/CenterPanel.css';
import '../styles/BlockBasedNotes.css';

// ============================================
// Types
// ============================================

type NoteTab = 'free' | 'ai';

interface AIValidation {
  valid: boolean;
  sourceFragmentIds: string[];
  outputFragmentIds: string[];
  missingFragments: string[];
  validationError: string;
}

interface BlockBasedNotesProps {
  docId: string;
  userId: string;
  username: string;
  photoUrl?: string;
  initialTitle?: string;
  // AI Tab props
  aiContent?: any;
  aiValidation?: AIValidation | null;
  isOrganizing?: boolean;
  onOrganizeNotes?: () => void;
}

export interface BlockBasedNotesRef {
  addBlock: (type: BlockType, afterBlockId?: string | null) => Promise<string | null>;
  insertContentAtEnd: (content: any) => void;
  insertTranscription: (content: string, sectionTitle?: string) => void;
}

// ============================================
// Component
// ============================================

const BlockBasedNotes = forwardRef<BlockBasedNotesRef, BlockBasedNotesProps>(
  ({
    docId,
    userId,
    username,
    photoUrl = '',
    initialTitle = 'Discussion Notes',
    aiContent,
    aiValidation,
    isOrganizing = false,
    onOrganizeNotes,
  }, ref) => {
    const { t } = useTranslation();

    // Tab state
    const [activeTab, setActiveTab] = useState<NoteTab>('free');

    // Title editing state
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(initialTitle);

    // Drag state
    const [activeId, setActiveId] = useState<string | null>(null);

    // Pending edit state - block to edit after it's rendered
    const [pendingEditBlockId, setPendingEditBlockId] = useState<string | null>(null);
    // Pending delete state - for backspace key handling
    const [pendingDeleteFromBlockId, setPendingDeleteFromBlockId] = useState<string | null>(null);

    // Block selection state (for multi-block copy/paste)
    const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());
    const blockListRef = useRef<HTMLDivElement>(null);
    const lastFocusedBlockIdRef = useRef<string | null>(null); // Track last clicked/edited block

    // Marquee selection state (Windows-style drag selection)
    const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
    const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
    const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);

    // Editor ref for toolbar control (for free notes)
    const editorRef = useRef<BlockEditorRef | null>(null);
    // Editor ref for AI notes
    const aiEditorRef = useRef<BlockEditorRef | null>(null);

    // Track if we've synced AI content to blocks
    const aiContentSyncedRef = useRef<string | null>(null);

    // Custom clipboard data key
    const CLIPBOARD_KEY = 'application/x-bookclub-blocks';

    // Block document hook (Free Notes)
    const {
      document,
      blockOrder,
      blocks,
      isLoading,
      error,
      isConnected,
      isSyncing,
      editingBlockId,
      locks,
      remoteUsers,
      startEditing,
      saveBlock,
      broadcastContent,
      finishEditing,
      cancelEditing,
      addBlock,
      deleteBlock,
      reorderBlocks,
      reorderMultiple,
      isBlockLocked,
      isBlockLockedByMe,
      getBlockLockInfo,
    } = useBlockDocument({
      docId,
      userId,
      username,
      photoUrl,
    });

    // Block document hook (AI Notes) - separate document with "-ai" suffix
    const {
      document: aiDocument,
      blockOrder: aiBlockOrder,
      blocks: aiBlocks,
      isLoading: aiIsLoading,
      error: aiError,
      isConnected: aiIsConnected,
      isSyncing: aiIsSyncing,
      editingBlockId: aiEditingBlockId,
      remoteUsers: aiRemoteUsers,
      startEditing: aiStartEditing,
      saveBlock: aiSaveBlock,
      broadcastContent: aiBroadcastContent,
      finishEditing: aiFinishEditing,
      cancelEditing: aiCancelEditing,
      addBlock: aiAddBlock,
      deleteBlock: aiDeleteBlock,
      reorderBlocks: aiReorderBlocks,
      isBlockLocked: aiIsBlockLocked,
      isBlockLockedByMe: aiIsBlockLockedByMe,
      getBlockLockInfo: aiGetBlockLockInfo,
      clearAllBlocks: aiClearAllBlocks,
    } = useBlockDocument({
      docId: `${docId}-ai`,
      userId,
      username,
      photoUrl,
    });

    // Convert TipTap JSON to blocks and sync to AI document
    useEffect(() => {
      if (!aiContent || !aiAddBlock || !aiClearAllBlocks) return;

      // Create a content hash to check if we've already synced this content
      const contentHash = typeof aiContent === 'string' ? aiContent : JSON.stringify(aiContent);
      if (aiContentSyncedRef.current === contentHash) return;

      const syncAiContentToBlocks = async () => {
        try {
          // Parse the TipTap JSON
          const parsedContent = typeof aiContent === 'string' ? JSON.parse(aiContent) : aiContent;

          if (!parsedContent.content || !Array.isArray(parsedContent.content)) {
            console.warn('[AI Notes] Invalid TipTap content structure');
            return;
          }

          // Clear existing AI blocks first
          await aiClearAllBlocks();

          // Convert each top-level node to a block
          let lastBlockId: string | null = null;
          for (const node of parsedContent.content) {
            const blockType = (node.type || 'paragraph') as BlockType;
            const blockContent = JSON.stringify(node);

            const newBlockId = await aiAddBlock(blockType, lastBlockId, blockContent);
            if (newBlockId) {
              lastBlockId = newBlockId;
            }
          }

          // Mark as synced
          aiContentSyncedRef.current = contentHash;
          console.log('[AI Notes] Synced TipTap content to blocks:', parsedContent.content.length, 'blocks');
        } catch (err) {
          console.error('[AI Notes] Failed to sync content to blocks:', err);
        }
      };

      syncAiContentToBlocks();
    }, [aiContent, aiAddBlock, aiClearAllBlocks]);

    // ============================================
    // Drag-and-Drop Sensors
    // ============================================

    const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: {
          distance: 8, // 8px movement required before drag starts
        },
      }),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      })
    );

    // ============================================
    // Drag Handlers (supports multi-block drag)
    // ============================================

    const handleDragStart = useCallback((event: DragStartEvent) => {
      const draggedId = event.active.id as string;
      setActiveId(draggedId);

      // If dragging a selected block, keep selection
      // If dragging an unselected block, clear selection and select only this one
      if (!selectedBlockIds.has(draggedId)) {
        setSelectedBlockIds(new Set([draggedId]));
      }
    }, [selectedBlockIds]);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Get blocks to move (selected blocks if dragging a selected block, otherwise just the dragged block)
      const blocksToMove = selectedBlockIds.has(activeId)
        ? blockOrder.filter(id => selectedBlockIds.has(id))
        : [activeId];

      if (blocksToMove.length === 0) return;

      // Find target index
      const overIndex = blockOrder.indexOf(overId);

      if (blocksToMove.length === 1) {
        // Single block move
        const fromIndex = blockOrder.indexOf(blocksToMove[0]);
        if (fromIndex !== overIndex) {
          reorderBlocks(fromIndex, overIndex);
        }
      } else {
        // Multi-block move
        // Determine if moving down (first selected block is above target)
        const firstSelectedIndex = blockOrder.indexOf(blocksToMove[0]);
        const isMovingDown = firstSelectedIndex < overIndex;

        // When moving down, insert AFTER the over block
        // When moving up, insert AT the over block position
        const targetIndex = isMovingDown ? overIndex + 1 : overIndex;

        reorderMultiple(blocksToMove, targetIndex);
      }

    }, [blockOrder, selectedBlockIds, reorderBlocks, reorderMultiple]);

    const handleDragCancel = useCallback(() => {
      setActiveId(null);
    }, []);

    // Custom collision detection that ignores collapsed (selected) blocks during multi-drag
    const multiDragCollisionDetection: CollisionDetection = useCallback((args) => {
      const { active } = args;
      const activeId = active.id as string;

      // Check if multi-drag is active
      const isMultiDrag = selectedBlockIds.has(activeId) && selectedBlockIds.size > 1;

      if (!isMultiDrag) {
        // Single drag: use default closestCenter
        return closestCenter(args);
      }

      // Multi-drag: filter out collapsed blocks from droppable containers
      const filteredArgs = {
        ...args,
        droppableContainers: args.droppableContainers.filter(
          (container) => !selectedBlockIds.has(container.id as string) || container.id === activeId
        ),
      };

      return closestCenter(filteredArgs);
    }, [selectedBlockIds]);

    // ============================================
    // Marquee Selection (Windows-style drag selection)
    // ============================================

    /**
     * Get the bounding rectangle of the marquee selection
     */
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

    /**
     * Check if a block element intersects with the marquee rectangle
     */
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

        // Convert block rect to be relative to the block list container
        const blockTop = rect.top - listRect.top + blockListRef.current!.scrollTop;
        const blockBottom = rect.bottom - listRect.top + blockListRef.current!.scrollTop;
        const blockLeft = rect.left - listRect.left;
        const blockRight = rect.right - listRect.left;

        // Check intersection
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

    /**
     * Handle mouse down on block list - start marquee selection or exit editing
     */
    const handleMarqueeMouseDown = useCallback((e: React.MouseEvent) => {
      // Only left click
      if (e.button !== 0) return;

      // Check if clicking on a block content (not the empty space)
      const target = e.target as HTMLElement;
      const isOnBlock = target.closest('.block-renderer');
      const isOnInteractive = target.closest('button, input, a, [role="button"]');

      if (isOnBlock || isOnInteractive) return;

      // Clicking on empty space - exit editing mode if active
      if (editingBlockId) {
        finishEditing();
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

      // Clear previous selection
      setSelectedBlockIds(new Set());

      e.preventDefault();
    }, [editingBlockId, finishEditing]);

    /**
     * Handle mouse move - update marquee rectangle
     */
    useEffect(() => {
      if (!isMarqueeSelecting) return;

      const handleMouseMove = (e: MouseEvent) => {
        const listRect = blockListRef.current?.getBoundingClientRect();
        if (!listRect) return;

        const x = e.clientX - listRect.left;
        const y = e.clientY - listRect.top + (blockListRef.current?.scrollTop || 0);

        setMarqueeEnd({ x, y });

        // Update selection in real-time
        const selectedIds = getBlocksInMarquee();
        setSelectedBlockIds(selectedIds);
      };

      const handleMouseUp = () => {
        // If marquee is too small (just a click), clear selection
        if (marqueeStart && marqueeEnd) {
          const width = Math.abs(marqueeEnd.x - marqueeStart.x);
          const height = Math.abs(marqueeEnd.y - marqueeStart.y);
          if (width < 5 && height < 5) {
            // Just a click - clear selection
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

    /**
     * Clear selection when clicking outside blocks or pressing Escape
     */
    const clearSelection = useCallback(() => {
      setSelectedBlockIds(new Set());
      setIsMarqueeSelecting(false);
      setMarqueeStart(null);
      setMarqueeEnd(null);
    }, []);

    /**
     * Select all blocks (Ctrl/Cmd+A)
     */
    const selectAllBlocks = useCallback(() => {
      if (editingBlockId) return;
      setSelectedBlockIds(new Set(blockOrder));
    }, [blockOrder, editingBlockId]);

    /**
     * Copy selected blocks to clipboard
     */
    const copySelectedBlocks = useCallback(async () => {
      if (selectedBlockIds.size === 0) return;

      // Get blocks in order
      const selectedInOrder = blockOrder.filter(id => selectedBlockIds.has(id));
      const blocksData = selectedInOrder.map(id => ({
        type: blocks[id]?.type,
        content: blocks[id]?.content,
      })).filter(b => b.type && b.content);

      if (blocksData.length === 0) return;

      // Create plain text version for external paste
      const plainText = blocksData.map(b => {
        try {
          const parsed = JSON.parse(b.content);
          return extractTextFromTipTap(parsed);
        } catch {
          return '';
        }
      }).join('\n\n');

      // Copy to clipboard with both formats
      try {
        const clipboardData = new ClipboardItem({
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
          // Note: Custom MIME types might not work in all browsers
          // We'll use a data attribute approach as fallback
        });
        await navigator.clipboard.write([clipboardData]);

        // Store blocks data in a module-level variable as fallback
        (window as any).__bookclub_clipboard = blocksData;

        console.log('[BlockBasedNotes] Copied', blocksData.length, 'blocks');
      } catch (err) {
        // Fallback: just copy plain text
        await navigator.clipboard.writeText(plainText);
        (window as any).__bookclub_clipboard = blocksData;
      }
    }, [selectedBlockIds, blockOrder, blocks]);

    /**
     * Paste blocks from clipboard
     * - If editing a block: paste after current block
     * - If blocks are selected: paste after last selected block
     * - If last focused block exists: paste after it
     * - Otherwise: paste at the end
     */
    const pasteBlocks = useCallback(async () => {
      // Check for internal clipboard first
      const internalData = (window as any).__bookclub_clipboard;

      if (internalData && Array.isArray(internalData) && internalData.length > 0) {
        // Paste blocks with structure preserved
        let afterBlockId: string | null = null;

        // Priority: editing block > selection > last focused > end
        if (editingBlockId) {
          // If editing a block, paste after the current block
          afterBlockId = editingBlockId;
          // Finish editing first to save changes
          finishEditing();
        } else if (selectedBlockIds.size > 0) {
          // If there's a selection, paste after the last selected block
          const selectedInOrder = blockOrder.filter(id => selectedBlockIds.has(id));
          afterBlockId = selectedInOrder[selectedInOrder.length - 1] || null;
        } else if (lastFocusedBlockIdRef.current && blockOrder.includes(lastFocusedBlockIdRef.current)) {
          // If there's a last focused block, paste after it
          afterBlockId = lastFocusedBlockIdRef.current;
        } else {
          // Otherwise paste at the end
          afterBlockId = blockOrder[blockOrder.length - 1] || null;
        }

        // Add each block
        let insertAfter = afterBlockId;
        for (const blockData of internalData) {
          const newId = await addBlock(blockData.type, insertAfter, blockData.content);
          if (newId) {
            insertAfter = newId;
          }
        }

        // DON'T clear clipboard - allow multiple pastes

        // Clear selection
        clearSelection();

        console.log('[BlockBasedNotes] Pasted', internalData.length, 'blocks');
        return;
      }

      // Fallback: paste plain text as a single paragraph block
      try {
        const text = await navigator.clipboard.readText();
        if (text.trim()) {
          const lastBlockId = blockOrder[blockOrder.length - 1] || null;
          const content = JSON.stringify({
            type: 'paragraph',
            content: [{ type: 'text', text: text }]
          });
          await addBlock('paragraph', lastBlockId, content);
        }
      } catch (err) {
        console.error('[BlockBasedNotes] Failed to paste:', err);
      }
    }, [selectedBlockIds, blockOrder, addBlock, clearSelection]);

    /**
     * Extract plain text from TipTap JSON
     */
    const extractTextFromTipTap = (node: any): string => {
      if (!node) return '';
      if (node.type === 'text') return node.text || '';
      if (node.content && Array.isArray(node.content)) {
        return node.content.map(extractTextFromTipTap).join('');
      }
      return '';
    };

    /**
     * Keyboard handler for copy/paste/select all
     */
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Skip if not in free notes tab
        if (activeTab !== 'free') return;

        const isCtrlOrCmd = e.metaKey || e.ctrlKey;

        // Ctrl/Cmd + V - paste blocks (works even when editing)
        // Only intercept if we have block data to paste
        if (isCtrlOrCmd && e.key === 'v') {
          const internalData = (window as any).__bookclub_clipboard;
          if (internalData && Array.isArray(internalData) && internalData.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            pasteBlocks();
            return;
          }
          // Otherwise let the default paste behavior happen (plain text in editor)
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
            selectedBlockIds.forEach(id => deleteBlock(id));
            clearSelection();
          }
          return;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editingBlockId, activeTab, selectedBlockIds, clearSelection, selectAllBlocks, copySelectedBlocks, pasteBlocks, deleteBlock, t]);

    // ============================================
    // Handlers
    // ============================================

    const handleStartEdit = useCallback(
      async (blockId: string) => {
        const success = await startEditing(blockId);
        if (!success) {
          console.warn('[BlockBasedNotes] Failed to acquire lock for block:', blockId);
        }
      },
      [startEditing]
    );

    const handleSaveEdit = useCallback(
      async (blockId: string, content: string) => {
        await saveBlock(blockId, content);
        finishEditing(); // Use finishEditing to release lock without restoring content
      },
      [saveBlock, finishEditing]
    );

    // Real-time sync handler - broadcasts immediately, DB save is debounced internally
    const handleAutoSave = useCallback(
      (blockId: string, content: string) => {
        // Broadcast for real-time sync (50ms debounce internally)
        // DB save happens automatically after 2 seconds
        broadcastContent(blockId, content);
      },
      [broadcastContent]
    );

    const handleCancelEdit = useCallback(() => {
      cancelEditing();
    }, [cancelEditing]);

    const handleDeleteBlock = useCallback(
      async (blockId: string) => {
        // Find the previous block to move to after deletion
        const currentIndex = blockOrder.indexOf(blockId);
        const prevBlockId = currentIndex > 0 ? blockOrder[currentIndex - 1] : null;

        // Release current editing lock
        finishEditing();

        // Delete the block
        await deleteBlock(blockId);

        // Move to previous block
        if (prevBlockId) {
          setPendingEditBlockId(prevBlockId);
        }
      },
      [blockOrder, finishEditing, deleteBlock]
    );

    // Handler for ArrowUp at first line - move to previous block
    const handleMoveToPrevBlock = useCallback(
      (blockId: string) => {
        const currentIndex = blockOrder.indexOf(blockId);
        const prevBlockId = currentIndex > 0 ? blockOrder[currentIndex - 1] : null;

        if (prevBlockId) {
          finishEditing();
          setPendingEditBlockId(prevBlockId);
        }
      },
      [blockOrder, finishEditing]
    );

    // Handler for ArrowDown at last line - move to next block
    const handleMoveToNextBlock = useCallback(
      (blockId: string) => {
        const currentIndex = blockOrder.indexOf(blockId);
        const nextBlockId = currentIndex < blockOrder.length - 1 ? blockOrder[currentIndex + 1] : null;

        if (nextBlockId) {
          finishEditing();
          setPendingEditBlockId(nextBlockId);
        }
      },
      [blockOrder, finishEditing]
    );

    const handleAddBlock = useCallback(
      async (type: BlockType, afterBlockId?: string | null) => {
        const newBlockId = await addBlock(type, afterBlockId);
        if (newBlockId) {
          // Auto-start editing the new block
          setTimeout(() => {
            startEditing(newBlockId);
          }, 100);
        }
        return newBlockId;
      },
      [addBlock, startEditing]
    );

    const handleAddBlockAtEnd = useCallback(async () => {
      const lastBlockId = blockOrder[blockOrder.length - 1] || null;
      await handleAddBlock('paragraph', lastBlockId);
    }, [blockOrder, handleAddBlock]);

    // Helper to check if a block is empty
    const isBlockEmpty = useCallback((blockId: string): boolean => {
      const block = blocks[blockId];
      if (!block) return false;

      try {
        const parsed = JSON.parse(block.content);
        // Check if content is empty (no text or only whitespace)
        if (!parsed.content || parsed.content.length === 0) return true;
        if (parsed.content.length === 1) {
          const firstChild = parsed.content[0];
          // Empty paragraph or text node with empty/whitespace text
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
    }, [blocks]);

    // Queue for Enter key presses during pending state
    const enterQueueRef = useRef<number>(0);
    // Queue for Backspace key presses during pending state
    const backspaceQueueRef = useRef<number>(0);
    // Queue for ArrowUp key presses during pending state
    const arrowUpQueueRef = useRef<number>(0);
    // Queue for ArrowDown key presses during pending state
    const arrowDownQueueRef = useRef<number>(0);

    // Effect to start editing pending block once it's rendered
    useEffect(() => {
      if (pendingEditBlockId && blocks[pendingEditBlockId]) {
        startEditing(pendingEditBlockId);

        // If there are queued Enter presses, create another block
        if (enterQueueRef.current > 0) {
          enterQueueRef.current--;
          // Create next block after this one
          const blockId = pendingEditBlockId;
          setPendingEditBlockId(null);
          addBlock('paragraph', blockId).then((newBlockId) => {
            if (newBlockId) {
              setPendingEditBlockId(newBlockId);
            }
          });
        } else {
          setPendingEditBlockId(null);
        }
      }
    }, [pendingEditBlockId, blocks, startEditing, addBlock]);

    // Effect to handle backspace queue - delete empty blocks and move up
    useEffect(() => {
      if (pendingEditBlockId && blocks[pendingEditBlockId] && backspaceQueueRef.current > 0) {
        // Check if current block is empty
        const isEmpty = isBlockEmpty(pendingEditBlockId);

        if (isEmpty && blockOrder.length > 1) {
          backspaceQueueRef.current--;
          const currentIndex = blockOrder.indexOf(pendingEditBlockId);
          const prevBlockId = currentIndex > 0 ? blockOrder[currentIndex - 1] : null;

          // Delete current block and move to previous
          deleteBlock(pendingEditBlockId);
          if (prevBlockId) {
            setPendingEditBlockId(prevBlockId);
          } else {
            setPendingEditBlockId(null);
          }
        } else {
          // Not empty or only one block, clear queue
          backspaceQueueRef.current = 0;
        }
      }
    }, [pendingEditBlockId, blocks, blockOrder, isBlockEmpty, deleteBlock]);

    // Effect to handle arrow key queues - move between blocks
    useEffect(() => {
      if (pendingEditBlockId && blocks[pendingEditBlockId]) {
        const currentIndex = blockOrder.indexOf(pendingEditBlockId);

        // Handle ArrowUp queue
        if (arrowUpQueueRef.current > 0) {
          arrowUpQueueRef.current--;
          const prevBlockId = currentIndex > 0 ? blockOrder[currentIndex - 1] : null;
          if (prevBlockId) {
            setPendingEditBlockId(prevBlockId);
          } else {
            arrowUpQueueRef.current = 0; // Clear queue if at top
          }
          return;
        }

        // Handle ArrowDown queue
        if (arrowDownQueueRef.current > 0) {
          arrowDownQueueRef.current--;
          const nextBlockId = currentIndex < blockOrder.length - 1 ? blockOrder[currentIndex + 1] : null;
          if (nextBlockId) {
            setPendingEditBlockId(nextBlockId);
          } else {
            arrowDownQueueRef.current = 0; // Clear queue if at bottom
          }
          return;
        }
      }
    }, [pendingEditBlockId, blocks, blockOrder]);

    // Global key handler for when BlockEditor is not mounted yet
    useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        // Only handle when there's a pending block (transitioning between blocks)
        if (!pendingEditBlockId) return;

        // Enter key - queue for block creation
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          enterQueueRef.current++;
        }

        // Backspace key - queue for block deletion
        if (e.key === 'Backspace') {
          e.preventDefault();
          e.stopPropagation();
          backspaceQueueRef.current++;
        }

        // ArrowUp key - queue for moving to previous block
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          arrowUpQueueRef.current++;
        }

        // ArrowDown key - queue for moving to next block
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          arrowDownQueueRef.current++;
        }
      };

      window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
      return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
    }, [pendingEditBlockId]);

    // Handler for Enter key: save current block → release lock → create new block
    const handleSaveAndCreateNext = useCallback(
      async (blockId: string, content: string) => {
        // 1. Save the current block content
        await saveBlock(blockId, content);

        // 2. Release the current lock before creating next block
        finishEditing();

        // 3. Create a new block after current one
        const newBlockId = await addBlock('paragraph', blockId);

        // 4. Set pending edit - will start editing once block is rendered
        if (newBlockId) {
          setPendingEditBlockId(newBlockId);
        }
      },
      [saveBlock, finishEditing, addBlock]
    );

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
    }), []);

    // ============================================
    // AI Handlers
    // ============================================

    const handleAiStartEdit = useCallback(
      async (blockId: string) => {
        const success = await aiStartEditing(blockId);
        if (!success) {
          console.warn('[BlockBasedNotes] Failed to acquire lock for AI block:', blockId);
        }
      },
      [aiStartEditing]
    );

    const handleAiSaveEdit = useCallback(
      async (blockId: string, content: string) => {
        await aiSaveBlock(blockId, content);
        aiFinishEditing();
      },
      [aiSaveBlock, aiFinishEditing]
    );

    const handleAiAutoSave = useCallback(
      (blockId: string, content: string) => {
        aiBroadcastContent(blockId, content);
      },
      [aiBroadcastContent]
    );

    const handleAiCancelEdit = useCallback(() => {
      aiCancelEditing();
    }, [aiCancelEditing]);

    const handleAiDeleteBlock = useCallback(
      async (blockId: string) => {
        if (window.confirm(t('meet_block_delete_confirm') || 'Delete this block?')) {
          await aiDeleteBlock(blockId);
        }
      },
      [aiDeleteBlock, t]
    );

    const handleAiAddBlock = useCallback(
      async (type: BlockType, afterBlockId?: string | null) => {
        const newBlockId = await aiAddBlock(type, afterBlockId);
        if (newBlockId) {
          setTimeout(() => {
            aiStartEditing(newBlockId);
          }, 100);
        }
        return newBlockId;
      },
      [aiAddBlock, aiStartEditing]
    );

    const handleAiAddBlockAtEnd = useCallback(async () => {
      const lastBlockId = aiBlockOrder[aiBlockOrder.length - 1] || null;
      await handleAiAddBlock('paragraph', lastBlockId);
    }, [aiBlockOrder, handleAiAddBlock]);

    // Helper to check if an AI block is empty
    const isAiBlockEmpty = useCallback((blockId: string): boolean => {
      const block = aiBlocks[blockId];
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
    }, [aiBlocks]);

    const handleAiSaveAndCreateNext = useCallback(
      async (blockId: string, content: string) => {
        await aiSaveBlock(blockId, content);
        aiFinishEditing();

        const currentIndex = aiBlockOrder.indexOf(blockId);
        const nextBlockId = currentIndex >= 0 && currentIndex < aiBlockOrder.length - 1
          ? aiBlockOrder[currentIndex + 1]
          : null;

        if (nextBlockId && isAiBlockEmpty(nextBlockId)) {
          setTimeout(async () => {
            await aiStartEditing(nextBlockId);
          }, 100);
          return;
        }

        const newBlockId = await aiAddBlock('paragraph', blockId);
        if (newBlockId) {
          setTimeout(async () => {
            await aiStartEditing(newBlockId);
          }, 100);
        }
      },
      [aiSaveBlock, aiFinishEditing, aiAddBlock, aiStartEditing, aiBlockOrder, isAiBlockEmpty]
    );

    // AI Toolbar Actions
    const aiToolbarActions = useMemo(() => ({
      toggleBold: () => {
        aiEditorRef.current?.editor?.chain().focus().toggleBold().run();
      },
      toggleItalic: () => {
        aiEditorRef.current?.editor?.chain().focus().toggleItalic().run();
      },
      toggleStrike: () => {
        aiEditorRef.current?.editor?.chain().focus().toggleStrike().run();
      },
      toggleBulletList: () => {
        aiEditorRef.current?.editor?.chain().focus().toggleBulletList().run();
      },
      toggleOrderedList: () => {
        aiEditorRef.current?.editor?.chain().focus().toggleOrderedList().run();
      },
      toggleBlockquote: () => {
        aiEditorRef.current?.editor?.chain().focus().toggleBlockquote().run();
      },
      toggleCodeBlock: () => {
        aiEditorRef.current?.editor?.chain().focus().toggleCodeBlock().run();
      },
      toggleCode: () => {
        aiEditorRef.current?.editor?.chain().focus().toggleCode().run();
      },
      setHeading: (level: 1 | 2 | 3) => {
        aiEditorRef.current?.editor?.chain().focus().toggleHeading({ level }).run();
      },
      isActive: (type: string, attrs?: Record<string, unknown>) => {
        return aiEditorRef.current?.editor?.isActive(type, attrs) || false;
      },
    }), []);

    // Check if AI document has any blocks
    const hasAiContent = aiBlockOrder.length > 0;

    // ============================================
    // Title Editing
    // ============================================

    const handleTitleDoubleClick = () => {
      setIsEditingTitle(true);
      setTempTitle(document?.title || initialTitle);
    };

    const handleTitleSave = async () => {
      // TODO: Implement title update via API
      setIsEditingTitle(false);
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleTitleSave();
      } else if (e.key === 'Escape') {
        setIsEditingTitle(false);
        setTempTitle(document?.title || initialTitle);
      }
    };

    // ============================================
    // Content Insertion Helpers
    // ============================================

    /**
     * Insert TipTap content at the end of the document
     * Used for AI summaries, organized content, etc.
     */
    const insertContentAtEnd = useCallback(async (content: any) => {
      if (!content) return;

      // Content can be a TipTap JSON document or an array of nodes
      const nodes = content.content || (Array.isArray(content) ? content : [content]);

      // Track the last inserted block ID to chain insertions correctly
      let lastInsertedId: string | null = blockOrder[blockOrder.length - 1] || null;

      // Insert each node as a separate block with its content
      for (const node of nodes) {
        const type = (node.type || 'paragraph') as BlockType;
        const blockContent = JSON.stringify(node);

        // addBlock now accepts initialContent as third parameter
        const newBlockId = await addBlock(type, lastInsertedId, blockContent);
        if (newBlockId) {
          lastInsertedId = newBlockId; // Chain next block after this one
        }
      }
    }, [blockOrder, addBlock]);

    /**
     * Insert transcription content (utterance) at the end
     */
    const insertTranscription = useCallback(async (content: string, sectionTitle?: string) => {
      let lastInsertedId: string | null = blockOrder[blockOrder.length - 1] || null;

      // Add section title if provided
      if (sectionTitle) {
        const headingContent = JSON.stringify({
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: sectionTitle }]
        });
        const headingBlockId = await addBlock('heading', lastInsertedId, headingContent);
        if (headingBlockId) {
          lastInsertedId = headingBlockId;
        }
      }

      // Add the transcription content as a paragraph
      const paragraphContent = JSON.stringify({
        type: 'paragraph',
        content: [{ type: 'text', text: content }]
      });
      await addBlock('paragraph', lastInsertedId, paragraphContent);
    }, [blockOrder, addBlock]);

    // ============================================
    // Expose methods to parent
    // ============================================

    useImperativeHandle(
      ref,
      () => ({
        addBlock: handleAddBlock,
        insertContentAtEnd,
        insertTranscription,
      }),
      [handleAddBlock, insertContentAtEnd, insertTranscription]
    );

    // ============================================
    // Remote Users Display
    // ============================================

    const RemoteUserAvatars = useMemo(() => {
      if (remoteUsers.length === 0) return null;

      return (
        <div className="presence-avatars">
          {remoteUsers.slice(0, 4).map((user: RemoteBlockUser) => (
            <div
              key={user.clientId}
              className={`presence-avatar ${user.editingBlockId ? 'editing' : ''}`}
              title={`${user.username}${user.editingBlockId ? ' (editing)' : ''}`}
              style={{ borderColor: user.color }}
            >
              {user.photoUrl ? (
                <img src={user.photoUrl} alt={user.username} />
              ) : (
                <FiUser size={12} />
              )}
            </div>
          ))}
          {remoteUsers.length > 4 && (
            <div className="presence-more">+{remoteUsers.length - 4}</div>
          )}
        </div>
      );
    }, [remoteUsers]);

    // ============================================
    // Loading & Error States
    // ============================================

    if (isLoading) {
      return (
        <div className="block-notes-loading">
          <div className="loading-spinner" />
          <span>{t('loading') || 'Loading...'}</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="block-notes-error">
          <span>{error}</span>
          <button onClick={() => window.location.reload()}>
            {t('retry') || 'Retry'}
          </button>
        </div>
      );
    }

    // ============================================
    // Render
    // ============================================

    return (
      <div className="block-based-notes">
        {/* Header */}
        <div className="notes-header">
          <div className="notes-title-section">
            {isEditingTitle ? (
              <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyDown}
                className="notes-title-input"
                maxLength={100}
                autoFocus
              />
            ) : (
              <div className="notes-title-container">
                <h2 onDoubleClick={handleTitleDoubleClick}>
                  {document?.title || initialTitle}
                </h2>
                <button
                  className="title-edit-btn"
                  onClick={() => setIsEditingTitle(true)}
                  title={t('edit_title') || 'Edit title'}
                >
                  <FiEdit2 size={16} />
                </button>
              </div>
            )}
            <div className="notes-meta">
              {remoteUsers.length > 0 && (
                <span className="editors-count">
                  {remoteUsers.length} {remoteUsers.length === 1 ? 'editor' : 'editors'} active
                </span>
              )}
            </div>
          </div>
          <div className="notes-status">
            {/* Remote Users */}
            {RemoteUserAvatars}

            {/* Connection Status */}
            <span
              className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}
            >
              {isConnected ? <FiWifi size={14} /> : <FiWifiOff size={14} />}
            </span>

            {/* Sync Status */}
            <span className="sync-status">
              {isSyncing ? (
                <>
                  <FiCloud className="syncing" size={14} />
                  {t('meet_syncing') || 'Syncing...'}
                </>
              ) : (
                <>
                  <FiCheck size={14} />
                  {t('meet_synced') || 'Synced'}
                </>
              )}
            </span>
          </div>
        </div>

        {/* Note Tabs */}
        <div className="notes-tabs">
          <button
            className={`notes-tab ${activeTab === 'free' ? 'active' : ''}`}
            onClick={() => setActiveTab('free')}
          >
            <FiFileText size={14} />
            {t('meet_notes_tab_free') || '공유 노트'}
          </button>
          <button
            className={`notes-tab ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            <FiCpu size={14} />
            {t('meet_notes_tab_ai') || 'AI 정리'}
            {aiContent && <span className="tab-badge">✓</span>}
          </button>
        </div>

        {/* Free Notes Tab Content */}
        {activeTab === 'free' && (
          <>
            {/* Editor Toolbar Container - always present to reserve space */}
        <div className="notes-toolbar-container">
          <div className={`notes-toolbar ${editingBlockId ? 'visible' : ''}`}>
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
                "
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

                // Get additional blocks to show in placeholder (for the dragged block only)
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
                    currentUserId={userId}
                    isSelected={selectedBlockIds.has(blockId)}
                    isPartOfMultiDrag={isPartOfMultiDrag}
                    additionalDragBlocks={additionalDragBlocks}
                    onStartEdit={() => {
                      clearSelection(); // Clear selection when starting to edit
                      lastFocusedBlockIdRef.current = blockId; // Track last focused block
                      handleStartEdit(blockId);
                    }}
                    onSaveEdit={(content) => handleSaveEdit(blockId, content)}
                    onAutoSave={(content) => handleAutoSave(blockId, content)}
                    onCancelEdit={handleCancelEdit}
                    onDelete={() => handleDeleteBlock(blockId)}
                    onMoveToPrevBlock={() => handleMoveToPrevBlock(blockId)}
                    onMoveToNextBlock={() => handleMoveToNextBlock(blockId)}
                    onCreateBlockAfter={(type) => handleAddBlock(type, blockId)}
                    onSaveAndCreateNext={(content) => handleSaveAndCreateNext(blockId, content)}
                    editorRef={isCurrentlyEditing ? editorRef : undefined}
                  />
                );
              })}

              {/* Empty space for marquee selection and click to deselect */}
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

          {/* Drag Overlay for visual feedback */}
          <DragOverlay>
            {activeId && blocks[activeId] ? (
              <div className="block-drag-overlay">
                {/* Multi-block count badge */}
                {selectedBlockIds.has(activeId) && selectedBlockIds.size > 1 && (
                  <div className="drag-count-badge">
                    {selectedBlockIds.size}
                  </div>
                )}
                {/* Show all selected blocks when dragging multiple */}
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
                            currentUserId={userId}
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
                    currentUserId={userId}
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

            {/* Footer */}
            <div className="notes-footer">
              <span className="notes-hint">
                {t('meet_block_notes_hint') ||
                  'Click to edit • Drag to select • Ctrl+C/V to copy/paste'}
              </span>
              {!isConnected && (
                <span className="offline-warning">
                  {t('meet_offline_warning') ||
                    'Offline - changes will sync when reconnected'}
                </span>
              )}
            </div>
          </>
        )}

        {/* AI Notes Tab Content */}
        {activeTab === 'ai' && (
          <>
            {/* AI Toolbar - visible when editing a block */}
            <div className="notes-toolbar-container">
              <div className={`notes-toolbar ai-toolbar ${aiEditingBlockId ? 'visible' : ''}`}>
                <div className="toolbar-group">
                  <button
                    type="button"
                    onClick={aiToolbarActions.toggleBold}
                    className={`toolbar-btn ${aiToolbarActions.isActive('bold') ? 'active' : ''}`}
                    title="Bold (Ctrl+B)"
                  >
                    <FiBold size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={aiToolbarActions.toggleItalic}
                    className={`toolbar-btn ${aiToolbarActions.isActive('italic') ? 'active' : ''}`}
                    title="Italic (Ctrl+I)"
                  >
                    <FiItalic size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={aiToolbarActions.toggleStrike}
                    className={`toolbar-btn ${aiToolbarActions.isActive('strike') ? 'active' : ''}`}
                    title="Strikethrough"
                  >
                    <s>S</s>
                  </button>
                </div>

                <div className="toolbar-divider" />

                <div className="toolbar-group">
                  <button
                    type="button"
                    onClick={() => aiToolbarActions.setHeading(1)}
                    className={`toolbar-btn ${aiToolbarActions.isActive('heading', { level: 1 }) ? 'active' : ''}`}
                    title="Heading 1"
                  >
                    H1
                  </button>
                  <button
                    type="button"
                    onClick={() => aiToolbarActions.setHeading(2)}
                    className={`toolbar-btn ${aiToolbarActions.isActive('heading', { level: 2 }) ? 'active' : ''}`}
                    title="Heading 2"
                  >
                    H2
                  </button>
                  <button
                    type="button"
                    onClick={() => aiToolbarActions.setHeading(3)}
                    className={`toolbar-btn ${aiToolbarActions.isActive('heading', { level: 3 }) ? 'active' : ''}`}
                    title="Heading 3"
                  >
                    H3
                  </button>
                </div>

                <div className="toolbar-divider" />

                <div className="toolbar-group">
                  <button
                    type="button"
                    onClick={aiToolbarActions.toggleBulletList}
                    className={`toolbar-btn ${aiToolbarActions.isActive('bulletList') ? 'active' : ''}`}
                    title="Bullet List"
                  >
                    <FiList size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={aiToolbarActions.toggleOrderedList}
                    className={`toolbar-btn ${aiToolbarActions.isActive('orderedList') ? 'active' : ''}`}
                    title="Numbered List"
                  >
                    1.
                  </button>
                </div>

                <div className="toolbar-divider" />

                <div className="toolbar-group">
                  <button
                    type="button"
                    onClick={aiToolbarActions.toggleBlockquote}
                    className={`toolbar-btn ${aiToolbarActions.isActive('blockquote') ? 'active' : ''}`}
                    title="Quote"
                  >
                    "
                  </button>
                  <button
                    type="button"
                    onClick={aiToolbarActions.toggleCodeBlock}
                    className={`toolbar-btn ${aiToolbarActions.isActive('codeBlock') ? 'active' : ''}`}
                    title="Code Block"
                  >
                    <FiCode size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* AI Block List or Empty State */}
            {hasAiContent || aiContent ? (
              <>
                {/* Block-based AI Notes */}
                <div className="block-list ai-block-list">
                  {aiBlockOrder.map((blockId) => {
                    const block = aiBlocks[blockId];
                    if (!block) return null;

                    const isCurrentlyEditing = aiEditingBlockId === blockId;

                    return (
                      <SortableBlockRenderer
                        key={blockId}
                        block={block}
                        isEditing={isCurrentlyEditing}
                        isLocked={aiIsBlockLocked(blockId)}
                        isLockedByMe={aiIsBlockLockedByMe(blockId)}
                        lockInfo={aiGetBlockLockInfo(blockId)}
                        currentUserId={userId}
                        onStartEdit={() => handleAiStartEdit(blockId)}
                        onSaveEdit={(content) => handleAiSaveEdit(blockId, content)}
                        onAutoSave={(content) => handleAiAutoSave(blockId, content)}
                        onCancelEdit={handleAiCancelEdit}
                        onDelete={() => handleAiDeleteBlock(blockId)}
                        onCreateBlockAfter={(type) => handleAiAddBlock(type, blockId)}
                        onSaveAndCreateNext={(content) => handleAiSaveAndCreateNext(blockId, content)}
                        editorRef={isCurrentlyEditing ? aiEditorRef : undefined}
                      />
                    );
                  })}
                </div>

                {/* Add Block Button for AI */}
                <div className="block-add-section">
                  <button
                    type="button"
                    className="add-block-btn"
                    onClick={handleAiAddBlockAtEnd}
                    title={t('meet_add_block') || 'Add new block'}
                  >
                    <FiPlus size={16} />
                    <span>{t('meet_add_block') || 'Add block'}</span>
                  </button>

                  {/* Regenerate button */}
                  {onOrganizeNotes && (
                    <button
                      type="button"
                      className="ai-organize-btn"
                      onClick={onOrganizeNotes}
                      disabled={isOrganizing}
                    >
                      {isOrganizing ? (
                        <>
                          <FiLoader className="spinning" size={14} />
                          {t('meet_ai_organizing') || '정리 중...'}
                        </>
                      ) : (
                        <>
                          <FiCpu size={14} />
                          {t('meet_ai_regenerate') || '다시 정리'}
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* AI Footer */}
                <div className="notes-footer ai-footer">
                  <span className="notes-hint">
                    {t('meet_ai_notes_hint_editable') || 'AI 정리 내용을 자유롭게 편집할 수 있습니다.'}
                  </span>
                  {aiValidation && !aiValidation.valid && aiValidation.missingFragments.length > 0 && (
                    <span className="validation-warning">
                      ⚠️ {aiValidation.missingFragments.length}개의 내용이 누락되었습니다.
                    </span>
                  )}
                  {!aiIsConnected && (
                    <span className="offline-warning">
                      {t('meet_offline_warning') || 'Offline - changes will sync when reconnected'}
                    </span>
                  )}
                </div>
              </>
            ) : (
              /* Empty state when no AI content */
              <div className="ai-empty-state">
                <FiCpu size={48} />
                <h3>{t('meet_ai_empty_title') || 'AI 정리 없음'}</h3>
                <p>{t('meet_ai_empty_desc') || '공유 노트의 내용을 AI가 자동으로 정리합니다.'}</p>
                <button
                  className="ai-generate-btn"
                  onClick={onOrganizeNotes}
                  disabled={isOrganizing}
                >
                  {isOrganizing ? (
                    <>
                      <FiLoader className="spinning" size={16} />
                      {t('meet_ai_organizing') || '정리 중...'}
                    </>
                  ) : (
                    <>
                      <FiCpu size={16} />
                      {t('meet_ai_organize') || 'AI 정리 생성'}
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
);

BlockBasedNotes.displayName = 'BlockBasedNotes';

export default BlockBasedNotes;
