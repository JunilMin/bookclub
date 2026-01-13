import axiosInstance, { setAccessToken } from './axiosInstance';
import { SessionNote, NoteUpdateMessage } from '../types/meetRoom';

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
  username: string,
  token: string
): Promise<SessionNote> => {
  setAccessToken(token);
  const message: NoteUpdateMessage = {
    content,
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
  username: string,
  token: string
): Promise<SessionNote> => {
  setAccessToken(token);
  const response = await axiosInstance.put(`/sessions/${sessionId}/notes/title`, {
    title,
    username,
  });
  return response.data;
};
