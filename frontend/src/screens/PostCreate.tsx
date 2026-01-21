import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createPost, Post } from '../api/posts';
import { searchGoogleBooks, searchNaverBooks, BookSearchResult, getBookByISBN } from '../api/bookSearch';
import { useAuth } from '../AuthContext/AuthContext';
import './styles/PostCreate.css';

type BookLanguage = 'en' | 'kr';
type DiscussionType = 'voice' | 'text';
type RoomVisibility = 'public' | 'invite';
type DiscussionLength = '30' | '45' | '60' | '90' | 'custom';

interface PostCreateForm {
  bookLanguage: BookLanguage;
  selectedBook: BookSearchResult | null;
  discussionType: DiscussionType;
  date: string;
  time: string;
  capacity: number;
  level: 'low' | 'moderate' | 'high';
  discussionLength: DiscussionLength;
  customLength: number;
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

  // 현재 언어에 따라 기본 책 언어 설정
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
    customLength: 60,
    roomVisibility: 'public',
    aiSummary: false,
    aiModerator: false,
    description: '',
    tags: [],
    newTag: '',
  });

  const [bookSearch, setBookSearch] = useState('');
  const [bookResults, setBookResults] = useState<BookSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 오늘 날짜를 YYYY-MM-DD 형식으로 가져오기
  const today = new Date().toISOString().split('T')[0];

  // "비슷한 모임 만들기"에서 전달받은 ISBN으로 책 정보 조회
  useEffect(() => {
    const state = location.state as { isbn?: string } | null;
    if (state?.isbn) {
      const loadBookByISBN = async () => {
        setIsSearching(true);
        try {
          const book = await getBookByISBN(state.isbn!);
          if (book) {
            setForm(prev => ({ ...prev, selectedBook: book }));
            setBookSearch(book.title);
          } else {
            console.warn('Book not found for ISBN:', state.isbn);
          }
        } catch (error) {
          console.error('Failed to load book by ISBN:', error);
        } finally {
          setIsSearching(false);
        }
      };

      loadBookByISBN();
      // state 초기화 (뒤로가기 시 재적용 방지)
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // 책 검색 (debounced)
  const searchBooks = useCallback(async (query: string) => {
    if (!query.trim()) {
      setBookResults([]);
      return;
    }

    setIsSearching(true);
    try {
      let results: BookSearchResult[];
      if (form.bookLanguage === 'en') {
        results = await searchGoogleBooks(query);
      } else {
        results = await searchNaverBooks(query);
      }
      setBookResults(results);
      setShowResults(true);
    } catch (error) {
      console.error('Book search error:', error);
      setBookResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [form.bookLanguage]);

  // 검색어 변경 시 debounce 적용
  useEffect(() => {
    const timer = setTimeout(() => {
      if (bookSearch) {
        searchBooks(bookSearch);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [bookSearch, searchBooks]);

  // 언어 변경 시 검색 결과 초기화
  useEffect(() => {
    setBookResults([]);
    setBookSearch('');
    setForm(prev => ({ ...prev, selectedBook: null }));
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
    setBookSearch(book.title);
    setShowResults(false);
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

    // 날짜와 시간 합치기
    const dueDateTime = new Date(`${form.date}T${form.time}`);

    // Discussion length 계산
    const duration = form.discussionLength === 'custom'
      ? form.customLength
      : parseInt(form.discussionLength);

    const newPost: Partial<Post> = {
      createrId: user.id!, // User ObjectId
      date: new Date().toISOString().slice(0, -5),
      due: dueDateTime.toISOString().slice(0, -5),
      capacity: form.capacity,
      memberIds: [user.id!], // 생성자의 ObjectId를 기본 멤버로 추가
      level: form.level,
      // 모든 책 정보는 bookData 객체에 저장
      bookData: {
        title: form.selectedBook.title,
        isbn: form.selectedBook.isbn,
        cover: form.selectedBook.thumbnail, // { small, medium } object
        author: form.selectedBook.author,
        genre: form.selectedBook.categories?.[0],
        api: form.bookLanguage === 'en' ? 'google' : 'naver',
      },
      duration: duration,
      description: form.description.trim() || undefined,
      tags: form.tags.length > 0 ? form.tags : undefined,
    };

    try {
      console.log("Creating post (googleAccessToken은 httpOnly 쿠키로 자동 전송)");
      const createdPost = await createPost(newPost, accessToken);

      if (createdPost.meetLink) {
        alert(t('post_create_success_with_meet'));
      } else if (createdPost.meetError) {
        alert(t('post_create_success_no_meet') + `: ${createdPost.meetError}`);
      } else {
        alert(t('post_create_success'));
      }

      navigate('/board');
    } catch (error) {
      console.error('Error:', error);
      alert(t('post_create_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="post-create-container">
      <h1 className="post-create-title">{t('post_create_title')}</h1>

      <form onSubmit={handleSubmit} className="post-create-form">
        {/* Selected Book Section */}
        <section className="form-section">
          <h2 className="section-title">{t('post_create_book_section')}</h2>

          {/* Language Toggle */}
          <div className="language-toggle">
            <button
              type="button"
              className={`lang-btn ${form.bookLanguage === 'en' ? 'active' : ''}`}
              onClick={() => setForm(prev => ({ ...prev, bookLanguage: 'en' }))}
            >
              En
            </button>
            <button
              type="button"
              className={`lang-btn ${form.bookLanguage === 'kr' ? 'active' : ''}`}
              onClick={() => setForm(prev => ({ ...prev, bookLanguage: 'kr' }))}
            >
              Kr
            </button>
          </div>

          {/* Book Search */}
          <div className="book-search-container">
            <div className="book-search-input-wrapper">
              <input
                type="text"
                className="book-search-input"
                placeholder={t('post_create_book_search_placeholder')}
                value={bookSearch}
                onChange={(e) => {
                  setBookSearch(e.target.value);
                  if (!e.target.value) {
                    setForm(prev => ({ ...prev, selectedBook: null }));
                  }
                }}
                onFocus={() => bookResults.length > 0 && setShowResults(true)}
              />
              {bookResults.length > 0 && (
                <button
                  type="button"
                  className="book-search-toggle"
                  onClick={() => setShowResults(!showResults)}
                  aria-label={showResults ? 'Close results' : 'Open results'}
                >
                  {showResults ? '▲' : '▼'}
                </button>
              )}
            </div>
            {isSearching && <span className="search-loading">{t('post_create_searching')}</span>}

            {/* Search Results Dropdown */}
            {showResults && bookResults.length > 0 && (
              <ul className="book-results-dropdown">
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
            <div className="selected-book">
              <span className="selected-label">{t('post_create_selected_book')}:</span>
              <div className="selected-book-info">
                {form.selectedBook.thumbnail?.small && (
                  <img src={form.selectedBook.thumbnail.small} alt={form.selectedBook.title} />
                )}
                <div>
                  <strong>{form.selectedBook.title}</strong>
                  <p>{form.selectedBook.author}</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Room Setting Section */}
        <section className="form-section">
          <h2 className="section-title">{t('post_create_room_section')}</h2>

          {/* Discussion Type */}
          <div className="form-group">
            <label>{t('post_create_discussion_type')}</label>
            <div className="button-group">
              <button
                type="button"
                className="option-btn disabled"
                disabled
                title={t('post_create_coming_soon')}
              >
                {t('post_create_text_chat')}
              </button>
              <button
                type="button"
                className={`option-btn ${form.discussionType === 'voice' ? 'active' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, discussionType: 'voice' }))}
              >
                {t('post_create_voice_call')}
              </button>
            </div>
          </div>

          {/* Date & Time */}
          <div className="form-row">
            <div className="form-group">
              <label>{t('post_create_date')}</label>
              <input
                type="date"
                className="form-input"
                value={form.date}
                min={today}
                onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>{t('post_create_time')}</label>
              <input
                type="time"
                className="form-input"
                value={form.time}
                onChange={(e) => setForm(prev => ({ ...prev, time: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Capacity */}
          <div className="form-group">
            <label>{t('post_create_capacity')} ({form.capacity})</label>
            <input
              type="range"
              className="form-range"
              min={2}
              max={20}
              value={form.capacity}
              onChange={(e) => setForm(prev => ({ ...prev, capacity: parseInt(e.target.value) }))}
            />
            <div className="range-labels">
              <span>2</span>
              <span>20</span>
            </div>
          </div>

          {/* Background Knowledge Level */}
          <div className="form-group">
            <label>{t('post_create_level')}</label>
            <div className="button-group">
              <button
                type="button"
                className={`option-btn ${form.level === 'low' ? 'active' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, level: 'low' }))}
              >
                {t('post_create_level_low')}
              </button>
              <button
                type="button"
                className={`option-btn ${form.level === 'moderate' ? 'active' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, level: 'moderate' }))}
              >
                {t('post_create_level_moderate')}
              </button>
              <button
                type="button"
                className={`option-btn ${form.level === 'high' ? 'active' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, level: 'high' }))}
              >
                {t('post_create_level_high')}
              </button>
            </div>
          </div>

          {/* Discussion Length */}
          <div className="form-group">
            <label>{t('post_create_length')}</label>
            <div className="button-group length-group">
              {(['30', '45', '60', '90'] as DiscussionLength[]).map((len) => (
                <button
                  key={len}
                  type="button"
                  className={`option-btn ${form.discussionLength === len ? 'active' : ''}`}
                  onClick={() => setForm(prev => ({ ...prev, discussionLength: len }))}
                >
                  {len} min
                </button>
              ))}
              <button
                type="button"
                className={`option-btn ${form.discussionLength === 'custom' ? 'active' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, discussionLength: 'custom' }))}
              >
                {t('post_create_custom')}
              </button>
            </div>
            {form.discussionLength === 'custom' && (
              <div className="custom-length-input">
                <input
                  type="number"
                  className="form-input"
                  min={15}
                  max={180}
                  value={form.customLength}
                  onChange={(e) => setForm(prev => ({ ...prev, customLength: parseInt(e.target.value) }))}
                />
                <span>min</span>
              </div>
            )}
          </div>

          {/* Room Visibility */}
          <div className="form-group">
            <label>{t('post_create_visibility')}</label>
            <div className="button-group">
              <button
                type="button"
                className={`option-btn ${form.roomVisibility === 'public' ? 'active' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, roomVisibility: 'public' }))}
              >
                {t('post_create_public')}
              </button>
              <button
                type="button"
                className="option-btn disabled"
                disabled
                title={t('post_create_coming_soon')}
              >
                {t('post_create_invite_only')}
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <label>{t('post_create_description')}</label>
            <textarea
              className="form-textarea"
              rows={4}
              placeholder={t('post_create_description_placeholder')}
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {/* Tags */}
          <div className="form-group">
            <label>{t('post_create_tags')}</label>
            <div className="tags-section">
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
                <button type="button" className="tag-add-btn" onClick={handleAddTag}>+</button>
              </div>
            </div>
          </div>

          {/* AI Tools */}
          <div className="form-group">
            <label>{t('post_create_ai_tools')}</label>
            <div className="toggle-group">
              <div className="toggle-item disabled">
                <span>{t('post_create_ai_summary')}</span>
                <button
                  type="button"
                  className="toggle-btn disabled"
                  disabled
                  title={t('post_create_coming_soon')}
                >
                  <span className="toggle-slider"></span>
                </button>
              </div>
              <div className="toggle-item disabled">
                <span>{t('post_create_ai_moderator')}</span>
                <button
                  type="button"
                  className="toggle-btn disabled"
                  disabled
                  title={t('post_create_coming_soon')}
                >
                  <span className="toggle-slider"></span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Submit Button */}
        <button
          type="submit"
          className="submit-btn"
          disabled={isSubmitting || !form.selectedBook}
        >
          {isSubmitting ? t('post_create_creating') : t('post_create_submit')}
        </button>
      </form>
    </div>
  );
};

export default PostCreate;
