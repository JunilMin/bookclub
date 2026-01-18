// API functions for endorsement operations

import axiosInstance, { setAccessToken } from './axiosInstance';
import {
  EndorsementRequest,
  EndorsementResponse,
  PendingResponse,
} from '../types/endorsement';

/**
 * Submit an endorsement for a participant.
 * @param request The endorsement request
 * @param accessToken The user's access token
 * @returns The created endorsement
 */
export const submitEndorsement = async (
  request: EndorsementRequest,
  accessToken: string
): Promise<EndorsementResponse> => {
  setAccessToken(accessToken);
  const response = await axiosInstance.post<EndorsementResponse>(
    '/endorsements',
    request
  );
  return response.data;
};

/**
 * Get pending participants for endorsement in a session.
 * @param sessionId The session ID
 * @param accessToken The user's access token
 * @returns List of participants with their endorsement status
 */
export const getPendingParticipants = async (
  sessionId: string,
  accessToken: string
): Promise<PendingResponse> => {
  setAccessToken(accessToken);
  const response = await axiosInstance.get<PendingResponse>(
    '/endorsements/pending',
    { params: { sessionId } }
  );
  return response.data;
};

/**
 * Check if an endorsement already exists.
 * @param sessionId The session ID
 * @param targetUserId The target user ID
 * @param accessToken The user's access token
 * @returns True if endorsement exists
 */
export const checkEndorsementExists = async (
  sessionId: string,
  targetUserId: string,
  accessToken: string
): Promise<boolean> => {
  setAccessToken(accessToken);
  const response = await axiosInstance.get<{ exists: boolean }>(
    '/endorsements/exists',
    { params: { sessionId, targetUserId } }
  );
  return response.data.exists;
};
