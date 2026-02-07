import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiVideo,
  FiSquare,
  FiCpu,
  FiDownload,
  FiCheck,
  FiHelpCircle,
  FiAlertCircle,
  FiEdit3,
  FiCheckCircle,
  FiXCircle,
} from 'react-icons/fi';
import { SessionRecording } from '../../../types/meetRoom';
import '../styles/RightPanel.css';

type AIViewTab = 'summary' | 'organized';

interface RecordingPanelProps {
  recording: SessionRecording | null;
  isHost: boolean;
  onToggleRecording: () => void;
  onGenerateSummary: () => void;
  onOrganizeNotes: () => void;
  onInsertToNotes: () => void;
  onInsertOrganizedToNotes: () => void;
}

const RecordingPanel: React.FC<RecordingPanelProps> = ({
  recording,
  isHost,
  onToggleRecording,
  onGenerateSummary,
  onOrganizeNotes,
  onInsertToNotes,
  onInsertOrganizedToNotes,
}) => {
  const { t } = useTranslation();
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [activeTab, setActiveTab] = useState<AIViewTab>('summary');

  // Update elapsed time
  useEffect(() => {
    if (!recording?.isRecording || !recording?.recordingStartedAt) return;

    const interval = setInterval(() => {
      const start = new Date(recording.recordingStartedAt!).getTime();
      const now = Date.now();
      const seconds = Math.floor((now - start) / 1000);
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      setElapsedTime(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [recording?.isRecording, recording?.recordingStartedAt]);

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    try {
      await onGenerateSummary();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOrganizeNotes = async () => {
    setIsOrganizing(true);
    try {
      await onOrganizeNotes();
    } finally {
      setIsOrganizing(false);
    }
  };

  const summary = recording?.aiSummary;
  const organizedContent = recording?.aiOrganizedContent;

  return (
    <div className="recording-panel">
      {/* Recording Section */}
      <div className="recording-section">
        <div className="section-header">
          <FiVideo size={16} />
          <h3>{t('meet_recording') || 'Meeting Recording'}</h3>
        </div>

        {recording?.isRecording ? (
          <div className="recording-active">
            <div className="recording-status-box">
              <span className="recording-indicator">
                <span className="recording-dot"></span>
                Recording
              </span>
              <span className="recording-time">{elapsedTime}</span>
            </div>
            <p className="recording-hint">
              {t('meet_recording_active_hint') || 'Recording is in progress. Notes and discussion are being captured.'}
            </p>
            {isHost && (
              <button className="stop-recording-btn" onClick={onToggleRecording}>
                <FiSquare size={16} />
                {t('meet_stop_recording') || 'Stop Recording'}
              </button>
            )}
          </div>
        ) : (
          <div className="recording-inactive">
            <div className="recording-instructions">
              <p>{t('meet_recording_instructions') || 'To record the meeting:'}</p>
              <ol>
                <li>{t('meet_recording_step_1') || 'Click "Start Recording" below'}</li>
                <li>{t('meet_recording_step_2') || 'Recording status will be shared'}</li>
                <li>{t('meet_recording_step_3') || 'Stop when discussion ends'}</li>
              </ol>
            </div>
            {isHost && (
              <button className="start-recording-btn" onClick={onToggleRecording}>
                <FiVideo size={16} />
                {t('meet_start_recording') || 'Start Recording'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* AI Section with Tabs */}
      <div className="summary-section">
        <div className="section-header">
          <FiCpu size={16} />
          <h3>{t('meet_ai_tools') || 'AI Tools'}</h3>
        </div>

        {/* Tab Navigation */}
        <div className="ai-tabs">
          <button
            className={`ai-tab ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            <FiCpu size={14} />
            <span>{t('meet_ai_summary') || 'Summary'}</span>
          </button>
          <button
            className={`ai-tab ${activeTab === 'organized' ? 'active' : ''}`}
            onClick={() => setActiveTab('organized')}
          >
            <FiEdit3 size={14} />
            <span>{t('meet_ai_organized') || 'AI Organized'}</span>
          </button>
        </div>

        {/* Summary Tab Content */}
        {activeTab === 'summary' && (
          <>
            {summary ? (
              <div className="summary-content">
                {/* One-liner */}
                <div className="summary-block">
                  <div className="summary-block-header">
                    <span className="summary-icon">📝</span>
                    <span>{t('meet_summary_oneliner') || 'One-line Summary'}</span>
                  </div>
                  <p className="summary-oneliner">{summary.oneLiner}</p>
                </div>

                {/* Key Points */}
                {summary.keyPoints?.length > 0 && (
                  <div className="summary-block">
                    <div className="summary-block-header">
                      <span className="summary-icon">🎯</span>
                      <span>{t('meet_summary_key_points') || 'Key Discussion Points'}</span>
                    </div>
                    <ul className="summary-list">
                      {summary.keyPoints.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Quotes */}
                {summary.quotes?.length > 0 && (
                  <div className="summary-block">
                    <div className="summary-block-header">
                      <span className="summary-icon">💬</span>
                      <span>{t('meet_summary_quotes') || 'Notable Quotes'}</span>
                    </div>
                    <div className="summary-quotes">
                      {summary.quotes.map((quote, i) => (
                        <blockquote key={i} className="summary-quote">
                          "{quote}"
                        </blockquote>
                      ))}
                    </div>
                  </div>
                )}

                {/* Agreements & Disagreements */}
                {summary.agreements?.length > 0 && (
                  <div className="summary-block">
                    <div className="summary-block-header">
                      <span className="summary-icon">✓</span>
                      <span>{t('meet_summary_agreements') || 'Agreements & Disagreements'}</span>
                    </div>
                    <ul className="summary-agreements">
                      {summary.agreements.map((item, i) => (
                        <li key={i} className={item.isAgreement ? 'agreement' : 'disagreement'}>
                          {item.isAgreement ? <FiCheck size={14} /> : <FiAlertCircle size={14} />}
                          <span>{item.point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Open Questions */}
                {summary.openQuestions?.length > 0 && (
                  <div className="summary-block">
                    <div className="summary-block-header">
                      <span className="summary-icon">❓</span>
                      <span>{t('meet_summary_questions') || 'Follow-up Questions'}</span>
                    </div>
                    <ol className="summary-questions">
                      {summary.openQuestions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="summary-actions">
                  <button
                    className="generate-summary-btn"
                    onClick={handleGenerateSummary}
                    disabled={isGenerating}
                  >
                    <FiCpu size={16} />
                    {isGenerating
                      ? t('meet_generating') || 'Generating...'
                      : t('meet_regenerate_summary') || 'Regenerate Summary'}
                  </button>
                  <button className="insert-to-notes-btn" onClick={onInsertToNotes}>
                    <FiDownload size={16} />
                    {t('meet_insert_to_notes') || 'Insert to Notes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="summary-empty">
                <div className="summary-empty-icon">
                  <FiCpu size={40} />
                </div>
                <p>{t('meet_summary_empty') || 'AI summary will be generated from your discussion notes'}</p>
                <button
                  className="generate-summary-btn"
                  onClick={handleGenerateSummary}
                  disabled={isGenerating}
                >
                  <FiCpu size={16} />
                  {isGenerating
                    ? t('meet_generating') || 'Generating...'
                    : t('meet_generate_summary') || 'Generate AI Summary'}
                </button>
              </div>
            )}
          </>
        )}

        {/* AI Organized Tab Content */}
        {activeTab === 'organized' && (
          <>
            {organizedContent ? (
              <div className="organized-content">
                {/* Validation Status */}
                <div className={`validation-status ${organizedContent.valid ? 'valid' : 'invalid'}`}>
                  {organizedContent.valid ? (
                    <>
                      <FiCheckCircle size={16} />
                      <span>
                        {t('meet_organized_valid') || 'All content preserved'}
                        ({organizedContent.sourceFragmentIds?.length || 0} {t('meet_fragments') || 'fragments'})
                      </span>
                    </>
                  ) : (
                    <>
                      <FiXCircle size={16} />
                      <span>
                        {t('meet_organized_invalid') || 'Missing fragments'}:
                        {organizedContent.missingFragments?.join(', ')}
                      </span>
                    </>
                  )}
                </div>

                {/* Organized Text */}
                <div className="organized-text-container">
                  <div className="organized-text">
                    {organizedContent.organizedText?.split('\n').map((line, i) => {
                      // Highlight fragment IDs
                      const parts = line.split(/(⟦note_\d{3}⟧)/g);
                      return (
                        <p key={i}>
                          {parts.map((part, j) => {
                            if (part.match(/⟦note_\d{3}⟧/)) {
                              return (
                                <span key={j} className="fragment-id" title={t('meet_fragment_id') || 'Fragment ID'}>
                                  {part}
                                </span>
                              );
                            }
                            return part;
                          })}
                        </p>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="summary-actions">
                  <button
                    className="generate-summary-btn"
                    onClick={handleOrganizeNotes}
                    disabled={isOrganizing}
                  >
                    <FiEdit3 size={16} />
                    {isOrganizing
                      ? t('meet_organizing') || 'Organizing...'
                      : t('meet_reorganize') || 'Reorganize'}
                  </button>
                  <button
                    className="insert-to-notes-btn"
                    onClick={onInsertOrganizedToNotes}
                    disabled={!organizedContent.valid}
                  >
                    <FiDownload size={16} />
                    {t('meet_insert_organized') || 'Insert to Notes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="summary-empty">
                <div className="summary-empty-icon">
                  <FiEdit3 size={40} />
                </div>
                <p>
                  {t('meet_organized_empty') || 'AI will reorganize your notes for better readability while preserving all content.'}
                </p>
                <div className="organized-features">
                  <div className="feature-item">
                    <FiCheckCircle size={14} />
                    <span>{t('meet_organized_feature_1') || 'Groups related topics together'}</span>
                  </div>
                  <div className="feature-item">
                    <FiCheckCircle size={14} />
                    <span>{t('meet_organized_feature_2') || 'Preserves ALL original content'}</span>
                  </div>
                  <div className="feature-item">
                    <FiCheckCircle size={14} />
                    <span>{t('meet_organized_feature_3') || 'Adds fragment IDs for traceability'}</span>
                  </div>
                </div>
                <button
                  className="generate-summary-btn organize-btn"
                  onClick={handleOrganizeNotes}
                  disabled={isOrganizing}
                >
                  <FiEdit3 size={16} />
                  {isOrganizing
                    ? t('meet_organizing') || 'Organizing...'
                    : t('meet_organize_notes') || 'Organize Notes'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* How it works */}
      <div className="how-it-works">
        <div className="how-header">
          <FiHelpCircle size={14} />
          <span>{t('meet_how_it_works') || 'How it works'}</span>
        </div>
        <p>
          {t('meet_how_it_works_desc') || 'The AI analyzes your discussion notes and generates a summary with key points, quotes, and follow-up questions.'}
        </p>
      </div>
    </div>
  );
};

export default RecordingPanel;
