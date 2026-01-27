import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiCpu,
  FiDownload,
  FiCheck,
  FiAlertCircle,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';
import { SessionRecording } from '../../../types/meetRoom';
import '../styles/RightPanel.css';

interface AISummaryPanelProps {
  recording: SessionRecording | null;
  onGenerateSummary: () => void;
  onInsertToNotes: () => void;
}

const AISummaryPanel: React.FC<AISummaryPanelProps> = ({
  recording,
  onGenerateSummary,
  onInsertToNotes,
}) => {
  const { t } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    try {
      await onGenerateSummary();
    } finally {
      setIsGenerating(false);
    }
  };

  const summary = recording?.aiSummary;

  return (
    <div className="ai-summary-panel">
      <div
        className="ai-summary-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="ai-summary-title">
          <FiCpu size={16} />
          <h3>{t('meet_ai_summary') || 'AI Summary'}</h3>
        </div>
        <button className="ai-summary-toggle">
          {isExpanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
        </button>
      </div>

      {isExpanded && (
        <div className="ai-summary-content">
          {summary ? (
            <>
              {/* One-liner */}
              <div className="summary-block compact">
                <div className="summary-block-header">
                  <span className="summary-icon">📝</span>
                  <span>{t('meet_summary_oneliner') || 'One-line Summary'}</span>
                </div>
                <p className="summary-oneliner">{summary.oneLiner}</p>
              </div>

              {/* Key Points */}
              {summary.keyPoints?.length > 0 && (
                <div className="summary-block compact">
                  <div className="summary-block-header">
                    <span className="summary-icon">🎯</span>
                    <span>{t('meet_summary_key_points') || 'Key Points'}</span>
                  </div>
                  <ul className="summary-list compact">
                    {summary.keyPoints.slice(0, 3).map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                    {summary.keyPoints.length > 3 && (
                      <li className="summary-more">+{summary.keyPoints.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Agreements & Disagreements */}
              {summary.agreements?.length > 0 && (
                <div className="summary-block compact">
                  <div className="summary-block-header">
                    <span className="summary-icon">✓</span>
                    <span>{t('meet_summary_agreements') || 'Agreements'}</span>
                  </div>
                  <ul className="summary-agreements compact">
                    {summary.agreements.slice(0, 2).map((item, i) => (
                      <li key={i} className={item.isAgreement ? 'agreement' : 'disagreement'}>
                        {item.isAgreement ? <FiCheck size={12} /> : <FiAlertCircle size={12} />}
                        <span>{item.point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="ai-summary-actions">
                <button
                  className="ai-summary-btn regenerate"
                  onClick={handleGenerateSummary}
                  disabled={isGenerating}
                >
                  <FiCpu size={14} />
                  {isGenerating
                    ? t('meet_generating') || 'Generating...'
                    : t('meet_regenerate') || 'Regenerate'}
                </button>
                <button className="ai-summary-btn insert" onClick={onInsertToNotes}>
                  <FiDownload size={14} />
                  {t('meet_insert_to_notes') || 'Insert to Notes'}
                </button>
              </div>
            </>
          ) : (
            <div className="ai-summary-empty">
              <p>{t('meet_summary_empty_short') || 'Generate AI summary from discussion notes'}</p>
              <button
                className="ai-summary-btn generate"
                onClick={handleGenerateSummary}
                disabled={isGenerating}
              >
                <FiCpu size={14} />
                {isGenerating
                  ? t('meet_generating') || 'Generating...'
                  : t('meet_generate_summary') || 'Generate Summary'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AISummaryPanel;
