import axiosInstance, { setAccessToken } from './axiosInstance';
import { SessionRecording, AISummary } from '../types/meetRoom';

/**
 * Note summary response from API
 */
export interface NoteSummaryResponse {
  sessionId: string;
  postId: string;
  bookTitle: string;
  bookAuthor: string;
  bookCover: string;
  bookGenre: string;
  bookIsbn: string;
  meetingDate: string;
  duration: number;
  participantCount: number;
  level: string;
  hostId: string;
  hostUsername: string;
  hostPhotoUrl: string | null;
  hostRating: number;
  aiSummary: AISummary;
  sessionCreatedAt: string;
  isHost: boolean;
  isFavorite: boolean;
}

/**
 * Get recording status
 */
export const getRecording = async (sessionId: string, token: string): Promise<SessionRecording> => {
  setAccessToken(token);
  const response = await axiosInstance.get(`/sessions/${sessionId}/recording`);
  return response.data;
};

/**
 * Toggle recording status
 */
export const toggleRecording = async (sessionId: string, token: string): Promise<SessionRecording> => {
  setAccessToken(token);
  const response = await axiosInstance.post(`/sessions/${sessionId}/recording/toggle`);
  return response.data;
};

/**
 * Generate AI summary
 */
export const generateAISummary = async (
  sessionId: string,
  token: string,
  language: string = 'en'
): Promise<SessionRecording> => {
  setAccessToken(token);
  const response = await axiosInstance.post(`/sessions/${sessionId}/ai-summary?language=${language}`);
  return response.data;
};

/**
 * Export notes as markdown
 */
export const exportMarkdown = async (sessionId: string, token: string): Promise<string> => {
  setAccessToken(token);
  const response = await axiosInstance.get(`/sessions/${sessionId}/export/markdown`, {
    responseType: 'text',
  });
  return response.data;
};

/**
 * Get user's all note summaries
 */
export const getMySummaries = async (token: string): Promise<NoteSummaryResponse[]> => {
  setAccessToken(token);
  const response = await axiosInstance.get('/sessions/my-summaries');
  return response.data;
};
