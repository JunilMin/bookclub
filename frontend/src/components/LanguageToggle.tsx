import { useTranslation } from 'react-i18next';
import { changeLanguage, Languages } from '../language/i18n';
import './styles/LanguageToggle.css';

const LanguageToggle: React.FC = () => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language as Languages;

  const handleToggle = () => {
    const newLang: Languages = currentLang === 'ko' ? 'en' : 'ko';
    changeLanguage(newLang);
  };

  return (
    <button className="language-toggle" onClick={handleToggle}>
      <span className={currentLang === 'en' ? 'active' : ''}>EN</span>
      <span className="divider">/</span>
      <span className={currentLang === 'ko' ? 'active' : ''}>KR</span>
    </button>
  );
};

export default LanguageToggle;
