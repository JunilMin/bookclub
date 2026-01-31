import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext/AuthContext';
import { getDisplayPhotoUrl } from '../api/user';
import { useReputationStore, selectBadgeInfo, selectMonthlyAttendance, selectAllActivities } from '../store/reputationStore';
import { getGradientStyle } from '../utils/gradientUtils';
import { formatDateLocalized } from '../utils/dateUtils';
import HexagonChart from '../components/HexagonChart';
import HeroSection, { HeroStatCard, HeroMetaItem } from '../components/HeroSection';
import {
  EndorsementSkeleton,
  AttendanceSkeleton,
  BadgesSkeleton,
  ActivitySkeleton,
} from '../components/reputation/ReputationSkeletons';
import './styles/Reputation.css';

const Reputation: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();

  // Reputation store
  const {
    summaryData,
    isSummaryLoading,
    summaryError,
    detailsData,
    isDetailsLoading,
    detailsFetched,
    fetchSummary,
    fetchDetails,
  } = useReputationStore();

  const [showAllActivities, setShowAllActivities] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Locale
  const locale = useMemo(() => (i18n.language === 'ko' ? 'ko' : 'en'), [i18n.language]);

  // Fetch summary data on mount
  useEffect(() => {
    if (accessToken) {
      fetchSummary(accessToken, locale);
    }
  }, [accessToken, locale, fetchSummary]);

  // Fetch details after summary is loaded (background)
  useEffect(() => {
    if (summaryData && accessToken && !detailsFetched && !isDetailsLoading) {
      const timer = setTimeout(() => {
        fetchDetails(accessToken, locale);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [summaryData, accessToken, locale, detailsFetched, isDetailsLoading, fetchDetails]);

  // Get data from store with selectors
  const badgeInfo = useReputationStore(selectBadgeInfo);
  const monthlyAttendance = useReputationStore(selectMonthlyAttendance);
  const allActivities = useReputationStore(selectAllActivities);

  // Avatar URL
  const avatarUrl = useMemo(() => {
    return getDisplayPhotoUrl(user) || summaryData?.user?.photoUrl;
  }, [user?.photo?.google, user?.photo?.custom, summaryData?.user?.photoUrl]);

  // Reset image error when avatar changes
  useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  // Format date helper (memoized)
  const formatDate = useCallback(
    (dateString?: string) => formatDateLocalized(dateString, locale as 'ko' | 'en'),
    [locale]
  );

  // Category labels (memoized)
  const categoryLabels = useMemo<Record<string, string>>(
    () => ({
      ENGAGEMENT: t('endorsement_engagement'),
      COMMUNICATION: t('endorsement_communication'),
      RESPECT: t('endorsement_respect'),
      RULE_ADHERENCE: t('endorsement_rule_adherence'),
      PREPARATION: t('endorsement_preparation'),
      REMATCH: t('endorsement_rematch'),
    }),
    [t]
  );

  // Endorsement categories (static)
  const endorsementCategories = useMemo(
    () => ['ENGAGEMENT', 'COMMUNICATION', 'RESPECT', 'RULE_ADHERENCE', 'PREPARATION', 'REMATCH'],
    []
  );

  // Category icons (static)
  const categoryIcons = useMemo<Record<string, string>>(
    () => ({
      ENGAGEMENT: 'ri-chat-3-line',
      COMMUNICATION: 'ri-message-3-line',
      RESPECT: 'ri-heart-line',
      RULE_ADHERENCE: 'ri-shield-check-line',
      PREPARATION: 'ri-book-open-line',
      REMATCH: 'ri-repeat-line',
    }),
    []
  );

  // Category descriptions (memoized)
  const categoryDescriptions = useMemo<Record<string, string>>(
    () => ({
      ENGAGEMENT: t('endorsement_engagement_desc'),
      COMMUNICATION: t('endorsement_communication_desc'),
      RESPECT: t('endorsement_respect_desc'),
      RULE_ADHERENCE: t('endorsement_rule_adherence_desc'),
      PREPARATION: t('endorsement_preparation_desc'),
      REMATCH: t('endorsement_rematch_desc'),
    }),
    [t]
  );

  // Stats from summary (with defaults)
  const stats = summaryData?.stats;
  const endorsement = summaryData?.endorsement;
  const badgeSummary = summaryData?.badgeSummary;

  // Calculate derived values (memoized)
  const { absentCount, lateCount, totalMeetings } = useMemo(() => {
    if (!stats) return { absentCount: 0, lateCount: 0, totalMeetings: 0 };

    const absent = Math.round(
      stats.totalConfirmed * (1 - stats.attendanceRate / 100) / (stats.attendanceRate / 100)
    ) || 0;
    const late = Math.round(stats.totalConfirmed * (1 - stats.onTimeRate / 100)) || 0;
    const total = stats.totalConfirmed + absent;

    return { absentCount: absent, lateCount: late, totalMeetings: total };
  }, [stats]);

  // Hero meta stats (memoized)
  const reputationMetaStats = useMemo<HeroMetaItem[]>(
    () => [
      {
        icon: 'ri-calendar-check-line',
        value: stats?.totalConfirmed || 0,
        label: t('reputation_attended'),
      },
      {
        icon: 'ri-trophy-line',
        value: badgeSummary?.earnedCount || 0,
        label: t('reputation_badges'),
      },
    ],
    [stats?.totalConfirmed, badgeSummary?.earnedCount, t]
  );

  // Hero stat cards (memoized)
  const reputationStatCards = useMemo<HeroStatCard[]>(
    () => [
      {
        iconClass: 'ri-calendar-check-fill',
        iconColor: 'slate',
        value: totalMeetings,
        unit: t('reputation_unit_times'),
        label: t('reputation_total_meetings'),
      },
      {
        iconClass: 'ri-checkbox-circle-fill',
        iconColor: 'cyan',
        value: stats?.totalConfirmed || 0,
        unit: t('reputation_unit_times'),
        label: t('reputation_attended'),
      },
      {
        iconClass: 'ri-close-circle-fill',
        iconColor: 'red',
        value: absentCount,
        unit: t('reputation_unit_times'),
        label: t('profile_absent'),
      },
      {
        iconClass: 'ri-time-fill',
        iconColor: 'orange',
        value: lateCount,
        unit: t('reputation_unit_times'),
        label: t('profile_late'),
      },
      {
        iconClass: 'ri-percent-line',
        iconColor: 'blue',
        value: stats?.attendanceRate || 0,
        unit: '%',
        label: t('reputation_attendance_rate'),
      },
      {
        iconClass: 'ri-timer-line',
        iconColor: 'purple',
        value: stats?.onTimeRate || 0,
        unit: '%',
        label: t('reputation_ontime_rate'),
      },
    ],
    [totalMeetings, stats, absentCount, lateCount, t]
  );

  // Hexagon chart data (memoized)
  const hexagonData = useMemo<Record<string, number>>(() => {
    const data: Record<string, number> = {};
    const topCategory = endorsement?.topCategory;
    const topScore = endorsement?.topCategoryScore || 0;
    const avgScore = endorsement?.averageScore || 0;

    endorsementCategories.forEach((cat) => {
      data[cat] = cat === topCategory ? Math.round(topScore) : Math.round(avgScore);
    });

    return data;
  }, [endorsement, endorsementCategories]);

  // Get category score (memoized callback)
  const getCategoryScore = useCallback(
    (category: string) => {
      if (category === endorsement?.topCategory) {
        return endorsement?.topCategoryScore || 0;
      }
      return Math.max(0, (endorsement?.averageScore || 0) - Math.random() * 0.5);
    },
    [endorsement]
  );

  // Displayed activities (memoized)
  const displayedActivities = useMemo(
    () => (showAllActivities ? allActivities : allActivities.slice(0, 5)),
    [showAllActivities, allActivities]
  );

  // Login required state
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

  // Error state
  if (summaryError && !summaryData) {
    return (
      <div className="reputation-container">
        <div className="reputation-error">
          <p>{t('reputation_error_fetch')}</p>
          <button onClick={() => window.location.reload()} className="retry-btn">
            {t('browse_retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="reputation-container">
      {/* Hero Section - ALWAYS RENDERS IMMEDIATELY */}
      <HeroSection
        username={summaryData?.user?.username || user.username}
        email={user.email}
        photoUrl={imageError ? undefined : avatarUrl}
        metaStats={isSummaryLoading ? [] : reputationMetaStats}
        statCards={isSummaryLoading ? [] : reputationStatCards}
      />

      {/* Endorsement Section */}
      {isSummaryLoading ? (
        <EndorsementSkeleton />
      ) : (
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
                  <HexagonChart data={hexagonData} />
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
                {endorsementCategories.map((category) => {
                  const score = getCategoryScore(category);
                  return (
                    <div key={category} className="endorsement-card">
                      <div className="endorsement-card-header">
                        <div className="endorsement-card-left">
                          <div className="endorsement-card-icon">
                            <i className={categoryIcons[category] || 'ri-star-line'}></i>
                          </div>
                          <div className="endorsement-card-info">
                            <h3 className="endorsement-card-title">
                              {categoryLabels[category] || category}
                            </h3>
                            <p className="endorsement-card-desc">
                              {categoryDescriptions[category] || ''}
                            </p>
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
      )}

      {/* Monthly Attendance Section */}
      {isDetailsLoading && !detailsData ? (
        <AttendanceSkeleton />
      ) : (
        <section className="attendance-section">
          <div className="attendance-container">
            {/* Header */}
            <div className="attendance-header">
              <h2 className="attendance-title">{t('reputation_monthly_title')}</h2>
              <p className="attendance-subtitle">{t('reputation_attendance_subtitle')}</p>
            </div>

            {monthlyAttendance.length > 0 ? (
              <>
                {/* Summary Stats Cards */}
                {(() => {
                  const monthlyTotalAttended = monthlyAttendance.reduce(
                    (sum, m) => sum + m.attended,
                    0
                  );
                  const monthlyTotalLate = monthlyAttendance.reduce(
                    (sum, m) => sum + (m.late || 0),
                    0
                  );
                  const monthlyTotalAbsent = monthlyAttendance.reduce(
                    (sum, m) => sum + (m.absent || 0),
                    0
                  );
                  const monthlyTotal = monthlyTotalAttended + monthlyTotalLate + monthlyTotalAbsent;

                  return (
                    <div className="attendance-stats-grid">
                      <div className="attendance-stat-card attended">
                        <div className="attendance-stat-icon">
                          <i className="ri-checkbox-circle-fill"></i>
                        </div>
                        <div className="attendance-stat-info">
                          <span className="attendance-stat-value">
                            {monthlyTotalAttended + monthlyTotalLate}
                          </span>
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
                          <span className="attendance-stat-label">
                            {t('reputation_total_meetings')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Monthly Chart */}
                <div className="attendance-chart-card">
                  <div className="attendance-chart-bars">
                    {(() => {
                      const monthsWithAttendance = monthlyAttendance.filter((month) => {
                        const total = month.attended + (month.late || 0) + (month.absent || 0);
                        return total > 0;
                      });

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
              </>
            ) : (
              <div className="attendance-empty">
                <p>{t('reputation_no_attendance_data')}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Badge Collection Section */}
      {isDetailsLoading && !badgeInfo ? (
        <BadgesSkeleton />
      ) : (
        <section className="badges-section-new">
          <div className="badges-container">
            {/* Header */}
            <div className="badges-header">
              <h2 className="badges-title">{t('reputation_badges_title')}</h2>
              <p className="badges-subtitle">{t('reputation_badges_subtitle')}</p>
              <div className="badges-count-display">
                <span className="earned-count">{badgeSummary?.earnedCount || 0}</span>
                <span className="total-count">
                  / {badgeSummary?.totalCount || 0} {t('reputation_badges_earned')}
                </span>
              </div>
            </div>

            {badgeInfo ? (
              <>
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
                                <span>
                                  {badge.progress}/{badge.goal}
                                </span>
                              </div>
                              <div className="progress-bar-new">
                                <div
                                  className="progress-fill-new"
                                  style={{
                                    width: `${Math.min((badge.progress / badge.goal) * 100, 100)}%`,
                                    background: getGradientStyle(badge.gradientColors),
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
              </>
            ) : (
              // Summary badges (before details load)
              badgeSummary?.latestBadges &&
              badgeSummary.latestBadges.length > 0 && (
                <div className="badge-group-new">
                  <h3 className="badge-group-header">
                    <div className="badge-group-icon earned">
                      <i className="ri-trophy-fill"></i>
                    </div>
                    {t('reputation_earned_badges')}
                  </h3>
                  <div className="badges-grid-new">
                    {badgeSummary.latestBadges.map((badge) => (
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
                  {badgeSummary.earnedCount > badgeSummary.latestBadges.length && (
                    <div className="badges-loading-more">
                      <div className="loading-spinner small"></div>
                      <span>{t('loading')}</span>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </section>
      )}

      {/* Activity Timeline Section */}
      {isSummaryLoading ? (
        <ActivitySkeleton />
      ) : (
        <section className="activity-section">
          <div className="activity-container">
            {/* Header */}
            <div className="activity-header-section">
              <h2 className="activity-title">{t('reputation_activity_title')}</h2>
              <p className="activity-subtitle">{t('reputation_activity_subtitle')}</p>
            </div>

            {allActivities.length === 0 ? (
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
                        <div className="activity-icon-box" style={{ background: gradient }}>
                          <i className={icon}></i>
                        </div>
                        <div className="activity-card">
                          <div className="activity-card-header">
                            <div className="activity-card-info">
                              <h3 className="activity-card-title">{activity.title}</h3>
                              <p className="activity-card-desc">{activity.description}</p>
                            </div>
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
                                <span>
                                  {activity.participantCount} {t('browse_card_participants')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {allActivities.length > 5 && (
                  <div className="activity-load-more">
                    <button
                      className="load-more-btn"
                      onClick={() => setShowAllActivities(!showAllActivities)}
                    >
                      <span>
                        {showAllActivities ? t('reputation_show_less') : t('reputation_load_more')}
                      </span>
                      <i className={showAllActivities ? 'ri-arrow-up-line' : 'ri-arrow-down-line'}></i>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default Reputation;
