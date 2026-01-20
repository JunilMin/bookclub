import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiX, FiUser, FiCalendar, FiClock, FiUsers, FiExternalLink, FiTrash2, FiVideo, FiEdit2, FiSave, FiXCircle, FiLogOut } from 'react-icons/fi';
import { joinSession } from '../api/sessions';
import { updatePost, leaveBookMeeting } from '../api/posts';
import { useAuth } from '../AuthContext/AuthContext';
import './styles/RoomModal.css';

// Generate book cover placeholder SVG
function generateBookCoverPlaceholder(title: string): string {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
  const colorIndex = (title.charCodeAt(0) || 0) % colors.length;
  const bgColor = colors[colorIndex];

  // Truncate title if too long
  const displayTitle = title.length > 30 ? title.slice(0, 27) + '...' : title;
  const lines = displayTitle.match(/.{1,15}/g) || [displayTitle];

  const textElements = lines.map((line, i) =>
    `<text x="50%" y="${45 + i * 12}%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="11" font-weight="500">${line}</text>`
  ).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="224" height="320" viewBox="0 0 224 320">
    <rect width="224" height="320" fill="${bgColor}" rx="8"/>
    <rect x="15" y="15" width="194" height="290" fill="rgba(255,255,255,0.1)" rx="4"/>
    ${textElements}
    <text x="50%" y="85%" dominant-baseline="middle" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-family="Arial, sans-serif" font-size="10">BookClub</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Book cover interface
export interface BookCover {
  small?: string;
  medium?: string;
}

// Room interface (same as in Board.tsx)
export interface Room {
  id: string;
  title: string;
  host: string;
  hostAvatar: string;
  book: {
    title: string;
    author: string;
    cover: BookCover;
    genre: string;
    isbn: string;
  };
  dueISO: string;
  duration: number;
  participants: number;
  maxParticipants: number;
  level: 'low' | 'moderate' | 'high';
  description: string;
  tags: string[];
  status: 'live' | 'upcoming' | 'past' | 'waiting';
  activeParticipants: number; // 현재 세션에 참가 중인 인원
  isJoined: boolean;
  isMyRoom: boolean;
  meetLink?: string | null;
  calendarEventId?: string | null;
  recruit?: boolean; // 모집 중 여부 (기본값: true)
  api?: 'google' | 'naver'; // 도서 검색 API 출처 (언어별 필터링용)
}

interface RoomModalProps {
  room: Room;
  onClose: () => void;
  onJoin: (roomId: string) => void;
  onDelete?: (roomId: string) => void;
  onUpdate?: () => void;
  isProcessing?: boolean;
}

const RoomModal: React.FC<RoomModalProps> = ({ room, onClose, onJoin, onDelete, onUpdate, isProcessing }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const [isEntering, setIsEntering] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    date: '',
    time: '',
    duration: room.duration,
    capacity: room.maxParticipants,
    level: room.level,
    description: room.description,
    tags: room.tags,
    newTag: ''
  });

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getLevelText = (level: string) => {
    switch (level) {
      case 'low': return t('browse_level_low');
      case 'moderate': return t('browse_level_moderate');
      case 'high': return t('browse_level_high');
      default: return level;
    }
  };

  const handleJoinClick = () => {
    if (room.isJoined || room.isMyRoom) {
      // Navigate to meeting page
      navigate(`/meeting/${room.id}`, { state: { meetLink: room.meetLink, room } });
    } else {
      onJoin(room.id);
    }
  };

  // 미팅 입장하기 - 세션 생성/조회 후 /meet/:sessionId로 이동
  const handleEnterMeeting = async () => {
    if (!accessToken) {
      navigate('/login');
      return;
    }

    setIsEntering(true);
    try {
      const response = await joinSession(room.id, accessToken);
      navigate(`/meet-room/${response.sessionId}`);
    } catch (error: any) {
      console.error('Failed to enter meeting:', error);
      if (error.response?.status === 403) {
        alert(t('meeting_not_participant') || 'You are not a participant of this meeting');
      } else if (error.response?.status === 404) {
        alert(t('meeting_not_found') || 'Meeting not found');
      } else {
        alert(t('meeting_enter_error') || 'Failed to enter meeting');
      }
    } finally {
      setIsEntering(false);
    }
  };

  const handleCreateSimilar = () => {
    navigate('/board/create', { state: { isbn: room.book.isbn } });
  };

  const handleOpenMeet = () => {
    if (room.meetLink) {
      window.open(room.meetLink, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDelete = () => {
    if (onDelete && window.confirm(t('browse_modal_delete_confirm'))) {
      onDelete(room.id);
    }
  };

  const handleLeave = async () => {
    if (!accessToken || !user?.id) {
      alert(t('login_required') || 'Please login first');
      return;
    }

    if (!window.confirm(t('browse_modal_leave_confirm') || 'Are you sure you want to leave this room?')) {
      return;
    }

    setIsLeaving(true);
    try {
      await leaveBookMeeting(room.id, user.id, accessToken);
      alert(t('browse_modal_leave_success') || 'Successfully left the room');
      onClose();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to leave room:', error);
      alert(t('browse_modal_leave_failed') || 'Failed to leave the room');
    } finally {
      setIsLeaving(false);
    }
  };

  const handleEditClick = () => {
    // Initialize edit form with current values
    const dueDate = new Date(room.dueISO);
    const dateStr = dueDate.toISOString().split('T')[0];
    const timeStr = dueDate.toTimeString().slice(0, 5);

    setEditForm({
      date: dateStr,
      time: timeStr,
      duration: room.duration,
      capacity: room.maxParticipants,
      level: room.level,
      description: room.description,
      tags: [...room.tags],
      newTag: ''
    });
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
  };

  const handleSaveEdit = async () => {
    if (!accessToken) return;

    setIsSaving(true);
    try {
      // Combine date and time
      const dueDateTime = new Date(`${editForm.date}T${editForm.time}`);

      await updatePost(
        room.id,
        {
          due: dueDateTime.toISOString().slice(0, -5),
          capacity: editForm.capacity,
          level: editForm.level,
          duration: editForm.duration,
          description: editForm.description,
          tags: editForm.tags,
        },
        accessToken
      );

      alert(t('browse_modal_update_success') || 'Room updated successfully');
      setIsEditMode(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to update room:', error);
      alert(t('browse_modal_update_failed') || 'Failed to update room');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = () => {
    if (editForm.newTag.trim() && !editForm.tags.includes(editForm.newTag.trim())) {
      setEditForm({
        ...editForm,
        tags: [...editForm.tags, editForm.newTag.trim()],
        newTag: ''
      });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditForm({
      ...editForm,
      tags: editForm.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleCloseRecruitment = async () => {
    if (!accessToken) return;
    if (!window.confirm(t('browse_modal_close_recruitment_confirm') || 'Close recruitment for this room?')) return;

    try {
      await updatePost(
        room.id,
        {
          recruit: false // 모집 마감,
        },
        accessToken
      );
      alert(t('browse_modal_close_recruitment_success') || 'Recruitment closed');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to close recruitment:', error);
      alert(t('browse_modal_close_recruitment_failed') || 'Failed to close recruitment');
    }
  };

  const handleOpenRecruitment = async () => {
    if (!accessToken) return;
    if (!window.confirm(t('browse_modal_open_recruitment_confirm') || 'Open recruitment for this room?')) return;

    try {
      await updatePost(
        room.id,
        {
          recruit: true // 모집 열기
        },
        accessToken
      );
      alert(t('browse_modal_open_recruitment_success') || 'Recruitment opened');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to open recruitment:', error);
      alert(t('browse_modal_open_recruitment_failed') || 'Failed to open recruitment');
    }
  };

  const spotsLeft = room.maxParticipants - room.participants;

  return (
    <div className="room-modal-overlay" onClick={handleOverlayClick}>
      <div className="room-modal">
        {/* Header */}
        <div className="room-modal-header">
          <div className="room-modal-badges">
            {room.status === 'live' && (
              <span className="room-badge room-badge-live">
                <span className="live-dot"></span>
                {t('browse_modal_status_live')}
              </span>
            )}
            {room.status === 'past' && (
              <span className="room-badge room-badge-past">
                {t('browse_modal_status_past')}
              </span>
            )}
            {room.status === 'waiting' && (
              <span className="room-badge room-badge-waiting">
                {t('browse_modal_status_waiting')}
              </span>
            )}
            {room.isMyRoom && (
              <span className="room-badge room-badge-my">{t('browse_modal_status_my_room')}</span>
            )}
            {room.isJoined && !room.isMyRoom && (
              <span className="room-badge room-badge-joined">{t('browse_modal_status_joined')}</span>
            )}
          </div>
          <div className="room-modal-header-actions">
            {room.isMyRoom && !isEditMode && (
              <button className="room-modal-edit" onClick={handleEditClick} aria-label="Edit">
                <FiEdit2 size={20} />
              </button>
            )}
            {isEditMode && (
              <>
                <button className="room-modal-save" onClick={handleSaveEdit} disabled={isSaving} aria-label="Save">
                  <FiSave size={20} />
                </button>
                <button className="room-modal-cancel-edit" onClick={handleCancelEdit} aria-label="Cancel">
                  <FiXCircle size={20} />
                </button>
              </>
            )}
            <button className="room-modal-close" onClick={onClose} aria-label="Close">
              <FiX size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="room-modal-content">
          {/* Left: Book Cover */}
          <div className="room-modal-cover">
            <img
              src={room.book.cover.medium || room.book.cover.small || generateBookCoverPlaceholder(room.book.title)}
              alt={room.book.title}
              loading="lazy"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                // Use SVG placeholder on image load error
                if (!target.src.startsWith('data:image/svg+xml')) {
                  target.src = generateBookCoverPlaceholder(room.book.title);
                }
              }}
            />
          </div>

          {/* Right: Details */}
          <div className="room-modal-details">
            <h2 className="room-modal-title">{room.title}</h2>

            {/* Book Info */}
            <div className="room-modal-section">
              <h3 className="room-modal-section-title">{t('browse_modal_book_info')}</h3>
              <div className="room-modal-info-grid">
                <div className="room-modal-info-item">
                  <span className="room-modal-info-label">{t('browse_modal_author')}</span>
                  <span className="room-modal-info-value">{room.book.author}</span>
                </div>
                <div className="room-modal-info-item">
                  <span className="room-modal-info-label">{t('browse_modal_genre')}</span>
                  <span className="room-modal-info-value">{room.book.genre}</span>
                </div>
                {room.book.isbn && (
                  <div className="room-modal-info-item">
                    <span className="room-modal-info-label">{t('browse_modal_isbn')}</span>
                    <span className="room-modal-info-value">{room.book.isbn}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Room Details */}
            <div className="room-modal-section">
              <h3 className="room-modal-section-title">{t('browse_modal_room_details')}</h3>
              <div className="room-modal-info-grid">
                <div className="room-modal-info-item">
                  <FiUser size={16} />
                  <span className="room-modal-info-label">{t('browse_modal_host')}</span>
                  <span className="room-modal-info-value">{room.host}</span>
                </div>

                {/* Date & Time */}
                <div className="room-modal-info-item room-modal-info-item-full">
                  <FiCalendar size={16} />
                  <span className="room-modal-info-label">{t('browse_modal_date_time')}</span>
                  {isEditMode ? (
                    <div className="edit-date-time">
                      <input
                        type="date"
                        className="edit-input"
                        value={editForm.date}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                      />
                      <input
                        type="time"
                        className="edit-input"
                        value={editForm.time}
                        onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                      />
                    </div>
                  ) : (
                    <span className="room-modal-info-value">
                      {formatDate(room.dueISO)} at {formatTime(room.dueISO)}
                    </span>
                  )}
                </div>

                {/* Duration */}
                <div className="room-modal-info-item room-modal-info-item-full">
                  <FiClock size={16} />
                  <span className="room-modal-info-label">{t('browse_modal_duration')}</span>
                  {isEditMode ? (
                    <div className="edit-range">
                      <input
                        type="range"
                        min="30"
                        max="180"
                        step="15"
                        value={editForm.duration}
                        onChange={(e) => setEditForm({ ...editForm, duration: parseInt(e.target.value) })}
                      />
                      <span className="range-value">{editForm.duration} min</span>
                    </div>
                  ) : (
                    <span className="room-modal-info-value">{room.duration} {t('browse_modal_minutes')}</span>
                  )}
                </div>

                {/* Capacity */}
                <div className="room-modal-info-item room-modal-info-item-full">
                  <FiUsers size={16} />
                  <span className="room-modal-info-label">{t('browse_modal_capacity')}</span>
                  {isEditMode ? (
                    <div className="edit-capacity-group">
                      <div className="edit-range">
                        <input
                          type="range"
                          min={room.participants}
                          max="20"
                          value={editForm.capacity}
                          onChange={(e) => setEditForm({ ...editForm, capacity: parseInt(e.target.value) })}
                        />
                        <span className="range-value">{editForm.capacity}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="capacity-display-group">
                      <span className="room-modal-info-value">
                        {room.participants}/{room.maxParticipants}
                        {spotsLeft > 0 && (
                          <span className="spots-left"> ({spotsLeft} {t('browse_modal_spots_left')})</span>
                        )}
                      </span>
                      {room.isMyRoom && (
                        room.recruit === false ? (
                          <button
                            type="button"
                            className="open-recruitment-btn"
                            onClick={handleOpenRecruitment}
                          >
                            {t('browse_modal_open_recruitment') || 'Open Recruitment'}
                          </button>
                        ) : spotsLeft > 0 && (
                          <button
                            type="button"
                            className="close-recruitment-btn"
                            onClick={handleCloseRecruitment}
                          >
                            {t('browse_modal_close_recruitment') || 'Close Recruitment'}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>

                {/* Level */}
                <div className="room-modal-info-item room-modal-info-item-full">
                  <span className="room-modal-info-label">{t('browse_modal_level')}</span>
                  {isEditMode ? (
                    <div className="level-buttons">
                      {(['low', 'moderate', 'high'] as const).map((level) => (
                        <button
                          key={level}
                          type="button"
                          className={`level-btn ${editForm.level === level ? 'active' : ''}`}
                          onClick={() => setEditForm({ ...editForm, level })}
                        >
                          {getLevelText(level)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className={`room-level-badge room-level-${room.level}`}>
                      {getLevelText(room.level)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {(room.description || isEditMode) && (
              <div className="room-modal-section">
                <h3 className="room-modal-section-title">{t('browse_modal_description')}</h3>
                {isEditMode ? (
                  <textarea
                    className="edit-textarea"
                    rows={4}
                    placeholder={t('browse_modal_description_placeholder') || 'Describe your discussion room...'}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                ) : (
                  <p className="room-modal-description">{room.description}</p>
                )}
              </div>
            )}

            {/* Tags */}
            {(room.tags.length > 0 || isEditMode) && (
              <div className="room-modal-section">
                <h3 className="room-modal-section-title">{t('browse_modal_tags')}</h3>
                {isEditMode ? (
                  <div className="tags-section">
                    <div className="tags-list">
                      {editForm.tags.map((tag, index) => (
                        <span key={index} className="tag tag-editable">
                          {tag}
                          <button type="button" onClick={() => handleRemoveTag(tag)}>×</button>
                        </span>
                      ))}
                    </div>
                    <div className="tag-input-group">
                      <input
                        type="text"
                        className="tag-input"
                        placeholder={t('browse_modal_add_tag') || 'Add a tag...'}
                        value={editForm.newTag}
                        onChange={(e) => setEditForm({ ...editForm, newTag: e.target.value })}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                      />
                      <button type="button" className="tag-add-btn" onClick={handleAddTag}>+</button>
                    </div>
                  </div>
                ) : (
                  <div className="room-modal-tags">
                    {room.tags.map((tag, index) => (
                      <span key={index} className="room-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="room-modal-actions">
          {/* Enter Meeting 버튼 - 참가자/주최자만 표시 */}
          {!isEditMode && (room.isJoined || room.isMyRoom) && room.status !== 'past' && (
            <button
              className="room-modal-btn room-modal-btn-enter"
              onClick={handleEnterMeeting}
              disabled={isEntering}
            >
              <FiVideo size={18} />
              {isEntering ? t('loading') : t('browse_modal_enter_meeting') || 'Enter Meeting'}
            </button>
          )}
          {/* Google Meet 직접 열기 */}
          {!isEditMode && (room.isJoined || room.isMyRoom) && room.meetLink && (
            <button className="room-modal-btn room-modal-btn-meet" onClick={handleOpenMeet}>
              <FiExternalLink size={18} />
              {t('browse_modal_open_meet')}
            </button>
          )}
          {/* 참가하기/예약하기 버튼 - 비참가자만 표시 */}
          {!isEditMode && !room.isJoined && !room.isMyRoom && (
            <button
              className="room-modal-btn room-modal-btn-primary"
              onClick={handleJoinClick}
              disabled={isProcessing || spotsLeft <= 0 || room.status === 'past' || room.recruit === false}
              style={room.recruit === false ? { backgroundColor: '#9ca3af', cursor: 'not-allowed', opacity: 0.6 } : {}}
            >
              {isProcessing ? t('loading') : (
                room.status === 'past'
                  ? t('browse_card_ended')
                  : room.recruit === false
                    ? t('browse_modal_recruitment_closed')
                    : (room.status === 'live' || room.status === 'waiting')
                      ? t('browse_card_join_now')
                      : t('browse_card_reserve')
              )}
            </button>
          )}
          {!isEditMode && (
            <button className="room-modal-btn room-modal-btn-secondary" onClick={handleCreateSimilar}>
              {t('browse_modal_create_similar')}
            </button>
          )}
          {/* 삭제 버튼 - 주최자만 표시 */}
          {!isEditMode && room.isMyRoom && onDelete && (
            <button
              className="room-modal-btn room-modal-btn-danger"
              onClick={handleDelete}
              disabled={isProcessing}
            >
              <FiTrash2 size={18} />
              {t('browse_modal_delete')}
            </button>
          )}
          {/* 탈퇴하기 버튼 - 참가자만 표시 (주최자 제외) */}
          {!isEditMode && room.isJoined && !room.isMyRoom && (
            <button
              className="room-modal-btn room-modal-btn-danger"
              onClick={handleLeave}
              disabled={isLeaving}
            >
              <FiLogOut size={18} />
              {isLeaving ? t('loading') : t('browse_modal_leave')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomModal;
