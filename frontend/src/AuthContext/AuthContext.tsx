import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import {
  onAuthStateChanged,
  getAuth,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  unlink,
  EmailAuthProvider,
  linkWithCredential,
} from "firebase/auth";
import { initializeApp } from "firebase/app";
import { registerUser, User, getByUID } from "../api/user";
import { setTokenCookie, refreshTokenCookie, logoutServer } from "../api/auth";

// 상수 정의
const TOKEN_REFRESH_INTERVAL = 50 * 60 * 1000; // 50분마다 토큰 갱신 (Firebase 토큰은 1시간 만료)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30분 비활동 시 자동 로그아웃
const INACTIVITY_WARNING_TIME = 5 * 60 * 1000; // 로그아웃 5분 전 경고

// localStorage 키 (username만 저장, 민감 정보는 httpOnly 쿠키에 저장)
const STORAGE_KEY_USERNAME = 'bookclub_username';

// localStorage 헬퍼 함수
const saveToStorage = (user: User) => {
  try {
    localStorage.setItem(STORAGE_KEY_USERNAME, user.username);
  } catch (error) {
    console.error('localStorage 저장 실패:', error);
  }
};

const loadFromStorage = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY_USERNAME);
  } catch (error) {
    console.error('localStorage 로드 실패:', error);
    return null;
  }
};

const clearStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY_USERNAME);
  } catch (error) {
    console.error('localStorage 삭제 실패:', error);
  }
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Google 로그인 시 pending 상태로 저장할 사용자 정보
interface PendingGoogleUser {
  uid: string;
  email: string;
  photoUrl: string;
  firebaseToken: string;
  googleAccessToken: string;
}

interface AuthContextProps {
  user: User | null;
  isLoading: boolean;
  accessToken: string;
  googleAccessToken: string; // Google OAuth Access Token (Calendar API용)
  sessionWarning: boolean; // 세션 만료 경고 표시 여부
  remainingTime: number; // 남은 시간 (초)
  isFirstLogin: boolean; // 첫 Google 로그인 여부 (username 설정 필요)
  pendingGoogleUser: PendingGoogleUser | null; // 닉네임 설정 대기 중인 Google 사용자
  isInMeeting: boolean; // 미팅 참여 중 여부
  handleLogin: (email: string, password: string) => Promise<void>;
  handleRegister: (email: string, password: string, username: string) => Promise<void>;
  handleGoogleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  verificationStatus: () => Promise<boolean>;
  extendSession: () => void; // 세션 연장
  refreshUserData: () => Promise<void>; // 사용자 정보 새로고침
  clearFirstLogin: () => void; // 첫 로그인 상태 초기화
  completeGoogleRegistration: (username: string) => Promise<void>; // Google 회원가입 완료 (닉네임 설정 후)
  cancelGoogleRegistration: () => Promise<void>; // Google 회원가입 취소
  setInMeeting: (inMeeting: boolean) => void; // 미팅 참여 상태 설정
  unlinkGoogle: () => Promise<void>; // Google 연동 해제
  hasPasswordProvider: () => boolean; // 비밀번호 로그인 연결 여부 확인
  isGoogleLinked: () => boolean; // Google 연동 여부 확인
  setPasswordForGoogleUser: (newPassword: string) => Promise<void>; // Google 사용자에게 비밀번호 설정
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // localStorage에서 username만 로드 (로그인 상태 확인용)
  const savedUsername = loadFromStorage();

  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string>("");
  const [googleAccessToken, setGoogleAccessToken] = useState<string>(""); // Google OAuth Access Token (httpOnly 쿠키에 저장됨)
  // localStorage에 username이 있으면 인증 확인 필요
  const [isLoading, setIsLoading] = useState(!!savedUsername);
  const [sessionWarning, setSessionWarning] = useState(false); // 세션 만료 경고
  const [remainingTime, setRemainingTime] = useState(0); // 남은 시간 (초)
  const [isFirstLogin, setIsFirstLogin] = useState(false); // 첫 Google 로그인 여부
  const [pendingGoogleUser, setPendingGoogleUser] = useState<PendingGoogleUser | null>(null); // 닉네임 설정 대기 중인 Google 사용자
  const [isInMeeting, setInMeeting] = useState(false); // 미팅 참여 중 여부

  // Refs for timers
  const lastActivityRef = useRef<number>(Date.now());
  const inactivityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tokenRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Google 회원가입 진행 중인지 추적하는 ref (onAuthStateChanged에서 자동 등록 방지)
  const isGoogleRegistrationPendingRef = useRef<boolean>(false);

