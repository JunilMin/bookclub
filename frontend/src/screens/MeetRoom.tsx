import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiArrowLeft,
  FiVideo,
  FiLoader,
  FiUsers,
} from 'react-icons/fi';
import { getSession, GetSessionResponse } from '../api/sessions';
import { getNotes } from '../api/notes';
import { getQueue, raiseHand, nextSpeaker, removeFromQueue } from '../api/speakingQueue';
import { getRecording, toggleRecording, generateAISummary, exportMarkdown } from '../api/aiSummary';
import { useAuth } from '../AuthContext/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import {
  SpeakingQueue,
  SessionRecording,
  PresenceMessage,
} from '../types/meetRoom';
import './styles/MeetRoom.css';

// Left Panel Components
import ModeratorControls from '../components/meet/LeftPanel/ModeratorControls';
// Center Panel Components
import CollaborativeNotes from '../components/meet/CenterPanel/CollaborativeNotes';
// Right Panel Components
import RecordingPanel from '../components/meet/RightPanel/RecordingPanel';

const MeetRoom: React.FC = () => {
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();

  // State (note 상태 제거 - CollaborativeNotes가 자체 관리)
  const [session, setSession] = useState<GetSessionResponse | null>(null);
  const [initialNoteContent, setInitialNoteContent] = useState<any>(null);
  const [queue, setQueue] = useState<SpeakingQueue | null>(null);
  const [recording, setRecording] = useState<SessionRecording | null>(null);
  const [_presence, setPresence] = useState<PresenceMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WebSocket (발언 대기열, presence용 - 노트는 CollaborativeNotes에서 별도 처리)
  const { isConnected, subscribe, send } = useWebSocket(sessionId || '');

  // Fetch initial data
  useEffect(() => {
    if (!accessToken) {
      navigate('/login');
      return;
    }

    if (!sessionId) {
      setError('Session ID is required');
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [sessionData, noteData, queueData, recordingData] = await Promise.all([
          getSession(sessionId, accessToken),
          getNotes(sessionId, accessToken).catch(() => null),
          getQueue(sessionId, accessToken).catch(() => null),
          getRecording(sessionId, accessToken).catch(() => null),
        ]);

        setSession(sessionData);
        // 초기 노트 내용 설정 (CollaborativeNotes에 전달)
        if (noteData?.content) {
          try {
            setInitialNoteContent(JSON.parse(noteData.content));
          } catch {
            setInitialNoteContent(noteData.content);
          }
        }
        setQueue(queueData);
        setRecording(recordingData);
      } catch (err: any) {
        console.error('Failed to fetch session data:', err);
        if (err.response?.status === 403) {
          setError(t('meeting_not_participant') || 'You are not a participant of this meeting');
        } else if (err.response?.status === 404) {
          setError(t('meeting_not_found') || 'Session not found');
        } else {
          setError(t('meeting_load_error') || 'Failed to load meeting');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [sessionId, accessToken, navigate, t]);

  // Subscribe to WebSocket topics (Queue, Presence만 - Notes는 CollaborativeNotes에서 처리)
  useEffect(() => {
    if (!isConnected || !sessionId) return;

    // Subscribe to queue updates
    const unsubQueue = subscribe(`/topic/session/${sessionId}/queue`, (message) => {
      const queueUpdate: SpeakingQueue = JSON.parse(message.body);
      setQueue(queueUpdate);
    });

    // Subscribe to presence updates (기존 방식 유지 - 발언 대기열용)
    const unsubPresence = subscribe(`/topic/session/${sessionId}/presence`, (message) => {
      const presenceUpdate: PresenceMessage = JSON.parse(message.body);
      setPresence(prev => {
        if (presenceUpdate.action === 'JOIN') {
          return [...prev.filter(p => p.odUserId !== presenceUpdate.odUserId), presenceUpdate];
        } else if (presenceUpdate.action === 'LEAVE') {
          return prev.filter(p => p.odUserId !== presenceUpdate.odUserId);
        }
        return prev;
      });
    });

    // Send join presence
    if (user) {
      send(`/app/session/${sessionId}/presence`, {
        action: 'JOIN',
        odUserId: user.uid,
        username: user.username,
        photoUrl: user.photoUrl || '',
      });
    }

    return () => {
      unsubQueue();
      unsubPresence();
      // Send leave presence
      if (user) {
        send(`/app/session/${sessionId}/presence`, {
          action: 'LEAVE',
          odUserId: user.uid,
          username: user.username,
          photoUrl: user.photoUrl || '',
        });
      }
    };
  }, [isConnected, sessionId, subscribe, send, user]);

  // Handlers
  const handleRaiseHand = useCallback(async () => {
    if (!sessionId || !accessToken || !user) return;
    try {
      const result = await raiseHand(sessionId, user.uid, user.username, user.photoUrl || '', accessToken);
      setQueue(result);
    } catch (err) {
      console.error('Failed to raise hand:', err);
    }
  }, [sessionId, accessToken, user]);

  const handleNextSpeaker = useCallback(async () => {
    if (!sessionId || !accessToken) return;
    try {
      const result = await nextSpeaker(sessionId, accessToken);
      setQueue(result);
    } catch (err) {
      console.error('Failed to move to next speaker:', err);
    }
  }, [sessionId, accessToken]);

  const handleRemoveFromQueue = useCallback(async (odUserId: string) => {
    if (!sessionId || !accessToken) return;
    try {
      const result = await removeFromQueue(sessionId, odUserId, accessToken);
      setQueue(result);
    } catch (err) {
      console.error('Failed to remove from queue:', err);
    }
  }, [sessionId, accessToken]);

  const handleToggleRecording = useCallback(async () => {
    if (!sessionId || !accessToken) return;
    try {
      const result = await toggleRecording(sessionId, accessToken);
      setRecording(result);
    } catch (err) {
      console.error('Failed to toggle recording:', err);
    }
  }, [sessionId, accessToken]);

  const handleGenerateSummary = useCallback(async () => {
    if (!sessionId || !accessToken) return;
    try {
      const result = await generateAISummary(sessionId, accessToken);
      setRecording(result);
    } catch (err) {
      console.error('Failed to generate summary:', err);
    }
  }, [sessionId, accessToken]);

  const handleExport = useCallback(async () => {
    if (!sessionId || !accessToken) return;
    try {
      const markdown = await exportMarkdown(sessionId, accessToken);
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `notes-${sessionId}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export:', err);
    }
  }, [sessionId, accessToken]);

  const handleOpenMeet = useCallback(() => {
    if (session?.meetLink) {
      window.open(session.meetLink, '_blank', 'noopener,noreferrer');
    }
  }, [session]);

  // Check if current user is host
  const isHost = user?.username === session?.post?.creater;

  // Check if current user has raised hand
  const hasRaisedHand = queue?.participants?.find(p => p.odUserId === user?.uid)?.hasRaisedHand || false;

  // Loading state
  if (isLoading) {
    return (
      <div className="meetroom-page">
        <div className="meetroom-loading">
          <FiLoader className="meetroom-loading-spinner" size={48} />
          <p>{t('loading') || 'Loading...'}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !session) {
    return (
      <div className="meetroom-page">
        <div className="meetroom-not-found">
          <FiVideo size={64} />
          <h2>{error || t('meeting_not_found')}</h2>
          <p>{t('meeting_not_found_desc') || 'The meeting you are looking for could not be found.'}</p>
          <Link to="/board" className="meetroom-back-link">
            <FiArrowLeft size={18} />
            {t('meeting_back_to_browse') || 'Back to Browse'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="meetroom-page">
      {/* Header */}
      <header className="meetroom-header">
        <div className="meetroom-header-left">
          <button className="meetroom-back-btn" onClick={() => navigate('/board')}>
            <FiArrowLeft size={20} />
          </button>
          <div className="meetroom-title-section">
            <h1 className="meetroom-title">{session.post.book}</h1>
            <span className="meetroom-subtitle">
              {t('browse_modal_host')}: {session.post.creater}
            </span>
          </div>
        </div>
        <div className="meetroom-header-right">
          {session.status === 'live' && (
            <span className="meetroom-live-badge">
              <span className="live-dot"></span>
              LIVE
            </span>
          )}
          {recording?.isRecording && (
            <span className="meetroom-recording-badge">
              <span className="recording-dot"></span>
              Recording
            </span>
          )}
          <span className="meetroom-participants-badge">
            <FiUsers size={16} />
            {queue?.participants?.length || 0}
          </span>
          <span className="meetroom-connection-status" data-connected={isConnected}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </header>

      {/* Main Content - 3 Panel Layout */}
      <div className="meetroom-content">
        {/* Left Panel - Moderator Controls */}
        <aside className="meetroom-left-panel">
          <ModeratorControls
            meetLink={session.meetLink}
            queue={queue}
            isHost={isHost}
            hasRaisedHand={hasRaisedHand}
            onOpenMeet={handleOpenMeet}
            onRaiseHand={handleRaiseHand}
            onNextSpeaker={handleNextSpeaker}
            onRemoveFromQueue={handleRemoveFromQueue}
          />
        </aside>

        {/* Center Panel - Collaborative Notes (Op-based) */}
        <main className="meetroom-center-panel">
          {user && sessionId && (
            <CollaborativeNotes
              docId={sessionId}
              userId={user.uid}
              username={user.username || 'Anonymous'}
              initialContent={initialNoteContent}
            />
          )}
        </main>

        {/* Right Panel - Recording & AI Summary */}
        <aside className="meetroom-right-panel">
          <RecordingPanel
            recording={recording}
            isHost={isHost}
            onToggleRecording={handleToggleRecording}
            onGenerateSummary={handleGenerateSummary}
            onExport={handleExport}
          />
        </aside>
      </div>
    </div>
  );
};

export default MeetRoom;
