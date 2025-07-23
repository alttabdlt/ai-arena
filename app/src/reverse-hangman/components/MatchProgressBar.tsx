import * as React from 'react';

interface MatchProgressBarProps {
  matchPercentage: number;
  attemptsUsed: number;
  maxAttempts: number;
  matchType?: 'exact' | 'near' | 'partial' | 'semantic' | 'incorrect';
}

export function MatchProgressBar({ 
  matchPercentage, 
  attemptsUsed, 
  maxAttempts,
  matchType = 'incorrect'
}: MatchProgressBarProps) {
  const getProgressColor = () => {
    if (matchType === 'exact') return 'bg-green-500';
    if (matchType === 'near') return 'bg-emerald-500';
    if (matchType === 'partial') return 'bg-yellow-500';
    if (matchType === 'semantic') return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getProgressGlow = () => {
    if (matchPercentage >= 90) return 'shadow-lg shadow-green-500/50';
    if (matchPercentage >= 70) return 'shadow-md shadow-yellow-500/30';
    if (matchPercentage >= 50) return 'shadow-sm shadow-orange-500/20';
    return '';
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-700 font-medium">Match Progress</span>
        <span className="text-gray-900 font-bold">{matchPercentage.toFixed(1)}%</span>
      </div>
      
      <div className="relative">
        <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${getProgressColor()} transition-all duration-500 ease-out ${getProgressGlow()} relative`}
            style={{ width: `${matchPercentage}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </div>
        </div>
        
        <div className="absolute top-0 left-0 right-0 h-8 flex items-center justify-center pointer-events-none">
          <span className="text-xs font-medium text-gray-700">
            {matchType === 'exact' && '🎯 EXACT MATCH!'}
            {matchType === 'near' && '🔥 Very Close!'}
            {matchType === 'partial' && '✨ Getting Warmer'}
            {matchType === 'semantic' && '🤔 Similar Meaning'}
            {matchType === 'incorrect' && '❄️ Cold'}
          </span>
        </div>
      </div>
      
      <div className="flex justify-between items-center">
        <div className="flex gap-1">
          {Array.from({ length: maxAttempts }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i < attemptsUsed
                  ? matchPercentage > 70 ? 'bg-green-500' : 'bg-gray-400'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-gray-600">
          {attemptsUsed}/{maxAttempts} attempts
        </span>
      </div>
    </div>
  );
}