// src/components/meet/ReportModal.tsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiX, FiAlertTriangle, FiUpload, FiLoader, FiCheck } from 'react-icons/fi';
import { ReportReason, ReportReasonLabels, createReport, EvidenceFile } from '../../api/reports';
import './styles/ReportModal.css';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  postId?: string;
  reportedUserId: string;
  reportedUsername: string;
  accessToken: string;
  onReportSuccess: (reportedUserId: string) => void;
}

const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  postId,
  reportedUserId,
  reportedUsername,
  accessToken,
  onReportSuccess,
}) => {
  const { t, i18n } = useTranslation();
  const [selectedReasons, setSelectedReasons] = useState<ReportReason[]>([]);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const currentLang = i18n.language === 'ko' ? 'ko' : 'en';

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedReasons([]);
      setEvidenceFiles([]);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  // Handle checkbox change
  const handleReasonChange = (reason: ReportReason) => {
    setSelectedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason]
    );
    setError(null);
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setEvidenceFiles((prev) => [...prev, ...newFiles]);
    }
  };

  // Remove file
  const handleRemoveFile = (index: number) => {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle submit
  const handleSubmit = async () => {
    if (selectedReasons.length === 0) {
      setError(t('report_select_reason') || 'Please select at least one reason.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // TODO: Upload files to Firebase Storage and get URLs
      // For now, we'll just use file metadata without actual upload
      const evidenceFileData: EvidenceFile[] = evidenceFiles.map((file) => ({
        url: '', // TODO: Replace with actual URL after upload
        name: file.name,
        contentType: file.type,
        size: file.size,
      }));

      await createReport(
        {
          sessionId,
          postId,
          reportedUserId,
          reasons: selectedReasons,
          evidenceFiles: evidenceFileData.length > 0 ? evidenceFileData : undefined,
        },
        accessToken
      );

      setSuccess(true);
      onReportSuccess(reportedUserId);

      // Close modal after short delay
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error('Failed to submit report:', err);

      if (err.response?.status === 409) {
        setError(t('report_already_submitted') || 'You have already reported this user in this session.');
      } else if (err.response?.status === 403) {
        setError(t('report_unauthorized') || 'You are not authorized to report this user.');
      } else {
        setError(t('report_failed') || 'Failed to submit report. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

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

  if (!isOpen) return null;

  return (
    <div className="report-modal-overlay" onClick={handleBackdropClick}>
      <div className="report-modal">
        {/* Header */}
        <div className="report-modal-header">
          <div className="report-modal-title">
            <FiAlertTriangle size={20} />
            <h2>{t('report_title') || 'Report User'}</h2>
          </div>
          <button className="report-modal-close" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        {/* Success State */}
        {success ? (
          <div className="report-success">
            <FiCheck size={48} />
            <p>{t('report_success') || 'Report submitted successfully.'}</p>
          </div>
        ) : (
          <>
            {/* Target Info */}
            <div className="report-target">
              <span className="report-target-label">{t('report_target') || 'Reporting'}: </span>
              <span className="report-target-name">{reportedUsername}</span>
            </div>

            {/* Reason Selection */}
            <div className="report-reasons">
              <h3>{t('report_select_reasons') || 'Select reasons (multiple allowed)'}</h3>
              <div className="report-reason-list">
                {Object.values(ReportReason).map((reason) => (
                  <label key={reason} className="report-reason-item">
                    <input
                      type="checkbox"
                      checked={selectedReasons.includes(reason)}
                      onChange={() => handleReasonChange(reason)}
                      disabled={isSubmitting}
                    />
                    <span className="report-reason-checkbox"></span>
                    <span className="report-reason-label">
                      {ReportReasonLabels[reason][currentLang]}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Evidence Upload */}
            <div className="report-evidence">
              <h3>{t('report_evidence') || 'Attach evidence (optional)'}</h3>
              <div className="report-evidence-upload">
                <label className="report-evidence-btn">
                  <FiUpload size={16} />
                  <span>{t('report_select_files') || 'Select files'}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleFileChange}
                    disabled={isSubmitting}
                  />
                </label>
                <span className="report-evidence-hint">
                  {t('report_evidence_hint') || 'Screenshots or recordings'}
                </span>
              </div>
              {evidenceFiles.length > 0 && (
                <ul className="report-evidence-list">
                  {evidenceFiles.map((file, index) => (
                    <li key={index} className="report-evidence-item">
                      <span className="evidence-name">{file.name}</span>
                      <span className="evidence-size">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                      <button
                        className="evidence-remove"
                        onClick={() => handleRemoveFile(index)}
                        disabled={isSubmitting}
                      >
                        <FiX size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="report-error">
                <FiAlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="report-actions">
              <button
                className="report-cancel-btn"
                onClick={onClose}
                disabled={isSubmitting}
              >
                {t('cancel') || 'Cancel'}
              </button>
              <button
                className="report-submit-btn"
                onClick={handleSubmit}
                disabled={isSubmitting || selectedReasons.length === 0}
              >
                {isSubmitting ? (
                  <>
                    <FiLoader className="spin" size={16} />
                    <span>{t('submitting') || 'Submitting...'}</span>
                  </>
                ) : (
                  <span>{t('submit') || 'Submit'}</span>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
