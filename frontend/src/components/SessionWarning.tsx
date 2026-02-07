import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext/AuthContext';
import './styles/SessionWarning.css';

const SessionWarning: React.FC = () => {
  const { t } = useTranslation();
  const { sessionWarning, remainingTime, extendSession, handleLogout } = useAuth();

  if (!sessionWarning) {
    return null;
  }

  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;
  const timeDisplay = minutes > 0
    ? `${minutes}:${seconds.toString().padStart(2, '0')}`
    : `${seconds} ${t('session_seconds')}`;

  return (
    <div className="session-warning-overlay">
      <div className="session-warning-modal">
        <div className="session-warning-icon">⚠️</div>
        <h2 className="session-warning-title">{t('session_warning_title')}</h2>
        <p className="session-warning-message">{t('session_warning_message')}</p>
        <div className="session-warning-timer">
          <span className="timer-label">{t('session_remaining_time')}:</span>
          <span className="timer-value">{timeDisplay}</span>
        </div>
        <div className="session-warning-actions">
          <button
            className="session-extend-button"
            onClick={extendSession}
          >
            {t('session_extend')}
          </button>
          <button
            className="session-logout-button"
            onClick={handleLogout}
          >
            {t('session_logout')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionWarning;
