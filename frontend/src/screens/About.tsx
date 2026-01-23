import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getUserCount } from '../api/user';
import './styles/About.css';
import './styles/Board.css';

function About() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [userCount, setUserCount] = useState<number>(0);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    const fetchUserCount = async () => {
      const count = await getUserCount();
      setUserCount(count);
    };
    fetchUserCount();
  }, []);

  return (
    <div className="about-page">
      {/* Hero Section */}
      <section className="board-hero">
        {/* Background Decorations */}
        <div className="hero-bg-decorations">
          <div className="hero-bg-gradient hero-bg-gradient-1"></div>
          <div className="hero-bg-gradient hero-bg-gradient-2"></div>
          <div className="hero-floating-icon hero-floating-icon-1">
            <i className="ri-book-2-line"></i>
          </div>
          <div className="hero-floating-icon hero-floating-icon-2">
            <i className="ri-book-open-line"></i>
          </div>
          <div className="hero-floating-icon hero-floating-icon-3">
            <i className="ri-bookmark-line"></i>
          </div>
          <div className="hero-floating-icon hero-floating-icon-4">
            <i className="ri-quill-pen-line"></i>
          </div>
          <div className="hero-dot-pattern"></div>
        </div>
        <div className="board-hero-content">
          <div className="board-hero-badge">
            <div className="badge-pulse-dot">
              <div className="pulse-dot"></div>
              <div className="pulse-ping"></div>
            </div>
            <span className="badge-text">{t('browse_hero_badge')}</span>
            <div className="badge-divider"></div>
            <div className="badge-readers">
              <i className="ri-user-line"></i>
              <span className='badge-text-counter'>{userCount.toLocaleString()} {t('browse_stat_readers')}</span>
            </div>
          </div>
          <div className='board-title-wrap'>
            <h1 className="board-hero-title-1">
              {t('browse_hero_title_1')}
            </h1>
            <h1 className="board-hero-title-2">
              {t('browse_hero_title_2')}
            </h1>
            <h1 className="board-hero-title-3">
              {t('browse_hero_title_3')}
            </h1>
          </div>
          <div className='board-hero-subtitle-wrap'>
            <p className="board-hero-subtitle">
              {t('browse_hero_subtitle')}
            </p>
          </div>
          <div className="board-hero-cta">
            <button className="board-cta-primary" onClick={() => navigate('/create')}>
              <div className="cta-content">
                <i className="ri-add-circle-line cta-icon"></i>
                <span>{t('browse_hero_cta_create')}</span>
                <i className="ri-arrow-right-line cta-icon arrow"></i>
              </div>
            </button>
            <button className="board-cta-secondary" onClick={() => navigate('/')}>
              <div className="cta-content">
                <i className="ri-compass-3-line cta-icon compass"></i>
                <span>{t('browse_hero_cta_browse')}</span>
              </div>
            </button>
          </div>

          {/* Feature Badges */}
          <div className="board-hero-features">
            <div className="feature-badge">
              <div className="feature-icon">
                <i className="ri-shield-check-line"></i>
              </div>
              <span>{t('browse_feature_no_subscription')}</span>
            </div>
            <div className="feature-badge">
              <div className="feature-icon feature-icon-secondary">
                <i className="ri-robot-2-line"></i>
              </div>
              <span>{t('browse_feature_ai_insights')}</span>
            </div>
            <div className="feature-badge">
              <div className="feature-icon feature-icon-primary">
                <i className="ri-calendar-check-line"></i>
              </div>
              <span>{t('browse_feature_one_time')}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="board-stats">
          <div className="board-stat-card">
            <div className="stat-hover-bg stat-bg-primary"></div>
            <div className="stat-content">
              <div className="stat-icon-wrapper stat-icon-primary">
                <i className="ri-group-line"></i>
              </div>
              <div className="stat-value">{userCount.toLocaleString()}+</div>
              <div className="stat-label">{t('browse_stat_readers_grid')}</div>
              <div className="stat-subtitle">{t('browse_stat_readers_sub')}</div>
            </div>
          </div>
          <div className="board-stat-card">
            <div className="stat-hover-bg stat-bg-secondary"></div>
            <div className="stat-content">
              <div className="stat-icon-wrapper stat-icon-secondary">
                <i className="ri-book-open-line"></i>
              </div>
              <div className="stat-value">5,000+</div>
              <div className="stat-label">{t('browse_stat_discussions')}</div>
              <div className="stat-subtitle">{t('browse_stat_discussions_sub')}</div>
            </div>
          </div>
          <div className="board-stat-card">
            <div className="stat-hover-bg stat-bg-accent"></div>
            <div className="stat-content">
              <div className="stat-icon-wrapper stat-icon-accent">
                <i className="ri-star-fill"></i>
              </div>
              <div className="stat-value">4.9</div>
              <div className="stat-label">{t('browse_stat_rating')}</div>
              <div className="stat-stars">
                <i className="ri-star-fill"></i>
                <i className="ri-star-fill"></i>
                <i className="ri-star-fill"></i>
                <i className="ri-star-fill"></i>
                <i className="ri-star-fill"></i>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="about-features">
        <div className="about-features-container">
          {/* Section Header */}
          <div className="about-features-header">
            <div className="about-features-badge">
              <div className="features-badge-dot"></div>
              <span>{t('about_features_badge')}</span>
            </div>
            <h2 className="about-features-title">{t('about_features_title')}</h2>
            <p className="about-features-subtitle">{t('about_features_subtitle')}</p>
          </div>

          {/* Main Feature Cards */}
          <div className="about-features-grid">
            {/* Feature 1: One-time Meetings */}
            <div className="about-feature-card">
              <div className="feature-card-hover-bg feature-bg-primary"></div>
              <div className="feature-card-accent feature-accent-primary"></div>
              <div className="feature-card-content">
                <div className="feature-card-header">
                  <div className="feature-card-icon feature-icon-bg-primary">
                    <i className="ri-calendar-check-line"></i>
                  </div>
                  <div className="feature-card-text">
                    <h3>{t('about_feature_onetime_title')}</h3>
                    <p>{t('about_feature_onetime_desc')}</p>
                  </div>
                </div>
                <div className="feature-card-tags">
                  <span className="feature-tag feature-tag-primary">{t('about_feature_onetime_tag1')}</span>
                  <span className="feature-tag feature-tag-primary">{t('about_feature_onetime_tag2')}</span>
                  <span className="feature-tag feature-tag-primary">{t('about_feature_onetime_tag3')}</span>
                </div>
                <div className="feature-card-image">
                  <img
                    src="https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=300&fit=crop"
                    alt={t('about_feature_onetime_title')}
                  />
                </div>
                <div className="feature-card-arrow">
                  <i className="ri-arrow-right-line"></i>
                </div>
              </div>
            </div>

            {/* Feature 2: AI Moderator */}
            <div className="about-feature-card">
              <div className="feature-card-hover-bg feature-bg-secondary"></div>
              <div className="feature-card-accent feature-accent-secondary"></div>
              <div className="feature-card-content">
                <div className="feature-card-header">
                  <div className="feature-card-icon feature-icon-bg-secondary">
                    <i className="ri-robot-2-line"></i>
                  </div>
                  <div className="feature-card-text">
                    <h3>{t('about_feature_ai_mod_title')}</h3>
                    <p>{t('about_feature_ai_mod_desc')}</p>
                  </div>
                </div>
                <div className="feature-card-tags">
                  <span className="feature-tag feature-tag-secondary">{t('about_feature_ai_mod_tag1')}</span>
                  <span className="feature-tag feature-tag-secondary">{t('about_feature_ai_mod_tag2')}</span>
                  <span className="feature-tag feature-tag-secondary">{t('about_feature_ai_mod_tag3')}</span>
                </div>
                <div className="feature-card-image">
                  <img
                    src="https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&h=300&fit=crop"
                    alt={t('about_feature_ai_mod_title')}
                  />
                </div>
                <div className="feature-card-arrow">
                  <i className="ri-arrow-right-line"></i>
                </div>
              </div>
            </div>

            {/* Feature 3: AI Summary */}
            <div className="about-feature-card">
              <div className="feature-card-hover-bg feature-bg-accent"></div>
              <div className="feature-card-accent feature-accent-accent"></div>
              <div className="feature-card-content">
                <div className="feature-card-header">
                  <div className="feature-card-icon feature-icon-bg-accent">
                    <i className="ri-file-text-line"></i>
                  </div>
                  <div className="feature-card-text">
                    <h3>{t('about_feature_ai_summary_title')}</h3>
                    <p>{t('about_feature_ai_summary_desc')}</p>
                  </div>
                </div>
                <div className="feature-card-tags">
                  <span className="feature-tag feature-tag-accent">{t('about_feature_ai_summary_tag1')}</span>
                  <span className="feature-tag feature-tag-accent">{t('about_feature_ai_summary_tag2')}</span>
                  <span className="feature-tag feature-tag-accent">{t('about_feature_ai_summary_tag3')}</span>
                </div>
                <div className="feature-card-image">
                  <img
                    src="https://images.unsplash.com/photo-1456324504439-367cee3b3c32?w=600&h=300&fit=crop"
                    alt={t('about_feature_ai_summary_title')}
                  />
                </div>
                <div className="feature-card-arrow">
                  <i className="ri-arrow-right-line"></i>
                </div>
              </div>
            </div>

            {/* Feature 4: Reputation System */}
            <div className="about-feature-card">
              <div className="feature-card-hover-bg feature-bg-secondary"></div>
              <div className="feature-card-accent feature-accent-primary"></div>
              <div className="feature-card-content">
                <div className="feature-card-header">
                  <div className="feature-card-icon feature-icon-bg-primary">
                    <i className="ri-medal-line"></i>
                  </div>
                  <div className="feature-card-text">
                    <h3>{t('about_feature_reputation_title')}</h3>
                    <p>{t('about_feature_reputation_desc')}</p>
                  </div>
                </div>
                <div className="feature-card-tags">
                  <span className="feature-tag feature-tag-primary">{t('about_feature_reputation_tag1')}</span>
                  <span className="feature-tag feature-tag-primary">{t('about_feature_reputation_tag2')}</span>
                  <span className="feature-tag feature-tag-primary">{t('about_feature_reputation_tag3')}</span>
                </div>
                <div className="feature-card-image">
                  <img
                    src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=300&fit=crop"
                    alt={t('about_feature_reputation_title')}
                  />
                </div>
                <div className="feature-card-arrow">
                  <i className="ri-arrow-right-line"></i>
                </div>
              </div>
            </div>
          </div>

          {/* Small Feature Cards */}
          <div className="about-features-small">
            <div className="about-feature-small-card">
              <div className="feature-small-icon feature-small-icon-primary">
                <i className="ri-lightbulb-flash-line"></i>
              </div>
              <h4>{t('about_feature_smart_title')}</h4>
              <p>{t('about_feature_smart_desc')}</p>
            </div>
            <div className="about-feature-small-card">
              <div className="feature-small-icon feature-small-icon-secondary">
                <i className="ri-time-line"></i>
              </div>
              <h4>{t('about_feature_time_title')}</h4>
              <p>{t('about_feature_time_desc')}</p>
            </div>
            <div className="about-feature-small-card">
              <div className="feature-small-icon feature-small-icon-accent">
                <i className="ri-global-line"></i>
              </div>
              <h4>{t('about_feature_global_title')}</h4>
              <p>{t('about_feature_global_desc')}</p>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="about-comparison">
            <h3 className="about-comparison-title">{t('about_comparison_title')}</h3>
            <div className="about-comparison-table-wrapper">
              <table className="about-comparison-table">
                <thead>
                  <tr>
                    <th>{t('about_comparison_item')}</th>
                    <th>{t('about_comparison_traditional')}</th>
                    <th className="highlight">BookClub</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="item-label">{t('about_comparison_participation')}</td>
                    <td>{t('about_comparison_participation_trad')}</td>
                    <td className="highlight">{t('about_comparison_participation_bc')}</td>
                  </tr>
                  <tr>
                    <td className="item-label">{t('about_comparison_moderator')}</td>
                    <td>{t('about_comparison_moderator_trad')}</td>
                    <td className="highlight">{t('about_comparison_moderator_bc')}</td>
                  </tr>
                  <tr>
                    <td className="item-label">{t('about_comparison_record')}</td>
                    <td>{t('about_comparison_record_trad')}</td>
                    <td className="highlight">{t('about_comparison_record_bc')}</td>
                  </tr>
                  <tr>
                    <td className="item-label">{t('about_comparison_flexibility')}</td>
                    <td>{t('about_comparison_flexibility_trad')}</td>
                    <td className="highlight">{t('about_comparison_flexibility_bc')}</td>
                  </tr>
                  <tr>
                    <td className="item-label">{t('about_comparison_cost')}</td>
                    <td>{t('about_comparison_cost_trad')}</td>
                    <td className="highlight">{t('about_comparison_cost_bc')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* CTA Section */}
          <div className="about-features-cta">
            <p>{t('about_features_cta_text')}</p>
            <button className="about-cta-button" onClick={() => navigate('/')}>
              <span>{t('about_features_cta_button')}</span>
              <i className="ri-arrow-right-line"></i>
            </button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="about-testimonials">
        <div className="about-testimonials-container">
          {/* Section Header */}
          <div className="about-testimonials-header">
            <h2>{t('about_testimonials_title')}</h2>
            <p>{t('about_testimonials_subtitle')}</p>
          </div>

          {/* Testimonials Grid */}
          <div className="about-testimonials-grid">
            {/* Testimonial 1 */}
            <div className="about-testimonial-card">
              <div className="testimonial-quote-icon">
                <i className="ri-double-quotes-r"></i>
              </div>
              <div className="testimonial-content">
                <div className="testimonial-author">
                  <img
                    src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=64&h=64&fit=crop&crop=face"
                    alt={t('about_testimonial_1_name')}
                    className="testimonial-avatar testimonial-avatar-secondary"
                  />
                  <div className="testimonial-author-info">
                    <h4>{t('about_testimonial_1_name')}</h4>
                    <p>{t('about_testimonial_1_job')}</p>
                  </div>
                </div>
                <div className="testimonial-stars">
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                </div>
                <p className="testimonial-text">{t('about_testimonial_1_text')}</p>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="about-testimonial-card">
              <div className="testimonial-quote-icon">
                <i className="ri-double-quotes-r"></i>
              </div>
              <div className="testimonial-content">
                <div className="testimonial-author">
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=face"
                    alt={t('about_testimonial_2_name')}
                    className="testimonial-avatar testimonial-avatar-accent"
                  />
                  <div className="testimonial-author-info">
                    <h4>{t('about_testimonial_2_name')}</h4>
                    <p>{t('about_testimonial_2_job')}</p>
                  </div>
                </div>
                <div className="testimonial-stars">
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                </div>
                <p className="testimonial-text">{t('about_testimonial_2_text')}</p>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="about-testimonial-card">
              <div className="testimonial-quote-icon">
                <i className="ri-double-quotes-r"></i>
              </div>
              <div className="testimonial-content">
                <div className="testimonial-author">
                  <img
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=face"
                    alt={t('about_testimonial_3_name')}
                    className="testimonial-avatar testimonial-avatar-primary"
                  />
                  <div className="testimonial-author-info">
                    <h4>{t('about_testimonial_3_name')}</h4>
                    <p>{t('about_testimonial_3_job')}</p>
                  </div>
                </div>
                <div className="testimonial-stars">
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                </div>
                <p className="testimonial-text">{t('about_testimonial_3_text')}</p>
              </div>
            </div>

            {/* Testimonial 4 */}
            <div className="about-testimonial-card">
              <div className="testimonial-quote-icon">
                <i className="ri-double-quotes-r"></i>
              </div>
              <div className="testimonial-content">
                <div className="testimonial-author">
                  <img
                    src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face"
                    alt={t('about_testimonial_4_name')}
                    className="testimonial-avatar testimonial-avatar-secondary"
                  />
                  <div className="testimonial-author-info">
                    <h4>{t('about_testimonial_4_name')}</h4>
                    <p>{t('about_testimonial_4_job')}</p>
                  </div>
                </div>
                <div className="testimonial-stars">
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                </div>
                <p className="testimonial-text">{t('about_testimonial_4_text')}</p>
              </div>
            </div>

            {/* Testimonial 5 */}
            <div className="about-testimonial-card">
              <div className="testimonial-quote-icon">
                <i className="ri-double-quotes-r"></i>
              </div>
              <div className="testimonial-content">
                <div className="testimonial-author">
                  <img
                    src="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=64&h=64&fit=crop&crop=face"
                    alt={t('about_testimonial_5_name')}
                    className="testimonial-avatar testimonial-avatar-accent"
                  />
                  <div className="testimonial-author-info">
                    <h4>{t('about_testimonial_5_name')}</h4>
                    <p>{t('about_testimonial_5_job')}</p>
                  </div>
                </div>
                <div className="testimonial-stars">
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                </div>
                <p className="testimonial-text">{t('about_testimonial_5_text')}</p>
              </div>
            </div>

            {/* Testimonial 6 */}
            <div className="about-testimonial-card">
              <div className="testimonial-quote-icon">
                <i className="ri-double-quotes-r"></i>
              </div>
              <div className="testimonial-content">
                <div className="testimonial-author">
                  <img
                    src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=64&h=64&fit=crop&crop=face"
                    alt={t('about_testimonial_6_name')}
                    className="testimonial-avatar testimonial-avatar-primary"
                  />
                  <div className="testimonial-author-info">
                    <h4>{t('about_testimonial_6_name')}</h4>
                    <p>{t('about_testimonial_6_job')}</p>
                  </div>
                </div>
                <div className="testimonial-stars">
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                  <i className="ri-star-fill"></i>
                </div>
                <p className="testimonial-text">{t('about_testimonial_6_text')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="about-pricing">
        {/* Background Decorations */}
        <div className="pricing-bg-decoration pricing-bg-1"></div>
        <div className="pricing-bg-decoration pricing-bg-2"></div>

        <div className="about-pricing-container">
          {/* Section Header */}
          <div className="about-pricing-header">
            <div className="about-pricing-badge">
              <div className="pricing-badge-dot"></div>
              <span>{t('about_pricing_badge')}</span>
            </div>
            <h2>{t('about_pricing_title')}</h2>
            <p>{t('about_pricing_subtitle')}</p>

            {/* Billing Toggle */}
            <div className="pricing-billing-toggle">
              <button
                className={`billing-toggle-btn ${billingPeriod === 'monthly' ? 'active' : ''}`}
                onClick={() => setBillingPeriod('monthly')}
              >
                {t('about_pricing_monthly')}
              </button>
              <button
                className={`billing-toggle-btn ${billingPeriod === 'annual' ? 'active' : ''}`}
                onClick={() => setBillingPeriod('annual')}
              >
                {t('about_pricing_annual')}
                <span className="billing-discount-badge">{t('about_pricing_discount')}</span>
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="about-pricing-grid">
            {/* Free Plan */}
            <div className="about-pricing-card">
              <div className="pricing-card-icon pricing-icon-free">
                <i className="ri-user-line"></i>
              </div>
              <div className="pricing-card-header">
                <h3>{t('about_pricing_free_title')}</h3>
                <div className="pricing-price">
                  <span className="price-amount">$0</span>
                </div>
                <p>{t('about_pricing_free_desc')}</p>
              </div>
              <ul className="pricing-features">
                <li>
                  <div className="pricing-check pricing-check-free"><i className="ri-check-line"></i></div>
                  <span>{t('about_pricing_free_feature_1')}</span>
                </li>
                <li>
                  <div className="pricing-check pricing-check-free"><i className="ri-check-line"></i></div>
                  <span>{t('about_pricing_free_feature_2')}</span>
                </li>
                <li>
                  <div className="pricing-check pricing-check-free"><i className="ri-check-line"></i></div>
                  <span>{t('about_pricing_free_feature_3')}</span>
                </li>
                <li>
                  <div className="pricing-check pricing-check-free"><i className="ri-check-line"></i></div>
                  <span>{t('about_pricing_free_feature_4')}</span>
                </li>
                <li>
                  <div className="pricing-check pricing-check-free"><i className="ri-check-line"></i></div>
                  <span>{t('about_pricing_free_feature_5')}</span>
                </li>
              </ul>
              <button className="pricing-btn pricing-btn-outline" onClick={() => navigate('/register')}>
                <span>{t('about_pricing_get_started')}</span>
                <i className="ri-arrow-right-line"></i>
              </button>
            </div>

            {/* Premium Plan */}
            <div className="about-pricing-card pricing-card-featured">
              <div className="pricing-popular-badge">
                <i className="ri-fire-fill"></i>
                <span>{t('about_pricing_most_popular')}</span>
              </div>
              <div className="pricing-card-icon pricing-icon-premium">
                <i className="ri-vip-crown-line"></i>
              </div>
              <div className="pricing-card-header">
                <h3>{t('about_pricing_premium_title')}</h3>
                <div className="pricing-price">
                  <span className="price-amount">{billingPeriod === 'monthly' ? '$9.99' : '$7.99'}</span>
                  <span className="price-period">/{t('about_pricing_month')}</span>
                </div>
                <p>{t('about_pricing_premium_desc')}</p>
              </div>
              <ul className="pricing-features">
                <li>
                  <div className="pricing-check pricing-check-premium"><i className="ri-check-line"></i></div>
                  <span>{t('about_pricing_premium_feature_1')}</span>
                </li>
                <li>
                  <div className="pricing-check pricing-check-premium"><i className="ri-check-line"></i></div>
                  <span>{t('about_pricing_premium_feature_2')}</span>
                </li>
                <li>
                  <div className="pricing-check pricing-check-premium"><i className="ri-check-line"></i></div>
                  <span>{t('about_pricing_premium_feature_3')}</span>
                </li>
                <li>
                  <div className="pricing-check pricing-check-premium"><i className="ri-check-line"></i></div>
                  <span>{t('about_pricing_premium_feature_4')}</span>
                </li>
                <li>
                  <div className="pricing-check pricing-check-premium"><i className="ri-check-line"></i></div>
                  <span>{t('about_pricing_premium_feature_5')}</span>
                </li>
                <li>
                  <div className="pricing-check pricing-check-premium"><i className="ri-check-line"></i></div>
                  <span>{t('about_pricing_premium_feature_6')}</span>
                </li>
              </ul>
              <button className="pricing-btn pricing-btn-primary" onClick={() => navigate('/register')}>
                <span>{t('about_pricing_start_trial')}</span>
                <i className="ri-arrow-right-line"></i>
              </button>
            </div>

            {/* Team Plan */}
            <div className="about-pricing-card">
              <div className="pricing-card-icon pricing-icon-team">
                <i className="ri-team-line"></i>
              </div>
              <div className="pricing-card-header">
                <h3>{t('about_pricing_team_title')}</h3>
                <div className="pricing-price">
                  <span className="price-amount">{billingPeriod === 'monthly' ? '$29.99' : '$23.99'}</span>
                  <span className="price-period">/{t('about_pricing_month')}</span>
                </div>
                <p>{t('about_pricing_team_desc')}</p>
              </div>
              <ul className="pricing-features">
                <li>
                  <div className="pricing-check pricing-check-team"><i className="ri-check-line"></i></div>
                  <span>{t('about_pricing_team_feature_1')}</span>
                </li>
                <li>
                  <div className="pricing-check pricing-check-team"><i className="ri-check-line"></i></div>
                  <span>{t('about_pricing_team_feature_2')}</span>
                </li>
                <li>
                  <div className="pricing-check pricing-check-team"><i className="ri-check-line"></i></div>
                  <span>{t('about_pricing_team_feature_3')}</span>
                </li>
                <li>
                  <div className="pricing-check pricing-check-team"><i className="ri-check-line"></i></div>
                  <span>{t('about_pricing_team_feature_4')}</span>
                </li>
                <li>
                  <div className="pricing-check pricing-check-team"><i className="ri-check-line"></i></div>
                  <span>{t('about_pricing_team_feature_5')}</span>
                </li>
              </ul>
              <button className="pricing-btn pricing-btn-outline" onClick={() => navigate('/register')}>
                <span>{t('about_pricing_contact_sales')}</span>
                <i className="ri-arrow-right-line"></i>
              </button>
            </div>
          </div>

          {/* Feature Comparison Table */}
          <div className="about-pricing-comparison">
            <h3>{t('about_pricing_comparison_title')}</h3>
            <div className="pricing-comparison-table-wrapper">
              <table className="pricing-comparison-table">
                <thead>
                  <tr>
                    <th>{t('about_pricing_feature')}</th>
                    <th>{t('about_pricing_free_title')}</th>
                    <th className="highlight">{t('about_pricing_premium_title')}</th>
                    <th>{t('about_pricing_team_title')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="feature-name">{t('about_pricing_table_clubs')}</td>
                    <td>{t('about_pricing_table_clubs_free')}</td>
                    <td className="highlight">{t('about_pricing_table_clubs_premium')}</td>
                    <td>{t('about_pricing_table_clubs_team')}</td>
                  </tr>
                  <tr>
                    <td className="feature-name">{t('about_pricing_table_private')}</td>
                    <td><i className="ri-close-line disabled"></i></td>
                    <td className="highlight"><i className="ri-check-line enabled"></i></td>
                    <td><i className="ri-check-line enabled"></i></td>
                  </tr>
                  <tr>
                    <td className="feature-name">{t('about_pricing_table_support')}</td>
                    <td><i className="ri-close-line disabled"></i></td>
                    <td className="highlight"><i className="ri-check-line enabled"></i></td>
                    <td><i className="ri-check-line enabled"></i></td>
                  </tr>
                  <tr>
                    <td className="feature-name">{t('about_pricing_table_events')}</td>
                    <td><i className="ri-close-line disabled"></i></td>
                    <td className="highlight"><i className="ri-check-line enabled"></i></td>
                    <td><i className="ri-check-line enabled"></i></td>
                  </tr>
                  <tr>
                    <td className="feature-name">{t('about_pricing_table_api')}</td>
                    <td><i className="ri-close-line disabled"></i></td>
                    <td className="highlight"><i className="ri-close-line disabled"></i></td>
                    <td><i className="ri-check-line enabled"></i></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="about-pricing-faq">
            <h3>{t('about_pricing_faq_title')}</h3>
            <div className="pricing-faq-list">
              <details className="pricing-faq-item">
                <summary>
                  <span>{t('about_pricing_faq_1_q')}</span>
                  <i className="ri-arrow-down-s-line"></i>
                </summary>
                <p>{t('about_pricing_faq_1_a')}</p>
              </details>
              <details className="pricing-faq-item">
                <summary>
                  <span>{t('about_pricing_faq_2_q')}</span>
                  <i className="ri-arrow-down-s-line"></i>
                </summary>
                <p>{t('about_pricing_faq_2_a')}</p>
              </details>
              <details className="pricing-faq-item">
                <summary>
                  <span>{t('about_pricing_faq_3_q')}</span>
                  <i className="ri-arrow-down-s-line"></i>
                </summary>
                <p>{t('about_pricing_faq_3_a')}</p>
              </details>
              <details className="pricing-faq-item">
                <summary>
                  <span>{t('about_pricing_faq_4_q')}</span>
                  <i className="ri-arrow-down-s-line"></i>
                </summary>
                <p>{t('about_pricing_faq_4_a')}</p>
              </details>
            </div>
          </div>

          {/* Contact Support CTA */}
          <div className="about-contact-cta">
            <h3>{t('about_contact_title')}</h3>
            <p>{t('about_contact_subtitle')}</p>
            <button className="about-contact-btn">
              <i className="ri-customer-service-line"></i>
              <span>{t('about_contact_button')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="about-final-cta">
        {/* Background Decorations */}
        <div className="final-cta-bg-pattern"></div>
        <div className="final-cta-glow final-cta-glow-1"></div>
        <div className="final-cta-glow final-cta-glow-2"></div>

        <div className="about-final-cta-container">
          <div className="final-cta-icon">
            <i className="ri-book-open-line"></i>
          </div>

          <h2>{t('about_final_cta_title')}</h2>
          <p>{t('about_final_cta_subtitle')}</p>

          {/* CTA Buttons */}
          <div className="final-cta-buttons">
            <button className="final-cta-btn-primary" onClick={() => navigate('/create')}>
              <i className="ri-add-circle-line"></i>
              <span>{t('about_final_cta_create')}</span>
              <i className="ri-arrow-right-line arrow"></i>
            </button>
            <button className="final-cta-btn-outline" onClick={() => navigate('/')}>
              <i className="ri-compass-3-line compass"></i>
              <span>{t('about_final_cta_browse')}</span>
            </button>
          </div>

          {/* Feature Badges */}
          <div className="final-cta-features">
            <div className="final-cta-feature">
              <i className="ri-shield-check-line"></i>
              <span>{t('about_final_cta_free')}</span>
            </div>
            <div className="final-cta-feature">
              <i className="ri-time-line"></i>
              <span>{t('about_final_cta_cancel')}</span>
            </div>
            <div className="final-cta-feature">
              <i className="ri-star-fill star"></i>
              <span>{t('about_final_cta_rating')}</span>
            </div>
          </div>

          {/* Social Proof */}
          <div className="final-cta-social">
            <div className="final-cta-avatars">
              <img
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=48&h=48&fit=crop&crop=face"
                alt="User"
              />
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=48&h=48&fit=crop&crop=face"
                alt="User"
              />
              <img
                src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=48&h=48&fit=crop&crop=face"
                alt="User"
              />
              <img
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=48&h=48&fit=crop&crop=face"
                alt="User"
              />
              <img
                src="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=48&h=48&fit=crop&crop=face"
                alt="User"
              />
            </div>
            <p>
              {t('about_final_cta_joined_prefix')} <span className="highlight">{t('about_final_cta_joined_count')}</span> {t('about_final_cta_joined_suffix')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default About;
