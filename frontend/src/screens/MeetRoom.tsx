import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiArrowLeft,
  FiVideo,
  FiLoader,
  FiUsers,
  FiXCircle,
} from 'react-icons/fi';
import { getSession, GetSessionResponse } from '../api/sessions';
import { getNotes } from '../api/notes';
import { getQueue, raiseHand, nextSpeaker, removeFromQueue, addParticipantToQueue, reorderQueue, delegateModerator, joinQueueRest } from '../api/speakingQueue';
import { getRecording, toggleRecording, generateAISummary } from '../api/aiSummary';
import { getUserById } from '../api/user';
import { kickMember, restoreMember, getPostById, endMeeting } from '../api/posts';
import { getReportedUserIds } from '../api/reports';
import { BlockedUser } from '../components/meet/LeftPanel/ModeratorControls';
import ReportModal from '../components/meet/ReportModal';
import EndMeetingModal from '../components/meet/EndMeetingModal';
import EndorsementFeedbackModal from '../components/meet/EndorsementFeedbackModal';
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
import CollaborativeNotes, { CollaborativeNotesRef } from '../components/meet/CenterPanel/CollaborativeNotes';
// Right Panel Components
import RecordingPanel from '../components/meet/RightPanel/RecordingPanel';

const MeetRoom: React.FC = () => {
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { accessToken, user, isLoading, setInMeeting } = useAuth();

  // Refs
  const notesRef = useRef<CollaborativeNotesRef>(null);

  // State (note 상태 제거 - CollaborativeNotes가 자체 관리)
  const [session, setSession] = useState<GetSessionResponse | null>(null);
  const [hostUsername, setHostUsername] = useState<string>('');
  const [initialNoteContent, setInitialNoteContent] = useState<any>(null);
  const [initialNoteTitle, setInitialNoteTitle] = useState<string>('');
  const [queue, setQueue] = useState<SpeakingQueue | null>(null);
  const [recording, setRecording] = useState<SessionRecording | null>(null);
  const [_presence, setPresence] = useState<PresenceMessage[]>([]);
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [reportedUserIds, setReportedUserIds] = useState<string[]>([]);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ userId: string; username: string } | null>(null);
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [isMeetingEnded, setIsMeetingEnded] = useState(false);
  const [_meetingEndedBy, setMeetingEndedBy] = useState<string | null>(null);
  const [showEndorsementModal, setShowEndorsementModal] = useState(false);

  // WebSocket에서 queue 업데이트를 받았는지 추적 (race condition 방지)
  const hasReceivedWebSocketQueue = useRef(false);

  // WebSocket (발언 대기열, presence용 - 노트는 CollaborativeNotes에서 별도 처리)
  const { isConnected, subscribe, send } = useWebSocket(sessionId || '');

  // Set meeting status when entering/leaving
  useEffect(() => {
    setInMeeting(true);
    return () => {
      setInMeeting(false);
    };
  }, [setInMeeting]);

  // Fetch initial data
  useEffect(() => {
    // Wait for auth loading to complete
    if (isLoading) {
      return;
    }

    if (!accessToken) {
      navigate('/login');
      return;
    }

    if (!sessionId) {
      setError('Session ID is required');
      setIsLoadingState(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [sessionData, noteData, queueData, recordingData, reportedIds] = await Promise.all([
          getSession(sessionId, accessToken),
          getNotes(sessionId, accessToken).catch(() => null),
          getQueue(sessionId, accessToken).catch(() => null),
          getRecording(sessionId, accessToken).catch(() => null),
          getReportedUserIds(sessionId, accessToken).catch(() => []),
        ]);

        // Set reported user IDs
        setReportedUserIds(reportedIds);

        setSession(sessionData);

        // Check if meeting is already ended
        if (sessionData.post.end?.ended) {
          setIsMeetingEnded(true);
          setMeetingEndedBy(sessionData.post.end.endedBy);
        }

        console.log('Session data:', {
          sessionId: sessionData.sessionId,
          postId: sessionData.post.id,
          createrId: sessionData.post.createrId,
          book: sessionData.post.book,
          end: sessionData.post.end,
        });

        // Fetch host username from createrId
        if (sessionData.post.createrId) {
          console.log('Fetching host username for createrId:', sessionData.post.createrId);
          try {
            const hostUser = await getUserById(sessionData.post.createrId, accessToken);
            console.log('Host user fetched:', hostUser);
            setHostUsername(hostUser.username);
          } catch (error) {
            console.error('Failed to fetch host username:', error);
            setHostUsername('Unknown');
          }
        } else {
          console.error('No createrId in session data!');
          setHostUsername('No Host Info');
        }

        // Fetch blocked users info
        if (sessionData.post.blockedIds && sessionData.post.blockedIds.length > 0) {
          const blockedUserPromises = sessionData.post.blockedIds.map(async (userId: string) => {
            try {
              const userInfo = await getUserById(userId, accessToken);
              return { userId, username: userInfo.username };
            } catch (error) {
              console.error('Failed to fetch blocked user info:', error);
              return { userId, username: 'Unknown User' };
            }
          });
          const blockedUserInfos = await Promise.all(blockedUserPromises);
          setBlockedUsers(blockedUserInfos);
        } else {
          setBlockedUsers([]);
        }

        // 초기 노트 내용 설정 (CollaborativeNotes에 전달)
        if (noteData?.content) {
          try {
            setInitialNoteContent(JSON.parse(noteData.content));
          } catch {
            setInitialNoteContent(noteData.content);
          }
        }
        // 초기 노트 제목 설정
        if (noteData?.title) {
          setInitialNoteTitle(noteData.title);
        }

        // WebSocket에서 이미 최신 queue를 받았으면 API 응답은 무시 (race condition 방지)
        if (!hasReceivedWebSocketQueue.current) {
          setQueue(queueData);
          console.log('Queue set from API (WebSocket not yet received)');
        } else {
          console.log('Queue from API ignored (WebSocket already received newer data)');
        }
        setRecording(recordingData);

        // REST API로 참가자 추가 (WebSocket 연결 전 백업)
        // 이렇게 하면 WebSocket 연결 여부와 관계없이 참가자가 온라인으로 표시됨
        if (user?.id && user?.username) {
          try {
            console.log('=== Joining queue via REST API (backup) ===');
            const updatedQueue = await joinQueueRest(
              sessionId!,
              user.id,
              user.username,
              user.photoUrl || '',
              accessToken
            );
            if (!hasReceivedWebSocketQueue.current) {
              setQueue(updatedQueue);
            }
            console.log('Queue updated via REST join:', {
              participants: updatedQueue?.participants?.length || 0,
              onlineCount: updatedQueue?.participants?.filter((p: any) => p.isOnline).length || 0,
            });
          } catch (restJoinErr) {
            console.error('Failed to join queue via REST:', restJoinErr);
          }
        }

        console.log('Initial data loaded:', {
          sessionId: sessionData.sessionId,
          participants: queueData?.participants?.length || 0,
          userId: user?.id,
          username: user?.username,
        });
      } catch (err: any) {
        console.error('Failed to fetch session data:', err);
        if (err.response?.status === 403) {
          setError(t('meeting_not_participant') || 'You are not a participant of this meeting');
        } else if (err.response?.status === 404) {
          setError(t('meeting_not_found') || 'Session not found');
        } else if (err.response?.status === 410) {
          // Meeting has ended - show ended state instead of error
          setIsMeetingEnded(true);
        } else {
          setError(t('meeting_load_error') || 'Failed to load meeting');
        }
      } finally {
        setIsLoadingState(false);
      }
    };

    fetchData();
  }, [sessionId, accessToken, navigate, t, isLoading]);

  // Subscribe to WebSocket topics (Queue, Presence - DocEditController pattern)
  useEffect(() => {
    console.log('=== WebSocket Session Effect ===', {
      isConnected,
      sessionId,
      userId: user?.id,
      username: user?.username,
    });

    // Reset flag when sessionId changes or component remounts
    hasReceivedWebSocketQueue.current = false;

    if (!isConnected || !sessionId || !user?.id) {
      console.log('Skipping effect: conditions not met', {
        isConnected,
        hasSessionId: !!sessionId,
        hasUserId: !!user?.id,
      });
      return;
    }

    // Subscribe to queue updates
    const unsubQueue = subscribe(`/topic/session/${sessionId}/queue`, (message) => {
      const queueUpdate: SpeakingQueue = JSON.parse(message.body);
      console.log('Queue updated via WebSocket:', {
        participants: queueUpdate.participants?.length || 0,
        participantsOnline: queueUpdate.participants?.filter(p => p.isOnline).length || 0,
        queue: queueUpdate.queue?.length || 0,
        participantsData: queueUpdate.participants,
      });
      // WebSocket에서 받은 데이터가 가장 최신이므로 항상 적용
      hasReceivedWebSocketQueue.current = true;
      setQueue(queueUpdate);
    });

    // Subscribe to presence updates (for backward compatibility)
    const unsubPresence = subscribe(`/topic/session/${sessionId}/presence`, (message) => {
      const presenceUpdate: PresenceMessage = JSON.parse(message.body);
      setPresence(prev => {
        if (presenceUpdate.action === 'JOIN') {
          return [...prev.filter(p => p.userId !== presenceUpdate.userId), presenceUpdate];
        } else if (presenceUpdate.action === 'LEAVE') {
          return prev.filter(p => p.userId !== presenceUpdate.userId);
        }
        return prev;
      });
    });

    // Subscribe to kick events
    const unsubKick = subscribe(`/topic/session/${sessionId}/kick`, (message) => {
      const kickEvent = JSON.parse(message.body);
      console.log('Kick event received:', kickEvent);

      // If current user was kicked, redirect to board with alert
      if (kickEvent.kickedUserId === user.id) {
        alert(t('meet_you_were_kicked') || 'You have been removed from this meeting.');
        navigate('/');
      }
    });

    // Subscribe to meeting ended events
    const unsubEnded = subscribe(`/topic/session/${sessionId}/ended`, (message) => {
      const endedEvent = JSON.parse(message.body);
      console.log('Meeting ended event received:', endedEvent);

      setIsMeetingEnded(true);
      setMeetingEndedBy(endedEvent.endedBy);

      // Show endorsement modal after a short delay
      setTimeout(() => {
        setShowEndorsementModal(true);
      }, 500);
    });

    // Send JOIN message (DocEditController pattern - dedicated endpoint)
    console.log('=== Sending Session JOIN ===', {
      sessionId,
      userId: user.id,
      username: user.username,
    });
    try {
      send(`/app/session/${sessionId}/join`, {
        userId: user.id,
        username: user.username,
        photoUrl: user.photoUrl || '',
      });
      console.log('Session JOIN sent successfully');
    } catch (err) {
      console.error('Failed to send Session JOIN:', err);
    }

    return () => {
      unsubQueue();
      unsubPresence();
      unsubKick();
      unsubEnded();
      // Send LEAVE message (DocEditController pattern - dedicated endpoint)
      console.log('=== Sending Session LEAVE ===', {
        sessionId,
        userId: user.id,
      });
      try {
        send(`/app/session/${sessionId}/leave`, {
          userId: user.id,
          username: user.username,
          photoUrl: user.photoUrl || '',
        });
        console.log('Session LEAVE sent successfully');
      } catch (err) {
        console.error('Failed to send Session LEAVE:', err);
      }
    };
  }, [isConnected, sessionId, user?.id, user?.username, user?.photoUrl, subscribe, send, navigate, t]);

  // Handle beforeunload (tab close/refresh) - send leave message
  useEffect(() => {
    if (!isConnected || !sessionId || !user?.id) return;

    const handleBeforeUnload = () => {
      // Send leave message synchronously before page unloads
      console.log('=== beforeunload: Sending Session LEAVE ===');
      try {
        send(`/app/session/${sessionId}/leave`, {
          userId: user.id,
          username: user.username,
          photoUrl: user.photoUrl || '',
        });
      } catch (err) {
        console.error('Failed to send leave on beforeunload:', err);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isConnected, sessionId, user?.id, user?.username, user?.photoUrl, send]);

  // Periodic heartbeat to keep presence alive (every 30 seconds)
  useEffect(() => {
    if (!isConnected || !sessionId || !user?.id) return;

    const HEARTBEAT_INTERVAL = 30000; // 30 seconds

    const sendHeartbeat = () => {
      send(`/app/session/${sessionId}/presence`, {
        action: 'HEARTBEAT',
        userId: user.id,
        username: user.username,
        photoUrl: user.photoUrl || '',
      });
    };

    // Send initial heartbeat
    sendHeartbeat();

    // Set up interval
    const intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [isConnected, sessionId, user?.id, user?.username, user?.photoUrl, send]);

  // Poll for meeting end state (fallback if WebSocket misses the event)
  useEffect(() => {
    if (!session?.post?.id || !accessToken || isMeetingEnded) return;

    const POLL_INTERVAL = 5000; // 5 seconds

    const checkMeetingEnd = async () => {
      try {
        const post = await getPostById(session.post.id, accessToken);
        if (post.end?.ended) {
          setIsMeetingEnded(true);
          setMeetingEndedBy(post.end.endedBy || null);
        }
      } catch (err) {
        console.error('Failed to check meeting end state:', err);
      }
    };

    const intervalId = setInterval(checkMeetingEnd, POLL_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [session?.post?.id, accessToken, isMeetingEnded]);

  // Handlers
  const handleRaiseHand = useCallback(async () => {
    if (!sessionId || !accessToken || !user || !user.id) {
      console.error('Cannot raise hand: missing required data', { sessionId, hasToken: !!accessToken, userId: user?.id });
      return;
    }
    try {
      const result = await raiseHand(sessionId, user.id, user.username, user.photoUrl || '', accessToken);
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

  const handleRemoveFromQueue = useCallback(async (userId: string) => {
    if (!sessionId || !accessToken) return;
    try {
      const result = await removeFromQueue(sessionId, userId, accessToken);
      setQueue(result);
    } catch (err) {
      console.error('Failed to remove from queue:', err);
    }
  }, [sessionId, accessToken]);

  const handleAddParticipantToQueue = useCallback(async (userId: string, username: string, photoUrl: string) => {
    if (!sessionId || !accessToken) return;
    try {
      const result = await addParticipantToQueue(sessionId, userId, username, photoUrl, accessToken);
      setQueue(result);
    } catch (err) {
      console.error('Failed to add participant to queue:', err);
    }
  }, [sessionId, accessToken]);

  const handleReorderQueue = useCallback(async (userIds: string[]) => {
    if (!sessionId || !accessToken) return;
    try {
      const result = await reorderQueue(sessionId, userIds, accessToken);
      setQueue(result);
    } catch (err) {
      console.error('Failed to reorder queue:', err);
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
      // Get current language from i18n
      const currentLanguage = t('code') || 'en'; // 'ko' or 'en'
      const result = await generateAISummary(sessionId, accessToken, currentLanguage);
      setRecording(result);
    } catch (err) {
      console.error('Failed to generate summary:', err);
    }
  }, [sessionId, accessToken, t]);

  const handleInsertToNotes = useCallback(() => {
    if (!recording?.aiSummary || !notesRef.current) return;

    const summary = recording.aiSummary;

    // Convert AI Summary to TipTap content format
    const summaryContent: any[] = [
      // Horizontal rule separator
      { type: 'horizontalRule' },
      // AI Summary heading
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'AI Summary' }],
      },
      // One-liner
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: summary.oneLiner },
        ],
      },
    ];

    // Key Points
    if (summary.keyPoints?.length > 0) {
      summaryContent.push({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Key Discussion Points' }],
      });
      summaryContent.push({
        type: 'bulletList',
        content: summary.keyPoints.map((point: string) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: point }] }],
        })),
      });
    }

    // Quotes
    if (summary.quotes?.length > 0) {
      summaryContent.push({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Notable Quotes' }],
      });
      summary.quotes.forEach((quote: string) => {
        summaryContent.push({
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: `"${quote}"` }] }],
        });
      });
    }

    // Agreements
    if (summary.agreements?.length > 0) {
      summaryContent.push({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Agreements & Disagreements' }],
      });
      summaryContent.push({
        type: 'bulletList',
        content: summary.agreements.map((item: any) => ({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: `${item.isAgreement ? '✓' : '✗'} ${item.point}`,
            }],
          }],
        })),
      });
    }

    // Open Questions
    if (summary.openQuestions?.length > 0) {
      summaryContent.push({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Follow-up Questions' }],
      });
      summaryContent.push({
        type: 'orderedList',
        content: summary.openQuestions.map((question: string) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: question }] }],
        })),
      });
    }

    // Insert to notes
    notesRef.current.insertContentAtEnd(summaryContent);
  }, [recording?.aiSummary]);

  const handleOpenMeet = useCallback(() => {
    if (session?.meetLink) {
      window.open(session.meetLink, '_blank', 'noopener,noreferrer');
    }
  }, [session]);

  const handleDelegateModerator = useCallback(async (newModeratorId: string) => {
    if (!sessionId || !accessToken) return;
    try {
      const result = await delegateModerator(sessionId, newModeratorId, accessToken);
      setQueue(result);
    } catch (err) {
      console.error('Failed to delegate moderator:', err);
    }
  }, [sessionId, accessToken]);

  const handleKickParticipant = useCallback(async (targetUserId: string) => {
    if (!session?.post?.id || !accessToken || !user?.id || !sessionId) return;

    const confirmed = window.confirm(t('meet_kick_confirm') || 'Are you sure you want to kick this participant?');
    if (!confirmed) return;

    try {
      await kickMember(session.post.id, targetUserId, user.id, accessToken, sessionId);
      // Remove from local queue state and add to blocked users
      setQueue((prevQueue) => {
        if (!prevQueue) return prevQueue;
        // Find the kicked participant to get username
        const kickedParticipant = prevQueue.participants.find(p => p.userId === targetUserId);
        if (kickedParticipant) {
          setBlockedUsers((prevBlocked) => [
            ...prevBlocked,
            { userId: targetUserId, username: kickedParticipant.username }
          ]);
        }
        return {
          ...prevQueue,
          participants: prevQueue.participants.filter(p => p.userId !== targetUserId),
          queue: prevQueue.queue.filter(q => q.userId !== targetUserId),
        };
      });
    } catch (err) {
      console.error('Failed to kick participant:', err);
      alert(t('meet_kick_error') || 'Failed to kick participant');
    }
  }, [session?.post?.id, accessToken, user?.id, sessionId, t]);

  const handleRestoreParticipant = useCallback(async (targetUserId: string) => {
    if (!session?.post?.id || !accessToken || !user?.id) return;

    const confirmed = window.confirm(t('meet_restore_confirm') || 'Are you sure you want to restore this participant?');
    if (!confirmed) return;

    try {
      await restoreMember(session.post.id, targetUserId, user.id, accessToken);
      // Remove from blocked users list
      setBlockedUsers((prevBlocked) => prevBlocked.filter(u => u.userId !== targetUserId));
    } catch (err) {
      console.error('Failed to restore participant:', err);
      alert(t('meet_restore_error') || 'Failed to restore participant');
    }
  }, [session?.post?.id, accessToken, user?.id, t]);

  const handleReportParticipant = useCallback((userId: string, username: string) => {
    setReportTarget({ userId, username });
    setIsReportModalOpen(true);
  }, []);

  const handleReportSuccess = useCallback((reportedUserId: string) => {
    setReportedUserIds((prev) => [...prev, reportedUserId]);
  }, []);

  // Handle end meeting
  const handleEndMeeting = useCallback(async () => {
    if (!session?.post?.id || !accessToken || !user?.id || !sessionId) return;

    await endMeeting(session.post.id, user.id, accessToken, sessionId);
    // The WebSocket broadcast will notify other users
    // For the host, set meeting ended state and show endorsement modal
    setIsMeetingEnded(true);
    setMeetingEndedBy(user.id);

    // Show endorsement modal after a short delay
    setTimeout(() => {
      setShowEndorsementModal(true);
    }, 500);
  }, [session?.post?.id, accessToken, user?.id, sessionId]);

  // Check if current user is moderator (host)
  // Use queue.moderatorId if available, otherwise fall back to post creator
  const isHost = queue?.moderatorId
    ? user?.id === queue.moderatorId
    : user?.id === session?.post?.createrId;

  // Check if current user is the room creator (has kick permission)
  const isCreator = user?.id === session?.post?.createrId;

  // Check if current user has raised hand
  const hasRaisedHand = queue?.participants?.find(p => p.userId === user?.id)?.hasRaisedHand || false;

  // Loading state (wait for both auth and session data)
  if (isLoading || isLoadingState) {
    return (
      <div className="meetroom-page">
        <div className="meetroom-loading">
          <FiLoader className="meetroom-loading-spinner" size={48} />
          <p>{t('loading') || 'Loading...'}</p>
        </div>
      </div>
    );
  }

  // Meeting ended state (entry blocked or meeting ended during session)
  if (isMeetingEnded && !session) {
    return (
      <div className="meetroom-page">
        <div className="meetroom-ended-overlay" style={{ position: 'relative', background: '#f8fafc' }}>
          <div className="meetroom-ended-content">
            <FiXCircle size={64} className="meetroom-ended-icon" />
            <h2>{t('meet_ended_title') || 'Meeting Ended'}</h2>
            <p>
              {t('meet_ended_description') ||
                'This meeting has been ended by the host.'}
            </p>
            <button
              className="meetroom-ended-btn"
              onClick={() => navigate('/')}
            >
              {t('meeting_back_to_browse') || 'Back to Browse'}
            </button>
          </div>
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
          <Link to="/" className="meetroom-back-link">
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
          <button className="meetroom-back-btn" onClick={() => navigate('/')}>
            <FiArrowLeft size={20} />
          </button>
          <div className="meetroom-title-section">
            <h1 className="meetroom-title">{session.post.book}</h1>
            <span className="meetroom-subtitle">
              {t('browse_modal_host')}: {hostUsername || 'Loading...'}
            </span>
          </div>
        </div>
        <div className="meetroom-header-right">
          <span className="meetroom-live-badge">
            <span className="live-dot"></span>
            LIVE
          </span>
          {recording?.isRecording && (
            <span className="meetroom-recording-badge">
              <span className="recording-dot"></span>
              Recording
            </span>
          )}
          <span className="meetroom-participants-badge">
            <FiUsers size={16} />
            {queue?.participants?.filter(p => p.isOnline).length || 0}
          </span>
          <span className="meetroom-connection-status" data-connected={isConnected}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          {isCreator && (
            <button
              className="meetroom-end-btn"
              onClick={() => setIsEndModalOpen(true)}
            >
              <FiXCircle size={16} />
              {t('meet_end_button') || 'End Meeting'}
            </button>
          )}
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
            isCreator={isCreator}
            currentUserId={user?.id || ''}
            hasRaisedHand={hasRaisedHand}
            blockedUsers={blockedUsers}
            reportedUserIds={reportedUserIds}
            onOpenMeet={handleOpenMeet}
            onRaiseHand={handleRaiseHand}
            onNextSpeaker={handleNextSpeaker}
            onRemoveFromQueue={handleRemoveFromQueue}
            onAddParticipantToQueue={handleAddParticipantToQueue}
            onReorderQueue={handleReorderQueue}
            onDelegateModerator={handleDelegateModerator}
            onKickParticipant={handleKickParticipant}
            onRestoreParticipant={handleRestoreParticipant}
            onReportParticipant={handleReportParticipant}
          />
        </aside>

        {/* Center Panel - Collaborative Notes (Op-based) */}
        <main className="meetroom-center-panel">
          {user && sessionId && (
            <CollaborativeNotes
              ref={notesRef}
              docId={sessionId}
              userId={user.id!}
              username={user.username || 'Anonymous'}
              photoUrl={user.photoUrl || ''}
              initialContent={initialNoteContent}
              initialTitle={initialNoteTitle}
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
            onInsertToNotes={handleInsertToNotes}
          />
        </aside>
      </div>

      {/* Report Modal */}
      {reportTarget && (
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={() => {
            setIsReportModalOpen(false);
            setReportTarget(null);
          }}
          sessionId={sessionId || ''}
          postId={session.post.id}
          reportedUserId={reportTarget.userId}
          reportedUsername={reportTarget.username}
          accessToken={accessToken || ''}
          onReportSuccess={handleReportSuccess}
        />
      )}

      {/* End Meeting Modal */}
      <EndMeetingModal
        isOpen={isEndModalOpen}
        onClose={() => setIsEndModalOpen(false)}
        onConfirm={handleEndMeeting}
      />

      {/* Endorsement Feedback Modal (shown after meeting ends) */}
      <EndorsementFeedbackModal
        isOpen={showEndorsementModal}
        onClose={() => {
          setShowEndorsementModal(false);
          // Navigate to board after closing endorsement modal
          navigate('/');
        }}
        sessionId={sessionId || ''}
      />

      {/* Meeting Ended Overlay (hidden when endorsement modal is open) */}
      {isMeetingEnded && !showEndorsementModal && (
        <div className="meetroom-ended-overlay">
          <div className="meetroom-ended-content">
            <FiXCircle size={64} className="meetroom-ended-icon" />
            <h2>{t('meet_ended_title') || 'Meeting Ended'}</h2>
            <p>
              {t('meet_ended_description') ||
                'This meeting has been ended by the host.'}
            </p>
            <button
              className="meetroom-ended-btn"
              onClick={() => navigate('/')}
            >
              {t('meeting_back_to_browse') || 'Back to Browse'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetRoom;
