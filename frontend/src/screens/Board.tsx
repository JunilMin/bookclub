// frontend/src/screens/Board.tsx
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiSearch, FiCalendar, FiUsers, FiBookOpen, FiMessageCircle, FiAward, FiWifiOff, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { Post, BookData, joinBookMeeting, deletePost, updatePostBookData } from '../api/posts';
import { getUserById, getUserCount } from '../api/user';
import { useAuth } from '../AuthContext/AuthContext';
import { useBoardStore } from '../store/boardStore';
import RoomModal, { Room } from '../components/RoomModal';
import Footer from '../components/Footer';
import './styles/Board.css';

// Post background images
import postBg1 from '../assets/post-background-1.png';
import postBg2 from '../assets/post-background-2.png';
import postBg3 from '../assets/post-background-3.png';
import postBg4 from '../assets/post-background-4.png';
import postBg5 from '../assets/post-background-5.png';

const POST_BACKGROUNDS = [postBg1, postBg2, postBg3, postBg4, postBg5];

// =============================================================================
// Constants
// =============================================================================

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 9;

// =============================================================================
// Helper Functions
// =============================================================================

// Host username cache
const hostUsernameCache = new Map<string, string>();

// Book info cache (for posts being updated)
const bookInfoUpdateInProgress = new Set<string>();

// Fetch book info from Google Books API
async function fetchBookInfoFromGoogle(isbn: string, bookTitle: string): Promise<BookData | null> {
  if (!isbn) return null;

  try {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.items || data.items.length === 0) return null;

    const volumeInfo = data.items[0].volumeInfo;
    const imageLinks = volumeInfo.imageLinks || {};

    // Get small and medium cover images from Google Books API
    let smallCover = imageLinks.smallThumbnail || imageLinks.thumbnail || '';
    let mediumCover = imageLinks.thumbnail || imageLinks.small || imageLinks.medium || '';

    // Convert http to https
    if (smallCover.startsWith('http:')) {
      smallCover = smallCover.replace('http:', 'https:');
    }
    if (mediumCover.startsWith('http:')) {
      mediumCover = mediumCover.replace('http:', 'https:');
    }

    return {
      title: volumeInfo.title || bookTitle,
      isbn: isbn,
      author: volumeInfo.authors?.join(', ') || 'Unknown Author',
      genre: volumeInfo.categories?.[0] || 'General',
      cover: {
        small: smallCover,
        medium: mediumCover
      },
      api: 'google'
    };
  } catch {
    return null;
  }
}

// Fetch book info from Naver Books API (via backend proxy)
async function fetchBookInfoFromNaver(isbn: string, bookTitle: string): Promise<BookData | null> {
  if (!isbn) return null;

  try {
    const response = await fetch(
      `/api/books/naver/search?query=${encodeURIComponent(isbn)}`
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.items || data.items.length === 0) return null;

    const item = data.items[0];
    const coverUrl = item.image || '';

    return {
      title: item.title?.replace(/<[^>]*>/g, '') || bookTitle,
      isbn: isbn,
      author: item.author?.replace(/<[^>]*>/g, '') || 'Unknown Author',
      genre: 'General', // Naver API doesn't provide category in simple search
      cover: {
        small: coverUrl,
        medium: coverUrl  // Naver only provides one size
      },
      api: 'naver'
    };
  } catch {
    return null;
  }
}

// Fetch book info based on API type
async function fetchBookInfoByAPI(
  isbn: string,
  bookTitle: string,
  apiType: 'google' | 'naver' = 'google'
): Promise<BookData | null> {
  if (apiType === 'naver') {
    return fetchBookInfoFromNaver(isbn, bookTitle);
  }
  return fetchBookInfoFromGoogle(isbn, bookTitle);
}

