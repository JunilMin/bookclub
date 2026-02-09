/**
 * BlockBasedNotes - Main container for block-based collaborative notes
 *
 * Uses Block List as SSOT architecture:
 * - Each block is independently editable with lock-based concurrency
 * - TipTap is used only for editing individual blocks
 * - Drag-and-drop reordering operates on block order array
 * - Toolbar appears at top when editing a block
 * - Includes AI tab for organized notes
 *
 * Block editing UI is delegated to BlockEditorCore for both Free Notes and AI tabs.
 */

import React, { useState, useCallback, useMemo, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiUser,
  FiCheck,
  FiCloud,
  FiWifi,
  FiWifiOff,
  FiEdit2,
  FiFileText,
  FiCpu,
  FiLoader,
} from 'react-icons/fi';
import { useBlockDocument } from '../../../hooks/useBlockDocument';
import { useBlockHistory } from '../../../hooks/useBlockHistory';
import { Block, BlockType, RemoteBlockUser } from '../../../types/blockDocument';
import { BlockEditorRef } from './BlockEditor';
import BlockEditorCore from './BlockEditorCore';
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

    // Editor ref for toolbar control (for free notes)
    const editorRef = useRef<BlockEditorRef | null>(null);
    // Editor ref for AI notes
    const aiEditorRef = useRef<BlockEditorRef | null>(null);

    // Track if we've synced AI content to blocks
    const aiContentSyncedRef = useRef<string | null>(null);

    // Version editing state (for editing AI version blocks via REST API)
    const [versionEditingBlockId, setVersionEditingBlockId] = useState<string | null>(null);

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
      updateLocalContent,
      isBlockLocked,
      isBlockLockedByMe,
      getBlockLockInfo,
    } = useBlockDocument({
      docId,
      userId,
      username,
      photoUrl,
    });

    // Ref to always access latest blocks (avoids stale closure in setTimeout)
    const blocksRef = useRef(blocks);
    blocksRef.current = blocks;

    // Ref to track editing block ID for undo/redo editor updates
    const editingBlockIdRef = useRef(editingBlockId);
    editingBlockIdRef.current = editingBlockId;

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

    // ============================================
    // Undo/Redo History (Free Notes only)
    // ============================================

    const [_historyVersion, setHistoryVersion] = useState(0);

    const getBlockById = useCallback((blockId: string): Block | undefined => {
      return blocks[blockId];
    }, [blocks]);

    const getBlockOrderFn = useCallback((): string[] => {
      return blockOrder;
    }, [blockOrder]);

    const {
      pushAddBlock: historyPushAddBlock,
      pushDeleteBlock: historyPushDeleteBlock,
      pushReorderBlock: historyPushReorderBlock,
      trackTextChange,
      flushTextChange,
      undo: historyUndo,
      redo: historyRedo,
      canUndo,
      canRedo,
      clearHistory: _clearHistory,
    } = useBlockHistory({
      onAddBlock: async (type, afterBlockId, content) => {
        const newBlockId = await addBlock(type, afterBlockId, content);
        setHistoryVersion(v => v + 1);
        return newBlockId;
      },
      onDeleteBlock: async (blockId) => {
        await deleteBlock(blockId);
        setHistoryVersion(v => v + 1);
      },
      onUpdateBlock: (blockId, content) => {
        updateLocalContent(blockId, content);
        broadcastContent(blockId, content);
        if (editingBlockIdRef.current === blockId && editorRef.current?.editor) {
          try {
            const parsed = JSON.parse(content);
            const docContent = parsed.type === 'doc' ? parsed : { type: 'doc', content: [parsed] };
            editorRef.current.editor.commands.setContent(docContent);
          } catch { /* ignore parse errors */ }
        }
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
      getBlock: getBlockById,
      getBlockOrder: getBlockOrderFn,
    });

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

    // ============================================
    // AI Content Sync
    // ============================================

    useEffect(() => {
      if (!aiContent || !aiAddBlock || !aiClearAllBlocks) return;

      const contentHash = typeof aiContent === 'string' ? aiContent : JSON.stringify(aiContent);
      if (aiContentSyncedRef.current === contentHash) return;

      const syncAiContentToBlocks = async () => {
        try {
          const parsedContent = typeof aiContent === 'string' ? JSON.parse(aiContent) : aiContent;

          if (!parsedContent.content || !Array.isArray(parsedContent.content)) {
            console.warn('[AI Notes] Invalid TipTap content structure');
            return;
          }

          await aiClearAllBlocks();

          let lastBlockId: string | null = null;
          for (const node of parsedContent.content) {
            const blockType = (node.type || 'paragraph') as BlockType;
            const blockContent = JSON.stringify(node);

            const newBlockId = await aiAddBlock(blockType, lastBlockId, blockContent);
            if (newBlockId) {
              lastBlockId = newBlockId;
            }
          }

          aiContentSyncedRef.current = contentHash;
        } catch (err) {
          console.error('[AI Notes] Failed to sync content to blocks:', err);
        }
      };

      syncAiContentToBlocks();
    }, [aiContent, aiAddBlock, aiClearAllBlocks]);

    // ============================================
    // Free Notes Handlers (for BlockEditorCore)
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
      (blockId: string, content: string) => {
        saveBlock(blockId, content);
        finishEditing();
      },
      [saveBlock, finishEditing]
    );

    const handleAutoSave = useCallback(
      (blockId: string, content: string) => {
        trackTextChange(blockId, content);
        broadcastContent(blockId, content);
      },
      [broadcastContent, trackTextChange]
    );

    const handleCancelEdit = useCallback(() => {
      cancelEditing();
    }, [cancelEditing]);

    const handleDeleteBlock = useCallback(
      async (blockId: string) => {
        const currentIndex = blockOrder.indexOf(blockId);
        const blockData = blocksRef.current[blockId] || blocks[blockId];
        const afterBlockId = currentIndex > 0 ? blockOrder[currentIndex - 1] : null;

        finishEditing();
        const deleted = await deleteBlock(blockId);

        if (deleted !== false && blockData) {
          historyPushDeleteBlock(blockId, blockData, afterBlockId);
        }
      },
      [blockOrder, blocks, finishEditing, deleteBlock, historyPushDeleteBlock]
    );

    const handleAddBlock = useCallback(
      async (type: BlockType, afterBlockId?: string | null, initialContent?: string) => {
        const newBlockId = await addBlock(type, afterBlockId, initialContent, { startEditing: true });

        if (newBlockId) {
          setTimeout(() => {
            const newBlock = blocksRef.current[newBlockId];
            if (newBlock) {
              historyPushAddBlock(newBlockId, newBlock, afterBlockId ?? null);
            }
          }, 100);
        }

        return newBlockId;
      },
      [addBlock, historyPushAddBlock]
    );

    const handleSaveAndCreateNext = useCallback(
      async (blockId: string, content: string, nextBlockType?: BlockType, nextListStart?: number) => {
        flushTextChange();
        saveBlock(blockId, content);

        const blockType = nextBlockType || 'paragraph';

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

        const newBlockId = await addBlock(blockType, blockId, initialContent, { startEditing: true });

        if (newBlockId) {
          setTimeout(() => {
            const newBlock = blocksRef.current[newBlockId];
            if (newBlock) {
              historyPushAddBlock(newBlockId, newBlock, blockId);
            }
          }, 100);
        }
      },
      [saveBlock, addBlock, flushTextChange, historyPushAddBlock]
    );

    const handleMoveToPrevBlock = useCallback(
      (blockId: string) => {
        const currentIndex = blockOrder.indexOf(blockId);
        if (currentIndex > 0) {
          finishEditing();
        }
      },
      [blockOrder, finishEditing]
    );

    const handleMoveToNextBlock = useCallback(
      (blockId: string) => {
        const currentIndex = blockOrder.indexOf(blockId);
        if (currentIndex < blockOrder.length - 1) {
          finishEditing();
        }
      },
      [blockOrder, finishEditing]
    );

    const handleDeleteSelectedBlocks = useCallback(
      (blockIds: string[]) => {
        for (const id of [...blockIds].reverse()) {
          const blockData = blocksRef.current[id] || blocks[id];
          const idx = blockOrder.indexOf(id);
          const afterBlockId = idx > 0 ? blockOrder[idx - 1] : null;
          finishEditing();
          deleteBlock(id);
          if (blockData) {
            historyPushDeleteBlock(id, blockData, afterBlockId);
          }
        }
      },
      [blockOrder, blocks, finishEditing, deleteBlock, historyPushDeleteBlock]
    );

    // ============================================
    // AI Tab Handlers (for BlockEditorCore)
    // ============================================

    const isEditingVersion = !!aiVersionData && selectedAiVersion !== null;

    const handleAiStartEdit = useCallback(
      async (blockId: string) => {
        if (isEditingVersion) {
          setVersionEditingBlockId(blockId);
          return true;
        }
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
          await onAiVersionBlockUpdate(selectedAiVersion, blockId, content);
          setVersionEditingBlockId(null);
        } else {
          await aiSaveBlock(blockId, content);
          aiFinishEditing();
        }
      },
      [aiSaveBlock, aiFinishEditing, isEditingVersion, onAiVersionBlockUpdate, selectedAiVersion]
    );

    const handleAiAutoSave = useCallback(
      (blockId: string, content: string) => {
        if (isEditingVersion && onAiVersionBlockUpdate && selectedAiVersion !== null) {
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

    const handleAiFinishEditing = useCallback(() => {
      if (isEditingVersion) {
        setVersionEditingBlockId(null);
      } else {
        aiFinishEditing();
      }
    }, [aiFinishEditing, isEditingVersion]);

    const handleAiDeleteBlock = useCallback(
      async (blockId: string) => {
        if (isEditingVersion) {
          setVersionEditingBlockId(null);
        } else {
          aiFinishEditing();
        }

        if (isEditingVersion && onAiVersionBlockDelete && selectedAiVersion !== null) {
          await onAiVersionBlockDelete(selectedAiVersion, blockId);
        } else {
          await aiDeleteBlock(blockId);
        }
      },
      [isEditingVersion, aiFinishEditing, onAiVersionBlockDelete, selectedAiVersion, aiDeleteBlock]
    );

    const handleAiAddBlock = useCallback(
      async (type: BlockType, afterBlockId?: string | null, initialContent?: string) => {
        if (isEditingVersion && onAiVersionBlockAdd && selectedAiVersion !== null) {
          const contentToUse = initialContent || JSON.stringify({
            type: type,
            content: type === 'paragraph' ? [{ type: 'text', text: '' }] : []
          });
          const newBlockId = await onAiVersionBlockAdd(selectedAiVersion, type, contentToUse, afterBlockId || null);
          if (newBlockId) {
            setTimeout(() => {
              setVersionEditingBlockId(newBlockId);
            }, 100);
          }
          return newBlockId;
        } else {
          const newBlockId = await aiAddBlock(type, afterBlockId, initialContent, { startEditing: true });
          return newBlockId;
        }
      },
      [aiAddBlock, isEditingVersion, onAiVersionBlockAdd, selectedAiVersion]
    );

    const handleAiSaveAndCreateNext = useCallback(
      async (blockId: string, content: string, nextBlockType?: BlockType, nextListStart?: number) => {
        await handleAiSaveEdit(blockId, content);

        const blockOrderToUse = aiVersionData?.blockOrder || aiBlockOrder;
        const blocksToUse = aiVersionData?.blocks || aiBlocks;

        const currentIndex = blockOrderToUse.indexOf(blockId);
        const nextExistingBlockId = currentIndex >= 0 && currentIndex < blockOrderToUse.length - 1
          ? blockOrderToUse[currentIndex + 1]
          : null;

        // Check if next block is empty
        if (nextExistingBlockId) {
          const block = blocksToUse[nextExistingBlockId];
          if (block) {
            try {
              const parsed = JSON.parse(block.content);
              const isEmpty = !parsed.content || parsed.content.length === 0 ||
                (parsed.content.length === 1 && (!parsed.content[0].content || parsed.content[0].content.length === 0 ||
                  (parsed.content[0].content.length === 1 && parsed.content[0].content[0].type === 'text' && !(parsed.content[0].content[0].text || '').trim())));
              if (isEmpty) {
                handleAiStartEdit(nextExistingBlockId);
                return;
              }
            } catch { /* continue to create new block */ }
          }
        }

        const blockType = nextBlockType || 'paragraph';

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

        await handleAiAddBlock(blockType, blockId, initialContent);
      },
      [handleAiSaveEdit, handleAiAddBlock, handleAiStartEdit, aiVersionData, aiBlockOrder, aiBlocks]
    );

    const handleAiMoveToPrevBlock = useCallback(
      (blockId: string) => {
        const blockOrderToUse = aiVersionData?.blockOrder || aiBlockOrder;
        const currentIndex = blockOrderToUse.indexOf(blockId);
        if (currentIndex > 0) {
          handleAiFinishEditing();
        }
      },
      [aiVersionData?.blockOrder, aiBlockOrder, handleAiFinishEditing]
    );

    const handleAiMoveToNextBlock = useCallback(
      (blockId: string) => {
        const blockOrderToUse = aiVersionData?.blockOrder || aiBlockOrder;
        const currentIndex = blockOrderToUse.indexOf(blockId);
        if (currentIndex < blockOrderToUse.length - 1) {
          handleAiFinishEditing();
        }
      },
      [aiVersionData?.blockOrder, aiBlockOrder, handleAiFinishEditing]
    );

    const handleAiDeleteSelectedBlocks = useCallback(
      (blockIds: string[]) => {
        blockIds.forEach(id => {
          if (isEditingVersion && onAiVersionBlockDelete && selectedAiVersion !== null) {
            onAiVersionBlockDelete(selectedAiVersion, id);
          } else {
            aiDeleteBlock(id);
          }
        });
      },
      [isEditingVersion, onAiVersionBlockDelete, selectedAiVersion, aiDeleteBlock]
    );

    // Effective AI data
    const effectiveAiBlockOrder = aiVersionData?.blockOrder || aiBlockOrder;
    const effectiveAiBlocks = (aiVersionData?.blocks || aiBlocks) as Record<string, Block>;
    const effectiveAiEditingBlockId = isEditingVersion ? versionEditingBlockId : aiEditingBlockId;
    const hasAiContent = effectiveAiBlockOrder.length > 0 || aiVersions.length > 0;

    // No-op undo/redo for AI tab (no history tracking)
    const aiNoopUndo = useCallback(async () => false, []);
    const aiNoopRedo = useCallback(async () => false, []);
    const aiNoopCanUndo = useCallback(() => false, []);
    const aiNoopCanRedo = useCallback(() => false, []);
    const aiNoopFlush = useCallback(() => {}, []);

    // ============================================
    // Title Editing
    // ============================================

    const handleTitleDoubleClick = () => {
      setIsEditingTitle(true);
      setTempTitle(_blockDocument?.title || initialTitle);
    };

    const handleTitleSave = async () => {
      setIsEditingTitle(false);
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleTitleSave();
      } else if (e.key === 'Escape') {
        setIsEditingTitle(false);
        setTempTitle(_blockDocument?.title || initialTitle);
      }
    };

    // ============================================
    // Content Insertion Helpers
    // ============================================

    const insertContentAtEnd = useCallback(async (content: any) => {
      if (!content) return;

      let lastInsertedId: string | null = blockOrder[blockOrder.length - 1] || null;

      const isSingleBlockNode = content.type &&
        ['utteranceBlock', 'heading', 'blockquote', 'codeBlock'].includes(content.type);

      if (isSingleBlockNode) {
        const type = content.type as BlockType;
        const blockContent = JSON.stringify(content);
        await addBlock(type, lastInsertedId, blockContent);
        return;
      }

      const nodes = content.content || (Array.isArray(content) ? content : [content]);

      for (const node of nodes) {
        const type = (node.type || 'paragraph') as BlockType;
        const blockContent = JSON.stringify(node);

        const newBlockId = await addBlock(type, lastInsertedId, blockContent);
        if (newBlockId) {
          lastInsertedId = newBlockId;
        }
      }
    }, [blockOrder, addBlock]);

    const insertTranscription = useCallback(async (content: string | any, sectionTitle?: string) => {
      let lastInsertedId: string | null = blockOrder[blockOrder.length - 1] || null;

      if (sectionTitle) {
        const hasTranscriptionHeading = blockOrder.some(blockId => {
          const block = blocks[blockId];
          if (!block) return false;
          try {
            const parsed = JSON.parse(block.content);
            if (parsed.type === 'heading' && parsed.content?.[0]?.text === sectionTitle) {
              return true;
            }
          } catch { /* ignore */ }
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

      if (typeof content === 'object' && content !== null) {
        const blockContent = JSON.stringify(content);
        const blockType = (content.type || 'paragraph') as BlockType;
        await addBlock(blockType, lastInsertedId, blockContent);
      } else {
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
                  {_blockDocument?.title || initialTitle}
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
            {RemoteUserAvatars}

            <span
              className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}
            >
              {isConnected ? <FiWifi size={14} /> : <FiWifiOff size={14} />}
            </span>

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
            <BlockEditorCore
              blockOrder={blockOrder}
              blocks={blocks}
              editingBlockId={editingBlockId}
              currentUserId={userId}
              onStartEdit={handleStartEdit}
              onSaveEdit={handleSaveEdit}
              onAutoSave={handleAutoSave}
              onCancelEdit={handleCancelEdit}
              onFinishEditing={finishEditing}
              onDeleteBlock={handleDeleteBlock}
              onAddBlock={handleAddBlock}
              onSaveAndCreateNext={handleSaveAndCreateNext}
              onMoveToPrevBlock={handleMoveToPrevBlock}
              onMoveToNextBlock={handleMoveToNextBlock}
              onReorderBlocks={reorderBlocks}
              onReorderMultiple={reorderMultiple}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={canUndo}
              canRedo={canRedo}
              flushTextChange={flushTextChange}
              onDeleteSelectedBlocks={handleDeleteSelectedBlocks}
              onSaveBlock={(id, content) => saveBlock(id, content)}
              onHistoryPushReorder={historyPushReorderBlock}
              isBlockLocked={isBlockLocked}
              isBlockLockedByMe={isBlockLockedByMe}
              getBlockLockInfo={getBlockLockInfo}
              editorRef={editorRef}
              t={t}
            />
            {!isConnected && (
              <span className="offline-warning">
                {t('meet_offline_warning') ||
                  'Offline - changes will sync when reconnected'}
              </span>
            )}
          </>
        )}

        {/* AI Notes Tab Content */}
        {activeTab === 'ai' && (
          <>
            {hasAiContent || aiContent ? (
              <>
                <BlockEditorCore
                  blockOrder={effectiveAiBlockOrder}
                  blocks={effectiveAiBlocks}
                  editingBlockId={effectiveAiEditingBlockId}
                  currentUserId={userId}
                  onStartEdit={handleAiStartEdit}
                  onSaveEdit={handleAiSaveEdit}
                  onAutoSave={handleAiAutoSave}
                  onCancelEdit={handleAiCancelEdit}
                  onFinishEditing={handleAiFinishEditing}
                  onDeleteBlock={handleAiDeleteBlock}
                  onAddBlock={handleAiAddBlock}
                  onSaveAndCreateNext={handleAiSaveAndCreateNext}
                  onMoveToPrevBlock={handleAiMoveToPrevBlock}
                  onMoveToNextBlock={handleAiMoveToNextBlock}
                  onReorderBlocks={aiReorderBlocks}
                  onReorderMultiple={() => {}}
                  onUndo={aiNoopUndo}
                  onRedo={aiNoopRedo}
                  canUndo={aiNoopCanUndo}
                  canRedo={aiNoopCanRedo}
                  flushTextChange={aiNoopFlush}
                  onDeleteSelectedBlocks={handleAiDeleteSelectedBlocks}
                  onSaveBlock={(id, content) => aiSaveBlock(id, content)}
                  isBlockLocked={!isEditingVersion ? aiIsBlockLocked : undefined}
                  isBlockLockedByMe={!isEditingVersion ? aiIsBlockLockedByMe : undefined}
                  getBlockLockInfo={!isEditingVersion ? aiGetBlockLockInfo : undefined}
                  editorRef={aiEditorRef}
                  className="ai-block-list"
                  t={t}
                />

                {/* Regenerate button */}
                {onOrganizeNotes && (
                  <div className="block-add-section">
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
                  </div>
                )}

                {/* AI Footer */}
                <div className="notes-footer ai-footer">
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
