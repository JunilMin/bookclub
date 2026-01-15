// frontend/src/api/sessions.tsx
import axiosInstance, { setAccessToken } from './axiosInstance';

// Session 관련 타입 정의
export interface JoinSessionResponse {
  sessionId: string;
  status: string;
  meetLink: string | null;
}

export interface PostInfo {
  id: string;
  book: string;
  isbn: string;
  due: string;
  level: string;
  capacity: number;
  memberCount: number;
  createrId: string;
}

export interface GetSessionResponse {
  sessionId: string;
  status: string;
  meetLink: string | null;
  post: PostInfo;
}

export interface ErrorResponse {
  message: string;
  code: string;
}

/**
 * 세션 참가 (없으면 생성, 있으면 재사용)
 * POST /api/sessions/join
 */
export const joinSession = async (postId: string, token: string): Promise<JoinSessionResponse> => {
  setAccessToken(token);
  const response = await axiosInstance.post('/sessions/join', { postId });
  return response.data;
};

/**
 * 세션 조회
 * GET /api/sessions/{sessionId}
 */
export const getSession = async (sessionId: string, token: string): Promise<GetSessionResponse> => {
  setAccessToken(token);
  const response = await axiosInstance.get(`/sessions/${sessionId}`);
  return response.data;
};
