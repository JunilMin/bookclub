import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { verifyEmail, login, googleLogin, logout, refreshToken } from "../api/auth";
import { getUserByUsername, registerUser, resendVerificationEmail, User } from "../api/user";
interface AuthContextProps {
  user: User | null;
  isLoading: boolean;
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
  
  useEffect(() => {
    const restoreLoginState = async () => {
      try {
        // Refresh Token을 사용하여 Access Token과 Username 갱신
        const data = await refreshToken();

        if (data) {
          setAccessToken(data.token); // 갱신된 Access Token 설정
          console.log("data", data);
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

  console.log("user", user);
  const handleLogin = async (username: string, password: string) => {
    try {
      const { token } = await login({ username, password });
      setAccessToken(token); // Access Token 메모리에 저장
      const fetchedUser = await getUserByUsername(username, accessToken);
      setUser(fetchedUser);
    } catch (error) {
      console.error("Login failed:", error);
      throw new Error("로그인에 실패했습니다.");
    }
  };
console.log("accessToken", accessToken);
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
      console.log("fetchedUser", data);
      setAccessToken(data); // Access Token 메모리에 저장
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
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