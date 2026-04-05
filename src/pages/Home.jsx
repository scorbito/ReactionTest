import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../utils/i18nContext';
import { auth, db, loginAnonymously, updateNickname } from '../utils/firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  getCountFromServer,
  where,
  setDoc,
  doc,
  getDoc
} from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { getRandomDelay } from '../utils/helpers';
import EffectManager from '../components/EffectManager';
import { playSound } from '../utils/AudioEngine';

export default function Home() {
  const { t, lang } = useTranslation();
  const [user] = useAuthState(auth);
  
  const [state, setState] = useState('idle'); // idle, waiting, ready, result
  const [resultTime, setResultTime] = useState(null);
  const [trials, setTrials] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [top10, setTop10] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [isLoadingRank, setIsLoadingRank] = useState(false);

  // 전체 랭킹 페이지 상태
  const [showFullRanking, setShowFullRanking] = useState(false);
  const [fullRankingList, setFullRankingList] = useState([]);
  const [isLoadingFullRanking, setIsLoadingFullRanking] = useState(false);
  const [fullRankingTotal, setFullRankingTotal] = useState(0);

  // Nickname Modal State
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [tempNickname, setTempNickname] = useState('');
  const [isSavingNickname, setIsSavingNickname] = useState(false);

  // Effects State
  const [effectTrigger, setEffectTrigger] = useState(0);
  const [currentTier, setCurrentTier] = useState(null);
  const [tierMessage, setTierMessage] = useState('');
  const [clickPos, setClickPos] = useState({ x: 0, y: 0 });
  const [rippleTrigger, setRippleTrigger] = useState(0);

  const timeoutRef = useRef(null);
  const startTimeRef = useRef(0);

  // 초기 데이터 페치 (Top 10)
  useEffect(() => {
    const fetchTop10 = async () => {
      try {
        const q = query(collection(db, 'rankings'), orderBy('score', 'asc'), limit(10));
        const snap = await getDocs(q);
        setTop10(snap.docs.map(doc => doc.data()));
      } catch (e) {
        console.error("Error fetching top 10:", e);
      }
    };
    if (state === 'idle') {
      fetchTop10();
    }
  }, [state]);

  // 전체 랭킹 데이터 페치 함수
  const fetchFullRanking = React.useCallback(async () => {
    setIsLoadingFullRanking(true);
    try {
      console.log('전체 랭킹 데이터를 불러오는 중...');
      const q = query(collection(db, 'rankings'), orderBy('score', 'asc'), limit(100));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => doc.data());
      setFullRankingList(list);

      // 전체 플레이어 수 가져오기
      const totalColl = collection(db, 'rankings');
      const totalCount = await getCountFromServer(totalColl);
      setFullRankingTotal(totalCount.data().count);
      console.log(`전체 랭킹 로드 완료: ${list.length}명 표시 / 전체 ${totalCount.data().count}명`);
    } catch (e) {
      console.error('전체 랭킹 로드 실패:', e);
    } finally {
      setIsLoadingFullRanking(false);
    }
  }, []);

  // 전체 랭킹 페이지 열기
  const handleOpenFullRanking = React.useCallback(async (e) => {
    e.stopPropagation();
    setShowFullRanking(true);
    await fetchFullRanking();
  }, [fetchFullRanking]);

  // 전체 랭킹 페이지 닫기
  const handleCloseFullRanking = React.useCallback((e) => {
    e.stopPropagation();
    setShowFullRanking(false);
  }, []);

  const getTier = (ms) => {
    if (ms <= 100) return 't5';
    if (ms <= 150) return 't4';
    if (ms <= 200) return 't3';
    if (ms <= 250) return 't2';
    if (ms <= 300) return 't1';
    return 't0';
  };

  const showResultEffect = (ms, x, y) => {
    const tier = getTier(ms);
    setCurrentTier(tier);
    setClickPos({ x, y });
    
    // Pick random message
    const msgs = t('tiers')[tier];
    const randomMsg = msgs[Math.floor(Math.random() * msgs.length)];
    setTierMessage(randomMsg);
    
    // Trigger Visuals
    setEffectTrigger(prev => prev + 1);
    if (tier === 't2') setRippleTrigger(prev => prev + 1);
    
    // Trigger Sound
    playSound(tier);
  };
  
  // Reset effects on new test
  useEffect(() => {
    if (state === 'idle' || state === 'waiting') {
      setCurrentTier(null);
      setTierMessage('');
    }
  }, [state]);

  const saveRecord = React.useCallback(async (avgMs, overrideUser = null) => {
    const activeUser = overrideUser || user;
    if (!activeUser) return;
    
    try {
      // 1. Individual Record
      await addDoc(collection(db, `users/${activeUser.uid}/records`), {
        ms: avgMs,
        createdAt: serverTimestamp(),
        device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
      });

      // 2. Global Ranking
      const rankRef = doc(db, 'rankings', activeUser.uid);
      const rankSnap = await getDoc(rankRef);
      
      if (!rankSnap.exists() || rankSnap.data().score > avgMs) {
        await setDoc(rankRef, {
          uid: activeUser.uid,
          displayName: activeUser.displayName || t('anonymous') || 'Anonymous',
          score: avgMs,
          updatedAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error("Error saving record: ", e);
    }
  }, [user, t]);

  const fetchLeaderboard = React.useCallback(async (currentAvg, overrideUser = null) => {
    const activeUser = overrideUser || user;
    setIsLoadingRank(true);
    try {
      const q = query(collection(db, 'rankings'), orderBy('score', 'asc'), limit(100));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => doc.data());
      setLeaderboard(list);

      const totalColl = collection(db, 'rankings');
      const totalCount = await getCountFromServer(totalColl);
      setTotalPlayers(totalCount.data().count);

      if (currentAvg) {
        const myEntry = activeUser ? list.find(e => e.uid === activeUser.uid) : null;
        const scoreForRank = myEntry ? myEntry.score : currentAvg;
        const rankQuery = query(collection(db, 'rankings'), where('score', '<', scoreForRank));
        const rankCount = await getCountFromServer(rankQuery);
        setMyRank(rankCount.data().count + 1);
      }
    } catch (e) {
      console.error("Error fetching leaderboard: ", e);
    } finally {
      setIsLoadingRank(false);
    }
  }, [user]);

  const handleNicknameSubmit = async () => {
    if (!tempNickname.trim()) return;
    setIsSavingNickname(true);
    try {
      let activeUser = user;
      if (!activeUser) {
        activeUser = await loginAnonymously();
      }
      await updateNickname(tempNickname);
      // Wait a bit for auth state to catch up or just use the local result
      const updatedUser = { ...activeUser, displayName: tempNickname };
      
      await saveRecord(resultTime, updatedUser);
      await fetchLeaderboard(resultTime, updatedUser);
      setShowNicknameModal(false);
    } catch (e) {
      console.error("Failed to submit nickname", e);
    } finally {
      setIsSavingNickname(false);
    }
  };

  const handleViewResults = React.useCallback(async () => {
    const average = Math.round(trials.reduce((a, b) => a + b, 0) / 3);
    setResultTime(average);
    
    showResultEffect(average, window.innerWidth/2, window.innerHeight/2);

    if (user && user.displayName) {
      setShowLeaderboard(true);
      setIsLoadingRank(true);
      await saveRecord(average);
      await fetchLeaderboard(average);
    } else {
      // Need nickname
      setShowNicknameModal(true);
    }
  }, [trials, user, saveRecord, fetchLeaderboard]);

  const startNextRound = React.useCallback(() => {
    // 이전 라운드의 잔여 타이머 반드시 제거 (중복 발화 방지)
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;

    setState('waiting');
    const randomTime = getRandomDelay();
    timeoutRef.current = setTimeout(() => {
      setState('ready');
      startTimeRef.current = performance.now();
    }, randomTime);
  }, []);

  const resetTest = React.useCallback(() => {
    // 리셋 시 진행 중인 타이머도 함께 제거
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setState('idle');
    setResultTime(null);
    setTrials([]);
    setShowLeaderboard(false);
    setMyRank(null);
  }, []);

  const handleClick = React.useCallback((e) => {
    if (showLeaderboard || showNicknameModal || showFullRanking) return;

    if (state === 'idle') {
      setTrials([]);
      startNextRound();
    } else if (state === 'waiting') {
      clearTimeout(timeoutRef.current);
      setTrials([]);
      setState('idle');
      setResultTime('tooEarly');
      setTimeout(() => {
        setResultTime(null);
      }, 2000);
    } else if (state === 'ready') {
      const endTime = performance.now();
      const reactionTime = Math.round(endTime - startTimeRef.current);
      
      if (reactionTime < 50) {
        setResultTime('macroWarning');
        setTrials([]);
        setState('idle');
        setTimeout(() => {
          setResultTime(null);
        }, 2000);
        return;
      }

      const newTrials = [...trials, reactionTime];
      setTrials(newTrials);
      setResultTime(reactionTime);
      setState('result');
      
      showResultEffect(reactionTime, e.clientX, e.clientY);
    } else if (state === 'result') {
      if (trials.length < 3) {
        startNextRound();
      }
    }
  }, [state, trials, startNextRound, showLeaderboard, showNicknameModal, showFullRanking]);

  const getBackgroundColor = React.useMemo(() => {
    if (state === 'idle') return 'var(--test-initial)';
    if (state === 'waiting') return 'var(--test-wait)';
    if (state === 'ready') return 'var(--test-action)';
    return 'var(--bg-color)';
  }, [state]);

  const isFinal = trials.length === 3;

  return (
    <div 
      className={`test-container ${currentTier === 't1' ? 'flash-green' : ''} ${currentTier === 't3' ? 'shake' : ''} ${currentTier === 't4' || currentTier === 't5' ? 'flash-multi' : ''}`}
      onClick={handleClick}
      style={{ backgroundColor: getBackgroundColor }}
    >

      {rippleTrigger > 0 && (
        <div 
          key={rippleTrigger}
          className="ripple" 
          style={{ left: clickPos.x - 25, top: clickPos.y - 25, width: 50, height: 50 }} 
        />
      )}

      {currentTier === 't3' && <div className="flash-yellow" style={{ position: 'fixed', inset: 0, zIndex: 5, pointerEvents: 'none' }} />}

      <EffectManager trigger={effectTrigger} tier={currentTier} pos={clickPos} />

      {state === 'idle' ? (
        /* 아이들 상태: 명예의 전당 + 시작 카드를 수직으로 쌓아서 겹침 방지 */
        <div className="idle-layout">
          {top10.length > 0 && (
            <div className="home-rank-container" onClick={(e) => e.stopPropagation()}>
              {/* 명예의 전당 헤더: 제목 + 전체 랭킹 버튼 */}
              <div className="home-rank-header">
                <div className="bar-title">
                  {t('topRankers')}
                </div>
                <button
                  className="full-ranking-btn"
                  onClick={handleOpenFullRanking}
                  title={t('viewFullRanking')}
                >
                  🏆 {t('viewFullRanking')}
                </button>
              </div>
              <div className="home-rank-list">
                {top10.map((entry, idx) => (
                  <div key={idx} className={`home-rank-item top-${idx + 1}`}>
                    <div className="rank-badge">{idx + 1}</div>
                    <div className="home-rank-name">{entry.displayName}</div>
                    <div className="home-rank-score">{entry.score}ms</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 시작 카드: 명예의 전당 바로 아래에 배치 */}
          <div className="home-start-card" onClick={handleClick}>
            <h1>
              {resultTime === 'tooEarly'
                ? t('tooEarly')
                : resultTime === 'macroWarning'
                  ? t('macroWarning')
                  : 'Reaction Test'}
            </h1>
            <p>
              {resultTime === 'tooEarly' || resultTime === 'macroWarning'
                ? t('retry')
                : t('clickToStart')}
            </p>
          </div>
        </div>
      ) : (
        /* 비아이들 상태: 게임 진행 중 (waiting / ready / result) */
        <div className="glass" style={{
          padding: '3rem',
          borderRadius: '1rem',
          background: state === 'ready' ? 'transparent' : 'var(--glass-bg)',
          border: state === 'ready' ? 'none' : '1px solid var(--glass-border)',
          position: 'relative',
          zIndex: 10,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          {state === 'waiting' && (
            <>
              <h1 style={{ fontSize: '4rem' }}>...</h1>
              <p>{t('roundProgress', { current: trials.length + 1, total: 3 })}</p>
              <p style={{ marginTop: '1rem' }}>{t('wait')}</p>
            </>
          )}
          {state === 'ready' && (
            <>
              <h1>{t('action')}</h1>
              <p>Click now!</p>
            </>
          )}
          {state === 'result' && (
            <>
              <div className={`tier-message tier-text-${currentTier?.substring(1)}`}>
                {tierMessage}
              </div>

              <h1 style={{ marginTop: '1rem' }}>{t('result', { ms: resultTime })}</h1>
              {isFinal ? (
                <button
                  className="view-results-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewResults();
                  }}
                >
                  {t('viewResults')}
                </button>
              ) : (
                <p>{t('clickToStart')}</p>
              )}
              {!isFinal && (
                <div style={{ marginTop: '1rem', opacity: 0.7 }}>
                  {t('roundProgress', { current: trials.length, total: 3 })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Nickname Modal */}
      {showNicknameModal && (
        <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content glass">
            <h2>{t('enterNickname')}</h2>
            <p style={{ marginBottom: '1.5rem', opacity: 0.8 }}>{t('loginForRank')}</p>
            <input 
              type="text" 
              maxLength={10}
              placeholder={t('nicknamePlaceholder')}
              value={tempNickname}
              onChange={(e) => setTempNickname(e.target.value)}
              className="nickname-input"
              autoFocus
            />
            <div className="modal-actions">
              <button 
                className="save-btn" 
                onClick={handleNicknameSubmit}
                disabled={!tempNickname.trim() || isSavingNickname}
              >
                {isSavingNickname ? '...' : t('saveNickname')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeaderboard && (
        <div className="leaderboard-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="leaderboard-content glass">
            <h2>{t('leaderboard')}</h2>
            
            <div className="my-summary">
              <h3 className={`tier-text-${currentTier?.substring(1)}`}>
                {t('averageResult', { ms: resultTime })}
              </h3>
              {isLoadingRank ? (
                <p>Loading Rank...</p>
              ) : (
                <>
              <p className="rank-text">
                {myRank ? t('userRank', { rank: myRank, total: Math.max(totalPlayers, myRank) }) : t('loadingRank')}
              </p>
                  {myRank && myRank <= 10 && (
                    <p className="congrats-msg">{t('congratsTop10')}</p>
                  )}
                </>
              )}
            </div>

            <div className="table-wrapper">
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th>{t('rank')}</th>
                    <th>{t('name')}</th>
                    <th>{t('score')}</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, index) => (
                    <tr key={index} className={user && entry.uid === user.uid ? 'highlight' : ''}>
                      <td>{index + 1}</td>
                      <td>{entry.displayName}</td>
                      <td>{entry.score} ms</td>
                    </tr>
                  ))}
                  
                  {user && myRank > 0 && !leaderboard.some(e => e.uid === user.uid) && (
                    <>
                      {myRank > leaderboard.length + 1 && (
                        <tr>
                          <td colSpan="3" style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>•••</td>
                        </tr>
                      )}
                      <tr className="highlight">
                        <td>{myRank}</td>
                        <td>{user.displayName || 'Me'}</td>
                        <td>{resultTime} ms</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            <button className="retry-btn" onClick={resetTest}>
              {t('retry')}
            </button>
          </div>
        </div>
      )}

      {/* 전체 랭킹 보기 오버레이 */}
      {showFullRanking && (
        <div className="full-ranking-overlay" onClick={handleCloseFullRanking}>
          <div className="full-ranking-content glass" onClick={(e) => e.stopPropagation()}>
            {/* 헤더 */}
            <div className="full-ranking-header">
              <div>
                <h2>🏆 {t('fullRanking')}</h2>
                <p className="full-ranking-subtitle">{t('fullRankingSubtitle')}</p>
              </div>
              <button className="full-ranking-close-btn" onClick={handleCloseFullRanking}>
                ✕
              </button>
            </div>

            {/* 전체 참가자 수 배지 */}
            <div className="full-ranking-stats">
              <span className="full-ranking-stat-badge">
                👥 {fullRankingTotal > 0 ? `${fullRankingTotal.toLocaleString()}명 참여` : '로딩 중...'}
              </span>
              <span className="full-ranking-stat-badge">
                📊 Top 100 표시
              </span>
            </div>

            {/* 테이블 영역 */}
            <div className="table-wrapper full-ranking-table-wrapper">
              {isLoadingFullRanking ? (
                <div className="full-ranking-loading">
                  <div className="loading-spinner"></div>
                  <p>랭킹 데이터를 불러오는 중...</p>
                </div>
              ) : (
                <table className="ranking-table full-ranking-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>{t('rank')}</th>
                      <th>{t('name')}</th>
                      <th style={{ width: '100px', textAlign: 'right' }}>{t('score')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fullRankingList.map((entry, index) => (
                      <tr
                        key={index}
                        className={`full-ranking-row ${index === 0 ? 'rank-gold' : ''} ${index === 1 ? 'rank-silver' : ''} ${index === 2 ? 'rank-bronze' : ''} ${user && entry.uid === user.uid ? 'highlight' : ''}`}
                      >
                        <td>
                          <span className="full-rank-badge">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                          </span>
                        </td>
                        <td className="full-rank-name">{entry.displayName}</td>
                        <td className="full-rank-score">{entry.score} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 닫기 버튼 */}
            <button className="full-ranking-bottom-close" onClick={handleCloseFullRanking}>
              {t('close')}
            </button>
          </div>
        </div>
      )}

      <div className="guide-text" style={{ color: state === 'idle' ? '#64748b' : 'white' }}>
        {t('guideText')}
      </div>
    </div>
  );
}
