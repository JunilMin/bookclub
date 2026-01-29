import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext/AuthContext';
import { getMyReputation, UserReputationResponse } from '../api/user';
import HexagonChart from '../components/HexagonChart';
import HeroSection, { HeroStatCard, HeroMetaItem } from '../components/HeroSection';
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
    if (!gradientColors) return 'linear-gradient(135deg, #6b7280, #4b5563)';

    // 이미 hex 형식이면 linear-gradient로 변환 ("#10B981,#059669")
    if (gradientColors.startsWith('#')) {
      const parts = gradientColors.split(',');
      return `linear-gradient(135deg, ${parts.join(', ')})`;
    }

    // Tailwind 클래스 형식이면 매핑
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

  // 총 확정 출석 수 (생성&참여 + 참여)
  const totalConfirmed = participationStats.createdAndAttended + participationStats.participated;

  // Build hero section data for Reputation page
  const reputationMetaStats: HeroMetaItem[] = [
    {
      icon: 'ri-calendar-check-line',
      value: totalConfirmed,
      label: t('reputation_attended'),
    },
    {
      icon: 'ri-trophy-line',
      value: badgeInfo.earnedCount,
      label: t('reputation_badges'),
    },
  ];

  const reputationStatCards: HeroStatCard[] = [
    {
      iconClass: 'ri-calendar-check-fill',
      iconColor: 'slate',
      value: participationStats.totalMeetings,
      unit: t('reputation_unit_times'),
      label: t('reputation_total_meetings'),
    },
    {
      iconClass: 'ri-checkbox-circle-fill',
      iconColor: 'cyan',
      value: totalConfirmed,
      unit: t('reputation_unit_times'),
      label: t('reputation_attended'),
    },
    {
      iconClass: 'ri-close-circle-fill',
      iconColor: 'red',
      value: participationStats.absent,
      unit: t('reputation_unit_times'),
      label: t('profile_absent'),
    },
    {
      iconClass: 'ri-time-fill',
      iconColor: 'orange',
      value: participationStats.late,
      unit: t('reputation_unit_times'),
      label: t('profile_late'),
    },
    {
      iconClass: 'ri-percent-line',
      iconColor: 'blue',
      value: participationStats.attendanceRate,
      unit: '%',
      label: t('reputation_attendance_rate'),
    },
    {
      iconClass: 'ri-timer-line',
      iconColor: 'purple',
      value: participationStats.onTimeRate,
      unit: '%',
      label: t('reputation_ontime_rate'),
    },
  ];

  return (
    <div className="reputation-container">
      {/* Hero Section */}
      <HeroSection
        username={reputationData.username}
        email={reputationData.email}
        photoUrl={reputationData.photoUrl}
        metaStats={reputationMetaStats}
        statCards={reputationStatCards}
      />

      {/* Endorsement Section */}
      <section className="endorsement-section">
        <div className="endorsement-container">
          {/* Header */}
          <div className="endorsement-header">
            <h2 className="endorsement-title">{t('reputation_endorsement_title')}</h2>
            <p className="endorsement-subtitle">{t('reputation_endorsement_subtitle')}</p>
          </div>

          {/* Content Grid */}
          <div className="endorsement-grid">
            {/* Left: Hexagon Chart */}
            <div className="endorsement-chart-card">
              <div className="hexagon-wrapper">
                <HexagonChart data={endorsementStats.categoryCounts} />
              </div>
              <div className="chart-legend">
                <div className="legend-item">
                  <div className="legend-dot filled"></div>
                  <span>{t('reputation_current_score')}</span>
                </div>
                <div className="legend-item">
                  <div className="legend-dot outline"></div>
                  <span>{t('reputation_max_score')}</span>
                </div>
              </div>
            </div>

            {/* Right: Category Cards */}
            <div className="endorsement-cards">
              {Object.entries(endorsementStats.categoryScores).map(([category, score]) => {
                const categoryIcons: Record<string, string> = {
                  ENGAGEMENT: 'ri-chat-3-line',
                  COMMUNICATION: 'ri-message-3-line',
                  RESPECT: 'ri-heart-line',
                  RULE_ADHERENCE: 'ri-shield-check-line',
                  PREPARATION: 'ri-book-open-line',
                  REMATCH: 'ri-repeat-line',
                };
                const categoryDescriptions: Record<string, string> = {
                  ENGAGEMENT: t('endorsement_engagement_desc'),
                  COMMUNICATION: t('endorsement_communication_desc'),
                  RESPECT: t('endorsement_respect_desc'),
                  RULE_ADHERENCE: t('endorsement_rule_adherence_desc'),
                  PREPARATION: t('endorsement_preparation_desc'),
                  REMATCH: t('endorsement_rematch_desc'),
                };
                return (
                  <div key={category} className="endorsement-card">
                    <div className="endorsement-card-header">
                      <div className="endorsement-card-left">
                        <div className="endorsement-card-icon">
                          <i className={categoryIcons[category] || 'ri-star-line'}></i>
                        </div>
                        <div className="endorsement-card-info">
                          <h3 className="endorsement-card-title">{categoryLabels[category] || category}</h3>
                          <p className="endorsement-card-desc">{categoryDescriptions[category] || ''}</p>
                        </div>
                      </div>
                      <div className="endorsement-card-score">
                        <div className="score-value">{score.toFixed(1)}</div>
                        <div className="score-max">/ 5.0</div>
                      </div>
                    </div>
                    <div className="endorsement-progress-bar">
                      <div
                        className="endorsement-progress-fill"
                        style={{ width: `${(score / 5) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Monthly Attendance Section */}
      <section className="attendance-section">
        <div className="attendance-container">
          {/* Header */}
          <div className="attendance-header">
            <h2 className="attendance-title">{t('reputation_monthly_title')}</h2>
            <p className="attendance-subtitle">{t('reputation_attendance_subtitle')}</p>
          </div>

          {/* Summary Stats Cards - monthlyAttendance 데이터 기반 */}
          {(() => {
            // monthlyAttendance에서 합계 계산 (그래프와 일치)
            const monthlyTotalAttended = monthlyAttendance.reduce((sum, m) => sum + m.attended, 0);
            const monthlyTotalLate = monthlyAttendance.reduce((sum, m) => sum + (m.late || 0), 0);
            const monthlyTotalAbsent = monthlyAttendance.reduce((sum, m) => sum + (m.absent || 0), 0);
            const monthlyTotal = monthlyTotalAttended + monthlyTotalLate + monthlyTotalAbsent;

            return (
              <div className="attendance-stats-grid">
                <div className="attendance-stat-card attended">
                  <div className="attendance-stat-icon">
                    <i className="ri-checkbox-circle-fill"></i>
                  </div>
                  <div className="attendance-stat-info">
                    <span className="attendance-stat-value">{monthlyTotalAttended + monthlyTotalLate}</span>
                    <span className="attendance-stat-label">{t('reputation_attended')}</span>
                  </div>
                </div>
                <div className="attendance-stat-card absent">
                  <div className="attendance-stat-icon">
                    <i className="ri-close-circle-fill"></i>
                  </div>
                  <div className="attendance-stat-info">
                    <span className="attendance-stat-value">{monthlyTotalAbsent}</span>
                    <span className="attendance-stat-label">{t('profile_absent')}</span>
                  </div>
                </div>
                <div className="attendance-stat-card late">
                  <div className="attendance-stat-icon">
                    <i className="ri-time-fill"></i>
                  </div>
                  <div className="attendance-stat-info">
                    <span className="attendance-stat-value">{monthlyTotalLate}</span>
                    <span className="attendance-stat-label">{t('reputation_late_entry')}</span>
                  </div>
                </div>
                <div className="attendance-stat-card total">
                  <div className="attendance-stat-icon">
                    <i className="ri-calendar-check-fill"></i>
                  </div>
                  <div className="attendance-stat-info">
                    <span className="attendance-stat-value">{monthlyTotal}</span>
                    <span className="attendance-stat-label">{t('reputation_total_meetings')}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Monthly Chart */}
          <div className="attendance-chart-card">
            <div className="attendance-chart-bars">
              {(() => {
                // 출석 기록이 있는 달만 필터링 (total > 0)
                const monthsWithAttendance = monthlyAttendance.filter(month => {
                  const total = month.attended + (month.late || 0) + (month.absent || 0);
                  return total > 0;
                });

                // 최대 6개만, 오래된 순서로 (위에서 아래로 최신)
                const displayMonths = monthsWithAttendance.slice(-6);

                return displayMonths.map((month) => {
                  const total = month.attended + (month.late || 0) + (month.absent || 0);
                  const attendedPercent = total > 0 ? (month.attended / total) * 100 : 0;
                  const latePercent = total > 0 ? ((month.late || 0) / total) * 100 : 0;
                  const absentPercent = total > 0 ? ((month.absent || 0) / total) * 100 : 0;

                  return (
                    <div key={month.month} className="attendance-chart-row">
                      <span className="attendance-month-label">{month.monthLabel}</span>
                      <div className="attendance-bar-container">
                        <div
                          className="attendance-bar-segment attended"
                          style={{ width: `${attendedPercent}%` }}
                        >
                          {month.attended > 0 && <span>{month.attended}</span>}
                        </div>
                        {(month.late || 0) > 0 && (
                          <div
                            className="attendance-bar-segment late"
                            style={{ width: `${latePercent}%` }}
                          >
                            <span>{month.late}</span>
                          </div>
                        )}
                        {(month.absent || 0) > 0 && (
                          <div
                            className="attendance-bar-segment absent"
                            style={{ width: `${absentPercent}%` }}
                          >
                            <span>{month.absent}</span>
                          </div>
                        )}
                      </div>
                      <span className="attendance-total-label">{total}</span>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Legend */}
            <div className="attendance-chart-legend">
              <div className="attendance-legend-item">
                <div className="attendance-legend-dot attended"></div>
                <span>{t('reputation_on_time_entry')}</span>
              </div>
              <div className="attendance-legend-item">
                <div className="attendance-legend-dot late"></div>
                <span>{t('reputation_late_entry')}</span>
              </div>
              <div className="attendance-legend-item">
                <div className="attendance-legend-dot absent"></div>
                <span>{t('profile_absent')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Badge Collection Section */}
      <section className="badges-section-new">
        <div className="badges-container">
          {/* Header */}
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
        </div>
      </section>

      {/* Activity Timeline Section */}
      <section className="activity-section">
        <div className="activity-container">
          {/* Header */}
          <div className="activity-header-section">
            <h2 className="activity-title">{t('reputation_activity_title')}</h2>
            <p className="activity-subtitle">{t('reputation_activity_subtitle')}</p>
          </div>

          {recentActivities.length === 0 ? (
            <div className="activity-empty">
              <p>{t('reputation_no_activities')}</p>
            </div>
          ) : (
            <div className="activity-timeline-wrapper">
              {/* Timeline Line */}
              <div className="activity-timeline-line"></div>

              <div className="activity-timeline">
                {displayedActivities.map((activity, index) => {
                  const gradient = getGradientStyle(activity.gradientColors);
                  const icon = activity.icon || 'ri-checkbox-circle-fill';

                  return (
                    <div
                      key={`${activity.type}-${activity.postId || ''}-${index}`}
                      className={`activity-item ${activity.postId ? 'clickable' : ''}`}
                      onClick={() => activity.postId && navigate(`/`)}
                    >
                      <div
                        className="activity-icon-box"
                        style={{ background: gradient }}
                      >
                        <i className={icon}></i>
                      </div>
                      <div className="activity-card">
                        <div className="activity-card-header">
                          <div className="activity-card-info">
                            <h3 className="activity-card-title">{activity.title}</h3>
                            <p className="activity-card-desc">{activity.description}</p>
                          </div>
                          {activity.rating && (
                            <div className="activity-rating-badge">
                              <i className="ri-star-fill"></i>
                              <span>{activity.rating}</span>
                            </div>
                          )}
                        </div>
                        <div className="activity-card-footer">
                          <div className="activity-meta">
                            <div className="activity-meta-item">
                              <i className="ri-calendar-line"></i>
                              <span>{formatDate(activity.timestamp)}</span>
                            </div>
                          </div>
                          {activity.participantCount != null && activity.participantCount > 0 && (
                            <div className="activity-participants">
                              <i className="ri-group-line"></i>
                              <span>{activity.participantCount} {t('browse_card_participants')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {recentActivities.length > 5 && (
                <div className="activity-load-more">
                  <button
                    className="load-more-btn"
                    onClick={() => setShowAllActivities(!showAllActivities)}
                  >
                    <span>{showAllActivities ? t('reputation_show_less') : t('reputation_load_more')}</span>
                    <i className={showAllActivities ? 'ri-arrow-up-line' : 'ri-arrow-down-line'}></i>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Reputation;
