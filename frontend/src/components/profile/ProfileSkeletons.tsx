import React from 'react';
import './ProfileSkeletons.css';

// Skeleton 기본 컴포넌트
const Skeleton: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className = '',
  style
}) => (
  <div className={`skeleton ${className}`} style={style} />
);

// Overview 탭 스켈레톤
export const OverviewSkeleton: React.FC = () => (
  <div className="profile-overview-section">
    <div className="profile-overview-grid">
      {/* Left Column - Main Content */}
      <div className="profile-overview-main">
        {/* Activity Stats Card */}
        <div className="profile-card">
          <Skeleton className="skeleton-title" style={{ width: '200px', marginBottom: '24px' }} />
          <div className="profile-progress-list">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="profile-progress-item">
                <Skeleton className="skeleton-text" style={{ width: '120px' }} />
                <div className="profile-progress-bar-wrapper">
                  <Skeleton className="skeleton-progress-bar" />
                  <Skeleton className="skeleton-text" style={{ width: '32px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Highlights Card */}
        <div className="profile-card">
          <Skeleton className="skeleton-title" style={{ width: '180px', marginBottom: '24px' }} />
          <div className="profile-highlights-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-highlight-card">
                <div className="skeleton-highlight-header">
                  <Skeleton className="skeleton-icon" />
                  <Skeleton className="skeleton-text" style={{ width: '80px' }} />
                </div>
                <Skeleton className="skeleton-value" style={{ width: '60px', marginBottom: '8px' }} />
                <Skeleton className="skeleton-text" style={{ width: '100px' }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column - Sidebar */}
      <div className="profile-overview-sidebar">
        {/* Contact Info Card */}
        <div className="profile-card">
          <Skeleton className="skeleton-title" style={{ width: '120px', marginBottom: '24px' }} />
          <div className="profile-contact-list">
            {[1, 2, 3].map((i) => (
              <div key={i} className="profile-contact-item">
                <Skeleton className="skeleton-icon" />
                <div className="profile-contact-content">
                  <Skeleton className="skeleton-text" style={{ width: '150px', marginBottom: '4px' }} />
                  <Skeleton className="skeleton-text-sm" style={{ width: '60px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reputation Details Card */}
        <div className="profile-card">
          <Skeleton className="skeleton-title" style={{ width: '140px', marginBottom: '24px' }} />
          <div className="profile-reputation-list">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="profile-reputation-item">
                <Skeleton className="skeleton-text" style={{ width: '80px' }} />
                <div className="profile-reputation-stars">
                  <Skeleton className="skeleton-stars" />
                  <Skeleton className="skeleton-text" style={{ width: '24px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Activity 탭 스켈레톤
export const ActivitySkeleton: React.FC = () => (
  <div className="profile-section">
    {/* Recent Activity Card */}
    <div className="recent-activity-card">
      <div className="recent-activity-header">
        <Skeleton className="skeleton-title" style={{ width: '180px' }} />
        <Skeleton className="skeleton-text" style={{ width: '250px', marginTop: '8px' }} />
      </div>
      <div className="recent-activity-content">
        <div className="recent-activity-list">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="recent-activity-item">
              <Skeleton className="skeleton-avatar" />
              <div className="recent-activity-info" style={{ flex: 1 }}>
                <Skeleton className="skeleton-text" style={{ width: '200px', marginBottom: '4px' }} />
                <Skeleton className="skeleton-text" style={{ width: '150px', marginBottom: '4px' }} />
                <Skeleton className="skeleton-text-sm" style={{ width: '80px' }} />
              </div>
              <Skeleton className="skeleton-badge" />
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Meetings Sections */}
    {[1, 2].map((section) => (
      <div key={section} className="meetings-section">
        <div className="meetings-section-header">
          <Skeleton className="skeleton-icon" />
          <Skeleton className="skeleton-title" style={{ width: '150px' }} />
        </div>
        <div className="meetings-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="meeting-card" style={{ pointerEvents: 'none' }}>
              <div className="meeting-card-left">
                <Skeleton className="skeleton-book-icon" />
                <div className="meeting-info">
                  <Skeleton className="skeleton-text" style={{ width: '180px', marginBottom: '8px' }} />
                  <div className="meeting-meta">
                    <Skeleton className="skeleton-text-sm" style={{ width: '80px' }} />
                    <Skeleton className="skeleton-text-sm" style={{ width: '50px' }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

// Badges 탭 스켈레톤
export const BadgesSkeleton: React.FC = () => (
  <div className="profile-section profile-badges-section">
    {/* Header */}
    <div className="profile-badges-header">
      <Skeleton className="skeleton-title" style={{ width: '120px' }} />
      <div className="profile-badges-count">
        <Skeleton className="skeleton-value" style={{ width: '60px' }} />
      </div>
    </div>

    {/* Earned Badges */}
    <div className="profile-badge-group">
      <div className="profile-badge-group-title">
        <Skeleton className="skeleton-icon-sm" />
        <Skeleton className="skeleton-text" style={{ width: '100px' }} />
      </div>
      <div className="profile-badges-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="profile-badge-card" style={{ pointerEvents: 'none' }}>
            <Skeleton className="skeleton-badge-icon" />
            <Skeleton className="skeleton-text" style={{ width: '80px', marginBottom: '4px' }} />
            <Skeleton className="skeleton-text-sm" style={{ width: '100px' }} />
          </div>
        ))}
      </div>
    </div>

    {/* Locked Badges */}
    <div className="profile-badge-group">
      <div className="profile-badge-group-title">
        <Skeleton className="skeleton-icon-sm" />
        <Skeleton className="skeleton-text" style={{ width: '100px' }} />
      </div>
      <div className="profile-badges-grid">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="profile-badge-card locked" style={{ pointerEvents: 'none' }}>
            <Skeleton className="skeleton-badge-icon" />
            <Skeleton className="skeleton-text" style={{ width: '80px', marginBottom: '4px' }} />
            <Skeleton className="skeleton-text-sm" style={{ width: '100px', marginBottom: '8px' }} />
            <Skeleton className="skeleton-progress" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Interests 탭 스켈레톤
export const InterestsSkeleton: React.FC = () => (
  <div className="profile-section profile-interests-section">
    <div className="profile-interests-card">
      <div className="profile-interests-header">
        <Skeleton className="skeleton-title" style={{ width: '160px', marginBottom: '8px' }} />
        <Skeleton className="skeleton-text" style={{ width: '250px' }} />
      </div>

      <div className="profile-interests-content">
        {/* Introduction */}
        <div className="profile-interests-group">
          <Skeleton className="skeleton-subtitle" style={{ width: '80px', marginBottom: '16px' }} />
          <Skeleton className="skeleton-introduction" />
        </div>

        {/* Genres */}
        <div className="profile-interests-group">
          <Skeleton className="skeleton-subtitle" style={{ width: '100px', marginBottom: '16px' }} />
          <div className="profile-genre-tags">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="skeleton-tag" style={{ width: `${60 + i * 20}px` }} />
            ))}
          </div>
        </div>

        {/* Styles */}
        <div className="profile-interests-group">
          <Skeleton className="skeleton-subtitle" style={{ width: '90px', marginBottom: '16px' }} />
          <div className="profile-style-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="profile-style-card">
                <Skeleton className="skeleton-text" style={{ width: '80px', marginBottom: '8px' }} />
                <Skeleton className="skeleton-text" style={{ width: '120px' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Keywords */}
        <div className="profile-interests-group">
          <Skeleton className="skeleton-subtitle" style={{ width: '100px', marginBottom: '16px' }} />
          <div className="profile-keyword-tags">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="skeleton-keyword" style={{ width: `${50 + i * 15}px` }} />
            ))}
          </div>
        </div>

        {/* Goals */}
        <div className="profile-interests-group">
          <Skeleton className="skeleton-subtitle" style={{ width: '80px', marginBottom: '16px' }} />
          <div className="profile-goals-list">
            {[1, 2].map((i) => (
              <div key={i} className="profile-goal-item">
                <Skeleton className="skeleton-text" style={{ width: '100px' }} />
                <Skeleton className="skeleton-text" style={{ width: '40px' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* Settings Link Card Skeleton */}
    <div className="profile-settings-link-card" style={{ pointerEvents: 'none' }}>
      <div className="profile-settings-link-content">
        <Skeleton className="skeleton-link-icon" />
        <div>
          <Skeleton className="skeleton-text" style={{ width: '120px', marginBottom: '8px' }} />
          <Skeleton className="skeleton-text" style={{ width: '200px' }} />
        </div>
      </div>
      <Skeleton className="skeleton-button" />
    </div>
  </div>
);

// Hero Section 스켈레톤 (fallback용)
export const HeroSkeleton: React.FC = () => (
  <div className="profile-hero-section">
    <div className="profile-hero-container">
      {/* Header */}
      <div className="profile-hero-header">
        <div className="profile-hero-header-left">
          <Skeleton className="skeleton-back-btn" />
          <Skeleton className="skeleton-title" style={{ width: '100px' }} />
        </div>
        <Skeleton className="skeleton-edit-btn" />
      </div>

      {/* Profile Info */}
      <div className="profile-hero-info">
        <Skeleton className="skeleton-avatar-large" />
        <div className="profile-hero-details" style={{ flex: 1 }}>
          <div className="profile-hero-details-main">
            <Skeleton className="skeleton-name" style={{ marginBottom: '8px' }} />
            <Skeleton className="skeleton-text" style={{ width: '150px', marginBottom: '4px' }} />
            <Skeleton className="skeleton-text-sm" style={{ width: '120px' }} />
          </div>
          <div className="profile-hero-rating" style={{ textAlign: 'right' }}>
            <Skeleton className="skeleton-stars" style={{ marginBottom: '4px' }} />
            <Skeleton className="skeleton-text-sm" style={{ width: '80px' }} />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="profile-hero-stats">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="profile-hero-stat-card">
            <Skeleton className="skeleton-stat-value" />
            <Skeleton className="skeleton-text-sm" style={{ width: '60px', margin: '0 auto' }} />
          </div>
        ))}
      </div>
    </div>
  </div>
);
