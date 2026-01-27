import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiX,
  FiUser,
  FiClock,
  FiPlus,
  FiMove,
  FiUserCheck,
  FiUserX,
  FiMoreVertical,
  FiRotateCcw,
  FiSlash,
  FiFlag,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';
import { RiHandHeartLine } from 'react-icons/ri';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SpeakingQueue, QueuedParticipant, VoiceChatMode } from '../../../types/meetRoom';
import '../styles/LeftPanel.css';

// 강퇴된 유저 정보
export interface BlockedUser {
  userId: string;
  username: string;
}

interface ModeratorControlsProps {
  queue: SpeakingQueue | null;
  voiceChatMode: VoiceChatMode;
  isHost: boolean;
  isCreator: boolean;  // 방 생성자 여부 (강퇴 권한)
  currentUserId: string;
  hasRaisedHand: boolean;
  blockedUsers?: BlockedUser[];  // 강퇴된 유저 목록
  reportedUserIds?: string[];    // 이미 신고한 유저 ID 목록
  onRaiseHand: () => void;
  onNextSpeaker: () => void;
  onRemoveFromQueue: (userId: string) => void;
  onAddParticipantToQueue: (userId: string, username: string, photoUrl: string) => void;
  onReorderQueue: (userIds: string[]) => void;
  onDelegateModerator: (newModeratorId: string) => void;
  onKickParticipant?: (userId: string) => void;  // 강퇴 핸들러
  onRestoreParticipant?: (userId: string) => void;  // 복구 핸들러
  onReportParticipant?: (userId: string, username: string) => void;  // 신고 핸들러
}

// Sortable Queue Item Component
interface SortableQueueItemProps {
  participant: QueuedParticipant;
  index: number;
  isHost: boolean;
  onRemove: (userId: string) => void;
}

const SortableQueueItem: React.FC<SortableQueueItemProps> = ({
  participant,
  index,
  isHost,
  onRemove,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: participant.userId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="queue-item"
    >
      <span className="queue-position">{index + 1}</span>
      {participant.photoUrl ? (
        <img
          src={participant.photoUrl}
          alt={participant.username}
          className="queue-avatar"
        />
      ) : (
        <div className="queue-avatar-placeholder">
          <FiUser size={14} />
        </div>
      )}
      <span className="queue-name">{participant.username}</span>
      {isHost && (
        <>
          <button
            className="queue-drag-handle"
            {...attributes}
            {...listeners}
          >
            <FiMove size={14} />
          </button>
          <button
            className="queue-remove-btn"
            onClick={() => onRemove(participant.userId)}
          >
            <FiX size={14} />
          </button>
        </>
      )}
    </li>
  );
};

