import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en';
import ko from './ko';

const resources = {
  en: { translation: en },
  ko: { translation: ko },
};

// IP 기반 언어 감지 (비동기)
export const detectLanguageByIP = async (): Promise<string> => {
  try {
    // ipapi.co 무료 API 사용
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    const countryCode = data.country_code;

    // 한국 IP인 경우 한국어, 그 외 영어
    if (countryCode === 'KR') {
      return 'ko';
    }
    return 'en';
  } catch (error) {
    console.error('IP 기반 언어 감지 실패:', error);
    return 'en';
  }
};

// 초기 언어 설정
const getInitialLanguage = (): string => {
  // 1. localStorage에 저장된 언어가 있으면 사용
  const savedLanguage = localStorage.getItem('language');
  if (savedLanguage) {
    return savedLanguage;
  }
  // 2. 브라우저 언어 설정 확인
  const browserLang = window.navigator.language;
  if (browserLang.startsWith('ko')) {
    return 'ko';
  }
  return 'en';
};

i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  keySeparator: false,
  interpolation: {
    escapeValue: false,
  },
});

// 언어 변경 함수
export const changeLanguage = (lang: Languages): void => {
  i18n.changeLanguage(lang);
  localStorage.setItem('language', lang);
};

// 앱 시작 시 IP 기반 언어 감지 (localStorage에 저장된 값이 없을 때만)
export const initLanguageByIP = async (): Promise<void> => {
  if (!localStorage.getItem('language')) {
    const detectedLang = await detectLanguageByIP();
    changeLanguage(detectedLang as Languages);
  }
};

export default i18n;

export const languages = ['en', 'ko'] as const;

export type Languages = (typeof languages)[number]; // 'en' | 'ko'
