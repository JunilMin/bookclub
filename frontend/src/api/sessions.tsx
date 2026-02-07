// frontend/src/api/sessions.tsx
import axiosInstance, { setAccessToken } from './axiosInstance';

// Session 관련 타입 정의
export interface JoinSessionResponse {
  sessionId: string;
  meetLink: string | null;
}

export interface EndInfo {
  ended: boolean;
  endedAt: string | null;
  endedBy: string | null;
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
  end?: EndInfo;
  blockedIds?: string[];
}

export interface GetSessionResponse {
  sessionId: string;
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

/**
 * Room status 정보 (활성 참가자 수)
 */
export interface RoomStatus {
  activeParticipants: number;
  sessionId: string | null;
}

/**
 * 여러 Post의 활성 참가자 수 조회
 * GET /api/sessions/room-statuses?postIds=id1,id2,id3
 */
export const getRoomStatuses = async (
  postIds: string[],
  token: string
): Promise<Record<string, RoomStatus>> => {
  setAccessToken(token);
  const response = await axiosInstance.get('/sessions/room-statuses', {
    params: { postIds: postIds.join(',') },
  });
  return response.data;
};
