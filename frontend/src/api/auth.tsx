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

// export const verifyEmail = async (token: string, email: string): Promise<string> => {
//   try {
//     const response = await axiosInstance.get('/verify-email', { params: { token, email } });
//     return response.data; // "이메일 인증이 완료되었습니다." if successful
//   } catch (error) {
//     if (axios.isAxiosError(error)) {
//       // Axios-specific error with a response
//       if (error.response) {
//         return error.response.data as string; // "유효하지 않은 토큰입니다." if token is invalid
//       }
//     }
//     throw new Error("An error occurred while verifying the email.");
//   }
// };
export const verifyEmail = async (token: string, email: string): Promise<string> => {
  try {
    const response = await axiosInstance.get('/auth/verify-email', { params: { token, email } });
    return response.data; // "이메일 인증이 완료되었습니다." if successful
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // Axios-specific error with a response
      if (error.response && error.response.data) {
        return error.response.data as string; // "유효하지 않은 토큰입니다." if token is invalid
      }
      return "서버 응답이 없습니다. 다시 시도해 주세요.";
    }
    return "예기치 않은 오류가 발생했습니다.";
  }
};