import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext/AuthContext';
import { getMyFav, toggleFavorite, UserFavorite, AIRecommendation } from '../api/favorites';
import { getBookByISBN, BookSearchResult, searchBooksEN, searchBooksKO } from '../api/bookSearch';
import './styles/Favorites.css';

interface EnrichedFavorite extends UserFavorite {
  bookInfo?: BookSearchResult;
}

interface EnrichedAIRecommendation extends AIRecommendation {
  bookInfo?: BookSearchResult;
}

const Favorites: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'ai' | 'liked'>('liked');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('relevance');
  const [loading, setLoading] = useState(true);
  const [userFavorites, setUserFavorites] = useState<EnrichedFavorite[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<EnrichedAIRecommendation[]>([]);
  const [removingIsbn, setRemovingIsbn] = useState<string | null>(null);

  // Search dropdown state
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [togglingIsbn, setTogglingIsbn] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch favorites and enrich with book info
  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const fav = await getMyFav();

        // Enrich user favorites with book info
        const enrichedUserFavs = await Promise.all(
          (fav.user || []).map(async (f) => {
            const bookInfo = await getBookByISBN(f.isbn);
            return { ...f, bookInfo: bookInfo || undefined };
          })
        );

        // Enrich AI recommendations with book info
        const enrichedAIRecs = await Promise.all(
          (fav.ai || []).map(async (r) => {
            const bookInfo = await getBookByISBN(r.isbn);
            return { ...r, bookInfo: bookInfo || undefined };
          })
        );

        setUserFavorites(enrichedUserFavs);
        setAiRecommendations(enrichedAIRecs);
      } catch (error) {
        console.error('Failed to fetch favorites:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, [user]);

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
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setSearchResults(results.slice(0, 10)); // Limit to 10 results
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  // Check if a book is in favorites
  const isBookInFavorites = (isbn: string | undefined) => {
    if (!isbn) return false;
    return userFavorites.some(f => f.isbn === isbn);
  };

  // Toggle favorite from dropdown
  const handleDropdownToggleFavorite = async (book: BookSearchResult, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dropdown from closing
    if (!book.isbn || !user) return;

    setTogglingIsbn(book.isbn);
    try {
      const result = await toggleFavorite(book.isbn);
      if (result.isFavorited) {
        // Add to local state
        setUserFavorites(prev => [...prev, {
          isbn: book.isbn!,
          likedAt: new Date().toISOString(),
          bookInfo: book
        }]);
      } else {
        // Remove from local state
        setUserFavorites(prev => prev.filter(f => f.isbn !== book.isbn));
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    } finally {
      setTogglingIsbn(null);
    }
  };

  const handleRemoveFavorite = async (isbn: string) => {
    setRemovingIsbn(isbn);
    try {
      await toggleFavorite(isbn);
      setUserFavorites(prev => prev.filter(f => f.isbn !== isbn));
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    } finally {
      setRemovingIsbn(null);
    }
  };

  const handleCreateDiscussion = (isbn: string) => {
    navigate(`/create?isbn=${encodeURIComponent(isbn)}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Filter books based on search query
  const filterBooks = <T extends { bookInfo?: BookSearchResult }>(books: T[]) => {
    if (!searchQuery.trim()) return books;
    const query = searchQuery.toLowerCase();
    return books.filter(item => {
      const title = item.bookInfo?.title?.toLowerCase() || '';
      const author = item.bookInfo?.author?.toLowerCase() || '';
      const categories = item.bookInfo?.categories?.join(' ').toLowerCase() || '';
      return title.includes(query) || author.includes(query) || categories.includes(query);
    });
  };

  const filteredUserFavorites = filterBooks(userFavorites);
  const filteredAIRecommendations = filterBooks(aiRecommendations);

  const currentItems = activeTab === 'liked' ? filteredUserFavorites : filteredAIRecommendations;
  const totalCount = activeTab === 'liked' ? userFavorites.length : aiRecommendations.length;

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
      {/* Hero Section */}
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
              {t('favorites_hero_subtitle_1')}<br />
              {t('favorites_hero_subtitle_2')}
            </p>
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
                  <div className="favorites-stat-value">{userFavorites.length + aiRecommendations.length}</div>
                  <div className="favorites-stat-label">{t('favorites_stat_available')}</div>
                </div>
              </div>
            </div>
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
                onClick={() => setActiveTab('ai')}
              >
                <div className="favorites-tab-icon">
                  <i className="ri-ai-generate"></i>
                </div>
                {t('favorites_tab_ai')} ({aiRecommendations.length})
              </button>
              <button
                className={`favorites-tab ${activeTab === 'liked' ? 'active' : ''}`}
                onClick={() => setActiveTab('liked')}
              >
                <div className="favorites-tab-icon favorites-tab-icon-heart">
                  <i className="ri-heart-fill"></i>
                </div>
                {t('favorites_tab_liked')} ({userFavorites.length})
              </button>
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
                  onFocus={() => searchQuery.trim().length >= 2 && setShowDropdown(true)}
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
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="relevance">{t('favorites_sort_relevance')}</option>
                <option value="rating">{t('favorites_sort_rating')}</option>
                <option value="popularity">{t('favorites_sort_rooms')}</option>
              </select>
            </div>

            {/* Result Count */}
            <div className="favorites-result-info">
              <span>
                <strong>{currentItems.length}{t('favorites_unit_books')}</strong>{t('favorites_of_books')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="favorites-main">
        <div className="favorites-container">
          {loading ? (
            <div className="favorites-loading">
              <div className="favorites-loading-spinner"></div>
              <p>{t('loading')}</p>
            </div>
          ) : currentItems.length === 0 ? (
            <div className="favorites-empty">
              <div className="favorites-empty-icon">
                <i className={activeTab === 'liked' ? 'ri-heart-line' : 'ri-ai-generate'}></i>
              </div>
              <h2>{activeTab === 'liked' ? t('favorites_empty_liked_title') : t('favorites_empty_ai_title')}</h2>
              <p>{activeTab === 'liked' ? t('favorites_empty_liked_desc') : t('favorites_empty_ai_desc')}</p>
              <button className="favorites-browse-btn" onClick={() => navigate('/')}>
                {t('favorites_browse_rooms')}
              </button>
            </div>
          ) : (
            <div className="favorites-grid">
              {activeTab === 'liked' ? (
                filteredUserFavorites.map((item) => (
                  <div key={item.isbn} className="favorites-card group">
                    {/* Book Cover */}
                    <div className="favorites-card-cover">
                      {item.bookInfo?.thumbnail?.medium || item.bookInfo?.thumbnail?.small ? (
                        <img
                          src={item.bookInfo.thumbnail.medium || item.bookInfo.thumbnail.small}
                          alt={item.bookInfo?.title || 'Book cover'}
                        />
                      ) : (
                        <div className="favorites-card-no-cover">
                          <i className="ri-book-2-line"></i>
                        </div>
                      )}
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
                          <span>{formatDate(item.likedAt)}{t('favorites_liked_at')}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="favorites-card-actions">
                        <button
                          className="favorites-card-btn favorites-card-btn-remove"
                          onClick={() => handleRemoveFavorite(item.isbn)}
                          disabled={removingIsbn === item.isbn}
                        >
                          <i className={removingIsbn === item.isbn ? 'ri-loader-4-line' : 'ri-heart-fill'}></i>
                          <span>{t('favorites_remove')}</span>
                        </button>
                        <button
                          className="favorites-card-btn favorites-card-btn-create"
                          onClick={() => handleCreateDiscussion(item.isbn)}
                        >
                          <i className="ri-discussion-line"></i>
                          <span>{t('favorites_create_discussion')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                filteredAIRecommendations.map((item) => (
                  <div key={item.isbn} className="favorites-card group">
                    {/* Book Cover */}
                    <div className="favorites-card-cover">
                      {item.bookInfo?.thumbnail?.medium || item.bookInfo?.thumbnail?.small ? (
                        <img
                          src={item.bookInfo.thumbnail.medium || item.bookInfo.thumbnail.small}
                          alt={item.bookInfo?.title || 'Book cover'}
                        />
                      ) : (
                        <div className="favorites-card-no-cover">
                          <i className="ri-book-2-line"></i>
                        </div>
                      )}
                      {/* AI Badge */}
                      <div className="favorites-card-ai-badge">
                        <i className="ri-ai-generate"></i>
                        <span>AI</span>
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
                          className="favorites-card-btn favorites-card-btn-create"
                          onClick={() => handleCreateDiscussion(item.isbn)}
                        >
                          <i className="ri-discussion-line"></i>
                          <span>{t('favorites_create_discussion')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Favorites;
