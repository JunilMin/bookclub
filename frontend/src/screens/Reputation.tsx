import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext/AuthContext';
import { getMyReputation, UserReputationResponse } from '../api/user';
import HexagonChart from '../components/HexagonChart';
import './styles/Reputation.css';

const Reputation: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();

  const [reputationData, setReputationData] = useState<UserReputationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllActivities, setShowAllActivities] = useState(false);

  useEffect(() => {
    const fetchReputation = async () => {
      if (!accessToken) return;

      setIsLoading(true);
      setError(null);

      try {
        const locale = i18n.language === 'ko' ? 'ko' : 'en';
        const data = await getMyReputation(accessToken, locale);
        setReputationData(data);
      } catch (err) {
        console.error('Failed to fetch reputation:', err);
        setError(t('reputation_error_fetch'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchReputation();
  }, [accessToken, i18n.language, t]);

  if (!user) {
    return (
      <div className="reputation-container">
        <div className="reputation-login-required">
          <p>{t('reputation_login_required')}</p>
          <button onClick={() => navigate('/login')} className="login-btn">
            {t('nav_login')}
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="reputation-container">
        <div className="reputation-loading">
          <div className="loading-spinner"></div>
          <p>{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reputation-container">
        <div className="reputation-error">
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="retry-btn">
            {t('browse_retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!reputationData) return null;

  const { participationStats, endorsementStats, badgeInfo, recentActivities, monthlyAttendance } = reputationData;

  // Default avatar
  const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiI+PC9wYXRoPjxjaXJjbGUgY3g9IjEyIiBjeT0iNyIgcj0iNCI+PC9jaXJjbGU+PC9zdmc+';
  const avatarUrl = reputationData.photoUrl || defaultAvatar;

  // Get max value for monthly chart
  const maxMonthlyAttended = Math.max(...monthlyAttendance.map(m => m.attended), 1);

  // Endorsement category labels
  const categoryLabels: Record<string, string> = {
    ENGAGEMENT: t('endorsement_engagement'),
    COMMUNICATION: t('endorsement_communication'),
    RESPECT: t('endorsement_respect'),
    RULE_ADHERENCE: t('endorsement_rule_adherence'),
    PREPARATION: t('endorsement_preparation'),
    REMATCH: t('endorsement_rematch'),
  };

  // Activities to display
  const displayedActivities = showAllActivities ? recentActivities : recentActivities.slice(0, 5);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Gradient 클래스를 CSS 변수로 변환
  const getGradientStyle = (gradientColors: string) => {
    const gradientMap: Record<string, string> = {
      'from-yellow-400 to-yellow-600': 'linear-gradient(135deg, #facc15, #ca8a04)',
      'from-blue-400 to-blue-600': 'linear-gradient(135deg, #60a5fa, #2563eb)',
      'from-orange-400 to-red-600': 'linear-gradient(135deg, #fb923c, #dc2626)',
      'from-purple-400 to-purple-600': 'linear-gradient(135deg, #c084fc, #9333ea)',
      'from-amber-400 to-amber-600': 'linear-gradient(135deg, #fbbf24, #d97706)',
      'from-indigo-400 to-indigo-600': 'linear-gradient(135deg, #818cf8, #4f46e5)',
      'from-teal-400 to-teal-600': 'linear-gradient(135deg, #2dd4bf, #0d9488)',
      'from-violet-400 to-violet-600': 'linear-gradient(135deg, #a78bfa, #7c3aed)',
      'from-emerald-400 to-emerald-600': 'linear-gradient(135deg, #34d399, #059669)',
      'from-lime-400 to-lime-600': 'linear-gradient(135deg, #a3e635, #65a30d)',
      'from-rose-400 to-rose-600': 'linear-gradient(135deg, #fb7185, #e11d48)',
      'from-cyan-400 to-cyan-600': 'linear-gradient(135deg, #22d3ee, #0891b2)',
      'from-pink-400 to-pink-600': 'linear-gradient(135deg, #f472b6, #db2777)',
      'from-yellow-400 to-amber-600': 'linear-gradient(135deg, #facc15, #d97706)',
      'from-orange-400 to-orange-600': 'linear-gradient(135deg, #fb923c, #ea580c)',
    };
    return gradientMap[gradientColors] || 'linear-gradient(135deg, #6b7280, #4b5563)';
  };

  return (
    <div className="reputation-container">
      {/* Hero Section */}
      <section className="reputation-hero">
        <div className="hero-background">
          <div className="hero-gradient"></div>
        </div>
        <div className="hero-content">
          <div className="profile-header">
            <img
              src={avatarUrl}
              alt={reputationData.username}
              className="profile-avatar-large"
              onError={(e) => {
                (e.target as HTMLImageElement).src = defaultAvatar;
              }}
            />
            <div className="profile-info">
              <h1 className="profile-username">{reputationData.username}</h1>
              <p className="profile-email">{reputationData.email}</p>
              <div className="profile-badge-summary">
                <span className="badge-count">
                  🏅 {badgeInfo.earnedCount} / {badgeInfo.totalCount} {t('reputation_badges')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Cards */}
      <section className="stats-section">
        <h2 className="section-title">{t('reputation_stats_title')}</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon total">📚</div>
            <div className="stat-content">
              <span className="stat-value">{participationStats.totalParticipated}</span>
              <span className="stat-label">{t('reputation_total_participated')}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon attended">✅</div>
            <div className="stat-content">
              <span className="stat-value">{participationStats.attended}</span>
              <span className="stat-label">{t('reputation_attended')}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon absent">❌</div>
            <div className="stat-content">
              <span className="stat-value">{participationStats.absent}</span>
              <span className="stat-label">{t('profile_absent')}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon late">⏰</div>
            <div className="stat-content">
              <span className="stat-value">{participationStats.late}</span>
              <span className="stat-label">{t('profile_late')}</span>
            </div>
          </div>
          <div className="stat-card highlight">
            <div className="stat-icon rate">📊</div>
            <div className="stat-content">
              <span className="stat-value">{participationStats.attendanceRate}%</span>
              <span className="stat-label">{t('reputation_attendance_rate')}</span>
            </div>
          </div>
          <div className="stat-card highlight">
            <div className="stat-icon ontime">⏱️</div>
            <div className="stat-content">
              <span className="stat-value">{participationStats.onTimeRate}%</span>
              <span className="stat-label">{t('reputation_ontime_rate')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Endorsement Section */}
      <section className="endorsement-section">
        <h2 className="section-title">{t('reputation_endorsement_title')}</h2>
        <div className="endorsement-content">
          <div className="hexagon-wrapper">
            <HexagonChart data={endorsementStats.categoryCounts} />
            <div className="endorsement-overall">
              <span className="overall-score">{endorsementStats.averageScore.toFixed(1)}</span>
              <span className="overall-label">{t('reputation_average_score')}</span>
            </div>
          </div>
          <div className="endorsement-details">
            <div className="endorsement-summary-stats">
              <div className="summary-stat">
                <span className="summary-value">{endorsementStats.count}</span>
                <span className="summary-label">{t('profile_total_endorsements')}</span>
              </div>
              <div className="summary-stat">
                <span className="summary-value">{endorsementStats.points}</span>
                <span className="summary-label">{t('profile_total_points')}</span>
              </div>
            </div>
            <div className="category-breakdown">
              {Object.entries(endorsementStats.categoryScores).map(([category, score]) => (
                <div key={category} className="category-row">
                  <span className="category-name">{categoryLabels[category] || category}</span>
                  <div className="category-bar">
                    <div
                      className="category-fill"
                      style={{ width: `${(score / 5) * 100}%` }}
                    />
                  </div>
                  <span className="category-score">{score.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Monthly Attendance Section */}
      <section className="attendance-section">
        <h2 className="section-title">{t('reputation_monthly_title')}</h2>
        <div className="monthly-chart">
          {monthlyAttendance.map((month) => (
            <div key={month.month} className="month-bar-wrapper">
              <div
                className="month-bar"
                style={{ height: `${Math.max((month.attended / maxMonthlyAttended) * 100, 5)}%` }}
              >
                {month.attended > 0 && (
                  <span className="month-value">{month.attended}</span>
                )}
              </div>
              <span className="month-label">{month.monthLabel}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Badge Collection Section */}
      <section className="badges-section-new">
        <div className="badges-header">
          <h2 className="badges-title">{t('reputation_badges_title')}</h2>
          <p className="badges-subtitle">
            {t('reputation_badges_subtitle')}
          </p>
          <div className="badges-count-display">
            <span className="earned-count">{badgeInfo.earnedCount}</span>
            <span className="total-count">/ {badgeInfo.totalCount} {t('reputation_badges_earned')}</span>
          </div>
        </div>

        {/* Earned Badges */}
        {badgeInfo.earnedBadges.length > 0 && (
          <div className="badge-group-new">
            <h3 className="badge-group-header">
              <div className="badge-group-icon earned">
                <i className="ri-trophy-fill"></i>
              </div>
              {t('reputation_earned_badges')}
            </h3>
            <div className="badges-grid-new">
              {badgeInfo.earnedBadges.map((badge) => (
                <div key={badge.id} className="badge-card-new earned">
                  <div
                    className="badge-icon-new"
                    style={{ background: getGradientStyle(badge.gradientColors) }}
                  >
                    <i className={badge.icon}></i>
                  </div>
                  <h4 className="badge-name-new">{badge.name}</h4>
                  <p className="badge-description-new">{badge.description}</p>
                  {badge.earnedAt && (
                    <div className="badge-earned-date-new">
                      <i className="ri-calendar-line"></i>
                      <span>{formatDate(badge.earnedAt)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locked Badges */}
        {badgeInfo.lockedBadges.length > 0 && (
          <div className="badge-group-new">
            <h3 className="badge-group-header">
              <div className="badge-group-icon locked">
                <i className="ri-lock-fill"></i>
              </div>
              {t('reputation_locked_badges')}
            </h3>
            <div className="badges-grid-new">
              {badgeInfo.lockedBadges.map((badge) => (
                <div key={badge.id} className="badge-card-new locked">
                  {/* Lock Overlay on Hover */}
                  <div className="badge-lock-overlay">
                    <div className="lock-icon-circle">
                      <i className="ri-lock-fill"></i>
                    </div>
                  </div>

                  <div
                    className="badge-icon-new"
                    style={{ background: getGradientStyle(badge.gradientColors) }}
                  >
                    <i className={badge.icon}></i>
                  </div>
                  <h4 className="badge-name-new">{badge.name}</h4>
                  <p className="badge-description-new">{badge.description}</p>

                  {/* Progress Bar */}
                  {badge.progress !== undefined && badge.goal !== undefined && (
                    <div className="badge-progress-new">
                      <div className="progress-header">
                        <span>{t('reputation_progress')}</span>
                        <span>{badge.progress}/{badge.goal}</span>
                      </div>
                      <div className="progress-bar-new">
                        <div
                          className="progress-fill-new"
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
      </section>

      {/* Activity Timeline Section */}
      <section className="activity-section">
        <h2 className="section-title">{t('reputation_activity_title')}</h2>
        {recentActivities.length === 0 ? (
          <div className="activity-empty">
            <p>{t('reputation_no_activities')}</p>
          </div>
        ) : (
          <>
            <div className="activity-timeline">
              {displayedActivities.map((activity, index) => (
                <div
                  key={`${activity.postId}-${index}`}
                  className="activity-item"
                  onClick={() => activity.postId && navigate(`/`)}
                >
                  <div className="activity-dot"></div>
                  <div className="activity-content">
                    <div className="activity-header">
                      <span className="activity-title">{activity.title}</span>
                      <span className="activity-date">{formatDate(activity.timestamp)}</span>
                    </div>
                    <p className="activity-description">{activity.description}</p>
                    {activity.participantCount && (
                      <span className="activity-participants">
                        👥 {activity.participantCount} {t('browse_card_participants')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {recentActivities.length > 5 && (
              <button
                className="load-more-btn"
                onClick={() => setShowAllActivities(!showAllActivities)}
              >
                {showAllActivities ? t('reputation_show_less') : t('reputation_load_more')}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default Reputation;
