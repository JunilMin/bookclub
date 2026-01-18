// src/api/reports.tsx
import axiosInstance, { setAccessToken } from './axiosInstance';

// 신고 사유 Enum
export enum ReportReason {
  ABUSE = 'ABUSE',           // 욕설/괴롭힘
  HATE = 'HATE',             // 혐오/차별 발언
  SEXUAL = 'SEXUAL',         // 성희롱/불쾌한 발언
  SPAM_ADS = 'SPAM_ADS',     // 진행 방해/트롤링/스팸/광고
  PRIVACY_SAFETY = 'PRIVACY_SAFETY',  // 개인정보 노출/안전 이슈
  INACTIVE = 'INACTIVE'      // 장기간 비활동
}

// 신고 사유 라벨 (다국어 지원용)
export const ReportReasonLabels: Record<ReportReason, { ko: string; en: string }> = {
  [ReportReason.ABUSE]: { ko: '욕설/괴롭힘', en: 'Abuse/Harassment' },
  [ReportReason.HATE]: { ko: '혐오/차별 발언', en: 'Hate Speech/Discrimination' },
  [ReportReason.SEXUAL]: { ko: '성희롱/불쾌한 발언', en: 'Sexual Harassment' },
  [ReportReason.SPAM_ADS]: { ko: '진행 방해/트롤링/스팸/광고', en: 'Disruption/Trolling/Spam/Ads' },
  [ReportReason.PRIVACY_SAFETY]: { ko: '개인정보 노출/안전 이슈', en: 'Privacy/Safety Issues' },
  [ReportReason.INACTIVE]: { ko: '장기간 비활동', en: 'Long-term Inactivity' },
};

// 증거 파일 인터페이스
export interface EvidenceFile {
  url: string;
  name: string;
  contentType: string;
  size: number;
}

// 신고 생성 요청 인터페이스
export interface CreateReportRequest {
  sessionId: string;
  postId?: string;
  reportedUserId: string;
  reasons: ReportReason[];
  evidenceFiles?: EvidenceFile[];
}

// 신고 생성 응답 인터페이스
export interface CreateReportResponse {
  reportId: string;
  status: string;
  createdAt: string;
}

// API 에러 응답 인터페이스
export interface ReportApiError {
  code: string;
  message: string;
}

/**
 * 신고 생성
 */
export const createReport = async (
  request: CreateReportRequest,
  token: string
): Promise<CreateReportResponse> => {
  setAccessToken(token);
  const response = await axiosInstance.post('/reports', request);
  return response.data;
};

/**
 * 중복 신고 여부 확인
 */
export const checkReportExists = async (
  sessionId: string,
  reportedUserId: string,
  token: string
): Promise<boolean> => {
  setAccessToken(token);
  const response = await axiosInstance.get('/reports/exists', {
    params: { sessionId, reportedUserId },
  });
  return response.data.exists;
};

/**
 * 특정 세션에서 현재 사용자가 이미 신고한 사용자 ID 목록 조회
 */
export const getReportedUserIds = async (
  sessionId: string,
  token: string
): Promise<string[]> => {
  setAccessToken(token);
  const response = await axiosInstance.get('/reports/reported-users', {
    params: { sessionId },
  });
  return response.data.reportedUserIds;
};
