// favorites.ts - Favorites API

import axiosInstance from './axiosInstance';

export interface UserFavorite {
  isbn: string;
  likedAt: string;
}

export interface AIRecommendation {
  isbn: string;
  reason: string;
  recommendedAt: string;
}

export interface Fav {
  user: UserFavorite[];
  ai: AIRecommendation[];
}

export interface ToggleFavoriteResponse {
  isFavorited: boolean;
  favorites: UserFavorite[];
}

// 현재 사용자의 모든 관심 도서 조회 (좋아요 + AI 추천)
export const getMyFav = async (): Promise<Fav> => {
  const response = await axiosInstance.get('/users/me/fav');
  return response.data;
};

// 현재 사용자의 좋아요한 책 목록 조회
export const getMyFavorites = async (): Promise<UserFavorite[]> => {
  const response = await axiosInstance.get('/users/me/favorites');
  return response.data;
};

// 현재 사용자의 AI 추천 책 목록 조회
export const getMyAIRecommendations = async (): Promise<AIRecommendation[]> => {
  const response = await axiosInstance.get('/users/me/ai-recommendations');
  return response.data;
};

// 책 좋아요 추가
export const addFavorite = async (isbn: string): Promise<UserFavorite[]> => {
  const response = await axiosInstance.post(`/users/me/favorites/${encodeURIComponent(isbn)}`);
  return response.data;
};

// 책 좋아요 제거
export const removeFavorite = async (isbn: string): Promise<UserFavorite[]> => {
  const response = await axiosInstance.delete(`/users/me/favorites/${encodeURIComponent(isbn)}`);
  return response.data;
};

// 책 좋아요 토글
export const toggleFavorite = async (isbn: string): Promise<ToggleFavoriteResponse> => {
  const response = await axiosInstance.post(`/users/me/favorites/${encodeURIComponent(isbn)}/toggle`);
  return response.data;
};

// 특정 책이 좋아요 되어있는지 확인
export const checkFavorite = async (isbn: string): Promise<boolean> => {
  const response = await axiosInstance.get(`/users/me/favorites/${encodeURIComponent(isbn)}/check`);
  return response.data.isFavorited;
};
