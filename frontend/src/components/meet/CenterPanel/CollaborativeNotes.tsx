import React, { useMemo, forwardRef, useImperativeHandle, useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { EditorContent } from '@tiptap/react';
import { FiUser, FiCheck, FiCloud, FiWifi, FiWifiOff, FiEdit2, FiLoader, FiFileText, FiCpu } from 'react-icons/fi';
import { useCollaborativeEditor } from '../../../hooks/useCollaborativeEditor';
import { RemoteUser } from '../../../types/collaborative';
import { updateNoteTitle, updateAiNotes } from '../../../api/notes';
import { useAuth } from '../../../AuthContext/AuthContext';
import '../styles/CenterPanel.css';

/**
 * CollaborativeNotes (Op-based Version)
 *
 * 변경점 (기존 대비):
 * 1. JSON 전체 브로드캐스트 → Step 기반 op 전송
 * 2. 매 키 입력마다 전송 → debounce/batch 전송 (50ms)
 * 3. 전체 replace → 원격 step만 적용 (커서 유지)
 * 4. presence 분리 (throttle 100ms)
 *
 * UI/UX는 기존과 동일하게 유지
 */

interface AIValidation {
  valid: boolean;
  sourceFragmentIds: string[];
  outputFragmentIds: string[];
  missingFragments: string[];
  validationError: string;
}

interface CollaborativeNotesProps {
  docId: string;
  userId: string;
  username: string;
  photoUrl?: string;
  initialContent?: any;
  initialTitle?: string;
  aiContent?: any;
  aiValidation?: AIValidation | null;
  isOrganizing?: boolean;
  onCharCountChange?: (charCount: number) => void;
  onOrganizeNotes?: () => void;
}

export interface CollaborativeNotesRef {
  insertContentAtEnd: (content: any) => void;
  insertTranscription: (content: any, sectionTitle: string) => void;
}

type NoteTab = 'free' | 'ai';

const CollaborativeNotes = forwardRef<CollaborativeNotesRef, CollaborativeNotesProps>(({
  docId,
  userId,
  username,
  photoUrl = '',
  initialContent,
  initialTitle = 'Discussion Notes',
  aiContent,
  aiValidation,
  isOrganizing = false,
  onCharCountChange,
  onOrganizeNotes,
}, ref) => {
  const { t } = useTranslation();
  const { accessToken } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<NoteTab>('free');

  // Title editing state
  const [title, setTitle] = useState(initialTitle);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Update title when initialTitle changes
  useEffect(() => {
    if (initialTitle) {
      setTitle(initialTitle);
      setTempTitle(initialTitle);
    }
  }, [initialTitle]);

  // === Custom save function for AI notes ===
  const saveAiNotes = useCallback(async (
    docIdParam: string,
    content: string,
    userIdParam: string,
    usernameParam: string,
    token: string
  ) => {
    // Extract original sessionId from AI docId (remove '-ai' suffix)
    const sessionId = docIdParam.replace(/-ai$/, '');
    return updateAiNotes(sessionId, content, userIdParam, usernameParam, token);
  }, []);

  // === Op-based Collaborative Hook for Free Notes ===
  const {
    editor,
    isConnected,
    isSyncing,
    remoteUsers,
  } = useCollaborativeEditor({
    docId,
    userId,
    username,
    photoUrl,
    initialContent,
    placeholder: t('meet_notes_placeholder') || 'Start taking notes...',
    enableDragHandle: true,
  });

  // === Op-based Collaborative Hook for AI Notes ===
  const {
    editor: aiEditor,
    isConnected: aiIsConnected,
    isSyncing: aiIsSyncing,
    remoteUsers: aiRemoteUsers,
  } = useCollaborativeEditor({
    docId: `${docId}-ai`,
    userId,
    username,
    photoUrl,
    initialContent: aiContent,
    placeholder: t('meet_ai_notes_placeholder') || 'AI organized content will appear here...',
    customSave: saveAiNotes,
  });

  // Update AI editor content when aiContent changes (from AI organize)
  useEffect(() => {
    if (aiEditor && aiContent) {
      // Only update if the content is different to avoid loops
      const currentContent = JSON.stringify(aiEditor.getJSON());
      const newContent = typeof aiContent === 'string' ? aiContent : JSON.stringify(aiContent);
      if (currentContent !== newContent) {
        try {
          const parsedContent = typeof aiContent === 'string' ? JSON.parse(aiContent) : aiContent;
          aiEditor.commands.setContent(parsedContent);
        } catch {
          aiEditor.commands.setContent(aiContent);
        }
      }
    }
  }, [aiEditor, aiContent]);

  // Track character count for attendance (only counts NEW characters typed by the user)
  const lastCharCountRef = useRef<number>(-1); // -1 means not initialized yet
  const baseCharCountRef = useRef<number>(0);  // Initial content length (not counted)
  useEffect(() => {
    if (!editor || !onCharCountChange) return;

    const updateCharCount = () => {
      const text = editor.getText();
      const currentCharCount = text.length;

      // On first call, set the base count (existing content is not counted for attendance)
      if (lastCharCountRef.current === -1) {
        baseCharCountRef.current = currentCharCount;
        lastCharCountRef.current = currentCharCount;
        // Don't call onCharCountChange on initial load
        return;
      }

      // Calculate new characters added (relative to base)
      const newCharsAdded = Math.max(0, currentCharCount - baseCharCountRef.current);

      // Only call callback if changed significantly (debounce small changes)
      if (Math.abs(currentCharCount - lastCharCountRef.current) >= 5) {
        lastCharCountRef.current = currentCharCount;
        // Report only the NEW characters added by this user
        onCharCountChange(newCharsAdded);
      }
    };

    // Initialize with current text length
    updateCharCount();

    // Listen to updates
    editor.on('update', updateCharCount);

    return () => {
      editor.off('update', updateCharCount);
    };
  }, [editor, onCharCountChange]);

  // === Title Editing Handlers ===
  const handleTitleDoubleClick = () => {
    setIsEditingTitle(true);
    setTempTitle(title);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempTitle(e.target.value);
  };

  const handleTitleSave = async () => {
    if (!tempTitle.trim() || !accessToken) {
      setIsEditingTitle(false);
      setTempTitle(title);
      return;
    }

    try {
      await updateNoteTitle(docId, tempTitle.trim(), userId, username, accessToken);
      setTitle(tempTitle.trim());
      setIsEditingTitle(false);
    } catch (error) {
      console.error('Failed to update title:', error);
      setTempTitle(title);
      setIsEditingTitle(false);
    }
  };

  const handleTitleBlur = () => {
    handleTitleSave();
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setTempTitle(title);
    }
  };

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // === Expose methods to parent ===
  useImperativeHandle(ref, () => ({
    insertContentAtEnd: (content: any) => {
      // Choose the appropriate editor based on active tab
      const targetEditor = activeTab === 'ai' ? aiEditor : editor;
      if (!targetEditor) return;

      // Get the end position of the document (after all content)
      const endPos = targetEditor.state.doc.content.size;

      // Build content array - spread if content is already an array
      const contentArray = Array.isArray(content) ? content : [content];
      const insertNodes = [
        { type: 'paragraph', content: [] }, // Empty line before
        ...contentArray,
        { type: 'paragraph', content: [] }, // Empty line after
      ];

      // Insert at the absolute end of the document to avoid nesting
      targetEditor
        .chain()
        .focus()
        .setTextSelection(endPos)
        .insertContentAt(endPos, insertNodes)
        .run();
    },
    insertTranscription: (content: any, sectionTitle: string) => {
      // For transcription, always use the free notes editor
      if (!editor) return;

      const docContent = editor.getJSON();
      const TRANSCRIPTION_MARKER = '📝 ' + sectionTitle;

      // Check if transcription section already exists
      let hasTranscriptionSection = false;
      if (docContent.content) {
        for (const node of docContent.content) {
          if (node.type === 'heading' && node.content) {
            const text = node.content.map((c: any) => c.text || '').join('');
            if (text.includes(TRANSCRIPTION_MARKER)) {
              hasTranscriptionSection = true;
              break;
            }
          }
        }
      }

      // Get the end position of the document
      const endPos = editor.state.doc.content.size;

      // Build content to insert
      const insertContent: any[] = [];

      // If no transcription section, add it first
      if (!hasTranscriptionSection) {
        insertContent.push(
          { type: 'paragraph', content: [] },
          { type: 'horizontalRule' },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: TRANSCRIPTION_MARKER }],
          },
          { type: 'paragraph', content: [] }
        );
      }

      // Add the transcription content
      insertContent.push(content);
      insertContent.push({ type: 'paragraph', content: [] });

      // Insert at the absolute end to avoid nesting
      editor
        .chain()
        .focus()
        .setTextSelection(endPos)
        .insertContentAt(endPos, insertContent)
        .run();
    },
  }), [editor, aiEditor, activeTab]);

  // === Toolbar Button Component ===
  const ToolbarButton: React.FC<{
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
    title: string;
    disabled?: boolean;
  }> = ({ onClick, isActive, children, title, disabled }) => (
    <button
      type="button"
      onClick={onClick}
      className={`toolbar-btn ${isActive ? 'active' : ''}`}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  );

  // === Remote Users Display (includes self) ===
  const RemoteUserAvatars = useMemo(() => {
    if (remoteUsers.length === 0) return null;

    return (
      <div className="presence-avatars">
        {remoteUsers.slice(0, 4).map((user: RemoteUser) => (
          <div
            key={user.clientId}
            className="presence-avatar"
            title={user.username}
            style={{ borderColor: user.color }}
          >
            {user.photoUrl ? (
              <img
                src={user.photoUrl}
                alt={user.username}
              />
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

  // === Loading State ===
  if (!editor) {
    return <div className="notes-loading">{t('loading') || 'Loading...'}</div>;
  }

  return (
    <div className="collaborative-notes">
      {/* Header */}
      <div className="notes-header">
        <div className="notes-title-section">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={tempTitle}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              className="notes-title-input"
              maxLength={100}
            />
          ) : (
            <div className="notes-title-container">
              <h2 onDoubleClick={handleTitleDoubleClick}>{title}</h2>
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
                {t('meet_editors_active', { count: remoteUsers.length })}
              </span>
            )}
          </div>
        </div>
        <div className="notes-status">
          {/* Remote Users */}
          {RemoteUserAvatars}

          {/* Connection Status */}
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? (
              <FiWifi size={14} />
            ) : (
              <FiWifiOff size={14} />
            )}
          </span>

          {/* Sync Status */}
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
          {/* Toolbar */}
          <div className="notes-toolbar">
            <div className="toolbar-group">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
                title="Bold (Ctrl+B)"
              >
                <strong>B</strong>
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
                title="Italic (Ctrl+I)"
              >
                <em>I</em>
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                isActive={editor.isActive('strike')}
                title="Strikethrough"
              >
                <s>S</s>
              </ToolbarButton>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                isActive={editor.isActive('heading', { level: 1 })}
                title="Heading 1"
              >
                H1
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive('heading', { level: 2 })}
                title="Heading 2"
              >
                H2
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                isActive={editor.isActive('heading', { level: 3 })}
                title="Heading 3"
              >
                H3
              </ToolbarButton>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
                title="Bullet List"
              >
                •
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive('orderedList')}
                title="Numbered List"
              >
                1.
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                isActive={editor.isActive('taskList')}
                title="Task List"
              >
                ☑
              </ToolbarButton>
            </div>

            <div className="toolbar-divider" />

            <div className="toolbar-group">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={editor.isActive('blockquote')}
                title="Quote"
              >
                "
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                isActive={editor.isActive('codeBlock')}
                title="Code Block"
              >
                {'</>'}
              </ToolbarButton>
            </div>
          </div>

          {/* Editor */}
          <div className="notes-editor-wrapper">
            <EditorContent editor={editor} />
          </div>

          {/* Footer hint */}
          <div className="notes-footer">
            <span className="notes-hint">
              {t('meet_notes_hint') || 'Changes are automatically saved and synced in real-time'}
            </span>
            {!isConnected && (
              <span className="offline-warning">
                ⚠️ Offline - changes will sync when reconnected
              </span>
            )}
          </div>
        </>
      )}

      {/* AI Notes Tab Content */}
      {activeTab === 'ai' && (
        <>
          {/* AI Toolbar */}
          {aiEditor && aiContent && (
            <div className="notes-toolbar ai-toolbar">
              <div className="toolbar-group">
                <ToolbarButton
                  onClick={() => aiEditor.chain().focus().toggleBold().run()}
                  isActive={aiEditor.isActive('bold')}
                  title="Bold (Ctrl+B)"
                >
                  <strong>B</strong>
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => aiEditor.chain().focus().toggleItalic().run()}
                  isActive={aiEditor.isActive('italic')}
                  title="Italic (Ctrl+I)"
                >
                  <em>I</em>
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => aiEditor.chain().focus().toggleStrike().run()}
                  isActive={aiEditor.isActive('strike')}
                  title="Strikethrough"
                >
                  <s>S</s>
                </ToolbarButton>
              </div>

              <div className="toolbar-divider" />

              <div className="toolbar-group">
                <ToolbarButton
                  onClick={() => aiEditor.chain().focus().toggleHeading({ level: 1 }).run()}
                  isActive={aiEditor.isActive('heading', { level: 1 })}
                  title="Heading 1"
                >
                  H1
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => aiEditor.chain().focus().toggleHeading({ level: 2 }).run()}
                  isActive={aiEditor.isActive('heading', { level: 2 })}
                  title="Heading 2"
                >
                  H2
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => aiEditor.chain().focus().toggleHeading({ level: 3 }).run()}
                  isActive={aiEditor.isActive('heading', { level: 3 })}
                  title="Heading 3"
                >
                  H3
                </ToolbarButton>
              </div>

              <div className="toolbar-divider" />

              <div className="toolbar-group">
                <ToolbarButton
                  onClick={() => aiEditor.chain().focus().toggleBulletList().run()}
                  isActive={aiEditor.isActive('bulletList')}
                  title="Bullet List"
                >
                  •
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => aiEditor.chain().focus().toggleOrderedList().run()}
                  isActive={aiEditor.isActive('orderedList')}
                  title="Numbered List"
                >
                  1.
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => aiEditor.chain().focus().toggleTaskList().run()}
                  isActive={aiEditor.isActive('taskList')}
                  title="Task List"
                >
                  ☑
                </ToolbarButton>
              </div>

              <div className="toolbar-divider" />

              <div className="toolbar-group">
                <ToolbarButton
                  onClick={() => aiEditor.chain().focus().toggleBlockquote().run()}
                  isActive={aiEditor.isActive('blockquote')}
                  title="Quote"
                >
                  "
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => aiEditor.chain().focus().toggleCodeBlock().run()}
                  isActive={aiEditor.isActive('codeBlock')}
                  title="Code Block"
                >
                  {'</>'}
                </ToolbarButton>
              </div>

              {/* AI Status indicators */}
              <div className="toolbar-status">
                <span className={`connection-status ${aiIsConnected ? 'connected' : 'disconnected'}`}>
                  {aiIsConnected ? <FiWifi size={12} /> : <FiWifiOff size={12} />}
                </span>
                <span className="sync-status small">
                  {aiIsSyncing ? <FiCloud className="syncing" size={12} /> : <FiCheck size={12} />}
                </span>
                {aiRemoteUsers.length > 0 && (
                  <span className="editors-badge">{aiRemoteUsers.length}</span>
                )}
              </div>
            </div>
          )}

          {/* AI Editor (Collaborative) */}
          <div className={`notes-editor-wrapper ai-editor ${aiContent ? 'has-content' : 'empty'}`}>
            {aiContent ? (
              <EditorContent editor={aiEditor} />
            ) : (
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
          </div>

          {/* AI Footer */}
          <div className="notes-footer ai-footer">
            <span className="notes-hint">
              {aiContent
                ? (t('meet_ai_notes_hint_editable') || 'AI 정리 내용을 자유롭게 편집할 수 있습니다. 변경사항은 실시간으로 동기화됩니다.')
                : (t('meet_ai_notes_hint') || 'AI가 공유 노트를 자동으로 정리합니다. 원본 내용은 유지됩니다.')
              }
            </span>
            {aiValidation && !aiValidation.valid && aiValidation.missingFragments.length > 0 && (
              <span className="validation-warning">
                ⚠️ {aiValidation.missingFragments.length}개의 내용이 누락되었습니다.
              </span>
            )}
            {!aiIsConnected && aiContent && (
              <span className="offline-warning">
                ⚠️ Offline - changes will sync when reconnected
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
});

CollaborativeNotes.displayName = 'CollaborativeNotes';

export default CollaborativeNotes;
