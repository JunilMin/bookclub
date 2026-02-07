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

// Enhanced AI Recommendation types
export interface EnhancedAIRecommendation {
  isbn: string;
  title: string;
  author: string;
  coverUrl: string;
  genre: string;
  reason: string;
  score: number;
  recommendedAt: string;
}

export interface GenerationInfo {
  seedCount: number;
  candidatesSearched: number;
  candidatesFiltered: number;
  selectionMethod: string;
}

export interface AIRecommendationResponse {
  status: string;
  generatedAt: string;
  expiresAt: string;
  totalCount: number;
  recommendations: EnhancedAIRecommendation[];
  generationInfo?: GenerationInfo;
}

export interface RegenerateResponse {
  success: boolean;
  message?: string;
  data?: AIRecommendationResponse;
  error?: string;
}

export interface FeedbackResponse {
  success: boolean;
  feedbackType: string;
  recordedAt: string;
}

export interface ClickResponse {
  success: boolean;
  actionType: string;
  recordedAt: string;
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

// ===== Enhanced AI Recommendations API =====

// AI 추천 재생성
export const regenerateAIRecommendations = async (lang: string = 'ko'): Promise<RegenerateResponse> => {
  const response = await axiosInstance.post(`/users/me/ai-recommendations/regenerate?lang=${lang}`);
  return response.data;
};

// AI 추천 상세 조회 (Enhanced)
export const getEnhancedAIRecommendations = async (lang: string = 'ko'): Promise<AIRecommendationResponse> => {
  const response = await axiosInstance.get(`/users/me/ai-recommendations/enhanced?lang=${lang}`);
  return response.data;
};

// AI 추천 피드백 기록 (like/dislike/dismiss)
export const recordRecommendationFeedback = async (
  isbn: string,
  feedbackType: 'like' | 'dislike' | 'dismiss',
  reason?: string
): Promise<FeedbackResponse> => {
  const response = await axiosInstance.post(
    `/users/me/ai-recommendations/${encodeURIComponent(isbn)}/feedback`,
    { feedbackType, reason }
  );
  return response.data;
};

// AI 추천 클릭 이벤트 기록 (view/create_room/bookmark/share)
export const recordRecommendationClick = async (
  isbn: string,
  actionType: 'view' | 'create_room' | 'bookmark' | 'share'
): Promise<ClickResponse> => {
  const response = await axiosInstance.post(
    `/users/me/ai-recommendations/${encodeURIComponent(isbn)}/click`,
    { actionType }
  );
  return response.data;
};
