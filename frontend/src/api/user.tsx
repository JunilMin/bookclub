// src/api/user.ts
import axiosInstance from './axiosInstance.tsx';

interface User {
  id?: string;
  username: string;
  password: string;
  rating?: number;
  absent?: number;
  friends?: string[];
  late?: number;
}

// 회원가입 요청
export const registerUser = async (user: User): Promise<User> => {
  const response = await axiosInstance.post('/users/register', user);
  return response.data;
};

// 사용자 정보 조회
export const getUserById = async (id: string): Promise<User> => {
  const response = await axiosInstance.get(`/users/${id}`);
  return response.data;
};
