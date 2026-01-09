// src/components/GoogleLoginHandler.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FcGoogle } from "react-icons/fc";
import { useAuth } from '../../AuthContext/AuthContext';

const GoogleLoginHandler: React.FC = () => {
  const { handleGoogleLogin } = useAuth();
  const navigate = useNavigate();

  const handleClick = async () => {
    try {
      await handleGoogleLogin();
      navigate('/board');
    } catch (error) {
      console.error("Google 로그인 실패:", error);
    }
  };

  return (
    <div className="shadow-2xl">
      <button
        type="button"
        className="bg-mainColor flex justify-center items-center p-3 rounded-lg cursor-pointer outline-none"
        onClick={handleClick}
      >
        <FcGoogle className="mr-4" />
        Sign in with Google
      </button>
    </div>
  );
};

export default GoogleLoginHandler;
