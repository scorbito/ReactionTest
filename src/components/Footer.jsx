import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../utils/i18nContext';

export default function Footer() {
  const { t } = useTranslation();
  
  return (
    <footer className="footer glass" style={{ marginTop: 'auto', padding: '1.5rem', textAlign: 'center' }}>
      <div className="footer-links" style={{ marginBottom: '0.5rem' }}>
        <Link to="/privacy" style={{ color: '#94a3b8', fontSize: '0.9rem', textDecoration: 'none' }}>
          개인정보처리방침 (Privacy Policy)
        </Link>
      </div>
      <p style={{ color: '#64748b', fontSize: '0.8rem' }}>
        © 2026 Reaction Test Web. All rights reserved.
      </p>
    </footer>
  );
}
