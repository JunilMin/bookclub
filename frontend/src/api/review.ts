import axiosInstance, { setAccessToken } from './axiosInstance';

export interface ReviewSubmitData {
  rating: number;
  goodPoints: string;
  badPoints: string;
  consentToExpose: boolean;
}

/**
 * 평균 평점 조회 (공개 API)
 * GET /api/reviews/average-rating
 */
export const getAverageRating = async (): Promise<number> => {
  try {
    const response = await axiosInstance.get('/reviews/average-rating');
    return response.data.averageRating ?? 0;
  } catch {
    return 0;
  }
};

/**
 * 리뷰 모달 표시 여부 확인
 * GET /api/reviews/check
 */
export const checkReviewNeeded = async (token: string): Promise<{ shouldShow: boolean }> => {
  setAccessToken(token);
  const response = await axiosInstance.get('/reviews/check');
  return response.data;
};

/**
 * 리뷰 제출
 * POST /api/reviews
 */
export const submitReview = async (data: ReviewSubmitData, token: string): Promise<void> => {
  setAccessToken(token);
  await axiosInstance.post('/reviews', data);
};

/**
 * 리뷰 건너뛰기
 * POST /api/reviews/skip
 */
export const skipReview = async (token: string): Promise<void> => {
  setAccessToken(token);
  await axiosInstance.post('/reviews/skip');
};
