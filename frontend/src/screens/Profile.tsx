import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext/AuthContext';
import { getDisplayPhotoUrl } from '../api/user';
import { useBoardStore } from '../store/boardStore';
import { useProfileStore, selectTopRating } from '../store/profileStore';
import { getGradientStyle } from '../utils/gradientUtils';
import { formatDateLocalized, formatDateCompact } from '../utils/dateUtils';
import {
  OverviewSkeleton,
  ActivitySkeleton,
  BadgesSkeleton,
} from '../components/profile/ProfileSkeletons';
import './styles/Profile.css';

const Profile: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, accessToken } = useAuth();

  // boardStore에서 posts 가져오기 (데이터 재사용)
  const { byId, order, initBoard, isInitialLoading: isBoardLoading } = useBoardStore();

  // profileStore에서 reputation 데이터 가져오기 (캐싱)
  const {
    reputationData,
    isLoading: isReputationLoading,
    fetchReputation,
  } = useProfileStore();

  const [activeSection, setActiveSection] = useState<string>('overview');
  const [showAllCreated, setShowAllCreated] = useState(false);
  const [showAllParticipating, setShowAllParticipating] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [imageError, setImageError] = useState(false);

  // boardStore의 posts를 배열로 변환
  const allPosts = useMemo(() => {
    return order.map((id) => byId[id]).filter(Boolean);
  }, [byId, order]);

  // 내가 만든 미팅 / 참여 중인 미팅 필터링 (메모이제이션)
  const createdMeetings = useMemo(() => {
    if (!user?.id) return [];
    return allPosts.filter(post => post.createrId === user.id);
  }, [allPosts, user?.id]);

  const participatingMeetings = useMemo(() => {
    if (!user?.id) return [];
    return allPosts.filter(
      post => post.memberIds?.includes(user.id!) && post.createrId !== user.id
    );
  }, [allPosts, user?.id]);

  // Top rating calculation (memoized)
  const topRating = useMemo(() => {
    return selectTopRating(useProfileStore.getState());
  }, [reputationData]);

  const topRatingStars = useMemo(() => Math.round(topRating.score), [topRating.score]);
  const topRatingScore = useMemo(() => topRating.score.toFixed(1), [topRating.score]);

  // Avatar URL (memoized)
  const avatarUrl = useMemo(() => {
    const url = getDisplayPhotoUrl(user);
    return url || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiI+PC9wYXRoPjxjaXJjbGUgY3g9IjEyIiBjeT0iNyIgcj0iNCI+PC9jaXJjbGU+PC9zdmc+';
  }, [user?.photo?.google, user?.photo?.custom]);

  // Reset image error when avatar changes
  useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  // Default avatar for fallback
  const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiI+PC9wYXRoPjxjaXJjbGUgY3g9IjEyIiBjeT0iNyIgcj0iNCI+PC9jaXJjbGU+PC9zdmc+';

  // Handle hash navigation
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash) {
      setActiveSection(hash);
    }
  }, [location.hash]);

  // boardStore 초기화 (데이터가 없는 경우에만)
  useEffect(() => {
    if (accessToken && order.length === 0) {
      initBoard(accessToken, user?.id);
    }
  }, [accessToken, user?.id, order.length, initBoard]);

  // Fetch reputation data (with caching)
  useEffect(() => {
    if (!accessToken || !user) return;
    const locale = i18n.language === 'ko' ? 'ko' : 'en';
    fetchReputation(accessToken, locale);
  }, [accessToken, user, i18n.language, fetchReputation]);

  // Locale for date formatting
  const locale = useMemo(() => (i18n.language === 'ko' ? 'ko' : 'en') as 'ko' | 'en', [i18n.language]);

  // Format helpers using shared utils
  const formatDate = useCallback(
    (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    },
    []
  );

  const formatJoinDate = useCallback(
    (dateString?: string) => formatDateCompact(dateString, locale),
    [locale]
  );

  const formatBadgeDate = useCallback(
    (dateString: string) => formatDateLocalized(dateString, locale),
    [locale]
  );

  // Login required state
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

  // Determine loading state per tab
  const isTabLoading = (tab: string): boolean => {
    if (tab === 'overview' || tab === 'activity' || tab === 'badges') {
      return isReputationLoading && !reputationData;
    }
    // interests tab uses user data, which is already available
    return false;
  };

  return (
    <div className="profile-page">
      {/* Profile Hero Section - ALWAYS RENDERS IMMEDIATELY */}
      <div className="profile-hero-section">
        <div className="profile-hero-container">
          {/* Header */}
          <div className="profile-hero-header">
            <div className="profile-hero-header-left">
              <button className="profile-hero-back-btn" onClick={() => navigate(-1)}>
                <i className="ri-arrow-left-line"></i>
              </button>
              <h1 className="profile-hero-title">{t('profile_title')}</h1>
            </div>
            <button className="profile-hero-edit-btn" onClick={() => navigate('/set-username')}>
              <i className="ri-settings-3-line"></i>
              {t('profile_edit')}
            </button>
          </div>

          {/* Profile Info */}
          <div className="profile-hero-info">
            {/* Avatar */}
            <div className="profile-hero-avatar-wrapper">
              <img
                src={imageError ? defaultAvatar : avatarUrl}
                alt={user.username || ''}
                className="profile-hero-avatar"
                onError={() => setImageError(true)}
              />
              <div className="profile-hero-avatar-badge">
                <i className="ri-star-fill"></i>
              </div>
            </div>

            {/* User Details */}
            <div className="profile-hero-details">
              <div className="profile-hero-details-main">
                <div className="profile-hero-name-section">
                  <h2 className="profile-hero-name">{user.username || ''}</h2>
                  <p className="profile-hero-handle">@{user.email?.split('@')[0]}</p>
                  <p className="profile-hero-meta">
                    {t('profile_member_since', { date: formatJoinDate(user.createdAt) || '2024.01.01' })}
                  </p>
                </div>
              </div>

              {/* Rating Display */}
              <div className="profile-hero-rating">
                <div className="profile-hero-rating-stars">
                  <div className="profile-hero-stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <i
                        key={star}
                        className={star <= topRatingStars ? 'ri-star-fill' : 'ri-star-line'}
                      ></i>
                    ))}
                  </div>
                  <span className="profile-hero-rating-score">{topRatingScore}</span>
                </div>
                <p className="profile-hero-rating-label">
                  {t('profile_top_rating')} {topRating.category && `(${t(`endorsement_category_${topRating.category}`)})`}
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid - Uses cached/immediate data */}
          <div className="profile-hero-stats">
            <div className="profile-hero-stat-card">
              <div className="profile-hero-stat-value">
                {isBoardLoading ? '-' : createdMeetings.length}
              </div>
              <div className="profile-hero-stat-label">{t('profile_stat_created')}</div>
            </div>
            <div className="profile-hero-stat-card">
              <div className="profile-hero-stat-value">
                {isBoardLoading ? '-' : participatingMeetings.length}
              </div>
              <div className="profile-hero-stat-label">{t('profile_stat_participated')}</div>
            </div>
            <div className="profile-hero-stat-card">
              <div className="profile-hero-stat-value profile-hero-stat-amber">{topRatingScore}</div>
              <div className="profile-hero-stat-label">{t('profile_top_rating')}</div>
            </div>
            <div className="profile-hero-stat-card">
              <div className="profile-hero-stat-value profile-hero-stat-cyan">{user.endorsementStats?.points || 0}</div>
              <div className="profile-hero-stat-label">{t('profile_stat_points')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="profile-tabs-wrapper">
        <div className="profile-tabs-container">
          <div className="profile-tabs">
            <button
              className={`profile-tab ${activeSection === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveSection('overview')}
            >
              {t('profile_tab_overview')}
            </button>
            <button
              className={`profile-tab ${activeSection === 'interests' ? 'active' : ''}`}
              onClick={() => setActiveSection('interests')}
            >
              {t('profile_tab_interests')}
            </button>
            <button
              className={`profile-tab ${activeSection === 'activity' ? 'active' : ''}`}
              onClick={() => setActiveSection('activity')}
            >
              {t('profile_tab_recent_activity')}
            </button>
            <button
              className={`profile-tab ${activeSection === 'badges' ? 'active' : ''}`}
              onClick={() => setActiveSection('badges')}
            >
              {t('profile_tab_badges')}
            </button>
            
          </div>
        </div>
      </div>

      <div className="profile-container">
        {/* Content Sections - Tab-based loading */}
        <div className="profile-content">
          {/* Overview Tab */}
          {activeSection === 'overview' && (
            isTabLoading('overview') ? (
              <OverviewSkeleton />
            ) : (
              <div className="profile-overview-section">
                <div className="profile-overview-grid">
                  {/* Left Column - Main Content */}
                  <div className="profile-overview-main">
                    {/* Activity Stats - 4개 통계 프로그레스 바 */}
                    <div className="profile-card">
                      <h3 className="profile-card-title">{t('profile_activity_highlights')}</h3>
                      <div className="profile-progress-list">
                        <div className="profile-progress-item">
                          <span className="profile-progress-label">{t('profile_discussion_participation')}</span>
                          <div className="profile-progress-bar-wrapper">
                            <div className="profile-progress-bar">
                              <div
                                className="profile-progress-fill slate"
                                style={{ width: `${reputationData?.participationStats?.attendanceRate || 0}%` }}
                              ></div>
                            </div>
                            <span className="profile-progress-value">
                              {reputationData?.participationStats?.attendanceRate || 0}%
                            </span>
                          </div>
                        </div>
                        <div className="profile-progress-item">
                          <span className="profile-progress-label">{t('profile_user_feedback')}</span>
                          <div className="profile-progress-bar-wrapper">
                            <div className="profile-progress-bar">
                              <div
                                className="profile-progress-fill amber"
                                style={{
                                  width: `${reputationData?.participationStats?.feedbackPossibleCount
                                    ? Math.min(100, (reputationData.participationStats.feedbackGivenCount / reputationData.participationStats.feedbackPossibleCount) * 100)
                                    : 0}%`
                                }}
                              ></div>
                            </div>
                            <span className="profile-progress-value">
                              {reputationData?.participationStats?.feedbackPossibleCount
                                ? Math.round((reputationData.participationStats.feedbackGivenCount / reputationData.participationStats.feedbackPossibleCount) * 100)
                                : 0}%
                            </span>
                          </div>
                        </div>
                        <div className="profile-progress-item">
                          <span className="profile-progress-label">{t('profile_on_time_entry')}</span>
                          <div className="profile-progress-bar-wrapper">
                            <div className="profile-progress-bar">
                              <div
                                className="profile-progress-fill cyan"
                                style={{ width: `${reputationData?.participationStats?.onTimeRate || 0}%` }}
                              ></div>
                            </div>
                            <span className="profile-progress-value">
                              {reputationData?.participationStats?.onTimeRate || 0}%
                            </span>
                          </div>
                        </div>
                        <div className="profile-progress-item">
                          <span className="profile-progress-label">{t('profile_participation_streak')}</span>
                          <div className="profile-progress-bar-wrapper">
                            <div className="profile-progress-bar">
                              <div
                                className="profile-progress-fill emerald"
                                style={{
                                  width: `${reputationData?.participationStats?.totalConfirmed
                                    ? Math.min(100, (reputationData.participationStats.currentStreak / reputationData.participationStats.totalConfirmed) * 100)
                                    : 0}%`
                                }}
                              ></div>
                            </div>
                            <span className="profile-progress-value">
                              {reputationData?.participationStats?.currentStreak || 0}{t('profile_times_unit')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Monthly Highlights */}
                    <div className="profile-card">
                      <h3 className="profile-card-title">{t('profile_monthly_highlights')}</h3>
                      <div className="profile-highlights-grid">
                        <div className="profile-highlight-card slate">
                          <div className="profile-highlight-header">
                            <div className="profile-highlight-icon">
                              <i className="ri-discuss-line"></i>
                            </div>
                            <span className="profile-highlight-label">{t('profile_discussion_participation')}</span>
                          </div>
                          <div className="profile-highlight-value">{createdMeetings.length + participatingMeetings.length}{t('profile_times_unit')}</div>
                          <div className="profile-highlight-sub">{t('profile_compared_last_month', { count: 3 })}</div>
                        </div>
                        <div className="profile-highlight-card amber">
                          <div className="profile-highlight-header">
                            <div className="profile-highlight-icon">
                              <i className="ri-star-fill"></i>
                            </div>
                            <span className="profile-highlight-label">{t('profile_top_rating')}</span>
                          </div>
                          <div className="profile-highlight-value">{topRatingScore}</div>
                          <div className="profile-highlight-sub">
                            {topRating.category && t(`endorsement_category_${topRating.category}`)}
                          </div>
                        </div>
                        <div className="profile-highlight-card cyan">
                          <div className="profile-highlight-header">
                            <div className="profile-highlight-icon">
                              <i className="ri-trophy-line"></i>
                            </div>
                            <span className="profile-highlight-label">{t('profile_earned_points')}</span>
                          </div>
                          <div className="profile-highlight-value">{user.endorsementStats?.points || 0}</div>
                          <div className="profile-highlight-sub">{t('profile_monthly_total')}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Sidebar */}
                  <div className="profile-overview-sidebar">
                    {/* Contact Info */}
                    <div className="profile-card">
                      <h3 className="profile-card-title">{t('profile_contact_info')}</h3>
                      <div className="profile-contact-list">
                        <div className="profile-contact-item">
                          <div className="profile-contact-icon">
                            <i className="ri-mail-line"></i>
                          </div>
                          <div className="profile-contact-content">
                            <div className="profile-contact-value">{user.email}</div>
                            <div className="profile-contact-label">{t('profile_email')}</div>
                          </div>
                        </div>
                        {/* Location - only show if visibility is enabled and location exists */}
                        {user.setting?.visibility?.elements?.location && user.profile?.introduce?.location && (
                          user.profile.introduce.location.city || user.profile.introduce.location.country
                        ) && (
                          <div className="profile-contact-item">
                            <div className="profile-contact-icon">
                              <i className="ri-map-pin-line"></i>
                            </div>
                            <div className="profile-contact-content">
                              <div className="profile-contact-value">
                                {[user.profile.introduce.location.city, user.profile.introduce.location.country]
                                  .filter(Boolean)
                                  .join(', ')}
                              </div>
                              <div className="profile-contact-label">{t('profile_location')}</div>
                            </div>
                          </div>
                        )}
                        <div className="profile-contact-item">
                          <div className="profile-contact-icon">
                            <i className="ri-calendar-line"></i>
                          </div>
                          <div className="profile-contact-content">
                            <div className="profile-contact-value">{formatJoinDate(user.createdAt) || '2024.01.01'}</div>
                            <div className="profile-contact-label">{t('profile_join_date')}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Reputation Details */}
                    <div className="profile-card">
                      <h3 className="profile-card-title">{t('profile_reputation_details')}</h3>
                      <div className="profile-reputation-list">
                        {['ENGAGEMENT', 'COMMUNICATION', 'RESPECT', 'RULE_ADHERENCE', 'PREPARATION', 'REMATCH'].map((category) => {
                          const score = reputationData?.endorsementStats?.categoryScores?.[category] || 0;
                          const filledStars = Math.round(score);
                          return (
                            <div key={category} className="profile-reputation-item">
                              <span className="profile-reputation-label">{t(`endorsement_category_${category}`)}</span>
                              <div className="profile-reputation-stars">
                                <div className="profile-stars">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <i key={star} className={star <= filledStars ? 'ri-star-fill' : 'ri-star-line'}></i>
                                  ))}
                                </div>
                                <span className="profile-reputation-score">{score.toFixed(1)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

          {/* Activity Tab */}
          {activeSection === 'activity' && (
            isTabLoading('activity') ? (
              <ActivitySkeleton />
            ) : (
              <div className="profile-section">
                {/* Recent Activity Timeline */}
                <div className="recent-activity-card">
                  <div className="recent-activity-header">
                    <h3 className="recent-activity-title">{t('profile_recent_activity_title')}</h3>
                    <p className="recent-activity-subtitle">{t('profile_recent_activity_subtitle')}</p>
                  </div>
                  <div className="recent-activity-content">
                    {reputationData?.recentActivities && reputationData.recentActivities.length > 0 ? (
                      <>
                        <div className="recent-activity-list">
                          {(showAllActivities
                            ? reputationData.recentActivities
                            : reputationData.recentActivities.slice(0, 5)
                          ).map((activity, index) => (
                            <div
                              key={`${activity.type}-${activity.postId || ''}-${index}`}
                              className={`recent-activity-item ${activity.postId ? 'clickable' : ''}`}
                              onClick={() => activity.postId && navigate('/')}
                            >
                              <div
                                className="recent-activity-icon"
                                style={{ background: getGradientStyle(activity.gradientColors) }}
                              >
                                <i className={activity.icon || 'ri-checkbox-circle-fill'}></i>
                              </div>
                              <div className="recent-activity-info">
                                <p className="recent-activity-text">{activity.title}</p>
                                <p className="recent-activity-desc">{activity.description}</p>
                                <p className="recent-activity-date">{formatJoinDate(activity.timestamp)}</p>
                              </div>
                              {activity.participantCount != null && activity.participantCount > 0 && (
                                <div className="recent-activity-participants">
                                  <i className="ri-group-line"></i>
                                  <span>{activity.participantCount}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {reputationData.recentActivities.length > 5 && (
                          <div className="recent-activity-footer">
                            <button
                              className="recent-activity-load-more"
                              onClick={() => setShowAllActivities(!showAllActivities)}
                            >
                              {showAllActivities ? t('profile_show_less') : t('profile_view_all')}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="recent-activity-empty">
                        <i className="ri-time-line"></i>
                        <p>{t('profile_no_activities')}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Created Meetings */}
                <div className="meetings-section">
                  <div className="meetings-section-header">
                    <div className="meetings-section-icon created">
                      <i className="ri-add-circle-fill"></i>
                    </div>
                    <h3>{t('dropdown_my_created_meetings')}</h3>
                  </div>
                  {isBoardLoading ? (
                    <div className="profile-loading">{t('loading')}</div>
                  ) : createdMeetings.length === 0 ? (
                    <div className="no-meetings">
                      <i className="ri-calendar-line"></i>
                      <p>{t('profile_no_created_meetings')}</p>
                    </div>
                  ) : (
                    <div className="meetings-list">
                      {(showAllCreated ? createdMeetings : createdMeetings.slice(0, 5)).map(post => (
                        <div key={post.id} className="meeting-card" onClick={() => navigate('/')}>
                          <div className="meeting-card-left">
                            <div className="meeting-book-icon">
                              <i className="ri-book-open-fill"></i>
                            </div>
                            <div className="meeting-info">
                              <span className="meeting-book">{post.bookData?.title}</span>
                              <div className="meeting-meta">
                                <span className="meeting-date">
                                  <i className="ri-calendar-line"></i>
                                  {formatDate(post.due)}
                                </span>
                                <span className="meeting-members">
                                  <i className="ri-group-line"></i>
                                  {post.memberIds?.length || 0}/{post.capacity}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="meeting-card-arrow">
                            <i className="ri-arrow-right-s-line"></i>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {createdMeetings.length > 5 && (
                    <button
                      className="view-all-btn"
                      onClick={() => setShowAllCreated(!showAllCreated)}
                    >
                      {showAllCreated ? t('profile_show_less') : t('profile_view_all')}
                      <i className={showAllCreated ? 'ri-arrow-up-line' : 'ri-arrow-down-line'}></i>
                    </button>
                  )}
                </div>

                {/* Participating Meetings */}
                <div className="meetings-section">
                  <div className="meetings-section-header">
                    <div className="meetings-section-icon participating">
                      <i className="ri-calendar-check-fill"></i>
                    </div>
                    <h3>{t('dropdown_participating_meetings')}</h3>
                  </div>
                  {isBoardLoading ? (
                    <div className="profile-loading">{t('loading')}</div>
                  ) : participatingMeetings.length === 0 ? (
                    <div className="no-meetings">
                      <i className="ri-calendar-line"></i>
                      <p>{t('profile_no_participating_meetings')}</p>
                    </div>
                  ) : (
                    <div className="meetings-list">
                      {(showAllParticipating ? participatingMeetings : participatingMeetings.slice(0, 5)).map(post => (
                        <div key={post.id} className="meeting-card" onClick={() => navigate('/')}>
                          <div className="meeting-card-left">
                            <div className="meeting-book-icon">
                              <i className="ri-book-open-fill"></i>
                            </div>
                            <div className="meeting-info">
                              <span className="meeting-book">{post.bookData?.title}</span>
                              <div className="meeting-meta">
                                <span className="meeting-date">
                                  <i className="ri-calendar-line"></i>
                                  {formatDate(post.due)}
                                </span>
                                <span className="meeting-members">
                                  <i className="ri-group-line"></i>
                                  {post.memberIds?.length || 0}/{post.capacity}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="meeting-card-arrow">
                            <i className="ri-arrow-right-s-line"></i>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {participatingMeetings.length > 5 && (
                    <button
                      className="view-all-btn"
                      onClick={() => setShowAllParticipating(!showAllParticipating)}
                    >
                      {showAllParticipating ? t('profile_show_less') : t('profile_view_all')}
                      <i className={showAllParticipating ? 'ri-arrow-up-line' : 'ri-arrow-down-line'}></i>
                    </button>
                  )}
                </div>
              </div>
            )
          )}

          {/* Badges Tab */}
          {activeSection === 'badges' && (
            isTabLoading('badges') ? (
              <BadgesSkeleton />
            ) : (
              <div className="profile-section profile-badges-section">
                {/* Header */}
                <div className="profile-badges-header">
                  <h2 className="profile-section-title">{t('reputation_badges_title')}</h2>
                  {reputationData?.badgeInfo && (
                    <div className="profile-badges-count">
                      <span className="profile-badges-earned">{reputationData.badgeInfo.earnedCount}</span>
                      <span className="profile-badges-total">/ {reputationData.badgeInfo.totalCount} {t('reputation_badges_earned')}</span>
                    </div>
                  )}
                </div>

                {/* Earned Badges */}
                {reputationData?.badgeInfo?.earnedBadges && reputationData.badgeInfo.earnedBadges.length > 0 && (
                  <div className="profile-badge-group">
                    <h3 className="profile-badge-group-title">
                      <div className="profile-badge-group-icon earned">
                        <i className="ri-trophy-fill"></i>
                      </div>
                      {t('reputation_earned_badges')}
                    </h3>
                    <div className="profile-badges-grid">
                      {reputationData.badgeInfo.earnedBadges.map((badge) => (
                        <div key={badge.id} className="profile-badge-card earned">
                          <div
                            className="profile-badge-icon"
                            style={{ background: getGradientStyle(badge.gradientColors) }}
                          >
                            <i className={badge.icon}></i>
                          </div>
                          <h4 className="profile-badge-name">{badge.name}</h4>
                          <p className="profile-badge-desc">{badge.description}</p>
                          {badge.earnedAt && (
                            <div className="profile-badge-date">
                              <i className="ri-calendar-line"></i>
                              <span>{formatBadgeDate(badge.earnedAt)}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Locked Badges */}
                {reputationData?.badgeInfo?.lockedBadges && reputationData.badgeInfo.lockedBadges.length > 0 && (
                  <div className="profile-badge-group">
                    <h3 className="profile-badge-group-title">
                      <div className="profile-badge-group-icon locked">
                        <i className="ri-lock-fill"></i>
                      </div>
                      {t('reputation_locked_badges')}
                    </h3>
                    <div className="profile-badges-grid">
                      {reputationData.badgeInfo.lockedBadges.map((badge) => (
                        <div key={badge.id} className="profile-badge-card locked">
                          {/* Lock Overlay on Hover */}
                          <div className="profile-badge-lock-overlay">
                            <div className="profile-badge-lock-icon">
                              <i className="ri-lock-fill"></i>
                            </div>
                          </div>

                          <div
                            className="profile-badge-icon"
                            style={{ background: getGradientStyle(badge.gradientColors) }}
                          >
                            <i className={badge.icon}></i>
                          </div>
                          <h4 className="profile-badge-name">{badge.name}</h4>
                          <p className="profile-badge-desc">{badge.description}</p>

                          {/* Progress Bar */}
                          {badge.progress !== undefined && badge.goal !== undefined && (
                            <div className="profile-badge-progress">
                              <div className="profile-badge-progress-header">
                                <span>{t('reputation_progress')}</span>
                                <span>{badge.progress}/{badge.goal}</span>
                              </div>
                              <div className="profile-badge-progress-bar">
                                <div
                                  className="profile-badge-progress-fill"
                                  style={{
                                    width: `${Math.min((badge.progress / badge.goal) * 100, 100)}%`,
                                    background: getGradientStyle(badge.gradientColors)
                                  }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {(!reputationData?.badgeInfo || (reputationData.badgeInfo.earnedBadges.length === 0 && reputationData.badgeInfo.lockedBadges.length === 0)) && (
                  <div className="profile-empty-badges">
                    <div className="profile-empty-badges-icon">
                      <i className="ri-trophy-line"></i>
                    </div>
                    <h3>{t('profile_no_badges')}</h3>
                    <p>{t('profile_no_badges_desc')}</p>
                  </div>
                )}
              </div>
            )
          )}

          {/* Interests Tab - Uses user data, no API loading needed */}
          {activeSection === 'interests' && (
            <div className="profile-section profile-interests-section">
              {/* Interests & Preferences Card */}
              <div className="profile-interests-card">
                <div className="profile-interests-header">
                  <h3 className="profile-interests-title">{t('profile_interests_title')}</h3>
                  <p className="profile-interests-subtitle">{t('profile_interests_subtitle')}</p>
                </div>

                <div className="profile-interests-content">
                  {/* Introduction */}
                  <div className="profile-interests-group">
                    <h4 className="profile-interests-group-title">{t('profile_introduction')}</h4>
                    <div className="profile-introduction-box">
                      {user.profile?.introduce?.introduction ? (
                        <p className="profile-introduction-text">{user.profile.introduce.introduction}</p>
                      ) : (
                        <span className="profile-empty-text">{t('profile_no_introduction')}</span>
                      )}
                    </div>
                  </div>

                  {/* Preferred Genres */}
                  <div className="profile-interests-group">
                    <h4 className="profile-interests-group-title">{t('profile_preferred_genres')}</h4>
                    <div className="profile-genre-tags">
                      {user.profile?.introduce?.preferredGenre && user.profile.introduce.preferredGenre.length > 0 ? (
                        user.profile.introduce.preferredGenre.map((genre, index) => (
                          <span key={index} className="profile-genre-tag">{t(`settings_genre_${genre}`)}</span>
                        ))
                      ) : (
                        <span className="profile-empty-text">{t('profile_no_genres_set')}</span>
                      )}
                    </div>
                  </div>

                  {/* Reading Style */}
                  <div className="profile-interests-group">
                    <h4 className="profile-interests-group-title">{t('profile_reading_style')}</h4>
                    <div className="profile-style-grid">
                      <div className="profile-style-card">
                        <h5 className="profile-style-card-title">{t('profile_discussion_style')}</h5>
                        <p className="profile-style-card-desc">
                          {user.profile?.introduce?.styles?.discussionStyle
                            ? t(`settings_style_${user.profile.introduce.styles.discussionStyle}`)
                            : t('profile_not_set')}
                        </p>
                      </div>
                      <div className="profile-style-card">
                        <h5 className="profile-style-card-title">{t('profile_preferred_time')}</h5>
                        <p className="profile-style-card-desc">
                          {user.profile?.introduce?.styles?.preferredTime
                            ? t(`settings_time_${user.profile.introduce.styles.preferredTime}`)
                            : t('profile_not_set')}
                        </p>
                      </div>
                      <div className="profile-style-card">
                        <h5 className="profile-style-card-title">{t('profile_discussion_size')}</h5>
                        <p className="profile-style-card-desc">
                          {user.profile?.introduce?.styles?.preferredSize
                            ? t(`settings_size_${user.profile.introduce.styles.preferredSize}`)
                            : t('profile_not_set')}
                        </p>
                      </div>
                      <div className="profile-style-card">
                        <h5 className="profile-style-card-title">{t('profile_ai_usage')}</h5>
                        <p className="profile-style-card-desc">
                          {user.profile?.introduce?.styles?.useAI
                            ? t(`settings_ai_${user.profile.introduce.styles.useAI}`)
                            : t('profile_not_set')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Interest Keywords */}
                  <div className="profile-interests-group">
                    <h4 className="profile-interests-group-title">{t('profile_interest_keywords')}</h4>
                    <div className="profile-keyword-tags">
                      {user.profile?.introduce?.keywords && user.profile.introduce.keywords.length > 0 ? (
                        user.profile.introduce.keywords.map((keyword, index) => (
                          <span key={index} className="profile-keyword-tag">#{keyword}</span>
                        ))
                      ) : (
                        <span className="profile-empty-text">{t('profile_no_keywords_set')}</span>
                      )}
                    </div>
                  </div>

                  {/* Goals */}
                  <div className="profile-interests-group">
                    <h4 className="profile-interests-group-title">{t('profile_monthly_goals')}</h4>
                    <div className="profile-goals-list">
                      <div className="profile-goal-item">
                        <span className="profile-goal-label">{t('profile_goal_participate')}</span>
                        <span className="profile-goal-value">
                          {participatingMeetings.length}/{user.profile?.introduce?.goals?.participate || 0}
                        </span>
                      </div>
                      <div className="profile-goal-item">
                        <span className="profile-goal-label">{t('profile_goal_create')}</span>
                        <span className="profile-goal-value">
                          {createdMeetings.length}/{user.profile?.introduce?.goals?.create || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Go to Settings */}
              <div className="profile-settings-link-card">
                <div className="profile-settings-link-content">
                  <div className="profile-settings-link-icon">
                    <i className="ri-settings-3-line"></i>
                  </div>
                  <div className="profile-settings-link-text">
                    <h3>{t('dropdown_account_settings')}</h3>
                    <p>{t('profile_settings_link_desc')}</p>
                  </div>
                </div>
                <button
                  className="profile-settings-link-btn"
                  onClick={() => navigate('/settings')}
                >
                  {t('profile_go_to_settings')}
                  <i className="ri-arrow-right-line"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
