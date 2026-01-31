import React from 'react';
import './ReputationSkeletons.css';

// Skeleton 기본 컴포넌트
const Skeleton: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className = '',
  style
}) => (
  <div className={`rep-skeleton ${className}`} style={style} />
);

// Hero Section 스켈레톤 (HeroSection 컴포넌트용)
export const HeroStatCardsSkeleton: React.FC = () => (
  <div className="hero-stat-cards-skeleton">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <div key={i} className="hero-stat-card-skeleton">
        <Skeleton className="skeleton-icon-circle" />
        <div className="skeleton-stat-content">
          <Skeleton className="skeleton-stat-value" />
          <Skeleton className="skeleton-stat-label" />
        </div>
      </div>
    ))}
  </div>
);

// Endorsement Section 스켈레톤
export const EndorsementSkeleton: React.FC = () => (
  <section className="endorsement-section">
    <div className="endorsement-container">
      {/* Header */}
      <div className="endorsement-header">
        <Skeleton className="skeleton-section-title" style={{ width: '200px' }} />
        <Skeleton className="skeleton-text" style={{ width: '300px', marginTop: '8px' }} />
      </div>

      {/* Content Grid */}
      <div className="endorsement-grid">
        {/* Left: Hexagon Chart Skeleton */}
        <div className="endorsement-chart-card">
          <div className="hexagon-wrapper">
            <Skeleton className="skeleton-hexagon" />
          </div>
          <div className="chart-legend">
            <Skeleton className="skeleton-legend-item" />
            <Skeleton className="skeleton-legend-item" />
          </div>
        </div>

        {/* Right: Category Cards Skeleton */}
        <div className="endorsement-cards">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="endorsement-card skeleton-card">
              <div className="endorsement-card-header">
                <div className="endorsement-card-left">
                  <Skeleton className="skeleton-card-icon" />
                  <div className="endorsement-card-info">
                    <Skeleton className="skeleton-text" style={{ width: '100px', marginBottom: '4px' }} />
                    <Skeleton className="skeleton-text-sm" style={{ width: '150px' }} />
                  </div>
                </div>
                <div className="endorsement-card-score">
                  <Skeleton className="skeleton-score" />
                </div>
              </div>
              <Skeleton className="skeleton-progress-bar" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

// Attendance Section 스켈레톤
export const AttendanceSkeleton: React.FC = () => (
  <section className="attendance-section">
    <div className="attendance-container">
      {/* Header */}
      <div className="attendance-header">
        <Skeleton className="skeleton-section-title" style={{ width: '180px' }} />
        <Skeleton className="skeleton-text" style={{ width: '280px', marginTop: '8px' }} />
      </div>

      {/* Stats Grid */}
      <div className="attendance-stats-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="attendance-stat-card skeleton-stat">
            <Skeleton className="skeleton-stat-icon-lg" />
            <div className="attendance-stat-info">
              <Skeleton className="skeleton-stat-value-lg" />
              <Skeleton className="skeleton-stat-label-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="attendance-chart-card">
        <div className="attendance-chart-bars">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="attendance-chart-row skeleton-row">
              <Skeleton className="skeleton-month-label" />
              <Skeleton className="skeleton-bar" />
              <Skeleton className="skeleton-total" />
            </div>
          ))}
        </div>
        <div className="attendance-chart-legend">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="skeleton-legend" />
          ))}
        </div>
      </div>
    </div>
  </section>
);

// Badges Section 스켈레톤
export const BadgesSkeleton: React.FC = () => (
  <section className="badges-section-new">
    <div className="badges-container">
      {/* Header */}
      <div className="badges-header">
        <Skeleton className="skeleton-section-title" style={{ width: '120px' }} />
        <Skeleton className="skeleton-text" style={{ width: '220px', marginTop: '8px' }} />
        <div className="badges-count-display">
          <Skeleton className="skeleton-badge-count" />
        </div>
      </div>

      {/* Badge Groups */}
      {[1, 2].map((group) => (
        <div key={group} className="badge-group-new">
          <div className="badge-group-header">
            <Skeleton className="skeleton-group-icon" />
            <Skeleton className="skeleton-text" style={{ width: '120px' }} />
          </div>
          <div className="badges-grid-new">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="badge-card-new skeleton-badge-card">
                <Skeleton className="skeleton-badge-icon-lg" />
                <Skeleton className="skeleton-text" style={{ width: '80px', margin: '8px auto 4px' }} />
                <Skeleton className="skeleton-text-sm" style={{ width: '100px', margin: '0 auto' }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </section>
);

// Activity Section 스켈레톤
export const ActivitySkeleton: React.FC = () => (
  <section className="activity-section">
    <div className="activity-container">
      {/* Header */}
      <div className="activity-header-section">
        <Skeleton className="skeleton-section-title" style={{ width: '150px' }} />
        <Skeleton className="skeleton-text" style={{ width: '250px', marginTop: '8px' }} />
      </div>

      {/* Timeline */}
      <div className="activity-timeline-wrapper">
        <div className="activity-timeline-line skeleton-line"></div>
        <div className="activity-timeline">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="activity-item skeleton-activity">
              <Skeleton className="skeleton-activity-icon" />
              <div className="activity-card skeleton-activity-card">
                <div className="activity-card-header">
                  <div className="activity-card-info">
                    <Skeleton className="skeleton-text" style={{ width: '200px', marginBottom: '8px' }} />
                    <Skeleton className="skeleton-text-sm" style={{ width: '280px' }} />
                  </div>
                </div>
                <div className="activity-card-footer">
                  <Skeleton className="skeleton-meta" />
                  <Skeleton className="skeleton-participants" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

// 전체 페이지 로딩용 (초기 로딩)
export const ReputationPageSkeleton: React.FC = () => (
  <div className="reputation-container">
    <EndorsementSkeleton />
    <AttendanceSkeleton />
    <BadgesSkeleton />
    <ActivitySkeleton />
  </div>
);
