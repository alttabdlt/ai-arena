import * as React from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@ui/button';
import { GameType, GAME_TYPE_INFO } from '@shared/types/tournament';

interface SpinWheelProps {
  onGameSelected: (gameType: GameType) => void;
}

export default function SpinWheel({ onGameSelected }: SpinWheelProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null);

  const enabledGames = Object.entries(GAME_TYPE_INFO)
    .filter(([_, info]) => !info.disabled)
    .map(([key, info]) => ({ key: key as GameType, ...info }));

  const segmentAngle = 360 / enabledGames.length;

  const handleSpin = () => {
    if (isSpinning || selectedGame) return;

    setIsSpinning(true);
    
    const spins = 5 + Math.random() * 3;
    const finalAngle = Math.random() * 360;
    const totalRotation = spins * 360 + finalAngle;
    
    setRotation(prev => prev + totalRotation);

    setTimeout(() => {
      const normalizedAngle = (360 - (finalAngle % 360) + segmentAngle / 2) % 360;
      const selectedIndex = Math.floor(normalizedAngle / segmentAngle);
      const selected = enabledGames[selectedIndex];
      
      setSelectedGame(selected.key);
      setIsSpinning(false);

      setTimeout(() => {
        onGameSelected(selected.key);
      }, 1000);
    }, 4000);
  };

  const getSegmentPath = (index: number) => {
    const startAngle = index * segmentAngle - 90;
    const endAngle = (index + 1) * segmentAngle - 90;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = 150 + 140 * Math.cos(startRad);
    const y1 = 150 + 140 * Math.sin(startRad);
    const x2 = 150 + 140 * Math.cos(endRad);
    const y2 = 150 + 140 * Math.sin(endRad);
    
    const largeArc = segmentAngle > 180 ? 1 : 0;
    
    return `M 150 150 L ${x1} ${y1} A 140 140 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  const getTextPosition = (index: number) => {
    const angle = index * segmentAngle + segmentAngle / 2 - 90;
    const rad = (angle * Math.PI) / 180;
    const x = 150 + 90 * Math.cos(rad);
    const y = 150 + 90 * Math.sin(rad);
    return { x, y, angle: angle + 90 };
  };

  return (
    <div className="flex flex-col items-center space-y-8 wheel-container">
      <div className="relative">
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2 z-20 wheel-pointer">
          <div className="w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-t-[40px] border-t-primary shadow-lg"></div>
        </div>

        <div className="relative w-[300px] h-[300px]">
          <svg
            width="300"
            height="300"
            className="transform transition-transform ease-out"
            style={{
              transform: `rotate(${rotation}deg)`,
              transitionDuration: '4000ms'
            }}
          >
            {enabledGames.map((game, index) => {
              const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
              const color = colors[index % colors.length];
              
              return (
                <g key={game.key}>
                  <path
                    d={getSegmentPath(index)}
                    fill={color}
                    stroke="white"
                    strokeWidth="3"
                    className={selectedGame === game.key ? 'animate-pulse' : ''}
                  />
                  
                  <g transform={`translate(${getTextPosition(index).x}, ${getTextPosition(index).y})`}>
                    <text
                      transform={`rotate(${getTextPosition(index).angle})`}
                      textAnchor="middle"
                      className="fill-white font-bold text-lg select-none"
                      dy="0.3em"
                    >
                      {game.icon}
                    </text>
                  </g>
                </g>
              );
            })}
            
            <circle cx="150" cy="150" r="30" fill="white" stroke="#e5e7eb" strokeWidth="3" />
            <circle cx="150" cy="150" r="140" fill="none" stroke="white" strokeWidth="3" strokeDasharray="5,5" opacity="0.3" />
          </svg>
        </div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`bg-white rounded-full p-4 shadow-lg ${selectedGame && !isSpinning ? 'wheel-celebration' : ''}`}>
            {selectedGame && !isSpinning && (
              <div className="text-4xl">
                {GAME_TYPE_INFO[selectedGame].icon}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="text-center space-y-4">
        {!selectedGame && (
          <>
            <h3 className="text-xl font-semibold">Spin to Select Game!</h3>
            <p className="text-gray-700">The wheel will randomly choose which game to play</p>
            <Button
              size="lg"
              onClick={handleSpin}
              disabled={isSpinning}
              className="min-w-[150px]"
            >
              {isSpinning ? 'Spinning...' : 'SPIN!'}
            </Button>
          </>
        )}
        
        {selectedGame && !isSpinning && (
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-primary">
              {GAME_TYPE_INFO[selectedGame].name}
            </h3>
            <p className="text-gray-700">
              {GAME_TYPE_INFO[selectedGame].description}
            </p>
            <p className="text-sm text-gray-600">Proceeding to configuration...</p>
          </div>
        )}
      </div>
    </div>
  );
}