import axiosInstance from './axiosInstance';
import {
  Suggestion,
  SuggestionComment,
  CreateSuggestionRequest,
  CreateCommentRequest
} from '../types/suggestion';

// 모든 건의사항 조회
export const getAllSuggestions = async (): Promise<Suggestion[]> => {
  const response = await axiosInstance.get('/suggestions');
  return response.data;
};

// 상태별 건의사항 조회
export const getSuggestionsByStatus = async (status: string): Promise<Suggestion[]> => {
  const response = await axiosInstance.get(`/suggestions/status/${status}`);
  return response.data;
};

// 단일 건의사항 조회
export const getSuggestionById = async (id: string): Promise<Suggestion> => {
  const response = await axiosInstance.get(`/suggestions/${id}`);
  return response.data;
};

// 건의사항 생성
export const createSuggestion = async (request: CreateSuggestionRequest): Promise<Suggestion> => {
  const response = await axiosInstance.post('/suggestions', request);
  return response.data;
};

// 추천(투표) 토글
export const toggleVote = async (suggestionId: string): Promise<Suggestion> => {
  const response = await axiosInstance.post(`/suggestions/${suggestionId}/vote`);
  return response.data;
};

// 건의사항 삭제
export const deleteSuggestion = async (suggestionId: string): Promise<void> => {
  await axiosInstance.delete(`/suggestions/${suggestionId}`);
};

// 댓글 목록 조회
export const getComments = async (suggestionId: string): Promise<SuggestionComment[]> => {
  const response = await axiosInstance.get(`/suggestions/${suggestionId}/comments`);
  return response.data;
};

// 댓글 생성
export const createComment = async (
  suggestionId: string,
  request: CreateCommentRequest
): Promise<SuggestionComment> => {
  const response = await axiosInstance.post(`/suggestions/${suggestionId}/comments`, request);
  return response.data;
};

// 댓글 삭제
export const deleteComment = async (commentId: string): Promise<void> => {
  await axiosInstance.delete(`/suggestions/comments/${commentId}`);
};
