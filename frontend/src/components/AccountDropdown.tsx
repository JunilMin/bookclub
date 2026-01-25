import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext/AuthContext';
import './styles/AccountDropdown.css';

const AccountDropdown: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, handleLogout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation (Escape to close)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleLogoutClick = async () => {
    try {
      setIsOpen(false);
      await handleLogout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleNavigation = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  if (!user) return null;

  return (
    <div className="account-dropdown" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        className="account-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {user.photoUrl ? (
          <img
            src={user.photoUrl}
            alt={user.username}
            className="account-avatar"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="account-avatar-placeholder">
            <i className="ri-user-line"></i>
          </div>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="dropdown-menu">
          {/* User Summary Section */}
          <div className="dropdown-user-summary" onClick={() => handleNavigation('/profile')}>
            <div className="user-summary-header">
              <div className="user-avatar-wrapper">
                {user.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={user.username}
                    className="user-avatar"
                  />
                ) : (
                  <i className="ri-user-line"></i>
                )}
              </div>
              <div className="user-info">
                <span className="user-name">{user.username}</span>
                <span className="user-email">@{user.username?.toLowerCase().replace(/\s/g, '')}</span>
              </div>
            </div>
          </div>

          {/* Core Actions Section */}
          <div className="dropdown-section">
            <span className="section-title">{t('dropdown_core_action_title')}</span>
            <button
              className="dropdown-item"
              onClick={() => handleNavigation('/profile')}
            >
              <div className="item-icon-wrapper">
                <i className="ri-user-3-line"></i>
              </div>
              <span>{t('dropdown_my_profile')}</span>
            </button>
            <button
              className="dropdown-item"
              onClick={() => handleNavigation('/?filter=created')}
            >
              <div className="item-icon-wrapper">
                <i className="ri-calendar-check-line"></i>
              </div>
              <span>{t('dropdown_my_created_meetings')}</span>
            </button>
            <button
              className="dropdown-item"
              onClick={() => handleNavigation('/?filter=participating')}
            >
              <div className="item-icon-wrapper">
                <i className="ri-group-line"></i>
              </div>
              <span>{t('dropdown_participating_meetings')}</span>
            </button>
            <button
              className="dropdown-item cta-button"
              onClick={() => handleNavigation('/create')}
            >
              <div className="item-icon-wrapper cta-icon">
                <i className="ri-add-circle-line"></i>
              </div>
              <span>{t('dropdown_create_discussion')}</span>
            </button>
          </div>

          {/* Knowledge & Records Section */}
          <div className="dropdown-section">
            <span className="section-title">{t('dropdown_knowledge_records_title')}</span>
            <button
              className="dropdown-item"
              onClick={() => handleNavigation('/notes')}
            >
              <div className="item-icon-simple">
                <i className="ri-file-text-line"></i>
              </div>
              <span>{t('dropdown_discussion_notes')}</span>
            </button>
            <button
              className="dropdown-item"
              onClick={() => handleNavigation('/favorites')}
            >
              <div className="item-icon-simple">
                <i className="ri-bookmark-3-line"></i>
              </div>
              <span>{t('dropdown_favorite_meetings')}</span>
            </button>
          </div>

          {/* Settings Section */}
          <div className="dropdown-section">
            <span className="section-title">{t('dropdown_setting_management_title')}</span>
            <button
              className="dropdown-item"
              onClick={() => handleNavigation('/settings')}
            >
              <div className="item-icon-simple">
                <i className="ri-settings-3-line"></i>
              </div>
              <span>{t('dropdown_account_settings')}</span>
            </button>
            <button
              className="dropdown-item"
              onClick={() => handleNavigation('/reputation')}
            >
              <div className="item-icon-simple">
                <i className="ri-medal-line"></i>
              </div>
              <span>{t('dropdown_reputation_activity')}</span>
            </button>
          </div>

          {/* Support & Logout Section */}
          <div className="dropdown-section">
            <button
              className="dropdown-item"
              onClick={() => handleNavigation('/help')}
            >
              <div className="item-icon-simple">
                <i className="ri-question-line"></i>
              </div>
              <span>{t('dropdown_help_faq')}</span>
            </button>
            <button
              className="dropdown-item logout-item"
              onClick={handleLogoutClick}
            >
              <div className="item-icon-simple">
                <i className="ri-logout-box-line"></i>
              </div>
              <span>{t('dropdown_logout')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountDropdown;
