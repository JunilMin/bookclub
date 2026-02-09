import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createPost, Post, JoinType } from '../api/posts';
import { searchGoogleBooks, searchNaverBooks, BookSearchResult, getBookByISBN } from '../api/bookSearch';
import { useAuth } from '../AuthContext/AuthContext';
import { getMyMeetings, MeetingSummary } from '../api/user';
import { useBoardStore } from '../store/boardStore';
import './styles/PostCreate.css';

// 시간 충돌 정보 인터페이스
interface TimeConflict {
  meeting: MeetingSummary;
  type: 'created' | 'participated';
}

type BookLanguage = 'en' | 'kr';
type DiscussionType = 'voice' | 'text';
type RoomVisibility = 'public' | 'invite';
type DiscussionLength = '30' | '45' | '60' | '90';

interface PostCreateForm {
  bookLanguage: BookLanguage;
  selectedBook: BookSearchResult | null;
  discussionType: DiscussionType;
  date: string;
  time: string;
  capacity: number;
  level: 'low' | 'moderate' | 'high';
  discussionLength: DiscussionLength;
  roomVisibility: RoomVisibility;
  joinType: JoinType;
  aiSummary: boolean;
  aiModerator: boolean;
  description: string;
  tags: string[];
  newTag: string;
}

const PostCreate: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, accessToken, isGoogleLinked, refreshGoogleAccessToken } = useAuth();
  const addPost = useBoardStore((state) => state.addPost);

  const defaultBookLanguage: BookLanguage = i18n.language === 'ko' ? 'kr' : 'en';

  const [form, setForm] = useState<PostCreateForm>({
    bookLanguage: defaultBookLanguage,
    selectedBook: null,
    discussionType: 'voice',
    date: '',
    time: '',
    capacity: 5,
    level: 'moderate',
    discussionLength: '60',
    roomVisibility: 'public',
    joinType: 'OPEN',
    aiSummary: true,
    aiModerator: false,
    description: '',
    tags: [],
    newTag: '',
  });

  const [bookSearch, setBookSearch] = useState('');
  const [bookResults, setBookResults] = useState<BookSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 시간 충돌 관련 상태
  const [myMeetings, setMyMeetings] = useState<{ created: MeetingSummary[]; participated: MeetingSummary[] } | null>(null);
  const [conflictModal, setConflictModal] = useState<{
    show: boolean;
    conflicts: TimeConflict[];
  }>({ show: false, conflicts: [] });

  const today = new Date().toISOString().split('T')[0];

  // 내 미팅 목록 로드
  useEffect(() => {
    const loadMyMeetings = async () => {
      if (!accessToken) return;
      try {
        const meetings = await getMyMeetings(accessToken);
        setMyMeetings(meetings);
      } catch (error) {
        console.error('Failed to load my meetings:', error);
      }
    };
    loadMyMeetings();
  }, [accessToken]);

  // Auto-resize textarea based on content
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [form.description]);

  // Load book by ISBN from navigation state
  useEffect(() => {
    const state = location.state as { isbn?: string; bookInfo?: BookSearchResult } | null;

    // bookInfo가 직접 전달된 경우 (Favorites 페이지에서 이동)
    if (state?.bookInfo) {
      const book = state.bookInfo;
      // Auto-populate tags from book categories
      const autoTags = book.categories && book.categories.length > 0
        ? book.categories.slice(0, 5)
        : [];
      setForm(prev => ({
        ...prev,
        selectedBook: book,
        description: book.description || '',
        tags: autoTags,
      }));
      window.history.replaceState({}, document.title);
      return;
    }

    // ISBN만 있는 경우 API 호출
    if (state?.isbn) {
      const loadBookByISBN = async () => {
        setIsSearching(true);
        try {
          const book = await getBookByISBN(state.isbn!);
          if (book) {
            // Auto-populate tags from book categories
            const autoTags = book.categories && book.categories.length > 0
              ? book.categories.slice(0, 5)
              : [];
            setForm(prev => ({
              ...prev,
              selectedBook: book,
              description: book.description || '',
              tags: autoTags,
            }));
          }
        } catch (error) {
          console.error('Failed to load book by ISBN:', error);
        } finally {
          setIsSearching(false);
        }
      };
      loadBookByISBN();
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Book search with debounce
  const searchBooksRef = React.useRef<(query: string, lang: BookLanguage) => Promise<void>>();

  searchBooksRef.current = async (query: string, lang: BookLanguage) => {
    if (!query.trim()) {
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      let results: BookSearchResult[];
      if (lang === 'en') {
        results = await searchGoogleBooks(query);
      } else {
        results = await searchNaverBooks(query);
      }
      // Only update if we got results and search query hasn't changed
      if (query === bookSearch) {
        setBookResults(results);
      }
    } catch (error: any) {
      console.error('Book search error:', error);
      if (query === bookSearch) {
        setBookResults([]);
        setSearchError('검색 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (!bookSearch.trim()) {
      setBookResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    // 타이핑 즉시 검색 중 상태로 변경
    setIsSearching(true);

    const timer = setTimeout(() => {
      searchBooksRef.current?.(bookSearch, form.bookLanguage);
    }, 300);
    return () => clearTimeout(timer);
  }, [bookSearch, form.bookLanguage]);

  // Reset search when language changes
  useEffect(() => {
    setBookResults([]);
    setBookSearch('');
    setSearchError(null);
  }, [form.bookLanguage]);

  const handleBookSelect = (book: BookSearchResult) => {
    // Auto-populate tags from book categories
    const autoTags = book.categories && book.categories.length > 0
      ? book.categories.slice(0, 5) // Limit to 5 categories
      : [];

    setForm(prev => ({
      ...prev,
      selectedBook: book,
      description: book.description || '',
      tags: autoTags,
    }));
    setBookSearch('');
    setBookResults([]);
  };

  const handleAddTag = () => {
    if (form.newTag.trim() && !form.tags.includes(form.newTag.trim())) {
      setForm(prev => ({
        ...prev,
        tags: [...prev.tags, prev.newTag.trim()],
        newTag: '',
      }));
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };

  const handleClearBook = () => {
    setForm(prev => ({
      ...prev,
      selectedBook: null,
      description: '',
      tags: [],
    }));
  };

  // 시간 충돌 검증 함수
  const checkTimeConflicts = (): TimeConflict[] => {
    if (!myMeetings || !form.date || !form.time) return [];

    const conflicts: TimeConflict[] = [];
    const duration = parseInt(form.discussionLength);

    // 새 미팅 시작/종료 시간 계산
    const newMeetingStart = new Date(`${form.date}T${form.time}`);
    const newMeetingEnd = new Date(newMeetingStart.getTime() + duration * 60 * 1000);

    // 미팅 충돌 체크 헬퍼 함수
    const checkMeetingConflict = (meeting: MeetingSummary): boolean => {
      // 이미 종료된 미팅은 제외
      if (meeting.ended) return false;

      const meetingStart = new Date(meeting.due);
      // 미팅 기본 시간을 60분으로 가정 (duration이 없는 경우)
      const meetingDuration = 60; // TODO: meeting.duration이 있으면 사용
      const meetingEnd = new Date(meetingStart.getTime() + meetingDuration * 60 * 1000);

      // 시간이 겹치는지 확인
      // 새 미팅 시작이 기존 미팅 시간 내에 있거나
      // 새 미팅 종료가 기존 미팅 시간 내에 있거나
      // 새 미팅이 기존 미팅을 완전히 포함하는 경우
      const overlaps = (
        (newMeetingStart >= meetingStart && newMeetingStart < meetingEnd) ||
        (newMeetingEnd > meetingStart && newMeetingEnd <= meetingEnd) ||
        (newMeetingStart <= meetingStart && newMeetingEnd >= meetingEnd)
      );

      return overlaps;
    };

    // 생성한 미팅 체크
    myMeetings.created.forEach(meeting => {
      if (checkMeetingConflict(meeting)) {
        conflicts.push({ meeting, type: 'created' });
      }
    });

    // 참여 중인 미팅 체크
    myMeetings.participated.forEach(meeting => {
      if (checkMeetingConflict(meeting)) {
        conflicts.push({ meeting, type: 'participated' });
      }
    });

    return conflicts;
  };

  // 충돌 모달 닫기 및 강제 생성
  const handleForceCreate = () => {
    setConflictModal({ show: false, conflicts: [] });
    submitPost();
  };

  // 실제 포스트 생성 로직
  const submitPost = async () => {
    if (!accessToken || !user || !form.selectedBook) return;

    setIsSubmitting(true);

    const duration = parseInt(form.discussionLength);

    // 현재 시간 처리
    const now = new Date();
    let currentDateStr: string;
    let dueDateStr: string;

    if (form.bookLanguage === 'kr') {
      const kstOffset = 9 * 60;
      const localOffset = now.getTimezoneOffset();
      const offsetDiff = kstOffset + localOffset;

      const nowKST = new Date(now.getTime() + offsetDiff * 60 * 1000);
      currentDateStr = nowKST.toISOString().slice(0, -5);
      dueDateStr = `${form.date}T${form.time}:00`;
    } else {
      const dueDateTime = new Date(`${form.date}T${form.time}`);
      currentDateStr = now.toISOString().slice(0, -5);
      dueDateStr = dueDateTime.toISOString().slice(0, -5);
    }

    const newPost: Partial<Post> = {
      createrId: user.id!,
      date: currentDateStr,
      due: dueDateStr,
      capacity: form.capacity,
      memberIds: [user.id!],
      level: form.level,
      bookData: {
        title: form.selectedBook.title,
        isbn: form.selectedBook.isbn,
        cover: form.selectedBook.thumbnail,
        author: form.selectedBook.author,
        genre: form.selectedBook.categories?.[0],
        ln: form.bookLanguage === 'en' ? 'en' : 'ko',
      },
      duration: duration,
      description: form.description.trim() || undefined,
      tags: form.tags.length > 0 ? form.tags : undefined,
      joinType: form.joinType,
    };

    try {
      // Google 로그인 사용자: Meet 링크 생성을 위해 Google OAuth 토큰 갱신
      if (isGoogleLinked()) {
        await refreshGoogleAccessToken();
      }

      const createdPost = await createPost(newPost, accessToken);

      // Store에 새 포스트 추가 (Board에서 바로 표시됨)
      // hostUsername이 없으면 현재 사용자의 username으로 설정
      addPost({
        ...createdPost,
        hostUsername: createdPost.hostUsername || user.username,
      });

      if (createdPost.meetLink) {
        alert(t('post_create_success_with_meet'));
      } else if (createdPost.meetError) {
        alert(t('post_create_success_no_meet') + `: ${createdPost.meetError}`);
      } else {
        alert(t('post_create_success'));
      }

      navigate('/');
    } catch (error) {
      console.error('Error:', error);
      alert(t('post_create_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!accessToken || !user) {
      alert(t('post_create_login_required'));
      return;
    }

    if (!form.selectedBook) {
      alert(t('post_create_select_book'));
      return;
    }

    if (!form.date || !form.time) {
      alert(t('post_create_select_datetime'));
      return;
    }

    // 시간 충돌 검증
    const conflicts = checkTimeConflicts();
    if (conflicts.length > 0) {
      setConflictModal({ show: true, conflicts });
      return;
    }

    // 충돌 없으면 바로 생성
    submitPost();
  };

  // 시간 포맷팅 헬퍼 함수
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="post-create-page">
      {/* 시간 충돌 모달 */}
      {conflictModal.show && (
        <div className="conflict-modal-overlay" onClick={() => setConflictModal({ show: false, conflicts: [] })}>
          <div className="conflict-modal" onClick={(e) => e.stopPropagation()}>
            <div className="conflict-modal-header">
              <div className="conflict-modal-icon">
                <i className="ri-error-warning-line"></i>
              </div>
              <h2>{t('post_create_conflict_title', '시간이 겹치는 모임이 있습니다')}</h2>
            </div>
            <div className="conflict-modal-body">
              <p className="conflict-modal-desc">
                {t('post_create_conflict_desc', '선택한 시간에 이미 참여하거나 생성한 모임이 있습니다. 그래도 생성하시겠습니까?')}
              </p>
              <div className="conflict-list">
                {conflictModal.conflicts.map((conflict, index) => (
                  <div key={index} className="conflict-item">
                    <div className="conflict-item-cover">
                      {conflict.meeting.bookData.coverSmall ? (
                        <img src={conflict.meeting.bookData.coverSmall} alt={conflict.meeting.bookData.title} />
                      ) : (
                        <div className="conflict-item-cover-placeholder">
                          <i className="ri-book-line"></i>
                        </div>
                      )}
                    </div>
                    <div className="conflict-item-info">
                      <span className="conflict-item-badge">
                        {conflict.type === 'created'
                          ? t('post_create_conflict_created', '내가 만든 모임')
                          : t('post_create_conflict_participating', '참여 중인 모임')}
                      </span>
                      <h4 className="conflict-item-title">{conflict.meeting.bookData.title}</h4>
                      <p className="conflict-item-time">
                        <i className="ri-calendar-line"></i>
                        {formatDateTime(conflict.meeting.due)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="conflict-modal-actions">
              <button
                type="button"
                className="conflict-btn conflict-btn-cancel"
                onClick={() => setConflictModal({ show: false, conflicts: [] })}
              >
                {t('post_create_conflict_cancel', '취소')}
              </button>
              <button
                type="button"
                className="conflict-btn conflict-btn-confirm"
                onClick={handleForceCreate}
              >
                {t('post_create_conflict_confirm', '그래도 생성하기')}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="post-create-container">
        {/* Header */}
        <div className="post-create-header">
          <h1 className="post-create-title">{t('post_create_title')}</h1>
          <p className="post-create-subtitle">{t('post_create_subtitle')}</p>
        </div>

        {/* Main Grid */}
        <form onSubmit={handleSubmit} className="post-create-grid">
          {/* Left Column - Book Selection */}
          <div className="post-create-card book-select-card">
            <h3 className="post-create-card-title">{t('post_create_selected_book')}</h3>

            {/* Language Toggle */}
            <div className="language-toggle">
              <button
                type="button"
                className={`lang-btn ${form.bookLanguage === 'en' ? 'active' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, bookLanguage: 'en' }))}
              >
                English
              </button>
              <button
                type="button"
                className={`lang-btn ${form.bookLanguage === 'kr' ? 'active' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, bookLanguage: 'kr' }))}
              >
                한국어
              </button>
            </div>

            {/* Search Input */}
            <div className="book-search-input-wrapper">
              <i className="ri-search-line book-search-icon"></i>
              <input
                type="text"
                className="book-search-input"
                placeholder={t('post_create_book_search_placeholder')}
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
              />
              {/* Search Results Dropdown - overlay */}
              {bookSearch.trim() && (
                <ul className="book-results-dropdown">
                  {isSearching && (
                    <li className="search-loading-indicator">
                      <i className="ri-loader-4-line ri-spin"></i>
                      <span>{t('post_create_searching')}</span>
                    </li>
                  )}
                  {!isSearching && searchError && (
                    <li className="search-error-item">
                      <i className="ri-error-warning-line"></i>
                      <span>{searchError}</span>
                    </li>
                  )}
                  {!isSearching && !searchError && bookResults.length === 0 && (
                    <li className="search-no-results-item">
                      <i className="ri-search-line"></i>
                      <span>검색 결과가 없습니다</span>
                    </li>
                  )}
                  {bookResults.map((book, index) => (
                    <li
                      key={index}
                      className="book-result-item"
                      onClick={() => handleBookSelect(book)}
                    >
                      {book.thumbnail?.small && (
                        <img src={book.thumbnail.small} alt={book.title} className="book-thumbnail" />
                      )}
                      <div className="book-info">
                        <span className="book-title">{book.title}</span>
                        <span className="book-author">{book.author}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Selected Book Display */}
            {form.selectedBook && (
              <div className="selected-book-display">
                {form.selectedBook.thumbnail?.small && (
                  <img src={form.selectedBook.thumbnail.small} alt={form.selectedBook.title} />
                )}
                <div className="selected-book-info">
                  <h4>{form.selectedBook.title}</h4>
                  <p>{form.selectedBook.author}</p>
                  <button
                    type="button"
                    className="change-book-btn"
                    onClick={handleClearBook}
                  >
                    <i className="ri-close-line"></i>
                    {t('post_create_change_book')}
                  </button>
                </div>
              </div>
            )}

            {/* Empty State - only show when no book and no search results */}
            {!form.selectedBook && bookResults.length === 0 && !bookSearch && (
              <div className="book-select-empty">
                <div className="book-select-icon">
                  <i className="ri-book-line"></i>
                </div>
                <p>{t('post_create_no_book')}</p>
              </div>
            )}
          </div>

          {/* Right Column - Room Settings */}
          <div className="post-create-card">
            <h3 className="post-create-card-title">{t('post_create_room_settings')}</h3>

            {/* Discussion Type */}
            <div className="form-section">
              <label className="form-label">{t('post_create_discussion_type')}</label>
              <div className="option-grid option-grid-2">
                <button
                  type="button"
                  className="option-card disabled"
                  disabled
                >
                  <div className="option-card-icon">
                    <i className="ri-chat-3-line"></i>
                  </div>
                  <div className="option-card-title">{t('post_create_text_chat')}</div>
                  <div className="option-card-desc">{t('post_create_coming_soon')}</div>
                </button>
                <button
                  type="button"
                  className={`option-card ${form.discussionType === 'voice' ? 'active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, discussionType: 'voice' }))}
                >
                  <div className="option-card-icon">
                    <i className="ri-mic-line"></i>
                  </div>
                  <div className="option-card-title">{t('post_create_voice_call')}</div>
                  <div className="option-card-desc">{t('post_create_voice_desc')}</div>
                </button>
              </div>
            </div>

            {/* Date & Time */}
            <div className="form-section">
              <div className="form-row">
                <div>
                  <label className="form-label">{t('post_create_date')}</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.date}
                    min={today}
                    onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">{t('post_create_time')}</label>
                  <input
                    type="time"
                    className="form-input"
                    value={form.time}
                    onChange={(e) => setForm(prev => ({ ...prev, time: e.target.value }))}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Discussion Length */}
            <div className="form-section">
              <label className="form-label">{t('post_create_length')}</label>
              <div className="option-grid option-grid-4">
                {(['30', '45', '60', '90'] as DiscussionLength[]).map((len) => (
                  <button
                    key={len}
                    type="button"
                    className={`duration-btn ${form.discussionLength === len ? 'active' : ''}`}
                    onClick={() => setForm(prev => ({ ...prev, discussionLength: len }))}
                  >
                    {len} {t('post_create_minutes')}
                  </button>
                ))}
              </div>
            </div>

            {/* Room Visibility */}
            <div className="form-section">
              <label className="form-label">{t('post_create_visibility')}</label>
              <div className="option-grid option-grid-2">
                <button
                  type="button"
                  className={`option-card ${form.roomVisibility === 'public' ? 'active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, roomVisibility: 'public' }))}
                >
                  <div className="option-card-icon">
                    <i className="ri-global-line"></i>
                  </div>
                  <div className="option-card-title">{t('post_create_public')}</div>
                  <div className="option-card-desc">{t('post_create_public_desc')}</div>
                </button>
                <button
                  type="button"
                  className="option-card disabled"
                  disabled
                >
                  <div className="option-card-icon">
                    <i className="ri-lock-line"></i>
                  </div>
                  <div className="option-card-title">{t('post_create_invite_only')}</div>
                  <div className="option-card-desc">{t('post_create_coming_soon')}</div>
                </button>
              </div>
            </div>

            {/* Join Type */}
            <div className="form-section">
              <label className="form-label">{t('post_create_join_type')}</label>
              <div className="option-grid option-grid-2">
                <button
                  type="button"
                  className={`option-card ${form.joinType === 'OPEN' ? 'active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, joinType: 'OPEN' }))}
                >
                  <div className="option-card-icon">
                    <i className="ri-door-open-line"></i>
                  </div>
                  <div className="option-card-title">{t('post_create_join_open')}</div>
                  <div className="option-card-desc">{t('post_create_join_open_desc')}</div>
                </button>
                <button
                  type="button"
                  className={`option-card ${form.joinType === 'APPROVAL' ? 'active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, joinType: 'APPROVAL' }))}
                >
                  <div className="option-card-icon">
                    <i className="ri-shield-check-line"></i>
                  </div>
                  <div className="option-card-title">{t('post_create_join_approval')}</div>
                  <div className="option-card-desc">{t('post_create_join_approval_desc')}</div>
                </button>
              </div>
            </div>

            {/* Description */}
            <div className="form-section">
              <label className="form-label">{t('post_create_description')}</label>
              <textarea
                ref={textareaRef}
                className="form-textarea"
                placeholder={t('post_create_description_placeholder')}
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            {/* Tags */}
            <div className="form-section">
              <label className="form-label">{t('post_create_tags')}</label>
              <div className="tags-section">
                <div className="tag-input-group">
                  <input
                    type="text"
                    className="tag-input"
                    placeholder={t('post_create_add_tag')}
                    value={form.newTag}
                    onChange={(e) => setForm(prev => ({ ...prev, newTag: e.target.value }))}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <button type="button" className="tag-add-btn" onClick={handleAddTag}>
                    <i className="ri-add-line"></i>
                  </button>
                </div>
                {form.tags.length > 0 && (
                  <div className="tags-list">
                    {form.tags.map((tag, index) => (
                      <span key={index} className="tag tag-editable">
                        {tag}
                        <button type="button" onClick={() => handleRemoveTag(tag)}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* AI Tools */}
            <div className="form-section">
              <label className="form-label">{t('post_create_ai_tools')}</label>
              <div className="ai-tools-list">
                <div className="ai-tool-item">
                  <div className="ai-tool-info">
                    <div className="ai-tool-icon">
                      <i className="ri-file-text-line"></i>
                    </div>
                    <div className="ai-tool-text">
                      <h4>{t('post_create_ai_summary')}</h4>
                      <p>{t('post_create_ai_summary_desc')}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`toggle-switch ${form.aiSummary ? 'active' : ''}`}
                    onClick={() => setForm(prev => ({ ...prev, aiSummary: !prev.aiSummary }))}
                  >
                    <span className="toggle-switch-knob"></span>
                  </button>
                </div>
                <div className="ai-tool-item">
                  <div className="ai-tool-info">
                    <div className="ai-tool-icon">
                      <i className="ri-robot-line"></i>
                    </div>
                    <div className="ai-tool-text">
                      <h4>{t('post_create_ai_moderator')}</h4>
                      <p>{t('post_create_ai_moderator_desc')}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`toggle-switch ${form.aiModerator ? 'active' : ''}`}
                    onClick={() => setForm(prev => ({ ...prev, aiModerator: !prev.aiModerator }))}
                  >
                    <span className="toggle-switch-knob"></span>
                  </button>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="submit-section">
              <button
                type="submit"
                className="submit-btn"
                disabled={isSubmitting || !form.selectedBook}
              >
                <i className="ri-add-circle-line"></i>
                {isSubmitting ? t('post_create_creating') : t('post_create_submit')}
              </button>
              <p className="submit-note">{t('post_create_submit_note')}</p>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
};

export default PostCreate;
