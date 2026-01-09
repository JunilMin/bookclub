// src/api/user.ts
import axiosInstance, {setAccessToken} from './axiosInstance';

export interface User {
  id?: string;
  uid: string;
  email: string;
  username: string;
  password?: string;
  rating?: number;
  absent?: number;
  friends?: string[];
  posts?:[];
  late?: number;
  createdBookMeetings?: string[];      // 내가 생성한 북미팅 ID 리스트
  participatedBookMeetings?: string[]; // 참여한 북미팅 ID 리스트 (지난/현재 모두)
  isEmailVerified?: boolean; // 이메일 인증 여부
  verificationToken?: string; // 이메일 인증 토큰
  photoUrl?: string; // Google 프로필 사진 URL
}

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