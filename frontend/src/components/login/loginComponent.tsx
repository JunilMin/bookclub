// src/components/LoginComponent.tsx
import GoogleLoginHandler from './GoogleLoginHandler.tsx';

const LoginComponent: React.FC = () => {
  return (
    // 당분간 google login만 사용
    <div>
    <GoogleLoginHandler/>
      {/* <button onClick={googleLogin}>Google 로그인</button> Google 로그인 버튼 */}
    </div>
  );
};

export default LoginComponent;
