import React, { useEffect, useState } from 'react';
import { useTranslation } from '../utils/i18nContext';
import { auth, db, linkWithGoogleAccount, updateNickname, fetchUserBestScore, migrateUserData } from '../utils/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { useNavigate } from 'react-router-dom';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function MyPage() {
  const { t, lang } = useTranslation();
  const [user, loading] = useAuthState(auth);
  const [allRecords, setAllRecords] = useState([]);
  const [viewMode, setViewMode] = useState('paged'); 
  const [currentPage, setCurrentPage] = useState(0); 
  const [stats, setStats] = useState({ best: 0, avg: 0, total: 0 });
  
  // 닉네임 수정 상태
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 계정 연동 충돌(데이터 비교) 모달 상태
  const [mergeConflict, setMergeConflict] = useState(null); // { guestUid, googleUid, guestBest, googleBest }
  const [isMigrating, setIsMigrating] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (user && !isEditing) {
      setEditName(user.displayName || '');
    }
  }, [user, isEditing]);

  useEffect(() => {
    // If not loading and no user, navigate home
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchRecords = async () => {
      if (user) {
        try {
          const q = query(
            collection(db, `users/${user.uid}/records`),
            orderBy('createdAt', 'desc'),
            limit(100)
          );
          const querySnapshot = await getDocs(q);
          const results = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.ms) results.push(data);
          });
          
          if (results.length > 0) {
            setAllRecords(results);
            const times = results.map(r => r.ms);
            setStats({
              best: Math.min(...times),
              avg: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
              total: times.length
            });
          } else {
            setAllRecords([]);
            setStats({ best: 0, avg: 0, total: 0 });
          }
        } catch (e) {
          console.error("Error fetching records:", e);
        }
      }
    };
    
    fetchRecords();
  }, [user]);

  /**
   * 계정 연동 클릭 핸들러
   * 성공 = 바로 완료 메시지
   * 충돌 = 기존 구글 계정의 최고 점수를 조회하여 비교 모달 표시
   */
  const handleLinkAccount = async () => {
    try {
      const result = await linkWithGoogleAccount();
      if (!result) return;

      if (result.status === 'linked') {
        // 연동 성공
        alert(t('linkSuccess'));
        return;
      }

      if (result.status === 'conflict') {
        // 충돌: 게스트와 구글 최고 점수 조회
        const { guestUid, googleUid } = result;
        const [guestStats, googleStats] = await Promise.all([
          fetchUserBestScore(guestUid),
          fetchUserBestScore(googleUid),
        ]);
        console.log('충돌 감지 - 게스트:', guestStats, '구글:', googleStats);
        setMergeConflict({
          guestUid,
          googleUid,
          guestBest: guestStats.bestScore,
          guestName: guestStats.displayName,
          googleBest: googleStats.bestScore,
          googleName: googleStats.displayName,
        });
      }
    } catch (e) {
      console.error("Link account error", e);
    }
  };

  /**
   * 비교 모달에서 선택 완료 시 데이터 이관 핸들러
   * @param {'guest'|'google'} keepSource - 유지할 데이터 출처
   */
  const handleMergeSelect = async (keepSource) => {
    if (!mergeConflict) return;
    setIsMigrating(true);
    try {
      await migrateUserData(mergeConflict.guestUid, mergeConflict.googleUid, keepSource);
      setMergeConflict(null);
      alert(t('migrateSuccess'));
      // 페이지 새로고침으로 구글 계정 데이터 반영
      window.location.reload();
    } catch (e) {
      console.error('데이터 이관 실패:', e);
      alert('데이터 이관 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleSaveNickname = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === user.displayName) {
      setIsEditing(false);
      return;
    }
    
    setIsSaving(true);
    try {
      await updateNickname(trimmed);
      setIsEditing(false);
      // alert(t('nicknameUpdated') || '닉네임이 변경되었습니다!');
    } catch (e) {
      console.error("Failed to update nickname", e);
      alert("닉네임 변경에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="test-container">Loading...</div>;
  if (!user) return null;

  const isGuest = user.isAnonymous;

  // Pagination Logic
  const pageSize = 10;
  const maxPage = Math.ceil(allRecords.length / pageSize) - 1;
  
  const getDisplayedData = () => {
    if (viewMode === 'all') {
      return [...allRecords].reverse(); 
    }
    const start = currentPage * pageSize;
    const end = start + pageSize;
    return allRecords.slice(start, end).reverse(); 
  };

  const displayedRecords = getDisplayedData();

  const data = {
    labels: displayedRecords.length > 0 
      ? displayedRecords.map((_, i) => {
          if (viewMode === 'all') return i + 1;
          const globalIdx = allRecords.length - (currentPage * pageSize) - (displayedRecords.length - 1 - i);
          return globalIdx;
        }) 
      : [1],
    datasets: [
      {
        label: 'Reaction Time (ms)',
        data: displayedRecords.length > 0 ? displayedRecords.map(r => r.ms) : [0],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.3,
        pointRadius: viewMode === 'all' ? 1 : 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `${context.parsed.y} ms`
        }
      }
    },
    scales: {
      y: {
        reverse: true,
        grid: { color: 'rgba(255,255,255,0.1)' },
        ticks: { color: '#f8fafc' },
        suggestedMin: 100,
        suggestedMax: 500
      },
      x: {
        grid: { color: 'rgba(255,255,255,0.1)' },
        ticks: { 
          color: '#f8fafc',
          autoSkip: true,
          maxTicksLimit: 20
        }
      }
    }
  };

  const handleNextPage = () => {
    if (currentPage < maxPage) setCurrentPage(currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 0) setCurrentPage(currentPage - 1);
  };

  // 더 낮은(좋은) 점수 판독 (null 처리 포함)
  const isGuestWinner =
    mergeConflict &&
    (mergeConflict.googleBest === null ||
      (mergeConflict.guestBest !== null && mergeConflict.guestBest < mergeConflict.googleBest));

  return (
    <div className="my-page-container">

      {/* ── 데이터 비교 선택 모달 ── */}
      {mergeConflict && (
        <div className="merge-modal-overlay" onClick={(e) => e.target === e.currentTarget && !isMigrating && setMergeConflict(null)}>
          <div className="merge-modal">
            <h3 className="merge-modal-title">⚠️ {t('mergeConflictTitle')}</h3>
            <p className="merge-modal-desc">{t('mergeConflictDesc')}</p>

            <div className="merge-cards">
              {/* 게스트 카드 */}
              <div className={`merge-card ${isGuestWinner ? 'winner' : ''}`}>
                <div className="merge-card-label">{t('guestData')}</div>
                <div className="merge-card-icon">👤</div>
                <div className="merge-card-score">
                  {mergeConflict.guestBest ? `${mergeConflict.guestBest} ms` : t('noRecord')}
                </div>
                <div className="merge-card-name">{mergeConflict.guestName || 'Guest'}</div>
                {isGuestWinner && <div className="merge-winner-badge">🏆 더 좋은 기록!</div>}
              </div>

              <div className="merge-vs">VS</div>

              {/* 구글 카드 */}
              <div className={`merge-card ${!isGuestWinner ? 'winner' : ''}`}>
                <div className="merge-card-label">{t('googleData')}</div>
                <div className="merge-card-icon">🔵</div>
                <div className="merge-card-score">
                  {mergeConflict.googleBest ? `${mergeConflict.googleBest} ms` : t('noRecord')}
                </div>
                <div className="merge-card-name">{mergeConflict.googleName || 'Google'}</div>
                {!isGuestWinner && <div className="merge-winner-badge">🏆 더 좋은 기록!</div>}
              </div>
            </div>

            <div className="merge-actions">
              <button
                className="merge-btn merge-btn-guest"
                onClick={() => handleMergeSelect('guest')}
                disabled={isMigrating}
              >
                {isMigrating ? t('migrating') : `🗂 ${t('keepGuest')}`}
              </button>
              <button
                className="merge-btn merge-btn-google"
                onClick={() => handleMergeSelect('google')}
                disabled={isMigrating}
              >
                {isMigrating ? t('migrating') : `🔵 ${t('keepGoogle')}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Header */}
      <div className="profile-section glass">
        <div className="user-info-row">
          <img 
            src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'Guest'}`} 
            alt="Profile" 
            className="avatar" 
          />
          <div className="user-meta">
            {!isEditing ? (
              <div className="user-name-wrapper">
                <h2>{user.displayName || 'Guest User'}</h2>
                <button 
                  className="btn-icon" 
                  onClick={() => setIsEditing(true)}
                  title="Change Nickname"
                >
                  {lang === 'ko' ? '변경' : 'Edit'}
                </button>
              </div>
            ) : (
              <div className="edit-nickname-group">
                <input 
                  type="text"
                  className="nickname-edit-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value.slice(0, 15))}
                  placeholder="Insert Nickname"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveNickname();
                    if (e.key === 'Escape') setIsEditing(false);
                  }}
                />
                <div className="edit-actions">
                  <button 
                    className="btn-icon btn-save" 
                    onClick={handleSaveNickname}
                    disabled={isSaving}
                  >
                    {isSaving ? '...' : (lang === 'ko' ? '저장' : 'Save')}
                  </button>
                  <button 
                    className="btn-icon" 
                    onClick={() => setIsEditing(false)}
                    disabled={isSaving}
                  >
                    {lang === 'ko' ? '취소' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}
            <p className="user-label">{isGuest ? 'Guest Account' : user.email}</p>
          </div>
        </div>
        
        {isGuest && (
          <div className="guest-alert glass-light">
            <p>⚠️ {t('guestModeNotice')}</p>
            <button className="link-btn" onClick={handleLinkAccount}>
              {t('linkAccount')}
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ margin: 0 }}>{t('stats')}</h2>
        
        <div className="mode-toggle">
          <button 
            className={`mode-btn ${viewMode === 'paged' ? 'active' : ''}`}
            onClick={() => setViewMode('paged')}
          >
            10 {lang === 'ko' ? '개씩' : 'Items'}
          </button>
          <button 
            className={`mode-btn ${viewMode === 'all' ? 'active' : ''}`}
            onClick={() => setViewMode('all')}
          >
            {lang === 'ko' ? '전체' : 'All'}
          </button>
        </div>
      </div>
      
      <div className="stats-grid">
        <div className="stat-card glass">
          <div className="stat-title">{t('bestScore')}</div>
          <div className="stat-value">{stats.best ? `${stats.best} ms` : '-'}</div>
        </div>
        <div className="stat-card glass">
          <div className="stat-title">{t('avgScore')}</div>
          <div className="stat-value">{stats.avg ? `${stats.avg} ms` : '-'}</div>
        </div>
        <div className="stat-card glass">
          <div className="stat-title">{t('totalPlays')}</div>
          <div className="stat-value">{stats.total}</div>
        </div>
      </div>
      
      <div className="chart-container glass">
        <div style={{ height: '300px' }}>
          <Line options={options} data={data} />
        </div>

        {viewMode === 'paged' && allRecords.length > pageSize && (
          <div className="graph-controls">
            <div className="pagination-nav">
              <button 
                className="mode-btn active" 
                onClick={handleNextPage}
                disabled={currentPage === maxPage}
                style={{ opacity: currentPage === maxPage ? 0.3 : 1 }}
              >
                ← {lang === 'ko' ? '이전' : 'Older'}
              </button>
              
              <div className="range-text">
                {allRecords.length - (currentPage * pageSize)} ~ {Math.max(1, allRecords.length - (currentPage * pageSize) - 9)}
              </div>

              <button 
                className="mode-btn active" 
                onClick={handlePrevPage}
                disabled={currentPage === 0}
                style={{ opacity: currentPage === 0 ? 0.3 : 1 }}
              >
                {lang === 'ko' ? '다음' : 'Newer'} →
              </button>
            </div>

            <div className="scroll-track">
              <div 
                className="scroll-thumb" 
                style={{ 
                  width: `${(1 / (maxPage + 1)) * 100}%`,
                  left: `${(currentPage / (maxPage + 1)) * 100}%`
                }} 
              />
            </div>
          </div>
        )}
      </div>

      <div className="ad-container">
        <span>Advertisement (Google AdSense)</span>
      </div>
    </div>
  );
}
