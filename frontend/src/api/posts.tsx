// src/api/posts.ts
import axiosInstance from './axiosInstance';

export interface Post {
    id: string; // 수정: `string | undefined`에서 `string`으로 변경
    creater: string;
    date: Date;
    due: Date;
    capacity: number;
    member: string[];
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
export const createPost = async (post: Post): Promise<Post> => {
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
