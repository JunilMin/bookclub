import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext/AuthContext';
import { updateUser, User, UserLocation } from '../api/user';
import { useSettingsStore } from '../store/settingsStore';
import { resizeAndConvertToBase64 } from '../api/storage';
import './styles/Settings.css';

// Google 연동 해제 모달 컴포넌트
interface UnlinkGoogleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password?: string) => Promise<void>;
  needsPassword: boolean;
  isLoading: boolean;
  error: string | null;
}

const UnlinkGoogleModal: React.FC<UnlinkGoogleModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  needsPassword,
  isLoading,
  error
}) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (needsPassword) {
      if (password.length < 6) {
        setPasswordError(t('settings_password_min_length'));
        return;
      }
      if (password !== confirmPassword) {
        setPasswordError(t('settings_password_mismatch'));
        return;
      }
      setPasswordError(null);
      await onConfirm(password);
    } else {
      await onConfirm();
    }
  };

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h3 className="settings-modal-title">{t('settings_unlink_google_title')}</h3>
          <button className="settings-modal-close" onClick={onClose}>
            <i className="ri-close-line"></i>
          </button>
        </div>
        <div className="settings-modal-body">
          {needsPassword ? (
            <>
              <div className="settings-modal-warning">
                <i className="ri-alert-line"></i>
                <p>{t('settings_unlink_needs_password')}</p>
              </div>
              <div className="settings-modal-field">
                <label>{t('settings_new_password')}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('settings_new_password_placeholder')}
                  className="settings-input"
                  minLength={6}
                />
              </div>
              <div className="settings-modal-field">
                <label>{t('settings_confirm_password')}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('settings_confirm_password_placeholder')}
                  className="settings-input"
                />
              </div>
              {passwordError && (
                <div className="settings-modal-error">
                  <i className="ri-error-warning-line"></i>
                  <span>{passwordError}</span>
                </div>
              )}
            </>
          ) : (
            <div className="settings-modal-confirm-text">
              <p>{t('settings_unlink_google_confirm')}</p>
              <ul className="settings-modal-warning-list">
                <li>{t('settings_unlink_warning_1')}</li>
                <li>{t('settings_unlink_warning_2')}</li>
              </ul>
            </div>
          )}
          {error && (
            <div className="settings-modal-error">
              <i className="ri-error-warning-line"></i>
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="settings-modal-footer">
          <button className="settings-btn-cancel" onClick={onClose} disabled={isLoading}>
            {t('settings_cancel')}
          </button>
          <button className="settings-btn-danger" onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <i className="ri-loader-4-line spinning"></i>
                {t('settings_processing')}
              </>
            ) : (
              t('settings_unlink_confirm')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// 위치 정보 동의 모달 컴포넌트
interface LocationConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

const LocationConsentModal: React.FC<LocationConsentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h3 className="settings-modal-title">{t('settings_location_consent_title')}</h3>
          <button className="settings-modal-close" onClick={onClose}>
            <i className="ri-close-line"></i>
          </button>
        </div>
        <div className="settings-modal-body">
          <div className="settings-modal-location-icon">
            <i className="ri-map-pin-line"></i>
          </div>
          <div className="settings-modal-confirm-text">
            <p>{t('settings_location_consent_desc')}</p>
            <ul className="settings-modal-info-list">
              <li>{t('settings_location_consent_info_1')}</li>
              <li>{t('settings_location_consent_info_2')}</li>
              <li>{t('settings_location_consent_info_3')}</li>
            </ul>
          </div>
        </div>
        <div className="settings-modal-footer">
          <button className="settings-btn-cancel" onClick={onClose} disabled={isLoading}>
            {t('settings_cancel')}
          </button>
          <button className="settings-btn-primary" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <i className="ri-loader-4-line spinning"></i>
                {t('settings_location_loading')}
              </>
            ) : (
              <>
                <i className="ri-check-line"></i>
                {t('settings_location_consent_agree')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

type SettingsTab = 'profile' | 'security' | 'notifications' | 'privacy';

const Settings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, accessToken, refreshUserData, unlinkGoogle, hasPasswordProvider, isGoogleLinked, setPasswordForGoogleUser } = useAuth();

  // Zustand store
  const {
    profile,
    privacy,
    photo,
    isSaving,
    isLocationLoading,
    locationError,
    showLocationConsentModal,
    isPhotoUploading,
    photoError,
    setProfileField,
    setPrivacyField,
    addKeyword,
    removeKeyword,
    toggleGenre,
    setUserLocation,
    setPhotoCustom,
    clearPhotoCustom,
    setPhotoUploading,
    setPhotoError,
    markPhotoSaved,
    resetPhoto,
    initializeFromUser,
    resetProfile,
    resetPrivacy,
    setSaving,
    markProfileSaved,
    markPrivacySaved,
    setLocationLoading,
    setLocationError,
    setShowLocationConsentModal,
  } = useSettingsStore();

  // 파일 입력 ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 로컬 상태 (store로 관리하지 않는 것들)
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [keywordInput, setKeywordInput] = useState('');
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [privacySaveMessage, setPrivacySaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [email, setEmail] = useState('');

  // Google 연동 해제 관련 상태
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);
  const [unlinkNeedsPassword, setUnlinkNeedsPassword] = useState(false);
  const [unlinkLoading, setUnlinkLoading] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [googleLinked, setGoogleLinked] = useState(false);

  // Google 연동 상태 확인
  useEffect(() => {
    if (user) {
      setGoogleLinked(isGoogleLinked());
    }
  }, [user, isGoogleLinked]);

  // Load user profile data on mount
  useEffect(() => {
    if (user) {
      setEmail(user.email || '');

      // Profile introduce data
      const introduce = user.profile?.introduce;
      const profileData = {
        displayName: user.username || '',
        username: user.username || '',
        bio: introduce?.introduction || '',
        website: '', // TODO: 백엔드에 website 필드 추가 시 연동
        selectedGenres: introduce?.preferredGenre || [],
        keywords: introduce?.keywords || [],
        readingStyle: introduce?.styles?.discussionStyle || '',
        preferredTime: introduce?.styles?.preferredTime || '',
        discussionSize: introduce?.styles?.preferredSize || '',
        aiUsage: introduce?.styles?.useAI || '',
        discussionGoal: introduce?.goals?.participate || 0,
        noteGoal: introduce?.goals?.create || 0,
      };

      // Privacy settings
      const visibility = user.setting?.visibility;
      const privacyData = {
        visibilityScope: (visibility?.scope || 'public') as 'public' | 'users' | 'private',
        showEmail: visibility?.elements?.email ?? false,
        showLocation: visibility?.elements?.location ?? true,
        showActivity: visibility?.elements?.activeStatus ?? true,
        userLocation: introduce?.location || null,
      };

      // Photo settings
      const photoData = {
        google: user.photo?.google || null,
        custom: user.photo?.custom || null,
      };

      // Store에 초기화
      initializeFromUser(profileData, privacyData, photoData);
    }
  }, [user, initializeFromUser]);

  // Keyword handlers
  const handleAddKeyword = () => {
    const trimmed = keywordInput.trim();
    if (trimmed && !profile.keywords.includes(trimmed) && profile.keywords.length < 10) {
      addKeyword(trimmed);
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    removeKeyword(keyword);
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  // Handle profile save
  const handleSaveProfile = async () => {
    console.log('[Settings] handleSaveProfile called', {
      hasUser: !!user,
      hasAccessToken: !!accessToken,
      userId: user?.id,
    });

    if (!user || !accessToken || !user.id) {
      console.error('[Settings] Validation failed:', {
        user: !!user,
        accessToken: !!accessToken,
        userId: user?.id,
      });
      setSaveMessage({ type: 'error', text: t('settings_save_error') });
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      // profile과 introduce가 없으면 생성
      const existingProfile = user.profile || {};
      const existingIntroduce = existingProfile.introduce || {};

      const updatedUser: User = {
        ...user,
        username: profile.username,
        // 새 photo 구조로 저장
        photo: {
          google: photo.google || undefined,
          custom: photo.custom || undefined,
        },
        profile: {
          ...existingProfile,
          introduce: {
            ...existingIntroduce,
            introduction: profile.bio,
            preferredGenre: profile.selectedGenres,
            styles: {
              discussionStyle: profile.readingStyle,
              preferredTime: profile.preferredTime,
              preferredSize: profile.discussionSize,
              useAI: profile.aiUsage,
            },
            keywords: profile.keywords,
            goals: {
              participate: profile.discussionGoal,
              create: profile.noteGoal,
            },
            // 위치 정보도 profile에서 저장
            location: privacy.userLocation || undefined,
          },
        },
      };

      console.log('[Settings] Calling updateUser API...');
      await updateUser(user.id, updatedUser, accessToken);
      console.log('[Settings] updateUser API call successful');

      // Refresh user data in context
      if (refreshUserData) {
        console.log('[Settings] Refreshing user data...');
        await refreshUserData();
      }

      // Store에 저장 완료 표시
      markProfileSaved();
      markPhotoSaved();
      console.log('[Settings] Profile saved successfully');
      setSaveMessage({ type: 'success', text: t('settings_save_success') });

      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error: any) {
      console.error('[Settings] Error saving profile:', error);
      console.error('[Settings] Error details:', error?.response?.data || error?.message);
      setSaveMessage({ type: 'error', text: t('settings_save_error') });
    } finally {
      console.log('[Settings] Save completed, setting isSaving to false');
      setSaving(false);
    }
  };

  // Handle cancel - reset to original values
  const handleCancel = () => {
    resetProfile();
    resetPhoto();
    setSaveMessage(null);
  };

  // Photo upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoUploading(true);
    setPhotoError(null);

    try {
      // 이미지 리사이즈 및 Base64 변환 (400x400, 80% quality)
      const base64 = await resizeAndConvertToBase64(file, 400, 400, 0.8);
      setPhotoCustom(base64);
    } catch (error: any) {
      console.error('Photo upload error:', error);
      setPhotoError(error.message || t('settings_photo_upload_error'));
    } finally {
      setPhotoUploading(false);
      // input 초기화 (같은 파일 다시 선택 가능하도록)
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Photo delete handler (커스텀 사진 삭제 → Google 사진으로 복원)
  const handlePhotoDelete = () => {
    clearPhotoCustom();
    setPhotoError(null);
  };

  // 현재 표시할 사진 URL
  const displayPhotoUrl = photo.custom || photo.google;

  // Google 연동 해제 시작
  const handleUnlinkGoogleClick = () => {
    // 비밀번호 provider가 있는지 확인
    const hasPassword = hasPasswordProvider();
    setUnlinkNeedsPassword(!hasPassword);
    setUnlinkError(null);
    setShowUnlinkModal(true);
  };

  // Google 연동 해제 실행
  const handleUnlinkGoogleConfirm = async (password?: string) => {
    setUnlinkLoading(true);
    setUnlinkError(null);

    try {
      // 비밀번호 설정이 필요한 경우 먼저 설정
      if (password && unlinkNeedsPassword) {
        await setPasswordForGoogleUser(password);
      }

      // Google 연동 해제
      await unlinkGoogle();

      // 성공 - 모달 닫기 및 상태 업데이트
      setShowUnlinkModal(false);
      setGoogleLinked(false);
      setSaveMessage({ type: 'success', text: t('settings_unlink_success') });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error: any) {
      console.error('Failed to unlink Google:', error);
      if (error.message === 'PASSWORD_REQUIRED') {
        setUnlinkNeedsPassword(true);
        setUnlinkError(t('settings_unlink_needs_password'));
      } else {
        setUnlinkError(error.message || t('settings_unlink_error'));
      }
    } finally {
      setUnlinkLoading(false);
    }
  };

  // Privacy 설정 저장
  const handleSavePrivacy = async () => {
    if (!user || !accessToken || !user.id) {
      setPrivacySaveMessage({ type: 'error', text: t('settings_save_error') });
      return;
    }

    setSaving(true);
    setPrivacySaveMessage(null);

    try {
      // profile과 introduce가 없으면 생성
      const existingProfile = user.profile || {};
      const existingIntroduce = existingProfile.introduce || {};

      const updatedUser: User = {
        ...user,
        profile: {
          ...existingProfile,
          introduce: {
            ...existingIntroduce,
            location: privacy.userLocation || undefined,
          },
        },
        setting: {
          ...user.setting,
          visibility: {
            scope: privacy.visibilityScope,
            elements: {
              email: privacy.showEmail,
              location: privacy.showLocation,
              activeStatus: privacy.showActivity,
            },
          },
        },
      };

      await updateUser(user.id, updatedUser, accessToken);

      // Refresh user data in context
      if (refreshUserData) {
        await refreshUserData();
      }

      // Store에 저장 완료 표시
      markPrivacySaved();
      setPrivacySaveMessage({ type: 'success', text: t('settings_save_success') });
      setTimeout(() => setPrivacySaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving privacy settings:', error);
      setPrivacySaveMessage({ type: 'error', text: t('settings_save_error') });
    } finally {
      setSaving(false);
    }
  };

  // Privacy 설정 취소 (원래 값으로 복원)
  const handleCancelPrivacy = () => {
    resetPrivacy();
    setPrivacySaveMessage(null);
  };

  // 역지오코딩: 좌표를 도시/국가로 변환 (BigDataCloud 무료 API)
  const reverseGeocode = useCallback(async (latitude: number, longitude: number): Promise<UserLocation> => {
    // 현재 언어 설정에 따라 localityLanguage 설정
    const lang = i18n.language === 'ko' ? 'ko' : 'en';
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=${lang}`
    );
    const data = await response.json();

    return {
      city: data.city || data.locality || data.principalSubdivision || '',
      country: data.countryName || '',
      countryCode: data.countryCode || '',
      latitude,
      longitude,
      updatedAt: new Date().toISOString(),
    };
  }, [i18n.language]);

  // 위치 동의 모달 열기
  const handleOpenLocationConsent = () => {
    setLocationError(null);
    setShowLocationConsentModal(true);
  };

  // 위치 동의 후 실제 위치 가져오기
  const handleGetLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError(t('settings_location_not_supported'));
      setShowLocationConsentModal(false);
      return;
    }

    setLocationLoading(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const location = await reverseGeocode(latitude, longitude);
          setUserLocation(location);
          // 위치 정보 동의 시 자동으로 공개 설정도 활성화
          setPrivacyField('showLocation', true);
          setLocationLoading(false);
          setShowLocationConsentModal(false);
        } catch (error) {
          setLocationError(t('settings_location_error'));
          setLocationLoading(false);
          setShowLocationConsentModal(false);
        }
      },
      (error) => {
        setLocationLoading(false);
        setShowLocationConsentModal(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError(t('settings_location_permission_denied'));
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError(t('settings_location_unavailable'));
            break;
          case error.TIMEOUT:
            setLocationError(t('settings_location_timeout'));
            break;
          default:
            setLocationError(t('settings_location_error'));
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // 5분 캐시
      }
    );
  };

  // 위치 삭제
  const handleClearLocation = () => {
    setUserLocation(null);
    setLocationError(null);
  };

  // 위치 표시 문자열
  const getLocationDisplayString = () => {
    if (!privacy.userLocation) return null;
    const parts = [];
    if (privacy.userLocation.city) parts.push(privacy.userLocation.city);
    if (privacy.userLocation.country) parts.push(privacy.userLocation.country);
    return parts.join(', ') || null;
  };

  const genres = [
    'literature', 'philosophy', 'psychology', 'history',
    'science', 'economics', 'politics', 'religion',
    'art', 'music', 'film', 'travel',
    'cooking', 'health', 'self_improvement', 'business'
  ];

  const tabs = [
    { id: 'profile' as SettingsTab, icon: 'ri-user-3-line', label: t('settings_tab_profile') },
    { id: 'security' as SettingsTab, icon: 'ri-shield-user-line', label: t('settings_tab_security') },
    { id: 'notifications' as SettingsTab, icon: 'ri-notification-3-line', label: t('settings_tab_notifications') },
    { id: 'privacy' as SettingsTab, icon: 'ri-lock-line', label: t('settings_tab_privacy') },
  ];

  if (!user) {
    return (
      <div className="settings-page">
        <div className="settings-container">
          <div className="settings-login-required">
            <p>{t('login_required')}</p>
            <button className="settings-login-btn" onClick={() => navigate('/login')}>
              {t('nav_login')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-container">
        {/* Header */}
        <div className="settings-header">
          <button className="settings-back-btn" onClick={() => navigate(-1)}>
            <i className="ri-arrow-left-line"></i>
            <span>{t('settings_back')}</span>
          </button>
          <h1 className="settings-title">{t('settings_page_title')}</h1>
          <p className="settings-subtitle">{t('settings_page_subtitle')}</p>
        </div>

        <div className="settings-layout">
          {/* Sidebar Navigation */}
          <div className="settings-sidebar">
            <div className="settings-nav">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <i className={tab.icon}></i>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="settings-content">
            <div className="settings-panel">
              {activeTab === 'profile' && (
                <div className="settings-form">
                  {/* Profile Info Section */}
                  <div className="settings-section-header">
                    <h2 className="settings-section-title">{t('settings_profile_info')}</h2>
                    <p className="settings-section-desc">{t('settings_profile_info_desc')}</p>
                  </div>

                  {/* Profile Photo */}
                  <div className="settings-field">
                    <label className="settings-label">{t('settings_profile_photo')}</label>
                    <div className="settings-photo-row">
                      <div className="settings-photo-avatar">
                        {displayPhotoUrl ? (
                          <img src={displayPhotoUrl} alt={user.username} />
                        ) : (
                          <i className="ri-user-line"></i>
                        )}
                        {isPhotoUploading && (
                          <div className="settings-photo-uploading">
                            <i className="ri-loader-4-line spinning"></i>
                          </div>
                        )}
                      </div>
                      <div className="settings-photo-actions">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          onChange={handlePhotoUpload}
                          style={{ display: 'none' }}
                        />
                        <button
                          className="settings-btn-secondary"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isPhotoUploading}
                        >
                          {isPhotoUploading ? (
                            <>
                              <i className="ri-loader-4-line spinning"></i>
                              {t('settings_uploading')}
                            </>
                          ) : (
                            t('settings_change_photo')
                          )}
                        </button>
                        {photo.custom && (
                          <button
                            className="settings-btn-danger"
                            onClick={handlePhotoDelete}
                            disabled={isPhotoUploading}
                          >
                            {t('settings_delete')}
                          </button>
                        )}
                        <p className="settings-photo-hint">{t('settings_photo_hint')}</p>
                        {photoError && (
                          <p className="settings-photo-error">{photoError}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Name Fields */}
                  <div className="settings-field-grid">
                    <div className="settings-field">
                      <label className="settings-label">{t('settings_display_name')}</label>
                      <input
                        type="text"
                        className="settings-input"
                        placeholder={t('settings_display_name_placeholder')}
                        value={profile.displayName}
                        onChange={(e) => setProfileField('displayName', e.target.value)}
                      />
                    </div>
                    <div className="settings-field">
                      <label className="settings-label">{t('settings_username')}</label>
                      <div className="settings-input-with-prefix">
                        <span className="settings-input-prefix">@</span>
                        <input
                          type="text"
                          className="settings-input"
                          placeholder="username"
                          value={profile.username}
                          onChange={(e) => setProfileField('username', e.target.value)}
                        />
                      </div>
                      <p className="settings-field-hint">{t('settings_username_hint')}</p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="settings-field">
                    <label className="settings-label">{t('settings_email')}</label>
                    <input
                      type="email"
                      className="settings-input"
                      placeholder="email@example.com"
                      value={email}
                      disabled
                    />
                  </div>

                  {/* Bio */}
                  <div className="settings-field">
                    <label className="settings-label">{t('settings_bio')}</label>
                    <textarea
                      className="settings-textarea"
                      rows={4}
                      maxLength={500}
                      placeholder={t('settings_bio_placeholder')}
                      value={profile.bio}
                      onChange={(e) => setProfileField('bio', e.target.value)}
                    />
                    <div className="settings-textarea-footer">
                      <p className="settings-field-hint">{t('settings_bio_hint')}</p>
                      <p className="settings-char-count">{profile.bio.length}/500</p>
                    </div>
                  </div>

                  {/* Location & Website */}
                  <div className="settings-field-grid">
                    <div className="settings-field">
                      <label className="settings-label">{t('settings_location')}</label>
                      <div className="settings-location-profile-picker">
                        {privacy.userLocation && getLocationDisplayString() ? (
                          <div className="settings-location-profile-display">
                            <div className="settings-location-profile-value">
                              <i className="ri-map-pin-line"></i>
                              <span>{getLocationDisplayString()}</span>
                            </div>
                            <div className="settings-location-profile-actions">
                              <button
                                type="button"
                                className="settings-btn-location-refresh"
                                onClick={handleOpenLocationConsent}
                                title={t('settings_location_update')}
                              >
                                <i className="ri-refresh-line"></i>
                              </button>
                              <button
                                type="button"
                                className="settings-btn-location-remove"
                                onClick={handleClearLocation}
                                title={t('settings_location_remove')}
                              >
                                <i className="ri-close-line"></i>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="settings-btn-get-location"
                            onClick={handleOpenLocationConsent}
                          >
                            <i className="ri-crosshair-2-line"></i>
                            {t('settings_location_get')}
                          </button>
                        )}
                        {locationError && (
                          <p className="settings-location-profile-error">{locationError}</p>
                        )}
                      </div>
                    </div>
                    <div className="settings-field">
                      <label className="settings-label">{t('settings_website')}</label>
                      <input
                        type="url"
                        className="settings-input"
                        placeholder="https://yourwebsite.com"
                        value={profile.website}
                        onChange={(e) => setProfileField('website', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Reading & Discussion Preferences */}
                  <div className="settings-divider">
                    <h3 className="settings-divider-title">{t('settings_reading_preferences')}</h3>
                  </div>

                  {/* Interest Genres */}
                  <div className="settings-field">
                    <label className="settings-label">{t('settings_interest_genres')}</label>
                    <p className="settings-field-hint-top">{t('settings_genres_hint')}</p>
                    <div className="settings-genre-grid">
                      {genres.map((genre) => (
                        <label key={genre} className="settings-checkbox-label">
                          <input
                            type="checkbox"
                            className="settings-checkbox"
                            checked={profile.selectedGenres.includes(genre)}
                            onChange={() => toggleGenre(genre)}
                          />
                          <span className={profile.selectedGenres.includes(genre) ? 'checked' : ''}>
                            {t(`settings_genre_${genre}`)}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="settings-field-hint">{t('settings_genres_selected', { count: profile.selectedGenres.length })}</p>
                  </div>

                  {/* Style & Time */}
                  <div className="settings-field-grid">
                    <div className="settings-field">
                      <label className="settings-label">{t('settings_reading_style')}</label>
                      <select
                        className="settings-select"
                        value={profile.readingStyle}
                        onChange={(e) => setProfileField('readingStyle', e.target.value)}
                      >
                        <option value="analytical">{t('settings_style_analytical')}</option>
                        <option value="emotional">{t('settings_style_emotional')}</option>
                        <option value="critical">{t('settings_style_critical')}</option>
                        <option value="creative">{t('settings_style_creative')}</option>
                        <option value="practical">{t('settings_style_practical')}</option>
                      </select>
                    </div>
                    <div className="settings-field">
                      <label className="settings-label">{t('settings_preferred_time')}</label>
                      <select
                        className="settings-select"
                        value={profile.preferredTime}
                        onChange={(e) => setProfileField('preferredTime', e.target.value)}
                      >
                        <option value="weekday_morning">{t('settings_time_weekday_morning')}</option>
                        <option value="weekday_afternoon">{t('settings_time_weekday_afternoon')}</option>
                        <option value="weekday_evening">{t('settings_time_weekday_evening')}</option>
                        <option value="weekend_morning">{t('settings_time_weekend_morning')}</option>
                        <option value="weekend_afternoon">{t('settings_time_weekend_afternoon')}</option>
                        <option value="weekend_evening">{t('settings_time_weekend_evening')}</option>
                        <option value="anytime">{t('settings_time_anytime')}</option>
                      </select>
                    </div>
                  </div>

                  {/* Size & AI */}
                  <div className="settings-field-grid">
                    <div className="settings-field">
                      <label className="settings-label">{t('settings_discussion_size')}</label>
                      <select
                        className="settings-select"
                        value={profile.discussionSize}
                        onChange={(e) => setProfileField('discussionSize', e.target.value)}
                      >
                        <option value="small">{t('settings_size_small')}</option>
                        <option value="medium">{t('settings_size_medium')}</option>
                        <option value="large">{t('settings_size_large')}</option>
                        <option value="xlarge">{t('settings_size_xlarge')}</option>
                        <option value="any">{t('settings_size_any')}</option>
                      </select>
                    </div>
                    <div className="settings-field">
                      <label className="settings-label">{t('settings_ai_usage')}</label>
                      <select
                        className="settings-select"
                        value={profile.aiUsage}
                        onChange={(e) => setProfileField('aiUsage', e.target.value)}
                      >
                        <option value="active">{t('settings_ai_active')}</option>
                        <option value="partial">{t('settings_ai_partial')}</option>
                        <option value="minimal">{t('settings_ai_minimal')}</option>
                        <option value="none">{t('settings_ai_none')}</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Interest Keywords */}
                  <div className="settings-field">
                    <label className="settings-label">{t('settings_interest_keywords')}</label>
                    <p className="settings-field-hint-top">{t('settings_keywords_hint')}</p>
                    <div className="settings-keywords-input-row">
                      <input
                        type="text"
                        className="settings-input"
                        placeholder={t('settings_keywords_placeholder')}
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={handleKeywordKeyDown}
                        maxLength={20}
                      />
                      <button
                        type="button"
                        className="settings-btn-add-keyword"
                        onClick={handleAddKeyword}
                        disabled={!keywordInput.trim() || profile.keywords.length >= 10}
                      >
                        <i className="ri-add-line"></i>
                        {t('settings_add')}
                      </button>
                    </div>
                    {profile.keywords.length > 0 && (
                      <div className="settings-keywords-tags">
                        {profile.keywords.map((keyword) => (
                          <span key={keyword} className="settings-keyword-tag">
                            {keyword}
                            <button
                              type="button"
                              className="settings-keyword-remove"
                              onClick={() => handleRemoveKeyword(keyword)}
                            >
                              <i className="ri-close-line"></i>
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="settings-field-hint">{t('settings_keywords_count', { count: profile.keywords.length })}</p>
                  </div>

                  {/* Monthly Goals */}
                  <div className="settings-field">
                    <label className="settings-label">{t('settings_monthly_goals')}</label>
                    <div className="settings-goals-grid">
                      <div className="settings-goal-item">
                        <label className="settings-goal-label">{t('settings_goal_participate')}</label>
                        <input
                          type="number"
                          className="settings-input"
                          min={0}
                          max={50}
                          value={profile.discussionGoal}
                          onChange={(e) => setProfileField('discussionGoal', Number(e.target.value))}
                        />
                        <p className="settings-field-hint">{t('settings_goal_participate_hint')}</p>
                      </div>
                      <div className="settings-goal-item">
                        <label className="settings-goal-label">{t('settings_goal_create')}</label>
                        <input
                          type="number"
                          className="settings-input"
                          min={0}
                          max={50}
                          value={profile.noteGoal}
                          onChange={(e) => setProfileField('noteGoal', Number(e.target.value))}
                        />
                        <p className="settings-field-hint">{t('settings_goal_create_hint')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="settings-actions">
                    {saveMessage && (
                      <div className={`settings-save-message ${saveMessage.type}`}>
                        {saveMessage.type === 'success' ? (
                          <i className="ri-check-line"></i>
                        ) : (
                          <i className="ri-error-warning-line"></i>
                        )}
                        <span>{saveMessage.text}</span>
                      </div>
                    )}
                    <button className="settings-btn-cancel" onClick={handleCancel} disabled={isSaving}>
                      {t('settings_cancel')}
                    </button>
                    <button className="settings-btn-save" onClick={handleSaveProfile} disabled={isSaving}>
                      {isSaving ? (
                        <>
                          <i className="ri-loader-4-line spinning"></i>
                          {t('settings_saving')}
                        </>
                      ) : (
                        t('settings_save')
                      )}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="settings-form">
                  <div className="settings-section-header">
                    <h2 className="settings-section-title">{t('settings_security_title')}</h2>
                    <p className="settings-section-desc">{t('settings_security_desc')}</p>
                  </div>

                  {/* Password Change & 2FA - Not Implemented */}
                  <div className="settings-not-implemented-wrapper">
                    <div className="settings-not-implemented-overlay">
                      <i className="ri-tools-line"></i>
                      <span>{t('settings_not_implemented')}</span>
                    </div>
                    <div className="settings-not-implemented-content">
                      {/* Password Change */}
                      <div className="settings-security-card">
                        <div className="settings-security-card-header">
                          <div className="settings-security-card-info">
                            <h3 className="settings-security-card-title">{t('settings_password_change')}</h3>
                            <p className="settings-security-card-desc">{t('settings_password_change_desc')}</p>
                          </div>
                          <button className="settings-btn-primary" disabled>{t('settings_change')}</button>
                        </div>
                        <p className="settings-security-card-meta">{t('settings_last_changed')}: -</p>
                      </div>

                      {/* 2FA */}
                      <div className="settings-security-card">
                        <div className="settings-security-card-header">
                          <div className="settings-security-card-info">
                            <h3 className="settings-security-card-title">{t('settings_2fa')}</h3>
                            <p className="settings-security-card-desc">{t('settings_2fa_desc')}</p>
                          </div>
                          <button className="settings-btn-accent" disabled>{t('settings_enable')}</button>
                        </div>
                        <div className="settings-security-recommend">
                          <i className="ri-shield-check-line"></i>
                          <span>{t('settings_recommended_security')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Connected Accounts */}
                  <div className="settings-field">
                    <h3 className="settings-connected-title">{t('settings_connected_accounts')}</h3>
                    <div className="settings-connected-list">
                      <div className="settings-connected-item">
                        <div className="settings-connected-item-left">
                          <div className={`settings-connected-icon google ${!googleLinked ? 'disabled' : ''}`}>
                            <i className="ri-google-fill"></i>
                          </div>
                          <div className="settings-connected-info">
                            <p className="settings-connected-name">Google</p>
                            <p className="settings-connected-email">
                              {googleLinked ? user?.email : t('settings_not_connected')}
                            </p>
                          </div>
                        </div>
                        {googleLinked ? (
                          <button
                            className="settings-btn-disconnect"
                            onClick={handleUnlinkGoogleClick}
                          >
                            {t('settings_disconnect')}
                          </button>
                        ) : (
                          <span className="settings-connected-status">
                            <i className="ri-check-line"></i>
                            {t('settings_disconnected')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="settings-danger-zone">
                    <h3 className="settings-danger-title">{t('settings_danger_zone')}</h3>
                    <div className="settings-danger-card">
                      <h4 className="settings-danger-card-title">{t('settings_delete_account')}</h4>
                      <p className="settings-danger-card-desc">{t('settings_delete_account_desc')}</p>
                      <button className="settings-btn-delete">{t('settings_delete_account')}</button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="settings-form">
                  <div className="settings-section-header">
                    <h2 className="settings-section-title">{t('settings_notifications_title')}</h2>
                    <p className="settings-section-desc">{t('settings_notifications_subtitle')}</p>
                  </div>

                  {/* Email Notifications */}
                  <div className="settings-field">
                    <h3 className="settings-notification-group-title">{t('settings_email_notifications')}</h3>
                    <div className="settings-notification-list">
                      <div className="settings-notification-item">
                        <div className="settings-notification-info">
                          <p className="settings-notification-name">{t('settings_notif_new_room')}</p>
                          <p className="settings-notification-desc">{t('settings_notif_new_room_desc')}</p>
                        </div>
                        <label className="settings-toggle">
                          <input type="checkbox" defaultChecked />
                          <span className="settings-toggle-slider"></span>
                        </label>
                      </div>

                      <div className="settings-notification-item">
                        <div className="settings-notification-info">
                          <p className="settings-notification-name">{t('settings_notif_reminder')}</p>
                          <p className="settings-notification-desc">{t('settings_notif_reminder_desc')}</p>
                        </div>
                        <label className="settings-toggle">
                          <input type="checkbox" defaultChecked />
                          <span className="settings-toggle-slider"></span>
                        </label>
                      </div>

                      <div className="settings-notification-item">
                        <div className="settings-notification-info">
                          <p className="settings-notification-name">{t('settings_notif_ai_summary')}</p>
                          <p className="settings-notification-desc">{t('settings_notif_ai_summary_desc')}</p>
                        </div>
                        <label className="settings-toggle">
                          <input type="checkbox" defaultChecked />
                          <span className="settings-toggle-slider"></span>
                        </label>
                      </div>

                      <div className="settings-notification-item">
                        <div className="settings-notification-info">
                          <p className="settings-notification-name">{t('settings_notif_message')}</p>
                          <p className="settings-notification-desc">{t('settings_notif_message_desc')}</p>
                        </div>
                        <label className="settings-toggle">
                          <input type="checkbox" />
                          <span className="settings-toggle-slider"></span>
                        </label>
                      </div>

                      <div className="settings-notification-item">
                        <div className="settings-notification-info">
                          <p className="settings-notification-name">{t('settings_notif_newsletter')}</p>
                          <p className="settings-notification-desc">{t('settings_notif_newsletter_desc')}</p>
                        </div>
                        <label className="settings-toggle">
                          <input type="checkbox" defaultChecked />
                          <span className="settings-toggle-slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="settings-actions">
                    <button className="settings-btn-cancel">{t('settings_cancel')}</button>
                    <button className="settings-btn-save">{t('settings_save')}</button>
                  </div>
                </div>
              )}

              {activeTab === 'privacy' && (
                <div className="settings-form">
                  <div className="settings-section-header">
                    <h2 className="settings-section-title">{t('settings_privacy_title')}</h2>
                    <p className="settings-section-desc">{t('settings_privacy_subtitle')}</p>
                  </div>

                  {/* Profile Visibility */}
                  <div className="settings-field">
                    <h3 className="settings-privacy-group-title">{t('settings_profile_visibility')}</h3>
                    <div className="settings-radio-list">
                      <label className="settings-radio-item">
                        <input
                          type="radio"
                          name="visibility"
                          value="public"
                          checked={privacy.visibilityScope === 'public'}
                          onChange={() => setPrivacyField('visibilityScope', 'public')}
                          className="settings-radio"
                        />
                        <div className="settings-radio-info">
                          <p className="settings-radio-name">{t('settings_visibility_public')}</p>
                          <p className="settings-radio-desc">{t('settings_visibility_public_desc')}</p>
                        </div>
                      </label>
                      <label className="settings-radio-item">
                        <input
                          type="radio"
                          name="visibility"
                          value="users"
                          checked={privacy.visibilityScope === 'users'}
                          onChange={() => setPrivacyField('visibilityScope', 'users')}
                          className="settings-radio"
                        />
                        <div className="settings-radio-info">
                          <p className="settings-radio-name">{t('settings_visibility_members')}</p>
                          <p className="settings-radio-desc">{t('settings_visibility_members_desc')}</p>
                        </div>
                      </label>
                      <label className="settings-radio-item">
                        <input
                          type="radio"
                          name="visibility"
                          value="private"
                          checked={privacy.visibilityScope === 'private'}
                          onChange={() => setPrivacyField('visibilityScope', 'private')}
                          className="settings-radio"
                        />
                        <div className="settings-radio-info">
                          <p className="settings-radio-name">{t('settings_visibility_private')}</p>
                          <p className="settings-radio-desc">{t('settings_visibility_private_desc')}</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Information Display */}
                  <div className="settings-field">
                    <h3 className="settings-privacy-group-title">{t('settings_info_display')}</h3>
                    <div className="settings-notification-list">
                      <div className="settings-notification-item">
                        <div className="settings-notification-info">
                          <p className="settings-notification-name">{t('settings_show_email')}</p>
                          <p className="settings-notification-desc">{t('settings_show_email_desc')}</p>
                        </div>
                        <label className="settings-toggle">
                          <input
                            type="checkbox"
                            checked={privacy.showEmail}
                            onChange={(e) => setPrivacyField('showEmail', e.target.checked)}
                          />
                          <span className="settings-toggle-slider"></span>
                        </label>
                      </div>

                      <div className="settings-notification-item">
                        <div className="settings-notification-info">
                          <p className="settings-notification-name">{t('settings_show_location')}</p>
                          <p className="settings-notification-desc">{t('settings_show_location_desc')}</p>
                        </div>
                        <label className="settings-toggle">
                          <input
                            type="checkbox"
                            checked={privacy.showLocation}
                            onChange={(e) => setPrivacyField('showLocation', e.target.checked)}
                          />
                          <span className="settings-toggle-slider"></span>
                        </label>
                      </div>

                      {/* Location Picker */}
                      {privacy.showLocation && (
                        <div className="settings-location-picker">
                          <div className="settings-location-current">
                            <div className="settings-location-icon">
                              <i className="ri-map-pin-line"></i>
                            </div>
                            <div className="settings-location-info">
                              <p className="settings-location-label">{t('settings_your_location')}</p>
                              {privacy.userLocation && getLocationDisplayString() ? (
                                <p className="settings-location-value">{getLocationDisplayString()}</p>
                              ) : (
                                <p className="settings-location-empty">{t('settings_location_not_set')}</p>
                              )}
                            </div>
                          </div>
                          <div className="settings-location-actions">
                            <button
                              className="settings-btn-location"
                              onClick={handleGetLocation}
                              disabled={isLocationLoading}
                            >
                              {isLocationLoading ? (
                                <>
                                  <i className="ri-loader-4-line spinning"></i>
                                  {t('settings_location_loading')}
                                </>
                              ) : (
                                <>
                                  <i className="ri-crosshair-2-line"></i>
                                  {privacy.userLocation ? t('settings_location_update') : t('settings_location_get')}
                                </>
                              )}
                            </button>
                            {privacy.userLocation && (
                              <button
                                className="settings-btn-location-clear"
                                onClick={handleClearLocation}
                                disabled={isLocationLoading}
                              >
                                <i className="ri-close-line"></i>
                              </button>
                            )}
                          </div>
                          {locationError && (
                            <div className="settings-location-error">
                              <i className="ri-error-warning-line"></i>
                              <span>{locationError}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="settings-notification-item">
                        <div className="settings-notification-info">
                          <p className="settings-notification-name">{t('settings_show_activity')}</p>
                          <p className="settings-notification-desc">{t('settings_show_activity_desc')}</p>
                        </div>
                        <label className="settings-toggle">
                          <input
                            type="checkbox"
                            checked={privacy.showActivity}
                            onChange={(e) => setPrivacyField('showActivity', e.target.checked)}
                          />
                          <span className="settings-toggle-slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Data Download - Disabled */}
                  <div className="settings-data-download-card disabled">
                    <div className="settings-data-download-info">
                      <h3 className="settings-data-download-title">{t('settings_data_download')}</h3>
                      <p className="settings-data-download-desc">{t('settings_data_download_desc')}</p>
                    </div>
                    <button className="settings-btn-download" disabled>
                      <i className="ri-time-line"></i>
                      {t('settings_coming_soon')}
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="settings-actions">
                    {privacySaveMessage && (
                      <div className={`settings-save-message ${privacySaveMessage.type}`}>
                        {privacySaveMessage.type === 'success' ? (
                          <i className="ri-check-line"></i>
                        ) : (
                          <i className="ri-error-warning-line"></i>
                        )}
                        <span>{privacySaveMessage.text}</span>
                      </div>
                    )}
                    <button
                      className="settings-btn-cancel"
                      onClick={handleCancelPrivacy}
                      disabled={isSaving}
                    >
                      {t('settings_cancel')}
                    </button>
                    <button
                      className="settings-btn-save"
                      onClick={handleSavePrivacy}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <i className="ri-loader-4-line spinning"></i>
                          {t('settings_saving')}
                        </>
                      ) : (
                        t('settings_save')
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Google 연동 해제 모달 */}
      <UnlinkGoogleModal
        isOpen={showUnlinkModal}
        onClose={() => setShowUnlinkModal(false)}
        onConfirm={handleUnlinkGoogleConfirm}
        needsPassword={unlinkNeedsPassword}
        isLoading={unlinkLoading}
        error={unlinkError}
      />

      {/* 위치 정보 동의 모달 */}
      <LocationConsentModal
        isOpen={showLocationConsentModal}
        onClose={() => setShowLocationConsentModal(false)}
        onConfirm={handleGetLocation}
        isLoading={isLocationLoading}
      />
    </div>
  );
};

export default Settings;
