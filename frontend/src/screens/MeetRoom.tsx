import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiArrowLeft,
  FiVideo,
  FiLoader,
  FiUsers,
  FiXCircle,
  FiCheckCircle,
} from 'react-icons/fi';
import { getSession, GetSessionResponse } from '../api/sessions';
import { getNotes } from '../api/notes';
import { getQueue, raiseHand, nextSpeaker, removeFromQueue, addParticipantToQueue, reorderQueue, delegateModerator, joinQueueRest, changeVoiceChatMode } from '../api/speakingQueue';
import { getRecording, toggleRecording, generateAISummary, organizeNotes } from '../api/aiSummary';
import { getUserById } from '../api/user';
import { kickMember, restoreMember, getPostById, endMeeting } from '../api/posts';
import { getReportedUserIds } from '../api/reports';
import { getMyAttendance, updateNoteAttendance, AttendanceRecord } from '../api/attendance';
import { BlockedUser } from '../components/meet/LeftPanel/ModeratorControls';
import AttendanceProgress from '../components/meet/LeftPanel/AttendanceProgress';
import ReportModal from '../components/meet/ReportModal';
import EndMeetingModal from '../components/meet/EndMeetingModal';
import EndorsementFeedbackModal from '../components/meet/EndorsementFeedbackModal';
import { useAuth } from '../AuthContext/AuthContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import {
  SpeakingQueue,
  SessionRecording,
  PresenceMessage,
  VoiceChatMode,
  CommunicationMode,
  SessionUtterance,
} from '../types/meetRoom';
import './styles/MeetRoom.css';

// Left Panel Components
import ModeratorControls from '../components/meet/LeftPanel/ModeratorControls';
import VoiceChat from '../components/meet/VoiceChat';
// Center Panel Components
import CollaborativeNotes, { CollaborativeNotesRef } from '../components/meet/CenterPanel/CollaborativeNotes';
// Right Panel Components
import RecordingPanel from '../components/meet/RightPanel/RecordingPanel';
import AISummaryPanel from '../components/meet/RightPanel/AISummaryPanel';
import UtterancePanel from '../components/meet/RightPanel/UtterancePanel';
// Utterance Hooks
import { useUtteranceRecorder, formatRecordingTime } from '../hooks/useUtteranceRecorder';
import { useUtterances } from '../hooks/useUtterances';

