import axiosInstance, { setAccessToken } from './axiosInstance';
import { SessionNote, NoteUpdateMessage } from '../types/meetRoom';

/**
 * User Session Note (개인 토론 노트)
 */
export interface UserSessionNote {
  id: string;
  sessionId: string;
  userId: string;
  baseNoteId: string;
  baseVersion: number;
  title: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * AI Summary structure
 */
export interface AISummary {
  oneLiner: string;
  keyPoints: string[];
  quotes: string[];
  agreements: { point: string; isAgreement: boolean }[];
  openQuestions: string[];
  generatedAt: string;
  modelUsed: string;
}

/**
 * Participant info for notes
 */
export interface ParticipantInfo {
  id: string;
  username: string;
  photoUrl: string | null;
  rating: number | null;
  isHost: boolean;
}

/**
 * User Note with meeting context (enriched)
 */
export interface UserNoteResponse {
  // Note Info
  noteId: string;
  sessionId: string;
  postId: string;
  title: string;
  content: string;
  version: number;
  noteCreatedAt: string;
  noteUpdatedAt: string;

  // Book Info
  bookTitle: string;
  bookAuthor: string;
  bookCover: string;
  bookGenre: string;
  bookIsbn: string;

  // Meeting Info
  meetingDate: string;
  duration: number;
  participantCount: number;
  level: string;

  // Host Info
  hostId: string;
  hostUsername: string;
  hostPhotoUrl: string;
  hostRating: number;

  // Participants (host included)
  participants?: ParticipantInfo[];

  // AI Summary (if available)
  aiSummary?: AISummary;

  // User's relation
  isHost: boolean;
  isFavorite: boolean;
}

/**
 * Get session notes
 */
export const getNotes = async (sessionId: string, token: string): Promise<SessionNote> => {
  setAccessToken(token);
  const response = await axiosInstance.get(`/sessions/${sessionId}/notes`);
  return response.data;
};

/**
 * Update session notes (REST fallback)
 */
export const updateNotes = async (
  sessionId: string,
  content: string,
  userId: string,
  username: string,
  token: string
): Promise<SessionNote> => {
  setAccessToken(token);
  const message: NoteUpdateMessage = {
    content,
    userId,
    username,
    uid: '',
    timestamp: Date.now(),
  };
  const response = await axiosInstance.put(`/sessions/${sessionId}/notes`, message);
  return response.data;
};

/**
 * Update note title
 */
export const updateNoteTitle = async (
  sessionId: string,
  title: string,
  userId: string,
  username: string,
  token: string
): Promise<SessionNote> => {
  setAccessToken(token);
  const response = await axiosInstance.put(`/sessions/${sessionId}/notes/title`, {
    title,
    userId,
    username,
  });
  return response.data;
};

// ==================== User Session Notes API ====================

/**
 * Get all my personal notes
 * GET /api/user-notes
 */
export const getMyUserNotes = async (token: string): Promise<UserSessionNote[]> => {
  setAccessToken(token);
  const response = await axiosInstance.get('/user-notes');
  return response.data;
};

/**
 * Get a specific note by ID
 * GET /api/user-notes/{noteId}
 */
export const getUserNoteById = async (noteId: string, token: string): Promise<UserSessionNote> => {
  setAccessToken(token);
  const response = await axiosInstance.get(`/user-notes/${noteId}`);
  return response.data;
};

/**
 * Get my note for a specific session
 * GET /api/user-notes/session/{sessionId}
 */
export const getUserNoteBySession = async (sessionId: string, token: string): Promise<UserSessionNote> => {
  setAccessToken(token);
  const response = await axiosInstance.get(`/user-notes/session/${sessionId}`);
  return response.data;
};

/**
 * Update user note content
 * PUT /api/user-notes/{noteId}/content
 */
export const updateUserNoteContent = async (
  noteId: string,
  content: string,
  token: string
): Promise<UserSessionNote> => {
  setAccessToken(token);
  const response = await axiosInstance.put(`/user-notes/${noteId}/content`, { content });
  return response.data;
};

/**
 * Update user note title
 * PUT /api/user-notes/{noteId}/title
 */
export const updateUserNoteTitle = async (
  noteId: string,
  title: string,
  token: string
): Promise<UserSessionNote> => {
  setAccessToken(token);
  const response = await axiosInstance.put(`/user-notes/${noteId}/title`, { title });
  return response.data;
};

/**
 * Delete user note
 * DELETE /api/user-notes/{noteId}
 */
export const deleteUserNote = async (noteId: string, token: string): Promise<void> => {
  setAccessToken(token);
  await axiosInstance.delete(`/user-notes/${noteId}`);
};

/**
 * Fork note from session manually (after session ended)
 * POST /api/user-notes/fork/{sessionId}
 */
export const forkNoteFromSession = async (sessionId: string, token: string): Promise<UserSessionNote> => {
  setAccessToken(token);
  const response = await axiosInstance.post(`/user-notes/fork/${sessionId}`);
  return response.data;
};

// ==================== Enriched User Notes API ====================

/**
 * Get all my notes with meeting context
 * GET /api/user-notes/enriched
 */
export const getMyNotesEnriched = async (token: string): Promise<UserNoteResponse[]> => {
  setAccessToken(token);
  const response = await axiosInstance.get('/user-notes/enriched');
  return response.data;
};

/**
 * Get a specific note with meeting context
 * GET /api/user-notes/{noteId}/enriched
 */
export const getNoteEnriched = async (noteId: string, token: string): Promise<UserNoteResponse> => {
  setAccessToken(token);
  const response = await axiosInstance.get(`/user-notes/${noteId}/enriched`);
  return response.data;
};
