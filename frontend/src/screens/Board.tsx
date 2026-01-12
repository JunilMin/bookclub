import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiSearch, FiCalendar, FiUsers, FiBookOpen, FiMessageCircle, FiAward } from 'react-icons/fi';
import { getAllPosts, Post, joinBookMeeting, deletePost } from '../api/posts';
import { useAuth } from '../AuthContext/AuthContext';
import RoomModal, { Room } from '../components/RoomModal';
import Footer from '../components/Footer';
import './styles/Board.css';

// Google Books API book info cache
const bookInfoCache = new Map<string, { author: string; genre: string; cover: string }>();

// Fetch book info from Google Books API by ISBN
async function fetchBookInfo(isbn: string): Promise<{ author: string; genre: string; cover: string }> {
  if (!isbn) {
    return { author: 'Unknown Author', genre: 'General', cover: '' };
  }

  // Check cache first
  if (bookInfoCache.has(isbn)) {
    return bookInfoCache.get(isbn)!;
  }

  let author = 'Unknown Author';
  let genre = 'General';
  let cover = '';

  try {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`
    );

    if (response.ok) {
      const data = await response.json();

      if (data.items && data.items.length > 0) {
        const volumeInfo = data.items[0].volumeInfo;

        // Get author
        if (volumeInfo.authors && volumeInfo.authors.length > 0) {
          author = volumeInfo.authors.join(', ');
        }

        // Get genre/category
        if (volumeInfo.categories && volumeInfo.categories.length > 0) {
          genre = volumeInfo.categories[0];
        }

        // Get cover image
        if (volumeInfo.imageLinks) {
          cover = volumeInfo.imageLinks.thumbnail || volumeInfo.imageLinks.smallThumbnail || '';
          // Convert http to https
          if (cover.startsWith('http:')) {
            cover = cover.replace('http:', 'https:');
          }
        }
      }
    }
  } catch {
    // Ignore errors, use defaults
  }

  const result = { author, genre, cover };
  bookInfoCache.set(isbn, result);
  return result;
}

// Generate placeholder avatar
function generateAvatar(name: string): string {
  const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
  const colorIndex = name.charCodeAt(0) % colors.length;
  const initial = name.charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <rect width="40" height="40" fill="${colors[colorIndex]}" rx="20"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-family="Arial" font-size="18" font-weight="bold">${initial}</text>
  </svg>`;
  // Use encodeURIComponent for non-Latin1 characters (Korean, etc.)
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Convert Post to Room
function postToRoom(post: Post, currentUsername: string | undefined, bookInfo: { author: string; genre: string; cover: string }): Room {
  const now = new Date();
  const dueDate = new Date(post.due);
  const duration = 60; // minutes
  const endDate = new Date(dueDate.getTime() + duration * 60 * 1000);

  // Determine status: past (ended), live (in progress), upcoming (not started)
  let status: 'live' | 'upcoming' | 'past';
  if (now > endDate) {
    status = 'past';
  } else if (now >= dueDate) {
    status = 'live';
  } else {
    status = 'upcoming';
  }

  const levelTagMap: Record<string, string> = {
    low: 'Beginner',
    moderate: 'Intermediate',
    high: 'Advanced'
  };

  const tags = [levelTagMap[post.level] || post.level];
  if (bookInfo.genre && bookInfo.genre !== 'General') {
    tags.push(bookInfo.genre);
  }

  return {
    id: post.id,
    title: `${post.book} Discussion`,
    host: post.creater,
    hostAvatar: generateAvatar(post.creater),
    book: {
      title: post.book,
      author: bookInfo.author,
      cover: bookInfo.cover || `https://via.placeholder.com/224x320?text=${encodeURIComponent(post.book)}`,
      genre: bookInfo.genre,
      isbn: post.isbn || ''
    },
    dueISO: post.due,
    duration: 60,
    participants: post.member?.length || 0,
    maxParticipants: post.capacity,
    level: post.level,
    description: `Join us for an engaging discussion about "${post.book}". Share your insights and connect with fellow readers.`,
    tags,
    status,
    isJoined: currentUsername ? post.member?.includes(currentUsername) || post.creater === currentUsername : false,
    isMyRoom: currentUsername ? post.creater === currentUsername : false,
    meetLink: post.meetLink,
    calendarEventId: post.calendarEventId
  };
}

type TabType = 'all' | 'my' | 'joined';
type StatusFilter = 'all' | 'live' | 'upcoming' | 'past';
type SortBy = 'latest' | 'mostPopular' | 'startingSoon';

const REFRESH_INTERVAL = 30000;

const Board: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { accessToken, user } = useAuth();
  const gridRef = useRef<HTMLDivElement>(null);

  // Data state
  const [posts, setPosts] = useState<Post[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('latest');
  const [activeTab, setActiveTab] = useState<TabType>('all');

  // Modal state
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Handle URL params for tab filter
  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter === 'created') {
      setActiveTab('my');
    } else if (filter === 'participating') {
      setActiveTab('joined');
    }
  }, [searchParams]);

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    if (!accessToken) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getAllPosts(accessToken);
      setPosts(data);
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError(t('browse_error'));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, t]);

  // Initial load
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Auto refresh
  useEffect(() => {
    if (!accessToken) return;
    const intervalId = setInterval(fetchPosts, REFRESH_INTERVAL);
    return () => clearInterval(intervalId);
  }, [accessToken, fetchPosts]);

  // Convert posts to rooms with book info
  useEffect(() => {
    const convertPostsToRooms = async () => {
      const roomPromises = posts.map(async (post) => {
        const bookInfo = await fetchBookInfo(post.isbn || '');
        return postToRoom(post, user?.username, bookInfo);
      });

      const convertedRooms = await Promise.all(roomPromises);
      setRooms(convertedRooms);
    };

    if (posts.length > 0) {
      convertPostsToRooms();
    } else {
      setRooms([]);
    }
  }, [posts, user?.username]);

  // Get unique genres from rooms
  const genres = useMemo(() => {
    const genreSet = new Set<string>();
    rooms.forEach(room => {
      if (room.book.genre && room.book.genre !== 'General') {
        genreSet.add(room.book.genre);
      }
    });
    return Array.from(genreSet).sort();
  }, [rooms]);

  // Filtered and sorted rooms
  const filteredRooms = useMemo(() => {
    let result = [...rooms];

    // Tab filter
    if (activeTab === 'my') {
      result = result.filter(room => room.isMyRoom);
    } else if (activeTab === 'joined') {
      result = result.filter(room => room.isJoined && !room.isMyRoom);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(room =>
        room.title.toLowerCase().includes(query) ||
        room.book.title.toLowerCase().includes(query) ||
        room.book.author.toLowerCase().includes(query) ||
        room.host.toLowerCase().includes(query) ||
        room.book.isbn.toLowerCase().includes(query)
      );
    }

    // Genre filter
    if (selectedGenre !== 'all') {
      result = result.filter(room => room.book.genre === selectedGenre);
    }

    // Status filter
    if (selectedStatus !== 'all') {
      result = result.filter(room => room.status === selectedStatus);
    }

    // Sort
    switch (sortBy) {
      case 'latest':
        result.sort((a, b) => new Date(b.dueISO).getTime() - new Date(a.dueISO).getTime());
        break;
      case 'mostPopular':
        result.sort((a, b) => b.participants - a.participants);
        break;
      case 'startingSoon':
        result.sort((a, b) => new Date(a.dueISO).getTime() - new Date(b.dueISO).getTime());
        break;
    }

    return result;
  }, [rooms, activeTab, searchQuery, selectedGenre, selectedStatus, sortBy]);

  // Handlers
  const handleScrollToGrid = () => {
    gridRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleJoin = useCallback(async (roomId: string) => {
    if (!accessToken || !user?.username) return;

    setIsProcessing(true);
    try {
      await joinBookMeeting(roomId, user.username, accessToken);
      await fetchPosts();
      setSelectedRoom(null);
    } catch (err) {
      console.error('Error joining meeting:', err);
      alert(t('board_join_error'));
    } finally {
      setIsProcessing(false);
    }
  }, [accessToken, user?.username, fetchPosts, t]);

  const handleDelete = useCallback(async (roomId: string) => {
    if (!accessToken) return;

    setIsProcessing(true);
    try {
      await deletePost(roomId, accessToken);
      setSelectedRoom(null);
      await fetchPosts();
    } catch (err) {
      console.error('Error deleting room:', err);
      alert(t('board_delete_error'));
    } finally {
      setIsProcessing(false);
    }
  }, [accessToken, fetchPosts, t]);

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Login required view
  if (!accessToken) {
    return (
      <div className="board-page">
        <div className="board-login-required">
          <FiBookOpen size={64} />
          <h2>{t('browse_login_required')}</h2>
          <button className="board-login-btn" onClick={() => navigate('/login')}>
            {t('browse_login_button')}
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="board-page">
      {/* Hero Section */}
      <section className="board-hero">
        <div className="board-hero-content">
          <span className="board-hero-badge">
            {t('browse_hero_badge')}
          </span>
          <h1 className="board-hero-title">
            {t('browse_hero_title')}
          </h1>
          <p className="board-hero-subtitle">
            {t('browse_hero_subtitle')}
          </p>
          <div className="board-hero-cta">
            <button className="board-cta-primary" onClick={handleScrollToGrid}>
              {t('browse_hero_cta_browse')}
            </button>
            <button className="board-cta-secondary" onClick={() => navigate('/board/create')}>
              {t('browse_hero_cta_create')}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="board-stats">
          <div className="board-stat-card">
            <FiUsers className="board-stat-icon" />
            <span className="board-stat-value">10,000+</span>
            <span className="board-stat-label">{t('browse_stat_readers')}</span>
          </div>
          <div className="board-stat-card">
            <FiMessageCircle className="board-stat-icon" />
            <span className="board-stat-value">500+</span>
            <span className="board-stat-label">{t('browse_stat_discussions')}</span>
          </div>
          <div className="board-stat-card">
            <FiAward className="board-stat-icon" />
            <span className="board-stat-value">50+</span>
            <span className="board-stat-label">{t('browse_stat_genres')}</span>
          </div>
        </div>
      </section>

      {/* Filter Section */}
      <section className="board-filters" ref={gridRef}>
        <div className="board-filters-row">
          {/* Search */}
          <div className="board-search">
            <FiSearch className="board-search-icon" />
            <input
              type="text"
              placeholder={t('browse_search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="board-search-input"
            />
          </div>

          {/* Filters */}
          <div className="board-filter-group">
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="board-filter-select"
            >
              <option value="all">{t('browse_filter_all_genres')}</option>
              {genres.map(genre => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as StatusFilter)}
              className="board-filter-select"
            >
              <option value="all">{t('browse_filter_all_status')}</option>
              <option value="live">{t('browse_filter_live')}</option>
              <option value="upcoming">{t('browse_filter_upcoming')}</option>
              <option value="past">{t('browse_filter_past')}</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="board-filter-select"
            >
              <option value="latest">{t('browse_sort_latest')}</option>
              <option value="mostPopular">{t('browse_sort_popular')}</option>
              <option value="startingSoon">{t('browse_sort_starting_soon')}</option>
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="board-tabs">
          <button
            className={`board-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            {t('browse_tab_all')}
          </button>
          <button
            className={`board-tab ${activeTab === 'my' ? 'active' : ''}`}
            onClick={() => setActiveTab('my')}
          >
            {t('browse_tab_my')}
          </button>
          <button
            className={`board-tab ${activeTab === 'joined' ? 'active' : ''}`}
            onClick={() => setActiveTab('joined')}
          >
            {t('browse_tab_joined')}
          </button>
        </div>
      </section>

      {/* Rooms Grid */}
      <section className="board-rooms">
        {isLoading ? (
          <div className="board-loading">
            <div className="board-loading-spinner"></div>
            <p>{t('browse_loading')}</p>
          </div>
        ) : error ? (
          <div className="board-error">
            <p>{error}</p>
            <button className="board-retry-btn" onClick={fetchPosts}>
              {t('browse_retry')}
            </button>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="board-empty">
            <FiBookOpen size={48} />
            <h3>{t('browse_no_rooms')}</h3>
            <p>{t('browse_no_rooms_desc')}</p>
            <button className="board-create-btn" onClick={() => navigate('/board/create')}>
              {t('browse_hero_cta_create')}
            </button>
          </div>
        ) : (
          <div className="board-grid">
            {filteredRooms.map(room => (
              <div
                key={room.id}
                className="room-card"
                onClick={() => setSelectedRoom(room)}
              >
                {/* Cover */}
                <div className="room-card-cover">
                  <img
                    src={room.book.cover}
                    alt={room.book.title}
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://via.placeholder.com/300x400?text=${encodeURIComponent(room.book.title)}`;
                    }}
                  />
                  <span className={`room-status-badge ${room.status}`}>
                    {room.status === 'live' && <span className="live-dot"></span>}
                    {room.status === 'live'
                      ? t('browse_card_live')
                      : room.status === 'past'
                        ? t('browse_card_past')
                        : t('browse_card_upcoming')}
                  </span>
                  {room.isMyRoom && (
                    <span className="room-my-badge">{t('browse_card_my_room')}</span>
                  )}
                </div>

                {/* Content */}
                <div className="room-card-content">
                  <h3 className="room-card-title">{room.title}</h3>
                  <p className="room-card-book">
                    {room.book.title} by {room.book.author}
                  </p>

                  {/* Host */}
                  <div className="room-card-host">
                    <img src={room.hostAvatar} alt={room.host} className="room-host-avatar" />
                    <span>{t('browse_card_hosted_by')} {room.host}</span>
                  </div>

                  {/* Meta */}
                  <div className="room-card-meta">
                    <span className="room-meta-item">
                      <FiCalendar size={14} />
                      {formatDate(room.dueISO)} {formatTime(room.dueISO)}
                    </span>
                    <span className="room-meta-item">
                      <FiUsers size={14} />
                      {room.participants}/{room.maxParticipants} {t('browse_card_participants')}
                    </span>
                  </div>

                  {/* Action Button */}
                  <button
                    className={`room-card-btn ${room.status} ${room.isJoined ? 'joined' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (room.isJoined || room.isMyRoom) {
                        navigate(`/meeting/${room.id}`, { state: { meetLink: room.meetLink, room } });
                      } else if (room.status !== 'past') {
                        handleJoin(room.id);
                      }
                    }}
                    disabled={isProcessing || (room.status === 'past' && !room.isJoined && !room.isMyRoom)}
                  >
                    {room.isJoined || room.isMyRoom
                      ? t('browse_card_view_details')
                      : room.status === 'past'
                        ? t('browse_card_ended')
                        : room.status === 'live'
                          ? t('browse_card_join_now')
                          : t('browse_card_reserve')
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Room Modal */}
      {selectedRoom && (
        <RoomModal
          room={selectedRoom}
          onClose={() => setSelectedRoom(null)}
          onJoin={handleJoin}
          onDelete={handleDelete}
          isProcessing={isProcessing}
        />
      )}

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Board;
