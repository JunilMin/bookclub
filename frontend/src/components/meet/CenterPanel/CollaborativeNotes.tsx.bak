import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EditorContent } from '@tiptap/react';
import { FiUser, FiCheck, FiCloud, FiWifi, FiWifiOff } from 'react-icons/fi';
import { useCollaborativeEditor } from '../../../hooks/useCollaborativeEditor';
import { RemoteUser } from '../../../types/collaborative';
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

interface CollaborativeNotesProps {
  docId: string;
  userId: string;
  username: string;
  initialContent?: any;
}

const CollaborativeNotes: React.FC<CollaborativeNotesProps> = ({
  docId,
  userId,
  username,
  initialContent,
}) => {
  const { t } = useTranslation();

  // === Op-based Collaborative Hook ===
  const {
    editor,
    isConnected,
    isSyncing,
    remoteUsers,
  } = useCollaborativeEditor({
    docId,
    userId,
    username,
    initialContent,
    placeholder: t('meet_notes_placeholder') || 'Start taking notes...',
  });

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

  // === Remote Users Display ===
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
            <FiUser size={12} />
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
          <h2>{t('meet_discussion_notes') || 'Discussion Notes'}</h2>
          <div className="notes-meta">
            {remoteUsers.length > 0 && (
              <span className="editors-count">
                {remoteUsers.length} {remoteUsers.length === 1 ? 'editor' : 'editors'} active
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

        {/* Remote Cursors Overlay (향후 구현) */}
        {/* <RemoteCursors users={remoteUsers} editor={editor} /> */}
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
    </div>
  );
};

export default CollaborativeNotes;
