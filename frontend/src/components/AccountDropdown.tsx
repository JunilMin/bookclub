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

  // Default avatar as data URI (simple user icon)
  const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiI+PC9wYXRoPjxjaXJjbGUgY3g9IjEyIiBjeT0iNyIgcj0iNCI+PC9jaXJjbGU+PC9zdmc+';
  const avatarUrl = user.photoUrl || defaultAvatar;

  return (
    <div className="account-dropdown" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        className="account-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <img
          src={avatarUrl}
          alt={user.username}
          className="account-avatar"
          onError={(e) => {
            (e.target as HTMLImageElement).src = defaultAvatar;
          }}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="dropdown-menu">
          {/* User Summary Section */}
          
          <div className="dropdown-section user-summary" onClick={() => handleNavigation('/profile')}>
            <img
              src={avatarUrl}
              alt={user.username}
              className="summary-avatar"
              onError={(e) => {
                (e.target as HTMLImageElement).src = defaultAvatar;
              }}
            />
            <div className="summary-info">
              <span className="summary-username">{user.username}</span>
              <span className="summary-rating">{user.rating || 0}</span>
            </div>
          </div>

          <div className="dropdown-divider" />

          {/* Core Actions Section */}
          <div className="dropdown-section">
            <span className="section-title">{t('dropdown_core_action_title')}</span>
            <button
              className="dropdown-item"
              onClick={() => handleNavigation('/profile')}
            >
              <span className="item-icon">&#128100;</span>
              <span>{t('dropdown_my_profile')}</span>
            </button>
            <button
              className="dropdown-item"
              onClick={() => handleNavigation('/?filter=created')}
            >
              <span className="item-icon">&#128221;</span>
              <span>{t('dropdown_my_created_meetings')}</span>
            </button>
            <button
              className="dropdown-item"
              onClick={() => handleNavigation('/?filter=participating')}
            >
              <span className="item-icon">&#128218;</span>
              <span>{t('dropdown_participating_meetings')}</span>
            </button>
            <button
              className="dropdown-item cta-button"
              onClick={() => handleNavigation('/create')}
            >
              <span className="item-icon">&#10133;</span>
              <span>{t('dropdown_create_discussion')}</span>
            </button>
          </div>

          <div className="dropdown-divider" />

          {/* Knowledge & Records Section */}
          <div className="dropdown-section">
            <span className="section-title">{t('dropdown_knowledge_records_title')}</span>
            <button
              className="dropdown-item"
              onClick={() => handleNavigation('/notes')}
            >
              <span className="item-icon">&#128196;</span>
              <span>{t('dropdown_discussion_notes')}</span>
            </button>
            <button
              className="dropdown-item"
              onClick={() => handleNavigation('/favorites')}
            >
              <span className="item-icon">&#11088;</span>
              <span>{t('dropdown_favorite_meetings')}</span>
            </button>
          </div>

          <div className="dropdown-divider" />

          {/* Settings Section */}
          <div className="dropdown-section">
            <span className="section-title">{t('dropdown_setting_management_title')}</span>
            <button
              className="dropdown-item"
              onClick={() => handleNavigation('/profile#settings')}
            >
              <span className="item-icon">&#9881;</span>
              <span>{t('dropdown_account_settings')}</span>
            </button>
            <button
              className="dropdown-item"
              onClick={() => handleNavigation('/reputation')}
            >
              <span className="item-icon">&#128202;</span>
              <span>{t('dropdown_reputation_activity')}</span>
            </button>
          </div>

          <div className="dropdown-divider" />

          {/* Support Section */}
          <div className="dropdown-section">
            <button
              className="dropdown-item"
              onClick={() => handleNavigation('/help')}
            >
              <span className="item-icon">&#10067;</span>
              <span>{t('dropdown_help_faq')}</span>
            </button>
            <button
              className="dropdown-item"
              onClick={() => handleNavigation('/feedback')}
            >
              <span className="item-icon">&#128172;</span>
              <span>{t('dropdown_send_feedback')}</span>
            </button>
          </div>

          <div className="dropdown-divider" />

          {/* Logout */}
          <div className="dropdown-section">
            <button
              className="dropdown-item logout-item"
              onClick={handleLogoutClick}
            >
              <span className="item-icon">&#128682;</span>
              <span>{t('dropdown_logout')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountDropdown;
