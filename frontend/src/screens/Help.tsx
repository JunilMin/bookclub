import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { submitHelpMessage } from '../api/help';
import './styles/Help.css';

const Help: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !message.trim()) {
      return;
    }

    setSubmitStatus('loading');

    try {
      await submitHelpMessage(email.trim(), message.trim());
      setSubmitStatus('success');
      setEmail('');
      setMessage('');
    } catch {
      setSubmitStatus('error');
    }
  };

  return (
    <div className="help-page">
      <div className="help-container">
        {/* Header */}
        <div className="help-header">
          <h1>{t('help_title')}</h1>
          <p>{t('help_subtitle')}</p>
        </div>

        {/* FAQ Section */}
        <section className="help-faq-section">
          <h2>{t('about_pricing_faq_title')}</h2>
          <div className="help-faq-list">
            <details className="help-faq-item">
              <summary>
                <span>{t('about_pricing_faq_1_q')}</span>
                <i className="ri-arrow-down-s-line"></i>
              </summary>
              <p>{t('about_pricing_faq_1_a')}</p>
            </details>
            <details className="help-faq-item">
              <summary>
                <span>{t('about_pricing_faq_2_q')}</span>
                <i className="ri-arrow-down-s-line"></i>
              </summary>
              <p>{t('about_pricing_faq_2_a')}</p>
            </details>
            <details className="help-faq-item">
              <summary>
                <span>{t('about_pricing_faq_3_q')}</span>
                <i className="ri-arrow-down-s-line"></i>
              </summary>
              <p>{t('about_pricing_faq_3_a')}</p>
            </details>
            <details className="help-faq-item">
              <summary>
                <span>{t('about_pricing_faq_4_q')}</span>
                <i className="ri-arrow-down-s-line"></i>
              </summary>
              <p>{t('about_pricing_faq_4_a')}</p>
            </details>
          </div>
        </section>

        {/* Contact Form Section */}
        <section className="help-contact-section">
          <h2>{t('help_contact_title')}</h2>
          <p className="help-contact-subtitle">{t('help_contact_subtitle')}</p>

          <form className="help-contact-form" onSubmit={handleSubmit}>
            <div className="help-form-group">
              <label htmlFor="email">{t('help_contact_email_label')}</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('help_contact_email_placeholder')}
                required
              />
            </div>

            <div className="help-form-group">
              <label htmlFor="message">{t('help_contact_message_label')}</label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('help_contact_message_placeholder')}
                rows={6}
                required
              />
            </div>

            <button
              type="submit"
              className="help-submit-btn"
              disabled={!email.trim() || !message.trim() || submitStatus === 'loading'}
            >
              {submitStatus === 'loading' ? (
                <i className="ri-loader-4-line ri-spin"></i>
              ) : (
                <i className="ri-send-plane-line"></i>
              )}
              <span>{t('help_contact_submit')}</span>
            </button>

            {submitStatus === 'success' && (
              <div className="help-submit-message success">
                <i className="ri-check-line"></i>
                <span>{t('help_contact_success')}</span>
              </div>
            )}

            {submitStatus === 'error' && (
              <div className="help-submit-message error">
                <i className="ri-error-warning-line"></i>
                <span>{t('help_contact_error')}</span>
              </div>
            )}
          </form>
        </section>
      </div>
    </div>
  );
};

export default Help;
