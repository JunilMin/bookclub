import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiX, FiAlertTriangle, FiLoader } from 'react-icons/fi';
import './styles/EndMeetingModal.css';

interface EndMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const EndMeetingModal: React.FC<EndMeetingModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsEnding(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err: any) {
      console.error('Failed to end meeting:', err);
      setError(err.message || t('meet_end_error') || 'Failed to end meeting');
      setIsEnding(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isEnding) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="end-meeting-modal-overlay" onClick={handleBackdropClick}>
      <div className="end-meeting-modal">
        <div className="end-meeting-modal-header">
          <div className="end-meeting-modal-icon">
            <FiAlertTriangle size={32} />
          </div>
          <button
            className="end-meeting-modal-close"
            onClick={onClose}
            disabled={isEnding}
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="end-meeting-modal-content">
          <h2>{t('meet_end_title') || 'End Meeting?'}</h2>
          <p>
            {t('meet_end_description') ||
              'Once ended, all participants will be redirected out of the meeting room. This action cannot be undone.'}
          </p>
        </div>

        {error && (
          <div className="end-meeting-modal-error">
            <FiAlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="end-meeting-modal-actions">
          <button
            className="end-meeting-cancel-btn"
            onClick={onClose}
            disabled={isEnding}
          >
            {t('cancel') || 'Cancel'}
          </button>
          <button
            className="end-meeting-confirm-btn"
            onClick={handleConfirm}
            disabled={isEnding}
          >
            {isEnding ? (
              <>
                <FiLoader className="spin" size={16} />
                <span>{t('ending') || 'Ending...'}</span>
              </>
            ) : (
              <span>{t('meet_end_confirm') || 'End Meeting'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EndMeetingModal;