const ModeratorControls: React.FC<ModeratorControlsProps> = ({
  queue,
  voiceChatMode,
  isHost,
  isCreator,
  currentUserId,
  hasRaisedHand,
  blockedUsers,
  reportedUserIds,
  onRaiseHand,
  onNextSpeaker,
  onRemoveFromQueue,
  onAddParticipantToQueue,
  onReorderQueue,
  onDelegateModerator,
  onKickParticipant,
  onRestoreParticipant,
  onReportParticipant,
}) => {
  const { t } = useTranslation();
  const [speakerTime, setSpeakerTime] = useState('0:00');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [showOfflineParticipants, setShowOfflineParticipants] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKick = (userId: string) => {
    if (onKickParticipant) {
      onKickParticipant(userId);
    }
    setOpenDropdownId(null);
  };

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && queue?.queue) {
      const oldIndex = queue.queue.findIndex((p) => p.userId === active.id);
      const newIndex = queue.queue.findIndex((p) => p.userId === over.id);

      const reorderedQueue = arrayMove(queue.queue, oldIndex, newIndex);
      const userIds = reorderedQueue.map((p) => p.userId);
      onReorderQueue(userIds);
    }
  };

  const handleAddToQueue = (userId: string, username: string, photoUrl: string) => {
    onAddParticipantToQueue(userId, username, photoUrl);
  };

  // Format duration in seconds to mm:ss
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format time to HH:MM:SS
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // Real-time speaker time update
  useEffect(() => {
    if (!queue?.currentSpeaker?.startedAt) {
      setSpeakerTime('0:00');
      return;
    }

    const updateTime = () => {
      const start = new Date(queue.currentSpeaker!.startedAt).getTime();
      const now = Date.now();
      const seconds = Math.floor((now - start) / 1000);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      setSpeakerTime(`${minutes}:${secs.toString().padStart(2, '0')}`);
    };

    // Update immediately
    updateTime();

    // Update every second
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [queue?.currentSpeaker?.startedAt]);

  return (
    <div className="moderator-controls">
      {/* Raise Hand Button - only in RULES mode */}
      {voiceChatMode === 'RULES' && (
        <button
          className={`raise-hand-button ${hasRaisedHand ? 'active' : ''}`}
          onClick={onRaiseHand}
        >
          <div className="hand-icon">
            <RiHandHeartLine size={24} />
          </div>
          <span>{hasRaisedHand ? t('meet_hand_raised') || 'Hand Raised!' : t('meet_raise_hand') || 'Raise Hand!'}</span>
        </button>
      )}

      {/* Current Speaker - only in RULES mode */}
      {voiceChatMode === 'RULES' && queue?.currentSpeaker && (
        <div className="current-speaker-card">
          <div className="speaker-header">
            <span className="speaker-label">{t('meet_current_speaker') || 'Current Speaker'}</span>
            <span className="speaker-time">{speakerTime}</span>
          </div>
          <div className="speaker-info">
            {queue.currentSpeaker.photoUrl ? (
              <img
                src={queue.currentSpeaker.photoUrl}
                alt={queue.currentSpeaker.username}
                className="speaker-avatar"
              />
            ) : (
              <div className="speaker-avatar-placeholder">
                <FiUser size={20} />
              </div>
            )}
            <span className="speaker-name">{queue.currentSpeaker.username}</span>
          </div>
          {isHost && (
            <button className="next-speaker-btn" onClick={onNextSpeaker}>
              {t('meet_next_speaker') || 'Next Speaker'}
            </button>
          )}
        </div>
      )}

      {/* Speaking Queue - only in RULES mode */}
      {voiceChatMode === 'RULES' && (
        <div className="queue-section">
          <div className="queue-header">
            <h3>{t('meet_speaking_queue') || 'Speaking Queue'} ({queue?.queue?.length || 0})</h3>
            {isHost && queue?.queue?.length && queue.queue.length > 0 && (
              <button className="queue-next-btn" onClick={onNextSpeaker}>
                {t('meet_next') || 'Next'}
              </button>
            )}
          </div>
          {queue?.queue && queue.queue.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={queue.queue.map((p) => p.userId)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="queue-list">
                  {queue.queue.map((participant, index) => (
                    <SortableQueueItem
                      key={participant.userId}
                      participant={participant}
                      index={index}
                      isHost={isHost}
                      onRemove={onRemoveFromQueue}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          ) : (
            <p className="queue-empty">{t('meet_queue_empty') || 'No one in queue'}</p>
          )}
        </div>
      )}

      {/* Participants - only show online participants */}
      <div className="participants-section" ref={dropdownRef}>
        <div className="participants-header">
          <h3>
            <FiUser size={14} />
            {t('meet_participants') || 'Participants'} ({queue?.participants?.filter(p => p.isOnline).length || 0})
          </h3>
          {queue?.participants?.some(p => !p.isOnline) && (
            <button
              className={`offline-toggle-btn ${showOfflineParticipants ? 'active' : ''}`}
              onClick={() => setShowOfflineParticipants(!showOfflineParticipants)}
            >
              <span className="offline-indicator"></span>
              <span className="offline-count">{queue.participants.filter(p => !p.isOnline).length}</span>
              {showOfflineParticipants ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
            </button>
          )}
        </div>
        <ul className="participants-list">
          {queue?.participants?.filter(p => p.isOnline).map((participant) => {
            // Check if participant is already in queue or is current speaker
            const isInQueue = queue.queue?.some((q) => q.userId === participant.userId) || false;
            const isCurrentSpeaker = queue.currentSpeaker?.userId === participant.userId;
            const canAddToQueue = isHost && !isInQueue && !isCurrentSpeaker && !participant.hasRaisedHand;
            // Check if participant is the current moderator
            const isModerator = queue.moderatorId === participant.userId;
            // Can delegate to this participant (not self, not already moderator)
            const canDelegate = isHost && !isModerator && participant.userId !== currentUserId;
            // Can kick: creator only, not self
            const canKick = isCreator && participant.userId !== currentUserId;
            // Can report: anyone except self, and not already reported
            const canReport = participant.userId !== currentUserId;
            const alreadyReported = reportedUserIds?.includes(participant.userId) || false;
            const isDropdownOpen = openDropdownId === participant.userId;

            return (
              <li key={participant.userId} className="participant-item">
                {participant.photoUrl ? (
                  <img
                    src={participant.photoUrl}
                    alt={participant.username}
                    className="participant-avatar"
                  />
                ) : (
                  <div className="participant-avatar-placeholder">
                    <FiUser size={14} />
                  </div>
                )}
                <span className="participant-name">{participant.username}</span>
                {isModerator && (
                  <span className="moderator-badge">{t('meet_moderator') || 'Moderator'}</span>
                )}
                {participant.hasRaisedHand && (
                  <span className="hand-indicator">✋</span>
                )}
                {canAddToQueue && (
                  <button
                    className="add-to-queue-btn"
                    onClick={() => handleAddToQueue(participant.userId, participant.username, participant.photoUrl)}
                    title={t('meet_add_to_queue') || 'Add to queue'}
                  >
                    <FiPlus size={14} />
                  </button>
                )}
                {canDelegate && (
                  <button
                    className="delegate-btn"
                    onClick={() => onDelegateModerator(participant.userId)}
                    title={t('meet_delegate_moderator') || 'Delegate moderator'}
                  >
                    <FiUserCheck size={14} />
                  </button>
                )}
                <span className={`online-status ${participant.isOnline ? 'online' : 'offline'}`}></span>

                {/* More options dropdown (for creator or report) */}
                {(canKick || canReport) && (
                  <div className="participant-more-wrapper">
                    <button
                      className="participant-more-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(isDropdownOpen ? null : participant.userId);
                      }}
                      title={t('meet_more_options') || 'More options'}
                    >
                      <FiMoreVertical size={14} />
                    </button>
                    {isDropdownOpen && (
                      <div className="participant-dropdown">
                        {canKick && (
                          <button
                            className="participant-dropdown-item kick"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleKick(participant.userId);
                            }}
                          >
                            <FiUserX size={14} />
                            <span>{t('meet_kick_participant') || 'Kick'}</span>
                          </button>
                        )}
                        {canReport && (
                          <button
                            className={`participant-dropdown-item report ${alreadyReported ? 'disabled' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!alreadyReported && onReportParticipant) {
                                onReportParticipant(participant.userId, participant.username);
                                setOpenDropdownId(null);
                              }
                            }}
                            disabled={alreadyReported}
                          >
                            <FiFlag size={14} />
                            <span>
                              {alreadyReported
                                ? (t('meet_already_reported') || 'Already Reported')
                                : (t('meet_report_participant') || 'Report')}
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Offline Participants List */}
        {queue?.participants?.some(p => !p.isOnline) && (
          <div className={`offline-participants-section ${showOfflineParticipants ? 'expanded' : ''}`}>
              <div className="offline-participants-content">
                <div className="offline-participants-header">
                  <h4>{t('meet_offline_participants') || 'Offline'} ({queue.participants.filter(p => !p.isOnline).length})</h4>
                </div>
                <ul className="offline-participants-list">
                  {queue.participants.filter(p => !p.isOnline).map((participant) => {
                    const canKick = isCreator && participant.userId !== currentUserId;
                    const canReport = participant.userId !== currentUserId;
                    const alreadyReported = reportedUserIds?.includes(participant.userId) || false;
                    const isDropdownOpen = openDropdownId === `offline-${participant.userId}`;

                    return (
                      <li key={participant.userId} className="participant-item offline">
                        {participant.photoUrl ? (
                          <img
                            src={participant.photoUrl}
                            alt={participant.username}
                            className="participant-avatar"
                          />
                        ) : (
                          <div className="participant-avatar-placeholder">
                            <FiUser size={14} />
                          </div>
                        )}
                        <span className="participant-name">{participant.username}</span>
                        <span className="online-status offline"></span>

                        {/* More options dropdown for offline participants */}
                        {(canKick || canReport) && (
                          <div className="participant-more-wrapper">
                            <button
                              className="participant-more-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownId(isDropdownOpen ? null : `offline-${participant.userId}`);
                              }}
                              title={t('meet_more_options') || 'More options'}
                            >
                              <FiMoreVertical size={14} />
                            </button>
                            {isDropdownOpen && (
                              <div className="participant-dropdown">
                                {canKick && (
                                  <button
                                    className="participant-dropdown-item kick"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleKick(participant.userId);
                                    }}
                                  >
                                    <FiUserX size={14} />
                                    <span>{t('meet_kick_participant') || 'Kick'}</span>
                                  </button>
                                )}
                                {canReport && (
                                  <button
                                    className={`participant-dropdown-item report ${alreadyReported ? 'disabled' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!alreadyReported && onReportParticipant) {
                                        onReportParticipant(participant.userId, participant.username);
                                        setOpenDropdownId(null);
                                      }
                                    }}
                                    disabled={alreadyReported}
                                  >
                                    <FiFlag size={14} />
                                    <span>
                                      {alreadyReported
                                        ? (t('meet_already_reported') || 'Already Reported')
                                        : (t('meet_report_participant') || 'Report')}
                                    </span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
        )}
      </div>

      {/* Speaking Log */}
      <div className="speaking-log-section">
        <div className="speaking-log-header">
          <h3>
            <FiClock size={14} />
            {t('meet_speaking_log') || 'Speaking Log'} ({queue?.speakingHistory?.length || 0})
          </h3>
        </div>
        {queue?.speakingHistory && queue.speakingHistory.length > 0 ? (
          <ul className="speaking-log-list">
            {queue.speakingHistory.map((entry, index) => (
              <li key={`${entry.userId}-${entry.startTime}-${index}`} className="speaking-log-item">
                <div className="log-time">{formatTime(entry.startTime)}</div>
                <div className="log-details">
                  <span className="log-username">{entry.username}</span>
                  <span className="log-duration">{formatDuration(entry.durationSeconds)}</span>
                  <span className="log-count">#{entry.speakCount}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="speaking-log-empty">{t('meet_log_empty') || 'No speaking history yet'}</p>
        )}
      </div>

      {/* Kicked Users Section - Only visible to room creator */}
      {isCreator && blockedUsers && blockedUsers.length > 0 && (
        <div className="kicked-users-section">
          <div className="kicked-users-header">
            <h3>
              <FiSlash size={14} />
              {t('meet_kicked_users') || 'Kicked Users'} ({blockedUsers.length})
            </h3>
          </div>
          <ul className="kicked-users-list">
            {blockedUsers.map((blockedUser) => (
              <li key={blockedUser.userId} className="kicked-user-item">
                <div className="kicked-user-avatar-placeholder">
                  <FiUserX size={14} />
                </div>
                <span className="kicked-user-name">{blockedUser.username}</span>
                <button
                  className="restore-btn"
                  onClick={() => onRestoreParticipant?.(blockedUser.userId)}
                  title={t('meet_restore_user') || 'Restore user'}
                >
                  <FiRotateCcw size={14} />
                  <span>{t('meet_restore') || 'Restore'}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ModeratorControls;
