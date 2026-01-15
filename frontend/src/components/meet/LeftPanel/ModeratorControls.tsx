import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiVideo,
  FiInfo,
  FiX,
  FiUser,
  FiClock,
  FiPlus,
  FiMove,
} from 'react-icons/fi';
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
import { SpeakingQueue, QueuedParticipant } from '../../../types/meetRoom';
import '../styles/LeftPanel.css';

interface ModeratorControlsProps {
  meetLink: string | null;
  queue: SpeakingQueue | null;
  isHost: boolean;
  hasRaisedHand: boolean;
  onOpenMeet: () => void;
  onRaiseHand: () => void;
  onNextSpeaker: () => void;
  onRemoveFromQueue: (userId: string) => void;
  onAddParticipantToQueue: (userId: string, username: string, photoUrl: string) => void;
  onReorderQueue: (userIds: string[]) => void;
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
  meetLink,
  queue,
  isHost,
  hasRaisedHand,
  onOpenMeet,
  onRaiseHand,
  onNextSpeaker,
  onRemoveFromQueue,
  onAddParticipantToQueue,
  onReorderQueue,
}) => {
  const { t } = useTranslation();
  const [speakerTime, setSpeakerTime] = useState('0:00');

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
      {/* Google Meet Button */}
      <button
        className="meet-join-button"
        onClick={onOpenMeet}
        disabled={!meetLink}
      >
        <FiVideo size={20} />
        <span>{t('meet_join_google_meet') || 'Join Google Meet'}</span>
      </button>
      {meetLink && (
        <p className="meet-join-hint">
          {t('meet_join_hint') || 'Opens video conference in new tab'}
        </p>
      )}

      {/* Discussion Rules */}
      <div className="rules-card">
        <div className="rules-header">
          <FiInfo size={16} />
          <h3>{t('meet_discussion_rules') || 'Discussion Rules'}</h3>
        </div>
        <ul className="rules-list">
          <li>{t('meet_rule_1') || 'One person speaks at a time'}</li>
          <li>{t('meet_rule_2') || 'Moderator manages the queue'}</li>
          <li>{t('meet_rule_3') || 'Raise hand to speak'}</li>
          <li>{t('meet_rule_4') || '3 minute speaking limit'}</li>
        </ul>
      </div>

      {/* Raise Hand Button */}
      <button
        className={`raise-hand-button ${hasRaisedHand ? 'active' : ''}`}
        onClick={onRaiseHand}
      >
        <span className="hand-icon">{hasRaisedHand ? '✋' : '🖐️'}</span>
        <span>{hasRaisedHand ? t('meet_hand_raised') || 'Hand Raised!' : t('meet_raise_hand') || 'Raise Hand!'}</span>
      </button>

      {/* Current Speaker */}
      {queue?.currentSpeaker && (
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

      {/* Speaking Queue */}
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

      {/* Participants */}
      <div className="participants-section">
        <div className="participants-header">
          <h3>
            <FiUser size={14} />
            {t('meet_participants') || 'Participants'} ({queue?.participants?.length || 0})
          </h3>
        </div>
        <ul className="participants-list">
          {queue?.participants?.map((participant) => {
            // Check if participant is already in queue or is current speaker
            const isInQueue = queue.queue?.some((q) => q.userId === participant.userId) || false;
            const isCurrentSpeaker = queue.currentSpeaker?.userId === participant.userId;
            const canAddToQueue = isHost && !isInQueue && !isCurrentSpeaker && !participant.hasRaisedHand;

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
                {participant.isHost && (
                  <span className="host-badge">{t('meet_host') || 'Host'}</span>
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
                <span className={`online-status ${participant.isOnline ? 'online' : 'offline'}`}></span>
              </li>
            );
          })}
        </ul>
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
    </div>
  );
};

export default ModeratorControls;