// Generate book cover placeholder SVG
function generateBookCoverPlaceholder(title: string): string {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
  const colorIndex = (title.charCodeAt(0) || 0) % colors.length;
  const bgColor = colors[colorIndex];

  // Truncate title if too long
  const displayTitle = title.length > 30 ? title.slice(0, 27) + '...' : title;
  const lines = displayTitle.match(/.{1,15}/g) || [displayTitle];

  const textElements = lines.map((line, i) =>
    `<text x="50%" y="${45 + i * 12}%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="11" font-weight="500">${line}</text>`
  ).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="224" height="320" viewBox="0 0 224 320">
    <rect width="224" height="320" fill="${bgColor}" rx="8"/>
    <rect x="15" y="15" width="194" height="290" fill="rgba(255,255,255,0.1)" rx="4"/>
    ${textElements}
    <text x="50%" y="85%" dominant-baseline="middle" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-family="Arial, sans-serif" font-size="10">BookClub</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Get background based on grid position (ensures no adjacent cards have same background)
// For 3x3 grid with 5 backgrounds, using index % 5 guarantees no horizontal/vertical adjacency
function getPostBackground(index: number): string {
  return POST_BACKGROUNDS[index % POST_BACKGROUNDS.length];
}

// Generate placeholder avatar
function generateAvatar(name: string | null | undefined): string {
  const safeName = name && name.trim() ? name.trim() : 'U';
  const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
  const colorIndex = safeName.charCodeAt(0) % colors.length;
  const initial = safeName.charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <rect width="40" height="40" fill="${colors[colorIndex]}" rx="20"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-family="Arial" font-size="18" font-weight="bold">${initial}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Convert Post to Room (uses stored book info from Post)
function postToRoom(
  post: Post,
  currentUserId: string | undefined,
  hostUsername: string,
  activeParticipants: number = 0
): Room {
  // Use stored bookData from Post (no legacy fallback)
  const bookTitle = post.bookData?.title || 'Unknown Book';
  const bookIsbn = post.bookData?.isbn || '';
  const bookCover = post.bookData?.cover;
  const bookInfo = {
    author: post.bookData?.author || 'Unknown Author',
    genre: post.bookData?.genre || 'General',
    cover: typeof bookCover === 'string'
      ? { small: bookCover, medium: bookCover }  // Legacy string support
      : (bookCover || { small: '', medium: '' })
  };
  const now = new Date();
  const dueDate = new Date(post.due);
  const duration = post.duration || 60;
  const endDate = new Date(dueDate.getTime() + duration * 60 * 1000);

  let status: 'live' | 'upcoming' | 'past' | 'waiting';
  if (post.end?.ended) {
    status = 'past';
  } else if (activeParticipants > 0) {
    status = 'live';
  } else if (now > endDate) {
    status = 'past';
  } else if (now >= dueDate) {
    status = 'waiting';
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

  const placeholder = generateBookCoverPlaceholder(bookTitle);
  return {
    id: post.id,
    title: `${bookTitle} Discussion`,
    host: hostUsername || 'Unknown',
    hostAvatar: generateAvatar(hostUsername),
    book: {
      title: bookTitle,
      author: bookInfo.author,
      cover: {
        small: bookInfo.cover.small || placeholder,
        medium: bookInfo.cover.medium || placeholder
      },
      genre: bookInfo.genre,
      isbn: bookIsbn
    },
    dueISO: post.due,
    duration: post.duration || 60,
    participants: post.memberIds?.length || 0,
    maxParticipants: post.capacity,
    level: post.level,
    description: post.description || `Join us for an engaging discussion about "${bookTitle}". Share your insights and connect with fellow readers.`,
    tags: post.tags && post.tags.length > 0 ? post.tags : tags,
    status,
    activeParticipants,
    isJoined: currentUserId ? (post.memberIds?.includes(currentUserId) || post.createrId === currentUserId) : false,
    isMyRoom: currentUserId ? post.createrId === currentUserId : false,
    meetLink: post.meetLink,
    calendarEventId: post.calendarEventId,
    recruit: post.recruit !== undefined ? post.recruit : true,
    api: post.bookData?.api as 'google' | 'naver' | undefined
  };
}

// =============================================================================
// Types
// =============================================================================

type TabType = 'all' | 'my' | 'joined' | 'ended';
type StatusFilter = 'all' | 'live' | 'upcoming' | 'past' | 'waiting';
type SortBy = 'createdAt' | 'dueDate' | 'remainingSpots';
type SortOrder = 'asc' | 'desc';

// =============================================================================
// Component
// =============================================================================

const Board: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { accessToken, user } = useAuth();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  // Zustand store - select stable references directly
  const {
    byId,
    order,
    roomStatuses,
    isInitialLoading,
    connectionUnstable,
    initBoard,
    refreshNow,
    startPolling,
    stopPolling,
    scheduleNextPoll,
    removePost: removePostFromStore,
    updatePost: updatePostInStore,
  } = useBoardStore();

  // Compute allPosts with useMemo to avoid infinite loop
  const allPosts = useMemo(() => {
    return order.map((id) => byId[id]).filter(Boolean);
  }, [byId, order]);

  // Local UI state
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [isFetchingNext, setIsFetchingNext] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [showEndedMeetings, setShowEndedMeetings] = useState(false);
  const [isEndedSectionClosing, setIsEndedSectionClosing] = useState(false);
  const [userCount, setUserCount] = useState<number>(0);
  const [isScrollingDown, setIsScrollingDown] = useState(false);

  // Search debounce timer
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollY = useRef(0);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const tabsSectionRef = useRef<HTMLElement>(null);

  // ==========================================================================
  // URL Params Handling
  // ==========================================================================
  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter === 'created') {
      setActiveTab('my');
    } else if (filter === 'participating') {
      setActiveTab('joined');
    }
  }, [searchParams]);

  // ==========================================================================
  // Set Tabs Section Height as CSS Variable
  // ==========================================================================
  useEffect(() => {
    const updateTabsHeight = () => {
      if (tabsSectionRef.current && stickyHeaderRef.current) {
        const height = tabsSectionRef.current.offsetHeight;
        stickyHeaderRef.current.style.setProperty('--tabs-height', `${height}px`);
      }
    };

    updateTabsHeight();
    window.addEventListener('resize', updateTabsHeight);
    return () => window.removeEventListener('resize', updateTabsHeight);
  }, []);

  // ==========================================================================
  // Scroll Direction Detection for Sticky Header
  // ==========================================================================
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTransitioningRef = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      // Ignore scroll events during transition
      if (isTransitioningRef.current) return;

      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollY.current;

      // Only trigger after significant scroll (50px threshold)
      if (Math.abs(scrollDelta) < 50) return;

      // At top of page - always show tabs
      if (currentScrollY < 100) {
        if (isScrollingDown) {
          isTransitioningRef.current = true;
          setIsScrollingDown(false);
          setTimeout(() => { isTransitioningRef.current = false; }, 350);
        }
        lastScrollY.current = currentScrollY;
        return;
      }

      // Clear any pending timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Debounce the state change
      scrollTimeoutRef.current = setTimeout(() => {
        if (scrollDelta > 50 && !isScrollingDown) {
          // Scrolling down
          isTransitioningRef.current = true;
          setIsScrollingDown(true);
          setTimeout(() => { isTransitioningRef.current = false; }, 350);
        } else if (scrollDelta < -50 && isScrollingDown) {
          // Scrolling up
          isTransitioningRef.current = true;
          setIsScrollingDown(false);
          setTimeout(() => { isTransitioningRef.current = false; }, 350);
        }
        lastScrollY.current = window.scrollY;
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [isScrollingDown]);

  // ==========================================================================
  // Fetch User Count
  // ==========================================================================
  useEffect(() => {
    const fetchUserCount = async () => {
      const count = await getUserCount();
      setUserCount(count);
    };
    fetchUserCount();
  }, []);

  // ==========================================================================
  // Initial Load & Polling
  // ==========================================================================
  useEffect(() => {
    // Load posts even without login (public access)
    initBoard(accessToken || undefined, user?.id);

    if (accessToken) {
      startPolling(accessToken, user?.id);
    }

    return () => {
      stopPolling();
    };
  }, [accessToken, user?.id, initBoard, startPolling, stopPolling]);

  // ==========================================================================
  // Visibility & Focus Event Handlers (for instant refresh + timer reset)
  // ==========================================================================
  useEffect(() => {
    if (!accessToken) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshNow('visibility-change', accessToken, user?.id);
        scheduleNextPoll(accessToken, user?.id);
      }
    };

    const handleFocus = () => {
      refreshNow('window-focus', accessToken, user?.id);
      scheduleNextPoll(accessToken, user?.id);
    };

    const handleOnline = () => {
      refreshNow('online', accessToken, user?.id);
      scheduleNextPoll(accessToken, user?.id);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [accessToken, user?.id, refreshNow, scheduleNextPoll]);

  // ==========================================================================
  // Search Debounce
  // ==========================================================================
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      // Reset pagination when search changes
      setDisplayCount(PAGE_SIZE);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchQuery]);

  // Reset pagination when filters change
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [activeTab, selectedGenre, selectedStatus, sortBy, sortOrder]);

  // ==========================================================================
  // Convert Posts to Rooms (with book info lookup)
  // ==========================================================================
  useEffect(() => {
    const convertPostsToRooms = async () => {
      if (allPosts.length === 0) {
        setRooms([]);
        return;
      }

      const roomPromises = allPosts.map(async (post) => {
        // Fetch host username (with cache)
        let hostUsername = 'Unknown';
        if (post.createrId) {
          if (hostUsernameCache.has(post.createrId)) {
            hostUsername = hostUsernameCache.get(post.createrId)!;
          } else if (accessToken) {
            try {
              const hostUser = await getUserById(post.createrId, accessToken);
              hostUsername = hostUser.username;
              hostUsernameCache.set(post.createrId, hostUsername);
            } catch (error) {
              console.error('Failed to fetch host username:', error);
            }
          }
        }

        // bookData에 cover/author 등이 누락된 경우 ISBN으로 조회 후 업데이트
        const needsBookInfoUpdate = post.bookData?.isbn &&
          (!post.bookData?.cover || !post.bookData?.author) &&
          !bookInfoUpdateInProgress.has(post.id);

        if (needsBookInfoUpdate && accessToken) {
          bookInfoUpdateInProgress.add(post.id);
          try {
            const apiType = post.bookData?.api || 'google';
            const bookInfo = await fetchBookInfoByAPI(
              post.bookData!.isbn!,
              post.bookData?.title || 'Unknown Book',
              apiType
            );
            if (bookInfo) {
              // 백그라운드에서 Post 업데이트 (UI에는 즉시 반영)
              updatePostBookData(post.id, bookInfo, accessToken)
                .then(() => {
                  console.log(`Updated bookData for post ${post.id}`);
                })
                .catch((err) => {
                  console.error(`Failed to update bookData for post ${post.id}:`, err);
                })
                .finally(() => {
                  bookInfoUpdateInProgress.delete(post.id);
                });
              // 현재 렌더링에는 fetch한 데이터 사용
              post.bookData = bookInfo;
            }
          } catch (error) {
            console.error('Failed to fetch book info:', error);
            bookInfoUpdateInProgress.delete(post.id);
          }
        }

        const activeParticipants = roomStatuses[post.id]?.activeParticipants || 0;
        return postToRoom(post, user?.id, hostUsername, activeParticipants);
      });

      const convertedRooms = await Promise.all(roomPromises);
      setRooms(convertedRooms);
    };

    if (!isInitialLoading) {
      convertPostsToRooms();
    }
  }, [allPosts, roomStatuses, user?.id, accessToken, isInitialLoading]);

  // ==========================================================================
  // Filter & Sort Logic - Applied BEFORE pagination
  // ==========================================================================
  const genres = useMemo(() => {
    const genreSet = new Set<string>();
    rooms.forEach(room => {
      if (room.book.genre && room.book.genre !== 'General') {
        genreSet.add(room.book.genre);
      }
    });
    return Array.from(genreSet).sort();
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    let result = [...rooms];

    // Language-based API filter (KR → Naver, EN → Google)
    // Posts without api field are shown in all languages (legacy support)
    const currentLang = i18n.language;
    const targetApi = currentLang === 'ko' ? 'naver' : 'google';
    result = result.filter(room => !room.api || room.api === targetApi);

    // Tab filter
    if (activeTab === 'my') {
      // 내 토론방: 종료된 미팅은 별도 섹션에서 표시
      result = result.filter(room => room.isMyRoom && room.status !== 'past');
    } else if (activeTab === 'joined') {
      // 참여 중: 종료된 미팅은 별도 섹션에서 표시
      result = result.filter(room => room.isJoined && !room.isMyRoom && room.status !== 'past');
    } else if (activeTab === 'ended') {
      // 종료된 토론방: 내가 참여했던 종료된 미팅만
      result = result.filter(room => (room.isJoined || room.isMyRoom) && room.status === 'past');
    } else {
      // 전체 탭: 종료된 미팅은 표시하지 않음
      result = result.filter(room => room.status !== 'past');
    }

    // Search filter
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
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

    // Sort with order
    const multiplier = sortOrder === 'asc' ? 1 : -1;
    switch (sortBy) {
      case 'createdAt':
        // Sort by post creation date (using dueISO as proxy, ideally use createdAt)
        result.sort((a, b) => {
          const postA = allPosts.find(p => p.id === a.id);
          const postB = allPosts.find(p => p.id === b.id);
          const dateA = postA?.date ? new Date(postA.date).getTime() : 0;
          const dateB = postB?.date ? new Date(postB.date).getTime() : 0;
          return (dateB - dateA) * multiplier;
        });
        break;
      case 'dueDate':
        // Sort by due date
        result.sort((a, b) => {
          const dateA = new Date(a.dueISO).getTime();
          const dateB = new Date(b.dueISO).getTime();
          return (dateA - dateB) * multiplier;
        });
        break;
      case 'remainingSpots':
        // Sort by remaining spots (capacity - participants)
        result.sort((a, b) => {
          const remainingA = a.maxParticipants - a.participants;
          const remainingB = b.maxParticipants - b.participants;
          return (remainingA - remainingB) * multiplier;
        });
        break;
    }

    return result;
  }, [rooms, activeTab, debouncedSearch, selectedGenre, selectedStatus, sortBy, sortOrder, i18n.language, allPosts]);

  // Apply pagination AFTER filtering
  const displayedRooms = useMemo(() => {
    return filteredRooms.slice(0, displayCount);
  }, [filteredRooms, displayCount]);

  const hasMore = filteredRooms.length > displayCount;

  // 종료된 미팅 필터링 (내 토론방 / 참여 중 탭에서만 사용)
  const endedMeetings = useMemo(() => {
    if (activeTab === 'all') return [];

    let result = [...rooms];

    // Language-based API filter
    const currentLang = i18n.language;
    const targetApi = currentLang === 'ko' ? 'naver' : 'google';
    result = result.filter(room => !room.api || room.api === targetApi);

    // Tab filter + 종료된 미팅만
    if (activeTab === 'my') {
      result = result.filter(room => room.isMyRoom && room.status === 'past');
    } else if (activeTab === 'joined') {
      result = result.filter(room => room.isJoined && !room.isMyRoom && room.status === 'past');
    }

    // Sort by latest
    result.sort((a, b) => new Date(b.dueISO).getTime() - new Date(a.dueISO).getTime());

    return result;
  }, [rooms, activeTab, i18n.language]);

  // ==========================================================================
  // Infinite Scroll with IntersectionObserver
  // ==========================================================================
  const loadMore = useCallback(() => {
    if (isFetchingNext || !hasMore) return;

    setIsFetchingNext(true);
    // Small delay to show loading indicator
    setTimeout(() => {
      setDisplayCount(prev => prev + PAGE_SIZE);
      setIsFetchingNext(false);
    }, 100);
  }, [isFetchingNext, hasMore]);

  useEffect(() => {
    if (!sentinelRef.current || isInitialLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isFetchingNext) {
          loadMore();
        }
      },
      {
        root: null,
        rootMargin: '200px',
        threshold: 0,
      }
    );

    observer.observe(sentinelRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isFetchingNext, isInitialLoading, loadMore]);

  // ==========================================================================
  // Filter Change Handlers
  // ==========================================================================
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'ended') {
      setShowEndedMeetings(true);
    } else {
      setShowEndedMeetings(false);
      setIsEndedSectionClosing(false);
    }
    if (accessToken) {
      refreshNow('tab-change', accessToken, user?.id);
      scheduleNextPoll(accessToken, user?.id);
    }
  }, [accessToken, user?.id, refreshNow, scheduleNextPoll]);

  const handleSortChange = useCallback((sort: SortBy) => {
    if (sortBy === sort) {
      // Toggle order if same sort is clicked
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(sort);
      setSortOrder('desc'); // Default to descending for new sort
    }
    if (accessToken) {
      refreshNow('sort-change', accessToken, user?.id);
      scheduleNextPoll(accessToken, user?.id);
    }
  }, [accessToken, user?.id, refreshNow, scheduleNextPoll, sortBy]);

  // Toggle ended meetings section with animation
  const handleToggleEndedMeetings = useCallback(() => {
    if (showEndedMeetings) {
      // Closing: scroll so hero is hidden (hero bottom at viewport top)
      if (heroRef.current) {
        const heroBottom = heroRef.current.getBoundingClientRect().bottom + window.scrollY;
        window.scrollTo({ top: heroBottom, behavior: 'smooth' });
      }
      setIsEndedSectionClosing(true);
      setTimeout(() => {
        setShowEndedMeetings(false);
        setIsEndedSectionClosing(false);
      }, 500); // Match animation duration
    } else {
      // Opening
      setShowEndedMeetings(true);
    }
  }, [showEndedMeetings]);

  // ==========================================================================
  // Action Handlers
  // ==========================================================================
  const handleScrollToGrid = () => {
    tabsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleJoin = useCallback(async (roomId: string) => {
    if (!accessToken || !user?.id) return;

    setIsProcessing(true);
    try {
      const updatedPost = await joinBookMeeting(roomId, user.id, accessToken);
      updatePostInStore(updatedPost);
      setSelectedRoom(null);
      refreshNow('user-action', accessToken, user.id);
      scheduleNextPoll(accessToken, user.id);
    } catch (err) {
      console.error('Error joining meeting:', err);
      alert(t('board_join_error'));
    } finally {
      setIsProcessing(false);
    }
  }, [accessToken, user?.id, updatePostInStore, refreshNow, scheduleNextPoll, t]);

  const handleDelete = useCallback(async (roomId: string) => {
    if (!accessToken) return;

    setIsProcessing(true);
    try {
      await deletePost(roomId, accessToken);
      removePostFromStore(roomId);
      setSelectedRoom(null);
      refreshNow('user-action', accessToken, user?.id);
      scheduleNextPoll(accessToken, user?.id);
    } catch (err) {
      console.error('Error deleting room:', err);
      alert(t('board_delete_error'));
    } finally {
      setIsProcessing(false);
    }
  }, [accessToken, user?.id, removePostFromStore, refreshNow, scheduleNextPoll, t]);

  const handleUpdate = useCallback(async () => {
    if (!accessToken) return;
    refreshNow('post-update', accessToken, user?.id);
    scheduleNextPoll(accessToken, user?.id);
  }, [accessToken, user?.id, refreshNow, scheduleNextPoll]);

  // ==========================================================================
  // Utility Functions
  // ==========================================================================
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

  // ==========================================================================
  // Handle Room Click (requires login for details)
  // ==========================================================================
  const handleRoomClick = useCallback((room: Room) => {
    if (!accessToken) {
      navigate('/login');
      return;
    }
    setSelectedRoom(room);
  }, [accessToken, navigate]);

  // ==========================================================================
  // Render: Main Content
  // ==========================================================================
  return (
    <div className="board-page">
      {/* Connection Unstable Banner */}
      {connectionUnstable && (
        <div className="board-connection-banner">
          <FiWifiOff size={16} />
          <span>{t('browse_connection_unstable') || 'Connection unstable'}</span>
        </div>
      )}

      {/* Hero Section */}
      <section className="board-hero" ref={heroRef}>
        {/* Background Decorations */}
        <div className="hero-bg-decorations">
          <div className="hero-bg-gradient hero-bg-gradient-1"></div>
          <div className="hero-bg-gradient hero-bg-gradient-2"></div>
          <div className="hero-floating-icon hero-floating-icon-1">
            <i className="ri-book-2-line"></i>
          </div>
          <div className="hero-floating-icon hero-floating-icon-2">
            <i className="ri-book-open-line"></i>
          </div>
          <div className="hero-floating-icon hero-floating-icon-3">
            <i className="ri-bookmark-line"></i>
          </div>
          <div className="hero-floating-icon hero-floating-icon-4">
            <i className="ri-quill-pen-line"></i>
          </div>
          <div className="hero-dot-pattern"></div>
        </div>
        <div className="board-hero-content">
          <div className="board-hero-badge">
            <div className="badge-pulse-dot">
              <div className="pulse-dot"></div>
              <div className="pulse-ping"></div>
            </div>
            <span className="badge-text">{t('browse_hero_badge')}</span>
            <div className="badge-divider"></div>
            <div className="badge-readers">
              <i className="ri-user-line"></i>
              <span className='badge-text-counter'>{userCount.toLocaleString()} {t('browse_stat_readers')}</span>
            </div>
          </div>
          <div className='board-title-wrap'>
            <h1 className="board-hero-title-1">
              {t('browse_hero_title_1')}
            </h1>
            <h1 className="board-hero-title-2">
              {t('browse_hero_title_2')}
            </h1>
            <h1 className="board-hero-title-3">
              {t('browse_hero_title_3')}
            </h1>
          </div>
          <div className='board-hero-subtitle-wrap'>
            <p className="board-hero-subtitle">
              {t('browse_hero_subtitle')}
            </p>
          </div>
          <div className="board-hero-cta">
            <button className="board-cta-primary" onClick={() => navigate('/create')}>
              <div className="cta-content">
                <i className="ri-add-circle-line cta-icon"></i>
                <span>{t('browse_hero_cta_create')}</span>
                <i className="ri-arrow-right-line cta-icon arrow"></i>
              </div>
            </button>
            <button className="board-cta-secondary" onClick={handleScrollToGrid}>
              <div className="cta-content">
                <i className="ri-compass-3-line cta-icon compass"></i>
                <span>{t('browse_hero_cta_browse')}</span>
              </div>
            </button>
          </div>

          {/* Feature Badges */}
          <div className="board-hero-features">
            <div className="feature-badge">
              <div className="feature-icon">
                <i className="ri-shield-check-line"></i>
              </div>
              <span>{t('browse_feature_no_subscription')}</span>
            </div>
            <div className="feature-badge">
              <div className="feature-icon feature-icon-secondary">
                <i className="ri-robot-2-line"></i>
              </div>
              <span>{t('browse_feature_ai_insights')}</span>
            </div>
            <div className="feature-badge">
              <div className="feature-icon feature-icon-primary">
                <i className="ri-calendar-check-line"></i>
              </div>
              <span>{t('browse_feature_one_time')}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="board-stats">
          <div className="board-stat-card">
            <div className="stat-hover-bg stat-bg-primary"></div>
            <div className="stat-content">
              <div className="stat-icon-wrapper stat-icon-primary">
                <i className="ri-group-line"></i>
              </div>
              <div className="stat-value">{userCount.toLocaleString()}+</div>
              <div className="stat-label">{t('browse_stat_readers_grid')}</div>
              <div className="stat-subtitle">{t('browse_stat_readers_sub')}</div>
            </div>
          </div>
          <div className="board-stat-card">
            <div className="stat-hover-bg stat-bg-secondary"></div>
            <div className="stat-content">
              <div className="stat-icon-wrapper stat-icon-secondary">
                <i className="ri-book-open-line"></i>
              </div>
              <div className="stat-value">5,000+</div>
              <div className="stat-label">{t('browse_stat_discussions')}</div>
              <div className="stat-subtitle">{t('browse_stat_discussions_sub')}</div>
            </div>
          </div>
          <div className="board-stat-card">
            <div className="stat-hover-bg stat-bg-accent"></div>
            <div className="stat-content">
              <div className="stat-icon-wrapper stat-icon-accent">
                <i className="ri-star-fill"></i>
              </div>
              <div className="stat-value">4.9</div>
              <div className="stat-label">{t('browse_stat_rating')}</div>
              <div className="stat-stars">
                <i className="ri-star-fill"></i>
                <i className="ri-star-fill"></i>
                <i className="ri-star-fill"></i>
                <i className="ri-star-fill"></i>
                <i className="ri-star-fill"></i>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Header - Tabs + Filters */}
      <div
        className={`board-sticky-header ${isScrollingDown ? 'scrolling-down' : ''}`}
        ref={stickyHeaderRef}
      >
        {/* Tabs Section - Above Filter */}
        <section className="board-tabs-section" ref={tabsSectionRef}>
          <div className="board-tabs-container">
            <button
              className={`board-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => handleTabChange('all')}
            >
              <i className="ri-grid-line"></i>
              <span>{t('browse_tab_all')}</span>
            </button>
            <button
              className={`board-tab-btn ${activeTab === 'my' ? 'active' : ''} ${!accessToken ? 'disabled' : ''}`}
              onClick={() => accessToken ? handleTabChange('my') : navigate('/login')}
              disabled={!accessToken}
            >
              <i className="ri-user-line"></i>
              <span>{t('browse_tab_my')}</span>
            </button>
            <button
              className={`board-tab-btn ${activeTab === 'joined' ? 'active' : ''} ${!accessToken ? 'disabled' : ''}`}
              onClick={() => accessToken ? handleTabChange('joined') : navigate('/login')}
              disabled={!accessToken}
            >
              <i className="ri-group-line"></i>
              <span>{t('browse_tab_joined')}</span>
            </button>
            <button
              className={`board-tab-btn ${activeTab === 'ended' ? 'active' : ''} ${!accessToken ? 'disabled' : ''}`}
              onClick={() => accessToken ? handleTabChange('ended') : navigate('/login')}
              disabled={!accessToken}
            >
              <i className="ri-archive-line"></i>
              <span>{t('browse_tab_ended')}</span>
            </button>
          </div>
        </section>

        {/* Filter Section */}
        <section className="board-filters">
          <div className='board-filters-container-wrapper'>
            <div className="board-filters-container">
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

              {/* Filter Row */}
              <div className="board-filter-row">
                {/* Left: Genre Dropdown */}
                <div className="board-filter-left">
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
                </div>

                {/* Right: Sort Buttons */}
                <div className="board-sort-buttons">
                  <span className="board-sort-label">{t('browse_sort_label')}</span>
                  <button
                    className={`board-sort-btn ${sortBy === 'createdAt' ? 'active' : ''}`}
                    onClick={() => handleSortChange('createdAt')}
                  >
                    {t('browse_sort_created')}
                    {sortBy === 'createdAt' && (
                      sortOrder === 'asc' ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />
                    )}
                  </button>
                  <button
                    className={`board-sort-btn ${sortBy === 'dueDate' ? 'active' : ''}`}
                    onClick={() => handleSortChange('dueDate')}
                  >
                    {t('browse_sort_due_date')}
                    {sortBy === 'dueDate' && (
                      sortOrder === 'asc' ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />
                    )}
                  </button>
                  <button
                    className={`board-sort-btn ${sortBy === 'remainingSpots' ? 'active' : ''}`}
                    onClick={() => handleSortChange('remainingSpots')}
                  >
                    {t('browse_sort_remaining')}
                    {sortBy === 'remainingSpots' && (
                      sortOrder === 'asc' ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Rooms Grid */}
      <section className="board-rooms">
        {isInitialLoading ? (
          // Skeleton cards for initial loading only
          <div className="board-grid">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={`skeleton-${index}`} className="room-card skeleton">
                <div className="room-card-cover skeleton-cover">
                  <div className="skeleton-image" />
                </div>
                <div className="room-card-content">
                  <div className="skeleton-title" />
                  <div className="skeleton-text" />
                  <div className="skeleton-host">
                    <div className="skeleton-avatar" />
                    <div className="skeleton-text-short" />
                  </div>
                  <div className="skeleton-meta">
                    <div className="skeleton-text-short" />
                    <div className="skeleton-text-short" />
                  </div>
                  <div className="skeleton-button" />
                </div>
              </div>
            ))}
          </div>
        ) : displayedRooms.length === 0 ? (
          <div className="board-empty">
            <FiBookOpen size={48} />
            <h3>{t('browse_no_rooms')}</h3>
            <p>{t('browse_no_rooms_desc')}</p>
            <button className="board-create-btn" onClick={() => navigate('/create')}>
              {t('browse_hero_cta_create')}
            </button>
          </div>
        ) : (
          <>
            <div className="board-grid">
              {displayedRooms.map((room, index) => (
                <div
                  key={room.id}
                  className="room-card"
                  onClick={() => handleRoomClick(room)}
                >
                  {/* Cover - 3D Book Effect */}
                  <div
                    className="room-card-cover"
                    style={{
                      backgroundImage: `url(${getPostBackground(index)})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  >
                    <div className="book-container">
                      <div className="book">
                        <div className="book-front">
                          <div className="book-cover">
                            <img
                              src={room.book.cover.small || room.book.cover.medium || generateBookCoverPlaceholder(room.book.title)}
                              alt={room.book.title}
                              loading="lazy"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (!target.src.startsWith('data:image/svg+xml')) {
                                  target.src = generateBookCoverPlaceholder(room.book.title);
                                }
                              }}
                            />
                            <p className="book-author">{room.book.author}</p>
                          </div>
                        </div>
                        <div className="book-left-side">
                          <h2 style={{ display: 'flex', justifyContent: 'space-around' }}>
                            <span>{room.book.title}</span>
                            <span>{room.book.author}</span>
                            <span>Mamalias</span>
                          </h2>
                        </div>
                      </div>
                    </div>
                    <span className={`room-status-badge ${room.status}`}>
                      {room.status === 'live' && <span className="live-dot"></span>}
                      {room.status === 'live'
                        ? t('browse_card_live')
                        : room.status === 'waiting'
                          ? t('browse_card_waiting')
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
                        if (!accessToken) {
                          navigate('/login');
                          return;
                        }
                        if (room.isJoined || room.isMyRoom) {
                          setSelectedRoom(room);
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
                          : room.status === 'live' || room.status === 'waiting'
                            ? t('browse_card_join_now')
                            : t('browse_card_reserve')
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} className="board-sentinel">
              {isFetchingNext && (
                <div className="board-loading-more">
                  <div className="board-loading-spinner small"></div>
                </div>
              )}
              {hasMore && !isFetchingNext && (
                <div className="board-load-more-hint">
                  {/* Optional: visible hint for more content */}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* Ended Meetings Section - 별도 섹션은 ended 탭에서만 사용 안함 */}
      {(activeTab === 'my' || activeTab === 'joined') && endedMeetings.length > 0 && showEndedMeetings && (
        <section className={`board-ended-section ${isEndedSectionClosing ? 'closing' : showEndedMeetings ? 'open' : 'closed'}`}>
          <div className="board-ended-content">
            <div className="board-ended-content-inner">
              <div className="board-ended-header">
              <h2>{t('browse_ended_meetings') || '종료된 북미팅'}</h2>
              <span className="board-ended-count">{endedMeetings.length}개</span>
            </div>
            <div className="board-grid ended">
              {endedMeetings.map((room, index) => (
                <div
                  key={room.id}
                  className="room-card ended"
                  onClick={() => handleRoomClick(room)}
                >
                  {/* Cover */}
                  <div
                    className="room-card-cover"
                    style={{
                      backgroundImage: `url(${getPostBackground(index)})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  >
                    <div className="book-container">
                      <div className="book">
                        <div className="book-front">
                          <div className="book-cover">
                            <img
                              src={room.book.cover.small || room.book.cover.medium || generateBookCoverPlaceholder(room.book.title)}
                              alt={room.book.title}
                              loading="lazy"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                if (!target.src.startsWith('data:image/svg+xml')) {
                                  target.src = generateBookCoverPlaceholder(room.book.title);
                                }
                              }}
                            />
                            <p className="book-author">{room.book.author}</p>
                          </div>
                        </div>
                        <div className="book-left-side">
                          <h2 style={{ display: 'flex', justifyContent: 'space-around' }}>
                            <span>{room.book.title}</span>
                            <span>{room.book.author}</span>
                            <span>Mamalias</span>
                          </h2>
                        </div>
                      </div>
                    </div>
                    <span className="room-status-badge past">
                      {t('browse_card_past')}
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
                      className="room-card-btn past joined"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRoom(room);
                      }}
                    >
                      {t('browse_card_view_details')}
                    </button>
                  </div>
                </div>
              ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Room Modal */}
      {selectedRoom && (
        <RoomModal
          room={selectedRoom}
          onClose={() => setSelectedRoom(null)}
          onJoin={handleJoin}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
};

export default Board;
