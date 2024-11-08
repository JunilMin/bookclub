// posts.ts
import axiosInstance from './axiosInstance';

export interface ObjectId {
  timestamp: number;
  date: string;
}

export interface Post {
  _id: ObjectId; // 서버에서 자동 생성되는 ID
  creater: ObjectId | string; // 생성시 string, 가져올 때 ObjectId 형태
  date: string; // ISO 형식의 날짜 문자열
  due: string; // ISO 형식의 날짜 문자열
  capacity: number;
  member: ObjectId[]; // 멤버 리스트 (ObjectId 형태)
  level: 'low' | 'moderate' | 'high';
  book: string;
}

// 모든 포스트 조회
export const getAllPosts = async (): Promise<Post[]> => {
  const response = await axiosInstance.get('/posts');
  return response.data;
};

// 특정 포스트 조회
export const getPostById = async (id: string): Promise<Post> => {
  const response = await axiosInstance.get(`/posts/${id}`);
  return response.data;
};

// 새로운 포스트 생성
export const createPost = async (post: Partial<Post>): Promise<Post> => {
  const response = await axiosInstance.post('/posts', post);
  return response.data;
};

// 포스트 수정
export const updatePost = async (id: string, post: Post): Promise<Post> => {
  const response = await axiosInstance.put(`/posts/${id}`, post);
  return response.data;
};

// 포스트 삭제
export const deletePost = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/posts/${id}`);
};
