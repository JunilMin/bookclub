import axiosInstance, { setAccessToken } from './axiosInstance';
import {
  SessionRecording,
  AISummary,
  AIOrganizeResponse,
  AIContentVersionsResponse,
  AIContentVersion,
  Block,
} from '../types/meetRoom';

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
 * Organize notes using AI Context-Preserving Editor
 * Reorganizes content for readability while preserving ALL original content
 * Creates a new AI content version and returns it with validation info
 */
export const organizeNotes = async (
  sessionId: string,
  token: string,
  language: string = 'en',
  userId?: string
): Promise<AIOrganizeResponse> => {
  setAccessToken(token);
  const params = new URLSearchParams({ language });
  if (userId) params.append('userId', userId);
  const response = await axiosInstance.post(`/sessions/${sessionId}/ai-organize?${params.toString()}`);
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

// ============================================
// AI Content Version APIs
// ============================================

/**
 * Get all AI content versions for a session
 */
export const getAiContentVersions = async (
  sessionId: string,
  token: string
): Promise<AIContentVersionsResponse> => {
  setAccessToken(token);
  const response = await axiosInstance.get(`/sessions/${sessionId}/ai-versions`);
  return response.data;
};

/**
 * Get a specific AI content version with full block data
 */
export const getAiContentVersion = async (
  sessionId: string,
  version: number,
  token: string
): Promise<AIContentVersion> => {
  setAccessToken(token);
  const response = await axiosInstance.get(`/sessions/${sessionId}/ai-versions/${version}`);
  return response.data;
};

/**
 * Update a block's content in a specific version
 */
export const updateAiVersionBlockContent = async (
  sessionId: string,
  version: number,
  blockId: string,
  content: string,
  userId: string,
  token: string
): Promise<Block> => {
  setAccessToken(token);
  const response = await axiosInstance.put(
    `/sessions/${sessionId}/ai-versions/${version}/blocks/${blockId}/content`,
    { content, userId }
  );
  return response.data;
};

/**
 * Add a new block to a specific version
 */
export const addAiVersionBlock = async (
  sessionId: string,
  version: number,
  type: string,
  content: string,
  afterBlockId: string | null,
  userId: string,
  token: string
): Promise<Block> => {
  setAccessToken(token);
  const response = await axiosInstance.post(
    `/sessions/${sessionId}/ai-versions/${version}/blocks`,
    { type, content, afterBlockId, userId }
  );
  return response.data;
};

/**
 * Delete a block from a specific version
 */
export const deleteAiVersionBlock = async (
  sessionId: string,
  version: number,
  blockId: string,
  userId: string,
  token: string
): Promise<{ success: boolean; blockId: string }> => {
  setAccessToken(token);
  const response = await axiosInstance.delete(
    `/sessions/${sessionId}/ai-versions/${version}/blocks/${blockId}?userId=${userId}`
  );
  return response.data;
};

/**
 * Update block order for a specific version
 */
export const updateAiVersionBlockOrder = async (
  sessionId: string,
  version: number,
  blockOrder: string[],
  userId: string,
  token: string
): Promise<{ success: boolean; blockOrder: string[] }> => {
  setAccessToken(token);
  const response = await axiosInstance.put(
    `/sessions/${sessionId}/ai-versions/${version}/blocks/order`,
    { blockOrder, userId }
  );
  return response.data;
};
