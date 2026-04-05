import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import Home from './pages/Home';
import MyPage from './pages/MyPage';
import Privacy from './pages/Privacy';
import { I18nProvider } from './utils/i18n';

import Footer from './components/Footer';

function App() {
  return (
    <I18nProvider>
      <Router>
        <div className="app-main-layout" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Navigation />
          <main style={{ flex: '1' }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/mypage" element={<MyPage />} />
              <Route path="/privacy" element={<Privacy />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </I18nProvider>
  );
}

export default App;
