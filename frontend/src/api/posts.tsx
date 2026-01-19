// posts.ts
import axiosInstance, {setAccessToken} from './axiosInstance';

export interface ObjectId {
  timestamp: number;
  date: string;
}

// 미팅 종료 상태 인터페이스
export interface EndStatus {
  ended: boolean;
  endedAt: string | null;
  endedBy: string | null;
}

// 책 정보 인터페이스
export interface BookData {
  title?: string;  // 책 제목
  isbn?: string;   // 책 ISBN
  cover?: string;  // 책 표지 이미지 URL
  author?: string; // 책 저자
  genre?: string;  // 책 장르/카테고리
  api?: 'google' | 'naver'; // 데이터 출처 API
}

export interface Post {
  id: string; // 서버에서 자동 생성되는 ID
  createrId: string; // 생성자 User ObjectId
  date: string; // ISO 형식의 날짜 문자열
  due: string; // ISO 형식의 날짜 문자열
  capacity: number;
  memberIds: string[]; // 참여자 User ObjectId 리스트
  level: 'low' | 'moderate' | 'high';
  // 책 정보 (모든 책 관련 데이터는 여기에 저장)
  bookData: BookData;
  // Google Meet 관련 필드
  meetLink?: string; // Google Meet 링크
  calendarEventId?: string; // Calendar 이벤트 ID
  meetError?: string; // Meet 생성 실패 시 에러 메시지
  // 추가 필드
  duration?: number; // 진행 시간 (분)
  description?: string; // 설명
  tags?: string[]; // 태그 리스트
  recruit?: boolean; // 모집 중 여부 (기본값: true)
  // 강퇴 관련 필드
  blockedIds?: string[]; // 강퇴된 User ObjectId 리스트
  // 종료 상태 필드
  end?: EndStatus;
}

// 미팅 종료 응답 인터페이스
export interface EndPostResponse {
  postId: string;
  ended: boolean;
  endedAt: string | null;
  endedBy: string | null;
}

// 모든 포스트 조회 (userId 전달 시 강퇴된 게시물 제외)
export const getAllPosts = async (token: string, userId?: string): Promise<Post[]> => {
  setAccessToken(token);
  const params = userId ? { userId } : {};
  const response = await axiosInstance.get('/posts', { params });
  return response.data;
};

// 특정 포스트 조회
export const getPostById = async (id: string, token: string): Promise<Post> => {
  setAccessToken(token);
  const response = await axiosInstance.get(`/posts/${id}`);
  return response.data;
};

// 새로운 포스트 생성 (Google Meet 링크 자동 생성됨)
// googleAccessToken은 httpOnly 쿠키로 자동 전송됨
export const createPost = async (
  post: Partial<Post>,
  accessToken: string
): Promise<Post> => {
  setAccessToken(accessToken);
  const response = await axiosInstance.post('/posts', post);
  return response.data;
};

// 포스트 수정
export const updatePost = async (id: string, post: Post, token: string): Promise<Post> => {
  setAccessToken(token);
  const response = await axiosInstance.put(`/posts/${id}`, post);
  return response.data;
};

// 포스트 삭제 로직, 해당 유저의 포스트만 삭제 가능 추가해야함
export const deletePost = async (id: string, token: string): Promise<string> => {
  setAccessToken(token);
  await axiosInstance.delete(`/posts/${id}`);
  return "삭제 성공";
};

// 북미팅 참여
export const joinBookMeeting = async (postId: string, userId: string, token: string): Promise<Post> => {
  setAccessToken(token);
  const response = await axiosInstance.post(`/posts/${postId}/join`, null, {
    params: { userId },
  });
  return response.data;
};

// 북미팅 참여 취소
export const leaveBookMeeting = async (postId: string, userId: string, token: string): Promise<Post> => {
  setAccessToken(token);
  const response = await axiosInstance.post(`/posts/${postId}/leave`, null, {
    params: { userId },
  });
  return response.data;
};

// 멤버 강퇴 (방장만 가능)
export const kickMember = async (
  postId: string,
  targetUserId: string,
  requesterId: string,
  token: string,
  sessionId?: string  // WebSocket 브로드캐스트용
): Promise<Post> => {
  setAccessToken(token);
  const params: Record<string, string> = { targetUserId, requesterId };
  if (sessionId) {
    params.sessionId = sessionId;
  }
  const response = await axiosInstance.post(`/posts/${postId}/kick`, null, {
    params,
  });
  return response.data;
};

// 강퇴 유저 복구 (방장만 가능)
export const restoreMember = async (
  postId: string,
  targetUserId: string,
  requesterId: string,
  token: string
): Promise<Post> => {
  setAccessToken(token);
  const response = await axiosInstance.post(`/posts/${postId}/restore`, null, {
    params: { targetUserId, requesterId },
  });
  return response.data;
};

// 미팅 종료 (호스트만 가능)
export const endMeeting = async (
  postId: string,
  requesterId: string,
  token: string,
  sessionId?: string
): Promise<EndPostResponse> => {
  setAccessToken(token);
  const params: Record<string, string> = { requesterId };
  if (sessionId) {
    params.sessionId = sessionId;
  }
  const response = await axiosInstance.post(`/posts/${postId}/end`, null, {
    params,
  });
  return response.data;
};

// Post의 bookData 업데이트 (기존 Post에 bookData가 없을 때 사용)
export const updatePostBookData = async (
  postId: string,
  bookData: BookData,
  token: string
): Promise<Post> => {
  setAccessToken(token);
  const response = await axiosInstance.patch(`/posts/${postId}/book-data`, bookData);
  return response.data;
};
