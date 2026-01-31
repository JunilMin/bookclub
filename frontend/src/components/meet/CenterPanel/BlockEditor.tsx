/**
 * BlockEditor - Inline TipTap editor for single block editing
 *
 * Seamless inline editing - looks like normal text until you type
 * Auto-saves on blur, supports keyboard shortcuts
 * Exposes editor instance via ref for external toolbar control
 */

import React, { useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
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

interface BlockEditorProps {
  block: Block;
  onSave: (content: string) => void;
  onAutoSave?: (content: string) => void; // For real-time sync (debounced)
  onCancel: () => void;
  onDelete?: () => void; // For backspace on empty block
  onMoveToPrevBlock?: () => void; // For ArrowUp at first line
  onMoveToNextBlock?: () => void; // For ArrowDown at last line
  onCreateBlockAfter?: (type: BlockType) => void;
  onSaveAndCreateNext?: (content: string) => void; // For Enter key: save + create next + focus
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
  autoFocus = true,
}, ref) => {
  const hasChangesRef = useRef(false);
  const initialContentRef = useRef(block.content);
  const lastSavedContentRef = useRef(block.content);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse and sanitize initial content to avoid "Empty text nodes are not allowed" error
  const initialContent = sanitizeContent(parseBlockContent(block.content));

  // Debounced auto-save for real-time sync
  const debouncedAutoSave = useCallback((content: string) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      if (content !== lastSavedContentRef.current && onAutoSave) {
        onAutoSave(content);
        lastSavedContentRef.current = content;
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [onAutoSave]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Type something...',
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: initialContent || '',
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
            } else {
              onSave(content);
            }
            lastSavedContentRef.current = content;
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

  // Handle keyboard shortcuts
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

      // Backspace on empty block - delete block
      if (event.key === 'Backspace' && onDelete) {
        const isEmpty = editor.isEmpty || editor.getText().trim() === '';
        if (isEmpty) {
          event.preventDefault();
          event.stopPropagation();
          onDelete();
          return;
        }
      }

      // ArrowUp at first line - move to previous block
      if (event.key === 'ArrowUp' && onMoveToPrevBlock) {
        const { $anchor } = editor.state.selection;
        // Check if cursor is at the start of the document (first line)
        const isAtFirstLine = $anchor.pos <= 1;
        if (isAtFirstLine) {
          event.preventDefault();
          event.stopPropagation();
          handleSave();
          onMoveToPrevBlock();
          return;
        }
      }

      // ArrowDown at last line - move to next block
      if (event.key === 'ArrowDown' && onMoveToNextBlock) {
        const { $anchor } = editor.state.selection;
        // Check if cursor is at the end of the document (last line)
        const isAtLastLine = $anchor.pos >= editor.state.doc.content.size - 1;
        if (isAtLastLine) {
          event.preventDefault();
          event.stopPropagation();
          handleSave();
          onMoveToNextBlock();
          return;
        }
      }

      // Enter (without Shift) - save current block, move to next or create new block
      // Shift+Enter - new line within same block (TipTap default)
      if (event.key === 'Enter' && !event.shiftKey) {
        // Prevent TipTap from inserting a newline
        event.preventDefault();
        event.stopPropagation();

        // Clear pending auto-save to prevent race condition
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = null;
        }

        const content = JSON.stringify(editor.getJSON());
        lastSavedContentRef.current = content; // Mark as saved to prevent duplicate saves

        if (onSaveAndCreateNext) {
          onSaveAndCreateNext(content);
        } else if (onCreateBlockAfter) {
          // Fallback if onSaveAndCreateNext not provided
          handleSave();
          onCreateBlockAfter('paragraph');
        }
        return;
      }
    };

    // Add listener to editor element with capture to intercept before TipTap
    const editorElement = editor.view.dom;
    editorElement.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      editorElement.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [editor, handleSave, onCancel, onDelete, onMoveToPrevBlock, onMoveToNextBlock, onCreateBlockAfter, onSaveAndCreateNext]);

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
