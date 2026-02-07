import axiosInstance, { setAccessToken } from './axiosInstance';
import { SessionUtterance, UtteranceSettings } from '../types/meetRoom';

/**
 * Upload audio and start utterance processing.
 * Returns immediately; results are broadcast via WebSocket.
 */
export const uploadUtterance = async (
  sessionId: string,
  audioBlob: Blob,
  speakerId: string,
  speakerName: string,
  speakerPhotoUrl: string,
  startAt: Date,
  endAt: Date,
  language: string,
  token: string
): Promise<void> => {
  setAccessToken(token);

  const formData = new FormData();
  formData.append('audio', audioBlob, 'utterance.webm');
  formData.append('speakerId', speakerId);
  formData.append('speakerName', speakerName);
  formData.append('speakerPhotoUrl', speakerPhotoUrl || '');
  formData.append('startAt', startAt.toISOString());
  formData.append('endAt', endAt.toISOString());
  formData.append('language', language);

  await axiosInstance.post(`/sessions/${sessionId}/utterances`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

/**
 * Get all utterances for a session.
 */
export const getUtterances = async (
  sessionId: string,
  token: string
): Promise<SessionUtterance[]> => {
  setAccessToken(token);
  const response = await axiosInstance.get(`/sessions/${sessionId}/utterances`);
  return response.data;
};

/**
 * Get a specific utterance.
 */
export const getUtterance = async (
  sessionId: string,
  utteranceIndex: number,
  token: string
): Promise<SessionUtterance> => {
  setAccessToken(token);
  const response = await axiosInstance.get(
    `/sessions/${sessionId}/utterances/${utteranceIndex}`
  );
  return response.data;
};

/**
 * Mark an utterance as inserted to notes.
 */
export const markUtteranceInserted = async (
  sessionId: string,
  utteranceIndex: number,
  token: string
): Promise<SessionUtterance> => {
  setAccessToken(token);
  const response = await axiosInstance.post(
    `/sessions/${sessionId}/utterances/${utteranceIndex}/insert-to-notes`
  );
  return response.data;
};

/**
 * Get auto-insert setting.
 */
export const getAutoInsertSetting = async (
  sessionId: string,
  token: string
): Promise<boolean> => {
  setAccessToken(token);
  const response = await axiosInstance.get(
    `/sessions/${sessionId}/utterances/settings/auto-insert`
  );
  return response.data.autoInsertToNotes;
};

/**
 * Set auto-insert setting.
 */
export const setAutoInsertSetting = async (
  sessionId: string,
  enabled: boolean,
  token: string
): Promise<void> => {
  setAccessToken(token);
  await axiosInstance.put(
    `/sessions/${sessionId}/utterances/settings/auto-insert?enabled=${enabled}`
  );
};

/**
 * Set language policy.
 */
export const setLanguagePolicySetting = async (
  sessionId: string,
  language: 'auto' | 'ko' | 'en',
  token: string
): Promise<void> => {
  setAccessToken(token);
  await axiosInstance.put(
    `/sessions/${sessionId}/utterances/settings/language?language=${language}`
  );
};

/**
 * Get utterance settings (auto-insert and language policy).
 */
export const getUtteranceSettings = async (
  sessionId: string,
  token: string
): Promise<UtteranceSettings> => {
  setAccessToken(token);

  // For now, we only have auto-insert endpoint
  // Language policy is stored in recording but we don't have a specific endpoint
  const autoInsert = await getAutoInsertSetting(sessionId, token);

  return {
    autoInsertToNotes: autoInsert,
    languagePolicy: 'auto', // Default, can be extended
  };
};
