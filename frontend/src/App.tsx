import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import Home from './screens/Home';
import Board from './screens/Board';
import PostCreate from './screens/PostCreate';
import SetUsername from './screens/SetUsername';
import Profile from './screens/Profile';
import About from './screens/About';
import NavBar from './components/NavBar';
import Login from './screens/Login';
import SessionWarning from './components/SessionWarning';
import { AuthProvider, useAuth } from './AuthContext/AuthContext';
import { initLanguageByIP } from './language/i18n';
import './App.css';

// 첫 로그인 시 username 설정 페이지로 리다이렉트하는 컴포넌트
const FirstLoginRedirect: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isFirstLogin, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // 로딩 중이 아니고, 첫 로그인이고, 현재 페이지가 set-username이 아닌 경우
    if (!isLoading && isFirstLogin && user && location.pathname !== '/set-username') {
      navigate('/set-username', { replace: true });
    }
  }, [isFirstLogin, user, isLoading, navigate, location.pathname]);

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  // IP 기반 언어 자동 감지 (localStorage에 저장된 값이 없을 때만)
  useEffect(() => {
    initLanguageByIP();
  }, []);

  return (
    <FirstLoginRedirect>
      <NavBar />
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/board" element={<Board />} />
          <Route path="/board/create" element={<PostCreate />} />
          <Route path="/set-username" element={<SetUsername />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </div>
      {/* 세션 만료 경고 모달 */}
      <SessionWarning />
    </FirstLoginRedirect>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
};

export default App;