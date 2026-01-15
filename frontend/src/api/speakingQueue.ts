import axiosInstance, { setAccessToken } from './axiosInstance';
import { SpeakingQueue, QueueActionMessage } from '../types/meetRoom';

/**
 * Get speaking queue
 */
export const getQueue = async (sessionId: string, token: string): Promise<SpeakingQueue> => {
  setAccessToken(token);
  const response = await axiosInstance.get(`/sessions/${sessionId}/queue`);
  return response.data;
};

/**
 * Raise/lower hand
 */
export const raiseHand = async (
  sessionId: string,
  userId: string,
  username: string,
  photoUrl: string,
  token: string
): Promise<SpeakingQueue> => {
  setAccessToken(token);
  const message: QueueActionMessage = {
    action: 'RAISE_HAND',
    userId,
    username,
    photoUrl,
  };
  const response = await axiosInstance.post(`/sessions/${sessionId}/queue/raise-hand`, message);
  return response.data;
};

/**
 * Move to next speaker (host only)
 */
export const nextSpeaker = async (sessionId: string, token: string): Promise<SpeakingQueue> => {
  setAccessToken(token);
  const response = await axiosInstance.post(`/sessions/${sessionId}/queue/next-speaker`);
  return response.data;
};

/**
 * Remove from queue
 */
export const removeFromQueue = async (
  sessionId: string,
  userId: string,
  token: string
): Promise<SpeakingQueue> => {
  setAccessToken(token);
  const message: QueueActionMessage = {
    action: 'REMOVE',
    userId,
    username: '',
    photoUrl: '',
  };
  const response = await axiosInstance.post(`/sessions/${sessionId}/queue/remove`, message);
  return response.data;
};
