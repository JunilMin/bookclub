// frontend/src/screens/NoteDetail.tsx
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  FiArrowLeft,
  FiCalendar,
  FiUsers,
  FiClock,
  FiStar,
  FiSave,
  FiEdit3,
  FiBook,
  FiUser,
  FiAward,
  FiMessageSquare,
  FiCpu,
  FiMic,
  FiPlus,
  FiBold,
  FiItalic,
  FiList,
  FiCode,
  FiRotateCcw,
  FiRotateCw,
} from 'react-icons/fi';
import { useAuth } from '../AuthContext/AuthContext';
import {
  getNoteEnriched,
  updateUserNoteContent,
  updateUserNoteTitle,
  UserNoteResponse,
  ParticipantInfo
} from '../api/notes';
import { getPendingParticipants } from '../api/endorsements';
import { PendingParticipant } from '../types/endorsement';
import EndorsementFeedbackModal from '../components/meet/EndorsementFeedbackModal';
import { useLocalBlockDocument } from '../hooks/useLocalBlockDocument';
import { useBlockHistory } from '../hooks/useBlockHistory';
import { BlockType } from '../types/blockDocument';
import BlockRenderer from '../components/meet/CenterPanel/BlockRenderer';
import SortableBlockRenderer from '../components/meet/CenterPanel/SortableBlockRenderer';
import { BlockEditorRef } from '../components/meet/CenterPanel/BlockEditor';
import './styles/NoteDetail.css';
import '../components/meet/styles/BlockBasedNotes.css';

// =============================================================================
// Helper Functions
// =============================================================================

