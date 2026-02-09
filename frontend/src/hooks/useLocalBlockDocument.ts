/**
 * useLocalBlockDocument Hook
 *
 * Local (non-collaborative) block document management for personal notes.
 * Provides the same interface as useBlockDocument but without WebSocket sync.
 * Used for editing UserSessionNote (personal forked notes).
 */

import { useState, useCallback, useRef } from 'react';
import {
  Block,
  BlockType,
  TipTapContent,
  generateBlockId,
  createEmptyBlockContent,
} from '../types/blockDocument';

// ============================================
// Types
// ============================================

interface UseLocalBlockDocumentOptions {
  initialContent?: string; // TipTap JSON string
  userId: string;
  username: string;
}

interface UseLocalBlockDocumentReturn {
  // Document state
  blockOrder: string[];
  blocks: Record<string, Block>;
  isLoading: boolean;
  hasChanges: boolean;

  // Editing state
  editingBlockId: string | null;

  // Block operations
  startEditing: (blockId: string) => void;
  saveBlock: (blockId: string, content: string) => void;
  finishEditing: () => void;
  cancelEditing: () => void;

  // Block CRUD
  addBlock: (type: BlockType, afterBlockId?: string | null, initialContent?: string) => string | null;
  deleteBlock: (blockId: string) => void;
  reorderBlocks: (fromIndex: number, toIndex: number) => void;
  reorderMultiple: (blockIds: string[], targetIndex: number) => void;

