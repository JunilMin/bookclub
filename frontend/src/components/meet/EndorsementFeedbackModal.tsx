import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FiX, FiCheck, FiLoader } from 'react-icons/fi';
import { useAuth } from '../../AuthContext/AuthContext';
import { getPendingParticipants, submitEndorsement } from '../../api/endorsements';
import {
  PendingParticipant,
  EndorsementCategory,
  ENDORSEMENT_CATEGORIES,
} from '../../types/endorsement';
import './styles/EndorsementFeedbackModal.css';

interface EndorsementFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

const EndorsementFeedbackModal: React.FC<EndorsementFeedbackModalProps> = ({
  isOpen,
  onClose,
  sessionId,
}) => {
  const { t } = useTranslation();
  const { accessToken } = useAuth();

  const [participants, setParticipants] = useState<PendingParticipant[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<
    Record<string, EndorsementCategory[]>
  >({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch pending participants on mount
  useEffect(() => {
    if (!isOpen || !accessToken || !sessionId) return;

    const fetchParticipants = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getPendingParticipants(sessionId, accessToken);
        setParticipants(response.participants);

        // Initialize state for each participant
        const initialSelected: Record<string, EndorsementCategory[]> = {};
        const initialSubmitted: Record<string, boolean> = {};

        response.participants.forEach((p) => {
          initialSelected[p.userId] = [];
          initialSubmitted[p.userId] = p.alreadyEndorsed;
        });

        setSelectedCategories(initialSelected);
        setSubmitted(initialSubmitted);
      } catch (err) {
        console.error('Failed to fetch participants:', err);
        setError(t('endorsement_error_load_failed'));
      } finally {
        setLoading(false);
      }
    };

    fetchParticipants();
  }, [isOpen, sessionId, accessToken, t]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Toggle category selection for a participant
  const toggleCategory = useCallback(
    (userId: string, category: EndorsementCategory) => {
      setSelectedCategories((prev) => {
        const current = prev[userId] || [];
        const isSelected = current.includes(category);

        return {
          ...prev,
          [userId]: isSelected
            ? current.filter((c) => c !== category)
            : [...current, category],
        };
      });
    },
    []
  );

  // Submit endorsement for a participant
  const handleSubmit = useCallback(
    async (targetUserId: string) => {
      if (!accessToken) return;

      const categories = selectedCategories[targetUserId] || [];
      // Allow empty selection (neutral endorsement)

      setSubmitting((prev) => ({ ...prev, [targetUserId]: true }));
      setError(null);

      try {
        await submitEndorsement(
          { sessionId, targetUserId, selected: categories },
          accessToken
        );
        setSubmitted((prev) => ({ ...prev, [targetUserId]: true }));
      } catch (err: any) {
        if (err.response?.status === 409) {
          // Already endorsed - mark as submitted
          setSubmitted((prev) => ({ ...prev, [targetUserId]: true }));
        } else {
          setError(
            err.response?.data?.message || t('endorsement_error_submit_failed')
          );
        }
      } finally {
        setSubmitting((prev) => ({ ...prev, [targetUserId]: false }));
      }
    },
    [accessToken, sessionId, selectedCategories, t]
  );

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Check if all participants have been endorsed
  const allSubmitted =
    participants.length > 0 && participants.every((p) => submitted[p.userId]);

  if (!isOpen) return null;

  return (
    <div className="endorsement-modal-overlay" onClick={handleBackdropClick}>
      <div className="endorsement-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="endorsement-modal-header">
          <div className="endorsement-header-text">
            <h2>{t('endorsement_title')}</h2>
            <p className="endorsement-subtitle">{t('endorsement_subtitle')}</p>
          </div>
          <button className="endorsement-close-btn" onClick={onClose}>
            <FiX size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="endorsement-modal-content">
          {loading ? (
            <div className="endorsement-loading-state">
              <FiLoader className="endorsement-spinner" size={32} />
              <span>{t('endorsement_loading')}</span>
            </div>
          ) : participants.length === 0 ? (
            <div className="endorsement-empty-state">
              {t('endorsement_no_participants')}
            </div>
          ) : (
            <div className="endorsement-participant-list">
              {participants.map((participant) => (
                <ParticipantCard
                  key={participant.userId}
                  participant={participant}
                  selectedCategories={selectedCategories[participant.userId] || []}
                  onToggleCategory={(cat) =>
                    toggleCategory(participant.userId, cat)
                  }
                  onSubmit={() => handleSubmit(participant.userId)}
                  isSubmitting={submitting[participant.userId] || false}
                  isSubmitted={submitted[participant.userId] || false}
                />
              ))}
            </div>
          )}

          {error && <div className="endorsement-error-message">{error}</div>}
        </div>

        {/* Footer */}
        <div className="endorsement-modal-footer">
          <button className="endorsement-done-btn" onClick={onClose}>
            {allSubmitted ? t('endorsement_done') : t('endorsement_skip')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Participant Card Component
interface ParticipantCardProps {
  participant: PendingParticipant;
  selectedCategories: EndorsementCategory[];
  onToggleCategory: (category: EndorsementCategory) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  isSubmitted: boolean;
}

const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participant,
  selectedCategories,
  onToggleCategory,
  onSubmit,
  isSubmitting,
  isSubmitted,
}) => {
  const { t } = useTranslation();

  return (
    <div className={`endorsement-participant-card ${isSubmitted ? 'submitted' : ''}`}>
      {/* Participant Info */}
      <div className="endorsement-participant-header">
        <div className="endorsement-participant-avatar">
          {participant.photoUrl ? (
            <img src={participant.photoUrl} alt={participant.username} />
          ) : (
            <div className="endorsement-default-avatar">
              {participant.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <span className="endorsement-participant-name">{participant.username}</span>
        {isSubmitted && (
          <span className="endorsement-submitted-badge">
            <FiCheck size={14} />
            {t('endorsement_submitted')}
          </span>
        )}
      </div>

      {/* Category Checkboxes */}
      {!isSubmitted && (
        <>
          <div className="endorsement-category-grid">
            {ENDORSEMENT_CATEGORIES.map((cat) => (
              <label
                key={cat.code}
                className={`endorsement-category-checkbox ${
                  selectedCategories.includes(cat.code) ? 'selected' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat.code)}
                  onChange={() => onToggleCategory(cat.code)}
                  disabled={isSubmitting}
                />
                <span className="endorsement-category-label">
                  {t(cat.i18nKey)}
                </span>
              </label>
            ))}
          </div>

          {/* Submit Button */}
          <button
            className="endorsement-submit-btn"
            onClick={onSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <FiLoader className="endorsement-spinner-small" size={16} />
                {t('endorsement_submitting')}
              </>
            ) : (
              t('endorsement_submit')
            )}
          </button>
        </>
      )}
    </div>
  );
};

export default EndorsementFeedbackModal;
