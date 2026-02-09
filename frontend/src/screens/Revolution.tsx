import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiSearch,
  FiList,
  FiCheck,
  FiLoader,
  FiEye,
  FiClock,
  FiArrowUp,
  FiPlus,
  FiXCircle,
} from 'react-icons/fi';
import { RiTrophyFill, RiVipDiamondFill, RiStarFill, RiSeedlingFill } from 'react-icons/ri';
import { getAllSuggestions, toggleVote } from '../api/suggestions';
import { Suggestion, SuggestionStatus } from '../types/suggestion';
import { useAuth } from '../AuthContext/AuthContext';
import CreateSuggestionModal from '../components/revolution/CreateSuggestionModal';
import SuggestionDetailModal from '../components/revolution/SuggestionDetailModal';
import './styles/Revolution.css';

type FilterStatus = 'all' | SuggestionStatus;

const Revolution: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // 투표 중인 건의사항 ID 추적 (중복 클릭 방지)
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set());

  // Fetch suggestions
  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    try {
      const data = await getAllSuggestions();
      setSuggestions(data);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Stats computed from real data
  const stats = useMemo(() => {
    return {
      totalSuggestions: suggestions.length,
      completed: suggestions.filter(s => s.status === 'implemented').length,
      inProgress: suggestions.filter(s => s.status === 'planned' || s.status === 'in_review').length,
    };
  }, [suggestions]);

  // Handle new suggestion created
  const handleSuggestionCreated = (newSuggestion: Suggestion) => {
    setSuggestions(prev => [newSuggestion, ...prev]);
  };

  // Handle suggestion update (from detail modal)
  const handleSuggestionUpdate = (updatedSuggestion: Suggestion) => {
    setSuggestions(prev =>
      prev.map(s => (s.id === updatedSuggestion.id ? updatedSuggestion : s))
    );
  };

  // Handle vote from card (중복 클릭 방지)
  const handleVote = async (e: React.MouseEvent, suggestionId: string) => {
    e.stopPropagation();
    if (!user) return;

    // 이미 투표 처리 중이면 무시
    if (votingIds.has(suggestionId)) return;

    // 투표 중 상태로 설정
    setVotingIds(prev => new Set(prev).add(suggestionId));

    try {
      const updated = await toggleVote(suggestionId);
      setSuggestions(prev =>
        prev.map(s => (s.id === updated.id ? updated : s))
      );
    } catch (error) {
      console.error('Failed to toggle vote:', error);
    } finally {
      // 투표 완료 후 상태 해제
      setVotingIds(prev => {
        const next = new Set(prev);
        next.delete(suggestionId);
        return next;
      });
    }
  };

  // Open detail modal
  const handleCardClick = (suggestionId: string) => {
    setSelectedSuggestionId(suggestionId);
    setIsDetailModalOpen(true);
  };

  const getStatusBadge = (status: SuggestionStatus) => {
    switch (status) {
      case 'implemented':
        return (
          <span className="status-badge completed">
            <FiCheck size={12} />
            {t('revolution_status_completed') || '해결완료'}
          </span>
        );
      case 'planned':
        return (
          <span className="status-badge in-progress">
            <FiLoader size={12} />
            {t('revolution_status_progress') || '진행중'}
          </span>
        );
      case 'in_review':
        return (
          <span className="status-badge reviewing">
            <FiEye size={12} />
            {t('revolution_status_reviewing') || '검토중'}
          </span>
        );
      case 'rejected':
        return (
          <span className="status-badge rejected">
            <FiXCircle size={12} />
            {t('revolution_status_rejected') || '반려'}
          </span>
        );
      case 'open':
      default:
        return (
          <span className="status-badge pending">
            <FiClock size={12} />
            {t('revolution_status_pending') || '대기중'}
          </span>
        );
    }
  };

  // Map filter status to API status
  const mapFilterToApiStatus = (filter: FilterStatus): SuggestionStatus | null => {
    switch (filter) {
      case 'all':
        return null;
      default:
        return filter as SuggestionStatus;
    }
  };

  const filterSuggestions = (items: Suggestion[]) => {
    let filtered = items;

    // Status filter
    if (activeFilter !== 'all') {
      const apiStatus = mapFilterToApiStatus(activeFilter);
      if (apiStatus) {
        filtered = filtered.filter(s => s.status === apiStatus);
      }
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        s =>
          s.title.toLowerCase().includes(query) ||
          s.content.toLowerCase().includes(query) ||
          s.authorName.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  // 순위 기반 티어 분류
  const filteredSuggestions = filterSuggestions(suggestions);

  // 추천수 기준 정렬 (이미 API에서 정렬되어 오지만 확실히 하기 위해)
  const sortedSuggestions = [...filteredSuggestions].sort((a, b) => {
    if (b.upvoteCount !== a.upvoteCount) {
      return b.upvoteCount - a.upvoteCount;
    }
    // 추천수가 같으면 최신순
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // 순위 기반 티어 분류
  // APEX: 1등, ELITE: 2-3등, RISING: 4-6등, EMERGING: 7등 이하
  const apexSuggestions = sortedSuggestions.slice(0, 1);
  const eliteSuggestions = sortedSuggestions.slice(1, 3);
  const risingSuggestions = sortedSuggestions.slice(3, 6);
  const emergingSuggestions = sortedSuggestions.slice(6);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const SuggestionCard: React.FC<{ suggestion: Suggestion }> = ({ suggestion }) => {
    const isVoting = votingIds.has(suggestion.id);

    return (
      <div className="suggestion-card" onClick={() => handleCardClick(suggestion.id)}>
        <div className="suggestion-header">
          <div className="suggestion-author">
            <div className="author-avatar">
              {suggestion.authorPhotoUrl ? (
                <img src={suggestion.authorPhotoUrl} alt={suggestion.authorName} />
              ) : (
                <span>{suggestion.authorName.charAt(0)}</span>
              )}
            </div>
            <div className="author-info">
              <div className="author-name">{suggestion.authorName}</div>
              <div className="suggestion-date">{formatDate(suggestion.createdAt)}</div>
            </div>
          </div>
        </div>
        <h3 className="suggestion-title">{suggestion.title}</h3>
        <p className="suggestion-description">{suggestion.content}</p>
        <div className="suggestion-footer">
          {getStatusBadge(suggestion.status)}
          <button
            className={`suggestion-votes ${suggestion.hasVoted ? 'voted' : ''} ${isVoting ? 'voting' : ''}`}
            onClick={e => handleVote(e, suggestion.id)}
            disabled={!user || isVoting}
          >
            <FiArrowUp size={16} />
            <span>{suggestion.upvoteCount}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="revolution-page">
      {/* Background Pattern */}
      <div className="revolution-bg-pattern"></div>

      {/* Hero Section */}
      <div className="revolution-hero">
        <div className="revolution-hero-content">
          {/* Community Badge */}
          <div className="revolution-badge">
            <div className="badge-pulse-container">
              <div className="badge-pulse-dot"></div>
              <div className="badge-pulse-ring"></div>
            </div>
            <span className="badge-text">Community Driven</span>
          </div>

          {/* Title */}
          <h1 className="revolution-title">
            <span className="title-line-1">{t('revolution_title_line1') || '진화의'}</span>
            <br />
            <span className="title-line-2">{t('revolution_title_line2') || '전당'}</span>
          </h1>

          {/* Description */}
          <p className="revolution-description">
            {t('revolution_description_1') || '여러분의 아이디어로 Mammalias를 함께 만들어갑니다.'}
            <br />
            {t('revolution_description_2') ||
              '추천을 받은 건의사항은 생태계 피라미드의 정상으로 올라갑니다.'}
          </p>

          {/* Stats Cards */}
          <div className="revolution-stats">
            <div className="stat-card">
              <div className="stat-number primary">{stats.totalSuggestions}</div>
              <div className="stat-label">{t('revolution_stat_total') || '총 건의사항'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-number secondary">{stats.completed}</div>
              <div className="stat-label">{t('revolution_stat_completed') || '해결 완료'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-number accent">{stats.inProgress}</div>
              <div className="stat-label">{t('revolution_stat_progress') || '진행 중'}</div>
            </div>
          </div>

          {/* Create Suggestion Button */}
          {user && (
            <button className="create-suggestion-btn" onClick={() => setIsCreateModalOpen(true)}>
              <FiPlus size={20} />
              {t('revolution_create_btn') || '건의사항 작성하기'}
            </button>
          )}
        </div>
      </div>

      {/* Filter Section */}
      <section className="revolution-filter-section">
        <div className="filter-container">
          <div className="filter-content">
            {/* Search Input */}
            <div className="search-input-wrapper">
              <FiSearch className="search-icon" size={20} />
              <input
                type="text"
                className="search-input"
                placeholder={t('revolution_search_placeholder') || '건의사항 검색...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter Buttons */}
            <div className="filter-buttons">
              <button
                className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setActiveFilter('all')}
              >
                <FiList size={16} />
                <span>{t('revolution_filter_all') || '전체'}</span>
              </button>
              <button
                className={`filter-btn ${activeFilter === 'implemented' ? 'active' : ''}`}
                onClick={() => setActiveFilter('implemented')}
              >
                <FiCheck size={16} />
                <span>{t('revolution_filter_completed') || '해결완료'}</span>
              </button>
              <button
                className={`filter-btn ${activeFilter === 'planned' ? 'active' : ''}`}
                onClick={() => setActiveFilter('planned')}
              >
                <FiLoader size={16} />
                <span>{t('revolution_filter_progress') || '진행중'}</span>
              </button>
              <button
                className={`filter-btn ${activeFilter === 'in_review' ? 'active' : ''}`}
                onClick={() => setActiveFilter('in_review')}
              >
                <FiEye size={16} />
                <span>{t('revolution_filter_reviewing') || '검토중'}</span>
              </button>
              <button
                className={`filter-btn ${activeFilter === 'open' ? 'active' : ''}`}
                onClick={() => setActiveFilter('open')}
              >
                <FiClock size={16} />
                <span>{t('revolution_filter_pending') || '대기중'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Suggestion List Section */}
      <section className="revolution-list-section">
        <div className="list-container">
          {isLoading ? (
            <div className="loading-state">
              <div className="loading-spinner-large"></div>
            </div>
          ) : (
            <div className="tier-list">
              {/* APEX Tier (1st place) */}
              {apexSuggestions.length > 0 && (
                <div className="tier-group">
                  <div className="tier-header">
                    <div className="tier-badge apex">
                      <RiTrophyFill size={24} />
                      <span className="tier-name">APEX</span>
                      <span className="tier-range">{t('revolution_rank') || '순위'} #1</span>
                    </div>
                    <p className="tier-description">
                      {t('revolution_tier_apex') || '최상위 건의사항'}
                    </p>
                  </div>
                  <div className="tier-cards tier-cards-1">
                    {apexSuggestions.map(s => (
                      <SuggestionCard key={s.id} suggestion={s} />
                    ))}
                  </div>
                </div>
              )}

              {/* ELITE Tier (2nd-3rd place) */}
              {eliteSuggestions.length > 0 && (
                <div className="tier-group">
                  <div className="tier-header">
                    <div className="tier-badge elite">
                      <RiVipDiamondFill size={24} />
                      <span className="tier-name">ELITE</span>
                      <span className="tier-range">{t('revolution_rank') || '순위'} #2-3</span>
                    </div>
                    <p className="tier-description">
                      {t('revolution_tier_elite') || '우수 건의사항'}
                    </p>
                  </div>
                  <div className="tier-cards tier-cards-2">
                    {eliteSuggestions.map(s => (
                      <SuggestionCard key={s.id} suggestion={s} />
                    ))}
                  </div>
                </div>
              )}

              {/* RISING Tier (4th-6th place) */}
              {risingSuggestions.length > 0 && (
                <div className="tier-group">
                  <div className="tier-header">
                    <div className="tier-badge rising">
                      <RiStarFill size={24} />
                      <span className="tier-name">RISING</span>
                      <span className="tier-range">{t('revolution_rank') || '순위'} #4-6</span>
                    </div>
                    <p className="tier-description">
                      {t('revolution_tier_rising') || '주목받는 건의사항'}
                    </p>
                  </div>
                  <div className="tier-cards tier-cards-3">
                    {risingSuggestions.map(s => (
                      <SuggestionCard key={s.id} suggestion={s} />
                    ))}
                  </div>
                </div>
              )}

              {/* EMERGING Tier (7th and below) */}
              {emergingSuggestions.length > 0 && (
                <div className="tier-group">
                  <div className="tier-header">
                    <div className="tier-badge emerging">
                      <RiSeedlingFill size={24} />
                      <span className="tier-name">EMERGING</span>
                      <span className="tier-range">{t('revolution_rank') || '순위'} #7+</span>
                    </div>
                    <p className="tier-description">
                      {t('revolution_tier_emerging') || '신규 건의사항'}
                    </p>
                  </div>
                  <div className="tier-cards tier-cards-4">
                    {emergingSuggestions.map(s => (
                      <SuggestionCard key={s.id} suggestion={s} />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {apexSuggestions.length === 0 &&
                eliteSuggestions.length === 0 &&
                risingSuggestions.length === 0 &&
                emergingSuggestions.length === 0 && (
                  <div className="empty-state">
                    <FiSearch size={48} />
                    <h3>{t('revolution_empty_title') || '검색 결과가 없습니다'}</h3>
                    <p>{t('revolution_empty_desc') || '다른 검색어나 필터를 시도해보세요.'}</p>
                  </div>
                )}
            </div>
          )}
        </div>
      </section>

      {/* Create Suggestion Modal */}
      <CreateSuggestionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleSuggestionCreated}
      />

      {/* Suggestion Detail Modal */}
      <SuggestionDetailModal
        isOpen={isDetailModalOpen}
        suggestionId={selectedSuggestionId}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedSuggestionId(null);
        }}
        onSuggestionUpdate={handleSuggestionUpdate}
      />
    </div>
  );
};

export default Revolution;
