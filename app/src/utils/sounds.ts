/**
 * Sound effects utility for AI Town
 * Uses Web Audio API for lightweight procedural sounds
 */

let audioContext: AudioContext | null = null;
type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

function getAudioContext(): AudioContext {
  if (!audioContext) {
    const Ctor = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!Ctor) throw new Error('Web Audio API not available');
    audioContext = new Ctor();
  }
  return audioContext;
}

// Simple beep sound
function playBeep(frequency: number, duration: number, volume: number = 0.3) {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch {
    // Silently fail if audio not available
  }
}

// Chime sound (ascending notes)
function playChime(baseFreq: number = 440, notes: number = 3) {
  try {
    for (let i = 0; i < notes; i++) {
      setTimeout(() => {
        const freq = baseFreq * Math.pow(1.2, i);
        playBeep(freq, 0.15, 0.2);
      }, i * 100);
    }
  } catch {
    return;
  }
}

// Sound effects for different events
export const sounds = {
  // Swap notification
  swap: () => playBeep(880, 0.1, 0.2),

  // Buy ARENA
  buy: () => playChime(523, 3), // C5 ascending

  // Sell ARENA
  sell: () => {
    playBeep(440, 0.08, 0.2);
    setTimeout(() => playBeep(330, 0.08, 0.2), 80);
  },

  // Building complete
  buildComplete: () => {
    playChime(659, 4); // E5 ascending
  },

  // Town complete (fanfare)
  townComplete: () => {
    const notes = [523, 659, 784, 1047]; // C E G C
    notes.forEach((freq, i) => {
      setTimeout(() => playBeep(freq, 0.3, 0.25), i * 150);
    });
  },

  // Agent action
  action: () => playBeep(660, 0.05, 0.15),

  // Click/select
  click: () => playBeep(1200, 0.03, 0.1),

  // Error
  error: () => {
    playBeep(200, 0.15, 0.3);
    setTimeout(() => playBeep(150, 0.2, 0.3), 100);
  },

  // Notification
  notify: () => {
    playBeep(800, 0.08, 0.2);
    setTimeout(() => playBeep(1000, 0.08, 0.2), 100);
  },

  // Degen Mode sounds
  kaChing: () => {
    // Ascending coin jingle
    const notes = [784, 988, 1175, 1319]; // G5 B5 D6 E6
    notes.forEach((freq, i) => {
      setTimeout(() => playBeep(freq, 0.12, 0.2), i * 70);
    });
  },

  bigWin: () => {
    // Fanfare + bass
    playBeep(262, 0.3, 0.25); // Bass C4
    const fanfare = [523, 659, 784, 1047, 1319]; // C E G C E
    fanfare.forEach((freq, i) => {
      setTimeout(() => playBeep(freq, 0.2, 0.22), 100 + i * 120);
    });
  },

  womp: () => {
    // Descending trombone
    const notes = [440, 370, 311, 262]; // A4 -> C4
    notes.forEach((freq, i) => {
      setTimeout(() => playBeep(freq, 0.18, 0.25), i * 120);
    });
  },

  stake: () => {
    // Satisfying lock/click
    playBeep(1400, 0.04, 0.15);
    setTimeout(() => playBeep(880, 0.08, 0.2), 50);
  },

  prediction: () => {
    // Quick suspenseful riser
    const notes = [330, 392, 466, 554, 660];
    notes.forEach((freq, i) => {
      setTimeout(() => playBeep(freq, 0.06, 0.12), i * 50);
    });
  },

  cardFlip: () => {
    // Short click
    playBeep(1800, 0.02, 0.12);
    setTimeout(() => playBeep(2200, 0.015, 0.08), 30);
  },

  allIn: () => {
    // Dramatic bass hit
    playBeep(100, 0.3, 0.35);
    setTimeout(() => playBeep(150, 0.25, 0.25), 50);
    setTimeout(() => playBeep(800, 0.1, 0.15), 100);
  },

  countdown: () => {
    // Tick
    playBeep(1000, 0.03, 0.15);
  },

  // Game spectator sounds
  phaseTransition: () => {
    // Two-note chime
    playBeep(660, 0.12, 0.2);
    setTimeout(() => playBeep(880, 0.15, 0.22), 100);
  },

  chipSlide: () => {
    // 3-note ascending
    const notes = [400, 600, 800];
    notes.forEach((freq, i) => {
      setTimeout(() => playBeep(freq, 0.08, 0.15), i * 60);
    });
  },

  envelopeOpen: () => {
    // Descending burst
    playBeep(2000, 0.04, 0.12);
    setTimeout(() => playBeep(1600, 0.05, 0.14), 40);
    setTimeout(() => playBeep(1200, 0.08, 0.16), 80);
  },

  rpsThrow: () => {
    // Whoosh + impact
    playBeep(600, 0.06, 0.15);
    setTimeout(() => playBeep(400, 0.12, 0.2), 60);
  },

  confetti: () => {
    // Short ascending glitter
    const notes = [800, 1000, 1200, 1500, 1800];
    notes.forEach((freq, i) => {
      setTimeout(() => playBeep(freq, 0.04, 0.08), i * 40);
    });
  },
};

// Enable/disable sounds
let soundEnabled = true;

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

// Wrapper that respects sound setting
export function playSound(sound: keyof typeof sounds) {
  if (soundEnabled) {
    sounds[sound]();
  }
}
