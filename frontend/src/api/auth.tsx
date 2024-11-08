import axiosInstance from './axiosInstance';
import axios from 'axios';

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
export const googleLogin = async (userInfo: { email: string; name: string }) => {
  const response = await axiosInstance.post('/auth/google-login', userInfo);
  const { token } = response.data;
  if (token) {
    localStorage.setItem('token', token);
  }
  return response.data;
};

// 로그아웃
export const logout = () => {
  localStorage.removeItem('token'); // 토큰 삭제
};

export const verifyEmail = async (token: string): Promise<string> => {
  try {
    const response = await axiosInstance.get('/verify-email', { params: { token } });
    return response.data; // "이메일 인증이 완료되었습니다." if successful
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // Axios-specific error with a response
      if (error.response) {
        return error.response.data as string; // "유효하지 않은 토큰입니다." if token is invalid
      }
    }
    throw new Error("An error occurred while verifying the email.");
  }
};

// 이메일 전송 요청
export const sendVerificationEmail = async (email: string) => {
  try {
    const response = await axiosInstance.post('/auth/send-verification-email', {
      to: email,
    });
    return response.data; // "Verification email sent successfully." if successful
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return error.response.data as string; // Detailed error from the backend if email sending fails
    }
    throw new Error("An error occurred while sending the verification email.");
  }
};