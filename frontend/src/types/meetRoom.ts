// Session Note Types
export interface SessionNote {
  id: string;
  sessionId: string;
  title: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  lastEditedById: string;
}

export interface NoteUpdateMessage {
  content: string;
  userId: string;
  username: string;
  uid: string;
  timestamp: number;
}

// Voice Chat Mode Types
export type VoiceChatMode = 'RULES' | 'FREE';

// Communication Mode Types (WebRTC vs Google Meet)
export type CommunicationMode = 'webrtc' | 'google-meet';

// Speaking Queue Types
export interface CurrentSpeaker {
  userId: string;
  username: string;
  photoUrl: string;
  startedAt: string;
  speakingTimeSeconds: number;
}

export interface QueuedParticipant {
  userId: string;
  username: string;
  photoUrl: string;
  queuedAt: string;
  position: number;
}

export interface SessionParticipant {
  userId: string;
  username: string;
  photoUrl: string;
  isHost: boolean;
  hasRaisedHand: boolean;
  isOnline: boolean;
  joinedAt: string;
}

export interface SpeakingHistoryEntry {
  userId: string;
  username: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  speakCount: number;
}

export interface SpeakingQueue {
  id: string;
  sessionId: string;
  moderatorId: string | null;  // Current moderator's userId (can be delegated)
  voiceChatMode: VoiceChatMode;  // RULES = hand-raise only, FREE = everyone can speak
  isModeratorTurn: boolean;  // In RULES mode: true when it's moderator's turn between speakers
  currentSpeaker: CurrentSpeaker | null;
  queue: QueuedParticipant[];
  participants: SessionParticipant[];
  speakingHistory: SpeakingHistoryEntry[];
}

export interface QueueActionMessage {
  action: 'RAISE_HAND' | 'NEXT_SPEAKER' | 'REMOVE' | 'ADD_PARTICIPANT';
  userId: string;
  username: string;
  photoUrl: string;
}

// Presence Types
export interface CursorPosition {
  from: number;
  to: number;
  color: string;
}

export interface PresenceMessage {
  action: 'JOIN' | 'LEAVE' | 'CURSOR_MOVE';
  userId: string;
  username: string;
  photoUrl: string;
  cursorPosition?: CursorPosition;
}

// Recording Types
export interface Agreement {
  point: string;
  isAgreement: boolean;
}

// ============================================
// Utterance Types (STT-based speech transcription)
// ============================================

/**
 * Structured summary of an utterance
 */
export interface UtteranceSummary {
  keyPoints: string[];
  issues: string[];
  topics: string[];
}

/**
 * A single utterance (speech turn) with STT and LLM results
 */
export interface SessionUtterance {
  id: string;
  sessionId: string;
  utteranceIndex: number;
  // Speaker info
  speakerId: string;
  speakerName: string;
  speakerPhotoUrl: string;
  // Time info
  startAt: string;
  endAt: string;
  durationMs: number;
  // STT results
  language: string;
  confidence: number;
  rawText: string;
  // LLM results
  refinedText: string;
  summary: UtteranceSummary;
  // Status
  insertedToNotes: boolean;
  insertedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Processing state for utterance
 */
export type UtteranceProcessingStatus =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'transcribing'
  | 'refining'
  | 'summarizing'
  | 'complete'
  | 'error';

export interface UtteranceProcessingState {
  status: UtteranceProcessingStatus;
  progress: number; // 0-100
  error?: string;
}

/**
 * Utterance settings
 */
export interface UtteranceSettings {
  autoInsertToNotes: boolean;
  languagePolicy: 'auto' | 'ko' | 'en';
}

export interface AISummary {
  oneLiner: string;
  keyPoints: string[];
  quotes: string[];
  agreements: Agreement[];
  openQuestions: string[];
  generatedAt: string;
  modelUsed: string;
}

export interface SessionRecording {
  id: string;
  sessionId: string;
  isRecording: boolean;
  recordingStartedAt: string | null;
  recordingEndedAt: string | null;
  recordingDurationSeconds: number;
  aiSummary: AISummary | null;
}

// Meet Room State
export interface MeetRoomState {
  sessionId: string;
  note: SessionNote | null;
  queue: SpeakingQueue | null;
  recording: SessionRecording | null;
  presence: PresenceMessage[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

// ============================================
// WebRTC Voice Chat Types
// ============================================

/**
 * WebRTC signal types
 */
export type SignalType = 'OFFER' | 'ANSWER' | 'ICE' | 'JOIN' | 'LEAVE';

/**
 * WebRTC signaling message for peer-to-peer connection
 */
export interface SignalMessage {
  type: SignalType;
  sessionId: string;
  fromUserId: string;
  toUserId?: string;
  fromUsername?: string;
  payload?: RTCSessionDescriptionInit | RTCIceCandidateInit | null;
}

/**
 * Remote peer connection state
 */
export interface RemotePeer {
  odUserId: string;
  username: string;
  photoUrl?: string;
  peerConnection: RTCPeerConnection;
  audioStream?: MediaStream;
  isMuted: boolean;
}

/**
 * Voice chat state
 */
export interface VoiceChatState {
  isJoined: boolean;
  isMuted: boolean;
  localStream: MediaStream | null;
  remotePeers: Map<string, RemotePeer>;
  error: string | null;
}

/**
 * ICE server configuration
 * Includes STUN and free TURN servers for better NAT traversal
 */
export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    // Google STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // OpenRelay TURN servers (free tier)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  // ICE transport policy: 'all' tries all candidates, 'relay' forces TURN only
  iceTransportPolicy: 'all',
  // Bundle all media on a single connection
  bundlePolicy: 'max-bundle',
  // Use unified plan for modern SDP handling
  rtcpMuxPolicy: 'require',
};

/**
 * WebRTC browser capability detection
 */
export interface WebRTCCapabilities {
  hasWebRTC: boolean;
  hasGetUserMedia: boolean;
  hasEnumerateDevices: boolean;
  hasSinkId: boolean;
  hasAudioContext: boolean;
}

export function detectWebRTCCapabilities(): WebRTCCapabilities {
  return {
    hasWebRTC: typeof RTCPeerConnection !== 'undefined',
    hasGetUserMedia: !!(navigator.mediaDevices?.getUserMedia),
    hasEnumerateDevices: !!(navigator.mediaDevices?.enumerateDevices),
    hasSinkId: 'setSinkId' in HTMLAudioElement.prototype,
    hasAudioContext: typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined',
  };
}

/**
 * Mesh P2P configuration limits
 */
export const MESH_P2P_CONFIG = {
  maxParticipants: 6, // Maximum participants for mesh topology
  warnThreshold: 4,   // Show warning at this many participants
};
