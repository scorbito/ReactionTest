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
import html2canvas from 'html2canvas';
import { getDeviceType } from '../utils/getDeviceType';
import ShareCard from '../components/ShareCard';

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
  const [deviceTab, setDeviceTab] = useState('all'); // all, mobile, desktop
  
  // Sharing State
  const shareCardRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  const currentRankRef = useRef(null);

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
  const fetchFullRanking = React.useCallback(async (tab) => {
    const currentTab = tab || deviceTab;
    setIsLoadingFullRanking(true);
    setFullRankingList([]); // Clear previous list to avoid confusion
    try {
      const baseColl = collection(db, 'rankings');
      let q, countSnap;

      if (currentTab === 'all') {
        q = query(baseColl, orderBy('score', 'asc'), limit(100));
        countSnap = await getCountFromServer(baseColl);
      } else {
        q = query(baseColl, where('device', '==', currentTab), orderBy('score', 'asc'), limit(100));
        countSnap = await getCountFromServer(query(baseColl, where('device', '==', currentTab)));
      }
      
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => doc.data());
      setFullRankingList(list);
      setFullRankingTotal(countSnap.data().count);
    } catch (e) {
      console.error('전체 랭킹 로드 실패:', e);
    } finally {
      setIsLoadingFullRanking(false);
    }
  }, [deviceTab]);

  // 탭 변경 시 데이터 다시 불러오기
  useEffect(() => {
    if (showFullRanking) {
      fetchFullRanking(deviceTab);
    }
  }, [deviceTab, showFullRanking, fetchFullRanking]);

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

      if (!user) return;

      const deviceType = getDeviceType();
      const rankDocId = `${user.uid}_${deviceType}`;
      const rankRef = doc(db, 'rankings', rankDocId);
      const rankSnap = await getDoc(rankRef);

      if (!rankSnap.exists() || rankSnap.data().score > avgMs) {
        await setDoc(rankRef, {
          uid: user.uid,
          displayName: user.displayName || t('anonymous') || 'Anonymous',
          score: avgMs,
          device: deviceType, // Add device to ranking doc
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
        // 순위 계산은 방금 기록한 점수(currentAvg)를 기준으로 전국의 모든 기록과 비교
        const scoreForRank = currentAvg;
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

  const handleShare = async () => {
    // 디버깅: 함수 호출 여부 확인
    console.log("handleShare started, current shareCardRef:", shareCardRef.current);
    
    if (!shareCardRef.current || isSharing) {
      console.warn("Share aborted: ref.current is null or already sharing");
      return;
    }
    
    setIsSharing(true);
    try {
      // 0.3초 대기하여 UI 정찰 및 Safari 렌더링 준비
      await new Promise(resolve => setTimeout(resolve, 300));

      const shareTarget = shareCardRef.current;
      
      const canvas = await html2canvas(shareTarget, {
        scale: 1.5, // 2 -> 1.5로 하향 (모바일 메모리 최적화)
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#0f172a',
        logging: true // 오류 추적을 위해 로깅 활성화
      });
      
      const imageData = canvas.toDataURL('image/png');
      
      if (!imageData || imageData === 'data:,') {
        throw new Error("Canvas rendering failed");
      }

      const canUseShare = navigator.share && (
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) // iPadOS용 체크 추가
      );
      
      let sharedSuccessful = false;

      if (canUseShare) {
        try {
          const byteString = atob(imageData.split(',')[1]);
          const mimeString = imageData.split(',')[0].split(':')[1].split(';')[0];
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: mimeString });
          const file = new File([blob], `reaction_results_${resultTime}ms.png`, { type: 'image/png' });
          
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            const shareDescBase = t('shareDesc', { 
              ms: resultTime, 
              rank: myRank || '?', 
              percentile: myRank ? Math.max(0.1, Math.round((myRank / totalPlayers) * 100 * 10) / 10) : '?'
            });
            
            await navigator.share({
              files: [file],
              title: t('shareTitle'),
              text: `${shareDescBase}\n${window.location.origin}`, // 텍스트에 링크 포함
              // url 속성은 파일 공유와 충돌할 수 있어 제거
            });
            sharedSuccessful = true;
          }
        } catch (shareError) {
          console.warn("Share API failed, falling back to download", shareError);
        }
      }

      // 공유에 실패했거나 공유 기능이 없는 경우 다운로드 처리
      if (!sharedSuccessful) {
        const link = document.createElement('a');
        link.href = imageData;
        link.download = `reaction_results_${resultTime}ms.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (e) {
      console.error("Capture failed:", e);
      alert("이미지 생성에 실패했습니다. (캡처 도구 충돌 가능성)");
    } finally {
      setIsSharing(false);
    }
  };

  const handleViewResults = React.useCallback(async () => {
    const average = Math.round(trials.reduce((a, b) => a + b, 0) / 3);
    setResultTime(average);
    
    // 랭킹 데이터는 항상 로드 (비로그인자도 전국 몇 위인지 알 수 있게)
    setIsLoadingRank(true);
    await fetchLeaderboard(average);

    if (user && user.displayName) {
      setShowLeaderboard(true);
      await saveRecord(average);
    } else {
      // 닉네임 입력 모달 (로그인 유도)
      setShowNicknameModal(true);
    }
  }, [trials, user, saveRecord, fetchLeaderboard]);

  // 리더보드 로드 및 모달 오픈 시 현재 기록 위치로 자동 스크롤
  useEffect(() => {
    if (showLeaderboard && !isLoadingRank && currentRankRef.current) {
      const timer = setTimeout(() => {
        currentRankRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 1000); // 700ms -> 1000ms로 상향 (안정성 확보)
      return () => clearTimeout(timer);
    }
  }, [showLeaderboard, isLoadingRank, leaderboard]);

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
              <h1 style={{ fontSize: '4rem' }}>{t('action')}</h1>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%', maxWidth: '300px' }}>
                  <button 
                    className="view-results-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewResults();
                    }}
                    style={{ margin: 0, width: '100%' }}
                  >
                    {t('viewResults')}
                  </button>
                  
                  {/* Share Card (Hidden from view using out-of-sight container) */}
                    <div id="capture-container" style={{ 
                      position: 'fixed', 
                      top: '0', 
                      left: '-9999px', // opacity 0 대신 화면 밖 전법 사용 (Safari 렌더링 강제)
                      width: '540px',
                      height: '540px',
                      opacity: '1',
                      pointerEvents: 'none',
                      zIndex: '-1',
                      overflow: 'hidden' 
                    }}>
                    <ShareCard 
                      ref={shareCardRef}
                      score={resultTime}
                      rank={myRank || '-'}
                      percentile={myRank && totalPlayers > 0 ? Math.max(0.1, Math.round((myRank / totalPlayers) * 100 * 10) / 10) : '-'}
                      tier={currentTier}
                      tierMsg={tierMessage}
                    />
                  </div>
                </div>
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
              <p className="rank-text">
                {myRank ? t('userRank', { rank: myRank, total: Math.max(totalPlayers, myRank) }) : t('loadingRank')}
              </p>
              {myRank && myRank <= 10 && (
                <p className="congrats-msg">{t('congratsTop10')}</p>
              )}
              
              {/* 리더보드 내 공유 버튼 */}
              <div className="modal-share-container" style={{ marginTop: '1.2rem', width: '100%', display: 'flex', justifyContent: 'center' }}>
                <button 
                  className="share-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare();
                  }}
                  disabled={isSharing || isLoadingRank}
                  style={{ width: '100%', maxWidth: '280px' }}
                >
                  {isSharing ? '생성 중...' : (isLoadingRank ? '순위 계산 중...' : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', marginRight: '8px' }}>
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                        <polyline points="16 6 12 2 8 6" />
                        <line x1="12" y1="2" x2="12" y2="15" />
                      </svg>
                      {t('shareResult')}
                    </>
                  ))}
                </button>
              </div>
            </div>

            {/* 테이블과 하단 버튼은 Summary 바깥에 배치하여 스크롤 및 레이아웃 정상화 */}
            <div className="table-wrapper">
              {isLoadingRank ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  <p>{t('loadingRank')}</p>
                </div>
              ) : (
                <table className="ranking-table">
                  <thead>
                    <tr>
                      <th className="rank-col">{t('rank')}</th>
                      <th className="name-col">{t('name')}</th>
                      <th className="score-col">{t('score')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // 1. 표시용 리스트 준비 (원본 보존을 위해 복사)
                      let displayList = [...leaderboard].map((item, idx) => ({ ...item, realRank: idx + 1 }));
                      
                      // 2. 본인의 최고 기록 인덱스 찾기
                      const myBestIndex = displayList.findIndex(e => user && e.uid === user.uid);
                      
                      // 3. 이번 기록(resultTime)이 리스트에 이미 있는지 확인 (점수까지 일치해야 함)
                      const isCurrentInList = displayList.some(e => user && e.uid === user.uid && e.score === resultTime);

                      // 4. 이번 기록이 100위 이내인데 리스트엔 없는 경우 (중복 유저 필터링 등으로 누락된 경우) 위치 찾아 삽입
                      if (!isCurrentInList && user && myRank > 0 && myRank <= 100) {
                        const currentEntry = {
                          uid: user.uid,
                          displayName: user.displayName || 'Me',
                          score: resultTime,
                          isCurrentAttempt: true,
                          realRank: myRank
                        };
                        
                        // 점수 순서에 맞게 삽입 위치 찾기
                        const insertIndex = displayList.findIndex(e => e.score > resultTime);
                        if (insertIndex === -1) {
                          displayList.push(currentEntry);
                        } else {
                          displayList.splice(insertIndex, 0, currentEntry);
                        }
                      }

                      return (
                        <>
                          {displayList.map((entry, index) => {
                            const isUserAccount = user && entry.uid === user.uid;
                            const isActualBest = isUserAccount && !entry.isCurrentAttempt && (entry.realRank === (myBestIndex + 1));
                            const isCurrentAttempt = entry.isCurrentAttempt || (isUserAccount && entry.score === resultTime);
                            
                            return (
                                <tr 
                                  key={`${index}-${entry.score}`} 
                                  ref={isCurrentAttempt ? currentRankRef : null}
                                  className={`
                                    ${isActualBest ? 'highlight-best' : ''} 
                                    ${isCurrentAttempt ? 'highlight-current' : ''}
                                  `}
                                >
                                <td className="rank-col">
                                  {entry.realRank === 1 ? '🥇' : entry.realRank === 2 ? '🥈' : entry.realRank === 3 ? '🥉' : entry.realRank}
                                </td>
                                <td className="name-col">
                                  <div className="name-wrapper">
                                    {isCurrentAttempt && <span className="current-arrow">▶</span>}
                                    <span className="player-name">{entry.displayName}</span>
                                    {isActualBest && <span className="rank-badge badge-best">🏆 {t('best')}</span>}
                                    {isCurrentAttempt && <span className="rank-badge badge-current">✨ {t('current')}</span>}
                                  </div>
                                </td>
                                <td className="score-col">{entry.score} ms</td>
                              </tr>
                            );
                          })}

                          {/* 100위 밖인 경우만 하단에 별도 표시 */}
                          {user && myRank > 100 && !isCurrentInList && (
                            <>
                              <tr>
                                <td colSpan="3" style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.8rem', padding: '12px' }}>•••</td>
                              </tr>
                              <tr className="highlight-current" ref={currentRankRef}>
                                <td className="rank-col">{myRank}</td>
                                <td className="name-col">
                                  <div className="name-wrapper">
                                    <span className="current-arrow">▶</span>
                                    <span className="player-name">{user.displayName || 'Me'}</span>
                                    <span className="rank-badge badge-current">✨ {t('current')}</span>
                                  </div>
                                </td>
                                <td className="score-col">{resultTime} ms</td>
                              </tr>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              )}
            </div>

            <button className="retry-btn" onClick={resetTest} style={{ width: '100%', marginBottom: '0' }}>
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
              <div style={{ flex: 1 }}>
                <h2>🏆 {t('fullRanking')}</h2>
                <p className="full-ranking-subtitle">{t('fullRankingSubtitle')}</p>
              </div>
              <button className="full-ranking-close-btn" onClick={handleCloseFullRanking}>
                ✕
              </button>
            </div>

            {/* 디바이스 탭 메뉴 */}
            <div className="ranking-tabs">
              <button 
                className={`tab-btn ${deviceTab === 'all' ? 'active' : ''}`} 
                onClick={(e) => { e.stopPropagation(); setDeviceTab('all'); }}
              >
                {t('tab_all')}
              </button>
              <button 
                className={`tab-btn ${deviceTab === 'mobile' ? 'active' : ''}`} 
                onClick={(e) => { e.stopPropagation(); setDeviceTab('mobile'); }}
              >
                {t('tab_mobile')}
              </button>
              <button 
                className={`tab-btn ${deviceTab === 'desktop' ? 'active' : ''}`} 
                onClick={(e) => { e.stopPropagation(); setDeviceTab('desktop'); }}
              >
                {t('tab_desktop')}
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
                      <th className="rank-col">{t('rank')}</th>
                      <th className="name-col">{t('name')}</th>
                      <th className="device-col">기기</th>
                      <th className="score-col">{t('score')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fullRankingList.length > 0 ? (
                      fullRankingList.map((entry, index) => (
                        <tr 
                          key={index} 
                          className={`full-ranking-row ${entry.uid === user?.uid ? 'highlight' : ''}`}
                        >
                          <td className="rank-col">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                          </td>
                          <td className="full-rank-name">{entry.displayName}</td>
                          <td className="device-col">
                            {entry.device === 'desktop' ? '💻 PC' : entry.device === 'mobile' ? '📱 Mobile' : '—'}
                          </td>
                          <td className="full-rank-score">{entry.score} ms</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                          데이터가 없습니다.
                        </td>
                      </tr>
                    )}
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
