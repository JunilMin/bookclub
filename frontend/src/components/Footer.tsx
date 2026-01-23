import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiBook, FiMail, FiMessageSquare, FiHelpCircle } from 'react-icons/fi';
import './styles/Footer.css';

const Footer: React.FC = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-grid">
          {/* Brand Section */}
          <div className="footer-brand">
            <Link to="/" className="footer-logo">
              <div className="footer-logo-icon">
                <FiBook size={24} />
              </div>
              <span className="footer-logo-text">BookClub</span>
            </Link>
            <p className="footer-description">
              {t('footer_description')}
            </p>
          </div>

          {/* Quick Links */}
          <div className="footer-section">
            <h4 className="footer-section-title">{t('footer_quick_links')}</h4>
            <ul className="footer-links">
              <li>
                <Link to="/">{t('footer_browse_rooms')}</Link>
              </li>
              <li>
                <Link to="/create">{t('footer_create_room')}</Link>
              </li>
              <li>
                <Link to="/profile">{t('footer_my_profile')}</Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="footer-section">
            <h4 className="footer-section-title">{t('footer_support')}</h4>
            <ul className="footer-links">
              <li>
                <a href="#help">
                  <FiHelpCircle size={14} />
                  <span>{t('footer_help_center')}</span>
                </a>
              </li>
              <li>
                <a href="#contact">
                  <FiMail size={14} />
                  <span>{t('footer_contact')}</span>
                </a>
              </li>
              <li>
                <a href="#feedback">
                  <FiMessageSquare size={14} />
                  <span>{t('footer_feedback')}</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="footer-section">
            <h4 className="footer-section-title">{t('footer_legal')}</h4>
            <ul className="footer-links">
              <li>
                <a href="#terms">{t('footer_terms')}</a>
              </li>
              <li>
                <a href="#privacy">{t('footer_privacy')}</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <p className="footer-copyright">
            © {currentYear} BookClub. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
