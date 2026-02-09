/**
 * BlockEditor - Inline TipTap editor for single block editing
 *
 * Seamless inline editing - looks like normal text until you type
 * Auto-saves on blur, supports keyboard shortcuts
 * Exposes editor instance via ref for external toolbar control
 */

import { useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { UtteranceBlock } from '../extensions/UtteranceBlock';
import { Block, parseBlockContent, BlockType, TipTapContent } from '../../../types/blockDocument';

/**
 * Sanitize TipTap content to remove empty text nodes
 * ProseMirror throws "Empty text nodes are not allowed" for { type: 'text', text: '' }
 */
function sanitizeContent(content: TipTapContent | null): TipTapContent | null {
  if (!content) return null;

  // If it's a text node with empty text, return null to filter it out
  if (content.type === 'text' && (!content.text || content.text === '')) {
    return null;
  }

  // Recursively sanitize children
  if (content.content && Array.isArray(content.content)) {
    const sanitizedChildren = content.content
      .map(child => sanitizeContent(child))
      .filter((child): child is TipTapContent => child !== null);

    return {
      ...content,
      content: sanitizedChildren.length > 0 ? sanitizedChildren : undefined,
    };
  }

  return content;
}

/**
 * Wrap content in a doc structure if it's just a node
 * TipTap input rules work better with proper document structure
 */
function ensureDocStructure(content: TipTapContent | null): TipTapContent {
  // Default empty document
  const emptyDoc: TipTapContent = {
    type: 'doc',
    content: [{ type: 'paragraph' }]
  };

  if (!content) return emptyDoc;

  // If it's already a doc, return as is
  if (content.type === 'doc') {
    return content;
  }

  // Wrap single node in a doc
  return {
    type: 'doc',
    content: [content]
  };
}

/**
 * Create TipTap content for a specific block type
 * Used when converting paragraph with markers to list/heading/etc.
 */
function createBlockContent(type: BlockType, text: string): TipTapContent {
  const textNode = text ? [{ type: 'text', text }] : [];

  switch (type) {
    case 'bulletList':
      return {
        type: 'doc',
        content: [{
          type: 'bulletList',
          content: [{
            type: 'listItem',
            content: [{ type: 'paragraph', content: textNode }]
          }]
        }]
      };
    case 'orderedList':
      return {
        type: 'doc',
        content: [{
          type: 'orderedList',
          content: [{
            type: 'listItem',
            content: [{ type: 'paragraph', content: textNode }]
          }]
        }]
      };
    case 'taskList':
      return {
        type: 'doc',
        content: [{
          type: 'taskList',
          content: [{
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: textNode }]
          }]
        }]
      };
    case 'blockquote':
      return {
        type: 'doc',
        content: [{
          type: 'blockquote',
          content: [{ type: 'paragraph', content: textNode }]
        }]
      };
    case 'heading':
      return {
        type: 'doc',
        content: [{
          type: 'heading',
          attrs: { level: 2 },
          content: textNode
        }]
      };
    default:
      return {
        type: 'doc',
        content: [{ type: 'paragraph', content: textNode }]
      };
  }
}

interface BlockEditorProps {
  block: Block;
  onSave: (content: string) => void;
  onAutoSave?: (content: string) => void; // For real-time sync (debounced)
  onCancel: () => void;
  onDelete?: () => void; // For backspace on empty block
  onMoveToPrevBlock?: () => void; // For ArrowUp at first line
  onMoveToNextBlock?: () => void; // For ArrowDown at last line
  onCreateBlockAfter?: (type: BlockType) => void;
  onSaveAndCreateNext?: (content: string, nextBlockType?: BlockType, nextListStart?: number) => void; // For Enter key: save + create next + focus
  skipKeyboardNavigation?: boolean; // Skip keyboard navigation during pending transitions
  autoFocus?: boolean;
}

export interface BlockEditorRef {
  editor: Editor | null;
  save: () => void;
}

const AUTOSAVE_DEBOUNCE_MS = 30; // Very short debounce - just to batch rapid keystrokes

