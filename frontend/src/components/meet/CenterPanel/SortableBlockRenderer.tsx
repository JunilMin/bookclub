/**
 * SortableBlockRenderer - Wrapper for BlockRenderer with drag-and-drop support
 *
 * Uses @dnd-kit/sortable to make blocks draggable and droppable
 */

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import BlockRenderer from './BlockRenderer';
import { BlockEditorRef } from './BlockEditor';
import { Block, BlockLockState, BlockType } from '../../../types/blockDocument';

interface SortableBlockRendererProps {
  block: Block;
  isEditing: boolean;
  isLocked: boolean;
  isLockedByMe: boolean;
  lockInfo: BlockLockState | null;
  currentUserId: string;

  // Selection props
  isSelected?: boolean;
  onSelect?: (event: React.MouseEvent) => void;

  // Multi-drag props
  isPartOfMultiDrag?: boolean; // True when this is a selected block (not the dragged one) during multi-drag
  additionalDragBlocks?: Block[]; // Other selected blocks to render in placeholder (for the dragged block)

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
}

const SortableBlockRenderer: React.FC<SortableBlockRendererProps> = ({
  block,
  isEditing,
  isLocked,
  isLockedByMe,
  lockInfo,
  currentUserId,
  isSelected,
  onSelect,
  isPartOfMultiDrag,
  additionalDragBlocks,
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
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.id,
    disabled: isEditing || (isLocked && !isLockedByMe), // Disable drag when editing or locked by others
  });

  // If this block is part of multi-drag but not the one being dragged, collapse it
  if (isPartOfMultiDrag) {
    return (
      <div
        ref={setNodeRef}
        style={{
          height: 0,
          overflow: 'hidden',
          margin: 0,
          padding: 0,
        }}
      />
    );
  }

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Main block */}
      <BlockRenderer
        block={block}
        isEditing={isEditing}
        isLocked={isLocked}
        isLockedByMe={isLockedByMe}
        lockInfo={lockInfo}
        currentUserId={currentUserId}
        isSelected={isSelected}
        onSelect={onSelect}
        onStartEdit={onStartEdit}
        onSaveEdit={onSaveEdit}
        onAutoSave={onAutoSave}
        onCancelEdit={onCancelEdit}
        onDelete={onDelete}
        onMoveToPrevBlock={onMoveToPrevBlock}
        onMoveToNextBlock={onMoveToNextBlock}
        onCreateBlockAfter={onCreateBlockAfter}
        onSaveAndCreateNext={onSaveAndCreateNext}
        editorRef={editorRef}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
      {/* Additional blocks shown in placeholder during multi-drag */}
      {isDragging && additionalDragBlocks && additionalDragBlocks.length > 0 && (
        <div className="multi-drag-placeholder-blocks">
          {additionalDragBlocks.map((additionalBlock) => (
            <BlockRenderer
              key={additionalBlock.id}
              block={additionalBlock}
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
          ))}
        </div>
      )}
    </div>
  );
};

export default SortableBlockRenderer;
