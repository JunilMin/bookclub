import React, { useState } from 'react';
import LoginComponent from '../components/login/loginComponent.tsx';
// import GoogleLoginHandler from '../components/login/GoogleLoginHandler.tsx';
import Signup from '../components/login/Signup.tsx';
// import { Route, Routes } from 'react-router-dom';

const Login: React.FC = () => {
  const [isSigningup, setIsSigningup] = useState<boolean>(false);
  const handleSignup = () => {
    setIsSigningup(true);
  }
  const handleRetrieveButton = () => {
    setIsSigningup(false);
  }
  return (
    <div>

      {!isSigningup ? (
        <>
          <h1>Log in</h1>
          <LoginComponent />
          <p onClick={handleSignup}> 
            Doesn't have an account yet? Click to Signup 
          </p>
        </>
      ) 
      : (
        <div>
          <button onClick={handleRetrieveButton}>Back to login</button>
          <Signup />
        </div>
        
      
      )}
      
      
      {/* Google OAuth 리다이렉션을 처리하는 라우트 */}
    </div>
  );
};

export default Login;