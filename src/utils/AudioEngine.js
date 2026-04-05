/**
 * Web Audio API를 이용한 효과음 생성 엔진
 * 외부 에셋 없이 순수 코드로 사운드를 구현합니다.
 */

let audioCtx = null;

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

const createOscillator = (freq, type, startTime, duration, volume = 0.1) => {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
};

export const playSound = (tier) => {
  initAudio();
  const now = audioCtx.currentTime;

  switch (tier) {
    case 't1': // Good (Pop)
      createOscillator(440, 'sine', now, 0.1, 0.2);
      break;
    
    case 't2': // Great (2-tone up)
      createOscillator(440, 'sine', now, 0.1, 0.15);
      createOscillator(660, 'sine', now + 0.1, 0.15, 0.15);
      break;

    case 't3': // Excellent (Impact)
      createOscillator(150, 'triangle', now, 0.2, 0.3); // Low thud
      createOscillator(880, 'sine', now, 0.05, 0.1); // High click
      break;

    case 't4': // Insane (Explosion + High tone)
      // Explosion feel (low freq noise)
      createOscillator(60, 'square', now, 0.5, 0.4);
      createOscillator(120, 'sawtooth', now, 0.3, 0.2);
      // Cheer feel (high chirps)
      for(let i=0; i<5; i++) {
        createOscillator(1000 + (i * 200), 'sine', now + 0.1 + (i * 0.05), 0.2, 0.05);
      }
      break;

    case 't5': // Lucky (Jackpot)
      // Slot machine feel
      for(let i=0; i<10; i++) {
        const freq = 400 + (Math.random() * 600);
        createOscillator(freq, 'square', now + (i * 0.1), 0.1, 0.05);
      }
      setTimeout(() => {
        createOscillator(880, 'sine', now + 1.1, 0.5, 0.2);
        createOscillator(1100, 'sine', now + 1.2, 0.5, 0.2);
      }, 100);
      break;

    default:
      break;
  }
};
