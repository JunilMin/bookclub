import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiX, FiUser, FiCalendar, FiClock, FiUsers, FiExternalLink, FiTrash2, FiVideo, FiEdit2, FiSave, FiXCircle, FiLogOut, FiEdit3, FiArrowRight, FiArrowLeft, FiHeart, FiInfo, FiUserMinus, FiMail, FiStar } from 'react-icons/fi';
import { joinSession } from '../api/sessions';
import { updatePost, leaveBookMeeting, kickMember } from '../api/posts';
import { toggleFavorite, checkFavorite } from '../api/favorites';
import { getUserById, getDisplayPhotoUrl, getUserReputation, UserReputationResponse } from '../api/user';
import { useAuth } from '../AuthContext/AuthContext';
import { ProfileTabsContent, ProfileTabType } from './profile';
import './styles/RoomModal.css';

// Participant interface for display
interface Participant {
  id: string;
  username: string;
  photoUrl?: string;
  isHost: boolean;
}

type ModalTab = 'info' | 'participants' | 'profile';

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

// Book cover interface
export interface BookCover {
  small?: string;
  medium?: string;
}

// Room interface (same as in Board.tsx)
export interface Room {
  id: string;
  title: string;
  host: string;
  hostAvatar: string;
  hostId: string; // 호스트 User ID
  book: {
    title: string;
    author: string;
    cover: BookCover;
    genre: string;
    isbn: string;
  };
  dueISO: string;
  duration: number;
  participants: number;
  maxParticipants: number;
  level: 'low' | 'moderate' | 'high';
  description: string;
  tags: string[];
  status: 'live' | 'upcoming' | 'past' | 'waiting';
  activeParticipants: number; // 현재 세션에 참가 중인 인원
  isJoined: boolean;
  isMyRoom: boolean;
  meetLink?: string | null;
  calendarEventId?: string | null;
  recruit?: boolean; // 모집 중 여부 (기본값: true)
  ln?: 'en' | 'ko'; // 언어 코드 (언어별 필터링용)
  joinType?: 'OPEN' | 'APPROVAL'; // 가입 방식
  memberIds?: string[]; // 참가자 User ID 리스트
}

interface RoomModalProps {
  room: Room;
  onClose: () => void;
  onJoin: (roomId: string) => void;
  onDelete?: (roomId: string) => void;
  onUpdate?: () => void;
  isProcessing?: boolean;
}

