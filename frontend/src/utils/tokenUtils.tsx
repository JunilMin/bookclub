// src/utils/tokenUtils.ts
import { jwtDecode } from 'jwt-decode';

interface JwtPayload {
  exp: number;
}

export const isTokenExpiringSoon = (token: string, bufferTimeInSeconds = 300): boolean => {
  try {
    const { exp } = jwtDecode<JwtPayload>(token);
    const currentTime = Math.floor(Date.now() / 1000); // 현재 시간 (초 단위)
    return exp - currentTime < bufferTimeInSeconds;
  } catch (error) {
    console.error("Failed to decode token:", error);
    return true; // 디코딩 실패 시 true를 반환하여 토큰 갱신을 유도
  }
};
