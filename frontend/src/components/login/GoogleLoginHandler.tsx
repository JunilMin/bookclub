// src/components/GoogleLoginHandler.tsx

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FcGoogle } from "react-icons/fc";
import { useGoogleLogin, TokenResponse } from "@react-oauth/google";
import { googleLogin } from '../../api/auth';

interface UserInfo {
  id: string;
  email: string;
  name: string;
}

const GoogleLoginHandler: React.FC = () => {
  const [user, setUser] = useState<TokenResponse | null>(null);
  const navigate = useNavigate();

  const login = useGoogleLogin({
    onSuccess: (codeResponse) => setUser(codeResponse),
    onError: (error) => console.log("Login Failed:", error),
  });

  useEffect(() => {
    if (user && user.access_token) {
      fetch(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${user.access_token}`)
        .then((res) => res.json())
        .then(async (data: UserInfo) => {
          try {
            const response = await googleLogin({ email: data.email, name: data.name });
            console.log("Google 로그인 성공:", response);
            navigate('/board');
          } catch (error) {
            console.error("Google 로그인 실패:", error);
          }
        })
        .catch((err) => console.log("Google User Info Fetch Error:", err));
    }
  }, [user, navigate]);

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
