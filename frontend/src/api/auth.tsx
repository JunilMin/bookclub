import axiosInstance from './axiosInstance';
import axios from 'axios';

interface AuthRequest {
  username: string;
  password: string;
}

interface AuthResponse {
  token: string;
  username: string;
}

// 토큰을 서버에 전송하여 httpOnly 쿠키에 저장
// googleAccessToken이 있으면 함께 저장
export const setTokenCookie = async (token: string, googleAccessToken?: string): Promise<void> => {
  try {
    await axiosInstance.post('/auth/set-token', { token, googleAccessToken });
  } catch (error) {
    console.error('토큰 쿠키 설정 실패:', error);
    throw error;
  }
};

// 토큰 갱신 시 쿠키 업데이트
// googleAccessToken이 있으면 함께 갱신
export const refreshTokenCookie = async (token: string, googleAccessToken?: string): Promise<void> => {
  try {
    await axiosInstance.post('/auth/refresh-token', { token, googleAccessToken });
  } catch (error) {
    console.error('토큰 쿠키 갱신 실패:', error);
    throw error;
  }
};
//token을 여기서 파라미터로 받아서 사용해야함. axiosInstance에 토큰을 넣어서 사용해야함.
export const refreshToken = async (): Promise<AuthResponse | null> => {
  try {
    const response = await axios.post(
      "http://localhost:8080/api/auth/refresh-token",
      {},
      { withCredentials: true } // 쿠키를 포함하여 요청
    );

    if (response.status === 200) {
      return response.data;
    } else {
      console.error("Failed to refresh token:", response.statusText);
      return null;
    }
  } catch (error) {
    console.error("Error during refresh token request:", error);
    return null;
  }
};
// 로그인 요청
export const login = async (authRequest: AuthRequest): Promise<AuthResponse> => {
  const response = await axiosInstance.post('/auth/login', authRequest);
  return response.data;
};

// Google 로그인 요청
// export const googleLogin = async (userInfo: { email: string; name: string }) => {
//   const response = await axiosInstance.post('/auth/google-login', userInfo);
//   return response.data;
// };

// 로그아웃 - 서버의 쿠키 삭제
export const logoutServer = async () => {
  try {
    await axiosInstance.post('/auth/logout'); // 서버에서 쿠키 삭제
  } catch (error) {
    console.error("로그아웃 요청 실패:", error);
  }
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
// export const verifyEmail = async (token: string, email: string): Promise<string> => {
//   try {
//     const response = await axiosInstance.get('/auth/verify-email', { params: { token, email } });
//     return response.data; // "이메일 인증이 완료되었습니다." if successful
//   } catch (error) {
//     if (axios.isAxiosError(error)) {
//       // Axios-specific error with a response
//       if (error.response && error.response.data) {
//         return error.response.data as string; // "유효하지 않은 토큰입니다." if token is invalid
//       }
//       return "서버 응답이 없습니다. 다시 시도해 주세요.";
//     }
//     return "예기치 않은 오류가 발생했습니다.";
//   }
// };