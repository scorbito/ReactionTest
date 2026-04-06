import React, { useState, useEffect } from 'react';
import { I18nContext, translations } from './i18nContext';

export const I18nProvider = ({ children }) => {
  const [lang, setLang] = useState('en'); // Default to English
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Browser language detection
    const detectLanguage = () => {
      if (navigator.language.startsWith('ko')) {
        setLang('ko');
      } else {
        setLang('en');
      }
      setLoading(false);
    };
    detectLanguage();
  }, []);

  const t = (key, params = {}) => {
    let text = translations[lang][key] || key;
    Object.keys(params).forEach(p => {
      text = text.replace(`{${p}}`, params[p]);
    });
    return text;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t, loading }}>
      {children}
    </I18nContext.Provider>
  );
};
