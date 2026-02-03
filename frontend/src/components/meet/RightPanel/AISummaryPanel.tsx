import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiCpu,
  FiDownload,
  FiCheck,
  FiAlertCircle,
  FiChevronDown,
  FiChevronUp,
  FiEdit3,
  FiCheckCircle,
  FiXCircle,
  FiLoader,
} from 'react-icons/fi';
import { SessionRecording, AIContentVersionSummary } from '../../../types/meetRoom';
import '../styles/RightPanel.css';

type AIViewTab = 'summary' | 'organized';

interface AISummaryPanelProps {
  recording: SessionRecording | null;
  onGenerateSummary: () => void;
  onOrganizeNotes: () => void;
  onInsertToNotes: () => void;
  onInsertOrganizedToNotes: () => void;
  // AI Version props
  aiVersions?: AIContentVersionSummary[];
  selectedAiVersion?: number | null;
  onSelectAiVersion?: (version: number) => void;
  isLoadingVersion?: boolean;
}

const AISummaryPanel: React.FC<AISummaryPanelProps> = ({
  recording,
  onGenerateSummary,
  onOrganizeNotes,
  onInsertToNotes,
  onInsertOrganizedToNotes,
  // AI Version props
  aiVersions = [],
  selectedAiVersion = null,
  onSelectAiVersion,
  isLoadingVersion = false,
}) => {
  const { t } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<AIViewTab>('summary');

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
    <div className="ai-summary-panel">
      <div
        className="ai-summary-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="ai-summary-title">
          <FiCpu size={16} />
          <h3>{t('meet_ai_tools') || 'AI Tools'}</h3>
        </div>
        <button className="ai-summary-toggle">
          {isExpanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
        </button>
      </div>

      {isExpanded && (
        <div className="ai-summary-content">
          {/* Tab Navigation */}
          <div className="ai-tabs">
            <button
              className={`ai-tab ${activeTab === 'summary' ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setActiveTab('summary'); }}
            >
              <FiCpu size={14} />
              <span>{t('meet_ai_summary_tab') || 'Summary'}</span>
            </button>
            <button
              className={`ai-tab ${activeTab === 'organized' ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setActiveTab('organized'); }}
            >
              <FiEdit3 size={14} />
              <span>{t('meet_ai_organized_tab') || 'Organized'}</span>
            </button>
          </div>

          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <>
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
            </>
          )}

          {/* Organized Tab */}
          {activeTab === 'organized' && (
            <>
              {/* AI Version Selector */}
              {aiVersions.length > 0 && (
                <div className="ai-version-selector">
                  <span className="version-label">{t('meet_ai_versions') || '버전:'}</span>
                  <div className="version-chips">
                    {aiVersions.map((ver) => (
                      <button
                        key={ver.version}
                        className={`version-chip ${selectedAiVersion === ver.version ? 'active' : ''}`}
                        onClick={() => onSelectAiVersion?.(ver.version)}
                        title={`${t('meet_ai_version_generated') || '생성:'} ${new Date(ver.generatedAt).toLocaleString()}`}
                        disabled={isLoadingVersion}
                      >
                        v{ver.version}
                        {!ver.valid && <span className="version-warning">!</span>}
                      </button>
                    ))}
                  </div>
                  {isLoadingVersion && (
                    <span className="version-loading">
                      <FiLoader size={14} className="spin" />
                    </span>
                  )}
                </div>
              )}

              {organizedContent ? (
                <div className="organized-content-compact">
                  {/* Validation Status */}
                  <div className={`validation-status ${organizedContent.valid ? 'valid' : 'invalid'}`}>
                    {organizedContent.valid ? (
                      <>
                        <FiCheckCircle size={14} />
                        <span>
                          {t('meet_organized_valid') || 'All content preserved'}
                          ({organizedContent.sourceFragmentIds?.length || 0})
                        </span>
                      </>
                    ) : (
                      <>
                        <FiXCircle size={14} />
                        <span>{t('meet_organized_invalid') || 'Missing fragments'}</span>
                      </>
                    )}
                  </div>

                  {/* Organized Text Preview */}
                  <div className="organized-text-preview">
                    {organizedContent.organizedText?.split('\n').slice(0, 5).map((line, i) => {
                      const parts = line.split(/(⟦note_\d{3}⟧)/g);
                      return (
                        <p key={i}>
                          {parts.map((part, j) => {
                            if (part.match(/⟦note_\d{3}⟧/)) {
                              return (
                                <span key={j} className="fragment-id">
                                  {part}
                                </span>
                              );
                            }
                            return part;
                          })}
                        </p>
                      );
                    })}
                    {(organizedContent.organizedText?.split('\n').length || 0) > 5 && (
                      <p className="organized-more">...</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="ai-summary-actions">
                    <button
                      className="ai-summary-btn regenerate"
                      onClick={handleOrganizeNotes}
                      disabled={isOrganizing}
                    >
                      <FiEdit3 size={14} />
                      {isOrganizing
                        ? t('meet_organizing') || 'Organizing...'
                        : t('meet_reorganize') || 'Reorganize'}
                    </button>
                    <button
                      className="ai-summary-btn insert"
                      onClick={onInsertOrganizedToNotes}
                      disabled={!organizedContent.valid}
                    >
                      <FiDownload size={14} />
                      {t('meet_insert_to_notes') || 'Insert'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ai-summary-empty">
                  <p>{t('meet_organized_empty_short') || 'Reorganize notes while preserving all content'}</p>
                  <div className="organized-features-compact">
                    <span><FiCheckCircle size={12} /> {t('meet_feature_group') || 'Groups topics'}</span>
                    <span><FiCheckCircle size={12} /> {t('meet_feature_preserve') || 'Preserves all'}</span>
                  </div>
                  <button
                    className="ai-summary-btn organize"
                    onClick={handleOrganizeNotes}
                    disabled={isOrganizing}
                  >
                    <FiEdit3 size={14} />
                    {isOrganizing
                      ? t('meet_organizing') || 'Organizing...'
                      : t('meet_organize_notes') || 'Organize Notes'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AISummaryPanel;
