import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext/AuthContext';
import { toggleFavorite } from '../api/favorites';
import { BookSearchResult, searchBooksEN, searchBooksKO } from '../api/bookSearch';
import {
  useFavoritesStore,
  EnrichedFavorite,
  EnrichedAIRecommendation,
} from '../store/favoritesStore';
import { formatDateFull } from '../utils/dateUtils';
import {
  HeroStatsSkeleton,
  GridSkeleton,
} from '../components/favorites/FavoritesSkeletons';
import './styles/Favorites.css';

const Favorites: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Local UI state
  const [activeTab, setActiveTab] = useState<'ai' | 'liked'>('liked');
  const [sortBy, setSortBy] = useState('relevance');
  const [removingIsbn, setRemovingIsbn] = useState<string | null>(null);

  // Search dropdown state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [togglingIsbn, setTogglingIsbn] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Favorites store
  const {
    userFavorites,
    aiRecommendations,
    isLoading,
    isEnriching,
    isRegenerating,
    fetchFavorites,
    regenerateAIRecommendations,
    addFavorite,
    removeFavorite,
  } = useFavoritesStore();

  // Locale memoization
  const locale = useMemo(
    () => (i18n.language === 'ko' ? 'ko' : 'en') as 'ko' | 'en',
    [i18n.language]
  );

  // Date format helper (memoized)
  const formatDate = useCallback(
    (dateString: string) => formatDateFull(dateString, locale),
    [locale]
  );

  // Current items based on active tab (memoized)
  const currentItems = useMemo(
    () => (activeTab === 'liked' ? userFavorites : aiRecommendations),
    [activeTab, userFavorites, aiRecommendations]
  );

  // Favorite ISBN set for efficient lookup (memoized)
  const favoriteIsbnSet = useMemo(
    () => new Set(userFavorites.map((f) => f.isbn)),
    [userFavorites]
  );

  // Check if a book is in favorites (memoized)
  const isBookInFavorites = useCallback(
    (isbn: string | undefined) => (isbn ? favoriteIsbnSet.has(isbn) : false),
    [favoriteIsbnSet]
  );

  // Fetch favorites on mount
  useEffect(() => {
    if (user) {
      fetchFavorites();
    }
  }, [user, fetchFavorites]);

  // Click outside handler to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search books with debouncing
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      setSearchQuery(query);

      // Clear previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (query.trim().length < 2) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      // Debounce search
      searchTimeoutRef.current = setTimeout(async () => {
        setIsSearching(true);
        setShowDropdown(true);
        try {
          const searchFn = i18n.language === 'ko' ? searchBooksKO : searchBooksEN;
          const results = await searchFn(query);
          setSearchResults(results.slice(0, 10));
        } catch (error) {
          console.error('Search failed:', error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    },
    [i18n.language]
  );

  // Toggle favorite from dropdown
  const handleDropdownToggleFavorite = useCallback(
    async (book: BookSearchResult, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!book.isbn || !user) return;

      setTogglingIsbn(book.isbn);
      try {
        const result = await toggleFavorite(book.isbn);
        if (result.isFavorited) {
          addFavorite({
            isbn: book.isbn,
            likedAt: new Date().toISOString(),
            bookInfo: book,
          });
        } else {
          removeFavorite(book.isbn);
        }
      } catch (error) {
        console.error('Failed to toggle favorite:', error);
      } finally {
        setTogglingIsbn(null);
      }
    },
    [user, addFavorite, removeFavorite]
  );

  // Remove favorite
  const handleRemoveFavorite = useCallback(
    async (isbn: string) => {
      setRemovingIsbn(isbn);
      try {
        await toggleFavorite(isbn);
        removeFavorite(isbn);
      } catch (error) {
        console.error('Failed to remove favorite:', error);
      } finally {
        setRemovingIsbn(null);
      }
    },
    [removeFavorite]
  );

  // Navigate to create discussion with book data
  const handleCreateDiscussion = useCallback(
    (isbn: string) => {
      // Find the book info from favorites or AI recommendations
      const favorite = userFavorites.find(f => f.isbn === isbn);
      const aiRec = aiRecommendations.find(r => r.isbn === isbn);
      const bookInfo = favorite?.bookInfo || aiRec?.bookInfo;

      // Pass book data via state for auto-population
      navigate('/create', {
        state: {
          isbn,
          bookInfo, // Pass full book info to skip API call
        }
      });
    },
    [navigate, userFavorites, aiRecommendations]
  );

  // Navigate to board with search query
  const handleFindDiscussion = useCallback(
    (bookTitle: string) => {
      if (!bookTitle) return;
      navigate('/', {
        state: {
          searchQuery: bookTitle,
        }
      });
    },
    [navigate]
  );

  // Handle search focus
  const handleSearchFocus = useCallback(() => {
    if (searchQuery.trim().length >= 2) {
      setShowDropdown(true);
    }
  }, [searchQuery]);

  // Handle tab change
  const handleTabChange = useCallback((tab: 'ai' | 'liked') => {
    setActiveTab(tab);
  }, []);

  // Handle AI recommendations regenerate
  const handleRegenerateAI = useCallback(async () => {
    if (isRegenerating) return;
    const lang = i18n.language === 'ko' ? 'ko' : 'en';
    await regenerateAIRecommendations(lang);
  }, [isRegenerating, i18n.language, regenerateAIRecommendations]);

  // Handle sort change
  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value);
  }, []);

  // Login required view
  if (!user) {
    return (
      <div className="favorites-page">
        <div className="favorites-login-required">
          <p>{t('favorites_login_required')}</p>
          <button onClick={() => navigate('/login')} className="favorites-login-btn">
            {t('notes_login_button')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="favorites-page">
      {/* Hero Section - Always renders immediately */}
      <div className="favorites-hero">
        <div className="favorites-hero-bg-1"></div>
        <div className="favorites-hero-bg-2"></div>
        <div className="favorites-hero-content">
          <div className="favorites-hero-text">
            <div className="favorites-hero-badge">
              <div className="favorites-hero-badge-dot"></div>
              <span>{t('favorites_hero_badge')}</span>
            </div>
            <h1 className="favorites-hero-title">{t('favorites_hero_title')}</h1>
            <p className="favorites-hero-subtitle">
              {t('favorites_hero_subtitle_1')}
              <br />
              {t('favorites_hero_subtitle_2')}
            </p>

            {/* Hero Stats - Show skeleton while loading */}
            {isLoading ? (
              <HeroStatsSkeleton />
            ) : (
              <div className="favorites-hero-stats">
                <div className="favorites-stat-item">
                  <div className="favorites-stat-icon favorites-stat-icon-ai">
                    <i className="ri-ai-generate"></i>
                  </div>
                  <div className="favorites-stat-info">
                    <div className="favorites-stat-value">{aiRecommendations.length}</div>
                    <div className="favorites-stat-label">{t('favorites_stat_ai')}</div>
                  </div>
                </div>
                <div className="favorites-stat-item">
                  <div className="favorites-stat-icon favorites-stat-icon-liked">
                    <i className="ri-heart-fill"></i>
                  </div>
                  <div className="favorites-stat-info">
                    <div className="favorites-stat-value">{userFavorites.length}</div>
                    <div className="favorites-stat-label">{t('favorites_stat_liked')}</div>
                  </div>
                </div>
                <div className="favorites-stat-item">
                  <div className="favorites-stat-icon favorites-stat-icon-available">
                    <i className="ri-book-open-line"></i>
                  </div>
                  <div className="favorites-stat-info">
                    <div className="favorites-stat-value">
                      {userFavorites.length + aiRecommendations.length}
                    </div>
                    <div className="favorites-stat-label">{t('favorites_stat_available')}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Filter Bar */}
      <div className="favorites-filter-bar">
        <div className="favorites-filter-container">
          <div className="favorites-filter-content">
            {/* Tabs */}
            <div className="favorites-tabs">
              <button
                className={`favorites-tab ${activeTab === 'ai' ? 'active' : ''}`}
                onClick={() => handleTabChange('ai')}
              >
                <div className="favorites-tab-icon">
                  <i className="ri-ai-generate"></i>
                </div>
                {t('favorites_tab_ai')} ({aiRecommendations.length})
              </button>
              <button
                className={`favorites-tab ${activeTab === 'liked' ? 'active' : ''}`}
                onClick={() => handleTabChange('liked')}
              >
                <div className="favorites-tab-icon favorites-tab-icon-heart">
                  <i className="ri-heart-fill"></i>
                </div>
                {t('favorites_tab_liked')} ({userFavorites.length})
              </button>

              {/* AI Regenerate Button */}
              {activeTab === 'ai' && (
                <button
                  className={`favorites-regenerate-btn ${isRegenerating ? 'loading' : ''}`}
                  onClick={handleRegenerateAI}
                  disabled={isRegenerating}
                  title={t('favorites_regenerate_tooltip')}
                >
                  <i className={isRegenerating ? 'ri-loader-4-line' : 'ri-refresh-line'}></i>
                  <span>{isRegenerating ? t('favorites_regenerating') : t('favorites_regenerate')}</span>
                </button>
              )}
            </div>

            {/* Search and Sort */}
            <div className="favorites-search-row">
              <div className="favorites-search-wrapper" ref={searchRef}>
                <div className="favorites-search-icon">
                  <i className="ri-search-line"></i>
                </div>
                <input
                  type="text"
                  className="favorites-search-input"
                  placeholder={t('favorites_search_add_placeholder')}
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={handleSearchFocus}
                />

                {/* Search Dropdown */}
                {showDropdown && (
                  <div className="favorites-search-dropdown">
                    {isSearching ? (
                      <div className="favorites-search-dropdown-loading">
                        <i className="ri-loader-4-line"></i>
                        <span>{t('loading')}</span>
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="favorites-search-dropdown-empty">
                        <i className="ri-book-line"></i>
                        <span>{t('favorites_search_no_results')}</span>
                      </div>
                    ) : (
                      searchResults.map((book, index) => {
                        const isFavorited = isBookInFavorites(book.isbn);
                        const isToggling = togglingIsbn === book.isbn;

                        return (
                          <div
                            key={book.isbn || index}
                            className="favorites-search-dropdown-item"
                            onClick={(e) => handleDropdownToggleFavorite(book, e)}
                          >
                            <div className="favorites-search-dropdown-cover">
                              {book.thumbnail?.small || book.thumbnail?.medium ? (
                                <img
                                  src={book.thumbnail.small || book.thumbnail.medium}
                                  alt={book.title}
                                />
                              ) : (
                                <div className="favorites-search-dropdown-no-cover">
                                  <i className="ri-book-2-line"></i>
                                </div>
                              )}
                            </div>
                            <div className="favorites-search-dropdown-info">
                              <span className="favorites-search-dropdown-title">{book.title}</span>
                              <span className="favorites-search-dropdown-author">{book.author}</span>
                            </div>
                            <button
                              className={`favorites-search-dropdown-like ${isFavorited ? 'liked' : ''}`}
                              onClick={(e) => handleDropdownToggleFavorite(book, e)}
                              disabled={isToggling || !book.isbn}
                            >
                              {isToggling ? (
                                <i className="ri-loader-4-line"></i>
                              ) : (
                                <i className={isFavorited ? 'ri-heart-fill' : 'ri-heart-line'}></i>
                              )}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              <select
                className="favorites-sort-select"
                value={sortBy}
                onChange={handleSortChange}
              >
                <option value="relevance">{t('favorites_sort_relevance')}</option>
                <option value="rating">{t('favorites_sort_rating')}</option>
                <option value="popularity">{t('favorites_sort_rooms')}</option>
              </select>
            </div>

            {/* Result Count */}
            <div className="favorites-result-info">
              <span>
                <strong>
                  {currentItems.length}
                  {t('favorites_unit_books')}
                </strong>
                {t('favorites_of_books')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="favorites-main">
        <div className="favorites-container">
          {isLoading ? (
            <GridSkeleton count={4} />
          ) : currentItems.length === 0 ? (
            <div className="favorites-empty">
              <div className="favorites-empty-icon">
                <i className={activeTab === 'liked' ? 'ri-heart-line' : 'ri-ai-generate'}></i>
              </div>
              <h2>
                {activeTab === 'liked'
                  ? t('favorites_empty_liked_title')
                  : t('favorites_empty_ai_title')}
              </h2>
              <p>
                {activeTab === 'liked'
                  ? t('favorites_empty_liked_desc')
                  : t('favorites_empty_ai_desc')}
              </p>
              <button className="favorites-browse-btn" onClick={() => navigate('/')}>
                {t('favorites_browse_rooms')}
              </button>
            </div>
          ) : (
            <div className="favorites-grid">
              {activeTab === 'liked'
                ? userFavorites.map((item) => (
                    <LikedBookCard
                      key={item.isbn}
                      item={item}
                      isEnriching={isEnriching}
                      removingIsbn={removingIsbn}
                      formatDate={formatDate}
                      onRemove={handleRemoveFavorite}
                      onCreateDiscussion={handleCreateDiscussion}
                      onFindDiscussion={handleFindDiscussion}
                      t={t}
                    />
                  ))
                : aiRecommendations.map((item) => (
                    <AIBookCard
                      key={item.isbn}
                      item={item}
                      isEnriching={isEnriching}
                      onCreateDiscussion={handleCreateDiscussion}
                      onFindDiscussion={handleFindDiscussion}
                      t={t}
                    />
                  ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Sub-components (memoized)
// =============================================================================

interface LikedBookCardProps {
  item: EnrichedFavorite;
  isEnriching: boolean;
  removingIsbn: string | null;
  formatDate: (dateString: string) => string;
  onRemove: (isbn: string) => void;
  onCreateDiscussion: (isbn: string) => void;
  onFindDiscussion: (bookTitle: string) => void;
  t: (key: string) => string;
}

const LikedBookCard: React.FC<LikedBookCardProps> = React.memo(
  ({ item, isEnriching, removingIsbn, formatDate, onRemove, onCreateDiscussion, onFindDiscussion, t }) => (
    <div className="favorites-card group">
      {/* 3D Book Cover */}
      <div className="favorites-card-cover">
        <div className="favorites-book-wrapper">
          <div className="favorites-book-container">
            <div className="favorites-book">
              <div className="favorites-book-front">
                <div className="favorites-book-cover-inner">
                  {item.bookInfo?.thumbnail?.small || item.bookInfo?.thumbnail?.medium ? (
                    <img
                      src={item.bookInfo.thumbnail.small || item.bookInfo.thumbnail.medium}
                      alt={item.bookInfo?.title || 'Book cover'}
                    />
                  ) : (
                    <div className="favorites-book-no-cover">
                      <div className="no-cover-decoration"></div>
                      {isEnriching ? (
                        <i className="ri-loader-4-line no-cover-spinner"></i>
                      ) : (
                        <i className="ri-book-open-line no-cover-icon"></i>
                      )}
                      <span className="no-cover-title">{item.bookInfo?.title || ''}</span>
                    </div>
                  )}
                  <p className="favorites-book-author">
                    {item.bookInfo?.author || t('favorites_unknown_author')}
                  </p>
                </div>
              </div>
              <div className="favorites-book-spine">
                <h2><span>{item.bookInfo?.title || ''}</span></h2>
              </div>
            </div>
          </div>

          {/* Like Button on Cover */}
          <button
            className={`favorites-cover-like ${removingIsbn === item.isbn ? 'loading' : ''}`}
            onClick={() => onRemove(item.isbn)}
            disabled={removingIsbn === item.isbn}
            title={t('favorites_remove')}
          >
            <i className={removingIsbn === item.isbn ? 'ri-loader-4-line' : 'ri-heart-fill'}></i>
          </button>
        </div>

        {/* Genre Badge */}
        {item.bookInfo?.categories?.[0] && (
          <div className="favorites-card-genre">
            <span>{item.bookInfo.categories[0]}</span>
          </div>
        )}
      </div>

      {/* Book Info */}
      <div className="favorites-card-content">
        <div className="favorites-card-header">
          <h3 className="favorites-card-title">
            {item.bookInfo?.title || t('favorites_unknown_title')}
          </h3>
          <p className="favorites-card-author">
            {item.bookInfo?.author || t('favorites_unknown_author')}
          </p>
        </div>

        {/* Liked Info */}
        <div className="favorites-card-liked-info">
          <div className="favorites-card-liked-badge">
            <i className="ri-heart-fill"></i>
            <span>
              {formatDate(item.likedAt)}
              {t('favorites_liked_at')}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="favorites-card-actions">
          <button
            className="favorites-card-btn favorites-card-btn-find"
            onClick={() => onFindDiscussion(item.bookInfo?.title || '')}
          >
            <i className="ri-search-line"></i>
            <span>{t('favorites_find_discussion')}</span>
          </button>
          <button
            className="favorites-card-btn favorites-card-btn-create"
            onClick={() => onCreateDiscussion(item.isbn)}
          >
            <i className="ri-discussion-line"></i>
            <span>{t('favorites_create_discussion')}</span>
          </button>
        </div>
      </div>
    </div>
  )
);

LikedBookCard.displayName = 'LikedBookCard';

interface AIBookCardProps {
  item: EnrichedAIRecommendation;
  isEnriching: boolean;
  onCreateDiscussion: (isbn: string) => void;
  onFindDiscussion: (bookTitle: string) => void;
  t: (key: string) => string;
}

const AIBookCard: React.FC<AIBookCardProps> = React.memo(
  ({ item, isEnriching, onCreateDiscussion, onFindDiscussion, t }) => (
    <div className="favorites-card group">
      {/* 3D Book Cover */}
      <div className="favorites-card-cover">
        <div className="favorites-book-wrapper">
          <div className="favorites-book-container">
            <div className="favorites-book">
              <div className="favorites-book-front">
                <div className="favorites-book-cover-inner">
                  {item.bookInfo?.thumbnail?.small || item.bookInfo?.thumbnail?.medium ? (
                    <img
                      src={item.bookInfo.thumbnail.small || item.bookInfo.thumbnail.medium}
                      alt={item.bookInfo?.title || 'Book cover'}
                    />
                  ) : (
                    <div className="favorites-book-no-cover">
                      <div className="no-cover-decoration"></div>
                      {isEnriching ? (
                        <i className="ri-loader-4-line no-cover-spinner"></i>
                      ) : (
                        <i className="ri-book-open-line no-cover-icon"></i>
                      )}
                      <span className="no-cover-title">{item.bookInfo?.title || ''}</span>
                    </div>
                  )}
                  <p className="favorites-book-author">
                    {item.bookInfo?.author || t('favorites_unknown_author')}
                  </p>
                </div>
              </div>
              <div className="favorites-book-spine">
                <h2><span>{item.bookInfo?.title || ''}</span></h2>
              </div>
            </div>
          </div>

          {/* AI Badge on Cover */}
          <div className="favorites-cover-ai-badge">
            <i className="ri-ai-generate"></i>
            <span>AI</span>
          </div>
        </div>

        {/* Genre Badge */}
        {item.bookInfo?.categories?.[0] && (
          <div className="favorites-card-genre">
            <span>{item.bookInfo.categories[0]}</span>
          </div>
        )}
      </div>

      {/* Book Info */}
      <div className="favorites-card-content">
        <div className="favorites-card-header">
          <h3 className="favorites-card-title">
            {item.bookInfo?.title || t('favorites_unknown_title')}
          </h3>
          <p className="favorites-card-author">
            {item.bookInfo?.author || t('favorites_unknown_author')}
          </p>
        </div>

        {/* AI Reason */}
        <div className="favorites-card-ai-reason">
          <div className="favorites-card-ai-reason-header">
            <i className="ri-lightbulb-line"></i>
            <span>{t('favorites_ai_reason')}</span>
          </div>
          <p>{item.reason}</p>
        </div>

        {/* Action Buttons */}
        <div className="favorites-card-actions">
          <button
            className="favorites-card-btn favorites-card-btn-find"
            onClick={() => onFindDiscussion(item.bookInfo?.title || '')}
          >
            <i className="ri-search-line"></i>
            <span>{t('favorites_find_discussion')}</span>
          </button>
          <button
            className="favorites-card-btn favorites-card-btn-create"
            onClick={() => onCreateDiscussion(item.isbn)}
          >
            <i className="ri-discussion-line"></i>
            <span>{t('favorites_create_discussion')}</span>
          </button>
        </div>
      </div>
    </div>
  )
);

AIBookCard.displayName = 'AIBookCard';

export default Favorites;
