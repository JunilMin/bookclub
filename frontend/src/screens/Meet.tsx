import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowLeft, FiExternalLink, FiCalendar, FiClock, FiUsers, FiBookOpen, FiVideo, FiLoader } from 'react-icons/fi';
import { getSession, GetSessionResponse } from '../api/sessions';
import { useAuth } from '../AuthContext/AuthContext';
import './styles/Meet.css';

const Meet: React.FC = () => {
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { accessToken } = useAuth();

  const [session, setSession] = useState<GetSessionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      navigate('/login');
      return;
    }

    if (!sessionId) {
      setError('Session ID is required');
      setIsLoading(false);
      return;
    }

    const fetchSession = async () => {
      try {
        const data = await getSession(sessionId, accessToken);
        setSession(data);
      } catch (err: any) {
        console.error('Failed to fetch session:', err);
        if (err.response?.status === 403) {
          setError(t('meeting_not_participant') || 'You are not a participant of this meeting');
        } else if (err.response?.status === 404) {
          setError(t('meeting_not_found') || 'Session not found');
        } else {
          setError(t('meeting_load_error') || 'Failed to load meeting');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [sessionId, accessToken, navigate, t]);

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

  const getLevelText = (level: string) => {
    switch (level) {
      case 'low': return t('browse_level_low');
      case 'moderate': return t('browse_level_moderate');
      case 'high': return t('browse_level_high');
      default: return level;
    }
  };

  const handleOpenMeet = () => {
    if (session?.meetLink) {
      window.open(session.meetLink, '_blank', 'noopener,noreferrer');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="meet-page">
        <div className="meet-loading">
          <FiLoader className="meet-loading-spinner" size={48} />
          <p>{t('loading') || 'Loading...'}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !session) {
    return (
      <div className="meet-page">
        <div className="meet-not-found">
          <FiVideo size={64} />
          <h2>{error || t('meeting_not_found')}</h2>
          <p>{t('meeting_not_found_desc') || 'The meeting you are looking for could not be found.'}</p>
          <Link to="/board" className="meet-back-link">
            <FiArrowLeft size={18} />
            {t('meeting_back_to_browse') || 'Back to Browse'}
          </Link>
        </div>
      </div>
    );
  }

  const { post, meetLink, status } = session;

  return (
    <div className="meet-page">
      {/* Header */}
      <header className="meet-header">
        <button className="meet-back-btn" onClick={() => navigate('/board')}>
          <FiArrowLeft size={20} />
          <span>{t('meeting_back_to_browse') || 'Back to Browse'}</span>
        </button>
        <div className="meet-status-badge">
          {status === 'live' && (
            <span className="meet-live-indicator">
              <span className="live-dot"></span>
              LIVE
            </span>
          )}
          <span className="meet-session-id">Session: {sessionId?.slice(0, 8)}...</span>
        </div>
      </header>

      <div className="meet-container">
        {/* Main Content */}
        <div className="meet-content">
          {/* Session Info Card */}
          <div className="meet-info-card">
            <div className="meet-info-header">
              <h1 className="meet-title">{post.book}</h1>
              <span className={`meet-level-badge level-${post.level}`}>
                {getLevelText(post.level)}
              </span>
            </div>

            {/* Meeting Details */}
            <div className="meet-details-grid">
              <div className="meet-detail-item">
                <FiCalendar className="meet-detail-icon" />
                <div>
                  <span className="meet-detail-label">{t('browse_modal_date_time') || 'Date & Time'}</span>
                  <span className="meet-detail-value">
                    {formatDate(post.due)} at {formatTime(post.due)}
                  </span>
                </div>
              </div>
              <div className="meet-detail-item">
                <FiUsers className="meet-detail-icon" />
                <div>
                  <span className="meet-detail-label">{t('browse_modal_capacity') || 'Capacity'}</span>
                  <span className="meet-detail-value">{post.memberCount}/{post.capacity}</span>
                </div>
              </div>
              <div className="meet-detail-item">
                <FiBookOpen className="meet-detail-icon" />
                <div>
                  <span className="meet-detail-label">{t('browse_modal_host') || 'Host'}</span>
                  <span className="meet-detail-value">{post.creater}</span>
                </div>
              </div>
              {post.isbn && (
                <div className="meet-detail-item">
                  <FiClock className="meet-detail-icon" />
                  <div>
                    <span className="meet-detail-label">{t('browse_modal_isbn') || 'ISBN'}</span>
                    <span className="meet-detail-value">{post.isbn}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar - Join Meeting */}
        <aside className="meet-sidebar">
          <div className="meet-action-card">
            <div className="meet-action-icon">
              <FiVideo size={48} />
            </div>
            <h3>{t('meeting_ready_to_join') || 'Ready to Join?'}</h3>
            <p>{t('meeting_click_to_join') || 'Click the button below to join the meeting.'}</p>

            {meetLink ? (
              <button className="meet-join-btn" onClick={handleOpenMeet}>
                <FiExternalLink size={20} />
                {t('meeting_join_google_meet') || 'Join Google Meet'}
              </button>
            ) : (
              <div className="meet-no-link">
                <p>{t('meeting_no_link') || 'Meeting link is not available yet.'}</p>
              </div>
            )}
          </div>

          {/* Guidelines */}
          <div className="meet-guidelines">
            <h4>{t('meeting_guidelines_title') || 'Meeting Guidelines'}</h4>
            <ul>
              <li>{t('meeting_guideline_1') || 'Be respectful to all participants'}</li>
              <li>{t('meeting_guideline_2') || 'Keep your microphone muted when not speaking'}</li>
              <li>{t('meeting_guideline_3') || 'Stay on topic and discuss the book'}</li>
              <li>{t('meeting_guideline_4') || 'Have fun and enjoy the discussion!'}</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Meet;
