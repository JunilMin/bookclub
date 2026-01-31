/**
 * DragHandle Extension for TipTap
 *
 * Adds drag handles to block nodes by extending each node type.
 * This is the TipTap-approved way that properly integrates with the editor.
 */

import { Extension, Node } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorView } from '@tiptap/pm/view';
import Paragraph from '@tiptap/extension-paragraph';
import Heading from '@tiptap/extension-heading';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import Blockquote from '@tiptap/extension-blockquote';
import CodeBlock from '@tiptap/extension-code-block';
import HorizontalRule from '@tiptap/extension-horizontal-rule';

// Block types that should have drag handles
export const DRAGGABLE_TYPES = [
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'taskList',
  'utteranceBlock',
];

export interface DragHandleOptions {
  onReorder?: (blockId: string, fromIndex: number, toIndex: number) => void;
  enabled: boolean;
}

// Shared drag state
let dragState: {
  blockId: string;
  fromIndex: number;
  view: EditorView;
  sourceWrapper: HTMLElement;
} | null = null;

// Get content tag for a node
function getContentTag(node: ProseMirrorNode, defaultTag: string): string {
  if (node.type.name === 'heading') {
    const level = node.attrs?.level || 1;
    return `h${Math.min(Math.max(level, 1), 6)}`;
  }
  return defaultTag;
}