function formatDate(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatDuration(minutes: number): string {
  if (!minutes) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function generateAvatar(name: string | null | undefined): string {
  const safeName = name && name.trim() ? name.trim() : 'U';
  const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
  const colorIndex = safeName.charCodeAt(0) % colors.length;
  const initial = safeName.charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <rect width="32" height="32" fill="${colors[colorIndex]}" rx="16"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-family="Arial" font-size="14" font-weight="bold">${initial}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Extract plain text content from a TipTap node recursively
 */
function extractTextFromNode(node: any): string {
  if (!node) return '';
  if (node.type === 'text' && node.text) return node.text;
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractTextFromNode).join('');
  }
  return '';
}

// =============================================================================
// Component
// =============================================================================

const NoteDetail: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { noteId } = useParams<{ noteId: string }>();
  const { accessToken, user } = useAuth();

  // State
  const [note, setNote] = useState<UserNoteResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null);

  // Selection state
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

  // Editor ref for toolbar
  const editorRef = useRef<BlockEditorRef | null>(null);

  // Undo/Redo state for UI
  const [_historyVersion, setHistoryVersion] = useState(0);

  // Endorsement State
  const [isEndorsementModalOpen, setIsEndorsementModalOpen] = useState(false);
  const [pendingParticipants, setPendingParticipants] = useState<PendingParticipant[]>([]);
  const [hasUnendorsed, setHasUnendorsed] = useState(false);
  const [endorsementLoading, setEndorsementLoading] = useState(false);
  const [isEndorsementCollapsing, setIsEndorsementCollapsing] = useState(false);

  // Block document hook
  const {
    blockOrder,
    blocks,
    isLoading: blocksLoading,
    hasChanges,
    editingBlockId,
    startEditing,
    saveBlock,
    finishEditing,
    cancelEditing,
    addBlock,
    deleteBlock,
    reorderBlocks,
    getContent,
    setContent,
    clearChanges,
    getBlock,
  } = useLocalBlockDocument({
    initialContent: '',
    userId: user?.id || '',
    username: user?.username || '',
  });

  // Block history hook for undo/redo
  const {
    pushAddBlock: historyPushAddBlock,
    pushDeleteBlock: historyPushDeleteBlock,
    trackTextChange,
    flushTextChange,
    undo: historyUndo,
    redo: historyRedo,
    canUndo,
    canRedo,
  } = useBlockHistory({
    onAddBlock: async (type, afterBlockId, content) => {
      const newBlockId = addBlock(type, afterBlockId, content);
      setHistoryVersion(v => v + 1);
      return newBlockId;
    },
    onDeleteBlock: async (blockId) => {
      deleteBlock(blockId);
      setHistoryVersion(v => v + 1);
    },
    onUpdateBlock: (blockId, content) => {
      saveBlock(blockId, content);
      setHistoryVersion(v => v + 1);
    },
    onReorderBlock: async (blockId, afterBlockId) => {
      const targetIndex = afterBlockId === null ? 0 : blockOrder.indexOf(afterBlockId) + 1;
      const currentIndex = blockOrder.indexOf(blockId);
      if (currentIndex !== -1 && currentIndex !== targetIndex) {
        reorderBlocks(currentIndex, targetIndex);
      }
      setHistoryVersion(v => v + 1);
    },
    getBlock: (blockId: string) => getBlock(blockId) ?? undefined,
    getBlockOrder: () => blockOrder,
  });

  // Undo/Redo handlers
  const handleUndo = useCallback(async () => {
    const success = await historyUndo();
    if (success) setHistoryVersion(v => v + 1);
    return success;
  }, [historyUndo]);

  const handleRedo = useCallback(async () => {
    const success = await historyRedo();
    if (success) setHistoryVersion(v => v + 1);
    return success;
  }, [historyRedo]);

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ==========================================================================
  // Data Fetching
  // ==========================================================================
  useEffect(() => {
    const fetchNote = async () => {
      if (!accessToken || !noteId) return;

      setIsLoading(true);
      setError(null);

      try {
        const data = await getNoteEnriched(noteId, accessToken);
        setNote(data);
        setEditedTitle(data.title || '');

        // Set content for block document
        // Always call setContent - the hook handles null/empty gracefully
        setContent(data.content || '');
      } catch (err) {
        console.error('Failed to fetch note:', err);
        setError(t('note_detail_error_fetch'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchNote();
  }, [accessToken, noteId, t, setContent]);

  // ==========================================================================
  // Fetch Endorsement Status
  // ==========================================================================
  useEffect(() => {
    const fetchEndorsementStatus = async () => {
      if (!accessToken || !note?.sessionId) return;

      setEndorsementLoading(true);
      try {
        const response = await getPendingParticipants(note.sessionId, accessToken);
        setPendingParticipants(response.participants);
        const unendorsedExists = response.participants.some(p => !p.alreadyEndorsed);
        setHasUnendorsed(unendorsedExists);
      } catch (err) {
        console.error('Failed to fetch endorsement status:', err);
        setHasUnendorsed(false);
      } finally {
        setEndorsementLoading(false);
      }
    };

    fetchEndorsementStatus();
  }, [accessToken, note?.sessionId]);

  // ==========================================================================
  // Marquee Selection
  // ==========================================================================
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

    if (editingBlockId) {
      finishEditing();
      return;
    }

    const listRect = blockListRef.current?.getBoundingClientRect();
    if (!listRect) return;

    const x = e.clientX - listRect.left;
    const y = e.clientY - listRect.top + (blockListRef.current?.scrollTop || 0);

    setMarqueeStart({ x, y });
    setMarqueeEnd({ x, y });
    setIsMarqueeSelecting(true);
    setSelectedBlockIds(new Set());

    e.preventDefault();
  }, [editingBlockId, finishEditing]);

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

  // ==========================================================================
  // Copy/Paste
  // ==========================================================================
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
        return extractTextFromNode(parsed);
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
        finishEditing();
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
        const newId = addBlock(blockData.type, insertAfter, blockData.content);
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
        addBlock('paragraph', lastBlockId, content);
      }
    } catch (err) {
      console.error('[NoteDetail] Failed to paste:', err);
    }
  }, [selectedBlockIds, blockOrder, addBlock, clearSelection, editingBlockId, finishEditing]);

  // ==========================================================================
  // Keyboard Shortcuts
  // ==========================================================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd + Z - Undo
      if (isCtrlOrCmd && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        flushTextChange();
        handleUndo();
        return;
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y - Redo
      if ((isCtrlOrCmd && e.key === 'z' && e.shiftKey) || (isCtrlOrCmd && e.key === 'y')) {
        e.preventDefault();
        e.stopPropagation();
        handleRedo();
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
          selectedBlockIds.forEach(id => deleteBlock(id));
          clearSelection();
        }
        return;
      }

      // Tab - indent (convert to bullet list)
      // Shift+Tab - outdent (convert to paragraph)
      if (e.key === 'Tab' && selectedBlockIds.size > 0) {
        e.preventDefault();

        const selectedInOrder = blockOrder.filter(id => selectedBlockIds.has(id));

        if (e.shiftKey) {
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
                saveBlock(id, paragraphContent);
              } catch { /* ignore */ }
            }
          });
        } else {
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
                saveBlock(id, bulletContent);
              } catch { /* ignore */ }
            }
          });
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingBlockId, selectedBlockIds, clearSelection, selectAllBlocks, copySelectedBlocks, pasteBlocks, deleteBlock, t, blockOrder, blocks, saveBlock, flushTextChange, handleUndo, handleRedo]);

  // ==========================================================================
  // Block Selection Handler
  // ==========================================================================
  const handleBlockSelect = useCallback((blockId: string, event: React.MouseEvent) => {
    if (event.shiftKey && lastFocusedBlockIdRef.current) {
      // Range selection
      const startIdx = blockOrder.indexOf(lastFocusedBlockIdRef.current);
      const endIdx = blockOrder.indexOf(blockId);
      const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
      const rangeIds = blockOrder.slice(from, to + 1);
      setSelectedBlockIds(new Set(rangeIds));
    } else if (event.metaKey || event.ctrlKey) {
      // Toggle selection
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
      // Single selection
      setSelectedBlockIds(new Set([blockId]));
    }
    lastFocusedBlockIdRef.current = blockId;
  }, [blockOrder]);

  // ==========================================================================
  // Endorsement Handlers
  // ==========================================================================
  const handleOpenEndorsementModal = useCallback(() => {
    setIsEndorsementModalOpen(true);
  }, []);

  const handleCloseEndorsementModal = useCallback(async () => {
    setIsEndorsementModalOpen(false);

    if (accessToken && note?.sessionId) {
      try {
        const response = await getPendingParticipants(note.sessionId, accessToken);
        setPendingParticipants(response.participants);

        const unendorsedExists = response.participants.some(p => !p.alreadyEndorsed);

        if (!unendorsedExists && hasUnendorsed) {
          setIsEndorsementCollapsing(true);
          setTimeout(() => {
            setHasUnendorsed(false);
            setIsEndorsementCollapsing(false);
          }, 400);
        } else {
          setHasUnendorsed(unendorsedExists);
        }
      } catch (err) {
        console.error('Failed to refresh endorsement status:', err);
      }
    }
  }, [accessToken, note?.sessionId, hasUnendorsed]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditedTitle(note?.title || '');
    if (note?.content) {
      setContent(note.content);
    }
    cancelEditing();
  }, [note, setContent, cancelEditing]);

  const handleSave = useCallback(async () => {
    if (!accessToken || !noteId || !note) return;

    setIsSaving(true);
    try {
      const currentContent = getContent();

      if (editedTitle !== note.title) {
        await updateUserNoteTitle(noteId, editedTitle, accessToken);
      }
      await updateUserNoteContent(noteId, currentContent, accessToken);

      const updated = await getNoteEnriched(noteId, accessToken);
      setNote(updated);
      clearChanges();
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save note:', err);
      setError(t('note_detail_error_save'));
    } finally {
      setIsSaving(false);
    }
  }, [accessToken, noteId, note, editedTitle, getContent, clearChanges, t]);

  // ==========================================================================
  // Block Operations
  // ==========================================================================
  const handleStartEditing = useCallback((blockId: string) => {
    if (!isEditing) {
      setIsEditing(true);
    }
    startEditing(blockId);
    lastFocusedBlockIdRef.current = blockId;
    clearSelection();
  }, [isEditing, startEditing, clearSelection]);

  const handleSaveBlock = useCallback((blockId: string, content: string) => {
    saveBlock(blockId, content);
  }, [saveBlock]);

  const handleAutoSave = useCallback((blockId: string, content: string) => {
    trackTextChange(blockId, content);
    saveBlock(blockId, content);
  }, [trackTextChange, saveBlock]);

  const handleDeleteBlock = useCallback((blockId: string) => {
    const currentIndex = blockOrder.indexOf(blockId);
    const prevBlockId = currentIndex > 0 ? blockOrder[currentIndex - 1] : null;

    const blockData = blocks[blockId];
    const afterBlockId = currentIndex > 0 ? blockOrder[currentIndex - 1] : null;

    finishEditing();
    deleteBlock(blockId);

    if (blockData) {
      historyPushDeleteBlock(blockId, blockData, afterBlockId);
    }

    if (prevBlockId) {
      pendingActionRef.current = { type: 'backspace', count: 0 };
      setIsNavigationPending(true);
      setPendingEditBlockId(prevBlockId);
    }
  }, [blockOrder, blocks, finishEditing, deleteBlock, historyPushDeleteBlock]);

  const handleAddBlock = useCallback((type: BlockType, afterBlockId?: string | null) => {
    if (!isEditing) {
      setIsEditing(true);
    }
    const newBlockId = addBlock(type, afterBlockId);
    if (newBlockId) {
      const newBlock = blocks[newBlockId];
      if (newBlock) {
        historyPushAddBlock(newBlockId, newBlock, afterBlockId ?? null);
      }
      setTimeout(() => {
        startEditing(newBlockId);
      }, 50);
    }
    return newBlockId;
  }, [isEditing, addBlock, blocks, historyPushAddBlock, startEditing]);

  const handleSaveAndCreateNext = useCallback((
    content: string,
    nextBlockType: BlockType = 'paragraph',
    nextListStart?: number
  ) => {
    if (editingBlockId) {
      flushTextChange();
      saveBlock(editingBlockId, content);

      let initialContent: string | undefined;
      if (nextBlockType === 'bulletList') {
        initialContent = JSON.stringify({
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }]
        });
      } else if (nextBlockType === 'orderedList') {
        initialContent = JSON.stringify({
          type: 'orderedList',
          attrs: nextListStart ? { start: nextListStart } : undefined,
          content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }]
        });
      } else if (nextBlockType === 'taskList') {
        initialContent = JSON.stringify({
          type: 'taskList',
          content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }]
        });
      }

      finishEditing();
      const newBlockId = addBlock(nextBlockType, editingBlockId, initialContent);
      if (newBlockId) {
        const newBlock = blocks[newBlockId];
        if (newBlock) {
          historyPushAddBlock(newBlockId, newBlock, editingBlockId);
        }
        pendingActionRef.current = { type: 'enter', count: 0 };
        setIsNavigationPending(true);
        setPendingEditBlockId(newBlockId);
      }
    }
  }, [editingBlockId, saveBlock, finishEditing, addBlock, blocks, historyPushAddBlock, flushTextChange]);

  const handleMoveToPrevBlock = useCallback(() => {
    if (!editingBlockId) return;
    const currentIndex = blockOrder.indexOf(editingBlockId);
    if (currentIndex > 0) {
      finishEditing();
      pendingActionRef.current = { type: 'arrowUp', count: 0 };
      setIsNavigationPending(true);
      setPendingEditBlockId(blockOrder[currentIndex - 1]);
    }
  }, [editingBlockId, blockOrder, finishEditing]);

  const handleMoveToNextBlock = useCallback(() => {
    if (!editingBlockId) return;
    const currentIndex = blockOrder.indexOf(editingBlockId);
    if (currentIndex < blockOrder.length - 1) {
      finishEditing();
      pendingActionRef.current = { type: 'arrowDown', count: 0 };
      setIsNavigationPending(true);
      setPendingEditBlockId(blockOrder[currentIndex + 1]);
    }
  }, [editingBlockId, blockOrder, finishEditing]);

  // ==========================================================================
  // Pending Navigation System
  // ==========================================================================
  const isBlockEmpty = useCallback((blockId: string): boolean => {
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
  }, [blocks]);

  const clearPendingState = useCallback(() => {
    pendingActionRef.current = null;
    setIsNavigationPending(false);
    setPendingEditBlockId(null);
  }, []);

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
          startEditing(blockId);
        }
        clearPendingState();
        return;
      }

      action.count--;

      if (editingBlockId === blockId) {
        finishEditing();
      }

      switch (action.type) {
        case 'enter':
          try {
            const newBlockId = addBlock('paragraph', blockId);
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
          if (isBlockEmpty(blockId) && blockOrder.length > 1) {
            const prevBlockId = currentIndex > 0 ? blockOrder[currentIndex - 1] : null;
            deleteBlock(blockId);
            if (!cancelled && prevBlockId) {
              setPendingEditBlockId(prevBlockId);
            } else if (!cancelled) {
              clearPendingState();
            }
          } else {
            if (editingBlockId !== blockId) {
              startEditing(blockId);
            }
            clearPendingState();
          }
          break;

        case 'arrowUp': {
          const prevBlockId = currentIndex > 0 ? blockOrder[currentIndex - 1] : null;
          if (!cancelled && prevBlockId) {
            setPendingEditBlockId(prevBlockId);
          } else if (!cancelled) {
            if (editingBlockId !== blockId) startEditing(blockId);
            clearPendingState();
          }
          break;
        }

        case 'arrowDown': {
          const nextBlockId = currentIndex < blockOrder.length - 1 ? blockOrder[currentIndex + 1] : null;
          if (!cancelled && nextBlockId) {
            setPendingEditBlockId(nextBlockId);
          } else if (!cancelled) {
            if (editingBlockId !== blockId) startEditing(blockId);
            clearPendingState();
          }
          break;
        }
      }
    };

    handlePendingEdit();

    return () => { cancelled = true; };
  }, [pendingEditBlockId, blocks, blockOrder, editingBlockId, startEditing, finishEditing, addBlock, deleteBlock, isBlockEmpty, clearPendingState]);

  // Global key handler for block transitions
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

  // ==========================================================================
  // Drag Handlers
  // ==========================================================================
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

    const activeIndex = blockOrder.indexOf(active.id as string);
    const overIndex = blockOrder.indexOf(over.id as string);

    if (activeIndex !== overIndex) {
      reorderBlocks(activeIndex, overIndex);
    }
  }, [blockOrder, reorderBlocks]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  // Multi-drag collision detection
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

  // ==========================================================================
  // Participants List (memoized)
  // ==========================================================================
  const participantsList = useMemo(() => {
    if (!note?.participants || note.participants.length === 0) {
      return null;
    }

    return (
      <div className="note-detail-participants">
        <div className="note-detail-participants-header">
          <FiUsers />
          <span>{t('note_detail_participants_label')}</span>
        </div>
        <div className="note-detail-participants-list">
          {note.participants.map((participant: ParticipantInfo) => (
            <div key={participant.id} className="note-detail-participant">
              <img
                src={participant.photoUrl || generateAvatar(participant.username)}
                alt={participant.username}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = generateAvatar(participant.username);
                }}
              />
              <div className="note-detail-participant-info">
                <span className="note-detail-participant-name">
                  {participant.username}
                </span>
                {participant.rating !== null && participant.rating > 0 && (
                  <span className="note-detail-participant-rating">
                    <FiStar size={12} /> {participant.rating}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }, [note?.participants, t]);

  // ==========================================================================
  // Toolbar
  // ==========================================================================
  const toolbarActions = useMemo(() => {
    if (!isEditing) return null;

    const toggleBold = () => editorRef.current?.editor?.chain().focus().toggleBold().run();
    const toggleItalic = () => editorRef.current?.editor?.chain().focus().toggleItalic().run();
    const toggleBulletList = () => editorRef.current?.editor?.chain().focus().toggleBulletList().run();
    const toggleCodeBlock = () => editorRef.current?.editor?.chain().focus().toggleCodeBlock().run();

    return (
      <div className="note-detail-block-toolbar">
        <button
          onClick={handleUndo}
          disabled={!canUndo()}
          title="Undo (Ctrl+Z)"
          className={!canUndo() ? 'disabled' : ''}
        >
          <FiRotateCcw />
        </button>
        <button
          onClick={handleRedo}
          disabled={!canRedo()}
          title="Redo (Ctrl+Shift+Z)"
          className={!canRedo() ? 'disabled' : ''}
        >
          <FiRotateCw />
        </button>
        <div className="toolbar-divider" />
        <button onClick={toggleBold} title="Bold (Ctrl+B)">
          <FiBold />
        </button>
        <button onClick={toggleItalic} title="Italic (Ctrl+I)">
          <FiItalic />
        </button>
        <button onClick={toggleBulletList} title="Bullet List">
          <FiList />
        </button>
        <button onClick={toggleCodeBlock} title="Code Block">
          <FiCode />
        </button>
        <div className="toolbar-divider" />
        <button onClick={() => handleAddBlock('paragraph')} title="Add Block">
          <FiPlus />
        </button>
      </div>
    );
  }, [isEditing, handleAddBlock, handleUndo, handleRedo, canUndo, canRedo]);

  // ==========================================================================
  // Render: Loading States
  // ==========================================================================
  if (!accessToken) {
    return (
      <div className="note-detail-page">
        <div className="note-detail-login-required">
          <FiBook size={64} />
          <h2>{t('notes_login_required')}</h2>
          <button className="note-detail-login-btn" onClick={() => navigate('/login')}>
            {t('notes_login_button')}
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || blocksLoading) {
    return (
      <div className="note-detail-page">
        <div className="note-detail-loading">
          <div className="note-detail-spinner" />
          <p>{t('note_detail_loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="note-detail-page">
        <div className="note-detail-error">
          <FiBook size={48} />
          <h3>{t('note_detail_error_title')}</h3>
          <p>{error || t('note_detail_not_found')}</p>
          <button onClick={() => navigate('/notes')}>{t('note_detail_back')}</button>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // Render: Main Content
  // ==========================================================================
  return (
    <div className="note-detail-page note-detail-three-column">
      {/* Header */}
      <header className="note-detail-header">
        <button className="note-detail-back-btn" onClick={() => navigate('/notes')}>
          <FiArrowLeft />
          {t('note_detail_back')}
        </button>

        <div className="note-detail-actions">
          {isEditing ? (
            <>
              <button
                className="note-detail-cancel-btn"
                onClick={handleCancel}
                disabled={isSaving}
              >
                {t('note_detail_cancel')}
              </button>
              <button
                className="note-detail-save-btn"
                onClick={handleSave}
                disabled={isSaving}
              >
                <FiSave />
                {isSaving ? t('note_detail_saving') : t('note_detail_save')}
              </button>
            </>
          ) : (
            <button
              className="note-detail-edit-btn"
              onClick={() => setIsEditing(true)}
            >
              <FiEdit3 />
              {t('note_detail_edit')}
            </button>
          )}
        </div>
      </header>

      {/* Main Content - 3 Column Layout */}
      <main className="note-detail-main-three-col">
        {/* Left Panel: Book Info + Speaking Logs */}
        <aside className="note-detail-left-panel">
          {/* Book Info Section */}
          <div className="note-detail-left-top">
            {/* Book Cover */}
            {(note.bookCover?.medium || note.bookCover?.small) && (
              <div className="note-detail-cover">
                <img src={note.bookCover?.medium || note.bookCover?.small} alt={note.bookTitle} />
              </div>
            )}

            {/* Book Info */}
            <div className="note-detail-book-info">
              <h3>{note.bookTitle}</h3>
              <p className="note-detail-author">{note.bookAuthor}</p>
              {note.bookGenre && (
                <span className="note-detail-genre">{note.bookGenre}</span>
              )}
            </div>

            {/* Meeting Info */}
            <div className="note-detail-meeting-info">
              <div className="note-detail-info-item">
                <FiCalendar />
                <span>{formatDate(note.meetingDate)}</span>
              </div>
              <div className="note-detail-info-item">
                <FiUsers />
                <span>{note.participantCount} {t('note_detail_participants')}</span>
              </div>
              <div className="note-detail-info-item">
                <FiClock />
                <span>{formatDuration(note.duration)}</span>
              </div>
            </div>

            {/* Host Info */}
            <div className="note-detail-host">
              <div className="note-detail-host-header">
                <FiUser />
                <span>{t('note_detail_host')}</span>
              </div>
              <div className="note-detail-host-content">
                <img
                  src={note.hostPhotoUrl || generateAvatar(note.hostUsername)}
                  alt={note.hostUsername}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = generateAvatar(note.hostUsername);
                  }}
                />
                <div className="note-detail-host-info">
                  <span className="note-detail-host-name">{note.hostUsername}</span>
                  {note.hostRating > 0 && (
                    <span className="note-detail-host-rating">
                      <FiStar size={12} /> {note.hostRating}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Participants List */}
            {participantsList}
          </div>

          {/* Speaking Logs Section (Bottom) */}
          <div className="note-detail-left-bottom">
            <div className="note-detail-speaking-logs">
              <div className="note-detail-section-header">
                <FiMessageSquare />
                <span>{t('note_detail_speaking_logs') || 'Speaking Logs'}</span>
              </div>
              <div className="note-detail-speaking-logs-content">
                <div className="note-detail-placeholder">
                  <FiMic size={32} />
                  <p>{t('note_detail_no_speaking_logs') || 'No speaking logs available'}</p>
                  <span className="note-detail-coming-soon">{t('note_detail_coming_soon') || 'Coming Soon'}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Center Panel: Block-based Notes */}
        <section className="note-detail-center-panel">
          {/* Title */}
          {isEditing ? (
            <input
              type="text"
              className="note-detail-title-input"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              placeholder={t('note_detail_title_placeholder')}
            />
          ) : (
            <h1 className="note-detail-title">{note.title}</h1>
          )}

          {/* Toolbar */}
          {toolbarActions}

          {/* Block List */}
          <div
            ref={blockListRef}
            className="note-detail-blocks"
            onMouseDown={handleMarqueeMouseDown}
          >
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
                {blockOrder.map((blockId) => {
                  const block = blocks[blockId];
                  if (!block) return null;

                  const isSelected = selectedBlockIds.has(blockId);
                  const isPartOfMultiDrag = activeId !== null && selectedBlockIds.has(blockId) && blockId !== activeId && selectedBlockIds.size > 1;

                  return (
                    <SortableBlockRenderer
                      key={blockId}
                      block={block}
                      isEditing={editingBlockId === blockId}
                      isLocked={false}
                      isLockedByMe={false}
                      lockInfo={null}
                      currentUserId={user?.id || ''}
                      isSelected={isSelected}
                      onSelect={(e) => handleBlockSelect(blockId, e)}
                      isPartOfMultiDrag={isPartOfMultiDrag}
                      skipKeyboardNavigation={isNavigationPending}
                      onStartEdit={() => handleStartEditing(blockId)}
                      onSaveEdit={(content) => handleSaveBlock(blockId, content)}
                      onAutoSave={(content) => handleAutoSave(blockId, content)}
                      onCancelEdit={cancelEditing}
                      onDelete={() => handleDeleteBlock(blockId)}
                      onMoveToPrevBlock={handleMoveToPrevBlock}
                      onMoveToNextBlock={handleMoveToNextBlock}
                      onCreateBlockAfter={(type) => handleAddBlock(type, blockId)}
                      onSaveAndCreateNext={handleSaveAndCreateNext}
                      editorRef={editingBlockId === blockId ? editorRef : undefined}
                    />
                  );
                })}
              </SortableContext>

              {/* Drag Overlay */}
              <DragOverlay>
                {activeId && blocks[activeId] ? (
                  <BlockRenderer
                    block={blocks[activeId]}
                    isEditing={false}
                    isLocked={false}
                    isLockedByMe={false}
                    lockInfo={null}
                    currentUserId={user?.id || ''}
                    onStartEdit={() => {}}
                    onSaveEdit={() => {}}
                    onCancelEdit={() => {}}
                    onDelete={() => {}}
                    onCreateBlockAfter={() => {}}
                    isDragging
                  />
                ) : null}
              </DragOverlay>
            </DndContext>

            {/* Marquee Selection Box */}
            {isMarqueeSelecting && marqueeStart && marqueeEnd && (
              <div
                className="marquee-selection-box"
                style={{
                  left: Math.min(marqueeStart.x, marqueeEnd.x),
                  top: Math.min(marqueeStart.y, marqueeEnd.y),
                  width: Math.abs(marqueeEnd.x - marqueeStart.x),
                  height: Math.abs(marqueeEnd.y - marqueeStart.y),
                }}
              />
            )}

            {/* Add Block Button */}
            {isEditing && (
              <button
                className="note-detail-add-block-btn"
                onClick={() => handleAddBlock('paragraph')}
              >
                <FiPlus />
                {t('note_detail_add_block') || 'Add Block'}
              </button>
            )}
          </div>

          {/* Change indicator */}
          {hasChanges && (
            <div className="note-detail-unsaved-indicator">
              {t('note_detail_unsaved_changes') || 'Unsaved changes'}
            </div>
          )}
        </section>

        {/* Right Panel: AI Summary + Transcription */}
        <aside className="note-detail-right-panel">
          {/* AI Summary Section */}
          <div className="note-detail-ai-summary-section">
            <div className="note-detail-section-header">
              <FiCpu />
              <span>{t('note_detail_ai_summary') || 'AI Summary'}</span>
            </div>

            {note.aiSummary ? (
              <div className="note-detail-ai-summary-content">
                <p className="note-detail-one-liner">{note.aiSummary.oneLiner}</p>

                {note.aiSummary.keyPoints && note.aiSummary.keyPoints.length > 0 && (
                  <div className="note-detail-keypoints">
                    <span>{t('notes_key_points')}</span>
                    <ul>
                      {note.aiSummary.keyPoints.map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {note.aiSummary.quotes && note.aiSummary.quotes.length > 0 && (
                  <div className="note-detail-quotes">
                    <span>{t('note_detail_quotes') || 'Notable Quotes'}</span>
                    <ul>
                      {note.aiSummary.quotes.map((quote, idx) => (
                        <li key={idx}>"{quote}"</li>
                      ))}
                    </ul>
                  </div>
                )}

                {note.aiSummary.openQuestions && note.aiSummary.openQuestions.length > 0 && (
                  <div className="note-detail-questions">
                    <span>{t('note_detail_open_questions') || 'Open Questions'}</span>
                    <ul>
                      {note.aiSummary.openQuestions.map((q, idx) => (
                        <li key={idx}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="note-detail-placeholder">
                <FiCpu size={32} />
                <p>{t('note_detail_no_ai_summary') || 'No AI summary available'}</p>
              </div>
            )}
          </div>

          {/* AI Transcription Section */}
          <div className="note-detail-ai-transcription-section">
            <div className="note-detail-section-header">
              <FiMic />
              <span>{t('note_detail_ai_transcription') || 'AI Transcription'}</span>
            </div>
            <div className="note-detail-transcription-content">
              <div className="note-detail-placeholder">
                <FiMic size={32} />
                <p>{t('note_detail_no_transcription') || 'No transcription available'}</p>
                <span className="note-detail-coming-soon">{t('note_detail_coming_soon') || 'Coming Soon'}</span>
              </div>
            </div>
          </div>

          {/* Endorsement Section */}
          {!endorsementLoading && (hasUnendorsed || isEndorsementCollapsing) && (
            <div className={`note-detail-endorsement ${isEndorsementCollapsing ? 'collapsing' : ''}`}>
              <div className="note-detail-endorsement-header">
                <FiAward />
                <span>{t('note_detail_endorsement_title') || 'Rate Participants'}</span>
              </div>
              <p className="note-detail-endorsement-desc">
                {t('note_detail_endorsement_desc') || "You haven't rated all participants yet."}
              </p>
              <div className="note-detail-endorsement-pending">
                {pendingParticipants
                  .filter(p => !p.alreadyEndorsed)
                  .slice(0, 3)
                  .map((p, idx) => (
                    <div key={p.userId} className="endorsement-pending-avatar" style={{ zIndex: 10 - idx }}>
                      {p.photoUrl ? (
                        <img src={p.photoUrl} alt={p.username} />
                      ) : (
                        <div className="endorsement-pending-default">
                          {p.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  ))}
                {pendingParticipants.filter(p => !p.alreadyEndorsed).length > 3 && (
                  <span className="endorsement-pending-more">
                    +{pendingParticipants.filter(p => !p.alreadyEndorsed).length - 3}
                  </span>
                )}
              </div>
              <button
                className="note-detail-endorsement-btn"
                onClick={handleOpenEndorsementModal}
              >
                <FiAward size={16} />
                {t('note_detail_endorsement_button') || 'Rate Now'}
              </button>
            </div>
          )}
        </aside>
      </main>

      {/* Endorsement Modal */}
      {note?.sessionId && (
        <EndorsementFeedbackModal
          isOpen={isEndorsementModalOpen}
          onClose={handleCloseEndorsementModal}
          sessionId={note.sessionId}
        />
      )}
    </div>
  );
};

export default NoteDetail;
