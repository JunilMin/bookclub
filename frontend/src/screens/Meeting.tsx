import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowLeft, FiExternalLink, FiCalendar, FiClock, FiUsers, FiBookOpen, FiUser, FiVideo } from 'react-icons/fi';
import { Room } from '../components/RoomModal';
import { useAuth } from '../AuthContext/AuthContext';
import './styles/Meeting.css';

interface LocationState {
  meetLink?: string | null;
  room?: Room;
}

const Meeting: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const state = location.state as LocationState | null;
  const [room] = useState<Room | null>(state?.room || null);
  const [meetLink] = useState<string | null>(state?.meetLink || null);

  // Redirect to board if no room data and not logged in
  useEffect(() => {
    if (!accessToken) {
      navigate('/login');
    }
  }, [accessToken, navigate]);

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleOpenMeet = () => {
    if (meetLink) {
      window.open(meetLink, '_blank', 'noopener,noreferrer');
    }
  };

  const getLevelText = (level: string) => {
    switch (level) {
      case 'low': return t('browse_level_low');
      case 'moderate': return t('browse_level_moderate');
      case 'high': return t('browse_level_high');
      default: return level;
    }
  };

  // If no room data, show placeholder
  if (!room) {
    return (
      <div className="meeting-page">
        <div className="meeting-not-found">
          <FiVideo size={64} />
          <h2>{t('meeting_not_found')}</h2>
          <p>{t('meeting_not_found_desc')}</p>
          <Link to="/" className="meeting-back-link">
            <FiArrowLeft size={18} />
            {t('meeting_back_to_browse')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="meeting-page">
      {/* Header */}
      <header className="meeting-header">
        <button className="meeting-back-btn" onClick={() => navigate('/')}>
          <FiArrowLeft size={20} />
          <span>{t('meeting_back_to_browse')}</span>
        </button>
        <div className="meeting-id-badge">
          ID: {id}
        </div>
      </header>

      <div className="meeting-container">
        {/* Main Content */}
        <div className="meeting-content">
          {/* Room Info Card */}
          <div className="meeting-info-card">
            <div className="meeting-info-header">
              {room.status === 'live' && (
                <span className="meeting-live-badge">
                  <span className="live-dot"></span>
                  {t('browse_modal_status_live')}
                </span>
              )}
              <h1 className="meeting-title">{room.title}</h1>
            </div>

            {/* Book Details */}
            <div className="meeting-book-section">
              <div className="meeting-book-cover">
                <img
                  src={room.book.cover.small || room.book.cover.medium}
                  alt={room.book.title}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://via.placeholder.com/180x260?text=${encodeURIComponent(room.book.title)}`;
                  }}
                />
              </div>
              <div className="meeting-book-info">
                <h2 className="meeting-book-title">{room.book.title}</h2>
                <p className="meeting-book-author">{t('browse_modal_author')}: {room.book.author}</p>
                <p className="meeting-book-genre">{t('browse_modal_genre')}: {room.book.genre}</p>
                {room.book.isbn && (
                  <p className="meeting-book-isbn">{t('browse_modal_isbn')}: {room.book.isbn}</p>
                )}
              </div>
            </div>

            {/* Meeting Details */}
            <div className="meeting-details-grid">
              <div className="meeting-detail-item">
                <FiUser className="meeting-detail-icon" />
                <div>
                  <span className="meeting-detail-label">{t('browse_modal_host')}</span>
                  <span className="meeting-detail-value">{room.host}</span>
                </div>
              </div>
              <div className="meeting-detail-item">
                <FiCalendar className="meeting-detail-icon" />
                <div>
                  <span className="meeting-detail-label">{t('browse_modal_date_time')}</span>
                  <span className="meeting-detail-value">
                    {formatDate(room.dueISO)} at {formatTime(room.dueISO)}
                  </span>
                </div>
              </div>
              <div className="meeting-detail-item">
                <FiClock className="meeting-detail-icon" />
                <div>
                  <span className="meeting-detail-label">{t('browse_modal_duration')}</span>
                  <span className="meeting-detail-value">{room.duration} {t('browse_modal_minutes')}</span>
                </div>
              </div>
              <div className="meeting-detail-item">
                <FiUsers className="meeting-detail-icon" />
                <div>
                  <span className="meeting-detail-label">{t('browse_modal_capacity')}</span>
                  <span className="meeting-detail-value">{room.participants}/{room.maxParticipants}</span>
                </div>
              </div>
              <div className="meeting-detail-item">
                <FiBookOpen className="meeting-detail-icon" />
                <div>
                  <span className="meeting-detail-label">{t('browse_modal_level')}</span>
                  <span className={`meeting-level-badge level-${room.level}`}>
                    {getLevelText(room.level)}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            {room.description && (
              <div className="meeting-description">
                <h3>{t('browse_modal_description')}</h3>
                <p>{room.description}</p>
              </div>
            )}

            {/* Tags */}
            {room.tags.length > 0 && (
              <div className="meeting-tags">
                {room.tags.map((tag, index) => (
                  <span key={index} className="meeting-tag">{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Join Meeting */}
        <aside className="meeting-sidebar">
          <div className="meeting-action-card">
            <div className="meeting-action-icon">
              <FiVideo size={48} />
            </div>
            <h3>{t('meeting_ready_to_join')}</h3>
            <p>{t('meeting_click_to_join')}</p>

            {meetLink ? (
              <button className="meeting-join-btn" onClick={handleOpenMeet}>
                <FiExternalLink size={20} />
                {t('meeting_join_google_meet')}
              </button>
            ) : (
              <div className="meeting-no-link">
                <p>{t('meeting_no_link')}</p>
              </div>
            )}

            {room.status === 'upcoming' && (
              <p className="meeting-upcoming-notice">
                {t('meeting_upcoming_notice')}
              </p>
            )}
          </div>

          {/* Guidelines */}
          <div className="meeting-guidelines">
            <h4>{t('meeting_guidelines_title')}</h4>
            <ul>
              <li>{t('meeting_guideline_1')}</li>
              <li>{t('meeting_guideline_2')}</li>
              <li>{t('meeting_guideline_3')}</li>
              <li>{t('meeting_guideline_4')}</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Meeting;