// Create a NodeView for a draggable block
function createDraggableNodeView(
  node: ProseMirrorNode,
  view: EditorView,
  getPos: () => number | undefined,
  defaultContentTag: string,
  onReorder?: (blockId: string, fromIndex: number, toIndex: number) => void
) {
  // Debug: uncomment if needed
  // console.log('[DragHandle] Creating NodeView for:', node.type.name, 'id:', node.attrs?.id);

  // Track current node state
  let currentNode = node;

  // Create wrapper
  const dom = document.createElement('div');
  dom.className = 'block-wrapper';
  dom.setAttribute('data-node-type', node.type.name);

  // Create drag handle
  const handle = document.createElement('div');
  handle.className = 'block-drag-handle';
  handle.contentEditable = 'false';
  handle.draggable = true;
  handle.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="5" r="2"/>
      <circle cx="9" cy="12" r="2"/>
      <circle cx="9" cy="19" r="2"/>
      <circle cx="15" cy="5" r="2"/>
      <circle cx="15" cy="12" r="2"/>
      <circle cx="15" cy="19" r="2"/>
    </svg>
  `;

  // Create content container with correct semantic tag
  const contentTag = getContentTag(node, defaultContentTag);
  const contentDOM = document.createElement(contentTag);
  contentDOM.className = 'block-content';

  // Set attributes
  const updateAttributes = () => {
    if (currentNode.attrs.id) {
      dom.setAttribute('data-block-id', currentNode.attrs.id);
      contentDOM.setAttribute('data-id', currentNode.attrs.id);
    }
    if (currentNode.type.name === 'heading' && currentNode.attrs.level) {
      contentDOM.setAttribute('data-level', String(currentNode.attrs.level));
    }
  };
  updateAttributes();

  // Assemble DOM
  dom.appendChild(handle);
  dom.appendChild(contentDOM);

  // Helper functions
  const getBlockId = (): string => currentNode.attrs?.id || '';

  const getBlockIndex = (): number => {
    const pos = getPos();
    if (pos === undefined) return -1;
    let index = 0;
    view.state.doc.nodesBetween(0, pos, (n) => {
      if (DRAGGABLE_TYPES.includes(n.type.name) && n.attrs?.id) {
        index++;
      }
      return true;
    });
    return index;
  };

  const cleanupDropIndicators = () => {
    document.querySelectorAll('.block-drop-above, .block-drop-below').forEach((el) => {
      el.classList.remove('block-drop-above', 'block-drop-below');
    });
  };

  // Event handlers
  const handleDragStart = (e: DragEvent) => {
    e.stopPropagation();

    const blockId = getBlockId();
    if (!blockId) {
      e.preventDefault();
      return;
    }

    dragState = {
      blockId,
      fromIndex: getBlockIndex(),
      view,
      sourceWrapper: dom,
    };

    dom.classList.add('dragging');

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', blockId);

      // Create drag image
      const dragImage = document.createElement('div');
      dragImage.textContent = '⋮⋮ Moving...';
      dragImage.style.cssText = 'position: fixed; top: -1000px; left: -1000px; padding: 8px 12px; background: #10b981; color: white; border-radius: 4px; font-size: 12px;';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);
      setTimeout(() => dragImage.remove(), 0);
    }
  };

  const handleDragEnd = () => {
    dom.classList.remove('dragging');
    cleanupDropIndicators();
    dragState = null;
  };

  const handleDragOver = (e: DragEvent) => {
    if (!dragState || dragState.sourceWrapper === dom) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }

    cleanupDropIndicators();

    const rect = dom.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    if (e.clientY < midY) {
      dom.classList.add('block-drop-above');
    } else {
      dom.classList.add('block-drop-below');
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    const relatedTarget = e.relatedTarget as Node | null;
    if (!relatedTarget || !dom.contains(relatedTarget)) {
      dom.classList.remove('block-drop-above', 'block-drop-below');
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!dragState || dragState.sourceWrapper === dom) {
      cleanupDropIndicators();
      return;
    }

    const isDropBelow = dom.classList.contains('block-drop-below');
    cleanupDropIndicators();

    const { blockId, fromIndex } = dragState;
    const targetIndex = getBlockIndex();

    // Calculate target position
    let toIndex = isDropBelow ? targetIndex + 1 : targetIndex;
    if (fromIndex < toIndex) {
      toIndex--;
    }

    if (fromIndex === toIndex) {
      dragState = null;
      return;
    }

    // Find source position
    let sourceStart = -1;
    let sourceEnd = -1;

    view.state.doc.descendants((n, pos) => {
      if (n.attrs?.id === blockId) {
        sourceStart = pos;
        sourceEnd = pos + n.nodeSize;
        return false;
      }
      return true;
    });

    if (sourceStart === -1) {
      dragState = null;
      return;
    }

    // Find target position
    let targetPos = -1;
    let currentIdx = 0;

    view.state.doc.descendants((n, pos) => {
      if (DRAGGABLE_TYPES.includes(n.type.name) && n.attrs?.id) {
        if (currentIdx === toIndex) {
          targetPos = pos;
          return false;
        }
        currentIdx++;
      }
      return true;
    });

    if (targetPos === -1 && toIndex >= currentIdx) {
      targetPos = view.state.doc.content.size;
    }

    if (targetPos === -1 || sourceStart === targetPos) {
      dragState = null;
      return;
    }

    // Apply transaction
    const { tr } = view.state;
    const nodeToMove = view.state.doc.slice(sourceStart, sourceEnd);

    if (sourceStart < targetPos) {
      tr.insert(targetPos, nodeToMove.content);
      tr.delete(sourceStart, sourceEnd);
    } else {
      tr.delete(sourceStart, sourceEnd);
      tr.insert(targetPos, nodeToMove.content);
    }

    view.dispatch(tr);

    // Callback
    onReorder?.(blockId, fromIndex, toIndex);

    dragState = null;
  };

  const handleMouseDown = (e: MouseEvent) => {
    // NOTE: Do NOT call e.preventDefault() here!
    // Preventing default on mousedown blocks the browser's HTML5 drag from starting.
    // The dragstart event needs mousedown's default behavior to fire properly.
    e.stopPropagation();
  };

  // Add event listeners
  handle.addEventListener('dragstart', handleDragStart);
  handle.addEventListener('dragend', handleDragEnd);
  handle.addEventListener('mousedown', handleMouseDown);
  dom.addEventListener('dragover', handleDragOver);
  dom.addEventListener('dragleave', handleDragLeave);
  dom.addEventListener('drop', handleDrop);

  return {
    dom,
    contentDOM,

    update(updatedNode: ProseMirrorNode): boolean {
      if (updatedNode.type.name !== currentNode.type.name) {
        return false;
      }
      currentNode = updatedNode;
      updateAttributes();
      return true;
    },

    ignoreMutation(mutation: MutationRecord): boolean {
      if (handle.contains(mutation.target as Node)) {
        return true;
      }
      return false;
    },

    selectNode() {
      dom.classList.add('selected');
    },

    deselectNode() {
      dom.classList.remove('selected');
    },

    destroy() {
      handle.removeEventListener('dragstart', handleDragStart);
      handle.removeEventListener('dragend', handleDragEnd);
      handle.removeEventListener('mousedown', handleMouseDown);
      dom.removeEventListener('dragover', handleDragOver);
      dom.removeEventListener('dragleave', handleDragLeave);
      dom.removeEventListener('drop', handleDrop);
    },
  };
}

// Helper to create draggable version of a node extension
function makeDraggable<T extends Node>(
  NodeExtension: T,
  defaultContentTag: string,
  onReorder?: (blockId: string, fromIndex: number, toIndex: number) => void
) {
  return NodeExtension.extend({
    addNodeView() {
      return ({ node, view, getPos }) => {
        return createDraggableNodeView(
          node,
          view,
          getPos as () => number | undefined,
          defaultContentTag,
          onReorder
        );
      };
    },
  });
}

// Main extension that provides draggable node extensions
export const DragHandle = Extension.create<DragHandleOptions>({
  name: 'dragHandle',

  addOptions() {
    return {
      onReorder: undefined,
      enabled: true,
    };
  },

  addExtensions() {
    if (!this.options.enabled) {
      return [];
    }

    const onReorder = this.options.onReorder;

    // Configure Heading with levels before making it draggable
    const ConfiguredHeading = Heading.configure({ levels: [1, 2, 3] });

    return [
      makeDraggable(Paragraph, 'p', onReorder),
      makeDraggable(ConfiguredHeading, 'h1', onReorder), // h1 is default, actual tag determined by getContentTag
      makeDraggable(BulletList, 'ul', onReorder),
      makeDraggable(OrderedList, 'ol', onReorder),
      makeDraggable(Blockquote, 'blockquote', onReorder),
      makeDraggable(CodeBlock, 'pre', onReorder),
      makeDraggable(HorizontalRule, 'hr', onReorder),
    ];
  },
});

export default DragHandle;
