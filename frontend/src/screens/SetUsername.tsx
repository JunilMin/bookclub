import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext/AuthContext';
import { validateUsernameAPI, updateUser } from '../api/user';
import { validateUsername } from '../utils/validateUsername';
import './styles/SetUsername.css';

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
        <div className="set-username-header">
          <div className="set-username-icon-wrap">
            <i className="ri-edit-line"></i>
          </div>
          <h1 className="set-username-title">{t('set_username_title')}</h1>
          <p className="set-username-subtitle">{t('set_username_subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="set-username-form">
          <div className="set-username-field">
            <label className="set-username-label" htmlFor="username">{t('set_username_label')}</label>
            <div className="set-username-input-row">
              <input
                type="text"
                id="username"
                className={`set-username-input ${validationError ? 'error' : isAvailable === true ? 'success' : ''}`}
                value={username}
                onChange={handleUsernameChange}
                placeholder={t('set_username_placeholder')}
                disabled={isSubmitting}
                autoFocus
              />
              <button
                type="button"
                className="set-username-check-btn"
                onClick={handleCheckDuplicate}
                disabled={isChecking || !username || !!validationError}
              >
                {isChecking ? (
                  <>
                    <i className="ri-loader-4-line spinning"></i>
                    <span>{t('set_username_checking')}</span>
                  </>
                ) : (
                  <span>{t('set_username_check')}</span>
                )}
              </button>
            </div>

            {validationError && (
              <p className="set-username-msg error">
                <i className="ri-error-warning-line"></i>
                {t(validationError)}
              </p>
            )}
            {isAvailable === true && !validationError && (
              <p className="set-username-msg success">
                <i className="ri-check-line"></i>
                {t('set_username_available')}
              </p>
            )}
          </div>

          <div className="set-username-rules">
            <div className="set-username-rules-header">
              <i className="ri-information-line"></i>
              <span>{t('set_username_rules_title')}</span>
            </div>
            <ul className="set-username-rules-list">
              <li>{t('set_username_rule_1')}</li>
              <li>{t('set_username_rule_2')}</li>
              <li>{t('set_username_rule_3')}</li>
              <li>{t('set_username_rule_4')}</li>
            </ul>
          </div>

          <button
            type="submit"
            className="set-username-submit-btn"
            disabled={isSubmitting || isAvailable !== true}
          >
            {isSubmitting ? (
              <>
                <i className="ri-loader-4-line spinning"></i>
                <span>{t('set_username_submitting')}</span>
              </>
            ) : (
              <>
                <i className="ri-check-line"></i>
                <span>{t('set_username_submit')}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetUsername;
