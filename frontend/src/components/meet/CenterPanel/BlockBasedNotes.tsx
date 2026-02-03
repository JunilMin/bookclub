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

interface AIVersionSummary {
  version: number;
  generatedAt: string;
  updatedAt: string;
  generatedBy: string | null;
  valid: boolean;
}

interface AIVersionData {
  blockOrder: string[];
  blocks: Record<string, any>;
  version: number;
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
  // AI Version props
  aiVersions?: AIVersionSummary[];
  selectedAiVersion?: number | null;
  aiVersionData?: AIVersionData | null;
  // Version-specific edit handlers
  onAiVersionBlockUpdate?: (version: number, blockId: string, content: string) => Promise<void>;
  onAiVersionBlockAdd?: (version: number, type: string, content: string, afterBlockId: string | null) => Promise<string | null>;
  onAiVersionBlockDelete?: (version: number, blockId: string) => Promise<void>;
}

export interface BlockBasedNotesRef {
  addBlock: (type: BlockType, afterBlockId?: string | null) => Promise<string | null>;
  insertContentAtEnd: (content: any) => void;
  insertTranscription: (content: string | any, sectionTitle?: string) => void;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Extract plain text content from a TipTap node recursively
 */
function extractTextFromNode(node: any): string {
  if (!node) return '';

  // Text node
  if (node.type === 'text' && node.text) {
    return node.text;
  }

  // Recursively extract from children
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractTextFromNode).join('');
  }

  return '';
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
    // AI Version props
    aiVersions = [],
    selectedAiVersion = null,
    aiVersionData = null,
    // Version-specific edit handlers
    onAiVersionBlockUpdate,
    onAiVersionBlockAdd,
    onAiVersionBlockDelete,
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
    // Flag to disable keyboard navigation in BlockEditor during pending transitions
    const [isNavigationPending, setIsNavigationPending] = useState(false);

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

    // Version editing state (for editing AI version blocks via REST API)
    const [versionEditingBlockId, setVersionEditingBlockId] = useState<string | null>(null);

    // AI Tab states (mirroring Free Notes states for identical UX)
    const [aiActiveId, setAiActiveId] = useState<string | null>(null);
    const [aiSelectedBlockIds, setAiSelectedBlockIds] = useState<Set<string>>(new Set());
    const [aiPendingEditBlockId, setAiPendingEditBlockId] = useState<string | null>(null);
    const [aiIsNavigationPending, setAiIsNavigationPending] = useState(false);
    const aiBlockListRef = useRef<HTMLDivElement>(null);
    const aiLastFocusedBlockIdRef = useRef<string | null>(null);
    const [aiIsMarqueeSelecting, setAiIsMarqueeSelecting] = useState(false);
    const [aiMarqueeStart, setAiMarqueeStart] = useState<{ x: number; y: number } | null>(null);
    const [aiMarqueeEnd, setAiMarqueeEnd] = useState<{ x: number; y: number } | null>(null);
    type AiPendingActionType = 'enter' | 'backspace' | 'arrowUp' | 'arrowDown';
    const aiPendingActionRef = useRef<{ type: AiPendingActionType; count: number } | null>(null);

    // Block document hook (Free Notes)
    const {
      document: _blockDocument,
      blockOrder,
      blocks,
      isLoading,
      error,
      isConnected,
      isSyncing,
      editingBlockId,
      locks: _locks,
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
      document: _aiDocument,
      blockOrder: aiBlockOrder,
      blocks: aiBlocks,
      isLoading: _aiIsLoading,
      error: _aiError,
      isConnected: aiIsConnected,
      isSyncing: _aiIsSyncing,
      editingBlockId: aiEditingBlockId,
      remoteUsers: _aiRemoteUsers,
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

        // Tab - convert selected blocks to bullet list (indent)
        // Shift+Tab - convert selected bullet list blocks to paragraph (outdent)
        if (e.key === 'Tab' && selectedBlockIds.size > 0) {
          e.preventDefault();

          const selectedInOrder = blockOrder.filter(id => selectedBlockIds.has(id));

          if (e.shiftKey) {
            // Shift+Tab: outdent - convert lists to paragraphs
            selectedInOrder.forEach(id => {
              const block = blocks[id];
              if (!block) return;
              if (block.type === 'bulletList' || block.type === 'orderedList' || block.type === 'taskList') {
                // Extract text content from list and convert to paragraph
                try {
                  const parsed = JSON.parse(block.content);
                  const textContent = extractTextFromNode(parsed);
                  const paragraphContent = JSON.stringify({
                    type: 'paragraph',
                    content: textContent ? [{ type: 'text', text: textContent }] : []
                  });
                  // Update block type and content via saveBlock
                  saveBlock(id, paragraphContent);
                } catch {
                  // Ignore parse errors
                }
              }
            });
          } else {
            // Tab: indent - convert paragraphs to bullet list
            selectedInOrder.forEach(id => {
              const block = blocks[id];
              if (!block) return;
              if (block.type === 'paragraph') {
                // Convert paragraph to bullet list
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
                  saveBlock(id, bulletContent);
                } catch {
                  // Ignore parse errors
                }
              }
            });
          }
          return;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editingBlockId, activeTab, selectedBlockIds, clearSelection, selectAllBlocks, copySelectedBlocks, pasteBlocks, deleteBlock, t, blockOrder, blocks, saveBlock]);

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
          // Initialize pendingActionRef for potential key-hold
          pendingActionRef.current = { type: 'backspace', count: 0 };
          setIsNavigationPending(true);
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
          // Initialize pendingActionRef for potential key-hold
          pendingActionRef.current = { type: 'arrowUp', count: 0 };
          setIsNavigationPending(true);
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
          // Initialize pendingActionRef for potential key-hold
          pendingActionRef.current = { type: 'arrowDown', count: 0 };
          setIsNavigationPending(true);
          setPendingEditBlockId(nextBlockId);
        }
      },
      [blockOrder, finishEditing]
    );

    const handleAddBlock = useCallback(
      async (type: BlockType, afterBlockId?: string | null) => {
        // Create new block AND start editing it
        // The startEditing option handles the lock transition properly
        const newBlockId = await addBlock(type, afterBlockId, undefined, { startEditing: true });
        return newBlockId;
      },
      [addBlock]
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

    // ============================================
    // Pending Navigation System
    // ============================================
    //
    // When transitioning between blocks (e.g., Enter creates new block),
    // there's a gap where BlockEditor is unmounted. During this gap,
    // key presses are captured and queued for processing.
    //
    // Flow:
    // 1. BlockEditor detects boundary/action → calls handler
    // 2. Handler sets pendingEditBlockId + queues action if key held
    // 3. useEffect detects block rendered → startEditing + process queue
    // 4. If queue has more actions → continue processing
    //
    // Priority: Enter (creates block) > Backspace (deletes) > Arrow (navigates)
    // ============================================

    type PendingActionType = 'enter' | 'backspace' | 'arrowUp' | 'arrowDown';
    const pendingActionRef = useRef<{ type: PendingActionType; count: number } | null>(null);

    // Helper to clear all pending state
    const clearPendingState = useCallback(() => {
      pendingActionRef.current = null;
      setIsNavigationPending(false);
      setPendingEditBlockId(null);
    }, []);

    // Single effect to handle all pending block transitions
    // If we already have lock (from addBlock with startEditing:true), don't re-acquire
    useEffect(() => {
      if (!pendingEditBlockId || !blocks[pendingEditBlockId]) return;

      const blockId = pendingEditBlockId;
      let cancelled = false;

      const handlePendingEdit = async () => {
        // Wait a bit for keys to queue up
        await new Promise(resolve => setTimeout(resolve, 80));

        if (cancelled) return;

        const action = pendingActionRef.current;
        const currentIndex = blockOrder.indexOf(blockId);

        // If no action or count is 0, we're at final destination
        if (!action || action.count <= 0) {
          // Only acquire lock if we don't already have it
          if (editingBlockId !== blockId) {
            const lockAcquired = await startEditing(blockId);
            if (cancelled) return;
            if (!lockAcquired) {
              console.warn('[BlockBasedNotes] Failed to acquire lock for pending edit:', blockId);
            }
          }
          clearPendingState();
          return;
        }

        // More actions pending - process them
        action.count--;

        // Release current lock before moving to next block
        if (editingBlockId === blockId) {
          finishEditing();
        }

        switch (action.type) {
          case 'enter':
            // Create another block after this one
            try {
              // Use startEditing: true to atomically create and lock new block
              const newBlockId = await addBlock('paragraph', blockId, undefined, { startEditing: true });
              if (!cancelled && newBlockId) {
                setPendingEditBlockId(newBlockId);
              } else if (!cancelled) {
                clearPendingState();
              }
            } catch {
              if (!cancelled) {
                clearPendingState();
              }
            }
            break;

          case 'backspace':
            if (isBlockEmpty(blockId) && blockOrder.length > 1) {
              const prevBlockId = currentIndex > 0 ? blockOrder[currentIndex - 1] : null;
              deleteBlock(blockId);
              if (!cancelled && prevBlockId) {
                setPendingEditBlockId(prevBlockId);
              } else if (!cancelled) {
                clearPendingState();
              }
            } else {
              // Not empty or last block - stay here
              if (editingBlockId !== blockId) {
                await startEditing(blockId);
              }
              clearPendingState();
            }
            break;

          case 'arrowUp':
            const prevBlockId = currentIndex > 0 ? blockOrder[currentIndex - 1] : null;
            if (!cancelled && prevBlockId) {
              setPendingEditBlockId(prevBlockId);
            } else if (!cancelled) {
              // At first block - stay here
              if (editingBlockId !== blockId) {
                await startEditing(blockId);
              }
              clearPendingState();
            }
            break;

          case 'arrowDown':
            const nextBlockId = currentIndex < blockOrder.length - 1 ? blockOrder[currentIndex + 1] : null;
            if (!cancelled && nextBlockId) {
              setPendingEditBlockId(nextBlockId);
            } else if (!cancelled) {
              // At last block - stay here
              if (editingBlockId !== blockId) {
                await startEditing(blockId);
              }
              clearPendingState();
            }
            break;
        }
      };

      handlePendingEdit();

      return () => {
        cancelled = true;
      };
    }, [pendingEditBlockId, blocks, blockOrder, editingBlockId, startEditing, finishEditing, addBlock, deleteBlock, isBlockEmpty, clearPendingState]);

    // Global key handler - only active during block transitions AND when focus is on editor
    // Uses capture:false to let TipTap process input rules first
    useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        // Only capture when transitioning between blocks AND pendingAction exists
        if (!pendingEditBlockId) return;

        const currentAction = pendingActionRef.current;
        if (!currentAction) return;

        // Strict focus check: only capture when actively inside block editor
        const activeElement = document.activeElement as HTMLElement | null;
        const isInBlockEditor = activeElement?.closest('.block-editor-wrapper');
        const isProseMirror = activeElement?.classList.contains('ProseMirror');

        // Only intercept if focus is directly on the editor
        if (!isInBlockEditor && !isProseMirror) {
          return;
        }

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

        // Only increment count if the key matches the current action type
        // This prevents mixing different action types during key-hold
        if (actionType && actionType === currentAction.type) {
          e.preventDefault();
          e.stopPropagation();
          currentAction.count++;
        }
      };

      // Use capture:false to let TipTap process input rules first
      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [pendingEditBlockId]);

    // Handler for Enter key: save current block → create new block → start editing
    const handleSaveAndCreateNext = useCallback(
      async (blockId: string, content: string, nextBlockType?: BlockType, nextListStart?: number) => {
        // 1. Save the current block content
        saveBlock(blockId, content);

        // 2. Determine block type
        const blockType = nextBlockType || 'paragraph';

        // For list types, create with empty list item content
        let initialContent: string | undefined;
        if (blockType === 'bulletList') {
          initialContent = JSON.stringify({
            type: 'bulletList',
            content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }]
          });
        } else if (blockType === 'orderedList') {
          // Include start number for ordered lists
          initialContent = JSON.stringify({
            type: 'orderedList',
            attrs: nextListStart ? { start: nextListStart } : undefined,
            content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }]
          });
        } else if (blockType === 'taskList') {
          initialContent = JSON.stringify({
            type: 'taskList',
            content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }]
          });
        }

        // 3. Create new block AND start editing it atomically
        // startEditing: true handles releasing old lock and acquiring new lock
        await addBlock(blockType, blockId, initialContent, { startEditing: true });

        // Note: No pending state setup needed - startEditing: true handles the transition atomically
        // Rapid Enter presses will be handled by the new BlockEditor's handleKeyDown
      },
      [saveBlock, addBlock]
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

    // Check if we're editing a specific version (not the real-time AI document)
    const isEditingVersion = !!aiVersionData && selectedAiVersion !== null;

    const handleAiStartEdit = useCallback(
      async (blockId: string) => {
        // For version editing, track editing state locally (no lock needed for REST API)
        if (isEditingVersion) {
          setVersionEditingBlockId(blockId);
          return true;
        }
        // For real-time AI document, use WebSocket lock
        const success = await aiStartEditing(blockId);
        if (!success) {
          console.warn('[BlockBasedNotes] Failed to acquire lock for AI block:', blockId);
        }
        return success;
      },
      [aiStartEditing, isEditingVersion]
    );

    const handleAiSaveEdit = useCallback(
      async (blockId: string, content: string) => {
        if (isEditingVersion && onAiVersionBlockUpdate && selectedAiVersion !== null) {
          // Save to version via REST API
          await onAiVersionBlockUpdate(selectedAiVersion, blockId, content);
          setVersionEditingBlockId(null);
        } else {
          // Save via WebSocket (real-time document)
          await aiSaveBlock(blockId, content);
          aiFinishEditing();
        }
      },
      [aiSaveBlock, aiFinishEditing, isEditingVersion, onAiVersionBlockUpdate, selectedAiVersion]
    );

    const handleAiAutoSave = useCallback(
      (blockId: string, content: string) => {
        if (isEditingVersion && onAiVersionBlockUpdate && selectedAiVersion !== null) {
          // Debounced save to version via REST API
          onAiVersionBlockUpdate(selectedAiVersion, blockId, content);
        } else {
          aiBroadcastContent(blockId, content);
        }
      },
      [aiBroadcastContent, isEditingVersion, onAiVersionBlockUpdate, selectedAiVersion]
    );

    const handleAiCancelEdit = useCallback(() => {
      if (isEditingVersion) {
        setVersionEditingBlockId(null);
      } else {
        aiCancelEditing();
      }
    }, [aiCancelEditing, isEditingVersion]);

    const handleAiAddBlock = useCallback(
      async (type: BlockType, afterBlockId?: string | null, initialContent?: string) => {
        if (isEditingVersion && onAiVersionBlockAdd && selectedAiVersion !== null) {
          // Add block to version via REST API
          const contentToUse = initialContent || JSON.stringify({
            type: type,
            content: type === 'paragraph' ? [{ type: 'text', text: '' }] : []
          });
          const newBlockId = await onAiVersionBlockAdd(selectedAiVersion, type, contentToUse, afterBlockId || null);
          // Start editing the new block
          if (newBlockId) {
            setTimeout(() => {
              setVersionEditingBlockId(newBlockId);
            }, 100);
          }
          return newBlockId;
        } else {
          // Create new block AND start editing it
          // The startEditing option handles the lock transition properly
          const newBlockId = await aiAddBlock(type, afterBlockId, initialContent, { startEditing: true });
          return newBlockId;
        }
      },
      [aiAddBlock, isEditingVersion, onAiVersionBlockAdd, selectedAiVersion]
    );

    const handleAiAddBlockAtEnd = useCallback(async () => {
      const blockOrderToUse = aiVersionData?.blockOrder || aiBlockOrder;
      const lastBlockId = blockOrderToUse[blockOrderToUse.length - 1] || null;
      await handleAiAddBlock('paragraph', lastBlockId);
    }, [aiVersionData?.blockOrder, aiBlockOrder, handleAiAddBlock]);

    const handleAiSaveAndCreateNext = useCallback(
      async (blockId: string, content: string, nextBlockType?: BlockType, nextListStart?: number) => {
        // 1. Save the current block
        await handleAiSaveEdit(blockId, content);

        const blockOrderToUse = aiVersionData?.blockOrder || aiBlockOrder;
        const blocksToUse = aiVersionData?.blocks || aiBlocks;

        const currentIndex = blockOrderToUse.indexOf(blockId);
        const nextExistingBlockId = currentIndex >= 0 && currentIndex < blockOrderToUse.length - 1
          ? blockOrderToUse[currentIndex + 1]
          : null;

        // Check if next block is empty
        const isAiNextBlockEmpty = (checkBlockId: string): boolean => {
          const block = blocksToUse[checkBlockId];
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
        };

        if (nextExistingBlockId && isAiNextBlockEmpty(nextExistingBlockId)) {
          // Move to existing empty block
          handleAiStartEdit(nextExistingBlockId);
          return;
        }

        // 2. Determine block type
        const blockType = nextBlockType || 'paragraph';

        // Build initial content for list types
        let initialContent: string | undefined;
        if (blockType === 'bulletList') {
          initialContent = JSON.stringify({
            type: 'bulletList',
            content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }]
          });
        } else if (blockType === 'orderedList') {
          initialContent = JSON.stringify({
            type: 'orderedList',
            attrs: nextListStart ? { start: nextListStart } : undefined,
            content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }]
          });
        } else if (blockType === 'taskList') {
          initialContent = JSON.stringify({
            type: 'taskList',
            content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }]
          });
        }

        // 3. Create new block with startEditing (handles lock transition atomically)
        await handleAiAddBlock(blockType, blockId, initialContent);

        // Note: No pending state setup - startEditing handles the transition atomically
      },
      [handleAiSaveEdit, handleAiAddBlock, handleAiStartEdit, aiVersionData, aiBlockOrder, aiBlocks]
    );

    // ============================================
    // AI Drag Handlers (mirroring Free Notes)
    // ============================================

    const handleAiDragStart = useCallback((event: DragStartEvent) => {
      const draggedId = event.active.id as string;
      setAiActiveId(draggedId);

      // If dragging a selected block, keep selection
      // If dragging an unselected block, clear selection and select only this one
      if (!aiSelectedBlockIds.has(draggedId)) {
        setAiSelectedBlockIds(new Set([draggedId]));
      }
    }, [aiSelectedBlockIds]);

    const handleAiDragEnd = useCallback((event: DragEndEvent) => {
      const { active, over } = event;
      setAiActiveId(null);

      if (!over || active.id === over.id) return;

      const activeIdLocal = active.id as string;
      const overId = over.id as string;

      const blockOrderToUse = aiVersionData?.blockOrder || aiBlockOrder;

      // Get blocks to move (selected blocks if dragging a selected block, otherwise just the dragged block)
      const blocksToMove = aiSelectedBlockIds.has(activeIdLocal)
        ? blockOrderToUse.filter(id => aiSelectedBlockIds.has(id))
        : [activeIdLocal];

      if (blocksToMove.length === 0) return;

      // Find target index
      const overIndex = blockOrderToUse.indexOf(overId);

      // For now, only support single block move in AI tab (reorder not yet implemented for versions)
      if (!isEditingVersion && blocksToMove.length === 1) {
        const fromIndex = blockOrderToUse.indexOf(blocksToMove[0]);
        if (fromIndex !== overIndex) {
          aiReorderBlocks(fromIndex, overIndex);
        }
      }
    }, [aiVersionData?.blockOrder, aiBlockOrder, aiSelectedBlockIds, aiReorderBlocks, isEditingVersion]);

    const handleAiDragCancel = useCallback(() => {
      setAiActiveId(null);
    }, []);

    // Custom collision detection for AI tab that ignores collapsed (selected) blocks during multi-drag
    const aiMultiDragCollisionDetection: CollisionDetection = useCallback((args) => {
      const { active } = args;
      const activeIdLocal = active.id as string;

      // Check if multi-drag is active
      const isMultiDrag = aiSelectedBlockIds.has(activeIdLocal) && aiSelectedBlockIds.size > 1;

      if (!isMultiDrag) {
        return closestCenter(args);
      }

      // Multi-drag: filter out collapsed blocks from droppable containers
      const filteredArgs = {
        ...args,
        droppableContainers: args.droppableContainers.filter(
          (container) => !aiSelectedBlockIds.has(container.id as string) || container.id === activeIdLocal
        ),
      };

      return closestCenter(filteredArgs);
    }, [aiSelectedBlockIds]);

    // ============================================
    // AI Marquee Selection Handlers
    // ============================================

    const getAiMarqueeRect = useCallback(() => {
      if (!aiMarqueeStart || !aiMarqueeEnd) return null;
      return {
        left: Math.min(aiMarqueeStart.x, aiMarqueeEnd.x),
        top: Math.min(aiMarqueeStart.y, aiMarqueeEnd.y),
        right: Math.max(aiMarqueeStart.x, aiMarqueeEnd.x),
        bottom: Math.max(aiMarqueeStart.y, aiMarqueeEnd.y),
        width: Math.abs(aiMarqueeEnd.x - aiMarqueeStart.x),
        height: Math.abs(aiMarqueeEnd.y - aiMarqueeStart.y),
      };
    }, [aiMarqueeStart, aiMarqueeEnd]);

    const getAiBlocksInMarquee = useCallback(() => {
      const marqueeRect = getAiMarqueeRect();
      if (!marqueeRect || !aiBlockListRef.current) return new Set<string>();

      const selectedIds = new Set<string>();
      const blockElements = aiBlockListRef.current.querySelectorAll('[data-block-id]');

      blockElements.forEach((el) => {
        const blockId = el.getAttribute('data-block-id');
        if (!blockId) return;

        const rect = el.getBoundingClientRect();
        const listRect = aiBlockListRef.current!.getBoundingClientRect();

        const blockTop = rect.top - listRect.top + aiBlockListRef.current!.scrollTop;
        const blockBottom = rect.bottom - listRect.top + aiBlockListRef.current!.scrollTop;
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
    }, [getAiMarqueeRect]);

    const handleAiMarqueeMouseDown = useCallback((e: React.MouseEvent) => {
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;
      const isOnBlock = target.closest('.block-renderer');
      const isOnInteractive = target.closest('button, input, a, [role="button"]');

      if (isOnBlock || isOnInteractive) return;

      // Clicking on empty space - exit editing mode if active
      const currentEditingBlockId = isEditingVersion ? versionEditingBlockId : aiEditingBlockId;
      if (currentEditingBlockId) {
        if (isEditingVersion) {
          setVersionEditingBlockId(null);
        } else {
          aiFinishEditing();
        }
        return;
      }

      const listRect = aiBlockListRef.current?.getBoundingClientRect();
      if (!listRect) return;

      const x = e.clientX - listRect.left;
      const y = e.clientY - listRect.top + (aiBlockListRef.current?.scrollTop || 0);

      setAiMarqueeStart({ x, y });
      setAiMarqueeEnd({ x, y });
      setAiIsMarqueeSelecting(true);

      setAiSelectedBlockIds(new Set());

      e.preventDefault();
    }, [isEditingVersion, versionEditingBlockId, aiEditingBlockId, aiFinishEditing]);

    // AI Marquee mouse move effect
    useEffect(() => {
      if (!aiIsMarqueeSelecting) return;

      const handleMouseMove = (e: MouseEvent) => {
        const listRect = aiBlockListRef.current?.getBoundingClientRect();
        if (!listRect) return;

        const x = e.clientX - listRect.left;
        const y = e.clientY - listRect.top + (aiBlockListRef.current?.scrollTop || 0);

        setAiMarqueeEnd({ x, y });

        const selectedIds = getAiBlocksInMarquee();
        setAiSelectedBlockIds(selectedIds);
      };

      const handleMouseUp = () => {
        if (aiMarqueeStart && aiMarqueeEnd) {
          const width = Math.abs(aiMarqueeEnd.x - aiMarqueeStart.x);
          const height = Math.abs(aiMarqueeEnd.y - aiMarqueeStart.y);
          if (width < 5 && height < 5) {
            setAiSelectedBlockIds(new Set());
          }
        }

        setAiIsMarqueeSelecting(false);
        setAiMarqueeStart(null);
        setAiMarqueeEnd(null);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }, [aiIsMarqueeSelecting, getAiBlocksInMarquee, aiMarqueeStart, aiMarqueeEnd]);

    const clearAiSelection = useCallback(() => {
      setAiSelectedBlockIds(new Set());
      setAiIsMarqueeSelecting(false);
      setAiMarqueeStart(null);
      setAiMarqueeEnd(null);
    }, []);

    // ============================================
    // AI Keyboard Navigation Handlers
    // ============================================

    const handleAiMoveToPrevBlock = useCallback(
      (blockId: string) => {
        const blockOrderToUse = aiVersionData?.blockOrder || aiBlockOrder;
        const currentIndex = blockOrderToUse.indexOf(blockId);
        const prevBlockId = currentIndex > 0 ? blockOrderToUse[currentIndex - 1] : null;

        if (prevBlockId) {
          if (isEditingVersion) {
            setVersionEditingBlockId(null);
          } else {
            aiFinishEditing();
          }
          aiPendingActionRef.current = { type: 'arrowUp', count: 0 };
          setAiIsNavigationPending(true);
          setAiPendingEditBlockId(prevBlockId);
        }
      },
      [aiVersionData?.blockOrder, aiBlockOrder, isEditingVersion, aiFinishEditing]
    );

    const handleAiMoveToNextBlock = useCallback(
      (blockId: string) => {
        const blockOrderToUse = aiVersionData?.blockOrder || aiBlockOrder;
        const currentIndex = blockOrderToUse.indexOf(blockId);
        const nextBlockId = currentIndex < blockOrderToUse.length - 1 ? blockOrderToUse[currentIndex + 1] : null;

        if (nextBlockId) {
          if (isEditingVersion) {
            setVersionEditingBlockId(null);
          } else {
            aiFinishEditing();
          }
          aiPendingActionRef.current = { type: 'arrowDown', count: 0 };
          setAiIsNavigationPending(true);
          setAiPendingEditBlockId(nextBlockId);
        }
      },
      [aiVersionData?.blockOrder, aiBlockOrder, isEditingVersion, aiFinishEditing]
    );

    const handleAiDeleteBlockWithNav = useCallback(
      async (blockId: string) => {
        const blockOrderToUse = aiVersionData?.blockOrder || aiBlockOrder;
        const currentIndex = blockOrderToUse.indexOf(blockId);
        const prevBlockId = currentIndex > 0 ? blockOrderToUse[currentIndex - 1] : null;

        // Release current editing lock
        if (isEditingVersion) {
          setVersionEditingBlockId(null);
        } else {
          aiFinishEditing();
        }

        // Delete the block
        if (isEditingVersion && onAiVersionBlockDelete && selectedAiVersion !== null) {
          await onAiVersionBlockDelete(selectedAiVersion, blockId);
        } else {
          await aiDeleteBlock(blockId);
        }

        // Move to previous block
        if (prevBlockId) {
          aiPendingActionRef.current = { type: 'backspace', count: 0 };
          setAiIsNavigationPending(true);
          setAiPendingEditBlockId(prevBlockId);
        }
      },
      [aiVersionData?.blockOrder, aiBlockOrder, isEditingVersion, aiFinishEditing, onAiVersionBlockDelete, selectedAiVersion, aiDeleteBlock]
    );

    // Helper to check if AI block is empty
    const isAiBlockEmpty = useCallback((blockId: string): boolean => {
      const blocksToUse = aiVersionData?.blocks || aiBlocks;
      const block = blocksToUse[blockId];
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
    }, [aiVersionData?.blocks, aiBlocks]);

    // ============================================
    // AI Pending Navigation System
    // ============================================

    // Helper to clear AI pending state
    const clearAiPendingState = useCallback(() => {
      aiPendingActionRef.current = null;
      setAiIsNavigationPending(false);
      setAiPendingEditBlockId(null);
    }, []);

    // Helper to release AI editing lock
    const releaseAiEditingLock = useCallback(() => {
      if (isEditingVersion) {
        setVersionEditingBlockId(null);
      } else {
        aiFinishEditing();
      }
    }, [isEditingVersion, aiFinishEditing]);

    // AI tab pending edit effect - same logic as free notes
    // If we already have lock, don't re-acquire
    useEffect(() => {
      if (!aiPendingEditBlockId) return;

      const blocksToUse = aiVersionData?.blocks || aiBlocks;
      if (!blocksToUse[aiPendingEditBlockId]) return;

      const blockId = aiPendingEditBlockId;
      const currentEditingId = isEditingVersion ? versionEditingBlockId : aiEditingBlockId;
      let cancelled = false;

      const handlePendingEdit = async () => {
        // Wait a bit for keys to queue up
        await new Promise(resolve => setTimeout(resolve, 80));

        if (cancelled) return;

        const action = aiPendingActionRef.current;
        const blockOrderToUse = aiVersionData?.blockOrder || aiBlockOrder;
        const currentIndex = blockOrderToUse.indexOf(blockId);

        // If no action or count is 0, we're at final destination
        if (!action || action.count <= 0) {
          // Only acquire lock if we don't already have it
          if (currentEditingId !== blockId) {
            const lockAcquired = await handleAiStartEdit(blockId);
            if (cancelled) return;
            if (!lockAcquired) {
              console.warn('[BlockBasedNotes] Failed to acquire lock for AI pending edit:', blockId);
            }
          }
          clearAiPendingState();
          return;
        }

        // More actions pending - process them
        action.count--;

        // Release current lock before moving
        if (currentEditingId === blockId) {
          releaseAiEditingLock();
        }

        switch (action.type) {
          case 'enter':
            // Use startEditing in handleAiAddBlock
            handleAiAddBlock('paragraph', blockId).then((newBlockId) => {
              if (cancelled) return;
              if (newBlockId) {
                setAiPendingEditBlockId(newBlockId);
              } else {
                clearAiPendingState();
              }
            }).catch(() => {
              if (cancelled) return;
              clearAiPendingState();
            });
            break;

          case 'backspace':
            if (isAiBlockEmpty(blockId) && blockOrderToUse.length > 1) {
              const prevBlockId = currentIndex > 0 ? blockOrderToUse[currentIndex - 1] : null;
              if (isEditingVersion && onAiVersionBlockDelete && selectedAiVersion !== null) {
                onAiVersionBlockDelete(selectedAiVersion, blockId);
              } else {
                aiDeleteBlock(blockId);
              }
              if (prevBlockId) {
                setAiPendingEditBlockId(prevBlockId);
              } else {
                clearAiPendingState();
              }
            } else {
              // Not empty or last block - stay here
              if (currentEditingId !== blockId) {
                await handleAiStartEdit(blockId);
              }
              clearAiPendingState();
            }
            break;

          case 'arrowUp':
            const prevBlockId = currentIndex > 0 ? blockOrderToUse[currentIndex - 1] : null;
            if (prevBlockId) {
              setAiPendingEditBlockId(prevBlockId);
            } else {
              // At first block - stay here
              if (currentEditingId !== blockId) {
                await handleAiStartEdit(blockId);
              }
              clearAiPendingState();
            }
            break;

          case 'arrowDown':
            const nextBlockId = currentIndex < blockOrderToUse.length - 1 ? blockOrderToUse[currentIndex + 1] : null;
            if (nextBlockId) {
              setAiPendingEditBlockId(nextBlockId);
            } else {
              // At last block - stay here
              if (currentEditingId !== blockId) {
                await handleAiStartEdit(blockId);
              }
              clearAiPendingState();
            }
            break;
        }
      };

      handlePendingEdit();

      return () => {
        cancelled = true;
      };
    }, [aiPendingEditBlockId, aiVersionData?.blocks, aiBlocks, aiVersionData?.blockOrder, aiBlockOrder, isEditingVersion, versionEditingBlockId, aiEditingBlockId, handleAiStartEdit, handleAiAddBlock, isAiBlockEmpty, onAiVersionBlockDelete, selectedAiVersion, aiDeleteBlock, clearAiPendingState, releaseAiEditingLock]);

    // Global key handler for AI tab during block transitions
    // Uses capture:false to let TipTap process input rules first
    useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if (!aiPendingEditBlockId) return;

        const currentAction = aiPendingActionRef.current;
        if (!currentAction) return;

        // Strict focus check
        const activeElement = document.activeElement as HTMLElement | null;
        const isInBlockEditor = activeElement?.closest('.block-editor-wrapper');
        const isProseMirror = activeElement?.classList.contains('ProseMirror');

        if (!isInBlockEditor && !isProseMirror) return;

        let actionType: AiPendingActionType | null = null;

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

      // Use capture:false to let TipTap process input rules first
      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [aiPendingEditBlockId]);

    // AI Tab keyboard handler for copy/paste/select all/delete
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (activeTab !== 'ai') return;

        const isCtrlOrCmd = e.metaKey || e.ctrlKey;
        const currentEditingBlockId = isEditingVersion ? versionEditingBlockId : aiEditingBlockId;

        // The rest only applies when NOT editing
        if (currentEditingBlockId) return;

        // Escape - clear selection
        if (e.key === 'Escape') {
          clearAiSelection();
          return;
        }

        const blockOrderToUse = aiVersionData?.blockOrder || aiBlockOrder;

        // Ctrl/Cmd + A - select all
        if (isCtrlOrCmd && e.key === 'a') {
          e.preventDefault();
          setAiSelectedBlockIds(new Set(blockOrderToUse));
          return;
        }

        // Delete/Backspace - delete selected blocks
        if ((e.key === 'Delete' || e.key === 'Backspace') && aiSelectedBlockIds.size > 0) {
          e.preventDefault();
          if (window.confirm(t('meet_block_delete_selected') || `Delete ${aiSelectedBlockIds.size} selected block(s)?`)) {
            aiSelectedBlockIds.forEach(id => {
              if (isEditingVersion && onAiVersionBlockDelete && selectedAiVersion !== null) {
                onAiVersionBlockDelete(selectedAiVersion, id);
              } else {
                aiDeleteBlock(id);
              }
            });
            clearAiSelection();
          }
          return;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTab, isEditingVersion, versionEditingBlockId, aiEditingBlockId, aiVersionData?.blockOrder, aiBlockOrder, aiSelectedBlockIds, clearAiSelection, t, onAiVersionBlockDelete, selectedAiVersion, aiDeleteBlock]);

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
    // Use version data if available, otherwise fall back to useBlockDocument data
    const effectiveAiBlockOrder = aiVersionData?.blockOrder || aiBlockOrder;
    const effectiveAiBlocks = aiVersionData?.blocks || aiBlocks;
    const hasAiContent = effectiveAiBlockOrder.length > 0 || aiVersions.length > 0;

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
     * Used for AI summaries, organized content, utteranceBlocks, etc.
     */
    const insertContentAtEnd = useCallback(async (content: any) => {
      if (!content) return;

      // Track the last inserted block ID to chain insertions correctly
      let lastInsertedId: string | null = blockOrder[blockOrder.length - 1] || null;

      // Check if this is a single block node (utteranceBlock, heading, paragraph with attrs, etc.)
      // These should be inserted as ONE block, not split by their children
      const isSingleBlockNode = content.type &&
        ['utteranceBlock', 'heading', 'blockquote', 'codeBlock'].includes(content.type);

      if (isSingleBlockNode) {
        // Insert the entire node as a single block
        const type = content.type as BlockType;
        const blockContent = JSON.stringify(content);
        await addBlock(type, lastInsertedId, blockContent);
        return;
      }

      // For doc content or arrays, iterate and insert each node as a separate block
      const nodes = content.content || (Array.isArray(content) ? content : [content]);

      for (const node of nodes) {
        const type = (node.type || 'paragraph') as BlockType;
        const blockContent = JSON.stringify(node);

        const newBlockId = await addBlock(type, lastInsertedId, blockContent);
        if (newBlockId) {
          lastInsertedId = newBlockId; // Chain next block after this one
        }
      }
    }, [blockOrder, addBlock]);

    /**
     * Insert transcription content (utterance) at the end
     * @param content - Can be a string (plain text) or an object (utteranceBlock with attrs)
     * @param sectionTitle - Optional section title heading
     */
    const insertTranscription = useCallback(async (content: string | any, sectionTitle?: string) => {
      let lastInsertedId: string | null = blockOrder[blockOrder.length - 1] || null;

      // Add section title if provided (only once, skip if we already have transcription blocks)
      if (sectionTitle) {
        // Check if we already have a transcription section heading
        const hasTranscriptionHeading = blockOrder.some(blockId => {
          const block = blocks[blockId];
          if (!block) return false;
          try {
            const parsed = JSON.parse(block.content);
            if (parsed.type === 'heading' && parsed.content?.[0]?.text === sectionTitle) {
              return true;
            }
          } catch {
            // Ignore parse errors
          }
          return false;
        });

        if (!hasTranscriptionHeading) {
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
      }

      // Handle different content types
      if (typeof content === 'object' && content !== null) {
        // It's an utteranceBlock object or similar structured content
        const blockContent = JSON.stringify(content);
        const blockType = (content.type || 'paragraph') as BlockType;
        await addBlock(blockType, lastInsertedId, blockContent);
      } else {
        // It's a plain string - wrap in paragraph
        const paragraphContent = JSON.stringify({
          type: 'paragraph',
          content: [{ type: 'text', text: String(content) }]
        });
        await addBlock('paragraph', lastInsertedId, paragraphContent);
      }
    }, [blockOrder, blocks, addBlock]);

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
                    skipKeyboardNavigation={isNavigationPending}
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
                    onSaveAndCreateNext={(content, nextBlockType, nextListStart) => handleSaveAndCreateNext(blockId, content, nextBlockType, nextListStart)}
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
              <div className={`notes-toolbar ai-toolbar ${(aiEditingBlockId || versionEditingBlockId) ? 'visible' : ''}`}>
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
                {/* Block-based AI Notes with Drag-and-Drop */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={aiMultiDragCollisionDetection}
                  onDragStart={handleAiDragStart}
                  onDragEnd={handleAiDragEnd}
                  onDragCancel={handleAiDragCancel}
                >
                  <SortableContext
                    items={effectiveAiBlockOrder}
                    strategy={verticalListSortingStrategy}
                  >
                    <div
                      className={`block-list ai-block-list ${aiActiveId ? 'is-dragging' : ''}`}
                      ref={aiBlockListRef}
                      onMouseDown={handleAiMarqueeMouseDown}
                      style={{ position: 'relative' }}
                    >
                      {effectiveAiBlockOrder.map((blockId) => {
                        const block = effectiveAiBlocks[blockId];
                        if (!block) return null;

                        // Version blocks are now editable via REST API
                        const isVersionBlock = !!aiVersionData;
                        // Check editing state: version uses local state, real-time uses hook state
                        const isCurrentlyEditing = isVersionBlock
                          ? versionEditingBlockId === blockId
                          : aiEditingBlockId === blockId;

                        // Multi-drag logic for AI tab
                        const isAiMultiDragActive = aiActiveId !== null
                          && aiSelectedBlockIds.has(aiActiveId)
                          && aiSelectedBlockIds.size > 1;
                        const isAiDraggedBlock = aiActiveId === blockId;
                        const isAiPartOfMultiDrag = isAiMultiDragActive
                          && aiSelectedBlockIds.has(blockId)
                          && !isAiDraggedBlock;

                        // Get additional blocks to show in placeholder (for the dragged block only)
                        const aiAdditionalDragBlocks = isAiDraggedBlock && isAiMultiDragActive
                          ? effectiveAiBlockOrder
                              .filter(id => aiSelectedBlockIds.has(id) && id !== blockId)
                              .map(id => effectiveAiBlocks[id])
                              .filter(Boolean)
                          : undefined;

                        return (
                          <SortableBlockRenderer
                            key={blockId}
                            block={block}
                            isEditing={isCurrentlyEditing}
                            isLocked={!isVersionBlock && aiIsBlockLocked(blockId)}
                            isLockedByMe={!isVersionBlock && aiIsBlockLockedByMe(blockId)}
                            lockInfo={!isVersionBlock ? aiGetBlockLockInfo(blockId) : null}
                            currentUserId={userId}
                            isSelected={aiSelectedBlockIds.has(blockId)}
                            isPartOfMultiDrag={isAiPartOfMultiDrag}
                            additionalDragBlocks={aiAdditionalDragBlocks}
                            skipKeyboardNavigation={aiIsNavigationPending}
                            onStartEdit={() => {
                              clearAiSelection();
                              aiLastFocusedBlockIdRef.current = blockId;
                              handleAiStartEdit(blockId);
                            }}
                            onSaveEdit={(content) => handleAiSaveEdit(blockId, content)}
                            onAutoSave={(content) => handleAiAutoSave(blockId, content)}
                            onCancelEdit={handleAiCancelEdit}
                            onDelete={() => handleAiDeleteBlockWithNav(blockId)}
                            onMoveToPrevBlock={() => handleAiMoveToPrevBlock(blockId)}
                            onMoveToNextBlock={() => handleAiMoveToNextBlock(blockId)}
                            onCreateBlockAfter={(type) => handleAiAddBlock(type, blockId)}
                            onSaveAndCreateNext={(content, nextBlockType, nextListStart) => handleAiSaveAndCreateNext(blockId, content, nextBlockType, nextListStart)}
                            editorRef={isCurrentlyEditing ? aiEditorRef : undefined}
                          />
                        );
                      })}

                      {/* Empty space for marquee selection and click to deselect */}
                      <div
                        className="block-list-empty-space"
                        onMouseDown={handleAiMarqueeMouseDown}
                      />

                      {/* Marquee Selection Rectangle for AI tab */}
                      {aiIsMarqueeSelecting && aiMarqueeStart && aiMarqueeEnd && (
                        <div
                          className="marquee-selection"
                          style={{
                            position: 'absolute',
                            left: Math.min(aiMarqueeStart.x, aiMarqueeEnd.x),
                            top: Math.min(aiMarqueeStart.y, aiMarqueeEnd.y),
                            width: Math.abs(aiMarqueeEnd.x - aiMarqueeStart.x),
                            height: Math.abs(aiMarqueeEnd.y - aiMarqueeStart.y),
                            pointerEvents: 'none',
                          }}
                        />
                      )}
                    </div>
                  </SortableContext>

                  {/* Drag Overlay for AI tab */}
                  <DragOverlay>
                    {aiActiveId && effectiveAiBlocks[aiActiveId] ? (
                      <div className="block-drag-overlay">
                        {/* Multi-block count badge */}
                        {aiSelectedBlockIds.has(aiActiveId) && aiSelectedBlockIds.size > 1 && (
                          <div className="drag-count-badge">
                            {aiSelectedBlockIds.size}
                          </div>
                        )}
                        {/* Show all selected blocks when dragging multiple */}
                        {aiSelectedBlockIds.has(aiActiveId) && aiSelectedBlockIds.size > 1 ? (
                          <div className="drag-overlay-blocks-container">
                            {effectiveAiBlockOrder
                              .filter(id => aiSelectedBlockIds.has(id))
                              .map((blockId) => (
                                <div key={blockId} className="drag-overlay-block">
                                  <BlockRenderer
                                    block={effectiveAiBlocks[blockId]}
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
                            block={effectiveAiBlocks[aiActiveId]}
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
                    {t('meet_block_notes_hint') ||
                      'Click to edit • Drag to select • Ctrl+C/V to copy/paste'}
                  </span>
                  {aiValidation && !aiValidation.valid && aiValidation.missingFragments.length > 0 && (
                    <span className="validation-warning">
                      {aiValidation.missingFragments.length}개의 내용이 누락되었습니다.
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
