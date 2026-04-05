import React, { useState, useEffect } from 'react';
import { I18nContext, translations } from './i18nContext';

export const I18nProvider = ({ children }) => {
  const [lang, setLang] = useState('en'); // Default to English
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check IP location for automatic language setting
    const checkLocation = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (data.country === 'KR') {
          setLang('ko');
        } else {
          setLang('en');
        }
      } catch (error) {
        console.error('Failed to detect location', error);
        // Fallback to browser language
        if (navigator.language.startsWith('ko')) {
          setLang('ko');
        }
      } finally {
        setLoading(false);
      }
    };
    checkLocation();
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