const BlockEditor = forwardRef<BlockEditorRef, BlockEditorProps>(({
  block,
  onSave,
  onAutoSave,
  onCancel,
  onDelete,
  onMoveToPrevBlock,
  onMoveToNextBlock,
  onCreateBlockAfter,
  onSaveAndCreateNext,
  skipKeyboardNavigation = false,
  autoFocus = true,
}, ref) => {
  const hasChangesRef = useRef(false);
  const initialContentRef = useRef(block.content);
  const lastSavedContentRef = useRef(block.content);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse, sanitize, and wrap content in proper doc structure
  // This ensures TipTap input rules work correctly
  const initialContent = ensureDocStructure(sanitizeContent(parseBlockContent(block.content)));

  // Debounced auto-save for real-time sync (broadcast only, not actual save)
  // NOTE: Do NOT update lastSavedContentRef here - onAutoSave is a broadcast,
  // not an actual save. Updating it would cause handleSave() to skip the real
  // save (via onSave) when the user clicks outside or finishes editing.
  const debouncedAutoSave = useCallback((content: string) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      if (content !== lastSavedContentRef.current && onAutoSave) {
        onAutoSave(content);
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [onAutoSave]);

  // Refs for callbacks (to avoid stale closures in editorProps)
  const onSaveAndCreateNextRef = useRef(onSaveAndCreateNext);
  const onCreateBlockAfterRef = useRef(onCreateBlockAfter);
  const skipKeyboardNavigationRef = useRef(skipKeyboardNavigation);

  useEffect(() => {
    onSaveAndCreateNextRef.current = onSaveAndCreateNext;
    onCreateBlockAfterRef.current = onCreateBlockAfter;
    skipKeyboardNavigationRef.current = skipKeyboardNavigation;
  }, [onSaveAndCreateNext, onCreateBlockAfter, skipKeyboardNavigation]);

  const editor = useEditor({
    extensions: [
      // StarterKit includes all basic extensions with input rules:
      // - BulletList (- or * at start)
      // - OrderedList (1. at start)
      // - Heading (# at start)
      // - Blockquote (> at start)
      // - CodeBlock (``` at start)
      // - HorizontalRule (--- at start)
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        history: false, // Disable built-in undo/redo - handled by useBlockHistory at block level
        // Ensure input rules are enabled (default is true)
        bulletList: {}, // Explicit empty config ensures extension is included
        orderedList: {},
        blockquote: {},
        codeBlock: {},
        horizontalRule: {},
      }),
      Placeholder.configure({
        placeholder: 'Type something...',
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      UtteranceBlock,
    ],
    content: initialContent,
    autofocus: autoFocus ? 'end' : false,
    onUpdate: ({ editor }) => {
      hasChangesRef.current = true;
      // Trigger debounced auto-save for real-time sync
      const content = JSON.stringify(editor.getJSON());
      debouncedAutoSave(content);
    },
    editorProps: {
      attributes: {
        class: 'block-editor-inline',
      },
      // Handle Enter key BEFORE TipTap processes it
      handleKeyDown: (view, event) => {
        // Enter (without Shift) - create new block instead of new line
        if (event.key === 'Enter' && !event.shiftKey) {
          // Skip during pending transitions
          if (skipKeyboardNavigationRef.current) {
            return false; // Let parent handle it
          }

          const { state } = view;
          const { $anchor } = state.selection;

          // Check if in code block - let TipTap handle Enter there
          const isInCodeBlock = $anchor.parent.type.name === 'codeBlock';
          if (isInCodeBlock) {
            return false;
          }

          // Get the text content to check for list markers
          const textContent = view.state.doc.textContent;

          // Detect list markers at the start of text
          let nextBlockType: BlockType = 'paragraph';
          let cleanedContent = textContent;
          let nextListStart: number | undefined;

          // Bullet list markers: -, *, •
          if (/^[-*•]\s/.test(textContent)) {
            nextBlockType = 'bulletList';
            cleanedContent = textContent.replace(/^[-*•]\s/, '');
          }
          // Ordered list markers: 1., 2., etc.
          else if (/^\d+\.\s/.test(textContent)) {
            const match = textContent.match(/^(\d+)\.\s/);
            const currentNumber = match ? parseInt(match[1], 10) : 1;
            nextBlockType = 'orderedList';
            cleanedContent = textContent.replace(/^\d+\.\s/, '');
            nextListStart = currentNumber + 1;
          }
          // Task list markers: [ ], [x], [X]
          else if (/^\[[ xX]?\]\s/.test(textContent)) {
            nextBlockType = 'taskList';
            cleanedContent = textContent.replace(/^\[[ xX]?\]\s/, '');
          }
          // Blockquote marker: >
          else if (/^>\s/.test(textContent)) {
            nextBlockType = 'blockquote';
            cleanedContent = textContent.replace(/^>\s/, '');
          }
          // Heading markers: #, ##, ###
          else if (/^#{1,3}\s/.test(textContent)) {
            nextBlockType = 'heading';
            cleanedContent = textContent.replace(/^#{1,3}\s/, '');
          }

          // Check if currently in a list block
          const firstChild = state.doc.firstChild;
          const isInBulletList = firstChild?.type.name === 'bulletList';
          const isInOrderedList = firstChild?.type.name === 'orderedList';
          const isInTaskList = firstChild?.type.name === 'taskList';
          const isInList = isInBulletList || isInOrderedList || isInTaskList;

          // If in a list AND content is empty (just the list item with no text), break out to paragraph
          if (isInList && textContent.trim() === '') {
            nextBlockType = 'paragraph';
            nextListStart = undefined;
          }
          // If in a list with content, continue the same type
          else if (isInBulletList) {
            nextBlockType = 'bulletList';
          } else if (isInOrderedList) {
            nextBlockType = 'orderedList';
            // Get the current ordered list's start number and count items
            if (firstChild?.attrs?.start !== undefined) {
              const startNum = firstChild.attrs.start as number || 1;
              const itemCount = firstChild.childCount || 1;
              nextListStart = startNum + itemCount;
            } else {
              nextListStart = 2; // Default: assume current is 1, next is 2
            }
          } else if (isInTaskList) {
            nextBlockType = 'taskList';
          }

          // Create new block
          if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
          }

          // Build content - if marker was detected, convert current block to that type
          let contentToSave: string;
          if (nextBlockType !== 'paragraph' && cleanedContent !== textContent) {
            // Convert current block to the detected type with cleaned content
            contentToSave = JSON.stringify(createBlockContent(nextBlockType, cleanedContent));
          } else {
            contentToSave = JSON.stringify(view.state.doc.toJSON());
          }

          lastSavedContentRef.current = contentToSave;

          if (onSaveAndCreateNextRef.current) {
            onSaveAndCreateNextRef.current(contentToSave, nextBlockType, nextListStart);
          } else if (onCreateBlockAfterRef.current) {
            onCreateBlockAfterRef.current(nextBlockType);
          }

          return true; // Prevent TipTap from handling Enter
        }

        return false; // Let TipTap handle other keys
      },
    },
  });

  // Handle save
  const handleSave = useCallback(() => {
    if (!editor) return;

    // Clear pending auto-save to prevent duplicate saves
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    const content = JSON.stringify(editor.getJSON());

    // Only save if content changed from initial AND from last saved
    if (content !== initialContentRef.current && content !== lastSavedContentRef.current) {
      onSave(content);
      lastSavedContentRef.current = content;
    }

    hasChangesRef.current = false;
  }, [editor, onSave]);

  // Expose editor and save function via ref
  useImperativeHandle(ref, () => ({
    editor,
    save: handleSave,
  }), [editor, handleSave]);

  // Handle blur - just save content, don't release lock
  // Lock will be released when clicking another block (via startEditing) or pressing Escape
  useEffect(() => {
    if (!editor) return;

    const handleBlur = () => {
      // Small delay to allow clicking on toolbar
      setTimeout(() => {
        if (hasChangesRef.current && !editor.isFocused) {
          // Clear pending auto-save
          if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
          }

          // Just save, don't finish editing - lock will be released when clicking another block
          const content = JSON.stringify(editor.getJSON());
          if (content !== lastSavedContentRef.current) {
            if (onAutoSave) {
              onAutoSave(content);
              // Don't update lastSavedContentRef - onAutoSave is broadcast only
            } else {
              onSave(content);
              lastSavedContentRef.current = content;
            }
          }
          hasChangesRef.current = false;
        }
      }, 200);
    };

    editor.on('blur', handleBlur);
    return () => {
      editor.off('blur', handleBlur);
    };
  }, [editor, onSave, onAutoSave]);

  // Handle keyboard shortcuts (except Enter which is handled in editorProps.handleKeyDown)
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Escape - save and exit editing
      if (event.key === 'Escape') {
        event.preventDefault();
        handleSave();
        onCancel();
        return;
      }

      // Cmd/Ctrl + S - save
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault();
        handleSave();
        return;
      }

      // Skip navigation during pending transitions
      if (skipKeyboardNavigation) {
        if (event.key === 'Backspace' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          return;
        }
      }

      // Backspace on completely empty block - delete block and move to previous
      if (event.key === 'Backspace' && onDelete) {
        if (editor.isEmpty) {
          event.preventDefault();
          event.stopPropagation();
          onDelete();
          return;
        }
      }

      // ArrowUp at document start - move to previous block
      // For lists, check if cursor is at the very first text position
      if (event.key === 'ArrowUp' && onMoveToPrevBlock) {
        const { $anchor } = editor.state.selection;

        // Get the first text position in the document
        let firstTextPos = 1;
        try {
          // Walk the document to find the first text position
          const doc = editor.state.doc;
          doc.nodesBetween(0, doc.content.size, (node, pos) => {
            if (node.isTextblock) {
              firstTextPos = pos + 1; // Position inside the textblock
              return false; // Stop walking
            }
            return true;
          });
        } catch {
          firstTextPos = 1;
        }

        if ($anchor.pos <= firstTextPos) {
          event.preventDefault();
          event.stopPropagation();
          handleSave();
          onMoveToPrevBlock();
          return;
        }
      }

      // ArrowDown at document end - move to next block
      // For lists, check if cursor is at the very last text position
      if (event.key === 'ArrowDown' && onMoveToNextBlock) {
        const { $anchor } = editor.state.selection;

        // Get the last text position in the document
        let lastTextPos = editor.state.doc.content.size - 1;
        try {
          const doc = editor.state.doc;
          doc.nodesBetween(0, doc.content.size, (node, pos) => {
            if (node.isTextblock) {
              // Position at end of textblock content
              lastTextPos = pos + node.nodeSize - 1;
            }
            return true;
          });
        } catch {
          lastTextPos = editor.state.doc.content.size - 1;
        }

        if ($anchor.pos >= lastTextPos) {
          event.preventDefault();
          event.stopPropagation();
          handleSave();
          onMoveToNextBlock();
          return;
        }
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener('keydown', handleKeyDown);

    return () => {
      editorElement.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor, handleSave, onCancel, onDelete, onMoveToPrevBlock, onMoveToNextBlock, skipKeyboardNavigation]);

  // Cleanup timer and save on unmount if has changes
  useEffect(() => {
    return () => {
      // Clear auto-save timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Save any pending changes (use onAutoSave to avoid releasing lock on re-render)
      if (hasChangesRef.current && editor) {
        const content = JSON.stringify(editor.getJSON());
        if (content !== initialContentRef.current && content !== lastSavedContentRef.current) {
          if (onAutoSave) {
            onAutoSave(content);
          } else {
            onSave(content);
          }
        }
      }
    };
  }, [editor, onSave, onAutoSave]);

  // Ensure editor always has focus while mounted (editing mode)
  // This prevents cursor from disappearing during rapid navigation
  useEffect(() => {
    if (!editor) return;

    const ensureFocus = () => {
      if (editor.isDestroyed) return;
      if (editor.isFocused) return;

      // Don't steal focus if user is interacting with other input elements
      const activeElement = document.activeElement;
      if (activeElement) {
        const tagName = activeElement.tagName;
        const isOtherInput = (tagName === 'INPUT' || tagName === 'TEXTAREA') &&
          !activeElement.closest('.block-editor-wrapper');
        if (isOtherInput) return;
      }

      // Restore focus to editor
      editor.commands.focus();
    };

    // Focus immediately on mount
    ensureFocus();

    // Check focus periodically while editing (handles rapid navigation)
    const intervalId = setInterval(ensureFocus, 50);

    return () => clearInterval(intervalId);
  }, [editor]);

  if (!editor) {
    return <div className="block-editor-loading">Loading...</div>;
  }

  return (
    <div className="block-editor-wrapper">
      <EditorContent editor={editor} />
    </div>
  );
});

BlockEditor.displayName = 'BlockEditor';

export default BlockEditor;
