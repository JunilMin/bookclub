import axiosInstance from "./axiosInstance";

/**
 * ISBN 검색 API
 * @param query 검색할 ISBN 또는 키워드
 * @returns 검색 결과 (책 리스트)
 */
export const searchISBN = async (query: string) => {
  try {
    const response = await axiosInstance.get("/ISBN/search", {
      params: { query },
    });
    return response; // 결과를 반환
  } catch (error: any) {
    console.error("ISBN 검색 중 오류 발생:", error.response || error.message);
    throw error;
  }
};