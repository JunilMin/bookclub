// frontend/src/screens/NoteDetail.tsx
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiArrowLeft,
  FiCalendar,
  FiUsers,
  FiClock,
  FiStar,
  FiSave,
  FiEdit3,
  FiBook,
  FiUser,
  FiAward,
  FiMessageSquare,
  FiCpu,
  FiMic,
  FiChevronDown,
  FiChevronUp,
  FiTag,
  FiAlertCircle,
  FiFileText,
  FiLoader,
  FiCheck,
  FiCheckCircle,
  FiDownload,
} from 'react-icons/fi';
import { useAuth } from '../AuthContext/AuthContext';
import {
  getNoteEnriched,
  updateUserNoteContent,
  updateUserNoteTitle,
  UserNoteResponse,
  ParticipantInfo
} from '../api/notes';
import { getPendingParticipants } from '../api/endorsements';
import { getUtterances } from '../api/utterances';
import {
  generatePersonalAISummary,
  organizePersonalNotes,
  getPersonalAiContentVersions,
  getPersonalAiContentVersion,
  updatePersonalAiVersionBlockContent,
  addPersonalAiVersionBlock,
  deletePersonalAiVersionBlock,
  getAiContentVersions,
  getAiContentVersion,
  importSharedAiVersion,
} from '../api/aiSummary';
import {
  SessionUtterance,
  AIContentVersionSummary,
  AIContentVersion,
} from '../types/meetRoom';
import { PendingParticipant } from '../types/endorsement';
import EndorsementFeedbackModal from '../components/meet/EndorsementFeedbackModal';
import { useNotesStore } from '../store/notesStore';
import { useLocalBlockDocument } from '../hooks/useLocalBlockDocument';
import { useBlockHistory } from '../hooks/useBlockHistory';
import { Block, BlockType, createEmptyBlockContent } from '../types/blockDocument';
import { BlockEditorRef } from '../components/meet/CenterPanel/BlockEditor';
import BlockEditorCore from '../components/meet/CenterPanel/BlockEditorCore';
import './styles/NoteDetail.css';
import './styles/Notes.css';
import '../components/meet/styles/BlockBasedNotes.css';
import '../components/meet/styles/CenterPanel.css';

// =============================================================================
// Types
// =============================================================================

type NoteTab = 'personal' | 'ai';

// =============================================================================
// Helper Functions
// =============================================================================

