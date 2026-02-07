/**
 * Sound effects utility for AI Town
 * Uses Web Audio API for lightweight procedural sounds
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
    const ctx = getAudioContext();
    for (let i = 0; i < notes; i++) {
      setTimeout(() => {
        const freq = baseFreq * Math.pow(1.2, i);
        playBeep(freq, 0.15, 0.2);
      }, i * 100);
    }
  } catch {}
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
