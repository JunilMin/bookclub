import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext/AuthContext';
import { validateUsernameAPI } from '../api/user';
import './styles/SetUsername.css';

// 닉네임 유효성 검사
const validateUsername = (username: string): { isValid: boolean; error: string } => {
  // 빈 문자열 체크
  if (!username.trim()) {
    return { isValid: false, error: 'set_username_error_empty' };
  }

  // 공백 체크
  if (/\s/.test(username)) {
    return { isValid: false, error: 'set_username_error_space' };
  }

  // 특수문자 체크 (한글, 영문, 숫자만 허용)
  if (!/^[가-힣a-zA-Z0-9]+$/.test(username)) {
    return { isValid: false, error: 'set_username_error_special' };
  }

  // 길이 체크: 한글은 8자, 영문은 14자
  // 한글 문자 수 계산
  const koreanCount = (username.match(/[가-힣]/g) || []).length;
  const nonKoreanCount = username.length - koreanCount;

  // 한글 1자 = 영문 1.75자로 환산하여 총 14자 이하인지 체크
  // 또는 단순히: 한글만 있으면 8자, 영문만 있으면 14자
  if (koreanCount > 0 && koreanCount === username.length) {
    // 한글만 있는 경우
    if (username.length > 8) {
      return { isValid: false, error: 'set_username_error_length_kr' };
    }
  } else if (koreanCount === 0) {
    // 영문/숫자만 있는 경우
    if (username.length > 14) {
      return { isValid: false, error: 'set_username_error_length_en' };
    }
  } else {
    // 혼합된 경우: 한글 1자 = 1.75 영문자로 계산
    const equivalentLength = koreanCount * 1.75 + nonKoreanCount;
    if (equivalentLength > 14) {
      return { isValid: false, error: 'set_username_error_length_mixed' };
    }
  }

  return { isValid: true, error: '' };
};

const Register: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pendingGoogleUser, completeGoogleRegistration, cancelGoogleRegistration } = useAuth();

  const [username, setUsername] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 입력값 변경 핸들러
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    setIsAvailable(null); // 중복 체크 결과 초기화

    // 실시간 유효성 검사
    if (value) {
      const { isValid, error } = validateUsername(value);
      setValidationError(isValid ? '' : error);
    } else {
      setValidationError('');
    }
  };

  // 중복 및 비속어 체크 핸들러
  const handleCheckDuplicate = useCallback(async () => {
    // 유효성 검사 먼저
    const { isValid, error } = validateUsername(username);
    if (!isValid) {
      setValidationError(error);
      return;
    }

    setIsChecking(true);
    try {
      const result = await validateUsernameAPI(username);

      if (result.valid) {
        setIsAvailable(true);
        setValidationError('');
      } else {
        setIsAvailable(false);
        // reason에 따라 에러 메시지 설정
        if (result.reason === 'duplicate') {
          setValidationError('set_username_error_duplicate');
        } else if (result.reason === 'profanity') {
          setValidationError('set_username_error_profanity');
        } else {
          setValidationError('set_username_error_check_failed');
        }
      }
    } catch (error) {
      console.error('Username check error:', error);
      setValidationError('set_username_error_check_failed');
    } finally {
      setIsChecking(false);
    }
  }, [username]);

  // 취소 핸들러
  const handleCancel = async () => {
    await cancelGoogleRegistration();
    navigate('/login');
  };

  // 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pendingGoogleUser) {
      alert(t('register_error_no_pending_user'));
      navigate('/login');
      return;
    }

    // 중복 체크가 완료되지 않은 경우
    if (isAvailable !== true) {
      alert(t('set_username_check_first'));
      return;
    }

    setIsSubmitting(true);
    try {
      // Google 회원가입 완료 (DB에 저장)
      await completeGoogleRegistration(username);

      alert(t('register_success'));
      navigate('/');
    } catch (error) {
      console.error('Registration error:', error);
      alert(t('register_error_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // pendingGoogleUser가 없으면 로그인 페이지로 리다이렉트
  if (!pendingGoogleUser) {
    return (
      <div className="set-username-container">
        <div className="set-username-card">
          <h1 className="set-username-title">{t('register_error_no_pending_user')}</h1>
          <button className="submit-button" onClick={() => navigate('/login')}>
            {t('register_go_to_login')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="set-username-container">
      <div className="set-username-card">
        <h1 className="set-username-title">{t('register_title')}</h1>
        <p className="set-username-subtitle">{t('register_subtitle')}</p>

        {/* Google 계정 정보 표시 */}
        <div className="google-account-info" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '24px',
          padding: '12px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}>
          {pendingGoogleUser.googlePhotoUrl && (
            <img
              src={pendingGoogleUser.googlePhotoUrl}
              alt="Google profile"
              style={{ width: '40px', height: '40px', borderRadius: '50%' }}
            />
          )}
          <div>
            <p style={{ margin: 0, fontWeight: 500 }}>{pendingGoogleUser.email}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>{t('register_google_account')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="set-username-form">
          <div className="input-group">
            <label htmlFor="username">{t('set_username_label')}</label>
            <div className="input-with-button">
              <input
                type="text"
                id="username"
                value={username}
                onChange={handleUsernameChange}
                placeholder={t('set_username_placeholder')}
                disabled={isSubmitting}
                className={validationError ? 'error' : isAvailable === true ? 'success' : ''}
              />
              <button
                type="button"
                onClick={handleCheckDuplicate}
                disabled={isChecking || !username || !!validationError}
                className="check-button"
              >
                {isChecking ? t('set_username_checking') : t('set_username_check')}
              </button>
            </div>

            {/* 유효성/중복 체크 결과 메시지 */}
            {validationError && (
              <p className="error-message">{t(validationError)}</p>
            )}
            {isAvailable === true && !validationError && (
              <p className="success-message">{t('set_username_available')}</p>
            )}
          </div>

          {/* 닉네임 규칙 안내 */}
          <div className="username-rules">
            <p className="rules-title">{t('set_username_rules_title')}</p>
            <ul>
              <li>{t('set_username_rule_1')}</li>
              <li>{t('set_username_rule_2')}</li>
              <li>{t('set_username_rule_3')}</li>
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              className="submit-button"
              onClick={handleCancel}
              disabled={isSubmitting}
              style={{ backgroundColor: '#888', flex: 1 }}
            >
              {t('register_cancel')}
            </button>
            <button
              type="submit"
              className="submit-button"
              disabled={isSubmitting || isAvailable !== true}
              style={{ flex: 2 }}
            >
              {isSubmitting ? t('register_submitting') : t('register_submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
