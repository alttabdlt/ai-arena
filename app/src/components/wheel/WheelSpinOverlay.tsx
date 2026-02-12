/**
 * WheelSpinOverlay — Full-screen spinning wheel that selects the game type.
 * Shows during ANNOUNCING phase for ~3s before revealing the matchup.
 * 
 * Visual: Dark backdrop, glowing neon wheel with game types, 
 * spins and lands on the selected game, then fades to reveal VS card.
 */

import { useState, useEffect, useRef } from 'react';
import { playSound } from '../../utils/sounds';

const GAMES = [
  { name: 'POKER', emoji: '🃏', color: '#f59e0b' },
  { name: 'POKER', emoji: '🃏', color: '#10b981' },
  { name: 'POKER', emoji: '🃏', color: '#f59e0b' },
  { name: 'POKER', emoji: '🃏', color: '#8b5cf6' },
  { name: 'POKER', emoji: '🃏', color: '#f59e0b' },
  { name: 'POKER', emoji: '🃏', color: '#ef4444' },
];

interface WheelSpinOverlayProps {
  selectedGame: string;
  onComplete: () => void;
}

export function WheelSpinOverlay({ selectedGame, onComplete }: WheelSpinOverlayProps) {
  const [phase, setPhase] = useState<'spinning' | 'landed' | 'done'>('spinning');
  const [rotation, setRotation] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Calculate target rotation to land on selectedGame
    const targetIndex = GAMES.findIndex(g => g.name === selectedGame);
    const segmentAngle = 360 / GAMES.length;
    // Spin 3-5 full rotations + land on target
    const spins = 3 + Math.random() * 2;
    const targetRotation = spins * 360 + (360 - targetIndex * segmentAngle - segmentAngle / 2);
    
    setRotation(targetRotation);
    playSound('prediction');

    // Land after 2.5s
    const landTimer = setTimeout(() => {
      setPhase('landed');
      playSound('notify');
    }, 2500);
    // Complete after 3.5s
    const doneTimer = setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 3500);

    return () => { clearTimeout(landTimer); clearTimeout(doneTimer); };
  }, [selectedGame, onComplete]);

  if (phase === 'done') return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      {/* Pulsing background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[600px] rounded-full bg-purple-600/10 animate-pulse" />
      </div>

      {/* Title */}
      <div className="absolute top-[15%] text-center">
        <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 animate-pulse">
          ⚡ WHEEL OF FATE ⚡
        </div>
        <div className="text-sm text-purple-300/60 mt-2">
          {phase === 'spinning' ? 'Spinning...' : `${selectedGame}!`}
        </div>
      </div>

      {/* Wheel */}
      <div className="relative w-64 h-64">
        {/* Pointer */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 text-3xl drop-shadow-lg">
          ▼
        </div>

        {/* Spinning disc */}
        <div
          ref={wheelRef}
          className="w-64 h-64 rounded-full border-4 border-purple-500/60 shadow-[0_0_60px_rgba(168,85,247,0.4)] relative"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: 'transform 2.5s cubic-bezier(0.25, 0.1, 0.25, 1)',
          }}
        >
          {GAMES.map((game, i) => {
            const angle = (i * 360) / GAMES.length;
            const isSelected = phase === 'landed' && game.name === selectedGame;
            return (
              <div
                key={i}
                className="absolute w-full h-full"
                style={{ transform: `rotate(${angle}deg)` }}
              >
                <div
                  className={`absolute top-2 left-1/2 -translate-x-1/2 text-center transition-all duration-500 ${
                    isSelected ? 'scale-125' : ''
                  }`}
                >
                  <div className="text-2xl">{game.emoji}</div>
                  <div className="text-[10px] font-bold" style={{ color: game.color }}>{game.name}</div>
                </div>
              </div>
            );
          })}
          {/* Center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-slate-900 border-2 border-purple-400/60 flex items-center justify-center text-lg">
              🎡
            </div>
          </div>
        </div>
      </div>

      {/* Flash on land */}
      {phase === 'landed' && (
        <div className="absolute inset-0 bg-white/10 animate-ping pointer-events-none" style={{ animationDuration: '0.3s', animationIterationCount: 1 }} />
      )}
    </div>
  );
}
