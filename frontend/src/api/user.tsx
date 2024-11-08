// src/api/user.ts
import axiosInstance from './axiosInstance.tsx';

interface User {
  id?: string;
  email: string;
  username: string;
  password: string;
  rating?: number;
  absent?: number;
  friends?: string[];
  late?: number;
  isEmailVerified?: boolean; // 이메일 인증 여부
  verificationToken?: string; // 이메일 인증 토큰
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

export const resendVerificationEmail = async (email: string): Promise<string> => {
  const response = await axiosInstance.post('/users/resend-verification', null, {
    params: { email },
  });
  return response.data;
};

export const verificationStatus = async (email: string): Promise<boolean> => { 
  const response = await axiosInstance.get('/users/verify-email-check', {
    params: { email },
  });
  return response.data; // response.data should be a boolean
};