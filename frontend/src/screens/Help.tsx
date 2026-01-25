import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './styles/Help.css';

const Help: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !message.trim()) {
      return;
    }

    const recipient = 'wnsdy98@gmail.com';
    const subject = encodeURIComponent('[BookClub] 문의 사항');
    const body = encodeURIComponent(
      `보낸 사람: ${email}\n\n${message}`
    );

    // Open mailto link
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;

    setSubmitStatus('success');
    setEmail('');
    setMessage('');
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
              disabled={!email.trim() || !message.trim()}
            >
              <i className="ri-send-plane-line"></i>
              <span>{t('help_contact_submit')}</span>
            </button>

            {submitStatus === 'success' && (
              <div className="help-submit-message success">
                <i className="ri-check-line"></i>
                <span>{t('help_contact_success')}</span>
              </div>
            )}
          </form>
        </section>
      </div>
    </div>
  );
};

export default Help;
