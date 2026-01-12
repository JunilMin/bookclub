import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiX, FiUser, FiCalendar, FiClock, FiUsers, FiExternalLink, FiTrash2, FiVideo } from 'react-icons/fi';
import { joinSession } from '../api/sessions';
import { useAuth } from '../AuthContext/AuthContext';
import './styles/RoomModal.css';

// Room interface (same as in Board.tsx)
export interface Room {
  id: string;
  title: string;
  host: string;
  hostAvatar: string;
  book: {
    title: string;
    author: string;
    cover: string;
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
  status: 'live' | 'upcoming' | 'past';
  isJoined: boolean;
  isMyRoom: boolean;
  meetLink?: string | null;
  calendarEventId?: string | null;
}

interface RoomModalProps {
  room: Room;
  onClose: () => void;
  onJoin: (roomId: string) => void;
  onDelete?: (roomId: string) => void;
  isProcessing?: boolean;
}

const RoomModal: React.FC<RoomModalProps> = ({ room, onClose, onJoin, onDelete, isProcessing }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [isEntering, setIsEntering] = useState(false);

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
    navigate('/board/create', { state: { book: room.book.title, isbn: room.book.isbn } });
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
            {room.isMyRoom && (
              <span className="room-badge room-badge-my">{t('browse_modal_status_my_room')}</span>
            )}
            {room.isJoined && !room.isMyRoom && (
              <span className="room-badge room-badge-joined">{t('browse_modal_status_joined')}</span>
            )}
          </div>
          <button className="room-modal-close" onClick={onClose} aria-label="Close">
            <FiX size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="room-modal-content">
          {/* Left: Book Cover */}
          <div className="room-modal-cover">
            <img
              src={room.book.cover}
              alt={room.book.title}
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/224x320?text=No+Cover';
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
                <div className="room-modal-info-item">
                  <FiCalendar size={16} />
                  <span className="room-modal-info-label">{t('browse_modal_date_time')}</span>
                  <span className="room-modal-info-value">
                    {formatDate(room.dueISO)} at {formatTime(room.dueISO)}
                  </span>
                </div>
                <div className="room-modal-info-item">
                  <FiClock size={16} />
                  <span className="room-modal-info-label">{t('browse_modal_duration')}</span>
                  <span className="room-modal-info-value">{room.duration} {t('browse_modal_minutes')}</span>
                </div>
                <div className="room-modal-info-item">
                  <FiUsers size={16} />
                  <span className="room-modal-info-label">{t('browse_modal_capacity')}</span>
                  <span className="room-modal-info-value">
                    {room.participants}/{room.maxParticipants}
                    {spotsLeft > 0 && (
                      <span className="spots-left"> ({spotsLeft} {t('browse_modal_spots_left')})</span>
                    )}
                  </span>
                </div>
                <div className="room-modal-info-item">
                  <span className="room-modal-info-label">{t('browse_modal_level')}</span>
                  <span className={`room-level-badge room-level-${room.level}`}>
                    {getLevelText(room.level)}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            {room.description && (
              <div className="room-modal-section">
                <h3 className="room-modal-section-title">{t('browse_modal_description')}</h3>
                <p className="room-modal-description">{room.description}</p>
              </div>
            )}

            {/* Tags */}
            {room.tags.length > 0 && (
              <div className="room-modal-section">
                <h3 className="room-modal-section-title">{t('browse_modal_tags')}</h3>
                <div className="room-modal-tags">
                  {room.tags.map((tag, index) => (
                    <span key={index} className="room-tag">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="room-modal-actions">
          {/* Enter Meeting 버튼 - 참가자/주최자만 표시 */}
          {(room.isJoined || room.isMyRoom) && room.status !== 'past' && (
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
          {(room.isJoined || room.isMyRoom) && room.meetLink && (
            <button className="room-modal-btn room-modal-btn-meet" onClick={handleOpenMeet}>
              <FiExternalLink size={18} />
              {t('browse_modal_open_meet')}
            </button>
          )}
          {/* 참가하기/예약하기 버튼 - 비참가자만 표시 */}
          {!room.isJoined && !room.isMyRoom && (
            <button
              className="room-modal-btn room-modal-btn-primary"
              onClick={handleJoinClick}
              disabled={isProcessing || spotsLeft <= 0 || room.status === 'past'}
            >
              {isProcessing ? t('loading') : (
                room.status === 'past'
                  ? t('browse_card_ended')
                  : room.status === 'live'
                    ? t('browse_card_join_now')
                    : t('browse_card_reserve')
              )}
            </button>
          )}
          <button className="room-modal-btn room-modal-btn-secondary" onClick={handleCreateSimilar}>
            {t('browse_modal_create_similar')}
          </button>
          {room.isMyRoom && onDelete && (
            <button
              className="room-modal-btn room-modal-btn-danger"
              onClick={handleDelete}
              disabled={isProcessing}
            >
              <FiTrash2 size={18} />
              {t('browse_modal_delete')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomModal;
