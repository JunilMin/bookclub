// src/api/auth.ts
import axiosInstance from './axiosInstance';

interface AuthRequest {
  username: string;
  password: string;
}

interface AuthResponse {
  token: string;
}

// 로그인 요청
export const login = async (authRequest: AuthRequest): Promise<AuthResponse> => {
  const response = await axiosInstance.post('/auth/login', authRequest);
  const { token } = response.data;
  if (token) {
    localStorage.setItem('token', token); // JWT 토큰 저장
  }
  return response.data;
};

// Google 로그인 요청
export const googleLogin = async () => {
    window.location.href = 'http://localhost:8080/oauth2/authorization/google';
  };
  
// 로그아웃
export const logout = () => {
    localStorage.removeItem('token'); // 토큰 삭제
};
