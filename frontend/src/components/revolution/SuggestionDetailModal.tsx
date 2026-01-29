import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiX,
  FiArrowUp,
  FiMessageSquare,
  FiSend,
  FiTrash2,
  FiCheck,
  FiLoader,
  FiEye,
  FiClock,
  FiXCircle,
} from 'react-icons/fi';
import { Suggestion, SuggestionComment, SuggestionStatus } from '../../types/suggestion';
import {
  getSuggestionById,
  getComments,
  createComment,
  toggleVote,
  deleteComment,
} from '../../api/suggestions';
import { useAuth } from '../../AuthContext/AuthContext';
import './SuggestionDetailModal.css';

interface SuggestionDetailModalProps {
  isOpen: boolean;
  suggestionId: string | null;
  onClose: () => void;
  onSuggestionUpdate: (suggestion: Suggestion) => void;
}

const SuggestionDetailModal: React.FC<SuggestionDetailModalProps> = ({
  isOpen,
  suggestionId,
  onClose,
  onSuggestionUpdate,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [comments, setComments] = useState<SuggestionComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  useEffect(() => {
    if (isOpen && suggestionId) {
      fetchSuggestionAndComments();
    }
  }, [isOpen, suggestionId]);

  const fetchSuggestionAndComments = async () => {
    if (!suggestionId) return;
    setIsLoading(true);
    try {
      const [suggestionData, commentsData] = await Promise.all([
        getSuggestionById(suggestionId),
        getComments(suggestionId),
      ]);
      setSuggestion(suggestionData);
      setComments(commentsData);
    } catch (error) {
      console.error('Failed to fetch suggestion details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async () => {
    if (!suggestion || !user || isVoting) return;
    setIsVoting(true);
    try {
      const updated = await toggleVote(suggestion.id);
      setSuggestion(updated);
      onSuggestionUpdate(updated);
    } catch (error) {
      console.error('Failed to toggle vote:', error);
    } finally {
      setIsVoting(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestion || !newComment.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const comment = await createComment(suggestion.id, { content: newComment.trim() });
      setComments([...comments, comment]);
      setNewComment('');

      // 댓글 수 업데이트
      setSuggestion(prev =>
        prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev
      );
    } catch (error) {
      console.error('Failed to create comment:', error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm(t('revolution_delete_comment_confirm') || '댓글을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteComment(commentId);
      setComments(comments.filter(c => c.id !== commentId));

      // 댓글 수 업데이트
      setSuggestion(prev =>
        prev ? { ...prev, commentCount: Math.max(0, prev.commentCount - 1) } : prev
      );
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const getStatusIcon = (status: SuggestionStatus) => {
    switch (status) {
      case 'implemented':
        return <FiCheck size={14} />;
      case 'planned':
        return <FiLoader size={14} />;
      case 'in_review':
        return <FiEye size={14} />;
      case 'rejected':
        return <FiXCircle size={14} />;
      default:
        return <FiClock size={14} />;
    }
  };

  const getStatusLabel = (status: SuggestionStatus) => {
    switch (status) {
      case 'implemented':
        return t('revolution_status_completed') || '해결완료';
      case 'planned':
        return t('revolution_status_progress') || '진행중';
      case 'in_review':
        return t('revolution_status_reviewing') || '검토중';
      case 'rejected':
        return t('revolution_status_rejected') || '반려';
      default:
        return t('revolution_status_pending') || '대기중';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleClose = () => {
    setSuggestion(null);
    setComments([]);
    setNewComment('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="suggestion-detail-modal" onClick={e => e.stopPropagation()}>
        {isLoading ? (
          <div className="modal-loading">
            <div className="loading-spinner-large"></div>
          </div>
        ) : suggestion ? (
          <>
            {/* Header */}
            <div className="detail-modal-header">
              <div className="header-left">
                <span className={`detail-status-badge ${suggestion.status}`}>
                  {getStatusIcon(suggestion.status)}
                  {getStatusLabel(suggestion.status)}
                </span>
              </div>
              <button className="modal-close-btn" onClick={handleClose}>
                <FiX size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="detail-modal-content">
              {/* Suggestion Info */}
              <div className="suggestion-detail-info">
                <h2 className="suggestion-detail-title">{suggestion.title}</h2>

                <div className="suggestion-detail-meta">
                  <div className="detail-author">
                    <div className="detail-author-avatar">
                      {suggestion.authorPhotoUrl ? (
                        <img src={suggestion.authorPhotoUrl} alt={suggestion.authorName} />
                      ) : (
                        <span>{suggestion.authorName.charAt(0)}</span>
                      )}
                    </div>
                    <div className="detail-author-info">
                      <span className="detail-author-name">{suggestion.authorName}</span>
                      <span className="detail-date">{formatDate(suggestion.createdAt)}</span>
                    </div>
                  </div>

                  <button
                    className={`detail-vote-btn ${suggestion.hasVoted ? 'voted' : ''}`}
                    onClick={handleVote}
                    disabled={!user || isVoting}
                  >
                    <FiArrowUp size={20} />
                    <span>{suggestion.upvoteCount}</span>
                  </button>
                </div>

                <div className="suggestion-detail-content">
                  <p>{suggestion.content}</p>
                </div>

                {suggestion.tags && suggestion.tags.length > 0 && (
                  <div className="suggestion-detail-tags">
                    {suggestion.tags.map(tag => (
                      <span key={tag} className="detail-tag">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Comments Section */}
              <div className="comments-section">
                <h3 className="comments-title">
                  <FiMessageSquare size={20} />
                  {t('revolution_comments') || '댓글'}
                  <span className="comments-count">{comments.length}</span>
                </h3>

                {/* Comment List */}
                <div className="comments-list">
                  {comments.length === 0 ? (
                    <div className="no-comments">
                      {t('revolution_no_comments') || '아직 댓글이 없습니다. 첫 댓글을 작성해보세요!'}
                    </div>
                  ) : (
                    comments.map(comment => (
                      <div key={comment.id} className="comment-item">
                        <div className="comment-avatar">
                          {comment.authorPhotoUrl ? (
                            <img src={comment.authorPhotoUrl} alt={comment.authorName} />
                          ) : (
                            <span>{comment.authorName.charAt(0)}</span>
                          )}
                        </div>
                        <div className="comment-body">
                          <div className="comment-header">
                            <span className="comment-author">{comment.authorName}</span>
                            <span className="comment-date">{formatDateTime(comment.createdAt)}</span>
                            {user && comment.authorId === user.uid && (
                              <button
                                className="comment-delete-btn"
                                onClick={() => handleDeleteComment(comment.id)}
                              >
                                <FiTrash2 size={14} />
                              </button>
                            )}
                          </div>
                          <p className="comment-content">{comment.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Comment Form */}
                {user ? (
                  <form className="comment-form" onSubmit={handleSubmitComment}>
                    <div className="comment-input-wrapper">
                      <div className="comment-input-avatar">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="Me" />
                        ) : (
                          <span>{user.displayName?.charAt(0) || 'U'}</span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder={t('revolution_comment_placeholder') || '댓글을 입력하세요...'}
                        maxLength={500}
                      />
                      <button
                        type="submit"
                        className="comment-submit-btn"
                        disabled={!newComment.trim() || isSubmittingComment}
                      >
                        {isSubmittingComment ? (
                          <div className="loading-spinner-small"></div>
                        ) : (
                          <FiSend size={18} />
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="login-to-comment">
                    {t('revolution_login_to_comment') || '댓글을 작성하려면 로그인이 필요합니다.'}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="modal-error-state">
            {t('revolution_error_load_failed') || '건의사항을 불러오는데 실패했습니다.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default SuggestionDetailModal;
