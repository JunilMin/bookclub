import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext/AuthContext';
import { validateUsernameAPI } from '../api/user';
import { validateUsername } from '../utils/validateUsername';
import './styles/SetUsername.css';

const Register: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pendingGoogleUser, completeGoogleRegistration, cancelGoogleRegistration } = useAuth();

  const [username, setUsername] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    setIsAvailable(null);

    if (value) {
      const { isValid, error } = validateUsername(value);
      setValidationError(isValid ? '' : error);
    } else {
      setValidationError('');
    }
  };

  const handleCheckDuplicate = useCallback(async () => {
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

  const handleCancel = async () => {
    await cancelGoogleRegistration();
    navigate('/login');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pendingGoogleUser) {
      navigate('/login');
      return;
    }

    if (isAvailable !== true) {
      return;
    }

    setIsSubmitting(true);
    try {
      await completeGoogleRegistration(username);
      navigate('/');
    } catch (error) {
      console.error('Registration error:', error);
      alert(t('register_error_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!pendingGoogleUser) {
    return (
      <div className="set-username-container">
        <div className="set-username-card">
          <div className="set-username-icon-wrap">
            <i className="ri-user-add-line"></i>
          </div>
          <h1 className="set-username-title">{t('register_error_no_pending_user')}</h1>
          <button className="set-username-submit-btn" onClick={() => navigate('/login')}>
            {t('register_go_to_login')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="set-username-container">
      <div className="set-username-card">
        {/* Header */}
        <div className="set-username-header">
          <div className="set-username-icon-wrap">
            <i className="ri-quill-pen-line"></i>
          </div>
          <h1 className="set-username-title">{t('register_title')}</h1>
          <p className="set-username-subtitle">{t('register_subtitle')}</p>
        </div>

        {/* Google Account Info */}
        <div className="set-username-google-info">
          {pendingGoogleUser.googlePhotoUrl ? (
            <img
              src={pendingGoogleUser.googlePhotoUrl}
              alt=""
              className="set-username-google-avatar"
            />
          ) : (
            <div className="set-username-google-avatar placeholder">
              <i className="ri-google-fill"></i>
            </div>
          )}
          <div className="set-username-google-detail">
            <p className="set-username-google-email">{pendingGoogleUser.email}</p>
            <p className="set-username-google-label">{t('register_google_account')}</p>
          </div>
          <i className="ri-check-double-line set-username-google-check"></i>
        </div>

        {/* Form */}
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

            {/* Validation message */}
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

          {/* Rules */}
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

          {/* Buttons */}
          <div className="set-username-actions">
            <button
              type="button"
              className="set-username-cancel-btn"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              {t('register_cancel')}
            </button>
            <button
              type="submit"
              className="set-username-submit-btn"
              disabled={isSubmitting || isAvailable !== true}
            >
              {isSubmitting ? (
                <>
                  <i className="ri-loader-4-line spinning"></i>
                  <span>{t('register_submitting')}</span>
                </>
              ) : (
                <>
                  <i className="ri-check-line"></i>
                  <span>{t('register_submit')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
