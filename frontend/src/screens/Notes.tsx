// frontend/src/screens/Notes.tsx
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiSearch,
  FiCalendar,
  FiUsers,
  FiClock,
  FiGrid,
  FiList,
  FiStar,
  FiFileText,
  FiArrowRight,
  FiBookOpen,
  FiX,
  FiEdit3
} from 'react-icons/fi';
import { useAuth } from '../AuthContext/AuthContext';
import { getMyNotesEnriched, UserNoteResponse } from '../api/notes';
import Footer from '../components/Footer';
import './styles/Notes.css';

// =============================================================================
// Types
// =============================================================================

type ViewMode = 'grid' | 'list';
type FilterTab = 'all' | 'recent' | 'favorites';
type SortBy = 'latest' | 'participants' | 'duration';

// =============================================================================
// Helper Functions
// =============================================================================

function generateBookCoverPlaceholder(title: string): string {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
  const colorIndex = (title?.charCodeAt(0) || 0) % colors.length;
  const bgColor = colors[colorIndex];
  const displayTitle = title && title.length > 20 ? title.slice(0, 17) + '...' : (title || 'Book');
  const lines = displayTitle.match(/.{1,12}/g) || [displayTitle];
  const textElements = lines.map((line, i) =>
    `<text x="50%" y="${45 + i * 14}%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="500">${line}</text>`
  ).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="220" viewBox="0 0 160 220">
    <rect width="160" height="220" fill="${bgColor}" rx="8"/>
    <rect x="10" y="10" width="140" height="200" fill="rgba(255,255,255,0.1)" rx="4"/>
    ${textElements}
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function generateAvatar(name: string | null | undefined): string {
  const safeName = name && name.trim() ? name.trim() : 'U';
  const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
  const colorIndex = safeName.charCodeAt(0) % colors.length;
  const initial = safeName.charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <rect width="32" height="32" fill="${colors[colorIndex]}" rx="16"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-family="Arial" font-size="14" font-weight="bold">${initial}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function formatDate(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatDuration(minutes: number): string {
  if (!minutes) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function getLevelLabel(level: string): string {
  const labels: Record<string, string> = {
    low: 'Beginner',
    moderate: 'Intermediate',
    high: 'Advanced'
  };
  return labels[level] || level;
}

// =============================================================================
// Component
// =============================================================================

const Notes: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();

  // State
  const [notes, setNotes] = useState<UserNoteResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter/View State
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [sortBy, setSortBy] = useState<SortBy>('latest');
  const [searchQuery, setSearchQuery] = useState('');

  // ==========================================================================
  // Data Fetching
  // ==========================================================================
  useEffect(() => {
    const fetchNotes = async () => {
      if (!accessToken) return;

      setIsLoading(true);
      setError(null);

      try {
        const data = await getMyNotesEnriched(accessToken);
        setNotes(data);
      } catch (err) {
        console.error('Failed to fetch notes:', err);
        setError(t('notes_error_fetch'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotes();
  }, [accessToken, t]);

  // ==========================================================================
  // Filtering & Sorting
  // ==========================================================================
  const filteredNotes = useMemo(() => {
    let result = [...notes];

    // Tab filter
    if (activeTab === 'recent') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      result = result.filter(n => new Date(n.noteCreatedAt) >= thirtyDaysAgo);
    } else if (activeTab === 'favorites') {
      result = result.filter(n => n.isFavorite);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(n =>
        n.bookTitle?.toLowerCase().includes(query) ||
        n.bookAuthor?.toLowerCase().includes(query) ||
        n.hostUsername?.toLowerCase().includes(query) ||
        n.title?.toLowerCase().includes(query)
      );
    }

    // Sort
    switch (sortBy) {
      case 'latest':
        result.sort((a, b) => new Date(b.noteUpdatedAt).getTime() - new Date(a.noteUpdatedAt).getTime());
        break;
      case 'participants':
        result.sort((a, b) => b.participantCount - a.participantCount);
        break;
      case 'duration':
        result.sort((a, b) => (b.duration || 0) - (a.duration || 0));
        break;
    }

    return result;
  }, [notes, activeTab, searchQuery, sortBy]);

  // ==========================================================================
  // Stats
  // ==========================================================================
  const stats = useMemo(() => {
    return {
      total: notes.length,
      favorites: notes.filter(n => n.isFavorite).length,
      hosts: notes.filter(n => user?.id && n.hostId === user.id).length
    };
  }, [notes, user]);

  // ==========================================================================
  // Render: Login Required
  // ==========================================================================
  if (!accessToken) {
    return (
      <div className="notes-page">
        <div className="notes-login-required">
          <FiFileText size={64} />
          <h2>{t('notes_login_required')}</h2>
          <button className="notes-login-btn" onClick={() => navigate('/login')}>
            {t('notes_login_button')}
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  // ==========================================================================
  // Render: Main Content
  // ==========================================================================
  return (
    <div className="notes-page">
      {/* Hero Section */}
      <section className="notes-hero">
        <div className="notes-hero-bg">
          <div className="notes-hero-gradient notes-hero-gradient-1" />
          <div className="notes-hero-gradient notes-hero-gradient-2" />
        </div>
        <div className="notes-hero-content">
          <span className="notes-hero-badge">
            <span className="notes-badge-dot" />
            {t('notes_hero_badge')}
          </span>
          <h1 className="notes-hero-title">{t('notes_hero_title')}</h1>
          <p className="notes-hero-subtitle">{t('notes_hero_subtitle')}</p>

          {/* Stats Cards */}
          <div className="notes-stats">
            <div className="notes-stat-card">
              <div className="notes-stat-icon">
                <FiFileText />
              </div>
              <span className="notes-stat-value">{stats.total}</span>
              <span className="notes-stat-label">{t('notes_stat_summaries')}</span>
            </div>
            <div className="notes-stat-card">
              <div className="notes-stat-icon">
                <FiStar />
              </div>
              <span className="notes-stat-value">{stats.favorites}</span>
              <span className="notes-stat-label">{t('notes_stat_favorites')}</span>
            </div>
            <div className="notes-stat-card">
              <div className="notes-stat-icon">
                <FiUsers />
              </div>
              <span className="notes-stat-value">{stats.hosts}</span>
              <span className="notes-stat-label">{t('notes_stat_hosts')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Controls Section */}
      <section className="notes-controls">
        <div className="notes-controls-row">
          {/* Search */}
          <div className="notes-search">
            <FiSearch className="notes-search-icon" />
            <input
              type="text"
              placeholder={t('notes_search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="notes-search-input"
            />
            {searchQuery && (
              <button className="notes-search-clear" onClick={() => setSearchQuery('')}>
                <FiX />
              </button>
            )}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="notes-sort-select"
          >
            <option value="latest">{t('notes_sort_latest')}</option>
            <option value="participants">{t('notes_sort_participants')}</option>
            <option value="duration">{t('notes_sort_duration')}</option>
          </select>

          {/* View Mode */}
          <div className="notes-view-mode">
            <button
              className={`notes-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title={t('notes_view_grid')}
            >
              <FiGrid />
            </button>
            <button
              className={`notes-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title={t('notes_view_list')}
            >
              <FiList />
            </button>
          </div>
        </div>

        <div className="notes-controls-row notes-controls-bottom">
          {/* Tabs */}
          <div className="notes-tabs">
            <button
              className={`notes-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              {t('notes_tab_all')}
            </button>
            <button
              className={`notes-tab ${activeTab === 'recent' ? 'active' : ''}`}
              onClick={() => setActiveTab('recent')}
            >
              {t('notes_tab_recent')}
            </button>
            <button
              className={`notes-tab ${activeTab === 'favorites' ? 'active' : ''}`}
              onClick={() => setActiveTab('favorites')}
            >
              {t('notes_tab_favorites')}
            </button>
          </div>

          {/* Result Count */}
          <span className="notes-result-count">
            {t('notes_result_count', { count: filteredNotes.length })}
          </span>
        </div>
      </section>

      {/* Content Section */}
      <section className="notes-content">
        {isLoading ? (
          <div className={`notes-grid ${viewMode}`}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="notes-card skeleton">
                <div className="notes-card-cover skeleton-cover" />
                <div className="notes-card-body">
                  <div className="skeleton-title" />
                  <div className="skeleton-text" />
                  <div className="skeleton-text short" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="notes-error">
            <FiFileText size={48} />
            <h3>{t('notes_error_title')}</h3>
            <p>{error}</p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="notes-empty">
            <div className="notes-empty-icon">
              <FiFileText />
            </div>
            <h3>{t('notes_empty_title')}</h3>
            <p>{t('notes_empty_desc')}</p>
            <button className="notes-empty-btn" onClick={() => navigate('/')}>
              <FiBookOpen />
              {t('notes_empty_cta')}
            </button>
          </div>
        ) : (
          <div className={`notes-grid ${viewMode}`}>
            {filteredNotes.map((note) => (
              <div
                key={note.noteId}
                className={`notes-card ${viewMode}`}
                onClick={() => navigate(`/notes/${note.noteId}`)}
              >
                {/* 3D Book Cover */}
                <div className="notes-card-cover">
                  <div className="notes-book-container">
                    <div className="notes-book">
                      <div className="notes-book-front">
                        <div className="notes-book-cover">
                          <img
                            src={note.bookCover?.small || note.bookCover?.medium || generateBookCoverPlaceholder(note.bookTitle)}
                            alt={note.bookTitle}
                            loading="lazy"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (!target.src.startsWith('data:image/svg+xml')) {
                                target.src = generateBookCoverPlaceholder(note.bookTitle);
                              }
                            }}
                          />
                          <p className="notes-book-author">{note.bookAuthor}</p>
                        </div>
                      </div>
                      <div className="notes-book-left-side">
                        <h2>
                          <span>{note.bookTitle}</span>
                        </h2>
                      </div>
                    </div>
                  </div>

                  {/* Badges */}
                  {note.bookGenre && (
                    <span className="notes-badge-genre">{note.bookGenre}</span>
                  )}
                  <button
                    className={`notes-btn-favorite ${note.isFavorite ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Toggle favorite
                    }}
                  >
                    <FiStar />
                  </button>

                  {/* Bottom Badges */}
                  <div className="notes-card-badges">
                    {note.hostRating > 0 && (
                      <span className="notes-badge-rating">
                        <FiStar /> {note.hostRating}
                      </span>
                    )}
                    <span className="notes-badge-level">
                      {getLevelLabel(note.level)}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="notes-card-body">
                  {/* Date */}
                  <div className="notes-card-date">
                    <FiCalendar />
                    <span>{formatDate(note.meetingDate)}</span>
                  </div>

                  {/* Note Title (from forked note) */}
                  <h3 className="notes-card-title">{note.title || note.bookTitle}</h3>
                  <p className="notes-card-author">{note.bookAuthor}</p>

                  {/* Host Info */}
                  <div className="notes-card-host">
                    <img
                      src={note.hostPhotoUrl || generateAvatar(note.hostUsername)}
                      alt={note.hostUsername}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = generateAvatar(note.hostUsername);
                      }}
                    />
                    <div className="notes-card-host-info">
                      <span className="notes-card-host-name">{note.hostUsername}</span>
                      {note.isHost && <span className="notes-card-host-badge">{t('notes_host_badge')}</span>}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="notes-card-stats">
                    <span>
                      <FiUsers /> {note.participantCount}
                    </span>
                    <span>
                      <FiClock /> {formatDuration(note.duration)}
                    </span>
                  </div>

                  {/* Key Points Preview (from AI Summary if available) */}
                  {note.aiSummary?.keyPoints && note.aiSummary.keyPoints.length > 0 && (
                    <div className="notes-card-keypoints">
                      <span className="notes-card-keypoints-label">{t('notes_key_points')}</span>
                      <ul>
                        {note.aiSummary.keyPoints.slice(0, 2).map((point, idx) => (
                          <li key={idx}>
                            <span className="notes-keypoint-dot" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Button */}
                  <button className="notes-card-btn">
                    <FiEdit3 />
                    {t('notes_view_note')}
                    <FiArrowRight />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
};

export default Notes;
