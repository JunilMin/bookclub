// src/api/axiosInstance.ts
import axios from 'axios';
import { isTokenExpiringSoon } from '../utils/tokenUtils';

const axiosInstance = axios.create({
  baseURL: 'http://localhost:8080/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 시 Authorization 헤더에 JWT Access Token 추가
axiosInstance.interceptors.request.use(
  async (config) => {
    let token = localStorage.getItem('token'); // 로컬 스토리지에 저장된 Access Token 가져오기

    // 토큰 만료가 임박했는지 확인
    if (token && isTokenExpiringSoon(token)) {
      try {
        const response = await axios.post('http://localhost:8080/api/auth/refresh-token', {}, { withCredentials: true });
        token = response.data.token;
        localStorage.setItem('token', JSON.stringify(token));
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } catch (error) {
        console.error("Failed to refresh token:", error);
        localStorage.removeItem('token');
        window.location.href = '/login'; // 로그인 페이지로 리디렉션
        return Promise.reject(error);
      }
    }

    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default axiosInstance;
