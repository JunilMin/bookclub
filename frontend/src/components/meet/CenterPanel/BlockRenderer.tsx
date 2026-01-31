/**
 * BlockRenderer - Individual block wrapper
 *
 * Wraps block content with:
 * - Drag handle
 * - Lock indicator
 * - Selection state
 */

import React from 'react';
import { Block, BlockLockState, BlockType } from '../../../types/blockDocument';
import { FiLock } from 'react-icons/fi';
import BlockContent from './BlockContent';
import BlockEditor, { BlockEditorRef } from './BlockEditor';

interface BlockRendererProps {
  block: Block;
  isEditing: boolean;
  isLocked: boolean;
  isLockedByMe: boolean;
  lockInfo: BlockLockState | null;
  currentUserId: string;

  // Selection props
  isSelected?: boolean;
  onSelect?: (event: React.MouseEvent) => void;

  // Callbacks
  onStartEdit: () => void;
  onSaveEdit: (content: string) => void;
  onAutoSave?: (content: string) => void; // Real-time sync while typing
  onCancelEdit: () => void;
  onDelete: () => void;
  onMoveToPrevBlock?: () => void;
  onMoveToNextBlock?: () => void;
  onCreateBlockAfter: (type: BlockType) => void;
  onSaveAndCreateNext?: (content: string) => void;

  // Editor ref for toolbar control
  editorRef?: React.RefObject<BlockEditorRef | null>;

  // Drag props (for dnd-kit or react-beautiful-dnd)
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  isEditing,
  isLocked,
  isLockedByMe,
  lockInfo,
  isSelected,
  onSelect,
  onStartEdit,
  onSaveEdit,
  onAutoSave,
  onCancelEdit,
  onDelete,
  onMoveToPrevBlock,
  onMoveToNextBlock,
  onCreateBlockAfter,
  onSaveAndCreateNext,
  editorRef,
  dragHandleProps,
  isDragging,
}) => {
  const canEdit = !isLocked || isLockedByMe;
  const showLockIndicator = isLocked && !isLockedByMe;

  /**
   * Handle click on the block container
   * - Shift/Ctrl+Click: selection
   * - Normal click: start editing (handled by BlockContent)
   */
  const handleContainerClick = (e: React.MouseEvent) => {
    // If Shift or Ctrl/Cmd is pressed, handle selection
    if ((e.shiftKey || e.metaKey || e.ctrlKey) && onSelect) {
      e.preventDefault();
      e.stopPropagation();
      onSelect(e);
    }
  };

  return (
    <div
      className={`block-renderer ${isEditing ? 'editing' : ''} ${isDragging ? 'dragging' : ''} ${showLockIndicator ? 'locked' : ''} ${isSelected ? 'selected' : ''}`}
      data-block-id={block.id}
      data-block-type={block.type}
      onClick={handleContainerClick}
    >
      {/* Drag Handle */}
      <div className="block-drag-handle" {...dragHandleProps}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="5" r="2" />
          <circle cx="9" cy="12" r="2" />
          <circle cx="9" cy="19" r="2" />
          <circle cx="15" cy="5" r="2" />
          <circle cx="15" cy="12" r="2" />
          <circle cx="15" cy="19" r="2" />
        </svg>
      </div>

      {/* Block Content */}
      <div className="block-content-wrapper">
        {isEditing ? (
          <BlockEditor
            ref={editorRef}
            block={block}
            onSave={onSaveEdit}
            onAutoSave={onAutoSave}
            onCancel={onCancelEdit}
            onDelete={onDelete}
            onMoveToPrevBlock={onMoveToPrevBlock}
            onMoveToNextBlock={onMoveToNextBlock}
            onCreateBlockAfter={onCreateBlockAfter}
            onSaveAndCreateNext={onSaveAndCreateNext}
            autoFocus={true}
          />
        ) : (
          <BlockContent
            block={block}
            onClick={canEdit ? onStartEdit : undefined}
          />
        )}
      </div>

      {/* Lock Indicator - only show when locked by others */}
      {showLockIndicator && lockInfo && (
        <div className="block-lock-indicator" title={`Editing by ${lockInfo.username}`}>
          <FiLock size={12} />
          <span className="lock-username">{lockInfo.username}</span>
        </div>
      )}

    </div>
  );
};

export default BlockRenderer;
