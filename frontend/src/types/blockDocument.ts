/**
 * Block Document Types (v2.0)
 *
 * Block-based SSOT architecture for collaborative notes
 * Each block is an atomic unit of editing with its own lock
 */

// ============================================
// Block Types
// ============================================

export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'bulletList'
  | 'orderedList'
  | 'blockquote'
  | 'codeBlock'
  | 'taskList'
  | 'utteranceBlock'
  | 'horizontalRule';

// ============================================
// TipTap Content Types
// ============================================

export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TipTapContent {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapContent[];
  text?: string;
  marks?: TipTapMark[];
}

// ============================================
// Block Model
// ============================================

export interface Block {
  id: string;
  type: BlockType;
  content: string;  // TipTap JSON string for this block

  // Metadata
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  version: number;

  // Lock state
  lockedBy: string | null;
  lockToken: string | null;
  lockUntil: string | null;
}

export interface BlockLockState {
  blockId: string;
  lockedBy: string;
  username: string;
  lockToken: string;
  lockUntil: number;
}

// ============================================
// Document Model (SSOT)
// ============================================

export interface BlockDocument {
  id: string;
  sessionId: string;
  title: string;
  blockOrder: string[];           // SSOT: Ordered list of block IDs
  blocks: Record<string, Block>;  // Block ID -> Block data
  version: number;
  migrated: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// WebSocket Operations
// ============================================

export interface BlockUpdateOperation {
  type: 'block_update';
  docId: string;
  blockId: string;
  content: string;
  version: number;
  userId: string;
  username: string;
  clientId: string;
  timestamp: number;
  // Response fields
  updatedAt?: string;
}

export interface BlockUpdateRejectedOperation {
  type: 'block_update_rejected';
  docId: string;
  blockId: string;
  reason: 'NO_LOCK' | 'WRONG_OWNER' | 'VERSION_CONFLICT';
  userId: string;
  clientId: string;
}

export interface BlockAddOperation {
  type: 'block_add';
  docId: string;
  blockType: string;
  content: string;
  afterBlockId: string | null;
  userId: string;
  username: string;
  clientId: string;
  timestamp: number;
  tempBlockId?: string;  // Client's temporary ID for mapping
  // Response fields
  block?: Block;
}

export interface BlockDeleteOperation {
  type: 'block_delete';
  docId: string;
  blockId: string;
  userId: string;
  username: string;
  clientId: string;
  timestamp: number;
}

export interface BlockDeleteRejectedOperation {
  type: 'block_delete_rejected';
  docId: string;
  blockId: string;
  reason: 'LOCKED_BY_OTHER' | 'NOT_FOUND';
  lockedBy?: string;
  lockedByUsername?: string;
}

export type BlockOperation =
  | BlockUpdateOperation
  | BlockUpdateRejectedOperation
  | BlockAddOperation
  | BlockDeleteOperation
  | BlockDeleteRejectedOperation;

// ============================================
// WebSocket Topics
// ============================================

export const BLOCK_TOPICS = {
  // Send (client -> server)
  SEND_BLOCK_UPDATE: (docId: string) => `/app/docs/${docId}/block/update`,
  SEND_BLOCK_ADD: (docId: string) => `/app/docs/${docId}/block/add`,
  SEND_BLOCK_DELETE: (docId: string) => `/app/docs/${docId}/block/delete`,
  SEND_BLOCK_PREVIEW: (docId: string) => `/app/docs/${docId}/block/preview`, // Real-time sync

  // Receive (server -> client)
  RECEIVE_BLOCK_UPDATE: (docId: string) => `/topic/docs/${docId}/block/update`,
  RECEIVE_BLOCK_ADD: (docId: string) => `/topic/docs/${docId}/block/add`,
  RECEIVE_BLOCK_DELETE: (docId: string) => `/topic/docs/${docId}/block/delete`,
  RECEIVE_BLOCK_PREVIEW: (docId: string) => `/topic/docs/${docId}/block/preview`, // Real-time sync
};

// ============================================
// API Response Types
// ============================================

export interface BlockDocumentResponse {
  id: string;
  sessionId: string;
  title: string;
  blockOrder: string[];
  blocks: Record<string, Block>;
  version: number;
  migrated: boolean;
  createdAt: string;
  updatedAt: string;
  // Legacy fields (for backward compatibility)
  content?: string;
  aiContent?: string;
}

// ============================================
// Utility Types
// ============================================

export interface BlockEditingState {
  blockId: string;
  originalContent: string;
  lockToken: string;
  lockUntil: number;
}

export interface RemoteBlockUser {
  userId: string;
  username: string;
  clientId: string;
  photoUrl: string;
  color: string;
  editingBlockId: string | null;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Parse TipTap JSON content string to object
 */
export function parseBlockContent(content: string): TipTapContent | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Generate a unique block ID (client-side)
 */
export function generateBlockId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `blk_${timestamp}_${random}`;
}

/**
 * Create empty block content for a given type
 */
export function createEmptyBlockContent(type: BlockType): string {
  // Note: TipTap/ProseMirror doesn't allow empty text nodes ({ type: 'text', text: '' })
  // Use empty content arrays instead
  switch (type) {
    case 'paragraph':
      return JSON.stringify({
        type: 'paragraph',
      });
    case 'heading':
      return JSON.stringify({
        type: 'heading',
        attrs: { level: 2 },
      });
    case 'bulletList':
      return JSON.stringify({
        type: 'bulletList',
        content: [{
          type: 'listItem',
          content: [{ type: 'paragraph' }],
        }],
      });
    case 'orderedList':
      return JSON.stringify({
        type: 'orderedList',
        content: [{
          type: 'listItem',
          content: [{ type: 'paragraph' }],
        }],
      });
    case 'blockquote':
      return JSON.stringify({
        type: 'blockquote',
        content: [{ type: 'paragraph' }],
      });
    case 'codeBlock':
      return JSON.stringify({
        type: 'codeBlock',
      });
    case 'taskList':
      return JSON.stringify({
        type: 'taskList',
        content: [{
          type: 'taskItem',
          attrs: { checked: false },
          content: [{ type: 'paragraph' }],
        }],
      });
    case 'horizontalRule':
      return JSON.stringify({
        type: 'horizontalRule',
      });
    default:
      return JSON.stringify({
        type: 'paragraph',
      });
  }
}

/**
 * Check if a block is currently locked
 */
export function isBlockLocked(block: Block): boolean {
  if (!block.lockedBy || !block.lockUntil) return false;
  return new Date(block.lockUntil).getTime() > Date.now();
}

/**
 * Check if a block is locked by a specific user
 */
export function isBlockLockedBy(block: Block, userId: string): boolean {
  return isBlockLocked(block) && block.lockedBy === userId;
}
