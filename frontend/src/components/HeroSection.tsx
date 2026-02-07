import React from 'react';
import './styles/HeroSection.css';

export interface HeroStatCard {
  iconClass: string;
  iconColor: 'slate' | 'cyan' | 'red' | 'orange' | 'blue' | 'purple' | 'green';
  value: number | string;
  unit: string;
  label: string;
}

export interface HeroMetaItem {
  icon: string;
  value: number | string;
  label: string;
}

interface HeroSectionProps {
  username: string;
  email?: string;
  photoUrl?: string;
  metaStats: HeroMetaItem[];
  statCards: HeroStatCard[];
}

const HeroSection: React.FC<HeroSectionProps> = ({
  username,
  email,
  photoUrl,
  metaStats,
  statCards,
}) => {
  // Default avatar as data URI
  const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiI+PC9wYXRoPjxjaXJjbGUgY3g9IjEyIiBjeT0iNyIgcj0iNCI+PC9jaXJjbGU+PC9zdmc+';
  const avatarUrl = photoUrl || defaultAvatar;

  return (
    <section className="hero-section">
      {/* Background decorations */}
      <div className="hero-bg-gradient"></div>
      <div className="hero-blur-circle hero-blur-1"></div>
      <div className="hero-blur-circle hero-blur-2"></div>

      <div className="hero-content">
        {/* Profile Row */}
        <div className="hero-profile-row">
          {/* Avatar */}
          <div className="hero-avatar-wrapper">
            <div className="hero-avatar-ring">
              <div className="hero-avatar-inner">
                <img
                  src={avatarUrl}
                  alt={username}
                  className="hero-avatar-img"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = defaultAvatar;
                  }}
                />
              </div>
            </div>
          </div>

          {/* User Info */}
          <div className="hero-user-info">
            <h1 className="hero-username">{username}</h1>
            {email && <p className="hero-email">@{email.split('@')[0]}</p>}

            {/* Meta Stats */}
            <div className="hero-meta-stats">
              {metaStats.map((item, index) => (
                <div key={index} className="hero-meta-item">
                  <i className={item.icon}></i>
                  <span><strong>{item.value}</strong> {item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="hero-stats-grid">
          {statCards.map((card, index) => (
            <div key={index} className="hero-stat-card">
              <div className={`hero-stat-icon ${card.iconColor}`}>
                <i className={card.iconClass}></i>
              </div>
              <div className="hero-stat-value">{card.value}<span>{card.unit}</span></div>
              <div className="hero-stat-label">{card.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
