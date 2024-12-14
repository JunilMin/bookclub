import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  onAuthStateChanged,
  getAuth,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getUserByUsername, registerUser, User, getByUID } from "../api/user";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

interface AuthContextProps {
  user: User | null;
  isLoading: boolean;
  accessToken: string;
  handleLogin: (email: string, password: string) => Promise<void>;
  handleRegister: (email: string, password: string, username: string) => Promise<void>;
  handleGoogleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  verificationStatus: () => Promise<boolean>;
}

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          const response = await getByUID(firebaseUser.uid, token);
          setUser({ ...response});
          setAccessToken(token);
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUser(null);
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
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const firebaseUser = userCredential.user;
      const token = await firebaseUser.getIdToken();
      // console.log("토오큰",userCredential);
      // console.log("dusueuwer",firebaseUser.uid);
      try {
        // console.log("try ran",firebaseUser.uid);
        const response = await getByUID(firebaseUser.uid, token);
        // console.log("responseddd", response);
        setUser({ ...response});
        setAccessToken(token);
      } catch {
        
        // setUser({uid: firebaseUser.uid, email: firebaseUser.email!, username: firebaseUser.displayName!, password: ''});
        console.log("catch ran",{uid: firebaseUser.uid, email: firebaseUser.email!, username: firebaseUser.displayName!, password: ' '});
        await registerUser({uid: firebaseUser.uid, email: firebaseUser.email!, username: firebaseUser.displayName!, password: ''} , token);
        const response = await getByUID(firebaseUser.uid, token);
        setUser({ ...response});
        setAccessToken(token);
      }
    } catch (e: any) {
      throw new Error("Google login failed: " + e.message);
    }
  };

  const handleLogout = async (): Promise<void> => {
    await signOut(auth);
    setUser(null);
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
        handleLogin,
        handleRegister,
        handleGoogleLogin,
        handleLogout,
        resendVerificationEmail,
        verificationStatus,
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