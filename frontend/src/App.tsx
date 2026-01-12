import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import Home from './screens/Home';
import Board from './screens/Board';
import PostCreate from './screens/PostCreate';
import SetUsername from './screens/SetUsername';
import Register from './screens/Register';
import Profile from './screens/Profile';
import Meeting from './screens/Meeting';
import Meet from './screens/Meet';
import MeetRoom from './screens/MeetRoom';
import About from './screens/About';
import NavBar from './components/NavBar';
import Login from './screens/Login';
import SessionWarning from './components/SessionWarning';
import { AuthProvider, useAuth } from './AuthContext/AuthContext';
import { initLanguageByIP } from './language/i18n';
import './App.css';

// 첫 로그인 시 회원가입 페이지로 리다이렉트하는 컴포넌트
const FirstLoginRedirect: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isFirstLogin, user, isLoading, pendingGoogleUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // 로딩 중이 아니고, 첫 로그인이고 (pendingGoogleUser가 있음), 현재 페이지가 register가 아닌 경우
    if (!isLoading && isFirstLogin && pendingGoogleUser && location.pathname !== '/register') {
      navigate('/register', { replace: true });
    }
    // 기존 사용자가 username 변경이 필요한 경우 (user가 있고 isFirstLogin이지만 pendingGoogleUser는 없음)
    if (!isLoading && isFirstLogin && user && !pendingGoogleUser && location.pathname !== '/set-username') {
      navigate('/set-username', { replace: true });
    }
  }, [isFirstLogin, user, pendingGoogleUser, isLoading, navigate, location.pathname]);

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
          <Route path="/meeting/:id" element={<Meeting />} />
          <Route path="/meet/:sessionId" element={<Meet />} />
          <Route path="/meet-room/:sessionId" element={<MeetRoom />} />
          <Route path="/register" element={<Register />} />
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