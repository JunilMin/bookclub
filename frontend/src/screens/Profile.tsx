import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext/AuthContext';
import { getAllPosts, Post } from '../api/posts';
import HexagonChart from '../components/HexagonChart';
import './styles/Profile.css';

const Profile: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, accessToken } = useAuth();

  const [activeSection, setActiveSection] = useState<string>('overview');
  const [createdMeetings, setCreatedMeetings] = useState<Post[]>([]);
  const [participatingMeetings, setParticipatingMeetings] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Handle hash navigation
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash) {
      setActiveSection(hash);
    }
  }, [location.hash]);

  // Fetch user's meetings
  useEffect(() => {
    const fetchMeetings = async () => {
      if (!accessToken || !user) return;

      setIsLoading(true);
      try {
        const allPosts = await getAllPosts(accessToken);

        // Filter created meetings
        const created = allPosts.filter(
          post => post.createrId === user.id
        );
        setCreatedMeetings(created);

        // Filter participating meetings (where user is a member but not the creator)
        const participating = allPosts.filter(
          post => post.memberIds?.includes(user.id!) && post.createrId !== user.id
        );
        setParticipatingMeetings(participating);
      } catch (error) {
        console.error('Error fetching meetings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMeetings();
  }, [accessToken, user]);

  if (!user) {
    return (
      <div className="profile-container">
        <div className="profile-login-required">
          <p>{t('profile_login_required')}</p>
          <button onClick={() => navigate('/login')} className="login-btn">
            {t('nav_login')}
          </button>
        </div>
      </div>
    );
  }

  // Default avatar as data URI
  const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiI+PC9wYXRoPjxjaXJjbGUgY3g9IjEyIiBjeT0iNyIgcj0iNCI+PC9jaXJjbGU+PC9zdmc+';
  const avatarUrl = user.photoUrl || defaultAvatar;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <div className="profile-container">
      {/* Profile Header */}
      <div className="profile-header">
        <img
          src={avatarUrl}
          alt={user.username}
          className="profile-avatar"
          onError={(e) => {
            (e.target as HTMLImageElement).src = defaultAvatar;
          }}
        />
        <div className="profile-info">
          <h1 className="profile-username">{user.username}</h1>
          <p className="profile-email">{user.email}</p>
          <div className="profile-stats">
            <div className="stat-item">
              <span className="stat-value">{user.endorsementStats?.points || 0}</span>
              <span className="stat-label">{t('profile_total_points')}</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{createdMeetings.length}</span>
              <span className="stat-label">{t('profile_created')}</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{participatingMeetings.length}</span>
              <span className="stat-label">{t('profile_participated')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="profile-tabs">
        <button
          className={`profile-tab ${activeSection === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveSection('overview')}
        >
          {t('profile_tab_overview')}
        </button>
        <button
          className={`profile-tab ${activeSection === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveSection('activity')}
        >
          {t('profile_tab_activity')}
        </button>
        <button
          className={`profile-tab ${activeSection === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveSection('settings')}
        >
          {t('profile_tab_settings')}
        </button>
      </div>

      {/* Content Sections */}
      <div className="profile-content">
        {isLoading ? (
          <div className="profile-loading">{t('loading')}</div>
        ) : (
          <>
            {activeSection === 'overview' && (
              <div className="profile-section">
                <h2 className="section-title">{t('profile_about')}</h2>

                {/* Created Meetings */}
                <div className="meetings-section">
                  <h3>{t('dropdown_my_created_meetings')}</h3>
                  {createdMeetings.length === 0 ? (
                    <p className="no-meetings">{t('profile_no_created_meetings')}</p>
                  ) : (
                    <div className="meetings-list">
                      {createdMeetings.slice(0, 5).map(post => (
                        <div key={post.id} className="meeting-card">
                          <span className="meeting-book">{post.bookData?.title}</span>
                          <span className="meeting-date">{formatDate(post.due)}</span>
                          <span className="meeting-members">{post.memberIds?.length || 0}/{post.capacity}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {createdMeetings.length > 5 && (
                    <button
                      className="view-all-btn"
                      onClick={() => navigate('/?filter=created')}
                    >
                      {t('profile_view_all')}
                    </button>
                  )}
                </div>

                {/* Participating Meetings */}
                <div className="meetings-section">
                  <h3>{t('dropdown_participating_meetings')}</h3>
                  {participatingMeetings.length === 0 ? (
                    <p className="no-meetings">{t('profile_no_participating_meetings')}</p>
                  ) : (
                    <div className="meetings-list">
                      {participatingMeetings.slice(0, 5).map(post => (
                        <div key={post.id} className="meeting-card">
                          <span className="meeting-book">{post.bookData?.title}</span>
                          <span className="meeting-date">{formatDate(post.due)}</span>
                          <span className="meeting-members">{post.memberIds?.length || 0}/{post.capacity}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {participatingMeetings.length > 5 && (
                    <button
                      className="view-all-btn"
                      onClick={() => navigate('/?filter=participating')}
                    >
                      {t('profile_view_all')}
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'activity' && (
              <div className="profile-section">
                <h2 className="section-title">{t('dropdown_reputation_activity')}</h2>

                {/* Endorsement Hexagon Chart */}
                <div className="endorsement-chart-section">
                  <h3>{t('profile_endorsement_chart')}</h3>
                  <HexagonChart
                    data={user.endorsementStats?.categoryCounts || {}}
                  />
                  <div className="endorsement-summary">
                    <div className="endorsement-stat">
                      <span className="endorsement-stat-value">
                        {user.endorsementStats?.count || 0}
                      </span>
                      <span className="endorsement-stat-label">
                        {t('profile_total_endorsements')}
                      </span>
                    </div>
                    <div className="endorsement-stat">
                      <span className="endorsement-stat-value">
                        {user.endorsementStats?.points || 0}
                      </span>
                      <span className="endorsement-stat-label">
                        {t('profile_total_points')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Activity Stats */}
                <div className="activity-stats">
                  <div className="activity-card">
                    <div className="activity-icon absent-icon">&#10060;</div>
                    <div className="activity-info">
                      <span className="activity-value">{user.absent || 0}</span>
                      <span className="activity-label">{t('profile_absent')}</span>
                    </div>
                  </div>
                  <div className="activity-card">
                    <div className="activity-icon late-icon">&#9201;</div>
                    <div className="activity-info">
                      <span className="activity-value">{user.late || 0}</span>
                      <span className="activity-label">{t('profile_late')}</span>
                    </div>
                  </div>
                  <div className="activity-card">
                    <div className="activity-icon kicked-icon">&#128683;</div>
                    <div className="activity-info">
                      <span className="activity-value">{user.kicked || 0}</span>
                      <span className="activity-label">{t('profile_kicked')}</span>
                    </div>
                  </div>
                </div>

                <div className="activity-summary">
                  <h3>{t('profile_activity_summary')}</h3>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <span className="summary-label">{t('profile_total_meetings')}</span>
                      <span className="summary-value">{createdMeetings.length + participatingMeetings.length}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">{t('profile_friends_count')}</span>
                      <span className="summary-value">{user.friends?.length || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'settings' && (
              <div className="profile-section">
                <h2 className="section-title">{t('dropdown_account_settings')}</h2>
                <div className="settings-list">
                  <button
                    className="settings-item"
                    onClick={() => navigate('/set-username')}
                  >
                    <span className="settings-icon">&#9998;</span>
                    <span className="settings-text">{t('profile_edit_username')}</span>
                    <span className="settings-arrow">&#8250;</span>
                  </button>
                  <div className="settings-item disabled">
                    <span className="settings-icon">&#128276;</span>
                    <span className="settings-text">{t('profile_notifications')}</span>
                    <span className="coming-soon">{t('post_create_coming_soon')}</span>
                  </div>
                  <div className="settings-item disabled">
                    <span className="settings-icon">&#127760;</span>
                    <span className="settings-text">{t('profile_language')}</span>
                    <span className="settings-hint">{t('profile_language_hint')}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Profile;
