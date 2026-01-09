// posts.ts
import axiosInstance, {setAccessToken} from './axiosInstance';

export interface ObjectId {
  timestamp: number;
  date: string;
}

export interface Post {
  id: string; // 서버에서 자동 생성되는 ID
  creater: string; // 생성자 username
  date: string; // ISO 형식의 날짜 문자열
  due: string; // ISO 형식의 날짜 문자열
  capacity: number;
  member: string[]; // 참여자 username 리스트
  level: 'low' | 'moderate' | 'high';
  book: string;
  isbn?: string; // 책 ISBN
  // Google Meet 관련 필드
  meetLink?: string; // Google Meet 링크
  calendarEventId?: string; // Calendar 이벤트 ID
  meetError?: string; // Meet 생성 실패 시 에러 메시지
}

// 모든 포스트 조회
export const getAllPosts = async (token: string): Promise<Post[]> => {
  setAccessToken(token);
  const response = await axiosInstance.get('/posts');
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
export const joinBookMeeting = async (postId: string, username: string, token: string): Promise<Post> => {
  setAccessToken(token);
  const response = await axiosInstance.post(`/posts/${postId}/join`, null, {
    params: { username },
  });
  return response.data;
};

// 북미팅 참여 취소
export const leaveBookMeeting = async (postId: string, username: string, token: string): Promise<Post> => {
  setAccessToken(token);
  const response = await axiosInstance.post(`/posts/${postId}/leave`, null, {
    params: { username },
  });
  return response.data;
};
