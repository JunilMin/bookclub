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
  photoUrl?: string; // Google 프로필 사진 URL
  endorsementStats?: EndorsementStats;  // 평가 통계
  reported?: ReportedStats;  // 신고 통계
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
  totalParticipated: number;
  attended: number;
  absent: number;
  late: number;
  kicked: number;
  created: number;
  attendanceRate: number;
  onTimeRate: number;
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