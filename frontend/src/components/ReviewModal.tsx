import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FiStar, FiX } from 'react-icons/fi';
import { submitReview, skipReview } from '../api/review';
import './styles/ReviewModal.css';

interface ReviewModalProps {
  onClose: () => void;
  accessToken: string;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ onClose, accessToken }) => {
  const { t } = useTranslation();
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [goodPoints, setGoodPoints] = useState('');
  const [badPoints, setBadPoints] = useState('');
  const [consentToExpose, setConsentToExpose] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSkip = useCallback(async () => {
    try {
      await skipReview(accessToken);
    } catch {
      // ignore skip errors
    }
    onClose();
  }, [accessToken, onClose]);

  const handleSubmit = async () => {
    if (rating === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await submitReview(
        { rating, goodPoints, badPoints, consentToExpose },
        accessToken
      );
      onClose();
    } catch {
      setIsSubmitting(false);
    }
  };

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSkip]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleSkip();
  };

  const displayRating = hoverRating || rating;

  return (
    <div className="review-modal-overlay" onClick={handleOverlayClick}>
      <div className="review-modal">
        {/* Close button */}
        <button className="review-modal-close" onClick={handleSkip}>
          <FiX size={20} />
        </button>

        {/* Header */}
        <div className="review-modal-header">
          <h2>{t('review_title')}</h2>
          <p>{t('review_subtitle')}</p>
        </div>

        {/* Rating */}
        <div className="review-modal-section">
          <label className="review-modal-label">{t('review_rating_label')}</label>
          <div className="review-stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                className={`review-star ${displayRating >= star ? 'active' : ''}`}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                type="button"
              >
                <FiStar size={32} />
              </button>
            ))}
          </div>
        </div>

        {/* Good points */}
        <div className="review-modal-section">
          <label className="review-modal-label">{t('review_good_label')}</label>
          <textarea
            className="review-textarea"
            value={goodPoints}
            onChange={(e) => setGoodPoints(e.target.value)}
            placeholder={t('review_good_placeholder')}
            rows={3}
          />
        </div>

        {/* Bad points */}
        <div className="review-modal-section">
          <label className="review-modal-label">{t('review_bad_label')}</label>
          <textarea
            className="review-textarea"
            value={badPoints}
            onChange={(e) => setBadPoints(e.target.value)}
            placeholder={t('review_bad_placeholder')}
            rows={3}
          />
        </div>

        {/* Consent */}
        <div className="review-modal-consent">
          <label className="review-consent-label">
            <input
              type="checkbox"
              checked={consentToExpose}
              onChange={(e) => setConsentToExpose(e.target.checked)}
            />
            <span>{t('review_consent_label')}</span>
          </label>
        </div>

        {/* Buttons */}
        <div className="review-modal-actions">
          <button
            className="review-btn-skip"
            onClick={handleSkip}
            disabled={isSubmitting}
          >
            {t('review_skip')}
          </button>
          <button
            className="review-btn-submit"
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
          >
            {isSubmitting ? t('review_submitting') : t('review_submit')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;
