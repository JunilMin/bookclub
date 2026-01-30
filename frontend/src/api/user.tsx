// src/api/user.ts
import axiosInstance, {setAccessToken} from './axiosInstance';

// 북미팅 관련 타입
export interface UserPosts {
  created?: string[];      // 내가 생성한 북미팅 ID 리스트
  participated?: string[]; // 참여한 북미팅 ID 리스트 (지난/현재 모두)
}

// Endorsement 통계 타입
export interface EndorsementStats {
  count?: number;                          // 총 받은 endorsement 횟수
  points?: number;                         // 누적 점수
  categoryCounts?: {                       // 카테고리별 받은 횟수
    ENGAGEMENT?: number;
    COMMUNICATION?: number;
    RESPECT?: number;
    RULE_ADHERENCE?: number;
    PREPARATION?: number;
    REMATCH?: number;
  };
  lastEndorsedAt?: string;                 // 마지막 endorsement 받은 시간
}

// 신고 통계 타입
export interface ReportedStats {
  count?: number;
  lastReportedAt?: string;
  reasonCounts?: Record<string, number>;
}

// 프로필 스타일 타입
export interface ProfileStyles {
  discussionStyle?: string;   // 토론 스타일
  preferredTime?: string;     // 선호 시간대
  preferredSize?: string;     // 선호 인원
  useAI?: string;             // AI 사용 여부
}

// 프로필 목표 타입
export interface ProfileGoals {
  participate?: number;   // 참여 목표
  create?: number;        // 생성 목표
}

// 위치 정보 타입
export interface UserLocation {
  city?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  updatedAt?: string;
}

// 프로필 사진 타입
export interface UserPhoto {
  google?: string;  // Google 프로필 사진 URL (원본)
  custom?: string;  // 사용자 커스텀 사진 URL (Firebase Storage)
}

// 프로필 사진 표시 헬퍼 함수 (custom 우선, 없으면 google)
export const getDisplayPhotoUrl = (user: User | null): string | undefined => {
  if (!user) return undefined;
  // custom 우선 (빈 문자열 체크 포함)
  if (user.photo?.custom && user.photo.custom.trim() !== '') {
    return user.photo.custom;
  }
  // google fallback (빈 문자열 체크 포함)
  if (user.photo?.google && user.photo.google.trim() !== '') {
    return user.photo.google;
  }
  return undefined;
};

// 프로필 자기소개 타입
export interface ProfileIntroduce {
  introduction?: string;       // 소개글
  preferredGenre?: string[];   // 선호 장르
  styles?: ProfileStyles;      // 스타일 설정
  keywords?: string[];         // 관심 키워드
  goals?: ProfileGoals;        // 목표
  location?: UserLocation;     // 위치 정보
}

// 프로필 타입
export interface UserProfile {
  introduce?: ProfileIntroduce;
}

// 공개 요소 타입
export interface VisibilityElements {
  email?: boolean;
  location?: boolean;
  activeStatus?: boolean;
}

// 공개 설정 타입
export interface Visibility {
  scope?: 'public' | 'users' | 'private';
  elements?: VisibilityElements;
}

// 사용자 설정 타입
export interface UserSetting {
  visibility?: Visibility;
  loginType?: 'google' | 'email';
  deleted?: boolean;
}

export interface User {
  id?: string;
  uid: string;
  email: string;
  username: string;
  password?: string;
  rating?: number;
  absent?: number;
  friends?: string[];
  posts?: UserPosts;  // 북미팅 관련 필드 (생성/참여)
  late?: number;
  kicked?: number;  // 강퇴 당한 횟수
  isEmailVerified?: boolean; // 이메일 인증 여부
  verificationToken?: string; // 이메일 인증 토큰
  photo?: UserPhoto; // 프로필 사진 (Google + Custom)
  endorsementStats?: EndorsementStats;  // 평가 통계
  reported?: ReportedStats;  // 신고 통계
  createdAt?: string;  // 회원가입 날짜
  profile?: UserProfile;  // 프로필 설정 (관심사 탭)
  setting?: UserSetting;  // 사용자 설정
}

// 총 사용자 수 조회 (공개 API)
export const getUserCount = async (): Promise<number> => {
  try {
    const response = await axiosInstance.get('/users/count');
    return response.data;
  } catch (error) {
    console.error("Error fetching user count:", error);
    return 0;
  }
};

