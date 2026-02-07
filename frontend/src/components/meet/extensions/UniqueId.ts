/**
 * UniqueId Extension for TipTap
 *
 * Automatically assigns unique IDs to block-level nodes.
 * This enables:
 * - Block reordering (drag & drop)
 * - Block-level locking
 * - Precise collaboration tracking
 *
 * Based on the plan: "TipTap 노드 attrs.id를 부여하고, blockOrder는 이를 SSOT로 유지"
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// Block-level node types that should have unique IDs
// NOTE: Keep in sync with DRAGGABLE_TYPES in DragHandle.ts
const BLOCK_TYPES = [
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'taskList',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'utteranceBlock',
];

/**
 * Generate a unique block ID
 */
export function generateBlockId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `blk_${timestamp}_${random}`;
}

export interface UniqueIdOptions {
  /**
   * Attribute name for the unique ID
   * @default 'id'
   */
  attributeName: string;

  /**
   * Node types that should have unique IDs
   * @default BLOCK_TYPES
   */
  types: string[];

  /**
   * Callback when blocks change (for syncing blockOrder)
   */
  onBlocksChange?: (blockIds: string[]) => void;
}

export const UniqueId = Extension.create<UniqueIdOptions>({
  name: 'uniqueId',

  addOptions() {
    return {
      attributeName: 'id',
      types: BLOCK_TYPES,
      onBlocksChange: undefined,
    };
  },

  addGlobalAttributes() {
    return [
      {
        // Apply to all block types
        types: this.options.types,
        attributes: {
          [this.options.attributeName]: {
            default: null,
            parseHTML: (element) => element.getAttribute(`data-${this.options.attributeName}`),
            renderHTML: (attributes) => {
              if (!attributes[this.options.attributeName]) {
                return {};
              }
              return {
                [`data-${this.options.attributeName}`]: attributes[this.options.attributeName],
              };
            },
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    const { attributeName, types, onBlocksChange } = this.options;
    let isFirstRun = true;

    return [
      new Plugin({
        key: new PluginKey('uniqueId'),

        // Assign IDs on initial state (view creation)
        view: () => {
          return {
            update: (view) => {
              // On first run, ensure all blocks have IDs
              if (isFirstRun) {
                isFirstRun = false;

                const { state } = view;
                const tr = state.tr;
                let modified = false;

                state.doc.descendants((node, pos) => {
                  if (!types.includes(node.type.name)) return;
                  if (node.attrs[attributeName]) return;

                  const newId = generateBlockId();
                  tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    [attributeName]: newId,
                  });
                  modified = true;
                });

                if (modified) {
                  tr.setMeta('addToHistory', false);
                  tr.setMeta('uniqueIdInit', true);
                  view.dispatch(tr);
                }

                // Collect and report initial block IDs
                if (onBlocksChange) {
                  const blockIds: string[] = [];
                  view.state.doc.descendants((node) => {
                    if (types.includes(node.type.name)) {
                      const id = node.attrs[attributeName];
                      if (id) blockIds.push(id);
                    }
                  });
                  onBlocksChange(blockIds);
                }
              }
            },
          };
        },

        // Append transaction to assign IDs to new nodes
        appendTransaction: (transactions, _oldState, newState) => {
          // Skip if this is our init transaction
          if (transactions.some((tr) => tr.getMeta('uniqueIdInit'))) {
            return null;
          }

          // Only process if document changed
          const docChanged = transactions.some((tr) => tr.docChanged);
          if (!docChanged) return null;

          const tr = newState.tr;
          let modified = false;

          // Traverse all nodes and assign IDs where missing
          newState.doc.descendants((node, pos) => {
            // Skip non-block nodes
            if (!types.includes(node.type.name)) return;

            // Check if node already has an ID
            const existingId = node.attrs[attributeName];
            if (existingId) return;

            // Generate and assign new ID
            const newId = generateBlockId();
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              [attributeName]: newId,
            });
            modified = true;
          });

          // Schedule blockOrder callback after this transaction applies
          if (modified && onBlocksChange) {
            // Use microtask to ensure we read the state after this transaction is applied
            queueMicrotask(() => {
              const blockIds: string[] = [];
              // Note: we need to traverse again after transaction applied
              // This is a best-effort since we don't have access to the final state here
              newState.doc.descendants((node) => {
                if (types.includes(node.type.name)) {
                  const id = node.attrs[attributeName];
                  if (id) blockIds.push(id);
                }
              });
              onBlocksChange(blockIds);
            });
          } else if (onBlocksChange && docChanged) {
            // Document changed but no new IDs - still report current blocks
            const blockIds: string[] = [];
            newState.doc.descendants((node) => {
              if (types.includes(node.type.name)) {
                const id = node.attrs[attributeName];
                if (id) blockIds.push(id);
              }
            });
            onBlocksChange(blockIds);
          }

          return modified ? tr : null;
        },
      }),
    ];
  },
});

export default UniqueId;
