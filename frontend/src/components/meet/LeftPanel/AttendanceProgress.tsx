import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiCheckCircle,
  FiClock,
  FiMessageCircle,
  FiEdit3,
  FiThumbsUp,
  FiCalendar,
} from 'react-icons/fi';
import {
  AttendanceRecord,
  calculateConfirmationProgress,
  getRemainingSpechSec,
  getRemainingNoteChars,
  getAttendanceTypeLabel,
} from '../../../api/attendance';
import './AttendanceProgress.css';

interface AttendanceProgressProps {
  attendance: AttendanceRecord | null;
  meetingStartTime?: string | null; // ISO date string (post.due)
  isLoading?: boolean;
}

// 10 minutes in milliseconds
const TEN_MINUTES_MS = 10 * 60 * 1000;

const AttendanceProgress: React.FC<AttendanceProgressProps> = ({
  attendance,
  meetingStartTime,
  isLoading = false,
}) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  // Countdown state
  const [timeRemaining, setTimeRemaining] = useState<{
    days: number;
    hours: number;
    minutes: number;
    totalMs: number;
  } | null>(null);

  // Calculate time remaining until meeting start
  useEffect(() => {
    if (!meetingStartTime) {
      setTimeRemaining(null);
      return;
    }

    const calculateTimeRemaining = () => {
      const now = new Date();
      const startTime = new Date(meetingStartTime);
      const diffMs = startTime.getTime() - now.getTime();

      if (diffMs <= 0) {
        // Meeting has started
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, totalMs: 0 });
        return;
      }

      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      setTimeRemaining({ days, hours, minutes, totalMs: diffMs });
    };

    // Calculate immediately
    calculateTimeRemaining();

    // Update every 30 seconds
    const interval = setInterval(calculateTimeRemaining, 30000);

    return () => clearInterval(interval);
  }, [meetingStartTime]);

  // Check if we should show countdown (more than 10 minutes before meeting)
  const showCountdown = timeRemaining && timeRemaining.totalMs > TEN_MINUTES_MS;

  if (isLoading) {
    return (
      <div className="attendance-progress">
        <div className="attendance-progress-loading">
          <FiClock className="attendance-progress-loading-icon" />
          <span>{t('loading')}</span>
        </div>
      </div>
    );
  }

  // Show countdown when more than 10 minutes before meeting
  if (showCountdown) {
    const { days, hours, minutes } = timeRemaining;
    return (
      <div className="attendance-progress countdown">
        <div className="attendance-progress-header">
          <div className="attendance-progress-title">
            <FiCalendar className="attendance-progress-icon pending" />
            <span>{t('attendance_waiting') || 'Waiting for Meeting'}</span>
          </div>
        </div>
        <div className="attendance-countdown">
          <div className="attendance-countdown-time">
            {language === 'ko' ? (
              <>
                {days > 0 && <span className="countdown-segment">{days}일 </span>}
                {(days > 0 || hours > 0) && <span className="countdown-segment">{hours}시간 </span>}
                <span className="countdown-segment">{minutes}분</span>
              </>
            ) : (
              <>
                {days > 0 && <span className="countdown-segment">{days}d </span>}
                {(days > 0 || hours > 0) && <span className="countdown-segment">{hours}h </span>}
                <span className="countdown-segment">{minutes}m</span>
              </>
            )}
          </div>
          <p className="attendance-countdown-label">
            {t('attendance_time_remaining') || 'remaining until meeting starts'}
          </p>
        </div>
        <div className="attendance-progress-message">
          <p className="attendance-progress-hint">
            {t('attendance_countdown_hint') || 'Attendance tracking will begin 10 minutes before the meeting starts.'}
          </p>
        </div>
      </div>
    );
  }

  if (!attendance) {
    // Show initial state when attendance hasn't loaded yet
    return (
      <div className="attendance-progress">
        <div className="attendance-progress-header">
          <div className="attendance-progress-title">
            <FiClock className="attendance-progress-icon pending" />
            <span>{t('attendance_tracking') || 'Attendance Tracking'}</span>
          </div>
        </div>
        <div className="attendance-progress-message">
          <p className="attendance-progress-hint">
            {t('attendance_initializing') || 'Preparing attendance tracking...'}
          </p>
        </div>
      </div>
    );
  }

  const isConfirmed = attendance.status === 'CONFIRMED';
  const progress = calculateConfirmationProgress(attendance);
  const progressPercent = Math.round(progress * 100);
  const hasRaisedHand = attendance.milestones?.handRaised ?? false;

  const remainingSpeechSec = getRemainingSpechSec(attendance);
  const remainingNoteChars = getRemainingNoteChars(attendance);

  // Format remaining speech time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  return (
    <div className={`attendance-progress ${isConfirmed ? 'confirmed' : ''}`}>
      {/* Header */}
      <div className="attendance-progress-header">
        <div className="attendance-progress-title">
          {isConfirmed ? (
            <>
              <FiCheckCircle className="attendance-progress-icon confirmed" />
              <span>{t('attendance_confirmed') || 'Attendance Confirmed'}</span>
            </>
          ) : (
            <>
              <FiClock className="attendance-progress-icon pending" />
              <span>{t('attendance_tracking') || 'Attendance Tracking'}</span>
            </>
          )}
        </div>
        <div className="attendance-progress-badge">
          {getAttendanceTypeLabel(attendance.attendanceType, language)}
        </div>
      </div>

      {/* Progress Bar */}
      {!isConfirmed && (
        <div className="attendance-progress-bar-container">
          <div className="attendance-progress-bar">
            <div
              className="attendance-progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="attendance-progress-percent">{progressPercent}%</span>
        </div>
      )}

      {/* Status Message */}
      <div className="attendance-progress-message">
        {isConfirmed ? (
          <p className="attendance-progress-success">
            {t('attendance_confirmed_message') ||
              'Your participation has been confirmed.'}
          </p>
        ) : (
          <p className="attendance-progress-hint">
            {t('attendance_hint') ||
              'Participate in the discussion to confirm your attendance.'}
          </p>
        )}
      </div>

      {/* Milestones */}
      <div className="attendance-progress-milestones">
        {/* Speaking */}
        <div className={`attendance-milestone ${attendance.activities.speechSec > 0 ? 'achieved' : ''}`}>
          <FiMessageCircle className="attendance-milestone-icon" />
          <div className="attendance-milestone-info">
            <span className="attendance-milestone-label">
              {t('attendance_speaking') || 'Speaking'}
            </span>
            <span className="attendance-milestone-value">
              {attendance.activities.speechSec > 0 ? (
                <>
                  {formatTime(Math.round(attendance.activities.speechSec))}
                  {!isConfirmed && remainingSpeechSec > 0 && (
                    <span className="attendance-milestone-remaining">
                      {' '}({formatTime(remainingSpeechSec)} {t('attendance_remaining') || 'left'})
                    </span>
                  )}
                </>
              ) : (
                <span className="attendance-milestone-empty">
                  {t('attendance_not_yet') || 'Not yet'}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Notes */}
        <div className={`attendance-milestone ${attendance.activities.noteCharCount > 0 ? 'achieved' : ''}`}>
          <FiEdit3 className="attendance-milestone-icon" />
          <div className="attendance-milestone-info">
            <span className="attendance-milestone-label">
              {t('attendance_notes') || 'Notes'}
            </span>
            <span className="attendance-milestone-value">
              {attendance.activities.noteCharCount > 0 ? (
                <>
                  {attendance.activities.noteCharCount} {t('attendance_chars') || 'chars'}
                  {!isConfirmed && remainingNoteChars > 0 && (
                    <span className="attendance-milestone-remaining">
                      {' '}({remainingNoteChars} {t('attendance_remaining') || 'left'})
                    </span>
                  )}
                </>
              ) : (
                <span className="attendance-milestone-empty">
                  {t('attendance_not_yet') || 'Not yet'}
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Hand Raised Bonus */}
        <div className={`attendance-milestone bonus ${hasRaisedHand ? 'achieved' : ''}`}>
          <FiThumbsUp className="attendance-milestone-icon" />
          <div className="attendance-milestone-info">
            <span className="attendance-milestone-label">
              {t('attendance_hand_raised') || 'Hand Raised'}
            </span>
            <span className="attendance-milestone-value">
              {hasRaisedHand ? (
                <span className="attendance-milestone-bonus">
                  -20% {t('attendance_threshold') || 'threshold'}
                </span>
              ) : (
                <span className="attendance-milestone-empty">
                  {t('attendance_optional') || 'Optional bonus'}
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Tip */}
      {!isConfirmed && (
        <div className="attendance-progress-tip">
          <span>
            {t('attendance_tip') ||
              'Speak for 2 minutes or write 25 characters in notes to confirm.'}
          </span>
        </div>
      )}
    </div>
  );
};

export default AttendanceProgress;
