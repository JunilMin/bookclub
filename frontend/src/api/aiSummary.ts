import axiosInstance, { setAccessToken } from './axiosInstance';
import { SessionRecording } from '../types/meetRoom';

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
export const generateAISummary = async (sessionId: string, token: string): Promise<SessionRecording> => {
  setAccessToken(token);
  const response = await axiosInstance.post(`/sessions/${sessionId}/ai-summary`);
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
