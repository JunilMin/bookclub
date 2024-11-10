// src/components/LoginComponent.tsx
import React, { useState } from 'react';
import { login } from '../../api/auth.tsx';
import GoogleLoginHandler from './GoogleLoginHandler.tsx';

const LoginComponent: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const response = await login({ username, password });
      console.log('로그인 성공:', response.token);
    } catch (error) {
      console.error('로그인 실패:', error);
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
