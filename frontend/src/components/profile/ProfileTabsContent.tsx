import React from 'react';
import { useTranslation } from 'react-i18next';
import { User, UserReputationResponse } from '../../api/user';
import { getGradientStyle } from '../../utils/gradientUtils';
import { formatDateCompact } from '../../utils/dateUtils';
import './ProfileTabsContent.css';

export type ProfileTabType = 'overview' | 'interests' | 'badges';

interface ProfileTabsContentProps {
  // Data
  userData: User | null;
  reputationData: UserReputationResponse | null;

  // Tab control
  activeTab: ProfileTabType;
  onTabChange: (tab: ProfileTabType) => void;

  // Display variant
  variant?: 'full' | 'compact';

  // Loading state
  isLoading?: boolean;
}

const ProfileTabsContent: React.FC<ProfileTabsContentProps> = ({
  userData,
  reputationData,
  activeTab,
  onTabChange,
  variant = 'compact',
  isLoading = false,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ko' ? 'ko' : 'en';

  if (isLoading) {
    return (
      <div className="ptc-loading">
        <div className="ptc-loading-spinner"></div>
        <span>{t('loading')}</span>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="ptc-error">
        {t('profile_load_error') || '프로필을 불러올 수 없습니다.'}
      </div>
    );
  }

  // Calculate feedback percentage
  const feedbackPercentage = reputationData?.participationStats?.feedbackPossibleCount
    ? Math.round(
        (reputationData.participationStats.feedbackGivenCount /
          reputationData.participationStats.feedbackPossibleCount) *
          100
      )
    : 0;

  // Calculate streak percentage (relative to total confirmed)
  const streakPercentage = reputationData?.participationStats?.totalConfirmed
    ? Math.min(
        100,
        (reputationData.participationStats.currentStreak /
          reputationData.participationStats.totalConfirmed) *
          100
      )
    : 0;

  // Top rating calculation
  const categoryScores = reputationData?.endorsementStats?.categoryScores || {};
  const topRating = Object.entries(categoryScores).reduce(
    (acc, [category, score]) => {
      if (score > acc.score) {
        return { category, score };
      }
      return acc;
    },
    { category: '', score: 0 }
  );

  return (
    <div className={`ptc-container ptc-${variant}`}>
      {/* Tab Navigation */}
      <div className="ptc-tabs-wrapper">
        <div className="ptc-tabs">
          <button
            className={`ptc-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => onTabChange('overview')}
          >
            {t('profile_tab_overview') || '활동 개요'}
          </button>
          <button
            className={`ptc-tab ${activeTab === 'interests' ? 'active' : ''}`}
            onClick={() => onTabChange('interests')}
          >
            {t('profile_tab_interests') || '관심사'}
          </button>
          <button
            className={`ptc-tab ${activeTab === 'badges' ? 'active' : ''}`}
            onClick={() => onTabChange('badges')}
          >
            {t('profile_tab_badges') || '성취 배지'}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="ptc-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="ptc-tab-content">
            <div className="ptc-overview-grid">
              {/* Left Column - Main Content */}
              <div className="ptc-overview-main">
                {/* Activity Highlights Card */}
                <div className="ptc-card">
                  <h3 className="ptc-card-title">{t('profile_activity_highlights') || '활동 하이라이트'}</h3>
                  <div className="ptc-progress-list">
                    {/* 토론 참여 */}
                    <div className="ptc-progress-item">
                      <span className="ptc-progress-label">{t('profile_discussion_participation') || '토론 참여'}</span>
                      <div className="ptc-progress-bar-wrapper">
                        <div className="ptc-progress-bar">
                          <div
                            className="ptc-progress-fill slate"
                            style={{ width: `${reputationData?.participationStats?.attendanceRate || 0}%` }}
                          ></div>
                        </div>
                        <span className="ptc-progress-value">
                          {reputationData?.participationStats?.attendanceRate || 0}%
                        </span>
                      </div>
                    </div>
                    {/* 유저 피드백 */}
                    <div className="ptc-progress-item">
                      <span className="ptc-progress-label">{t('profile_user_feedback') || '유저 피드백'}</span>
                      <div className="ptc-progress-bar-wrapper">
                        <div className="ptc-progress-bar">
                          <div
                            className="ptc-progress-fill amber"
                            style={{ width: `${feedbackPercentage}%` }}
                          ></div>
                        </div>
                        <span className="ptc-progress-value">{feedbackPercentage}%</span>
                      </div>
                    </div>
                    {/* 정시 입장 */}
                    <div className="ptc-progress-item">
                      <span className="ptc-progress-label">{t('profile_on_time_entry') || '정시 입장'}</span>
                      <div className="ptc-progress-bar-wrapper">
                        <div className="ptc-progress-bar">
                          <div
                            className="ptc-progress-fill cyan"
                            style={{ width: `${reputationData?.participationStats?.onTimeRate || 0}%` }}
                          ></div>
                        </div>
                        <span className="ptc-progress-value">
                          {reputationData?.participationStats?.onTimeRate || 0}%
                        </span>
                      </div>
                    </div>
                    {/* 참여 연속 기록 */}
                    <div className="ptc-progress-item">
                      <span className="ptc-progress-label">{t('profile_participation_streak') || '참여 연속 기록'}</span>
                      <div className="ptc-progress-bar-wrapper">
                        <div className="ptc-progress-bar">
                          <div
                            className="ptc-progress-fill emerald"
                            style={{ width: `${streakPercentage}%` }}
                          ></div>
                        </div>
                        <span className="ptc-progress-value">
                          {reputationData?.participationStats?.currentStreak || 0}{t('profile_times_unit') || '회'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Monthly Highlights */}
                <div className="ptc-card">
                  <h3 className="ptc-card-title">{t('profile_monthly_highlights') || '이달의 하이라이트'}</h3>
                  <div className="ptc-highlights-grid">
                    <div className="ptc-highlight-card slate">
                      <div className="ptc-highlight-header">
                        <div className="ptc-highlight-icon">
                          <i className="ri-discuss-line"></i>
                        </div>
                        <span className="ptc-highlight-label">{t('profile_total_meetings') || '총 미팅'}</span>
                      </div>
                      <div className="ptc-highlight-value">
                        {reputationData?.participationStats?.totalMeetings || 0}{t('profile_times_unit') || '회'}
                      </div>
                    </div>
                    <div className="ptc-highlight-card amber">
                      <div className="ptc-highlight-header">
                        <div className="ptc-highlight-icon">
                          <i className="ri-star-fill"></i>
                        </div>
                        <span className="ptc-highlight-label">{t('profile_top_rating') || '최고 평점'}</span>
                      </div>
                      <div className="ptc-highlight-value">{topRating.score.toFixed(1)}</div>
                      <div className="ptc-highlight-sub">
                        {topRating.category && t(`endorsement_category_${topRating.category}`)}
                      </div>
                    </div>
                    <div className="ptc-highlight-card cyan">
                      <div className="ptc-highlight-header">
                        <div className="ptc-highlight-icon">
                          <i className="ri-trophy-line"></i>
                        </div>
                        <span className="ptc-highlight-label">{t('profile_earned_points') || '획득 포인트'}</span>
                      </div>
                      <div className="ptc-highlight-value">
                        {reputationData?.endorsementStats?.points || userData.endorsementStats?.points || 0}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Activity Stats Card */}
                <div className="ptc-card">
                  <h3 className="ptc-card-title">{t('profile_activity') || '활동 내역'}</h3>
                  <div className="ptc-activity-grid">
                    <div className="ptc-activity-item">
                      <span className="ptc-activity-label">{t('profile_total_confirmed') || '총 참석'}</span>
                      <span className="ptc-activity-value positive">
                        {reputationData?.participationStats?.totalConfirmed || 0}
                      </span>
                    </div>
                    <div className="ptc-activity-item">
                      <span className="ptc-activity-label">{t('profile_absent') || '불참'}</span>
                      <span className="ptc-activity-value negative">
                        {reputationData?.participationStats?.absent || userData.absent || 0}
                      </span>
                    </div>
                    <div className="ptc-activity-item">
                      <span className="ptc-activity-label">{t('profile_late') || '지각'}</span>
                      <span className="ptc-activity-value warning">
                        {reputationData?.participationStats?.late || userData.late || 0}
                      </span>
                    </div>
                    <div className="ptc-activity-item">
                      <span className="ptc-activity-label">{t('profile_kicked') || '강퇴'}</span>
                      <span className="ptc-activity-value negative">
                        {reputationData?.participationStats?.kicked || userData.kicked || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Sidebar */}
              <div className="ptc-overview-sidebar">
                {/* Reputation Details */}
                <div className="ptc-card">
                  <h3 className="ptc-card-title">{t('profile_reputation_details') || '평판 세부 사항'}</h3>
                  <div className="ptc-reputation-list">
                    {['ENGAGEMENT', 'COMMUNICATION', 'RESPECT', 'RULE_ADHERENCE', 'PREPARATION', 'REMATCH'].map((category) => {
                      const score = reputationData?.endorsementStats?.categoryScores?.[category] || 0;
                      const filledStars = Math.round(score);
                      return (
                        <div key={category} className="ptc-reputation-item">
                          <span className="ptc-reputation-label">{t(`endorsement_category_${category}`) || category}</span>
                          <div className="ptc-reputation-stars">
                            <div className="ptc-stars">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <i key={star} className={star <= filledStars ? 'ri-star-fill' : 'ri-star-line'}></i>
                              ))}
                            </div>
                            <span className="ptc-reputation-score">{score.toFixed(1)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="ptc-card">
                  <h3 className="ptc-card-title">{t('profile_contact_info') || '연락처 정보'}</h3>
                  <div className="ptc-contact-list">
                    {/* Email - respect visibility setting */}
                    {(userData.setting?.visibility?.elements?.email !== false) && userData.email && (
                      <div className="ptc-contact-item">
                        <div className="ptc-contact-icon">
                          <i className="ri-mail-line"></i>
                        </div>
                        <div className="ptc-contact-content">
                          <div className="ptc-contact-value">{userData.email}</div>
                          <div className="ptc-contact-label">{t('profile_email') || '이메일'}</div>
                        </div>
                      </div>
                    )}
                    {/* Location - only show if visibility is enabled and location exists */}
                    {userData.setting?.visibility?.elements?.location &&
                      userData.profile?.introduce?.location &&
                      (userData.profile.introduce.location.city || userData.profile.introduce.location.country) && (
                        <div className="ptc-contact-item">
                          <div className="ptc-contact-icon">
                            <i className="ri-map-pin-line"></i>
                          </div>
                          <div className="ptc-contact-content">
                            <div className="ptc-contact-value">
                              {[userData.profile.introduce.location.city, userData.profile.introduce.location.country]
                                .filter(Boolean)
                                .join(', ')}
                            </div>
                            <div className="ptc-contact-label">{t('profile_location') || '위치'}</div>
                          </div>
                        </div>
                      )}
                    {/* Join Date */}
                    <div className="ptc-contact-item">
                      <div className="ptc-contact-icon">
                        <i className="ri-calendar-line"></i>
                      </div>
                      <div className="ptc-contact-content">
                        <div className="ptc-contact-value">
                          {formatDateCompact(userData.createdAt, locale as 'ko' | 'en') || '-'}
                        </div>
                        <div className="ptc-contact-label">{t('profile_join_date') || '가입일'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Interests Tab */}
        {activeTab === 'interests' && (
          <div className="ptc-tab-content">
            <div className="ptc-interests-card">
              {/* Introduction */}
              <div className="ptc-interests-group">
                <h4 className="ptc-interests-group-title">{t('profile_introduction') || '소개글'}</h4>
                <div className="ptc-introduction-box">
                  {userData.profile?.introduce?.introduction ? (
                    <p className="ptc-introduction-text">{userData.profile.introduce.introduction}</p>
                  ) : (
                    <span className="ptc-empty-text">{t('profile_no_introduction') || '소개글이 아직 작성되지 않았습니다'}</span>
                  )}
                </div>
              </div>

              {/* Preferred Genres */}
              <div className="ptc-interests-group">
                <h4 className="ptc-interests-group-title">{t('profile_favorite_genres') || '선호 장르'}</h4>
                <div className="ptc-genre-tags">
                  {userData.profile?.introduce?.preferredGenre && userData.profile.introduce.preferredGenre.length > 0 ? (
                    userData.profile.introduce.preferredGenre.map((genre: string, index: number) => (
                      <span key={index} className="ptc-genre-tag">{t(`settings_genre_${genre}`) || genre}</span>
                    ))
                  ) : (
                    <span className="ptc-empty-text">{t('profile_no_genres_set') || '선호 장르가 설정되지 않았습니다'}</span>
                  )}
                </div>
              </div>

              {/* Keywords */}
              <div className="ptc-interests-group">
                <h4 className="ptc-interests-group-title">{t('profile_keywords') || '관심 키워드'}</h4>
                <div className="ptc-keyword-tags">
                  {userData.profile?.introduce?.keywords && userData.profile.introduce.keywords.length > 0 ? (
                    userData.profile.introduce.keywords.map((keyword: string, index: number) => (
                      <span key={index} className="ptc-keyword-tag">#{keyword}</span>
                    ))
                  ) : (
                    <span className="ptc-empty-text">{t('profile_no_keywords_set') || '관심 키워드가 설정되지 않았습니다'}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Badges Tab */}
        {activeTab === 'badges' && (
          <div className="ptc-tab-content">
            {/* Header */}
            <div className="ptc-badges-header">
              <h3 className="ptc-section-title">{t('profile_tab_badges') || '성취 배지'}</h3>
              {reputationData?.badgeInfo && (
                <div className="ptc-badges-count">
                  <span className="ptc-badges-earned">{reputationData.badgeInfo.earnedCount}</span>
                  <span className="ptc-badges-total">/ {reputationData.badgeInfo.totalCount}</span>
                </div>
              )}
            </div>

            {/* Earned Badges */}
            {reputationData?.badgeInfo?.earnedBadges && reputationData.badgeInfo.earnedBadges.length > 0 ? (
              <div className="ptc-badges-grid">
                {reputationData.badgeInfo.earnedBadges.map((badge) => (
                  <div key={badge.id} className="ptc-badge-card">
                    <div
                      className="ptc-badge-icon"
                      style={{ background: getGradientStyle(badge.gradientColors) }}
                    >
                      <i className={badge.icon || 'ri-trophy-fill'}></i>
                    </div>
                    <h4 className="ptc-badge-name">{badge.name}</h4>
                    <p className="ptc-badge-desc">{badge.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ptc-empty-badges">
                <div className="ptc-empty-badges-icon">
                  <i className="ri-trophy-line"></i>
                </div>
                <h3>{t('profile_no_badges') || '아직 획득한 배지가 없습니다'}</h3>
                <p>{t('profile_no_badges_desc') || '토론에 참여하고 활동하여 배지를 획득하세요!'}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileTabsContent;