  // 활동 기록 업데이트
  const updateLastActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    // 경고 상태였다면 해제
    if (sessionWarning) {
      setSessionWarning(false);
      setRemainingTime(0);
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    }
  }, [sessionWarning]);

  // 세션 연장 (사용자가 명시적으로 연장 버튼 클릭 시)
  const extendSession = useCallback(() => {
    updateLastActivity();
    console.log("세션이 연장되었습니다.");
  }, [updateLastActivity]);

  // 사용자 정보 새로고침
  const refreshUserData = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (firebaseUser && accessToken) {
      try {
        const response = await getByUID(firebaseUser.uid, accessToken);
        setUser({ ...response });
        saveToStorage(response);
        setIsFirstLogin(false);
      } catch (error) {
        console.error("사용자 정보 새로고침 실패:", error);
      }
    }
  }, [accessToken]);

  // 첫 로그인 상태 초기화
  const clearFirstLogin = useCallback(() => {
    setIsFirstLogin(false);
  }, []);

  // 토큰 갱신 함수
  const refreshAccessToken = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      try {
        const token = await firebaseUser.getIdToken(true); // force refresh
        setAccessToken(token);
        // 쿠키에도 토큰 갱신
        await refreshTokenCookie(token);
        console.log("토큰이 갱신되었습니다.");
      } catch (error) {
        console.error("토큰 갱신 실패:", error);
      }
    }
  }, []);

  // 비활동 체크 및 자동 로그아웃
  const checkInactivity = useCallback(async () => {
    // 미팅 참여 중이면 비활동 체크 스킵
    if (isInMeeting) {
      // 미팅 중에는 활동 시간 갱신
      lastActivityRef.current = Date.now();
      return;
    }

    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;

    if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
      // 30분 초과 - 자동 로그아웃
      console.log("30분 비활동으로 자동 로그아웃됩니다.");
      setSessionWarning(false);
      // 서버 쿠키 삭제
      await logoutServer();
      clearStorage();
      await signOut(auth);
      setUser(null);
      setAccessToken("");
      setGoogleAccessToken("");
      alert("비활동으로 인해 자동 로그아웃 되었습니다.");
    } else if (timeSinceLastActivity >= INACTIVITY_TIMEOUT - INACTIVITY_WARNING_TIME) {
      // 25분 경과 - 경고 표시
      if (!sessionWarning) {
        setSessionWarning(true);
        const remaining = Math.ceil((INACTIVITY_TIMEOUT - timeSinceLastActivity) / 1000);
        setRemainingTime(remaining);

        // 카운트다운 시작
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
        }
        countdownTimerRef.current = setInterval(() => {
          setRemainingTime((prev) => {
            if (prev <= 1) {
              if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }
  }, [sessionWarning, isInMeeting]);

  // 활동 이벤트 리스너 설정
  useEffect(() => {
    if (!user) return;

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    // 디바운스된 활동 업데이트 (1초에 한 번만)
    let lastUpdate = 0;
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastUpdate > 1000) {
        lastUpdate = now;
        updateLastActivity();
      }
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [user, updateLastActivity]);

  // 비활동 체크 타이머 설정
  useEffect(() => {
    if (!user) {
      // 로그아웃 상태면 타이머 정리
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setSessionWarning(false);
      setRemainingTime(0);
      return;
    }

    // 1분마다 비활동 체크
    inactivityTimerRef.current = setInterval(checkInactivity, 60 * 1000);

    return () => {
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current);
      }
    };
  }, [user, checkInactivity]);

  // 토큰 자동 갱신 타이머 설정
  useEffect(() => {
    if (!user) {
      if (tokenRefreshTimerRef.current) {
        clearInterval(tokenRefreshTimerRef.current);
        tokenRefreshTimerRef.current = null;
      }
      return;
    }

    // 50분마다 토큰 갱신
    tokenRefreshTimerRef.current = setInterval(refreshAccessToken, TOKEN_REFRESH_INTERVAL);

    return () => {
      if (tokenRefreshTimerRef.current) {
        clearInterval(tokenRefreshTimerRef.current);
      }
    };
  }, [user, refreshAccessToken]);

  // Firebase Auth 상태 변경 감지 및 백그라운드 토큰 갱신
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // 토큰 갱신 (백그라운드에서)
          const token = await firebaseUser.getIdToken();
          setAccessToken(token);

          // 쿠키에 토큰 저장
          await setTokenCookie(token);

          try {
            // 기존 사용자 조회
            const response = await getByUID(firebaseUser.uid, token);
            setUser({ ...response });
            // localStorage에 username만 저장
            saveToStorage(response);
          } catch (fetchError) {
            // 신규 사용자 감지
            // Google 회원가입 진행 중이면 자동 등록 스킵 (handleGoogleLogin에서 처리)
            if (isGoogleRegistrationPendingRef.current) {
              console.log("Google 회원가입 진행 중 - 자동 등록 스킵");
              return;
            }
            // 이메일 회원가입의 경우 handleRegister에서 이미 등록되므로 여기까지 오지 않음
            // 예외적인 경우를 위해 로그만 출력
            console.log("신규 사용자 감지 (자동 등록 안함):", firebaseUser.email);
          }
          // 로그인 시 활동 시간 초기화
          lastActivityRef.current = Date.now();
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser(null);
          setAccessToken("");
          clearStorage();
        }
      } else {
        // Firebase에서 로그아웃 상태 -> localStorage도 정리
        setUser(null);
        setAccessToken("");
        setGoogleAccessToken("");
        clearStorage();
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleRegister = async (email: string, password: string, username: string): Promise<void> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      const token = await firebaseUser.getIdToken();
      await registerUser({ uid: firebaseUser.uid, email: firebaseUser.email!, username: username }, token);
      await sendEmailVerification(firebaseUser);
      await signOut(auth);
      alert("Verification email sent. Please check your email.");
    } catch (e: any) {
      if (e.code === "auth/email-already-in-use") {
        throw new Error("User already exists with this email.");
      }
      throw new Error(`Registration error: ${e.message}`);
    }
  };

  const handleLogin = async (email: string, password: string): Promise<void> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      if (!firebaseUser.emailVerified) {
        await signOut(auth);
        throw new Error("Please verify your email before logging in.");
      }
      const token = await firebaseUser.getIdToken();
      const response = await getByUID(firebaseUser.uid, token);
      setUser({ ...response});
    } catch (e: any) {
      throw new Error("Login failed: " + e.message);
    }
  };

  const handleGoogleLogin = async (): Promise<void> => {
    const provider = new GoogleAuthProvider();
    // Google Calendar API 사용을 위한 scope 추가
    provider.addScope('https://www.googleapis.com/auth/calendar');
    try {
      console.log("Google 로그인 시도...");
      const userCredential = await signInWithPopup(auth, provider);
      console.log("Google 로그인 성공:", userCredential.user.email);
      const firebaseUser = userCredential.user;
      const token = await firebaseUser.getIdToken();

      // Google OAuth Access Token 가져오기 (Calendar API용)
      const credential = GoogleAuthProvider.credentialFromResult(userCredential);
      const googleToken = credential?.accessToken || "";
      setGoogleAccessToken(googleToken);

      // httpOnly 쿠키에 Firebase 토큰과 Google Access Token 저장
      await setTokenCookie(token, googleToken);

      if (googleToken) {
        console.log("Google Access Token 획득 및 httpOnly 쿠키 저장 성공 (Calendar API 사용 가능)");
      } else {
        console.warn("Google Access Token을 받지 못했습니다. Google Meet 링크 생성이 불가능합니다.");
        console.warn("해결 방법: 1) 로그아웃 후 다시 Google 로그인 시도 2) 브라우저 캐시 삭제 후 재로그인");
      }

      try {
        const response = await getByUID(firebaseUser.uid, token);
        setUser({ ...response});
        setAccessToken(token);
        // localStorage에 username만 저장 (로그인 상태 확인용)
        saveToStorage(response);
        setIsFirstLogin(false); // 기존 사용자
        isGoogleRegistrationPendingRef.current = false;
      } catch (fetchError) {
        // 신규 사용자 - DB에 저장하지 않고 pending 상태로 유지
        console.log("신규 Google 사용자 감지 - 닉네임 설정 페이지로 이동 필요", firebaseUser.email);
        const photoUrl = firebaseUser.photoURL || '';

        // onAuthStateChanged에서 자동 등록 방지
        isGoogleRegistrationPendingRef.current = true;

        // pending 상태로 저장 (아직 DB에 저장하지 않음)
        setPendingGoogleUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email!,
          photoUrl: photoUrl,
          firebaseToken: token,
          googleAccessToken: googleToken,
        });
        setAccessToken(token);
        setIsFirstLogin(true); // 신규 사용자 - username 설정 페이지로 이동 필요
        console.log("첫 Google 로그인 - 회원가입 페이지로 이동 필요");
      }
    } catch (e: any) {
      console.error("Google 로그인 에러 코드:", e.code);
      console.error("Google 로그인 에러 메시지:", e.message);
      throw new Error("Google login failed: " + e.message);
    }
  };

  // Google 회원가입 완료 (닉네임 설정 후 DB에 저장)
  const completeGoogleRegistration = async (username: string): Promise<void> => {
    if (!pendingGoogleUser) {
      throw new Error("No pending Google user to register");
    }

    try {
      const { uid, email, photoUrl, firebaseToken, googleAccessToken: pendingGoogleToken } = pendingGoogleUser;

      // DB에 사용자 등록
      await registerUser({
        uid,
        email,
        username,
        password: '',
        photoUrl,
      }, firebaseToken);

      // 등록된 사용자 정보 조회
      const response = await getByUID(uid, firebaseToken);
      setUser({ ...response });
      setAccessToken(firebaseToken);
      setGoogleAccessToken(pendingGoogleToken);
      saveToStorage(response);

      // pending 상태 초기화
      setPendingGoogleUser(null);
      setIsFirstLogin(false);
      isGoogleRegistrationPendingRef.current = false;

      console.log("Google 회원가입 완료:", username);
    } catch (error) {
      console.error("Google 회원가입 실패:", error);
      throw error;
    }
  };

  // Google 회원가입 취소 (Firebase에서 로그아웃)
  const cancelGoogleRegistration = async (): Promise<void> => {
    isGoogleRegistrationPendingRef.current = false;
    setPendingGoogleUser(null);
    setIsFirstLogin(false);
    setAccessToken("");
    setGoogleAccessToken("");
    await logoutServer();
    await signOut(auth);
    console.log("Google 회원가입 취소됨");
  };

  // 비밀번호 provider 연결 여부 확인
  const hasPasswordProvider = (): boolean => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return false;
    return firebaseUser.providerData.some(
      (provider) => provider.providerId === 'password'
    );
  };

  // Google 연동 여부 확인
  const isGoogleLinked = (): boolean => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return false;
    return firebaseUser.providerData.some(
      (provider) => provider.providerId === 'google.com'
    );
  };

  // Google 사용자에게 비밀번호 설정 (연동 해제 전 필수)
  const setPasswordForGoogleUser = async (newPassword: string): Promise<void> => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || !firebaseUser.email) {
      throw new Error("No user is currently logged in");
    }

    // 이미 비밀번호 provider가 있으면 스킵
    if (hasPasswordProvider()) {
      console.log("Password provider already linked");
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, newPassword);
      await linkWithCredential(firebaseUser, credential);
      console.log("Password provider linked successfully");
    } catch (error: any) {
      console.error("Failed to link password provider:", error);
      throw new Error(`비밀번호 설정 실패: ${error.message}`);
    }
  };

  // Google 연동 해제
  const unlinkGoogle = async (): Promise<void> => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      throw new Error("No user is currently logged in");
    }

    // Google 연동 여부 확인
    if (!isGoogleLinked()) {
      throw new Error("Google is not linked to this account");
    }

    // 비밀번호 provider 확인 - 없으면 연동 해제 불가
    if (!hasPasswordProvider()) {
      throw new Error("PASSWORD_REQUIRED");
    }

    try {
      // Firebase에서 Google provider 연결 해제
      await unlink(firebaseUser, 'google.com');
      console.log("Google provider unlinked successfully");

      // Google Access Token 초기화
      setGoogleAccessToken("");

      // 사용자 정보 새로고침 (photoUrl 등 업데이트 반영)
      await refreshUserData();
    } catch (error: any) {
      console.error("Failed to unlink Google:", error);
      throw new Error(`Google 연동 해제 실패: ${error.message}`);
    }
  };

  const handleLogout = async (): Promise<void> => {
    // 타이머 정리
    if (inactivityTimerRef.current) {
      clearInterval(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (tokenRefreshTimerRef.current) {
      clearInterval(tokenRefreshTimerRef.current);
      tokenRefreshTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setSessionWarning(false);
    setRemainingTime(0);

    // 서버 쿠키 삭제
    await logoutServer();

    // localStorage 정리 (username과 googleToken 모두 삭제)
    clearStorage();

    await signOut(auth);
    setUser(null);
    setAccessToken("");
    setGoogleAccessToken("");
  };

  const resendVerificationEmail = async (): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("No user is currently logged in.");
    await sendEmailVerification(currentUser);
    alert("Verification email has been resent.");
  };

  const verificationStatus = async (): Promise<boolean> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("No user is currently logged in.");
    return currentUser.emailVerified;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        accessToken,
        googleAccessToken,
        sessionWarning,
        remainingTime,
        isFirstLogin,
        pendingGoogleUser,
        isInMeeting,
        handleLogin,
        handleRegister,
        handleGoogleLogin,
        handleLogout,
        resendVerificationEmail,
        verificationStatus,
        extendSession,
        refreshUserData,
        clearFirstLogin,
        completeGoogleRegistration,
        cancelGoogleRegistration,
        setInMeeting,
        unlinkGoogle,
        hasPasswordProvider,
        isGoogleLinked,
        setPasswordForGoogleUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextProps => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

//archive 코드
/** 
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { verifyEmail, login, googleLogin, logout, refreshToken } from "../api/auth";
import { getUserByUsername, registerUser, resendVerificationEmail, User } from "../api/user";
interface AuthContextProps {
  user: User | null;
  accessToken: string;
  isLoading: boolean;
  getUserId: () => string | '';
  handleLogin: (username: string, password: string) => Promise<void>;
  handleRegister: (email: string, password: string, username: string) => Promise<void>;
  handleGoogleLogin: (email: string, name: string) => Promise<void>;
  handleLogout: () => Promise<void>;
  resendEmailVerification: (email: string) => Promise<void>;
  verifyRegisterToken: (token: string, email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [accessToken, setAccessToken] = useState<string>('');
  console.log("user ID: ", user?.id);
  useEffect(() => {
    const restoreLoginState = async () => {
      try {
        // Refresh Token을 사용하여 Access Token과 Username 갱신
        const data = await refreshToken();

        if (data) {
          setAccessToken(data.token); // 갱신된 Access Token 설정
          // console.log("data", data);
          const username = data.username; // Username 추출
          const fetchedUser = await getUserByUsername(username, accessToken); // 사용자 정보 가져오기
          setUser(fetchedUser);
        } else {
          setUser(null); // Refresh Token이 유효하지 않은 경우
        }
      } catch (error) {
        console.error("Failed to restore login state:", error);
        setUser(null);
      } finally {
        setIsLoading(false); // 로딩 상태 해제
      }
    };

    restoreLoginState();
  }, []);
  
  // console.log("user", user);
  const handleLogin = async (username: string, password: string) => {
    try {
      const { token } = await login({ username, password });
      console.log("login-token", token);
      setAccessToken(token); // Access Token 메모리에 저장
      const fetchedUser = await getUserByUsername(username, accessToken);
      setUser(fetchedUser);
    } catch (error) {
      console.error("Login failed:", error);
      throw new Error("로그인에 실패했습니다.");
    }
  };
// console.log("accessToken", accessToken);
  const handleRegister = async (email: string, password: string, username: string) => {
    try {
      const user = {
        username: username,
        email: email,
        password: password
      }
      const newUser = await registerUser(user);
      // await resendVerificationEmail(newUser.email);
      alert("인증 이메일이 발송되었습니다. 이메일을 확인하세요.");
    } catch (error) {
      console.error("Registration failed:", error);
      throw new Error("회원가입에 실패했습니다.");
    }
  };

  const handleGoogleLogin = async (email: string, name: string) => {
    try {
      const data = await googleLogin({ email, name });
      // console.log("fetchedUser", data);
      setAccessToken(data.token); // Access Token 메모리에 저장
      const fetchedUser = await getUserByUsername(name, accessToken);
      setUser(fetchedUser);
    } catch (error) {
      console.error("Google login failed:", error);
      throw new Error("Google 로그인에 실패했습니다.");
    }
  };

  const handleLogout = async () => {
    try {
      await logout(); // 서버에서 Refresh Token 제거
      setAccessToken(''); // Access Token 초기화
      setUser(null); // 사용자 상태 초기화
    } catch (error) {
      console.error("Logout failed:", error);
      throw new Error("로그아웃에 실패했습니다.");
    }
  };

  const resendEmailVerification = async (email: string) => {
    try {
      await resendVerificationEmail(email);
      alert("인증 이메일이 재발송되었습니다.");
    } catch (error) {
      console.error("Failed to resend email verification:", error);
      throw new Error("이메일 인증 재발송에 실패했습니다.");
    }
  };

  const verifyRegisterToken = async (token: string, email: string) => {
    try {
      const response = await verifyEmail(token, email);
      alert(response || "Email verified successfully!");
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || "Failed to verify email.";
      throw new Error(errorMessage);
    }
  }

  const getUserId = (): string | '' => {
    if(!user) return '';
    // const userId = user.id;
    return user.id || ''; // User 객체에서 `id`를 안전하게 반환
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        getUserId,
        handleLogin,
        handleRegister,
        handleGoogleLogin,
        handleLogout,
        resendEmailVerification,
        verifyRegisterToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

  export const useAuth = (): AuthContextProps => {
    const context = useContext(AuthContext);
    if (!context) {
      throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
  };
**/