const RoomModal: React.FC<RoomModalProps> = ({ room, onClose, onJoin, onDelete, onUpdate, isProcessing }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const [isEntering, setIsEntering] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<ModalTab>('info');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Profile view state
  const [selectedProfile, setSelectedProfile] = useState<Participant | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [profileReputation, setProfileReputation] = useState<UserReputationResponse | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<ProfileTabType>('overview');

  // Edit form state
  const [editForm, setEditForm] = useState({
    date: '',
    time: '',
    duration: room.duration,
    capacity: room.maxParticipants,
    level: room.level,
    description: room.description,
    tags: room.tags,
    newTag: ''
  });

  // Check if book is favorited
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (!user || !room.book.isbn) return;
      try {
        const favorited = await checkFavorite(room.book.isbn);
        setIsFavorited(favorited);
      } catch (error) {
        console.error('Failed to check favorite status:', error);
      }
    };
    checkFavoriteStatus();
  }, [user, room.book.isbn]);

  // Fetch participants when tab is active
  useEffect(() => {
    const fetchParticipants = async () => {
      if (activeTab !== 'participants' || !accessToken) return;
      if (!room.memberIds || room.memberIds.length === 0) {
        setParticipants([]);
        return;
      }

      setIsLoadingParticipants(true);
      try {
        const participantPromises = room.memberIds.map(async (memberId) => {
          try {
            const userData = await getUserById(memberId, accessToken);
            return {
              id: memberId,
              username: userData.username || 'Unknown',
              photoUrl: getDisplayPhotoUrl(userData),
              isHost: memberId === room.hostId
            };
          } catch (error) {
            console.error(`Failed to fetch user ${memberId}:`, error);
            return {
              id: memberId,
              username: 'Unknown',
              photoUrl: undefined,
              isHost: memberId === room.hostId
            };
          }
        });

        const fetchedParticipants = await Promise.all(participantPromises);
        // Sort: host first, then alphabetically
        fetchedParticipants.sort((a, b) => {
          if (a.isHost) return -1;
          if (b.isHost) return 1;
          return a.username.localeCompare(b.username);
        });
        setParticipants(fetchedParticipants);
      } catch (error) {
        console.error('Failed to fetch participants:', error);
      } finally {
        setIsLoadingParticipants(false);
      }
    };

    fetchParticipants();
  }, [activeTab, room.memberIds, room.hostId, accessToken]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openDropdownId) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openDropdownId]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleParticipantClick = (e: React.MouseEvent, participantId: string) => {
    e.stopPropagation();
    // Don't show dropdown for self
    if (participantId === user?.id) return;
    setOpenDropdownId(openDropdownId === participantId ? null : participantId);
  };

  const handleViewProfile = async (participant: Participant) => {
    setOpenDropdownId(null);
    setSelectedProfile(participant);
    setActiveTab('profile');
    setIsLoadingProfile(true);

    try {
      if (accessToken) {
        // Fetch both user data and reputation data in parallel
        const [userData, reputationData] = await Promise.all([
          getUserById(participant.id, accessToken),
          getUserReputation(participant.id, accessToken, t('code') || 'ko')
        ]);
        setProfileData(userData);
        setProfileReputation(reputationData);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleBackFromProfile = () => {
    setActiveTab('participants');
    setSelectedProfile(null);
    setProfileData(null);
    setProfileReputation(null);
    setActiveProfileTab('overview');
  };

  const handleKickMember = async (participantId: string, participantUsername: string) => {
    if (!accessToken || !user?.id) return;

    const confirmMessage = t('browse_modal_kick_confirm', { username: participantUsername })
      || `${participantUsername}님을 강퇴하시겠습니까?`;

    if (!window.confirm(confirmMessage)) return;

    setOpenDropdownId(null);
    try {
      await kickMember(room.id, participantId, user.id, accessToken);
      // Remove from local participants list
      setParticipants(prev => prev.filter(p => p.id !== participantId));
      alert(t('browse_modal_kick_success') || '강퇴되었습니다.');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to kick member:', error);
      alert(t('browse_modal_kick_failed') || '강퇴에 실패했습니다.');
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getLevelText = (level: string) => {
    switch (level) {
      case 'low': return t('browse_level_low');
      case 'moderate': return t('browse_level_moderate');
      case 'high': return t('browse_level_high');
      default: return level;
    }
  };

  const handleJoinClick = () => {
    if (room.isJoined || room.isMyRoom) {
      // Navigate to meeting page
      navigate(`/meeting/${room.id}`, { state: { meetLink: room.meetLink, room } });
    } else {
      onJoin(room.id);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!room.book.isbn) return;

    setIsTogglingFavorite(true);
    try {
      const result = await toggleFavorite(room.book.isbn);
      setIsFavorited(result.isFavorited);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  // 미팅 입장하기 - 세션 생성/조회 후 /meet/:sessionId로 이동
  const handleEnterMeeting = async () => {
    if (!accessToken) {
      navigate('/login');
      return;
    }

    setIsEntering(true);
    try {
      const response = await joinSession(room.id, accessToken);
      navigate(`/meet-room/${response.sessionId}`);
    } catch (error: any) {
      console.error('Failed to enter meeting:', error);
      if (error.response?.status === 403) {
        alert(t('meeting_not_participant') || 'You are not a participant of this meeting');
      } else if (error.response?.status === 404) {
        alert(t('meeting_not_found') || 'Meeting not found');
      } else {
        alert(t('meeting_enter_error') || 'Failed to enter meeting');
      }
    } finally {
      setIsEntering(false);
    }
  };

  const handleCreateSimilar = () => {
    // 책 정보를 BookSearchResult 형태로 변환하여 전달
    const bookInfo = {
      title: room.book.title,
      author: room.book.author,
      isbn: room.book.isbn,
      thumbnail: room.book.cover,
      categories: room.book.genre ? [room.book.genre] : [],
      description: room.description || '',
    };
    navigate('/create', { state: { isbn: room.book.isbn, bookInfo } });
  };

  const handleOpenMeet = () => {
    if (room.meetLink) {
      window.open(room.meetLink, '_blank', 'noopener,noreferrer');
    }
  };

  // 노트 보기 (종료된 미팅용)
  const handleViewNotes = () => {
    navigate('/notes');
  };

  const handleDelete = () => {
    if (onDelete && window.confirm(t('browse_modal_delete_confirm'))) {
      onDelete(room.id);
    }
  };

  const handleLeave = async () => {
    if (!accessToken || !user?.id) {
      alert(t('login_required') || 'Please login first');
      return;
    }

    if (!window.confirm(t('browse_modal_leave_confirm') || 'Are you sure you want to leave this room?')) {
      return;
    }

    setIsLeaving(true);
    try {
      await leaveBookMeeting(room.id, user.id, accessToken);
      alert(t('browse_modal_leave_success') || 'Successfully left the room');
      onClose();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to leave room:', error);
      alert(t('browse_modal_leave_failed') || 'Failed to leave the room');
    } finally {
      setIsLeaving(false);
    }
  };

  const handleEditClick = () => {
    // Initialize edit form with current values
    const dueDate = new Date(room.dueISO);
    const dateStr = dueDate.toISOString().split('T')[0];
    const timeStr = dueDate.toTimeString().slice(0, 5);

    setEditForm({
      date: dateStr,
      time: timeStr,
      duration: room.duration,
      capacity: room.maxParticipants,
      level: room.level,
      description: room.description,
      tags: [...room.tags],
      newTag: ''
    });
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
  };

  const handleSaveEdit = async () => {
    if (!accessToken) return;

    setIsSaving(true);
    try {
      // Combine date and time
      const dueDateTime = new Date(`${editForm.date}T${editForm.time}`);

      await updatePost(
        room.id,
        {
          due: dueDateTime.toISOString().slice(0, -5),
          capacity: editForm.capacity,
          level: editForm.level,
          duration: editForm.duration,
          description: editForm.description,
          tags: editForm.tags,
        },
        accessToken
      );

      alert(t('browse_modal_update_success') || 'Room updated successfully');
      setIsEditMode(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to update room:', error);
      alert(t('browse_modal_update_failed') || 'Failed to update room');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = () => {
    if (editForm.newTag.trim() && !editForm.tags.includes(editForm.newTag.trim())) {
      setEditForm({
        ...editForm,
        tags: [...editForm.tags, editForm.newTag.trim()],
        newTag: ''
      });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditForm({
      ...editForm,
      tags: editForm.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleCloseRecruitment = async () => {
    if (!accessToken) return;
    if (!window.confirm(t('browse_modal_close_recruitment_confirm') || 'Close recruitment for this room?')) return;

    try {
      await updatePost(
        room.id,
        {
          recruit: false // 모집 마감,
        },
        accessToken
      );
      alert(t('browse_modal_close_recruitment_success') || 'Recruitment closed');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to close recruitment:', error);
      alert(t('browse_modal_close_recruitment_failed') || 'Failed to close recruitment');
    }
  };

  const handleOpenRecruitment = async () => {
    if (!accessToken) return;
    if (!window.confirm(t('browse_modal_open_recruitment_confirm') || 'Open recruitment for this room?')) return;

    try {
      await updatePost(
        room.id,
        {
          recruit: true // 모집 열기
        },
        accessToken
      );
      alert(t('browse_modal_open_recruitment_success') || 'Recruitment opened');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to open recruitment:', error);
      alert(t('browse_modal_open_recruitment_failed') || 'Failed to open recruitment');
    }
  };

  const spotsLeft = room.maxParticipants - room.participants;

  return (
    <div className="room-modal-overlay" onClick={handleOverlayClick}>
      <div className="room-modal">
        {/* Header */}
        <div className="room-modal-header">
          {activeTab === 'profile' ? (
            /* Profile View Header */
            <>
              <div className="room-modal-header-left">
                <button className="room-modal-back-btn" onClick={handleBackFromProfile}>
                  <FiArrowLeft size={20} />
                </button>
                <span className="room-modal-header-title">{t('browse_modal_profile') || '프로필'}</span>
              </div>
              <div className="room-modal-header-actions">
                <button className="room-modal-close" onClick={onClose} aria-label="Close">
                  <FiX size={24} />
                </button>
              </div>
            </>
          ) : (
            /* Normal Header */
            <>
              <div className="room-modal-header-left">
                <div className="room-modal-badges">
                  {room.status === 'live' && (
                    <span className="room-badge room-badge-live">
                      <span className="live-dot"></span>
                      {t('browse_modal_status_live')}
                    </span>
                  )}
                  {room.status === 'past' && (
                    <span className="room-badge room-badge-past">
                      {t('browse_modal_status_past')}
                    </span>
                  )}
                  {room.status === 'waiting' && (
                    <span className="room-badge room-badge-waiting">
                      {t('browse_modal_status_waiting')}
                    </span>
                  )}
                  {room.isMyRoom && (
                    <span className="room-badge room-badge-my">{t('browse_modal_status_my_room')}</span>
                  )}
                  {room.isJoined && !room.isMyRoom && (
                    <span className="room-badge room-badge-joined">{t('browse_modal_status_joined')}</span>
                  )}
                </div>
                <div className="room-modal-tabs">
                  <button
                    className={`room-modal-tab ${activeTab === 'info' ? 'active' : ''}`}
                    onClick={() => setActiveTab('info')}
                  >
                    <FiInfo size={14} />
                    {t('browse_modal_tab_info') || '정보'}
                  </button>
                  <button
                    className={`room-modal-tab ${activeTab === 'participants' ? 'active' : ''}`}
                    onClick={() => setActiveTab('participants')}
                  >
                    <FiUsers size={14} />
                    {t('browse_modal_tab_participants') || '참가자'}
                    <span className="room-modal-tab-count">{room.participants}</span>
                  </button>
                </div>
              </div>
              <div className="room-modal-header-actions">
                {room.isMyRoom && !isEditMode && (
                  <button className="room-modal-edit" onClick={handleEditClick} aria-label="Edit">
                    <FiEdit2 size={20} />
                  </button>
                )}
                {isEditMode && (
                  <>
                    <button className="room-modal-save" onClick={handleSaveEdit} disabled={isSaving} aria-label="Save">
                      <FiSave size={20} />
                    </button>
                    <button className="room-modal-cancel-edit" onClick={handleCancelEdit} aria-label="Cancel">
                      <FiXCircle size={20} />
                    </button>
                  </>
                )}
                <button className="room-modal-close" onClick={onClose} aria-label="Close">
                  <FiX size={24} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Content - Info Tab */}
        {activeTab === 'info' && (
        <div className="room-modal-content">
          {/* Left: Book Cover + Book Info */}
          <div className="room-modal-cover">
            {/* 3D Book Cover Container */}
            <div className="room-modal-book-wrapper">
              <div className="room-modal-book-container">
                <div className="room-modal-book">
                  <div className="room-modal-book-front">
                    <div className="room-modal-book-cover-inner">
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
                      <p className="room-modal-book-author">{room.book.author}</p>
                    </div>
                  </div>
                  <div className="room-modal-book-spine">
                    <h2><span>{room.book.title}</span></h2>
                  </div>
                </div>
              </div>

              {/* Like Button on Cover */}
              {room.book.isbn && (
                <button
                  className={`room-modal-cover-like ${isFavorited ? 'active' : ''}`}
                  onClick={handleToggleFavorite}
                  disabled={isTogglingFavorite}
                  title={isFavorited ? t('favorites_remove') : t('browse_modal_like_book')}
                >
                  <FiHeart
                    fill={isFavorited ? '#ef4444' : 'none'}
                    stroke={isFavorited ? '#ef4444' : 'currentColor'}
                  />
                </button>
              )}
            </div>

            {/* Book Info */}
            <div className="room-modal-book-info">
              <h3 className="room-modal-section-title">{t('browse_modal_book_info')}</h3>
              <div className="room-modal-info-grid">
                <div className="room-modal-info-item">
                  <span className="room-modal-book-info-label">{t('browse_modal_author')}</span>
                  <span className="room-modal-info-value">{room.book.author}</span>
                </div>
                <div className="room-modal-info-item">
                  <span className="room-modal-book-info-label">{t('browse_modal_genre')}</span>
                  <span className="room-modal-info-value">{room.book.genre}</span>
                </div>
                {room.book.isbn && (
                  <div className="room-modal-info-item">
                    <span className="room-modal-book-info-label">{t('browse_modal_isbn')}</span>
                    <span className="room-modal-info-value">{room.book.isbn}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Details */}
          <div className="room-modal-details">
            <div className="room-modal-title-row">
              <h2 className="room-modal-title">{room.title}</h2>
            </div>

            {/* Room Details, Description, Tags */}
            <div className="room-modal-section-right">
              {/* Room Details */}
              <div className="room-modal-section">
                <h3 className="room-modal-section-title">{t('browse_modal_room_details')}</h3>
                <div className="room-modal-info-grid">
                  <div className="room-modal-info-item">
                    <FiUser size={16} />
                    <span className="room-modal-info-label">{t('browse_modal_host')}</span>
                    <span className="room-modal-info-value">{room.host}</span>
                  </div>

                  {/* Date & Time */}
                  <div className="room-modal-info-item room-modal-info-item-full">
                    <FiCalendar size={16} />
                    <span className="room-modal-info-label">{t('browse_modal_date_time')}</span>
                    {isEditMode ? (
                      <div className="edit-date-time">
                        <input
                          type="date"
                          className="edit-input"
                          value={editForm.date}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                        />
                        <input
                          type="time"
                          className="edit-input"
                          value={editForm.time}
                          onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                        />
                      </div>
                    ) : (
                      <span className="room-modal-info-value">
                        {formatDate(room.dueISO)} at {formatTime(room.dueISO)}
                      </span>
                    )}
                  </div>

                  {/* Duration */}
                  <div className="room-modal-info-item room-modal-info-item-full">
                    <FiClock size={16} />
                    <span className="room-modal-info-label">{t('browse_modal_duration')}</span>
                    {isEditMode ? (
                      <div className="edit-range">
                        <input
                          type="range"
                          min="30"
                          max="180"
                          step="15"
                          value={editForm.duration}
                          onChange={(e) => setEditForm({ ...editForm, duration: parseInt(e.target.value) })}
                        />
                        <span className="range-value">{editForm.duration} min</span>
                      </div>
                    ) : (
                      <span className="room-modal-info-value">{room.duration} {t('browse_modal_minutes')}</span>
                    )}
                  </div>

                  {/* Capacity */}
                  <div className="room-modal-info-item room-modal-info-item-full">
                    <FiUsers size={16} />
                    <span className="room-modal-info-label">{t('browse_modal_capacity')}</span>
                    {isEditMode ? (
                      <div className="edit-capacity-group">
                        <div className="edit-range">
                          <input
                            type="range"
                            min={room.participants}
                            max="20"
                            value={editForm.capacity}
                            onChange={(e) => setEditForm({ ...editForm, capacity: parseInt(e.target.value) })}
                          />
                          <span className="range-value">{editForm.capacity}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="capacity-display-group">
                        <span className="room-modal-info-value">
                          {room.participants}/{room.maxParticipants}
                          {spotsLeft > 0 && (
                            <span className="spots-left"> ({spotsLeft} {t('browse_modal_spots_left')})</span>
                          )}
                        </span>
                        {room.isMyRoom && (
                          room.recruit === false ? (
                            <button
                              type="button"
                              className="open-recruitment-btn"
                              onClick={handleOpenRecruitment}
                            >
                              {t('browse_modal_open_recruitment') || 'Open Recruitment'}
                            </button>
                          ) : spotsLeft > 0 && (
                            <button
                              type="button"
                              className="close-recruitment-btn"
                              onClick={handleCloseRecruitment}
                            >
                              {t('browse_modal_close_recruitment') || 'Close Recruitment'}
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  {/* Level */}
                  <div className="room-modal-info-item room-modal-info-item-full">
                    <span className="room-modal-info-label">{t('browse_modal_level')}</span>
                    {isEditMode ? (
                      <div className="level-buttons">
                        {(['low', 'moderate', 'high'] as const).map((level) => (
                          <button
                            key={level}
                            type="button"
                            className={`level-btn ${editForm.level === level ? 'active' : ''}`}
                            onClick={() => setEditForm({ ...editForm, level })}
                          >
                            {getLevelText(level)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className={`room-level-badge room-level-${room.level}`}>
                        {getLevelText(room.level)}
                      </span>
                    )}
                  </div>

                  {/* Join Type */}
                  <div className="room-modal-info-item room-modal-info-item-full">
                    <span className="room-modal-info-label">{t('browse_modal_join_type')}</span>
                    <span className={`room-join-type-badge room-join-type-${room.joinType?.toLowerCase() || 'open'}`}>
                      {room.joinType === 'APPROVAL'
                        ? (t('browse_modal_join_type_approval') || '승인 가입')
                        : (t('browse_modal_join_type_open') || '자유 가입')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {(room.description || isEditMode) && (
                <div className="room-modal-section">
                  <h3 className="room-modal-section-title">{t('browse_modal_description')}</h3>
                  {isEditMode ? (
                    <textarea
                      className="edit-textarea"
                      rows={4}
                      placeholder={t('browse_modal_description_placeholder') || 'Describe your discussion room...'}
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    />
                  ) : (
                    <p className="room-modal-description">{room.description}</p>
                  )}
                </div>
              )}

                {/* Tags */}
                {(room.tags.length > 0 || isEditMode) && (
                  <div className="room-modal-section">
                    <h3 className="room-modal-section-title">{t('browse_modal_tags')}</h3>
                    {isEditMode ? (
                      <div className="tags-section">
                        <div className="tags-list">
                          {editForm.tags.map((tag, index) => (
                            <span key={index} className="tag tag-editable">
                              {tag}
                              <button type="button" onClick={() => handleRemoveTag(tag)}>×</button>
                            </span>
                          ))}
                        </div>
                        <div className="tag-input-group">
                          <input
                            type="text"
                            className="tag-input"
                            placeholder={t('browse_modal_add_tag') || 'Add a tag...'}
                            value={editForm.newTag}
                            onChange={(e) => setEditForm({ ...editForm, newTag: e.target.value })}
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
                    ) : (
                      <div className="room-modal-tags">
                        {room.tags.map((tag, index) => (
                          <span key={index} className="room-tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
          </div>
        </div>
        )}

        {/* Content - Participants Tab */}
        {activeTab === 'participants' && (
          <div className="room-modal-participants">
            {/* Participants List */}
            <div className="participants-section">
              <h3 className="participants-section-title">
                <FiUsers size={16} />
                {t('browse_modal_participants_list') || '참가자 목록'}
                <span className="participants-count">{participants.length}</span>
              </h3>
              {isLoadingParticipants ? (
                <div className="participants-loading">{t('loading') || '로딩 중...'}</div>
              ) : participants.length === 0 ? (
                <div className="participants-empty">{t('browse_modal_no_participants') || '참가자가 없습니다.'}</div>
              ) : (
                <div className="participants-list">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className={`participant-item ${participant.id !== user?.id ? 'clickable' : ''}`}
                      onClick={(e) => handleParticipantClick(e, participant.id)}
                    >
                      <div className="participant-avatar">
                        {participant.photoUrl ? (
                          <img src={participant.photoUrl} alt={participant.username} />
                        ) : (
                          <FiUser size={20} />
                        )}
                      </div>
                      <span className="participant-username">
                        {participant.username}
                        {participant.id === user?.id && (
                          <span className="participant-me-badge">{t('browse_modal_me') || '나'}</span>
                        )}
                      </span>
                      {participant.isHost && (
                        <span className="participant-host-badge">{t('browse_modal_host') || '호스트'}</span>
                      )}
                      {/* Dropdown Menu */}
                      {openDropdownId === participant.id && participant.id !== user?.id && (
                        <div className="participant-dropdown" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="participant-dropdown-item"
                            onClick={() => handleViewProfile(participant)}
                          >
                            <FiUser size={14} />
                            {t('browse_modal_view_profile') || '프로필 보기'}
                          </button>
                          {room.isMyRoom && !participant.isHost && (
                            <button
                              className="participant-dropdown-item participant-dropdown-item-danger"
                              onClick={() => handleKickMember(participant.id, participant.username)}
                            >
                              <FiUserMinus size={14} />
                              {t('browse_modal_kick') || '강퇴'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Approval List (only for APPROVAL type) */}
            {room.joinType === 'APPROVAL' && (
              <div className="participants-section pending-section">
                <h3 className="participants-section-title">
                  <FiClock size={16} />
                  {t('browse_modal_pending_list') || '승인 대기 목록'}
                  <span className="participants-count">0</span>
                </h3>
                <div className="participants-empty">
                  {t('browse_modal_no_pending') || '승인 대기 중인 요청이 없습니다.'}
                </div>
                {/* TODO: Implement pending requests when backend API is ready */}
                {/* {room.isMyRoom && pendingRequests.map((request) => (
                  <div key={request.id} className="participant-item pending-item">
                    <div className="participant-avatar">...</div>
                    <span className="participant-username">{request.username}</span>
                    <div className="pending-actions">
                      <button className="pending-approve-btn"><FiCheck size={16} /></button>
                      <button className="pending-reject-btn"><FiXOctagon size={16} /></button>
                    </div>
                  </div>
                ))} */}
              </div>
            )}
          </div>
        )}

        {/* Content - Profile Tab */}
        {activeTab === 'profile' && selectedProfile && (
          <div className="room-modal-profile">
            {isLoadingProfile ? (
              <div className="modal-profile-loading">
                <div className="modal-profile-loading-spinner"></div>
                <span>{t('loading') || '로딩 중...'}</span>
              </div>
            ) : profileData ? (
              <div className="modal-profile-content">
                {/* Profile Hero */}
                <div className="modal-profile-hero">
                  <div className="modal-profile-avatar-wrapper">
                    {selectedProfile.photoUrl ? (
                      <img src={selectedProfile.photoUrl} alt={selectedProfile.username} className="modal-profile-avatar" />
                    ) : (
                      <div className="modal-profile-avatar modal-profile-avatar-placeholder">
                        <FiUser size={32} />
                      </div>
                    )}
                    <div className="modal-profile-avatar-badge">
                      <i className="ri-star-fill"></i>
                    </div>
                  </div>
                  <div className="modal-profile-info">
                    <h2 className="modal-profile-name">{profileData.username}</h2>
                    {profileData.email && (
                      <p className="modal-profile-handle">@{profileData.email.split('@')[0]}</p>
                    )}
                    {/* Rating Stars */}
                    <div className="modal-profile-rating">
                      <div className="modal-profile-stars">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <i
                            key={star}
                            className={star <= Math.round(profileReputation?.endorsementStats?.averageScore || 0) ? 'ri-star-fill' : 'ri-star-line'}
                          ></i>
                        ))}
                      </div>
                      <span className="modal-profile-rating-score">
                        {(profileReputation?.endorsementStats?.averageScore || 0).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="modal-profile-stats">
                  <div className="modal-profile-stat-card">
                    <div className="modal-profile-stat-value">
                      {profileReputation?.participationStats?.totalMeetings ||
                        (profileData.posts?.participated?.length || 0) + (profileData.posts?.created?.length || 0)}
                    </div>
                    <div className="modal-profile-stat-label">{t('profile_meetings') || '총 모임'}</div>
                  </div>
                  <div className="modal-profile-stat-card">
                    <div className="modal-profile-stat-value">
                      {profileReputation?.participationStats?.totalConfirmed || 0}
                    </div>
                    <div className="modal-profile-stat-label">{t('profile_total_attendance') || '총 참석'}</div>
                  </div>
                  <div className="modal-profile-stat-card">
                    <div className="modal-profile-stat-value modal-profile-stat-amber">
                      {profileReputation?.endorsementStats?.points || 0}
                    </div>
                    <div className="modal-profile-stat-label">{t('profile_stat_points') || '포인트'}</div>
                  </div>
                </div>

                {/* Profile Tabs Content - Reusable Component */}
                <ProfileTabsContent
                  userData={profileData}
                  reputationData={profileReputation}
                  activeTab={activeProfileTab}
                  onTabChange={setActiveProfileTab}
                  variant="compact"
                />
              </div>
            ) : (
              <div className="modal-profile-error">
                {t('profile_load_error') || '프로필을 불러올 수 없습니다.'}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="room-modal-actions">
          {/* 종료된 미팅 - 노트 보기 버튼 (참가자/주최자만) */}
          {!isEditMode && (room.isJoined || room.isMyRoom) && room.status === 'past' && (
            <button
              className="room-modal-btn room-modal-btn-notes"
              onClick={handleViewNotes}
            >
              <FiEdit3 size={18} />
              {t('notes_view_note') || 'View Notes'}
              <FiArrowRight size={18} />
            </button>
          )}
          {/* Enter Meeting 버튼 - 참가자/주최자만 표시 (종료되지 않은 미팅) */}
          {!isEditMode && (room.isJoined || room.isMyRoom) && room.status !== 'past' && (
            <button
              className="room-modal-btn room-modal-btn-enter"
              onClick={handleEnterMeeting}
              disabled={isEntering}
            >
              <FiVideo size={18} />
              {isEntering ? t('loading') : t('browse_modal_enter_meeting') || 'Enter Meeting'}
            </button>
          )}
          {/* Google Meet 직접 열기 (종료되지 않은 미팅만) */}
          {!isEditMode && (room.isJoined || room.isMyRoom) && room.meetLink && room.status !== 'past' && (
            <button className="room-modal-btn room-modal-btn-meet" onClick={handleOpenMeet}>
              <FiExternalLink size={18} />
              {t('browse_modal_open_meet')}
            </button>
          )}
          {/* 참가하기/예약하기 버튼 - 비참가자만 표시 */}
          {!isEditMode && !room.isJoined && !room.isMyRoom && (
            <button
              className="room-modal-btn room-modal-btn-primary"
              onClick={handleJoinClick}
              disabled={isProcessing || spotsLeft <= 0 || room.status === 'past' || room.recruit === false}
              style={room.recruit === false ? { backgroundColor: '#9ca3af', cursor: 'not-allowed', opacity: 0.6 } : {}}
            >
              {isProcessing ? t('loading') : (
                room.status === 'past'
                  ? t('browse_card_ended')
                  : room.recruit === false
                    ? t('browse_modal_recruitment_closed')
                    : (room.status === 'live' || room.status === 'waiting')
                      ? t('browse_card_join_now')
                      : t('browse_card_reserve')
              )}
            </button>
          )}
          {!isEditMode && (
            <button className="room-modal-btn room-modal-btn-secondary" onClick={handleCreateSimilar}>
              {t('browse_modal_create_similar')}
            </button>
          )}
          {/* 삭제 버튼 - 주최자만 표시 */}
          {!isEditMode && room.isMyRoom && onDelete && (
            <button
              className="room-modal-btn room-modal-btn-danger"
              onClick={handleDelete}
              disabled={isProcessing}
            >
              <FiTrash2 size={18} />
              {t('browse_modal_delete')}
            </button>
          )}
          {/* 탈퇴하기 버튼 - 참가자만 표시 (주최자 제외) */}
          {!isEditMode && room.isJoined && !room.isMyRoom && (
            <button
              className="room-modal-btn room-modal-btn-danger"
              onClick={handleLeave}
              disabled={isLeaving}
            >
              <FiLogOut size={18} />
              {isLeaving ? t('loading') : t('browse_modal_leave')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomModal;