const MeetRoom: React.FC = () => {
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { accessToken, user, isLoading, setInMeeting } = useAuth();

  // Refs
  const notesRef = useRef<CollaborativeNotesRef>(null);
  // Store the speaker info when recording starts (to avoid race condition with handleEndTurn)
  const recordingSpeakerRef = useRef<{
    userId: string;
    username: string;
    photoUrl: string;
  } | null>(null);

  // State (note 상태 제거 - CollaborativeNotes가 자체 관리)
  const [session, setSession] = useState<GetSessionResponse | null>(null);
  const [hostUsername, setHostUsername] = useState<string>('');
  const [initialNoteContent, setInitialNoteContent] = useState<any>(null);
  const [initialNoteTitle, setInitialNoteTitle] = useState<string>('');
  const [aiNoteContent, setAiNoteContent] = useState<any>(null);  // AI Organized Notes
  const [aiValidation, setAiValidation] = useState<{
    valid: boolean;
    sourceFragmentIds: string[];
    outputFragmentIds: string[];
    missingFragments: string[];
    validationError: string;
  } | null>(null);
  const [isOrganizing, setIsOrganizing] = useState(false);
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
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [communicationMode, setCommunicationMode] = useState<CommunicationMode>('google-meet');

  // WebSocket에서 queue 업데이트를 받았는지 추적 (race condition 방지)
  const hasReceivedWebSocketQueue = useRef(false);

  // WebSocket (발언 대기열, presence용 - 노트는 CollaborativeNotes에서 별도 처리)
  const { isConnected, subscribe, send } = useWebSocket(sessionId || '');

  // WebRTC Voice Chat
  const {
    isJoined: isVoiceJoined,
    isMuted: isVoiceMuted,
    error: voiceError,
    remotePeers,
    currentInputDeviceId,
    currentOutputDeviceId,
    audioInputDevices,
    audioOutputDevices,
    volume: voiceVolume,
    hasSinkIdSupport,
    isSpeaking,
    peerSpeakingStatus,
    connectionQualities,
    meshWarning,
    joinVoice,
    leaveVoice,
    toggleMute: toggleVoiceMute,
    setMuted: setVoiceMuted,
    changeInputDevice,
    changeOutputDevice,
    setVolume: setVoiceVolume,
    registerAudioElement,
    unregisterAudioElement,
  } = useWebRTC({
    sessionId: sessionId || '',
    userId: user?.id || '',
    username: user?.username || '',
    photoUrl: user?.photoUrl,
    participants: queue?.participants || [],
    subscribe,
    send,
    isWsConnected: isConnected,
  });

  // Format timestamp based on current language
  const formatUtteranceTimestamp = useCallback((dateString: string | undefined): string => {
    if (!dateString) return '';

    const date = new Date(dateString);
    const langCode = t('code') || 'en';

    if (langCode === 'ko') {
      // Korean: Korean timezone, Korean format
      return date.toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } else {
      // English: New York timezone, English format
      return date.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
  }, [t]);

  // Utterance auto-insert handler
  const handleAutoInsertUtterance = useCallback((utterance: SessionUtterance) => {
    if (notesRef.current) {
      // Get translated section title
      const sectionTitle = t('transcription_section_title') || 'Transcriptions';

      // Format timestamp based on language
      const timestamp = formatUtteranceTimestamp(utterance.startAt);

      // Build utterance block content
      const blockContent: any[] = [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: utterance.refinedText }],
        },
      ];

      // Add summary key points as bullet list if available
      if (utterance.summary?.keyPoints?.length > 0) {
        blockContent.push({
          type: 'bulletList',
          content: utterance.summary.keyPoints.map((point) => ({
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: point }] }],
          })),
        });
      }

      // Build the utterance block node (utteranceIndex is 1-based from backend)
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

      // Insert to dedicated transcription section at the bottom
      notesRef.current.insertTranscription(content, sectionTitle);
    }
  }, [t, formatUtteranceTimestamp]);

  // Utterances hook (for STT transcriptions)
  const {
    utterances,
    processingState: utteranceProcessingState,
    autoInsertEnabled,
    uploadAndProcess: uploadUtterance,
    markAsInserted: markUtteranceAsInserted,
    toggleAutoInsert,
  } = useUtterances({
    sessionId: sessionId || '',
    accessToken,
    subscribe,
    isWsConnected: isConnected,
    onAutoInsert: handleAutoInsertUtterance,
  });

  // Utterance recorder hook
  const handleRecordingComplete = useCallback(
    async (audioBlob: Blob, startAt: Date, endAt: Date) => {
      // Use the stored speaker info from when recording started
      const speaker = recordingSpeakerRef.current;

      // Check minimum duration (10 seconds)
      const durationMs = endAt.getTime() - startAt.getTime();
      const MIN_DURATION_MS = 10000; // 10 seconds

      console.log('[Utterance] handleRecordingComplete called', {
        blobSize: audioBlob.size,
        durationMs,
        hasSavedSpeaker: !!speaker,
        speakerName: speaker?.username,
      });

      if (durationMs < MIN_DURATION_MS) {
        console.log(`[Utterance] Recording too short (${(durationMs / 1000).toFixed(1)}s < 10s), skipping transcription`);
        recordingSpeakerRef.current = null;
        return;
      }

      if (!speaker || !accessToken) {
        console.warn('[Utterance] Cannot upload: missing speaker info or accessToken');
        return;
      }

      const currentLanguage = t('code') || 'auto';

      console.log('[Utterance] Uploading audio for:', speaker.username, 'language:', currentLanguage);

      try {
        await uploadUtterance(
          audioBlob,
          speaker.userId,
          speaker.username,
          speaker.photoUrl || '',
          startAt,
          endAt,
          currentLanguage
        );
        console.log('[Utterance] Upload completed successfully');
      } catch (uploadErr) {
        console.error('[Utterance] Upload failed:', uploadErr);
      } finally {
        // Clear the stored speaker info after upload
        recordingSpeakerRef.current = null;
      }
    },
    [accessToken, uploadUtterance, t]
  );

  const {
    isRecording: isRecordingUtterance,
    elapsedSeconds: utteranceRecordingSeconds,
    startRecording: startUtteranceRecording,
    stopRecording: stopUtteranceRecording,
    error: utteranceRecordingError,
  } = useUtteranceRecorder({
    onRecordingComplete: handleRecordingComplete,
  });

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
        console.log('[MeetRoom] fetchData - sessionId:', sessionId);
        const [sessionData, noteData, queueData, recordingData, reportedIds, attendanceData] = await Promise.all([
          getSession(sessionId, accessToken),
          getNotes(sessionId, accessToken).catch(() => null),
          getQueue(sessionId, accessToken).catch(() => null),
          getRecording(sessionId, accessToken).catch(() => null),
          getReportedUserIds(sessionId, accessToken).catch(() => []),
          getMyAttendance(sessionId, accessToken).catch((err) => {
            console.error('[Attendance] getMyAttendance failed:', err?.response?.status, err?.response?.data || err?.message);
            return null;
          }),
        ]);

        console.log('[MeetRoom] attendanceData received:', attendanceData);

        // Set reported user IDs
        setReportedUserIds(reportedIds);

        // Set attendance data
        if (attendanceData) {
          setAttendance(attendanceData);
        } else {
          // Retry attendance fetch after a short delay (race condition handling)
          console.log('[MeetRoom] attendanceData is null, retrying in 1 second...');
          setTimeout(async () => {
            try {
              const retryAttendance = await getMyAttendance(sessionId, accessToken);
              console.log('[MeetRoom] Retry attendance result:', retryAttendance);
              if (retryAttendance) {
                setAttendance(retryAttendance);
              }
            } catch (retryErr: any) {
              console.error('[Attendance] Retry also failed:', retryErr?.response?.status, retryErr?.response?.data || retryErr?.message);
            }
          }, 1000);
        }

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
        // 초기 AI 노트 내용 설정
        if (noteData?.aiContent) {
          try {
            setAiNoteContent(JSON.parse(noteData.aiContent));
          } catch {
            setAiNoteContent(noteData.aiContent);
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

    // Subscribe to attendance updates (for current user)
    const unsubAttendance = subscribe(`/topic/session/${sessionId}/attendance`, (message) => {
      const attendanceUpdate: AttendanceRecord = JSON.parse(message.body);
      // Only update if it's for the current user
      if (attendanceUpdate.userId === user.id) {
        console.log('Attendance updated via WebSocket:', attendanceUpdate);
        setAttendance(attendanceUpdate);
      }
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
      unsubAttendance();
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

  // Handle beforeunload (tab close/refresh) - send leave message and cleanup voice
  useEffect(() => {
    if (!isConnected || !sessionId || !user?.id) return;

    const handleBeforeUnload = () => {
      // Leave voice chat first
      if (isVoiceJoined) {
        leaveVoice();
      }
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
  }, [isConnected, sessionId, user?.id, user?.username, user?.photoUrl, send, isVoiceJoined, leaveVoice]);

  // Leave voice chat when meeting ends
  useEffect(() => {
    if (isMeetingEnded && isVoiceJoined) {
      console.log('[WebRTC] Meeting ended, leaving voice chat');
      leaveVoice();
    }
  }, [isMeetingEnded, isVoiceJoined, leaveVoice]);

  // Auto-mute/unmute in RULES mode based on current speaker
  const prevSpeakerIdRef = useRef<string | null>(null);
  useEffect(() => {
    // Only apply in RULES mode when voice chat is joined
    if (!isVoiceJoined || queue?.voiceChatMode !== 'RULES') {
      return;
    }

    const currentSpeakerId = queue?.currentSpeaker?.userId || null;
    const prevSpeakerId = prevSpeakerIdRef.current;

    // Check if speaker actually changed
    if (currentSpeakerId !== prevSpeakerId) {
      console.log('[WebRTC] Speaker changed in RULES mode:', {
        prevSpeaker: prevSpeakerId,
        newSpeaker: currentSpeakerId,
        myUserId: user?.id,
      });

      if (currentSpeakerId === user?.id) {
        // I am the new speaker - unmute me
        console.log('[WebRTC] I am now the speaker - auto-unmuting');
        setVoiceMuted(false);
      } else {
        // Someone else is the speaker (or no speaker) - mute me
        console.log('[WebRTC] Someone else is speaking - auto-muting');
        setVoiceMuted(true);
      }

      prevSpeakerIdRef.current = currentSpeakerId;
    }
  }, [isVoiceJoined, queue?.voiceChatMode, queue?.currentSpeaker?.userId, user?.id, setVoiceMuted]);

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

      // Start recording in RULES mode when there's a new current speaker
      // Only for WebRTC mode - Google Meet mode doesn't support utterance transcription
      console.log('[Utterance] Next speaker result:', {
        hasCurrentSpeaker: !!result.currentSpeaker,
        speakerName: result.currentSpeaker?.username,
        voiceChatMode: result.voiceChatMode,
        communicationMode,
      });

      if (result.currentSpeaker && result.voiceChatMode === 'RULES' && communicationMode === 'webrtc') {
        // Store speaker info before starting recording (to avoid race condition)
        recordingSpeakerRef.current = {
          userId: result.currentSpeaker.userId,
          username: result.currentSpeaker.username,
          photoUrl: result.currentSpeaker.photoUrl || '',
        };

        console.log('[Utterance] Starting recording for:', result.currentSpeaker.username);
        try {
          await startUtteranceRecording();
          console.log('[Utterance] Recording started successfully');
        } catch (recordingErr) {
          console.error('[Utterance] Failed to start recording:', recordingErr);
          // Clear speaker info if recording failed
          recordingSpeakerRef.current = null;
        }
      } else if (communicationMode === 'google-meet') {
        console.log('[Utterance] Skipping recording - Google Meet mode');
      }
    } catch (err) {
      console.error('Failed to move to next speaker:', err);
    }
  }, [sessionId, accessToken, startUtteranceRecording, communicationMode]);

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

  const handleOrganizeNotes = useCallback(async () => {
    if (!sessionId || !accessToken) return;
    setIsOrganizing(true);
    try {
      // Get current language from i18n
      const currentLanguage = t('code') || 'en'; // 'ko' or 'en'
      console.log('[AI Organize] Calling API with language:', currentLanguage);
      const result = await organizeNotes(sessionId, accessToken, currentLanguage);
      console.log('[AI Organize] API Response:', result);

      // New API response format: { note: SessionNote, validation: {...} }
      if (result.note?.aiContent) {
        try {
          const parsedContent = JSON.parse(result.note.aiContent);
          console.log('[AI Organize] Parsed aiContent:', parsedContent);
          setAiNoteContent(parsedContent);
        } catch {
          console.log('[AI Organize] aiContent is not JSON, using as-is');
          setAiNoteContent(result.note.aiContent);
        }
      }

      // Set validation info
      if (result.validation) {
        console.log('[AI Organize] Validation:', result.validation);
        setAiValidation(result.validation);
      }
    } catch (err) {
      console.error('Failed to organize notes:', err);
    } finally {
      setIsOrganizing(false);
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

  const handleInsertOrganizedToNotes = useCallback(() => {
    if (!recording?.aiOrganizedContent || !notesRef.current) return;

    const organized = recording.aiOrganizedContent;

    // Don't insert if validation failed
    if (!organized.valid) {
      console.warn('Cannot insert organized content: validation failed');
      return;
    }

    // Convert organized text to TipTap content format
    const organizedContent: any[] = [
      // Horizontal rule separator
      { type: 'horizontalRule' },
      // AI Organized heading
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: t('meet_ai_organized_title') || 'AI Organized Notes' }],
      },
    ];

    // Split organized text into paragraphs
    const paragraphs = organized.organizedText?.split('\n\n') || [];
    paragraphs.forEach((paragraph) => {
      const trimmed = paragraph.trim();
      if (trimmed) {
        // Check if it's a heading (starts with ##)
        if (trimmed.startsWith('## ')) {
          organizedContent.push({
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: trimmed.substring(3) }],
          });
        } else {
          organizedContent.push({
            type: 'paragraph',
            content: [{ type: 'text', text: trimmed }],
          });
        }
      }
    });

    // Insert to notes
    notesRef.current.insertContentAtEnd(organizedContent);
  }, [recording?.aiOrganizedContent, t]);

  // Handle note character count change for attendance tracking
  const handleNoteCharCountChange = useCallback(async (charCount: number) => {
    if (!sessionId || !accessToken) return;
    try {
      const updatedAttendance = await updateNoteAttendance(sessionId, charCount, accessToken);
      if (updatedAttendance) {
        setAttendance(updatedAttendance);
      }
    } catch (err) {
      console.error('Failed to update attendance note count:', err);
    }
  }, [sessionId, accessToken]);

  const handleDelegateModerator = useCallback(async (newModeratorId: string) => {
    if (!sessionId || !accessToken) return;
    try {
      const result = await delegateModerator(sessionId, newModeratorId, accessToken);
      setQueue(result);
    } catch (err) {
      console.error('Failed to delegate moderator:', err);
    }
  }, [sessionId, accessToken]);

  const handleChangeVoiceChatMode = useCallback(async (mode: VoiceChatMode) => {
    if (!sessionId || !accessToken) return;
    try {
      const result = await changeVoiceChatMode(sessionId, mode, accessToken);
      setQueue(result);
    } catch (err) {
      console.error('Failed to change voice chat mode:', err);
    }
  }, [sessionId, accessToken]);

  // Handle End Turn (stop recording and move to next speaker)
  const handleEndTurn = useCallback(async () => {
    console.log('[Utterance] handleEndTurn called');

    // Stop recording first - this waits for recording to fully stop
    // and onRecordingComplete to be called before continuing
    console.log('[Utterance] Stopping recording...');
    await stopUtteranceRecording();
    console.log('[Utterance] Recording stopped, moving to next speaker...');

    // Then move to next speaker (this will also start recording for the new speaker)
    await handleNextSpeaker();
  }, [stopUtteranceRecording, handleNextSpeaker]);

  // Handle inserting utterance text to notes
  const handleInsertUtteranceText = useCallback((utterance: SessionUtterance) => {
    if (!notesRef.current) return;

    // Format timestamp based on language
    const timestamp = formatUtteranceTimestamp(utterance.startAt);

    // Build utterance block content
    const blockContent: any[] = [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: utterance.refinedText }],
      },
    ];

    // Add summary key points as bullet list if available
    if (utterance.summary?.keyPoints?.length > 0) {
      blockContent.push({
        type: 'bulletList',
        content: utterance.summary.keyPoints.map((point) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: point }] }],
        })),
      });
    }

    // Build the utterance block node (utteranceIndex is 1-based from backend)
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

    notesRef.current.insertContentAtEnd(content);
    markUtteranceAsInserted(utterance.utteranceIndex);
  }, [markUtteranceAsInserted, formatUtteranceTimestamp]);

  // Handle inserting utterance summary only to notes
  const handleInsertUtteranceSummary = useCallback((utterance: SessionUtterance) => {
    if (!notesRef.current || !utterance.summary) return;

    const content: any[] = [
      {
        type: 'heading',
        attrs: { level: 4 },
        content: [{ type: 'text', text: `${utterance.speakerName} - ${t('utterance_summary') || 'Summary'}` }],
      },
    ];

    // Key points
    if (utterance.summary.keyPoints?.length > 0) {
      content.push({
        type: 'bulletList',
        content: utterance.summary.keyPoints.map((point) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: point }] }],
        })),
      });
    }

    // Issues
    if (utterance.summary.issues?.length > 0) {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', marks: [{ type: 'bold' }], text: t('utterance_issues') || 'Issues:' }],
      });
      content.push({
        type: 'bulletList',
        content: utterance.summary.issues.map((issue) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: issue }] }],
        })),
      });
    }

    notesRef.current.insertContentAtEnd(content);
  }, [t]);

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
            <div className="meetroom-title-row">
              <h1 className="meetroom-title">{session.post.book}</h1>
              {attendance?.status === 'CONFIRMED' && (
                <span className="meetroom-attendance-badge">
                  <FiCheckCircle size={14} />
                  {t('attendance_confirmed') || 'Attendance Confirmed'}
                </span>
              )}
            </div>
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
          {/* Attendance Progress - hide when confirmed */}
          {attendance?.status !== 'CONFIRMED' && (
            <AttendanceProgress
              attendance={attendance}
              meetingStartTime={session?.post?.due}
            />
          )}

          {/* Voice Chat */}
          <VoiceChat
            communicationMode={communicationMode}
            onCommunicationModeChange={setCommunicationMode}
            meetLink={session?.meetLink || undefined}
            isJoined={isVoiceJoined}
            isMuted={isVoiceMuted}
            error={voiceError}
            remotePeers={remotePeers}
            currentUserId={user?.id || ''}
            currentUsername={user?.username || 'Anonymous'}
            currentPhotoUrl={user?.photoUrl}
            voiceChatMode={queue?.voiceChatMode || 'RULES'}
            isHost={isHost || false}
            currentSpeakerId={queue?.currentSpeaker?.userId || null}
            moderatorId={queue?.moderatorId || null}
            audioInputDevices={audioInputDevices}
            audioOutputDevices={audioOutputDevices}
            currentInputDeviceId={currentInputDeviceId}
            currentOutputDeviceId={currentOutputDeviceId}
            volume={voiceVolume}
            hasSinkIdSupport={hasSinkIdSupport}
            isSpeaking={isSpeaking}
            peerSpeakingStatus={peerSpeakingStatus}
            connectionQualities={connectionQualities}
            meshWarning={meshWarning}
            isWsConnected={isConnected}
            onJoin={joinVoice}
            onLeave={leaveVoice}
            onToggleMute={toggleVoiceMute}
            onChangeInputDevice={changeInputDevice}
            onChangeOutputDevice={changeOutputDevice}
            onVolumeChange={setVoiceVolume}
            onChangeChatMode={handleChangeVoiceChatMode}
            registerAudioElement={registerAudioElement}
            unregisterAudioElement={unregisterAudioElement}
          />

          <ModeratorControls
            queue={queue}
            voiceChatMode={queue?.voiceChatMode || 'RULES'}
            isHost={isHost}
            isCreator={isCreator}
            currentUserId={user?.id || ''}
            hasRaisedHand={hasRaisedHand}
            blockedUsers={blockedUsers}
            reportedUserIds={reportedUserIds}
            isRecordingUtterance={isRecordingUtterance}
            recordingElapsedSeconds={utteranceRecordingSeconds}
            communicationMode={communicationMode}
            isVoiceJoined={isVoiceJoined}
            onJoinVoice={joinVoice}
            onRaiseHand={handleRaiseHand}
            onNextSpeaker={handleNextSpeaker}
            onEndTurn={handleEndTurn}
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
              aiContent={aiNoteContent}
              aiValidation={aiValidation}
              isOrganizing={isOrganizing}
              onCharCountChange={handleNoteCharCountChange}
              onOrganizeNotes={handleOrganizeNotes}
            />
          )}
        </main>

        {/* Right Panel - Recording, AI Summary & Utterances */}
        <aside className="meetroom-right-panel">
          {/* AI Summary Panel */}
          <AISummaryPanel
            recording={recording}
            onGenerateSummary={handleGenerateSummary}
            onOrganizeNotes={handleOrganizeNotes}
            onInsertToNotes={handleInsertToNotes}
            onInsertOrganizedToNotes={handleInsertOrganizedToNotes}
          />

          {/* Utterance Panel */}
          <UtterancePanel
            utterances={utterances}
            processingState={utteranceProcessingState}
            autoInsertEnabled={autoInsertEnabled}
            onToggleAutoInsert={toggleAutoInsert}
            onInsertTextToNotes={handleInsertUtteranceText}
            onInsertSummaryToNotes={handleInsertUtteranceSummary}
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
