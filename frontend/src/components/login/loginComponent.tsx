// src/components/LoginComponent.tsx
import React, { useState } from 'react';
import GoogleLoginHandler from './GoogleLoginHandler.tsx';
import useAuthStore from '../../stores/useAuthStore';

const LoginComponent: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const { isLoggedIn, login, logout } = useAuthStore();


  const handleLogin = async () => {
    try {
      await login(username, password);
      console.log('로그인 성공');
    } catch (error) {
      console.error('로그인 실패:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      console.log('로그아웃 성공');
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  return (
    <div>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button onClick={handleLogin}>Login</button>
      <GoogleLoginHandler/>
      {/* <button onClick={googleLogin}>Google 로그인</button> Google 로그인 버튼 */}
    </div>
  );
};

export default LoginComponent;