  // Utilities
  getBlock: (blockId: string) => Block | null;
  getContent: () => string; // Get serialized TipTap JSON
  setContent: (content: string) => void; // Set from TipTap JSON
  clearChanges: () => void;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Parse TipTap JSON and convert to blocks
 */
function parseContentToBlocks(
  content: string,
  userId: string
): { blockOrder: string[]; blocks: Record<string, Block> } {
  const blockOrder: string[] = [];
  const blocks: Record<string, Block> = {};

  try {
    const parsed = JSON.parse(content) as TipTapContent;

    if (parsed.type === 'doc' && Array.isArray(parsed.content)) {
      parsed.content.forEach((node) => {
        const blockId = generateBlockId();
        const blockType = mapNodeTypeToBlockType(node.type);
        const blockContent = JSON.stringify(node);

        blocks[blockId] = {
          id: blockId,
          type: blockType,
          content: blockContent,
          createdBy: userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
          lockedBy: null,
          lockToken: null,
          lockUntil: null,
        };

        blockOrder.push(blockId);
      });
    }
  } catch {
    // If parsing fails, create a single empty paragraph block
    const blockId = generateBlockId();
    blocks[blockId] = {
      id: blockId,
      type: 'paragraph',
      content: createEmptyBlockContent('paragraph'),
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      lockedBy: null,
      lockToken: null,
      lockUntil: null,
    };
    blockOrder.push(blockId);
  }

  // Ensure at least one block exists
  if (blockOrder.length === 0) {
    const blockId = generateBlockId();
    blocks[blockId] = {
      id: blockId,
      type: 'paragraph',
      content: createEmptyBlockContent('paragraph'),
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      lockedBy: null,
      lockToken: null,
      lockUntil: null,
    };
    blockOrder.push(blockId);
  }

  return { blockOrder, blocks };
}

/**
 * Map TipTap node type to BlockType
 */
function mapNodeTypeToBlockType(nodeType: string): BlockType {
  switch (nodeType) {
    case 'heading':
      return 'heading';
    case 'bulletList':
      return 'bulletList';
    case 'orderedList':
      return 'orderedList';
    case 'blockquote':
      return 'blockquote';
    case 'codeBlock':
      return 'codeBlock';
    case 'taskList':
      return 'taskList';
    case 'horizontalRule':
      return 'horizontalRule';
    case 'utteranceBlock':
      return 'utteranceBlock';
    default:
      return 'paragraph';
  }
}

/**
 * Serialize blocks back to TipTap JSON
 */
function serializeBlocksToContent(
  blockOrder: string[],
  blocks: Record<string, Block>
): string {
  const content: TipTapContent[] = [];

  for (const blockId of blockOrder) {
    const block = blocks[blockId];
    if (block) {
      try {
        const parsed = JSON.parse(block.content) as TipTapContent;
        content.push(parsed);
      } catch {
        // Skip invalid blocks
      }
    }
  }

  return JSON.stringify({
    type: 'doc',
    content,
  });
}

// ============================================
// Main Hook
// ============================================

export function useLocalBlockDocument({
  initialContent = '',
  userId,
  username: _username,
}: UseLocalBlockDocumentOptions): UseLocalBlockDocumentReturn {
  // State
  const [blockOrder, setBlockOrder] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<Record<string, Block>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  // Refs
  const originalContentRef = useRef<{ blockOrder: string[]; blocks: Record<string, Block> } | null>(null);
  const editingOriginalContentRef = useRef<string | null>(null);

  // ============================================
  // Content Management
  // ============================================

  const setContent = useCallback((content: string) => {
    setIsLoading(true);
    const { blockOrder: newOrder, blocks: newBlocks } = parseContentToBlocks(content, userId);
    setBlockOrder(newOrder);
    setBlocks(newBlocks);
    originalContentRef.current = { blockOrder: newOrder, blocks: { ...newBlocks } };
    setHasChanges(false);
    setIsLoading(false);
  }, [userId]);

  // Initialize with initial content
  useState(() => {
    if (initialContent) {
      const { blockOrder: newOrder, blocks: newBlocks } = parseContentToBlocks(initialContent, userId);
      setBlockOrder(newOrder);
      setBlocks(newBlocks);
      originalContentRef.current = { blockOrder: newOrder, blocks: { ...newBlocks } };
      setIsLoading(false);
    } else {
      // Create initial empty block
      const blockId = generateBlockId();
      const newBlock: Block = {
        id: blockId,
        type: 'paragraph',
        content: createEmptyBlockContent('paragraph'),
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        lockedBy: null,
        lockToken: null,
        lockUntil: null,
      };
      setBlockOrder([blockId]);
      setBlocks({ [blockId]: newBlock });
      originalContentRef.current = { blockOrder: [blockId], blocks: { [blockId]: newBlock } };
      setIsLoading(false);
    }
  });

  const getContent = useCallback((): string => {
    return serializeBlocksToContent(blockOrder, blocks);
  }, [blockOrder, blocks]);

  const clearChanges = useCallback(() => {
    setHasChanges(false);
    originalContentRef.current = { blockOrder: [...blockOrder], blocks: { ...blocks } };
  }, [blockOrder, blocks]);

  // ============================================
  // Editing Operations
  // ============================================

  const startEditing = useCallback((blockId: string) => {
    if (editingBlockId === blockId) return;

    // Finish current editing
    if (editingBlockId) {
      setEditingBlockId(null);
      editingOriginalContentRef.current = null;
    }

    // Start editing new block
    const block = blocks[blockId];
    if (block) {
      editingOriginalContentRef.current = block.content;
      setEditingBlockId(blockId);
    }
  }, [editingBlockId, blocks]);

  const saveBlock = useCallback((blockId: string, content: string) => {
    setBlocks((prev) => {
      const block = prev[blockId];
      if (!block) return prev;

      if (block.content === content) return prev;

      return {
        ...prev,
        [blockId]: {
          ...block,
          content,
          updatedAt: new Date().toISOString(),
          version: block.version + 1,
        },
      };
    });
    setHasChanges(true);
  }, []);

  const finishEditing = useCallback(() => {
    setEditingBlockId(null);
    editingOriginalContentRef.current = null;
  }, []);

  const cancelEditing = useCallback(() => {
    if (editingBlockId && editingOriginalContentRef.current) {
      // Restore original content
      setBlocks((prev) => {
        const block = prev[editingBlockId];
        if (!block) return prev;

        return {
          ...prev,
          [editingBlockId]: {
            ...block,
            content: editingOriginalContentRef.current!,
          },
        };
      });
    }
    setEditingBlockId(null);
    editingOriginalContentRef.current = null;
  }, [editingBlockId]);

  // ============================================
  // Block CRUD Operations
  // ============================================

  const addBlock = useCallback((
    type: BlockType,
    afterBlockId?: string | null,
    initialContent?: string
  ): string | null => {
    const blockId = generateBlockId();
    const content = initialContent || createEmptyBlockContent(type);

    const newBlock: Block = {
      id: blockId,
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

    setBlocks((prev) => ({ ...prev, [blockId]: newBlock }));

    setBlockOrder((prev) => {
      if (afterBlockId) {
        const index = prev.indexOf(afterBlockId);
        if (index !== -1) {
          const newOrder = [...prev];
          newOrder.splice(index + 1, 0, blockId);
          return newOrder;
        }
      }
      return [...prev, blockId];
    });

    setHasChanges(true);
    return blockId;
  }, [userId]);

  const deleteBlock = useCallback((blockId: string) => {
    // Don't delete if it's the only block
    if (blockOrder.length <= 1) return;

    setBlocks((prev) => {
      const newBlocks = { ...prev };
      delete newBlocks[blockId];
      return newBlocks;
    });

    setBlockOrder((prev) => prev.filter((id) => id !== blockId));

    if (editingBlockId === blockId) {
      setEditingBlockId(null);
      editingOriginalContentRef.current = null;
    }

    setHasChanges(true);
  }, [blockOrder.length, editingBlockId]);

  const reorderBlocks = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    setBlockOrder((prev) => {
      const newOrder = [...prev];
      const [removed] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, removed);
      return newOrder;
    });

    setHasChanges(true);
  }, []);

  const reorderMultiple = useCallback((blockIds: string[], targetIndex: number) => {
    if (blockIds.length === 0) return;

    setBlockOrder((prev) => {
      // Remove all selected blocks from current positions
      const remaining = prev.filter(id => !blockIds.includes(id));
      // Maintain original relative order of selected blocks
      const selectedInOrder = prev.filter(id => blockIds.includes(id));
      // Clamp target index
      const clampedTarget = Math.min(targetIndex, remaining.length);
      // Insert at target
      const newOrder = [...remaining];
      newOrder.splice(clampedTarget, 0, ...selectedInOrder);
      return newOrder;
    });

    setHasChanges(true);
  }, []);

  // ============================================
  // Utilities
  // ============================================

  const getBlock = useCallback((blockId: string): Block | null => {
    return blocks[blockId] || null;
  }, [blocks]);

  // ============================================
  // Return
  // ============================================

  return {
    // Document state
    blockOrder,
    blocks,
    isLoading,
    hasChanges,

    // Editing state
    editingBlockId,

    // Block operations
    startEditing,
    saveBlock,
    finishEditing,
    cancelEditing,

    // Block CRUD
    addBlock,
    deleteBlock,
    reorderBlocks,
    reorderMultiple,

    // Utilities
    getBlock,
    getContent,
    setContent,
    clearChanges,
  };
}

export default useLocalBlockDocument;
