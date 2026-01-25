import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext/AuthContext';
import './styles/Settings.css';

type SettingsTab = 'profile' | 'security' | 'notifications' | 'privacy';

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [bio, setBio] = useState('');

  // Form states
  const [displayName, setDisplayName] = useState(user?.username || '');
  const [username, setUsername] = useState(user?.username || '');
  const [email] = useState(user?.email || '');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');

  // Preferences
  const [selectedGenres, setSelectedGenres] = useState<string[]>(['literature', 'philosophy', 'psychology', 'history']);
  const [readingStyle, setReadingStyle] = useState('analytical');
  const [preferredTime, setPreferredTime] = useState('weekend_afternoon');
  const [discussionSize, setDiscussionSize] = useState('medium');
  const [aiUsage, setAiUsage] = useState('active');

  // Goals
  const [discussionGoal, setDiscussionGoal] = useState(15);
  const [noteGoal, setNoteGoal] = useState(10);
  const [aiSummaryGoal, setAiSummaryGoal] = useState(5);

  const genres = [
    'literature', 'philosophy', 'psychology', 'history',
    'science', 'economics', 'politics', 'religion',
    'art', 'music', 'film', 'travel',
    'cooking', 'health', 'self_improvement', 'business'
  ];

  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genre));
    } else if (selectedGenres.length < 8) {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

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
                        {user.photoUrl ? (
                          <img src={user.photoUrl} alt={user.username} />
                        ) : (
                          <i className="ri-user-line"></i>
                        )}
                      </div>
                      <div className="settings-photo-actions">
                        <button className="settings-btn-secondary">{t('settings_change_photo')}</button>
                        <button className="settings-btn-danger">{t('settings_delete')}</button>
                        <p className="settings-photo-hint">{t('settings_photo_hint')}</p>
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
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
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
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
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
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                    />
                    <div className="settings-textarea-footer">
                      <p className="settings-field-hint">{t('settings_bio_hint')}</p>
                      <p className="settings-char-count">{bio.length}/500</p>
                    </div>
                  </div>

                  {/* Location & Website */}
                  <div className="settings-field-grid">
                    <div className="settings-field">
                      <label className="settings-label">{t('settings_location')}</label>
                      <input
                        type="text"
                        className="settings-input"
                        placeholder={t('settings_location_placeholder')}
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                      />
                    </div>
                    <div className="settings-field">
                      <label className="settings-label">{t('settings_website')}</label>
                      <input
                        type="url"
                        className="settings-input"
                        placeholder="https://yourwebsite.com"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
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
                            checked={selectedGenres.includes(genre)}
                            onChange={() => toggleGenre(genre)}
                          />
                          <span className={selectedGenres.includes(genre) ? 'checked' : ''}>
                            {t(`settings_genre_${genre}`)}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="settings-field-hint">{t('settings_genres_selected', { count: selectedGenres.length })}</p>
                  </div>

                  {/* Style & Time */}
                  <div className="settings-field-grid">
                    <div className="settings-field">
                      <label className="settings-label">{t('settings_reading_style')}</label>
                      <select
                        className="settings-select"
                        value={readingStyle}
                        onChange={(e) => setReadingStyle(e.target.value)}
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
                        value={preferredTime}
                        onChange={(e) => setPreferredTime(e.target.value)}
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
                        value={discussionSize}
                        onChange={(e) => setDiscussionSize(e.target.value)}
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
                        value={aiUsage}
                        onChange={(e) => setAiUsage(e.target.value)}
                      >
                        <option value="active">{t('settings_ai_active')}</option>
                        <option value="partial">{t('settings_ai_partial')}</option>
                        <option value="minimal">{t('settings_ai_minimal')}</option>
                        <option value="none">{t('settings_ai_none')}</option>
                      </select>
                    </div>
                  </div>

                  {/* Monthly Goals */}
                  <div className="settings-field">
                    <label className="settings-label">{t('settings_monthly_goals')}</label>
                    <div className="settings-goals-grid">
                      <div className="settings-goal-item">
                        <label className="settings-goal-label">{t('settings_goal_discussion')}</label>
                        <input
                          type="number"
                          className="settings-input"
                          min={1}
                          max={50}
                          value={discussionGoal}
                          onChange={(e) => setDiscussionGoal(Number(e.target.value))}
                        />
                        <p className="settings-field-hint">{t('settings_goal_discussion_hint')}</p>
                      </div>
                      <div className="settings-goal-item">
                        <label className="settings-goal-label">{t('settings_goal_notes')}</label>
                        <input
                          type="number"
                          className="settings-input"
                          min={1}
                          max={100}
                          value={noteGoal}
                          onChange={(e) => setNoteGoal(Number(e.target.value))}
                        />
                        <p className="settings-field-hint">{t('settings_goal_notes_hint')}</p>
                      </div>
                      <div className="settings-goal-item">
                        <label className="settings-goal-label">{t('settings_goal_ai_summary')}</label>
                        <input
                          type="number"
                          className="settings-input"
                          min={1}
                          max={30}
                          value={aiSummaryGoal}
                          onChange={(e) => setAiSummaryGoal(Number(e.target.value))}
                        />
                        <p className="settings-field-hint">{t('settings_goal_ai_hint')}</p>
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

              {activeTab === 'security' && (
                <div className="settings-form">
                  <div className="settings-section-header">
                    <h2 className="settings-section-title">{t('settings_security_title')}</h2>
                    <p className="settings-section-desc">{t('settings_security_desc')}</p>
                  </div>

                  {/* Password Change */}
                  <div className="settings-security-card">
                    <div className="settings-security-card-header">
                      <div className="settings-security-card-info">
                        <h3 className="settings-security-card-title">{t('settings_password_change')}</h3>
                        <p className="settings-security-card-desc">{t('settings_password_change_desc')}</p>
                      </div>
                      <button className="settings-btn-primary">{t('settings_change')}</button>
                    </div>
                    <p className="settings-security-card-meta">{t('settings_last_changed')}: 2024년 11월 15일</p>
                  </div>

                  {/* 2FA */}
                  <div className="settings-security-card">
                    <div className="settings-security-card-header">
                      <div className="settings-security-card-info">
                        <h3 className="settings-security-card-title">{t('settings_2fa')}</h3>
                        <p className="settings-security-card-desc">{t('settings_2fa_desc')}</p>
                      </div>
                      <button className="settings-btn-accent">{t('settings_enable')}</button>
                    </div>
                    <div className="settings-security-recommend">
                      <i className="ri-shield-check-line"></i>
                      <span>{t('settings_recommended_security')}</span>
                    </div>
                  </div>

                  {/* Connected Accounts */}
                  <div className="settings-field">
                    <h3 className="settings-connected-title">{t('settings_connected_accounts')}</h3>
                    <div className="settings-connected-list">
                      <div className="settings-connected-item">
                        <div className="settings-connected-item-left">
                          <div className="settings-connected-icon google">
                            <i className="ri-google-fill"></i>
                          </div>
                          <div className="settings-connected-info">
                            <p className="settings-connected-name">Google</p>
                            <p className="settings-connected-email">{user?.email || 'sarah.mitchell@gmail.com'}</p>
                          </div>
                        </div>
                        <button className="settings-btn-disconnect">{t('settings_disconnect')}</button>
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
                        <input type="radio" name="visibility" value="public" defaultChecked className="settings-radio" />
                        <div className="settings-radio-info">
                          <p className="settings-radio-name">{t('settings_visibility_public')}</p>
                          <p className="settings-radio-desc">{t('settings_visibility_public_desc')}</p>
                        </div>
                      </label>
                      <label className="settings-radio-item">
                        <input type="radio" name="visibility" value="members" className="settings-radio" />
                        <div className="settings-radio-info">
                          <p className="settings-radio-name">{t('settings_visibility_members')}</p>
                          <p className="settings-radio-desc">{t('settings_visibility_members_desc')}</p>
                        </div>
                      </label>
                      <label className="settings-radio-item">
                        <input type="radio" name="visibility" value="private" className="settings-radio" />
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
                          <input type="checkbox" />
                          <span className="settings-toggle-slider"></span>
                        </label>
                      </div>

                      <div className="settings-notification-item">
                        <div className="settings-notification-info">
                          <p className="settings-notification-name">{t('settings_show_location')}</p>
                          <p className="settings-notification-desc">{t('settings_show_location_desc')}</p>
                        </div>
                        <label className="settings-toggle">
                          <input type="checkbox" defaultChecked />
                          <span className="settings-toggle-slider"></span>
                        </label>
                      </div>

                      <div className="settings-notification-item">
                        <div className="settings-notification-info">
                          <p className="settings-notification-name">{t('settings_show_activity')}</p>
                          <p className="settings-notification-desc">{t('settings_show_activity_desc')}</p>
                        </div>
                        <label className="settings-toggle">
                          <input type="checkbox" defaultChecked />
                          <span className="settings-toggle-slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Data Download */}
                  <div className="settings-data-download-card">
                    <div className="settings-data-download-info">
                      <h3 className="settings-data-download-title">{t('settings_data_download')}</h3>
                      <p className="settings-data-download-desc">{t('settings_data_download_desc')}</p>
                    </div>
                    <button className="settings-btn-download">{t('settings_download')}</button>
                  </div>

                  {/* Action Buttons */}
                  <div className="settings-actions">
                    <button className="settings-btn-cancel">{t('settings_cancel')}</button>
                    <button className="settings-btn-save">{t('settings_save')}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