function formatDate(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatDuration(minutes: number): string {
  if (!minutes) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function generateAvatar(name: string | null | undefined): string {
  const safeName = name && name.trim() ? name.trim() : 'U';
  const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
  const colorIndex = safeName.charCodeAt(0) % colors.length;
  const initial = safeName.charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <rect width="32" height="32" fill="${colors[colorIndex]}" rx="16"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-family="Arial" font-size="14" font-weight="bold">${initial}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function formatUtteranceDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// =============================================================================
// Component
// =============================================================================

const NoteDetail: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { noteId } = useParams<{ noteId: string }>();
  const { accessToken, user } = useAuth();
  const { toggleFavorite } = useNotesStore();

  // State
  const [note, setNote] = useState<UserNoteResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Tab state
  const [activeTab, setActiveTab] = useState<NoteTab>('personal');
  const [rightPanelTab, setRightPanelTab] = useState<'summary' | 'organized'>('summary');

  // Editor ref for toolbar
  const editorRef = useRef<BlockEditorRef | null>(null);
  const aiEditorRef = useRef<BlockEditorRef | null>(null);

  // Undo/Redo state for UI
  const [_historyVersion, setHistoryVersion] = useState(0);

  // Utterance State
  const [utterances, setUtterances] = useState<SessionUtterance[]>([]);
  const [utterancesLoading, setUtterancesLoading] = useState(false);
  const [expandedUtteranceId, setExpandedUtteranceId] = useState<string | null>(null);
  const [utteranceViewMode, setUtteranceViewMode] = useState<'refined' | 'raw'>('refined');

  // Endorsement State
  const [isEndorsementModalOpen, setIsEndorsementModalOpen] = useState(false);
  const [pendingParticipants, setPendingParticipants] = useState<PendingParticipant[]>([]);
  const [hasUnendorsed, setHasUnendorsed] = useState(false);
  const [endorsementLoading, setEndorsementLoading] = useState(false);
  const [isEndorsementCollapsing, setIsEndorsementCollapsing] = useState(false);

  // AI Version State
  const [aiVersions, setAiVersions] = useState<AIContentVersionSummary[]>([]);
  const [sharedAiVersions, setSharedAiVersions] = useState<AIContentVersionSummary[]>([]);
  const [selectedAiVersion, setSelectedAiVersion] = useState<number | null>(null);
  const [aiVersionData, setAiVersionData] = useState<AIContentVersion | null>(null);
  const [isLoadingVersion, setIsLoadingVersion] = useState(false);
  const [importingVersion, setImportingVersion] = useState<number | null>(null);
  const [isAiVersionReadOnly, setIsAiVersionReadOnly] = useState(false);

  // AI Action State
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);

  // AI Tab Editing State
  const [versionEditingBlockId, setVersionEditingBlockId] = useState<string | null>(null);

  // Block document hook
  const {
    blockOrder,
    blocks,
    isLoading: blocksLoading,
    hasChanges,
    editingBlockId,
    startEditing,
    saveBlock,
    finishEditing,
    cancelEditing,
    addBlock,
    deleteBlock,
    reorderBlocks,
    reorderMultiple,
    getContent,
    setContent,
    clearChanges,
    getBlock,
  } = useLocalBlockDocument({
    initialContent: '',
    userId: user?.id || '',
    username: user?.username || '',
  });

  // Ref to always access latest blocks (avoids stale closure in setTimeout)
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  // Ref to track editing block ID for undo/redo editor updates
  const editingBlockIdRef = useRef(editingBlockId);
  editingBlockIdRef.current = editingBlockId;

  // Auto-save timer ref
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Block history hook for undo/redo
  const {
    pushAddBlock: historyPushAddBlock,
    pushDeleteBlock: historyPushDeleteBlock,
    pushReorderBlock: historyPushReorderBlock,
    trackTextChange,
    flushTextChange,
    undo: historyUndo,
    redo: historyRedo,
    canUndo,
    canRedo,
  } = useBlockHistory({
    onAddBlock: async (type, afterBlockId, content) => {
      const newBlockId = addBlock(type, afterBlockId, content);
      setHistoryVersion(v => v + 1);
      return newBlockId;
    },
    onDeleteBlock: async (blockId) => {
      deleteBlock(blockId);
      setHistoryVersion(v => v + 1);
    },
    onUpdateBlock: (blockId, content) => {
      saveBlock(blockId, content);
      if (editingBlockIdRef.current === blockId && editorRef.current?.editor) {
        try {
          const parsed = JSON.parse(content);
          const docContent = parsed.type === 'doc' ? parsed : { type: 'doc', content: [parsed] };
          editorRef.current.editor.commands.setContent(docContent);
        } catch { /* ignore parse errors */ }
      }
      setHistoryVersion(v => v + 1);
    },
    onReorderBlock: async (blockId, afterBlockId) => {
      const targetIndex = afterBlockId === null ? 0 : blockOrder.indexOf(afterBlockId) + 1;
      const currentIndex = blockOrder.indexOf(blockId);
      if (currentIndex !== -1 && currentIndex !== targetIndex) {
        reorderBlocks(currentIndex, targetIndex);
      }
      setHistoryVersion(v => v + 1);
    },
    getBlock: (blockId: string) => getBlock(blockId) ?? undefined,
    getBlockOrder: () => blockOrder,
  });

  // Undo/Redo handlers
  const handleUndo = useCallback(async () => {
    const success = await historyUndo();
    if (success) setHistoryVersion(v => v + 1);
    return success;
  }, [historyUndo]);

  const handleRedo = useCallback(async () => {
    const success = await historyRedo();
    if (success) setHistoryVersion(v => v + 1);
    return success;
  }, [historyRedo]);

  // ==========================================================================
  // Data Fetching
  // ==========================================================================
  useEffect(() => {
    const fetchNote = async () => {
      if (!accessToken || !noteId) return;

      setIsLoading(true);
      setError(null);

      try {
        const data = await getNoteEnriched(noteId, accessToken);
        setNote(data);
        setEditedTitle(data.title || '');
        setContent(data.content || '');
      } catch (err) {
        console.error('Failed to fetch note:', err);
        setError(t('note_detail_error_fetch'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchNote();
  }, [accessToken, noteId, t, setContent]);

  // ==========================================================================
  // Fetch AI Versions
  // ==========================================================================
  useEffect(() => {
    if (!accessToken || !noteId) return;

    const fetchAiVersions = async () => {
      try {
        const response = await getPersonalAiContentVersions(noteId, accessToken);
        const versions = response.versions || [];
        setAiVersions(versions);
        if (versions.length > 0) {
          const latest = versions[0].version;
          setSelectedAiVersion(latest);
          const data = await getPersonalAiContentVersion(noteId, latest, accessToken);
          setAiVersionData(data);
        }
      } catch {
        // No versions available - that's fine
      }
    };

    fetchAiVersions();
  }, [accessToken, noteId]);

  // ==========================================================================
  // Fetch Shared AI Versions (from session)
  // ==========================================================================
  useEffect(() => {
    if (!accessToken || !note?.sessionId) return;

    const fetchSharedVersions = async () => {
      try {
        const response = await getAiContentVersions(note.sessionId, accessToken);
        setSharedAiVersions(response.versions || []);
      } catch {
        // No shared versions available
      }
    };

    fetchSharedVersions();
  }, [accessToken, note?.sessionId]);

  // ==========================================================================
  // Fetch Endorsement Status
  // ==========================================================================
  useEffect(() => {
    const fetchEndorsementStatus = async () => {
      if (!accessToken || !note?.sessionId) return;

      setEndorsementLoading(true);
      try {
        const response = await getPendingParticipants(note.sessionId, accessToken);
        setPendingParticipants(response.participants);
        const unendorsedExists = response.participants.some(p => !p.alreadyEndorsed);
        setHasUnendorsed(unendorsedExists);
      } catch (err) {
        console.error('Failed to fetch endorsement status:', err);
        setHasUnendorsed(false);
      } finally {
        setEndorsementLoading(false);
      }
    };

    fetchEndorsementStatus();
  }, [accessToken, note?.sessionId]);

  // ==========================================================================
  // Fetch Utterances
  // ==========================================================================
  useEffect(() => {
    if (!accessToken || !note?.sessionId) return;

    setUtterancesLoading(true);
    getUtterances(note.sessionId, accessToken)
      .then((data) => setUtterances(data))
      .catch((err) => console.error('Failed to fetch utterances:', err))
      .finally(() => setUtterancesLoading(false));
  }, [accessToken, note?.sessionId]);

  // ==========================================================================
  // Endorsement Handlers
  // ==========================================================================
  const handleOpenEndorsementModal = useCallback(() => {
    setIsEndorsementModalOpen(true);
  }, []);

  const handleCloseEndorsementModal = useCallback(async () => {
    setIsEndorsementModalOpen(false);

    if (accessToken && note?.sessionId) {
      try {
        const response = await getPendingParticipants(note.sessionId, accessToken);
        setPendingParticipants(response.participants);

        const unendorsedExists = response.participants.some(p => !p.alreadyEndorsed);

        if (!unendorsedExists && hasUnendorsed) {
          setIsEndorsementCollapsing(true);
          setTimeout(() => {
            setHasUnendorsed(false);
            setIsEndorsementCollapsing(false);
          }, 400);
        } else {
          setHasUnendorsed(unendorsedExists);
        }
      } catch (err) {
        console.error('Failed to refresh endorsement status:', err);
      }
    }
  }, [accessToken, note?.sessionId, hasUnendorsed]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditedTitle(note?.title || '');
    if (note?.content) {
      setContent(note.content);
    }
    cancelEditing();
  }, [note, setContent, cancelEditing]);

  const handleSave = useCallback(async () => {
    if (!accessToken || !noteId || !note) return;

    // Cancel pending auto-save
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    setIsSaving(true);
    try {
      const currentContent = getContent();

      if (editedTitle !== note.title) {
        await updateUserNoteTitle(noteId, editedTitle, accessToken);
      }
      await updateUserNoteContent(noteId, currentContent, accessToken);

      const updated = await getNoteEnriched(noteId, accessToken);
      setNote(updated);
      clearChanges();
      setAutoSaveStatus('idle');
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save note:', err);
      setError(t('note_detail_error_save'));
    } finally {
      setIsSaving(false);
    }
  }, [accessToken, noteId, note, editedTitle, getContent, clearChanges, t]);

  // ==========================================================================
  // Auto-Save (debounced 3s after last change)
  // ==========================================================================
  useEffect(() => {
    if (!hasChanges || !isEditing || !accessToken || !noteId) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus('saving');
      try {
        const currentContent = getContent();
        await updateUserNoteContent(noteId, currentContent, accessToken);
        clearChanges();
        setAutoSaveStatus('saved');

        // Clear "saved" indicator after 3s
        if (autoSaveSavedTimerRef.current) clearTimeout(autoSaveSavedTimerRef.current);
        autoSaveSavedTimerRef.current = setTimeout(() => setAutoSaveStatus('idle'), 3000);
      } catch (err) {
        console.error('Auto-save failed:', err);
        setAutoSaveStatus('idle');
      }
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [hasChanges, isEditing, accessToken, noteId, getContent, clearChanges]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (autoSaveSavedTimerRef.current) clearTimeout(autoSaveSavedTimerRef.current);
    };
  }, []);

  // ==========================================================================
  // AI Handlers
  // ==========================================================================

  const handleGenerateSummary = useCallback(async () => {
    if (!noteId || !accessToken) return;
    setIsGeneratingSummary(true);
    try {
      await generatePersonalAISummary(noteId, accessToken, t('code') || 'en');
      // Refresh note to get updated personalAiSummary
      const updated = await getNoteEnriched(noteId, accessToken);
      setNote(updated);
    } catch (err) {
      console.error('Failed to generate summary:', err);
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [noteId, accessToken, t]);

  const handleOrganizeNotes = useCallback(async () => {
    if (!noteId || !accessToken) return;
    setIsOrganizing(true);
    try {
      const result = await organizePersonalNotes(noteId, accessToken, t('code') || 'en');

      if (result.version) {
        setSelectedAiVersion(result.version);
        setAiVersionData({
          id: result.versionId || '',
          sessionId: note?.sessionId || '',
          noteId: noteId,
          version: result.version,
          blockOrder: result.blockOrder || [],
          blocks: result.blocks || {},
          generatedAt: result.generatedAt || new Date().toISOString(),
          updatedAt: result.generatedAt || new Date().toISOString(),
          generatedBy: user?.id || null,
          lastEditedBy: null,
          valid: result.validation?.valid ?? true,
          missingFragments: result.validation?.missingFragments || [],
        });
      }

      // Refresh version list
      try {
        const response = await getPersonalAiContentVersions(noteId, accessToken);
        setAiVersions(response.versions || []);
      } catch { /* ignore */ }

      // Switch to AI tab (personal = editable)
      setIsAiVersionReadOnly(false);
      setActiveTab('ai');
    } catch (err) {
      console.error('Failed to organize notes:', err);
    } finally {
      setIsOrganizing(false);
    }
  }, [noteId, note?.sessionId, accessToken, user?.id, t]);

  const handleImportSharedVersion = useCallback(async (version: number) => {
    if (!noteId || !note?.sessionId || !accessToken) return;
    if (aiVersions.length >= 5) return;
    setImportingVersion(version);
    try {
      const imported = await importSharedAiVersion(noteId, note.sessionId, version, accessToken);
      // Refresh personal versions
      const response = await getPersonalAiContentVersions(noteId, accessToken);
      setAiVersions(response.versions || []);
      // Select imported version and switch to AI tab
      setSelectedAiVersion(imported.version);
      setAiVersionData(imported);
      setActiveTab('ai');
    } catch (err) {
      console.error('Failed to import shared version:', err);
    } finally {
      setImportingVersion(null);
    }
  }, [noteId, note?.sessionId, accessToken, aiVersions.length]);

  const handleInsertSummaryToNotes = useCallback(() => {
    const summary = note?.personalAiSummary || note?.aiSummary;
    if (!summary) return;
    let lastBlockId = blockOrder[blockOrder.length - 1] || null;

    // Helper to insert a block and chain after it
    const insertBlock = (type: BlockType, content: any) => {
      const blockContent = JSON.stringify(content);
      const newId = addBlock(type, lastBlockId, blockContent);
      if (newId) lastBlockId = newId;
    };

    // Separator
    insertBlock('horizontalRule', { type: 'horizontalRule' });

    // Heading
    insertBlock('heading', {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'AI Summary' }],
    });

    // One-liner
    insertBlock('paragraph', {
      type: 'paragraph',
      content: [{ type: 'text', marks: [{ type: 'bold' }], text: summary.oneLiner }],
    });

    // Key Points
    if (summary.keyPoints?.length > 0) {
      insertBlock('heading', {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: t('notes_key_points') || 'Key Discussion Points' }],
      });
      insertBlock('bulletList', {
        type: 'bulletList',
        content: summary.keyPoints.map((point: string) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: point }] }],
        })),
      });
    }

    // Quotes
    if (summary.quotes?.length > 0) {
      insertBlock('heading', {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: t('note_detail_quotes') || 'Notable Quotes' }],
      });
      for (const quote of summary.quotes) {
        insertBlock('blockquote', {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: `"${quote}"` }] }],
        });
      }
    }

    // Agreements
    if (summary.agreements?.length > 0) {
      insertBlock('heading', {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: t('note_detail_agreements') || 'Agreements & Disagreements' }],
      });
      insertBlock('bulletList', {
        type: 'bulletList',
        content: summary.agreements.map((item: any) => ({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: `${item.isAgreement ? '✓' : '✗'} ${item.point}` }],
          }],
        })),
      });
    }

    // Open Questions
    if (summary.openQuestions?.length > 0) {
      insertBlock('heading', {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: t('note_detail_open_questions') || 'Follow-up Questions' }],
      });
      insertBlock('orderedList', {
        type: 'orderedList',
        content: summary.openQuestions.map((q: string) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: q }] }],
        })),
      });
    }

    // Switch to personal tab and enable editing
    setActiveTab('personal');
    if (!isEditing) setIsEditing(true);
  }, [note?.personalAiSummary, note?.aiSummary, blockOrder, addBlock, t, isEditing]);

  const formatUtteranceTimestamp = useCallback((dateString: string | undefined): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const langCode = t('code') || 'en';
    if (langCode === 'ko') {
      return date.toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      });
    }
    return date.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  }, [t]);

  const handleInsertUtteranceToNotes = useCallback((utterance: SessionUtterance) => {
    const lastBlockId = blockOrder[blockOrder.length - 1] || null;

    const timestamp = formatUtteranceTimestamp(utterance.startAt);

    // Build utterance block content (same as MeetRoom)
    const blockContent: any[] = [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: utterance.refinedText || utterance.rawText }],
      },
    ];

    if (utterance.summary?.keyPoints?.length > 0) {
      blockContent.push({
        type: 'bulletList',
        content: utterance.summary.keyPoints.map((point: string) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: point }] }],
        })),
      });
    }

    // utteranceBlock with attrs — same format as shared notes
    const content = {
      type: 'utteranceBlock',
      attrs: {
        speakerName: utterance.speakerName,
        speakerPhotoUrl: utterance.speakerPhotoUrl || '',
        timestamp,
        utteranceIndex: utterance.utteranceIndex,
      },
      content: blockContent,
    };

    addBlock('utteranceBlock', lastBlockId, JSON.stringify(content));

    // Switch to personal tab and enable editing
    setActiveTab('personal');
    if (!isEditing) setIsEditing(true);
  }, [blockOrder, addBlock, isEditing, formatUtteranceTimestamp]);

  const handleSelectAiVersion = useCallback(async (version: number) => {
    if (!noteId || !accessToken) return;
    setIsLoadingVersion(true);
    try {
      const data = await getPersonalAiContentVersion(noteId, version, accessToken);
      setAiVersionData(data);
      setSelectedAiVersion(version);
      setIsAiVersionReadOnly(false);
      setVersionEditingBlockId(null);
    } catch (err) {
      console.error('Failed to load AI version:', err);
    } finally {
      setIsLoadingVersion(false);
    }
  }, [noteId, accessToken]);

  const handleSelectSharedVersion = useCallback(async (version: number) => {
    if (!note?.sessionId || !accessToken) return;
    setIsLoadingVersion(true);
    try {
      const data = await getAiContentVersion(note.sessionId, version, accessToken);
      setAiVersionData(data);
      setSelectedAiVersion(null); // Deselect personal versions
      setIsAiVersionReadOnly(true);
      setVersionEditingBlockId(null);
      setActiveTab('ai');
    } catch (err) {
      console.error('Failed to load shared AI version:', err);
    } finally {
      setIsLoadingVersion(false);
    }
  }, [note?.sessionId, accessToken]);

  // ==========================================================================
  // AI Tab Block Editing Handlers (REST API based, no undo/redo)
  // ==========================================================================

  const handleAiStartEdit = useCallback((blockId: string) => {
    setVersionEditingBlockId(blockId);
  }, []);

  const handleAiSaveEdit = useCallback(async (blockId: string, content: string) => {
    if (selectedAiVersion === null || !noteId || !accessToken || !user?.id) return;
    try {
      const updatedBlock = await updatePersonalAiVersionBlockContent(
        noteId, selectedAiVersion, blockId, content, user.id, accessToken
      );
      setAiVersionData(prev => {
        if (!prev || prev.version !== selectedAiVersion) return prev;
        return { ...prev, blocks: { ...prev.blocks, [blockId]: updatedBlock } };
      });
    } catch (err) {
      console.error('Failed to update AI block:', err);
    }
    setVersionEditingBlockId(null);
  }, [selectedAiVersion, noteId, accessToken, user?.id]);

  const handleAiAutoSave = useCallback((blockId: string, content: string) => {
    if (selectedAiVersion === null || !noteId || !accessToken || !user?.id) return;
    updatePersonalAiVersionBlockContent(
      noteId, selectedAiVersion, blockId, content, user.id, accessToken
    ).then(updatedBlock => {
      setAiVersionData(prev => {
        if (!prev || prev.version !== selectedAiVersion) return prev;
        return { ...prev, blocks: { ...prev.blocks, [blockId]: updatedBlock } };
      });
    }).catch(err => console.error('Failed to auto-save AI block:', err));
  }, [selectedAiVersion, noteId, accessToken, user?.id]);

  const handleAiCancelEdit = useCallback(() => {
    setVersionEditingBlockId(null);
  }, []);

  const handleAiFinishEditing = useCallback(() => {
    setVersionEditingBlockId(null);
  }, []);

  const handleAiDeleteBlock = useCallback(async (blockId: string) => {
    if (selectedAiVersion === null || !noteId || !accessToken || !user?.id) return;
    if (!aiVersionData || aiVersionData.blockOrder.length <= 1) return;
    setVersionEditingBlockId(null);
    try {
      await deletePersonalAiVersionBlock(noteId, selectedAiVersion, blockId, user.id, accessToken);
      setAiVersionData(prev => {
        if (!prev) return prev;
        const { [blockId]: _, ...remainingBlocks } = prev.blocks;
        return {
          ...prev,
          blockOrder: prev.blockOrder.filter(id => id !== blockId),
          blocks: remainingBlocks,
        };
      });
    } catch (err) {
      console.error('Failed to delete AI block:', err);
    }
  }, [selectedAiVersion, noteId, accessToken, user?.id, aiVersionData]);

  const handleAiAddBlock = useCallback(async (
    type: BlockType,
    afterBlockId?: string | null,
  ): Promise<string | null> => {
    if (selectedAiVersion === null || !noteId || !accessToken || !user?.id) return null;
    const content = createEmptyBlockContent(type);
    try {
      const newBlock = await addPersonalAiVersionBlock(
        noteId, selectedAiVersion, type, content, afterBlockId || null, user.id, accessToken
      );
      setAiVersionData(prev => {
        if (!prev) return prev;
        const newBlockOrder = [...prev.blockOrder];
        const insertIndex = afterBlockId
          ? newBlockOrder.indexOf(afterBlockId) + 1
          : newBlockOrder.length;
        newBlockOrder.splice(insertIndex, 0, newBlock.id);
        return {
          ...prev,
          blockOrder: newBlockOrder,
          blocks: { ...prev.blocks, [newBlock.id]: newBlock },
        };
      });
      setTimeout(() => setVersionEditingBlockId(newBlock.id), 100);
      return newBlock.id;
    } catch (err) {
      console.error('Failed to add AI block:', err);
      return null;
    }
  }, [selectedAiVersion, noteId, accessToken, user?.id]);

  const handleAiSaveAndCreateNext = useCallback((
    blockId: string,
    content: string,
    nextBlockType: BlockType = 'paragraph',
  ) => {
    // Save current block then add next
    handleAiAutoSave(blockId, content);
    setVersionEditingBlockId(null);
    handleAiAddBlock(nextBlockType, blockId);
  }, [handleAiAutoSave, handleAiAddBlock]);

  const handleAiDeleteSelectedBlocks = useCallback(async (blockIds: string[]) => {
    if (selectedAiVersion === null || !noteId || !accessToken || !user?.id) return;
    setVersionEditingBlockId(null);
    for (const id of blockIds) {
      try {
        await deletePersonalAiVersionBlock(noteId, selectedAiVersion, id, user.id, accessToken);
      } catch (err) {
        console.error('Failed to delete AI block:', err);
      }
    }
    setAiVersionData(prev => {
      if (!prev) return prev;
      const remainingBlocks = { ...prev.blocks };
      for (const id of blockIds) delete remainingBlocks[id];
      return {
        ...prev,
        blockOrder: prev.blockOrder.filter(id => !blockIds.includes(id)),
        blocks: remainingBlocks,
      };
    });
  }, [selectedAiVersion, noteId, accessToken, user?.id]);

  // No-op undo/redo for AI tab
  const aiNoopUndo = useCallback(async () => false, []);
  const aiNoopRedo = useCallback(async () => false, []);
  const aiNoopCanUndo = useCallback(() => false, []);
  const aiNoopCanRedo = useCallback(() => false, []);
  const aiNoopFlush = useCallback(() => {}, []);

  // ==========================================================================
  // Block Operation Handlers (for Personal Notes BlockEditorCore)
  // ==========================================================================
  const handleStartEditing = useCallback((blockId: string) => {
    if (!isEditing) {
      setIsEditing(true);
    }
    startEditing(blockId);
  }, [isEditing, startEditing]);

  const handleSaveBlock = useCallback((blockId: string, content: string) => {
    saveBlock(blockId, content);
  }, [saveBlock]);

  const handleAutoSave = useCallback((blockId: string, content: string) => {
    trackTextChange(blockId, content);
    saveBlock(blockId, content);
  }, [trackTextChange, saveBlock]);

  const handleDeleteBlock = useCallback((blockId: string) => {
    if (blockOrder.length <= 1) return;

    const currentIndex = blockOrder.indexOf(blockId);
    const blockData = blocksRef.current[blockId] || blocks[blockId];
    const afterBlockId = currentIndex > 0 ? blockOrder[currentIndex - 1] : null;

    finishEditing();
    deleteBlock(blockId);

    if (blockData) {
      historyPushDeleteBlock(blockId, blockData, afterBlockId);
    }
  }, [blockOrder, blocks, finishEditing, deleteBlock, historyPushDeleteBlock]);

  const handleAddBlock = useCallback((type: BlockType, afterBlockId?: string | null) => {
    if (!isEditing) {
      setIsEditing(true);
    }
    const newBlockId = addBlock(type, afterBlockId);
    if (newBlockId) {
      setTimeout(() => {
        const newBlock = blocksRef.current[newBlockId];
        if (newBlock) {
          historyPushAddBlock(newBlockId, newBlock, afterBlockId ?? null);
        }
      }, 50);
      setTimeout(() => {
        startEditing(newBlockId);
      }, 50);
    }
    return newBlockId;
  }, [isEditing, addBlock, historyPushAddBlock, startEditing]);

  const handleSaveAndCreateNext = useCallback((
    blockId: string,
    content: string,
    nextBlockType: BlockType = 'paragraph',
    nextListStart?: number
  ) => {
    flushTextChange();
    saveBlock(blockId, content);

    let initialContent: string | undefined;
    if (nextBlockType === 'bulletList') {
      initialContent = JSON.stringify({
        type: 'bulletList',
        content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }]
      });
    } else if (nextBlockType === 'orderedList') {
      initialContent = JSON.stringify({
        type: 'orderedList',
        attrs: nextListStart ? { start: nextListStart } : undefined,
        content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }]
      });
    } else if (nextBlockType === 'taskList') {
      initialContent = JSON.stringify({
        type: 'taskList',
        content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }]
      });
    }

    finishEditing();
    const newBlockId = addBlock(nextBlockType, blockId, initialContent);
    if (newBlockId) {
      setTimeout(() => {
        const newBlock = blocksRef.current[newBlockId];
        if (newBlock) {
          historyPushAddBlock(newBlockId, newBlock, blockId);
        }
      }, 50);
    }
  }, [saveBlock, finishEditing, addBlock, historyPushAddBlock, flushTextChange]);

  const handleMoveToPrevBlock = useCallback((blockId: string) => {
    const currentIndex = blockOrder.indexOf(blockId);
    if (currentIndex > 0) {
      finishEditing();
    }
  }, [blockOrder, finishEditing]);

  const handleMoveToNextBlock = useCallback((blockId: string) => {
    const currentIndex = blockOrder.indexOf(blockId);
    if (currentIndex < blockOrder.length - 1) {
      finishEditing();
    }
  }, [blockOrder, finishEditing]);

  const handleDeleteSelectedBlocks = useCallback(
    (blockIds: string[]) => {
      for (const id of [...blockIds].reverse()) {
        const blockData = blocksRef.current[id] || blocks[id];
        const idx = blockOrder.indexOf(id);
        const afterBlockId = idx > 0 ? blockOrder[idx - 1] : null;
        finishEditing();
        deleteBlock(id);
        if (blockData) {
          historyPushDeleteBlock(id, blockData, afterBlockId);
        }
      }
    },
    [blockOrder, blocks, finishEditing, deleteBlock, historyPushDeleteBlock]
  );

  // ==========================================================================
  // Participants List (memoized)
  // ==========================================================================
  const participantsList = useMemo(() => {
    if (!note?.participants || note.participants.length === 0) {
      return null;
    }

    return (
      <div className="note-detail-participants">
        <div className="note-detail-participants-header">
          <FiUsers />
          <span>{t('note_detail_participants_label')}</span>
        </div>
        <div className="note-detail-participants-list">
          {note.participants.map((participant: ParticipantInfo) => (
            <div key={participant.id} className="note-detail-participant">
              <img
                src={participant.photoUrl || generateAvatar(participant.username)}
                alt={participant.username}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = generateAvatar(participant.username);
                }}
              />
              <div className="note-detail-participant-info">
                <span className="note-detail-participant-name">
                  {participant.username}
                </span>
                {participant.rating !== null && participant.rating > 0 && (
                  <span className="note-detail-participant-rating">
                    <FiStar size={12} /> {participant.rating}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }, [note?.participants, t]);

  // ==========================================================================
  // Render: Loading States
  // ==========================================================================
  if (!accessToken) {
    return (
      <div className="note-detail-page">
        <div className="note-detail-login-required">
          <FiBook size={64} />
          <h2>{t('notes_login_required')}</h2>
          <button className="note-detail-login-btn" onClick={() => navigate('/login')}>
            {t('notes_login_button')}
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || blocksLoading) {
    return (
      <div className="note-detail-page">
        <div className="note-detail-loading">
          <div className="note-detail-spinner" />
          <p>{t('note_detail_loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="note-detail-page">
        <div className="note-detail-error">
          <FiBook size={48} />
          <h3>{t('note_detail_error_title')}</h3>
          <p>{error || t('note_detail_not_found')}</p>
          <button onClick={() => navigate('/notes')}>{t('note_detail_back')}</button>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // Render: Main Content
  // ==========================================================================
  return (
    <div className="note-detail-page note-detail-three-column">
      {/* Header */}
      <header className="note-detail-header">
        <button className="note-detail-back-btn" onClick={() => navigate('/notes')}>
          <FiArrowLeft />
          {t('note_detail_back')}
        </button>

        <div className="note-detail-actions">
          {isEditing ? (
            <>
              <button
                className="note-detail-cancel-btn"
                onClick={handleCancel}
                disabled={isSaving}
              >
                {t('note_detail_cancel')}
              </button>
              <button
                className="note-detail-save-btn"
                onClick={handleSave}
                disabled={isSaving}
              >
                <FiSave />
                {isSaving ? t('note_detail_saving') : t('note_detail_save')}
              </button>
            </>
          ) : (
            <button
              className="note-detail-edit-btn"
              onClick={() => setIsEditing(true)}
            >
              <FiEdit3 />
              {t('note_detail_edit')}
            </button>
          )}
        </div>
      </header>

      {/* Main Content - 3 Column Layout */}
      <main className="note-detail-main-three-col">
        {/* Left Panel: Book Info + Speaking Logs */}
        <aside className="note-detail-left-panel">
          {/* Book Info Section */}
          <div className="note-detail-left-top">
            {/* Book Cover (3D) */}
            <div className="note-detail-cover">
              <div className="notes-book-container">
                <div className="notes-book">
                  <div className="notes-book-front">
                    <div className="notes-book-cover">
                      {(note.bookCover?.medium || note.bookCover?.small) ? (
                        <img
                          src={note.bookCover?.small || note.bookCover?.medium}
                          alt={note.bookTitle}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : null}
                      <p className="notes-book-author">{note.bookAuthor}</p>
                    </div>
                  </div>
                  <div className="notes-book-left-side">
                    <h2><span>{note.bookTitle}</span></h2>
                  </div>
                </div>
              </div>
              <button
                className={`notes-btn-favorite ${note.liked ? 'active' : ''}`}
                onClick={() => {
                  if (noteId && accessToken) {
                    toggleFavorite(noteId, accessToken);
                    setNote(prev => prev ? { ...prev, liked: !prev.liked } : prev);
                  }
                }}
              >
                <FiStar />
              </button>
            </div>

            {/* Book Info */}
            <div className="note-detail-book-info">
              <h3>{note.bookTitle}</h3>
              <p className="note-detail-author">{note.bookAuthor}</p>
              {note.bookGenre && (
                <span className="note-detail-genre">{note.bookGenre}</span>
              )}
            </div>

            {/* Meeting Info */}
            <div className="note-detail-meeting-info">
              <div className="note-detail-info-item">
                <FiCalendar />
                <span>{formatDate(note.meetingDate)}</span>
              </div>
              <div className="note-detail-info-item">
                <FiUsers />
                <span>{note.participantCount} {t('note_detail_participants')}</span>
              </div>
              <div className="note-detail-info-item">
                <FiClock />
                <span>{formatDuration(note.duration)}</span>
              </div>
            </div>

            {/* Host Info */}
            <div className="note-detail-host">
              <div className="note-detail-host-header">
                <FiUser />
                <span>{t('note_detail_host')}</span>
              </div>
              <div className="note-detail-host-content">
                <img
                  src={note.hostPhotoUrl || generateAvatar(note.hostUsername)}
                  alt={note.hostUsername}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = generateAvatar(note.hostUsername);
                  }}
                />
                <div className="note-detail-host-info">
                  <span className="note-detail-host-name">{note.hostUsername}</span>
                  {note.hostRating > 0 && (
                    <span className="note-detail-host-rating">
                      <FiStar size={12} /> {note.hostRating}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Participants List */}
            {participantsList}
          </div>

          {/* Speaking Logs Section (Bottom) */}
          <div className="note-detail-left-bottom">
            <div className="note-detail-speaking-logs">
              <div className="note-detail-section-header">
                <FiMic />
                <span>{t('note_detail_speaking_logs')}</span>
                {utterances.length > 0 && (
                  <span className="note-detail-utterance-count">{utterances.length}</span>
                )}
              </div>
              <div className="note-detail-speaking-logs-content">
                {utterancesLoading ? (
                  <div className="note-detail-placeholder">
                    <div className="note-detail-spinner" style={{ width: 24, height: 24 }} />
                  </div>
                ) : utterances.length === 0 ? (
                  <div className="note-detail-placeholder">
                    <FiMic size={28} />
                    <p>{t('note_detail_no_speaking_logs')}</p>
                  </div>
                ) : (
                  <div className="nd-speaking-log-list">
                    {[...utterances].reverse().map((u) => (
                      <div key={u.id} className="nd-speaking-log-item">
                        <div className="nd-speaking-log-speaker">
                          {u.speakerPhotoUrl ? (
                            <img
                              src={u.speakerPhotoUrl}
                              alt=""
                              className="nd-speaking-log-photo"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = generateAvatar(u.speakerName);
                              }}
                            />
                          ) : (
                            <img
                              src={generateAvatar(u.speakerName)}
                              alt=""
                              className="nd-speaking-log-photo"
                            />
                          )}
                          <span className="nd-speaking-log-name">{u.speakerName}</span>
                          <span className="nd-speaking-log-index">#{u.utteranceIndex}</span>
                        </div>
                        <div className="nd-speaking-log-meta">
                          <span className="nd-speaking-log-duration">
                            <FiClock size={11} />
                            {formatUtteranceDuration(u.durationMs)}
                          </span>
                          <span className="nd-speaking-log-time">
                            {formatUtteranceTimestamp(u.startAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Center Panel: Tabbed Block Notes */}
        <section className="note-detail-center-panel">
          {/* Title (personal tab only) */}
          {activeTab === 'personal' && (
            isEditing ? (
              <input
                type="text"
                className="note-detail-title-input"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                placeholder={t('note_detail_title_placeholder')}
              />
            ) : (
              <h1 className="note-detail-title">{note.title}</h1>
            )
          )}

          {/* Tab Navigation */}
          <div className="notes-tabs note-detail-tabs">
            <button
              className={`notes-tab ${activeTab === 'personal' ? 'active' : ''}`}
              onClick={() => setActiveTab('personal')}
            >
              <FiFileText size={14} />
              {t('note_detail_tab_personal')}
            </button>
            <button
              className={`notes-tab ${activeTab === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai')}
            >
              <FiCpu size={14} />
              {t('note_detail_tab_ai')}
              {aiVersions.length > 0 && (
                <span className="tab-badge"><FiCheck size={11} /></span>
              )}
            </button>
          </div>

          {/* Personal Notes Tab */}
          {activeTab === 'personal' && (
            <>
              <BlockEditorCore
                blockOrder={blockOrder}
                blocks={blocks}
                editingBlockId={editingBlockId}
                currentUserId={user?.id || ''}
                onStartEdit={handleStartEditing}
                onSaveEdit={handleSaveBlock}
                onAutoSave={handleAutoSave}
                onCancelEdit={cancelEditing}
                onFinishEditing={finishEditing}
                onDeleteBlock={handleDeleteBlock}
                onAddBlock={handleAddBlock}
                onSaveAndCreateNext={handleSaveAndCreateNext}
                onMoveToPrevBlock={handleMoveToPrevBlock}
                onMoveToNextBlock={handleMoveToNextBlock}
                onReorderBlocks={reorderBlocks}
                onReorderMultiple={reorderMultiple}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={canUndo}
                canRedo={canRedo}
                flushTextChange={flushTextChange}
                onDeleteSelectedBlocks={handleDeleteSelectedBlocks}
                onSaveBlock={saveBlock}
                onHistoryPushReorder={historyPushReorderBlock}
                editorRef={editorRef}
                showToolbar={isEditing}
                disabled={!isEditing}
                t={t}
              />

              {/* Auto-save status indicator */}
              {autoSaveStatus === 'saving' && (
                <div className="note-detail-autosave-indicator saving">
                  <FiLoader className="spinning" size={12} />
                  {t('note_detail_auto_saving')}
                </div>
              )}
              {autoSaveStatus === 'saved' && (
                <div className="note-detail-autosave-indicator saved">
                  <FiCheck size={12} />
                  {t('note_detail_auto_saved')}
                </div>
              )}
              {hasChanges && autoSaveStatus === 'idle' && (
                <div className="note-detail-unsaved-indicator">
                  {t('note_detail_unsaved_changes')}
                </div>
              )}
            </>
          )}

          {/* AI Organization Tab */}
          {activeTab === 'ai' && (
            <>
              {/* Read-only badge for shared versions */}
              {isAiVersionReadOnly && aiVersionData && (
                <div className="nd-readonly-banner">
                  <FiFileText size={14} />
                  <span>
                    {t('note_detail_shared_version_label') || 'Shared Version'} v{aiVersionData.version}
                  </span>
                  <span className="nd-readonly-badge">
                    {t('note_detail_readonly_badge') || 'Read-only'}
                  </span>
                </div>
              )}

              {/* Version Selector (personal only) */}
              {aiVersions.length > 0 && !isAiVersionReadOnly && (
                <div className="ai-version-selector">
                  <span className="version-label">{t('meet_ai_versions') || 'Version:'}</span>
                  <div className="version-chips">
                    {aiVersions.map((ver) => (
                      <button
                        key={ver.version}
                        className={`version-chip ${selectedAiVersion === ver.version ? 'active' : ''}`}
                        onClick={() => handleSelectAiVersion(ver.version)}
                        disabled={isLoadingVersion}
                      >
                        v{ver.version}
                        {!ver.valid && <span className="version-warning">!</span>}
                      </button>
                    ))}
                  </div>
                  {isLoadingVersion && <FiLoader className="spin" size={14} />}
                </div>
              )}

              {/* AI Block Editor or Empty State */}
              {aiVersionData && aiVersionData.blockOrder.length > 0 ? (
                <>
                  <BlockEditorCore
                    blockOrder={aiVersionData.blockOrder}
                    blocks={aiVersionData.blocks as unknown as Record<string, Block>}
                    editingBlockId={isAiVersionReadOnly ? null : versionEditingBlockId}
                    currentUserId={user?.id || ''}
                    onStartEdit={isAiVersionReadOnly ? () => {} : handleAiStartEdit}
                    onSaveEdit={handleAiSaveEdit}
                    onAutoSave={handleAiAutoSave}
                    onCancelEdit={handleAiCancelEdit}
                    onFinishEditing={handleAiFinishEditing}
                    onDeleteBlock={handleAiDeleteBlock}
                    onAddBlock={handleAiAddBlock}
                    onSaveAndCreateNext={handleAiSaveAndCreateNext}
                    onMoveToPrevBlock={() => setVersionEditingBlockId(null)}
                    onMoveToNextBlock={() => setVersionEditingBlockId(null)}
                    onReorderBlocks={() => {}}
                    onReorderMultiple={() => {}}
                    onUndo={aiNoopUndo}
                    onRedo={aiNoopRedo}
                    canUndo={aiNoopCanUndo}
                    canRedo={aiNoopCanRedo}
                    flushTextChange={aiNoopFlush}
                    onDeleteSelectedBlocks={handleAiDeleteSelectedBlocks}
                    onSaveBlock={(id, content) => handleAiAutoSave(id, content)}
                    editorRef={aiEditorRef}
                    showToolbar={!isAiVersionReadOnly}
                    disabled={isAiVersionReadOnly}
                    t={t}
                  />

                  {/* Reorganize button (only for personal/editable versions) */}
                  {!isAiVersionReadOnly && (
                    <div className="block-add-section">
                      <button
                        className="ai-organize-btn"
                        onClick={handleOrganizeNotes}
                        disabled={isOrganizing}
                      >
                        <FiCpu size={14} />
                        {isOrganizing
                          ? t('note_detail_organizing')
                          : t('note_detail_reorganize')}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="ai-empty-state">
                  <FiCpu size={48} />
                  <h3>{t('meet_ai_empty_title')}</h3>
                  <p>{t('note_detail_ai_empty_desc')}</p>
                  <button
                    className="ai-generate-btn"
                    onClick={handleOrganizeNotes}
                    disabled={isOrganizing}
                  >
                    {isOrganizing ? (
                      <FiLoader className="spinning" size={16} />
                    ) : (
                      <FiCpu size={16} />
                    )}
                    {isOrganizing
                      ? t('note_detail_organizing')
                      : t('note_detail_organize_notes')}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Right Panel: AI Tools + AI Summary + Transcription */}
        <aside className="note-detail-right-panel">
          {/* AI Tools Section (Tabbed) */}
          <div className="note-detail-ai-tools-section">
            <div className="note-detail-section-header">
              <FiCpu />
              <span>{t('note_detail_ai_tools')}</span>
            </div>

            {/* Tab Navigation */}
            <div className="nd-ai-tabs">
              <button
                className={`nd-ai-tab ${rightPanelTab === 'summary' ? 'active' : ''}`}
                onClick={() => setRightPanelTab('summary')}
              >
                <FiCpu size={14} />
                <span>{t('meet_ai_summary') || 'Summary'}</span>
              </button>
              <button
                className={`nd-ai-tab ${rightPanelTab === 'organized' ? 'active' : ''}`}
                onClick={() => setRightPanelTab('organized')}
              >
                <FiEdit3 size={14} />
                <span>{t('meet_ai_organized') || 'AI Organized'}</span>
              </button>
            </div>

            {/* Summary Tab */}
            {rightPanelTab === 'summary' && (
              <>
                {(() => {
                  const displaySummary = note.personalAiSummary || note.aiSummary;
                  if (displaySummary) {
                    return (
                      <div className="nd-summary-content">
                        {/* One-liner */}
                        <div className="nd-summary-block">
                          <div className="nd-summary-block-header">
                            <span className="nd-summary-icon">📝</span>
                            <span>{t('meet_summary_oneliner') || 'One-line Summary'}</span>
                          </div>
                          <p className="nd-summary-oneliner">{displaySummary.oneLiner}</p>
                        </div>

                        {/* Key Points */}
                        {displaySummary.keyPoints?.length > 0 && (
                          <div className="nd-summary-block">
                            <div className="nd-summary-block-header">
                              <span className="nd-summary-icon">🎯</span>
                              <span>{t('meet_summary_key_points') || 'Key Discussion Points'}</span>
                            </div>
                            <ul className="nd-summary-list">
                              {displaySummary.keyPoints.map((point, i) => (
                                <li key={i}>{point}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Quotes */}
                        {displaySummary.quotes?.length > 0 && (
                          <div className="nd-summary-block">
                            <div className="nd-summary-block-header">
                              <span className="nd-summary-icon">💬</span>
                              <span>{t('meet_summary_quotes') || 'Notable Quotes'}</span>
                            </div>
                            <div className="nd-summary-quotes">
                              {displaySummary.quotes.map((quote, i) => (
                                <blockquote key={i} className="nd-summary-quote">
                                  "{quote}"
                                </blockquote>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Agreements & Disagreements */}
                        {displaySummary.agreements?.length > 0 && (
                          <div className="nd-summary-block">
                            <div className="nd-summary-block-header">
                              <span className="nd-summary-icon">✓</span>
                              <span>{t('meet_summary_agreements') || 'Agreements & Disagreements'}</span>
                            </div>
                            <ul className="nd-summary-agreements">
                              {displaySummary.agreements.map((item, i) => (
                                <li key={i} className={item.isAgreement ? 'agreement' : 'disagreement'}>
                                  {item.isAgreement ? <FiCheck size={14} /> : <FiAlertCircle size={14} />}
                                  <span>{item.point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Open Questions */}
                        {displaySummary.openQuestions?.length > 0 && (
                          <div className="nd-summary-block">
                            <div className="nd-summary-block-header">
                              <span className="nd-summary-icon">❓</span>
                              <span>{t('meet_summary_questions') || 'Follow-up Questions'}</span>
                            </div>
                            <ol className="nd-summary-questions">
                              {displaySummary.openQuestions.map((q, i) => (
                                <li key={i}>{q}</li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="nd-summary-actions">
                          <button
                            className="nd-generate-btn"
                            onClick={handleGenerateSummary}
                            disabled={isGeneratingSummary}
                          >
                            {isGeneratingSummary ? (
                              <FiLoader className="spinning" size={16} />
                            ) : (
                              <FiCpu size={16} />
                            )}
                            {isGeneratingSummary
                              ? t('note_detail_generating')
                              : t('note_detail_regenerate_summary')}
                          </button>
                          <button
                            className="nd-insert-btn"
                            onClick={handleInsertSummaryToNotes}
                          >
                            <FiDownload size={16} />
                            {t('meet_insert_to_notes')}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="nd-summary-empty">
                      <div className="nd-summary-empty-icon">
                        <FiCpu size={40} />
                      </div>
                      <p>{t('note_detail_no_ai_summary')}</p>
                      <button
                        className="nd-generate-btn"
                        onClick={handleGenerateSummary}
                        disabled={isGeneratingSummary}
                      >
                        {isGeneratingSummary ? (
                          <FiLoader className="spinning" size={16} />
                        ) : (
                          <FiCpu size={16} />
                        )}
                        {isGeneratingSummary
                          ? t('note_detail_generating')
                          : t('note_detail_generate_summary')}
                      </button>
                    </div>
                  );
                })()}
              </>
            )}

            {/* AI Organized Tab */}
            {rightPanelTab === 'organized' && (
              <div className="nd-organized-tab-content">
                {/* Shared AI Organized Versions */}
                <div className="nd-organized-subsection">
                  <div className="nd-organized-subsection-header">
                    <FiFileText size={14} />
                    <span>{t('note_detail_shared_organized') || 'Shared Organized'}</span>
                    {sharedAiVersions.length > 0 && (
                      <span className="nd-version-count">{sharedAiVersions.length}</span>
                    )}
                  </div>
                  {sharedAiVersions.length > 0 ? (
                    <div className="nd-version-list">
                      {sharedAiVersions.map((ver) => (
                        <div
                          key={ver.version}
                          className={`nd-version-item clickable ${isAiVersionReadOnly && aiVersionData?.version === ver.version && !selectedAiVersion ? 'active' : ''}`}
                          onClick={() => handleSelectSharedVersion(ver.version)}
                        >
                          <div className="nd-version-label">
                            <span className="nd-version-badge">v{ver.version}</span>
                            <span className="nd-version-date">
                              {new Date(ver.generatedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <button
                            className="nd-import-btn"
                            onClick={() => handleImportSharedVersion(ver.version)}
                            disabled={importingVersion !== null || aiVersions.length >= 5}
                            title={aiVersions.length >= 5 ? 'Maximum 5 personal versions' : ''}
                          >
                            {importingVersion === ver.version ? (
                              <FiLoader className="spinning" size={12} />
                            ) : (
                              <FiDownload size={12} />
                            )}
                            {importingVersion === ver.version
                              ? t('note_detail_importing') || 'Importing...'
                              : t('note_detail_import') || 'Import'}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="nd-version-empty">
                      {t('note_detail_no_shared_organized') || 'No shared organized versions'}
                    </p>
                  )}
                </div>

                <div className="nd-organized-divider" />

                {/* Personal AI Organized Versions */}
                <div className="nd-organized-subsection">
                  <div className="nd-organized-subsection-header">
                    <FiEdit3 size={14} />
                    <span>{t('note_detail_my_organized') || 'My Organized'}</span>
                    <span className="nd-version-count">{aiVersions.length}/5</span>
                  </div>
                  {aiVersions.length > 0 ? (
                    <div className="nd-version-list">
                      {aiVersions.map((ver) => (
                        <div
                          key={ver.version}
                          className={`nd-version-item clickable ${selectedAiVersion === ver.version && !isAiVersionReadOnly ? 'active' : ''}`}
                          onClick={() => {
                            handleSelectAiVersion(ver.version);
                            setActiveTab('ai');
                          }}
                        >
                          <div className="nd-version-label">
                            <span className="nd-version-badge personal">v{ver.version}</span>
                            <span className="nd-version-date">
                              {new Date(ver.generatedAt).toLocaleDateString()}
                            </span>
                            {!ver.valid && (
                              <span className="nd-version-warning">
                                <FiAlertCircle size={12} />
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="nd-version-empty">
                      {t('note_detail_no_personal_organized') || 'No personal organized versions yet'}
                    </p>
                  )}
                </div>

                {/* Organize Action */}
                {aiVersions.length < 5 && (
                  <div className="nd-organized-action">
                    <button
                      className="nd-generate-btn organize"
                      onClick={handleOrganizeNotes}
                      disabled={isOrganizing}
                    >
                      {isOrganizing ? (
                        <FiLoader className="spinning" size={16} />
                      ) : (
                        <FiEdit3 size={16} />
                      )}
                      {isOrganizing
                        ? t('note_detail_organizing')
                        : aiVersions.length > 0
                          ? t('note_detail_reorganize')
                          : t('note_detail_organize_notes')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Transcription Section */}
          <div className="note-detail-ai-transcription-section">
            <div className="note-detail-section-header">
              <FiMic />
              <span>{t('note_detail_ai_transcription')}</span>
              {utterances.length > 0 && (
                <span className="note-detail-utterance-count">{utterances.length}</span>
              )}
            </div>
            <div className="note-detail-transcription-content">
              {utterancesLoading ? (
                <div className="note-detail-placeholder">
                  <div className="note-detail-spinner" />
                </div>
              ) : utterances.length === 0 ? (
                <div className="note-detail-placeholder">
                  <FiMic size={32} />
                  <p>{t('note_detail_no_transcription')}</p>
                </div>
              ) : (
                <div className="note-detail-utterance-list">
                  {[...utterances].reverse().map((utterance) => (
                    <div
                      key={utterance.id}
                      className={`note-detail-utterance-item ${expandedUtteranceId === utterance.id ? 'expanded' : ''}`}
                    >
                      {/* Header */}
                      <div
                        className="note-detail-utterance-header"
                        onClick={() => setExpandedUtteranceId(
                          (prev) => prev === utterance.id ? null : utterance.id
                        )}
                      >
                        <div className="note-detail-utterance-speaker">
                          {utterance.speakerPhotoUrl ? (
                            <img
                              src={utterance.speakerPhotoUrl}
                              alt=""
                              className="note-detail-utterance-photo"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = generateAvatar(utterance.speakerName);
                              }}
                            />
                          ) : (
                            <div className="note-detail-utterance-avatar">
                              <FiUser size={14} />
                            </div>
                          )}
                          <span className="note-detail-utterance-name">{utterance.speakerName}</span>
                          <span className="note-detail-utterance-index">#{utterance.utteranceIndex}</span>
                        </div>
                        <div className="note-detail-utterance-meta">
                          <span className="note-detail-utterance-duration">
                            <FiClock size={12} />
                            {formatUtteranceDuration(utterance.durationMs)}
                          </span>
                          {expandedUtteranceId === utterance.id ? (
                            <FiChevronUp size={16} />
                          ) : (
                            <FiChevronDown size={16} />
                          )}
                        </div>
                      </div>

                      {/* Expanded Body */}
                      {expandedUtteranceId === utterance.id && (
                        <div className="note-detail-utterance-body">
                          {/* View mode toggle */}
                          <div className="note-detail-utterance-view-toggle">
                            <button
                              className={utteranceViewMode === 'refined' ? 'active' : ''}
                              onClick={() => setUtteranceViewMode('refined')}
                            >
                              {t('utterance_refined')}
                            </button>
                            <button
                              className={utteranceViewMode === 'raw' ? 'active' : ''}
                              onClick={() => setUtteranceViewMode('raw')}
                            >
                              {t('utterance_raw')}
                            </button>
                          </div>

                          {/* Text */}
                          <div className="note-detail-utterance-text">
                            {utteranceViewMode === 'refined'
                              ? utterance.refinedText
                              : utterance.rawText}
                          </div>

                          {/* Summary */}
                          {utterance.summary && (
                            <div className="note-detail-utterance-summary">
                              {utterance.summary.keyPoints?.length > 0 && (
                                <div className="note-detail-utterance-summary-section">
                                  <div className="note-detail-utterance-summary-header">
                                    <FiMessageSquare size={12} />
                                    <span>{t('utterance_key_points')}</span>
                                  </div>
                                  <ul>
                                    {utterance.summary.keyPoints.map((point, i) => (
                                      <li key={i}>{point}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {utterance.summary.issues?.length > 0 && (
                                <div className="note-detail-utterance-summary-section">
                                  <div className="note-detail-utterance-summary-header">
                                    <FiAlertCircle size={12} />
                                    <span>{t('utterance_issues')}</span>
                                  </div>
                                  <ul>
                                    {utterance.summary.issues.map((issue, i) => (
                                      <li key={i}>{issue}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {utterance.summary.topics?.length > 0 && (
                                <div className="note-detail-utterance-topics">
                                  <FiTag size={12} />
                                  <div className="note-detail-topic-tags">
                                    {utterance.summary.topics.map((topic, i) => (
                                      <span key={i} className="note-detail-topic-tag">
                                        {topic}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Insert utterance to notes */}
                          <button
                            className="note-detail-insert-btn"
                            onClick={() => handleInsertUtteranceToNotes(utterance)}
                          >
                            <FiDownload size={13} />
                            {t('meet_insert_to_notes')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Endorsement Section */}
          {!endorsementLoading && (hasUnendorsed || isEndorsementCollapsing) && (
            <div className={`note-detail-endorsement ${isEndorsementCollapsing ? 'collapsing' : ''}`}>
              <div className="note-detail-endorsement-header">
                <FiAward />
                <span>{t('note_detail_endorsement_title')}</span>
              </div>
              <p className="note-detail-endorsement-desc">
                {t('note_detail_endorsement_desc')}
              </p>
              <div className="note-detail-endorsement-pending">
                {pendingParticipants
                  .filter(p => !p.alreadyEndorsed)
                  .slice(0, 3)
                  .map((p, idx) => (
                    <div key={p.userId} className="endorsement-pending-avatar" style={{ zIndex: 10 - idx }}>
                      {p.photoUrl ? (
                        <img src={p.photoUrl} alt={p.username} />
                      ) : (
                        <div className="endorsement-pending-default">
                          {p.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  ))}
                {pendingParticipants.filter(p => !p.alreadyEndorsed).length > 3 && (
                  <span className="endorsement-pending-more">
                    +{pendingParticipants.filter(p => !p.alreadyEndorsed).length - 3}
                  </span>
                )}
              </div>
              <button
                className="note-detail-endorsement-btn"
                onClick={handleOpenEndorsementModal}
              >
                <FiAward size={16} />
                {t('note_detail_endorsement_button')}
              </button>
            </div>
          )}
        </aside>
      </main>

      {/* Endorsement Modal */}
      {note?.sessionId && (
        <EndorsementFeedbackModal
          isOpen={isEndorsementModalOpen}
          onClose={handleCloseEndorsementModal}
          sessionId={note.sessionId}
        />
      )}
    </div>
  );
};

export default NoteDetail;
