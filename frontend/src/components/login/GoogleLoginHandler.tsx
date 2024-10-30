// src/components/GoogleLoginHandler.tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const GoogleLoginHandler: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        // URL에서 JWT 토큰 추출
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
    
        if (token) {
          // JWT 토큰을 로컬 스토리지에 저장
          localStorage.setItem('token', token);
          navigate('/'); // 메인 페이지로 리다이렉트
        } else {
          console.error('토큰이 없습니다.');
          navigate('/login'); // 로그인 페이지로 리다이렉트
        }
      }, [navigate]);
    
      return <div>Google 로그인 중...</div>;
    };
    
export default GoogleLoginHandler;