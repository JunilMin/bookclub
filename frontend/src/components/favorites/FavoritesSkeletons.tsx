// frontend/src/components/favorites/FavoritesSkeletons.tsx
import React from 'react';
import './FavoritesSkeletons.css';

/**
 * Hero Stats Skeleton - 3 stat items with shimmer effect
 */
export const HeroStatsSkeleton: React.FC = () => (
  <div className="favorites-hero-stats">
    {[1, 2, 3].map((i) => (
      <div key={i} className="favorites-stat-item">
        <div className="favorites-skeleton favorites-skeleton-stat-icon" />
        <div className="favorites-stat-info">
          <div className="favorites-skeleton favorites-skeleton-stat-value" />
          <div className="favorites-skeleton favorites-skeleton-stat-label" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Book Card Skeleton - Single card with cover, title, author, info, and buttons
 */
export const BookCardSkeleton: React.FC = () => (
  <div className="favorites-card favorites-card-skeleton">
    {/* Cover */}
    <div className="favorites-card-cover">
      <div className="favorites-skeleton favorites-skeleton-cover" />
    </div>

    {/* Content */}
    <div className="favorites-card-content">
      <div className="favorites-card-header">
        <div className="favorites-skeleton favorites-skeleton-title" />
        <div className="favorites-skeleton favorites-skeleton-author" />
      </div>

      {/* Info badge */}
      <div className="favorites-skeleton favorites-skeleton-info" />

      {/* Actions */}
      <div className="favorites-card-actions">
        <div className="favorites-skeleton favorites-skeleton-btn" />
        <div className="favorites-skeleton favorites-skeleton-btn" />
      </div>
    </div>
  </div>
);

/**
 * Grid Skeleton - Grid of 4 book card skeletons
 */
export const GridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="favorites-grid">
    {Array.from({ length: count }, (_, i) => (
      <BookCardSkeleton key={i} />
    ))}
  </div>
);

/**
 * Filter Bar Skeleton - Tabs and search area
 */
export const FilterBarSkeleton: React.FC = () => (
  <div className="favorites-filter-content">
    {/* Tabs skeleton */}
    <div className="favorites-tabs">
      <div className="favorites-skeleton favorites-skeleton-tab" />
      <div className="favorites-skeleton favorites-skeleton-tab" />
    </div>

    {/* Search row skeleton */}
    <div className="favorites-search-row">
      <div className="favorites-skeleton favorites-skeleton-search" />
      <div className="favorites-skeleton favorites-skeleton-sort" />
    </div>

    {/* Result info skeleton */}
    <div className="favorites-skeleton favorites-skeleton-result-info" />
  </div>
);
