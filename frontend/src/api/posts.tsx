// posts.ts
import axiosInstance, {setAccessToken} from './axiosInstance';

export interface ObjectId {
  timestamp: number;
  date: string;
}

export interface Post {
  id: string; // 서버에서 자동 생성되는 ID
  creater: string; // 생성시 string, 가져올 때 ObjectId 형태
  date: string; // ISO 형식의 날짜 문자열
  due: string; // ISO 형식의 날짜 문자열
  capacity: number;
  member: ObjectId[]; // 멤버 리스트 (ObjectId 형태)
  level: 'low' | 'moderate' | 'high';
  book: string;
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

// 새로운 포스트 생성
export const createPost = async (post: Partial<Post>, accessToken: string): Promise<Post> => {
  setAccessToken(accessToken);
  const response = await axiosInstance.post('/posts', post, {
    params: { accessToken }, // Query parameter로 accessToken 전달
  });
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
