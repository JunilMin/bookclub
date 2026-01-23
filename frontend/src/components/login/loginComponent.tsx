// src/components/LoginComponent.tsx
import React, { useState } from 'react';
import GoogleLoginHandler from './GoogleLoginHandler.tsx';
import { useAuth } from '../../AuthContext/AuthContext';

const LoginComponent: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const { handleLogin } = useAuth();


  const handleLoginButton = async () => {
    try {
      await handleLogin(username, password);
      console.log('로그인 성공');
    } catch (error) {
      console.error('로그인 실패:', error);
    }
  };

  return (
    // 당분간 google login만 사용
    <div>
    <GoogleLoginHandler/>
      {/* <button onClick={googleLogin}>Google 로그인</button> Google 로그인 버튼 */}
    </div>
    // <div>
    //   <input
    //     type="text"
    //     value={username}
    //     onChange={(e) => setUsername(e.target.value)}
    //     placeholder="Username"
    //   />
    //   <input
    //     type="password"
    //     value={password}
    //     onChange={(e) => setPassword(e.target.value)}
    //     placeholder="Password"
    //   />
    //   <button onClick={handleLoginButton}>Login</button>
    //   <GoogleLoginHandler/>
    //   {/* <button onClick={googleLogin}>Google 로그인</button> Google 로그인 버튼 */}
    // </div>
  );
};

export default LoginComponent;
