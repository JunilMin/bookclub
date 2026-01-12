// Session Note Types
export interface SessionNote {
  id: string;
  sessionId: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  lastEditedBy: string;
}

export interface NoteUpdateMessage {
  content: string;
  username: string;
  uid: string;
  timestamp: number;
}

// Speaking Queue Types
export interface CurrentSpeaker {
  odUserId: string;
  username: string;
  photoUrl: string;
  startedAt: string;
  speakingTimeSeconds: number;
}

export interface QueuedParticipant {
  odUserId: string;
  username: string;
  photoUrl: string;
  queuedAt: string;
  position: number;
}

export interface SessionParticipant {
  odUserId: string;
  username: string;
  photoUrl: string;
  isHost: boolean;
  hasRaisedHand: boolean;
  isOnline: boolean;
  joinedAt: string;
}

export interface SpeakingQueue {
  id: string;
  sessionId: string;
  currentSpeaker: CurrentSpeaker | null;
  queue: QueuedParticipant[];
  participants: SessionParticipant[];
}

export interface QueueActionMessage {
  action: 'RAISE_HAND' | 'NEXT_SPEAKER' | 'REMOVE';
  odUserId: string;
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
  odUserId: string;
  username: string;
  photoUrl: string;
  cursorPosition?: CursorPosition;
}

// Recording Types
export interface Agreement {
  point: string;
  isAgreement: boolean;
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
