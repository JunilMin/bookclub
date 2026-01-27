import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createPost, Post } from '../api/posts';
import { searchGoogleBooks, searchNaverBooks, BookSearchResult, getBookByISBN } from '../api/bookSearch';
import { useAuth } from '../AuthContext/AuthContext';
import './styles/PostCreate.css';

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
  const { user, accessToken } = useAuth();

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

  const today = new Date().toISOString().split('T')[0];

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
    const state = location.state as { isbn?: string } | null;
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

    setIsSubmitting(true);

    const duration = parseInt(form.discussionLength);

    // 현재 시간 처리
    const now = new Date();
    let currentDateStr: string;
    let dueDateStr: string;

    if (form.bookLanguage === 'kr') {
      // 한국어 선택 시 KST(UTC+9) 기준으로 저장
      // 입력된 시간을 그대로 KST로 해석하여 저장
      const kstOffset = 9 * 60; // KST는 UTC+9
      const localOffset = now.getTimezoneOffset(); // 로컬 시간대 오프셋 (분)
      const offsetDiff = kstOffset + localOffset; // KST와 로컬 시간 차이

      // 현재 시간을 KST로 변환
      const nowKST = new Date(now.getTime() + offsetDiff * 60 * 1000);
      currentDateStr = nowKST.toISOString().slice(0, -5);

      // due 시간: 입력된 날짜/시간을 KST로 간주하고 저장
      // 사용자가 입력한 시간이 KST라고 가정하므로, 그대로 문자열로 저장
      dueDateStr = `${form.date}T${form.time}:00`;
    } else {
      // 영어 선택 시 로컬 시간대 → UTC로 변환
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
    };

    try {
      const createdPost = await createPost(newPost, accessToken);

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

  return (
    <div className="post-create-page">
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
