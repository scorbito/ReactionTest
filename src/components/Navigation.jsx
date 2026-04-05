import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../utils/i18nContext';
import { auth, loginWithGoogle, logout } from '../utils/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

export default function Navigation() {
  const { t } = useTranslation();
  const [user, loading] = useAuthState(auth);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <nav className="nav">
      <Link to="/" className="nav-link">{t('home')}</Link>
      {user ? (
        <>
          <Link to="/mypage" className="nav-link">{t('myPage')}</Link>
          <button onClick={logout} className="btn" style={{ marginLeft: '1rem', background: 'transparent', border: '1px solid var(--glass-border)' }}>
            {t('logout')}
          </button>
        </>
      ) : (
        <button onClick={handleLogin} className="btn" disabled={loading} style={{ marginLeft: '1rem' }}>
          {t('login')}
        </button>
      )}
    </nav>
  );
}
