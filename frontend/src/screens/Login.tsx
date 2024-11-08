import React from 'react';
import LoginComponent from '../components/login/loginComponent.tsx';
// import GoogleLoginHandler from '../components/login/GoogleLoginHandler.tsx';
import Signup from '../components/login/Signup.tsx';
// import { Route, Routes } from 'react-router-dom';

const Login: React.FC = () => {
  return (
    <div>
      <h1>로그인</h1>
      <LoginComponent />
      <Signup />
      {/* Google OAuth 리다이렉션을 처리하는 라우트 */}
    </div>
  );
};

export default Login;