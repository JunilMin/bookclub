// src/components/GoogleLoginHandler.tsx

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FcGoogle } from "react-icons/fc";
import { useGoogleLogin, TokenResponse } from "@react-oauth/google";
import useAuthStore from '../../stores/useAuthStore';
interface UserInfo {
  id: string;
  email: string;
  name: string;
}

const GoogleLoginHandler: React.FC = () => {
  const googleLogin = useAuthStore((state) => state.googleLogin);
  const [user, setUser] = useState<TokenResponse | null>(null);
  const navigate = useNavigate();

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const { access_token } = tokenResponse;
        const userInfoResponse = await fetch(
          `https://www.googleapis.com/oauth2/v1/userinfo?access_token=${access_token}`
        );
        const userInfo = await userInfoResponse.json();
        await googleLogin(userInfo.email, userInfo.name);
        navigate('/board'); // 로그인 후 페이지 이동
      } catch (error) {
        console.error("Google 로그인 실패:", error);
      }
    },
    onError: (error) => console.error("Google Login Failed:", error),
  });

  return (
    <div className="shadow-2xl">
      <button
        type="button"
        className="bg-mainColor flex justify-center items-center p-3 rounded-lg cursor-pointer outline-none"
        onClick={() => login()}
      >
        <FcGoogle className="mr-4" />
        Sign in with Google
      </button>
    </div>
  );
};

export default GoogleLoginHandler;
