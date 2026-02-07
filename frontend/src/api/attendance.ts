// frontend/src/api/attendance.ts
import axiosInstance, { setAccessToken } from './axiosInstance';

// ============== 타입 정의 ==============

export type AttendanceType = 'EARLY' | 'ON_TIME' | 'LATE';
export type AttendanceStatus = 'PENDING' | 'CONFIRMED';

export interface PresenceSession {
  joinAt: string;
  leaveAt: string;
  durationSec: number;
}

export interface TimeInfo {
  startAt: string | null;        // 미팅 시작 시각 (post.due)
  firstJoinAt: string | null;    // 최초 입장 시각
  lastSeenAt: string | null;     // 마지막 활동 시각
  totalPresenceSec: number;      // 누적 접속 시간 (초)
  currentSessionStart: string | null;  // 현재 접속 세션 시작
  presenceSessions: PresenceSession[];
}

export interface ActivityInfo {
  speechSec: number;             // 누적 발언 시간 (초)
  noteCharCount: number;         // 노트 글자수 (누적 기준)
  noteCharCountCurrent: number;  // 현재 노트 글자수
  handRaisedAt: string | null;   // 손들기 시각
  handRaiseCount: number;        // 손들기 횟수
  speakCount: number;            // 발언 횟수
  currentSpeakStart: string | null;
}

export interface Milestones {
  joined: boolean;
  spoke: boolean;
  noted: boolean;
  handRaised: boolean;
  joinedAt: string | null;
  spokeAt: string | null;
  notedAt: string | null;
  handRaisedAt: string | null;
}

export interface AttendanceRecord {
  id: string;
  postId: string;
  sessionId: string;
  userId: string;
  username: string;
  photoUrl: string | null;
  time: TimeInfo;
  activities: ActivityInfo;
  attendanceType: AttendanceType;
  status: AttendanceStatus;
  milestones: Milestones;
  createdAt: string;
  updatedAt: string;
}

// ============== 유틸리티 함수 ==============

/**
 * 출석 확정 기준 계산 (손들기 여부에 따라 조정)
 */
export function getConfirmationCriteria(hasRaisedHand: boolean): {
  requiredSpeechSec: number;
  requiredNoteChars: number;
} {
  // 손들기 시 20% 완화
  return {
    requiredSpeechSec: hasRaisedHand ? 96 : 120,   // 2분 or 1분36초
    requiredNoteChars: hasRaisedHand ? 20 : 25,
  };
}

/**
 * 출석 확정 진행률 계산 (0.0 ~ 1.0)
 */
export function calculateConfirmationProgress(record: AttendanceRecord): number {
  const hasRaisedHand = record.milestones?.handRaised ?? false;
  const { requiredSpeechSec, requiredNoteChars } = getConfirmationCriteria(hasRaisedHand);

  const speechProgress = Math.min(1.0, record.activities.speechSec / requiredSpeechSec);
  const noteProgress = Math.min(1.0, record.activities.noteCharCount / requiredNoteChars);

  // 둘 중 높은 진행률 반환
  return Math.max(speechProgress, noteProgress);
}

/**
 * 확정까지 남은 발언 시간 (초)
 */
export function getRemainingSpechSec(record: AttendanceRecord): number {
  const hasRaisedHand = record.milestones?.handRaised ?? false;
  const required = hasRaisedHand ? 96 : 120;
  return Math.max(0, required - record.activities.speechSec);
}

/**
 * 확정까지 남은 노트 글자수
 */
export function getRemainingNoteChars(record: AttendanceRecord): number {
  const hasRaisedHand = record.milestones?.handRaised ?? false;
  const required = hasRaisedHand ? 20 : 25;
  return Math.max(0, required - record.activities.noteCharCount);
}

/**
 * 출석 유형 라벨 반환
 */
export function getAttendanceTypeLabel(type: AttendanceType, language: string = 'ko'): string {
  const labels: Record<AttendanceType, { ko: string; en: string }> = {
    EARLY: { ko: '일찍 입장', en: 'Early' },
    ON_TIME: { ko: '정시 입장', en: 'On Time' },
    LATE: { ko: '늦은 입장', en: 'Late' },
  };
  return labels[type]?.[language === 'ko' ? 'ko' : 'en'] ?? type;
}

/**
 * 출석 상태 라벨 반환
 */
export function getAttendanceStatusLabel(status: AttendanceStatus, language: string = 'ko'): string {
  const labels: Record<AttendanceStatus, { ko: string; en: string }> = {
    PENDING: { ko: '확인 중', en: 'In Progress' },
    CONFIRMED: { ko: '출석 확정', en: 'Confirmed' },
  };
  return labels[status]?.[language === 'ko' ? 'ko' : 'en'] ?? status;
}

// ============== API 함수 ==============

/**
 * 세션의 모든 출석 기록 조회
 * GET /api/sessions/{sessionId}/attendance
 */
export const getSessionAttendance = async (
  sessionId: string,
  token: string
): Promise<AttendanceRecord[]> => {
  setAccessToken(token);
  const response = await axiosInstance.get(`/sessions/${sessionId}/attendance`);
  return response.data;
};

/**
 * 현재 사용자의 세션 출석 기록 조회
 * GET /api/sessions/{sessionId}/attendance/me
 */
export const getMyAttendance = async (
  sessionId: string,
  token: string
): Promise<AttendanceRecord> => {
  setAccessToken(token);
  const response = await axiosInstance.get(`/sessions/${sessionId}/attendance/me`);
  return response.data;
};

/**
 * 사용자의 출석 히스토리 조회
 * GET /api/sessions/attendance/history
 */
export const getAttendanceHistory = async (token: string): Promise<AttendanceRecord[]> => {
  setAccessToken(token);
  const response = await axiosInstance.get('/sessions/attendance/history');
  return response.data;
};

/**
 * 사용자의 확정된 출석만 조회
 * GET /api/sessions/attendance/confirmed
 */
export const getConfirmedAttendance = async (token: string): Promise<AttendanceRecord[]> => {
  setAccessToken(token);
  const response = await axiosInstance.get('/sessions/attendance/confirmed');
  return response.data;
};

/**
 * 노트 업데이트 시 출석 기록 갱신
 * POST /api/sessions/{sessionId}/attendance/note-update
 */
export const updateNoteAttendance = async (
  sessionId: string,
  charCount: number,
  token: string
): Promise<AttendanceRecord> => {
  setAccessToken(token);
  const response = await axiosInstance.post(`/sessions/${sessionId}/attendance/note-update`, {
    charCount,
  });
  return response.data;
};
