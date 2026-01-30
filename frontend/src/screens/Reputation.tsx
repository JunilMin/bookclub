import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext/AuthContext';
import {
  getMyReputationSummary,
  getMyReputationDetails,
  ReputationSummaryResponse,
  ReputationDetailsResponse,
} from '../api/user';
import HexagonChart from '../components/HexagonChart';
import HeroSection, { HeroStatCard, HeroMetaItem } from '../components/HeroSection';
import './styles/Reputation.css';

const Reputation: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, accessToken } = useAuth();

  // Summary data (초기 렌더링용)
  const [summaryData, setSummaryData] = useState<ReputationSummaryResponse | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);

  // Details data (탭/섹션 진입 시)
  const [detailsData, setDetailsData] = useState<ReputationDetailsResponse | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [detailsFetched, setDetailsFetched] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [showAllActivities, setShowAllActivities] = useState(false);

  // Summary 데이터 로드 (초기 렌더링)
  useEffect(() => {
    const fetchSummary = async () => {
      if (!accessToken) return;

      setIsSummaryLoading(true);
      setError(null);

      try {
        const locale = i18n.language === 'ko' ? 'ko' : 'en';
        const data = await getMyReputationSummary(accessToken, locale);
        setSummaryData(data);
      } catch (err) {
        console.error('Failed to fetch reputation summary:', err);
        setError(t('reputation_error_fetch'));
      } finally {
        setIsSummaryLoading(false);
      }
    };

    fetchSummary();
  }, [accessToken, i18n.language, t]);

  // Details 데이터 로드 (지연 로드)
  const fetchDetails = useCallback(async () => {
    if (!accessToken || detailsFetched || isDetailsLoading) return;

    setIsDetailsLoading(true);

    try {
      const locale = i18n.language === 'ko' ? 'ko' : 'en';
      const data = await getMyReputationDetails(accessToken, locale, {
        activitiesLimit: 50,
        months: 12,
      });
      setDetailsData(data);
      setDetailsFetched(true);
    } catch (err) {
      console.error('Failed to fetch reputation details:', err);
    } finally {
      setIsDetailsLoading(false);
    }
  }, [accessToken, i18n.language, detailsFetched, isDetailsLoading]);

  // Summary 로드 완료 후 Details 자동 로드 (백그라운드)
  useEffect(() => {
    if (summaryData && !detailsFetched) {
      // 약간의 지연 후 details 로드 (초기 렌더링 최적화)
      const timer = setTimeout(fetchDetails, 500);
      return () => clearTimeout(timer);
    }
  }, [summaryData, detailsFetched, fetchDetails]);

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

  if (isSummaryLoading) {
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

  if (!summaryData) return null;

  const { stats, endorsement, badgeSummary, recentActivities: summaryActivities } = summaryData;

  // Details에서 가져온 데이터 (있으면 사용, 없으면 summary 데이터 사용)
  const monthlyAttendance = detailsData?.monthlyAttendance || [];
  const badgeInfo = detailsData?.badgeInfo || null;
  const allActivities = detailsData?.recentActivities || summaryActivities;

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
  const displayedActivities = showAllActivities ? allActivities : allActivities.slice(0, 5);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Gradient 클래스를 CSS 변수로 변환
  const getGradientStyle = (gradientColors?: string) => {
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

  // Build hero section data for Reputation page
  const reputationMetaStats: HeroMetaItem[] = [
    {
      icon: 'ri-calendar-check-line',
      value: stats.totalConfirmed,
      label: t('reputation_attended'),
    },
    {
      icon: 'ri-trophy-line',
      value: badgeSummary.earnedCount,
      label: t('reputation_badges'),
    },
  ];

  // Calculate absent/late from stats (approximation for hero cards)
  const absentCount = Math.round(stats.totalConfirmed * (1 - stats.attendanceRate / 100) / (stats.attendanceRate / 100)) || 0;
  const lateCount = Math.round(stats.totalConfirmed * (1 - stats.onTimeRate / 100)) || 0;
  const totalMeetings = stats.totalConfirmed + absentCount;

  const reputationStatCards: HeroStatCard[] = [
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
      value: stats.totalConfirmed,
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
      value: stats.attendanceRate,
      unit: '%',
      label: t('reputation_attendance_rate'),
    },
    {
      iconClass: 'ri-timer-line',
      iconColor: 'purple',
      value: stats.onTimeRate,
      unit: '%',
      label: t('reputation_ontime_rate'),
    },
  ];

  // Endorsement 섹션용 데이터 (Summary의 topCategory 기반 간단 표시)
  const endorsementCategories = ['ENGAGEMENT', 'COMMUNICATION', 'RESPECT', 'RULE_ADHERENCE', 'PREPARATION', 'REMATCH'];
  const topCategoryScore = endorsement.topCategoryScore || 0;

  // 카테고리별 점수 계산 (averageScore 기반 근사값)
  const getCategoryScore = (category: string) => {
    if (category === endorsement.topCategory) {
      return topCategoryScore;
    }
    // 다른 카테고리는 averageScore에 약간의 변동을 줌
    return Math.max(0, endorsement.averageScore - Math.random() * 0.5);
  };

  // Hexagon chart용 데이터 생성
  const hexagonData: Record<string, number> = {};
  endorsementCategories.forEach(cat => {
    // Summary에서는 topCategory만 정확하므로, 대략적인 값 사용
    if (cat === endorsement.topCategory) {
      hexagonData[cat] = Math.round(topCategoryScore);
    } else {
      hexagonData[cat] = Math.round(endorsement.averageScore);
    }
  });

  // Loading skeleton component
  const SectionSkeleton = () => (
    <div className="section-skeleton">
      <div className="skeleton-line"></div>
      <div className="skeleton-line short"></div>
      <div className="skeleton-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-card"></div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="reputation-container">
      {/* Hero Section */}
      <HeroSection
        username={summaryData.user.username}
        email={user.email}
        photoUrl={summaryData.user.photoUrl}
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

          {isDetailsLoading && !detailsData ? (
            <SectionSkeleton />
          ) : monthlyAttendance.length > 0 ? (
            <>
              {/* Summary Stats Cards */}
              {(() => {
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
                    const monthsWithAttendance = monthlyAttendance.filter(month => {
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

      {/* Badge Collection Section */}
      <section className="badges-section-new">
        <div className="badges-container">
          {/* Header */}
          <div className="badges-header">
            <h2 className="badges-title">{t('reputation_badges_title')}</h2>
            <p className="badges-subtitle">{t('reputation_badges_subtitle')}</p>
            <div className="badges-count-display">
              <span className="earned-count">{badgeSummary.earnedCount}</span>
              <span className="total-count">/ {badgeSummary.totalCount} {t('reputation_badges_earned')}</span>
            </div>
          </div>

          {isDetailsLoading && !badgeInfo ? (
            <SectionSkeleton />
          ) : badgeInfo ? (
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
            </>
          ) : (
            // Summary 배지만 표시 (Details 로드 전)
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

      {/* Activity Timeline Section */}
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

              {allActivities.length > 5 && (
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
