import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiVideo,
  FiInfo,
  FiX,
  FiUser,
} from 'react-icons/fi';
import { SpeakingQueue } from '../../../types/meetRoom';
import '../styles/LeftPanel.css';

interface ModeratorControlsProps {
  meetLink: string | null;
  queue: SpeakingQueue | null;
  isHost: boolean;
  hasRaisedHand: boolean;
  onOpenMeet: () => void;
  onRaiseHand: () => void;
  onNextSpeaker: () => void;
  onRemoveFromQueue: (odUserId: string) => void;
}

const ModeratorControls: React.FC<ModeratorControlsProps> = ({
  meetLink,
  queue,
  isHost,
  hasRaisedHand,
  onOpenMeet,
  onRaiseHand,
  onNextSpeaker,
  onRemoveFromQueue,
}) => {
  const { t } = useTranslation();

  // Calculate speaker time
  const getSpeakerTime = () => {
    if (!queue?.currentSpeaker?.startedAt) return '0:00';
    const start = new Date(queue.currentSpeaker.startedAt).getTime();
    const now = Date.now();
    const seconds = Math.floor((now - start) / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

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
            <span className="speaker-time">{getSpeakerTime()}</span>
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
          <ul className="queue-list">
            {queue.queue.map((participant, index) => (
              <li key={participant.odUserId} className="queue-item">
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
                  <button
                    className="queue-remove-btn"
                    onClick={() => onRemoveFromQueue(participant.odUserId)}
                  >
                    <FiX size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
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
          {queue?.participants?.map((participant) => (
            <li key={participant.odUserId} className="participant-item">
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
              <span className={`online-status ${participant.isOnline ? 'online' : 'offline'}`}></span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ModeratorControls;