// 회원가입 요청
export const registerUser = async (user: User, token: string): Promise<User> => {
  try {
    setAccessToken(token);
    
    const response = await axiosInstance.post('/users/register', user);
    return response.data;
  } catch (error) {
    console.error("Error registering user:", error);
    throw new Error("회원가입에 실패했습니다.");
  }
};

// 사용자 이름으로 조회
export const getUserByUsername = async (username: string, token: string): Promise<User> => {
  try {
    setAccessToken(token);
    const response = await axiosInstance.get(`/users/username/${username}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching user by username:", error);
    throw new Error("사용자 이름으로 조회하는데 실패했습니다.");
  }
};
export const getByUID  = async (uid: string,token: string): Promise<User> => {
  try {
    setAccessToken(token);
    const response = await axiosInstance.get(`/users/uid/${uid}`);
    console.log("이 메시지가 보인다면 로그인에 성공을 했다는 것이오.");
    return response.data;
  } catch (error) {
    console.error("Error fetching user by username:", error);
    throw new Error("사용자 이름으로 조회하는데 실패했습니다.");
  }
}

// 사용자 정보 조회
export const getUserById = async (id: string, token:string): Promise<User> => {
  try {
    setAccessToken(token);
    const response = await axiosInstance.get(`/users/${id}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    throw new Error("사용자 정보를 조회하는데 실패했습니다.");
  }
};

// 사용자 정보 업데이트
export const updateUser = async (id: string, updatedUser: User, token:string): Promise<User> => {
  try {
    setAccessToken(token);
    const response = await axiosInstance.put(`/users/${id}`, updatedUser);
    return response.data;
  } catch (error) {
    console.error("Error updating user:", error);
    throw new Error("사용자 정보를 업데이트하는데 실패했습니다.");
  }
};

// 사용자 삭제
export const deleteUser = async (id: string, token:string): Promise<void> => {
  try {
    setAccessToken(token);
    await axiosInstance.delete(`/users/${id}`);
  } catch (error) {
    console.error("Error deleting user:", error);
    throw new Error("사용자를 삭제하는데 실패했습니다.");
  }
};

// 친구 추가
export const addFriend = async (userId: string, friendId: string, token:string): Promise<User> => {
  try {
    setAccessToken(token);
    const response = await axiosInstance.post(`/users/${userId}/add-friend/${friendId}`);
    return response.data;
  } catch (error) {
    console.error("Error adding friend:", error);
    throw new Error("친구를 추가하는데 실패했습니다.");
  }
};

// username 중복 체크
export const checkUsernameAvailable = async (username: string): Promise<boolean> => {
  try {
    const response = await axiosInstance.get(`/users/check-username/${username}`);
    return response.data; // true: 사용 가능, false: 이미 사용 중
  } catch (error) {
    console.error("Error checking username:", error);
    throw new Error("닉네임 중복 확인에 실패했습니다.");
  }
};

// username 유효성 검사 (중복 체크 + 비속어 체크)
export interface UsernameValidationResult {
  valid: boolean;
  reason: 'ok' | 'duplicate' | 'profanity' | 'error';
  message: string;
  score?: number; // 비속어 점수 (profanity인 경우)
}

export const validateUsernameAPI = async (username: string): Promise<UsernameValidationResult> => {
  try {
    const response = await axiosInstance.get(`/users/validate-username/${username}`);
    return response.data;
  } catch (error) {
    console.error("Error validating username:", error);
    return {
      valid: false,
      reason: 'error',
      message: '닉네임 검증에 실패했습니다.'
    };
  }
};

// export const resendVerificationEmail = async (email: string): Promise<string> => {
//   try {
//     console.log(email);
//     const response = await axiosInstance.post(`/users/resend-verification/${email}`);
//     return response.data;
//   } catch (error) {
//     console.error("Error resending verification email:", error);
//     throw new Error("이메일 재전송에 실패했습니다."); // Custom error message
//   }
// };

// export const verificationStatus = async (email: string): Promise<boolean> => { 
//   try {
//     const response = await axiosInstance.get(`/users/verify-email-check/${email}`);
//     return response.data; // response.data should be a boolean
//   } catch (error) {
//     console.error("Error checking verification status:", error);
//     throw new Error("인증 상태 확인에 실패했습니다."); // Custom error message
//   }
// };

// export const getVerificationToken = async (email: string): Promise<string> => {
//   try {
//     const response = await axiosInstance.get(`/users/verification-token/${email}`);
//     return response.data;
//   } catch (error) {
//     console.error("Error getting verification token:", error);
//     throw new Error("인증 토큰을 가져오는데 실패했습니다."); // Custom error message
//   }
// }

// ========== Reputation API Types & Functions ==========

// 참여 통계
export interface ParticipationStats {
  createdAndAttended: number;  // 생성&참여 (created posts where CONFIRMED)
  participated: number;        // 참여 (participated posts where CONFIRMED)
  absent: number;              // 불참 (no record OR status != CONFIRMED)
  late: number;                // 지각 (attendanceType == LATE)
  kicked: number;              // 강퇴 당한 횟수
  totalMeetings: number;       // 총 미팅 수 (created + participated)
  attendanceRate: number;      // 출석률 (%) = (confirmed / total) * 100
  onTimeRate: number;          // 정시 출석률 (%) = (EARLY + ON_TIME) / confirmed * 100
  // Profile card 통계
  totalConfirmed: number;      // 총 참석 (createdAndAttended + participated)
  onTimeCount: number;         // 정시+빠른 입장 횟수 (EARLY + ON_TIME)
  currentStreak: number;       // 현재 연속 참여 기록
  feedbackGivenCount: number;  // 피드백(endorsement) 준 횟수
  feedbackPossibleCount: number; // 피드백 줄 수 있었던 총 인원
  feedbackReceivedCount: number; // 피드백(endorsement) 받은 횟수
}

// Endorsement 통계 DTO
export interface EndorsementStatsDto {
  count: number;
  points: number;
  categoryCounts: Record<string, number>;
  categoryScores: Record<string, number>;
  averageScore: number;
}

// 배지 정보
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  gradientColors: string;
  earnedAt?: string;
  progress?: number;
  goal?: number;
}

