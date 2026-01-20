// frontend/src/screens/NoteDetail.tsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import {
  FiArrowLeft,
  FiCalendar,
  FiUsers,
  FiClock,
  FiStar,
  FiSave,
  FiEdit3,
  FiBook,
  FiUser
} from 'react-icons/fi';
import { useAuth } from '../AuthContext/AuthContext';
import {
  getNoteEnriched,
  updateUserNoteContent,
  updateUserNoteTitle,
  UserNoteResponse,
  ParticipantInfo
} from '../api/notes';
import Footer from '../components/Footer';
import './styles/NoteDetail.css';

// =============================================================================
// Helper Functions
// =============================================================================

function formatDate(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatDuration(minutes: number): string {
  if (!minutes) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function generateAvatar(name: string | null | undefined): string {
  const safeName = name && name.trim() ? name.trim() : 'U';
  const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
  const colorIndex = safeName.charCodeAt(0) % colors.length;
  const initial = safeName.charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <rect width="32" height="32" fill="${colors[colorIndex]}" rx="16"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-family="Arial" font-size="14" font-weight="bold">${initial}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Parse initial content for TipTap
function parseInitialContent(content: string): any {
  try {
    return JSON.parse(content);
  } catch {
    // If not JSON, convert plain text to TipTap format
    return {
      type: 'doc',
      content: content
        ? content.split('\n').map(line => ({
            type: 'paragraph',
            content: line ? [{ type: 'text', text: line }] : []
          }))
        : [{ type: 'paragraph' }]
    };
  }
}

// =============================================================================
// TipTap Toolbar Button Component
// =============================================================================

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
    className={`note-toolbar-btn ${isActive ? 'active' : ''}`}
    title={title}
    disabled={disabled}
  >
    {children}
  </button>
);

// =============================================================================
// Component
// =============================================================================

const NoteDetail: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { noteId } = useParams<{ noteId: string }>();
  const { accessToken } = useAuth();

  // State
  const [note, setNote] = useState<UserNoteResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  // TipTap Editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: t('note_detail_content_placeholder') || 'Start writing...',
      }),
    ],
    content: '',
    editable: false, // Start as read-only
    editorProps: {
      attributes: {
        class: 'note-tiptap-editor',
      },
    },
  });

  // Update editor editable state when editing changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);
    }
  }, [editor, isEditing]);

  // ==========================================================================
  // Data Fetching
  // ==========================================================================
  useEffect(() => {
    const fetchNote = async () => {
      if (!accessToken || !noteId) return;

      setIsLoading(true);
      setError(null);

      try {
        const data = await getNoteEnriched(noteId, accessToken);
        setNote(data);
        setEditedTitle(data.title || '');

        // Set TipTap content
        if (editor && data.content) {
          const parsedContent = parseInitialContent(data.content);
          editor.commands.setContent(parsedContent);
        }
      } catch (err) {
        console.error('Failed to fetch note:', err);
        setError(t('note_detail_error_fetch'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchNote();
  }, [accessToken, noteId, t, editor]);

  // ==========================================================================
  // Cancel Edit Handler
  // ==========================================================================
  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditedTitle(note?.title || '');

    // Reset editor content
    if (editor && note?.content) {
      const parsedContent = parseInitialContent(note.content);
      editor.commands.setContent(parsedContent);
    }
  }, [editor, note]);

  // ==========================================================================
  // Save Handler
  // ==========================================================================
  const handleSave = useCallback(async () => {
    if (!accessToken || !noteId || !note || !editor) return;

    setIsSaving(true);
    try {
      const currentContent = JSON.stringify(editor.getJSON());

      // Update title if changed
      if (editedTitle !== note.title) {
        await updateUserNoteTitle(noteId, editedTitle, accessToken);
      }
      // Update content if changed
      if (currentContent !== note.content) {
        await updateUserNoteContent(noteId, currentContent, accessToken);
      }
      // Refresh note
      const updated = await getNoteEnriched(noteId, accessToken);
      setNote(updated);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save note:', err);
      setError(t('note_detail_error_save'));
    } finally {
      setIsSaving(false);
    }
  }, [accessToken, noteId, note, editedTitle, editor, t]);

  // ==========================================================================
  // Participants List (memoized) - 호스트 제외, 호스트는 별도 섹션에 표시
  // ==========================================================================
  const participantsList = useMemo(() => {
    if (!note?.participants || note.participants.length === 0) {
      return null;
    }

    return (
      <div className="note-detail-participants">
        <div className="note-detail-participants-header">
          <FiUsers />
          <span>{t('note_detail_participants_label')}</span>
        </div>
        <div className="note-detail-participants-list">
          {note.participants.map((participant: ParticipantInfo) => (
            <div key={participant.id} className="note-detail-participant">
              <img
                src={participant.photoUrl || generateAvatar(participant.username)}
                alt={participant.username}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = generateAvatar(participant.username);
                }}
              />
              <div className="note-detail-participant-info">
                <span className="note-detail-participant-name">
                  {participant.username}
                </span>
                {participant.rating !== null && participant.rating > 0 && (
                  <span className="note-detail-participant-rating">
                    <FiStar size={12} /> {participant.rating}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }, [note?.participants, t]);

  // ==========================================================================
  // TipTap Toolbar (only shown in edit mode)
  // ==========================================================================
  const renderToolbar = useMemo(() => {
    if (!editor || !isEditing) return null;

    return (
      <div className="note-detail-toolbar">
        <div className="note-toolbar-group">
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

        <div className="note-toolbar-divider" />

        <div className="note-toolbar-group">
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

        <div className="note-toolbar-divider" />

        <div className="note-toolbar-group">
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

        <div className="note-toolbar-divider" />

        <div className="note-toolbar-group">
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
    );
  }, [editor, isEditing]);

  // ==========================================================================
  // Render: Login Required
  // ==========================================================================
  if (!accessToken) {
    return (
      <div className="note-detail-page">
        <div className="note-detail-login-required">
          <FiBook size={64} />
          <h2>{t('notes_login_required')}</h2>
          <button className="note-detail-login-btn" onClick={() => navigate('/login')}>
            {t('notes_login_button')}
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  // ==========================================================================
  // Render: Loading
  // ==========================================================================
  if (isLoading) {
    return (
      <div className="note-detail-page">
        <div className="note-detail-loading">
          <div className="note-detail-spinner" />
          <p>{t('note_detail_loading')}</p>
        </div>
        <Footer />
      </div>
    );
  }

  // ==========================================================================
  // Render: Error
  // ==========================================================================
  if (error || !note) {
    return (
      <div className="note-detail-page">
        <div className="note-detail-error">
          <FiBook size={48} />
          <h3>{t('note_detail_error_title')}</h3>
          <p>{error || t('note_detail_not_found')}</p>
          <button onClick={() => navigate('/notes')}>{t('note_detail_back')}</button>
        </div>
        <Footer />
      </div>
    );
  }

  // ==========================================================================
  // Render: Main Content
  // ==========================================================================
  return (
    <div className="note-detail-page">
      {/* Header */}
      <header className="note-detail-header">
        <button className="note-detail-back-btn" onClick={() => navigate('/notes')}>
          <FiArrowLeft />
          {t('note_detail_back')}
        </button>

        <div className="note-detail-actions">
          {isEditing ? (
            <>
              <button
                className="note-detail-cancel-btn"
                onClick={handleCancel}
                disabled={isSaving}
              >
                {t('note_detail_cancel')}
              </button>
              <button
                className="note-detail-save-btn"
                onClick={handleSave}
                disabled={isSaving}
              >
                <FiSave />
                {isSaving ? t('note_detail_saving') : t('note_detail_save')}
              </button>
            </>
          ) : (
            <button
              className="note-detail-edit-btn"
              onClick={() => setIsEditing(true)}
            >
              <FiEdit3 />
              {t('note_detail_edit')}
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="note-detail-main">
        {/* Sidebar */}
        <aside className="note-detail-sidebar">
          {/* Book Cover */}
          {(note.bookCover?.medium || note.bookCover?.small) && (
            <div className="note-detail-cover">
              <img src={note.bookCover?.medium || note.bookCover?.small} alt={note.bookTitle} />
            </div>
          )}

          {/* Book Info */}
          <div className="note-detail-book-info">
            <h3>{note.bookTitle}</h3>
            <p className="note-detail-author">{note.bookAuthor}</p>
            {note.bookGenre && (
              <span className="note-detail-genre">{note.bookGenre}</span>
            )}
          </div>

          {/* Meeting Info */}
          <div className="note-detail-meeting-info">
            <div className="note-detail-info-item">
              <FiCalendar />
              <span>{formatDate(note.meetingDate)}</span>
            </div>
            <div className="note-detail-info-item">
              <FiUsers />
              <span>{note.participantCount} {t('note_detail_participants')}</span>
            </div>
            <div className="note-detail-info-item">
              <FiClock />
              <span>{formatDuration(note.duration)}</span>
            </div>
          </div>

          {/* Host Info */}
          <div className="note-detail-host">
            <div className="note-detail-host-header">
              <FiUser />
              <span>{t('note_detail_host')}</span>
            </div>
            <div className="note-detail-host-content">
              <img
                src={note.hostPhotoUrl || generateAvatar(note.hostUsername)}
                alt={note.hostUsername}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = generateAvatar(note.hostUsername);
                }}
              />
              <div className="note-detail-host-info">
                <span className="note-detail-host-name">{note.hostUsername}</span>
                {note.hostRating > 0 && (
                  <span className="note-detail-host-rating">
                    <FiStar size={12} /> {note.hostRating}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Participants List */}
          {participantsList}

          {/* AI Summary (if available) */}
          {note.aiSummary && (
            <div className="note-detail-summary">
              <h4>{t('note_detail_ai_summary')}</h4>
              <p className="note-detail-one-liner">{note.aiSummary.oneLiner}</p>
              {note.aiSummary.keyPoints && note.aiSummary.keyPoints.length > 0 && (
                <div className="note-detail-keypoints">
                  <span>{t('notes_key_points')}</span>
                  <ul>
                    {note.aiSummary.keyPoints.map((point, idx) => (
                      <li key={idx}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Note Content */}
        <section className="note-detail-content">
          {isEditing ? (
            <>
              <input
                type="text"
                className="note-detail-title-input"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                placeholder={t('note_detail_title_placeholder')}
              />
              {renderToolbar}
              <div className={`note-detail-editor-wrapper ${isEditing ? 'editing' : ''}`}>
                <EditorContent editor={editor} />
              </div>
            </>
          ) : (
            <>
              <h1 className="note-detail-title">{note.title}</h1>
              <div className="note-detail-body">
                <EditorContent editor={editor} />
              </div>
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default NoteDetail;
