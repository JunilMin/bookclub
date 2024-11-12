// src/api/axiosInstance.ts
import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'http://localhost:8080/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // 쿠키를 HTTP 요청과 함께 전송
});

// 응답 인터셉터에서 401 오류 처리
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        // Refresh Token으로 Access Token 재발급 요청
        await axiosInstance.post('/auth/refresh-token');
        return axiosInstance(error.config); // 원래 요청 재시도
      } catch (refreshError) {
        console.error("Failed to refresh token:", refreshError);
        window.location.href = '/login'; // 로그아웃 또는 로그인 페이지로 리디렉션
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
