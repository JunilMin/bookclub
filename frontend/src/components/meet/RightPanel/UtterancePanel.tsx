import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiMic,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiUser,
  FiDownload,
  FiCheck,
  FiLoader,
  FiAlertCircle,
  FiMessageSquare,
  FiTag,
} from 'react-icons/fi';
import {
  SessionUtterance,
  UtteranceProcessingState,
} from '../../../types/meetRoom';
import './UtterancePanel.css';

interface UtterancePanelProps {
  utterances: SessionUtterance[];
  processingState: UtteranceProcessingState;
  autoInsertEnabled: boolean;
  onToggleAutoInsert: () => void;
  onInsertTextToNotes: (utterance: SessionUtterance) => void;
  onInsertSummaryToNotes: (utterance: SessionUtterance) => void;
}

const UtterancePanel: React.FC<UtterancePanelProps> = ({
  utterances,
  processingState,
  autoInsertEnabled,
  onToggleAutoInsert,
  onInsertTextToNotes,
  onInsertSummaryToNotes,
}) => {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'refined' | 'raw'>('refined');

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'uploading':
        return t('utterance_uploading') || 'Uploading audio...';
      case 'transcribing':
        return t('utterance_transcribing') || 'Transcribing speech...';
      case 'refining':
        return t('utterance_refining') || 'Refining text...';
      case 'summarizing':
        return t('utterance_summarizing') || 'Generating summary...';
      case 'error':
        return processingState.error || t('utterance_error') || 'Processing failed';
      default:
        return '';
    }
  };

  const isProcessing =
    processingState.status !== 'idle' &&
    processingState.status !== 'complete' &&
    processingState.status !== 'error';

  return (
    <div className="utterance-panel">
      {/* Header */}
      <div className="utterance-panel-header">
        <div className="header-title">
          <FiMic size={16} />
          <h3>{t('utterance_panel_title') || 'Speech Transcriptions'}</h3>
          <span className="utterance-count">{utterances.length}</span>
        </div>

        {/* Auto-insert toggle */}
        <div className="auto-insert-toggle">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={autoInsertEnabled}
              onChange={onToggleAutoInsert}
            />
            <span className="toggle-slider"></span>
          </label>
          <span className="toggle-label">
            {t('utterance_auto_insert') || 'Auto-insert to notes'}
          </span>
        </div>
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <div className="processing-indicator">
          <div className="processing-content">
            <FiLoader className="processing-spinner" size={16} />
            <span className="processing-text">{getStatusText(processingState.status)}</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${processingState.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {processingState.status === 'error' && (
        <div className="processing-error">
          <FiAlertCircle size={16} />
          <span>{processingState.error || 'An error occurred'}</span>
        </div>
      )}

      {/* Utterance list - stack order (newest on top) */}
      <div className="utterance-list">
        {[...utterances].reverse().map((utterance) => (
          <div
            key={utterance.id}
            className={`utterance-item ${expandedId === utterance.id ? 'expanded' : ''}`}
          >
            {/* Collapsed header */}
            <div
              className="utterance-header"
              onClick={() =>
                setExpandedId(expandedId === utterance.id ? null : utterance.id)
              }
            >
              <div className="speaker-info">
                {utterance.speakerPhotoUrl ? (
                  <img
                    src={utterance.speakerPhotoUrl}
                    alt=""
                    className="speaker-photo"
                  />
                ) : (
                  <div className="speaker-avatar">
                    <FiUser size={14} />
                  </div>
                )}
                <span className="speaker-name">{utterance.speakerName}</span>
                <span className="utterance-index">#{utterance.utteranceIndex}</span>
              </div>
              <div className="utterance-meta">
                <span className="duration">
                  <FiClock size={12} />
                  {formatDuration(utterance.durationMs)}
                </span>
                {utterance.insertedToNotes && (
                  <span className="inserted-badge">
                    <FiCheck size={12} />
                  </span>
                )}
                {expandedId === utterance.id ? (
                  <FiChevronUp size={16} />
                ) : (
                  <FiChevronDown size={16} />
                )}
              </div>
            </div>

            {/* Expanded content */}
            {expandedId === utterance.id && (
              <div className="utterance-content">
                {/* View mode toggle */}
                <div className="view-mode-toggle">
                  <button
                    className={viewMode === 'refined' ? 'active' : ''}
                    onClick={() => setViewMode('refined')}
                  >
                    {t('utterance_refined') || 'Refined'}
                  </button>
                  <button
                    className={viewMode === 'raw' ? 'active' : ''}
                    onClick={() => setViewMode('raw')}
                  >
                    {t('utterance_raw') || 'Raw STT'}
                  </button>
                </div>

                {/* Text content */}
                <div className="text-content">
                  {viewMode === 'refined' ? utterance.refinedText : utterance.rawText}
                </div>

                {/* Summary */}
                {utterance.summary && (
                  <div className="utterance-summary">
                    {/* Key Points */}
                    {utterance.summary.keyPoints?.length > 0 && (
                      <div className="summary-section">
                        <div className="summary-header">
                          <FiMessageSquare size={12} />
                          <span>{t('utterance_key_points') || 'Key Points'}</span>
                        </div>
                        <ul>
                          {utterance.summary.keyPoints.map((point, i) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Issues */}
                    {utterance.summary.issues?.length > 0 && (
                      <div className="summary-section">
                        <div className="summary-header">
                          <FiAlertCircle size={12} />
                          <span>{t('utterance_issues') || 'Issues Raised'}</span>
                        </div>
                        <ul>
                          {utterance.summary.issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Topics */}
                    {utterance.summary.topics?.length > 0 && (
                      <div className="topics-section">
                        <FiTag size={12} />
                        <div className="topic-tags">
                          {utterance.summary.topics.map((topic, i) => (
                            <span key={i} className="topic-tag">
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="utterance-actions">
                  <button
                    className={`insert-text-btn ${utterance.insertedToNotes ? 'inserted' : ''}`}
                    onClick={() => onInsertTextToNotes(utterance)}
                  >
                    {utterance.insertedToNotes ? <FiCheck size={14} /> : <FiDownload size={14} />}
                    {utterance.insertedToNotes
                      ? t('utterance_insert_again') || 'Insert Again'
                      : t('utterance_insert_text') || 'Insert Text'}
                  </button>
                  <button
                    className="insert-summary-btn"
                    onClick={() => onInsertSummaryToNotes(utterance)}
                  >
                    <FiDownload size={14} />
                    {t('utterance_insert_summary') || 'Insert Summary'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Empty state */}
        {utterances.length === 0 && !isProcessing && (
          <div className="utterance-empty">
            <div className="empty-icon">
              <FiMic size={32} />
            </div>
            <p className="empty-title">
              {t('utterance_empty_title') || 'No transcriptions yet'}
            </p>
            <p className="empty-hint">
              {t('utterance_empty_hint') ||
                'Transcriptions will appear here when speakers finish their turns in Rules mode.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UtterancePanel;
