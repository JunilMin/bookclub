import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext/AuthContext';
import { validateUsernameAPI, updateUser } from '../api/user';
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

const SetUsername: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, accessToken, refreshUserData } = useAuth();

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

  // 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !accessToken) {
      alert(t('set_username_error_not_logged_in'));
      return;
    }

    // 중복 체크가 완료되지 않은 경우
    if (isAvailable !== true) {
      alert(t('set_username_check_first'));
      return;
    }

    setIsSubmitting(true);
    try {
      // 사용자 정보 업데이트
      await updateUser(user.id!, { ...user, username }, accessToken);

      // AuthContext의 user 정보 갱신
      if (refreshUserData) {
        await refreshUserData();
      }

      alert(t('set_username_success'));
      navigate('/');
    } catch (error) {
      console.error('Username update error:', error);
      alert(t('set_username_error_update_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="set-username-container">
      <div className="set-username-card">
        <h1 className="set-username-title">{t('set_username_title')}</h1>
        <p className="set-username-subtitle">{t('set_username_subtitle')}</p>

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

          <button
            type="submit"
            className="submit-button"
            disabled={isSubmitting || isAvailable !== true}
          >
            {isSubmitting ? t('set_username_submitting') : t('set_username_submit')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetUsername;