export interface BadgeInfo {
  earnedCount: number;
  totalCount: number;
  earnedBadges: Badge[];
  lockedBadges: Badge[];
}

// 활동 항목
export interface ActivityItem {
  type: string;
  title: string;
  description: string;
  icon: string;
  gradientColors: string;
  timestamp: string;
  rating?: number;
  participantCount?: number;
  postId?: string;
}

// 월별 출석 기록
export interface MonthlyAttendance {
  month: string;
  monthLabel: string;
  attended: number;
  late: number;
  absent: number;
  total: number;
}

// 사용자 평판 응답 전체
export interface UserReputationResponse {
  userId: string;
  username: string;
  email: string;
  photoUrl?: string;
  joinedAt?: string;
  participationStats: ParticipationStats;
  endorsementStats: EndorsementStatsDto;
  badgeInfo: BadgeInfo;
  recentActivities: ActivityItem[];
  monthlyAttendance: MonthlyAttendance[];
}

// 사용자 평판 데이터 조회 (내 정보)
export const getMyReputation = async (token: string, locale: string = 'ko'): Promise<UserReputationResponse> => {
  try {
    setAccessToken(token);
    const response = await axiosInstance.get(`/users/me/reputation?locale=${locale}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching reputation:", error);
    throw new Error("평판 데이터를 조회하는데 실패했습니다.");
  }
};

// 특정 사용자 평판 데이터 조회
export const getUserReputation = async (userId: string, token: string, locale: string = 'ko'): Promise<UserReputationResponse> => {
  try {
    setAccessToken(token);
    const response = await axiosInstance.get(`/users/${userId}/reputation?locale=${locale}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching user reputation:", error);
    throw new Error("사용자 평판 데이터를 조회하는데 실패했습니다.");
  }
};

// ========== Profile Optimization API Types & Functions ==========

// 미팅 요약 (최소 필드)
export interface MeetingSummary {
  id: string;
  due: string;
  capacity: number;
  memberCount: number;
  level: string;
  ended: boolean;
  bookData: {
    title: string;
    coverSmall?: string;
  };
}

// 내 미팅 목록 응답
export interface MyMeetingsResponse {
  created: MeetingSummary[];
  participated: MeetingSummary[];
}

// 프로필 요약 응답
export interface ProfileSummaryResponse {
  user: {
    id: string;
    username: string;
    photoUrl?: string;
    email: string;
    createdAt?: string;
    endorsementPoints: number;
  };
  stats: {
    createdCount: number;
    participatedCount: number;
    topRatingScore: number;
    topRatingCategory: string;
  };
  badges: {
    earnedCount: number;
    totalCount: number;
    recentBadges: {
      id: string;
      name: string;
      icon: string;
      gradientColors: string;
      earnedAt?: string;
    }[];
  };
  activities: {
    type: string;
    title: string;
    description: string;
    icon: string;
    gradientColors: string;
    timestamp?: string;
    postId?: string;
  }[];
}

// 내 미팅 목록 조회 (경량화 - Profile 페이지용)
export const getMyMeetings = async (token: string): Promise<MyMeetingsResponse> => {
  try {
    setAccessToken(token);
    const response = await axiosInstance.get('/users/me/meetings');
    return response.data;
  } catch (error) {
    console.error("Error fetching my meetings:", error);
    throw new Error("미팅 목록을 조회하는데 실패했습니다.");
  }
};

// 프로필 요약 데이터 조회 (경량화 - Profile 페이지 상단용)
export const getMyProfileSummary = async (token: string, locale: string = 'ko'): Promise<ProfileSummaryResponse> => {
  try {
    setAccessToken(token);
    const response = await axiosInstance.get(`/users/me/profile-summary?locale=${locale}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching profile summary:", error);
    throw new Error("프로필 요약을 조회하는데 실패했습니다.");
  }
};

// ========== Reputation Optimization API Types & Functions ==========

// 평판 요약 응답 (초기 렌더링용)
export interface ReputationSummaryResponse {
  user: {
    id: string;
    username: string;
    photoUrl?: string;
    joinedAt?: string;
  };
  stats: {
    attendanceRate: number;
    onTimeRate: number;
    currentStreak: number;
    totalConfirmed: number;
    feedbackGivenCount: number;
    feedbackPossibleCount: number;
  };
  endorsement: {
    points: number;
    averageScore: number;
    topCategory?: string;
    topCategoryScore?: number;
  };
  badgeSummary: {
    earnedCount: number;
    totalCount: number;
    latestBadges: {
      id: string;
      name: string;
      description: string;
      icon: string;
      gradientColors: string;
      earnedAt?: string;
    }[];
  };
  recentActivities: {
    type: string;
    title: string;
    description: string;
    icon: string;
    gradientColors: string;
    timestamp?: string;
    participantCount?: number;
    postId?: string;
  }[];
}

// 평판 상세 응답 (탭 진입 시)
export interface ReputationDetailsResponse {
  monthlyAttendance: MonthlyAttendance[];
  badgeInfo: BadgeInfo;
  recentActivities: ActivityItem[];
}

// 평판 요약 데이터 조회 (경량화 - Reputation 페이지 초기 렌더링용)
export const getMyReputationSummary = async (token: string, locale: string = 'ko'): Promise<ReputationSummaryResponse> => {
  try {
    setAccessToken(token);
    const response = await axiosInstance.get(`/users/me/reputation/summary?locale=${locale}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching reputation summary:", error);
    throw new Error("평판 요약을 조회하는데 실패했습니다.");
  }
};

// 평판 상세 데이터 조회 (탭 진입 시)
export const getMyReputationDetails = async (
  token: string,
  locale: string = 'ko',
  params?: { activitiesLimit?: number; months?: number }
): Promise<ReputationDetailsResponse> => {
  try {
    setAccessToken(token);
    const queryParams = new URLSearchParams();
    queryParams.append('locale', locale);
    if (params?.activitiesLimit) {
      queryParams.append('activitiesLimit', params.activitiesLimit.toString());
    }
    if (params?.months) {
      queryParams.append('months', params.months.toString());
    }
    const response = await axiosInstance.get(`/users/me/reputation/details?${queryParams.toString()}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching reputation details:", error);
    throw new Error("평판 상세를 조회하는데 실패했습니다.");
  }
};