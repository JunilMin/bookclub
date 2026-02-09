import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
              <span className="footer-logo-text">Mamalias</span>
            </Link>
            <p className="footer-description">
              {t('footer_description')}
            </p>
            <div className="footer-social">
              <a href="#" className="footer-social-link" aria-label="Twitter">
                <i className="ri-twitter-fill"></i>
              </a>
              <a href="#" className="footer-social-link" aria-label="Facebook">
                <i className="ri-facebook-fill"></i>
              </a>
              <a href="#" className="footer-social-link" aria-label="Instagram">
                <i className="ri-instagram-fill"></i>
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div className="footer-section">
            <h4 className="footer-section-title">{t('footer_product')}</h4>
            <ul className="footer-links">
              <li>
                <Link to="/">{t('footer_browse_rooms')}</Link>
              </li>
              <li>
                <Link to="/create">{t('footer_create_room')}</Link>
              </li>
              <li>
                <Link to="/about">{t('footer_ai_features')}</Link>
              </li>
              <li>
                <Link to="/about#pricing">{t('footer_pricing')}</Link>
              </li>
            </ul>
          </div>

          {/* Support Links */}
          <div className="footer-section">
            <h4 className="footer-section-title">{t('footer_support')}</h4>
            <ul className="footer-links">
              <li>
                <Link to="/help">{t('footer_faq')}</Link>
              </li>
              <li>
                <Link to="/help">{t('footer_contact')}</Link>
              </li>
              <li>
                <Link to="/revolution">{t('footer_suggestion')}</Link>
              </li>
              <li>
                <Link to="/about">{t('footer_about')}</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <p className="footer-copyright">
            © {currentYear} Mamalias. All rights reserved.
          </p>
          <div className="footer-bottom-links">
            <a href="#privacy">{t('footer_privacy')}</a>
            <a href="#terms">{t('footer_terms')}</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
