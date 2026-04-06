import React, { forwardRef } from 'react';
import { useTranslation } from '../utils/i18nContext';
import logoImg from '../assets/logo.jpg';

const ShareCard = forwardRef(({ score, rank, percentile, tier, tierMsg }, ref) => {
  const { t } = useTranslation();

  const tierColors = {
    t1: '#1D9E75', // Good
    t2: '#185FA5', // Great
    t3: '#BA7517', // Excellent
    t4: '#A32D2D', // INSANE
    t5: '#534AB7', // LUCKY
    t0: '#64748b', // Normal
  };

  const accentColor = tierColors[tier] || tierColors.t0;

  return (
    <div 
      ref={ref}
      className="share-card-inner"
      style={{
        width: '540px',
        height: '540px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '40px',
        color: 'white',
        fontFamily: "'Inter', sans-serif",
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      {/* Top Logo Area */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img 
          src={logoImg} 
          alt="Logo" 
          style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${accentColor}` }} 
        />
        <span style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '-0.02em', color: '#f8fafc' }}>
          {t('channelName')} {t('home')}
        </span>
      </div>

      {/* Main Score Area */}
      <div style={{ textAlign: 'center', marginTop: '-20px' }}>
        <div style={{ fontSize: '14px', color: '#94a3b8', textTransform: 'uppercase', tracking: '0.1em', marginBottom: '8px' }}>
          Reaction Time
        </div>
        <div style={{ fontSize: '84px', fontWeight: '900', color: accentColor }}>
          {score}<span style={{ fontSize: '24px', fontWeight: '600' }}>ms</span>
        </div>
      </div>

      {/* Tier Badge & Message */}
      <div style={{ textAlign: 'center', width: '100%' }}>
        <div style={{ 
          display: 'inline-block',
          padding: '6px 16px',
          backgroundColor: accentColor,
          borderRadius: '20px',
          fontSize: '16px',
          fontWeight: 'bold',
          marginBottom: '16px',
          border: `2px solid rgba(255,255,255,0.2)` /* 그림자 대신 테두리 */
        }}>
          {tier?.toUpperCase()}
        </div>
        <div style={{ fontSize: '20px', fontWeight: '600', color: '#e2e8f0', lineHeight: '1.4' }}>
          "{tierMsg}"
        </div>
      </div>

      {/* Ranking Info */}
      <div style={{ 
        width: '100%', 
        backgroundColor: 'rgba(255,255,255,0.05)', 
        padding: '16px', 
        borderRadius: '12px',
        display: 'flex',
        justifyContent: 'center',
        gap: '12px',
        fontSize: '16px',
        color: '#cbd5e1',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <span>전국 {rank}위</span>
        <span style={{ color: '#475569' }}>|</span>
        <span>상위 {percentile}%</span>
      </div>

      {/* Footer URL */}
      <div style={{ fontSize: '12px', color: '#64748b', opacity: 0.8 }}>
        reaction-test-danu-777-v2.web.app
      </div>
    </div>
  );
});

ShareCard.displayName = 'ShareCard';

export default ShareCard;
