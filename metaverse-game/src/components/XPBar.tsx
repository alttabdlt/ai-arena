import React from 'react';
import { Star, Sparkles, TrendingUp } from 'lucide-react';

interface XPBarProps {
  currentXP: number;
  requiredXP: number;
  level: number;
  prestige?: number;
  recentGain?: number;
  className?: string;
  showLabels?: boolean;
  compact?: boolean;
}

export default function XPBar({
  currentXP,
  requiredXP,
  level,
  prestige = 0,
  recentGain,
  className = '',
  showLabels = true,
  compact = false
}: XPBarProps) {
  const percentage = Math.min((currentXP / requiredXP) * 100, 100);
  
  // Color gradient based on level ranges
  const getBarColor = (level: number) => {
    if (level >= 50) return 'from-purple-500 to-pink-500'; // Master
    if (level >= 30) return 'from-blue-500 to-purple-500';  // Expert
    if (level >= 15) return 'from-green-500 to-blue-500';   // Intermediate
    if (level >= 5) return 'from-yellow-500 to-green-500';  // Novice
    return 'from-gray-400 to-yellow-500';                    // Beginner
  };
  
  const getLevelColor = (level: number) => {
    if (level >= 50) return 'text-purple-400 border-purple-400';
    if (level >= 30) return 'text-blue-400 border-blue-400';
    if (level >= 15) return 'text-green-400 border-green-400';
    if (level >= 5) return 'text-yellow-400 border-yellow-400';
    return 'text-gray-400 border-gray-400';
  };
  
  const barColor = getBarColor(level);
  const levelColor = getLevelColor(level);
  
  if (compact) {
    return (
      <div className={`relative ${className}`}>
        {/* Compact bar */}
        <div className="flex items-center gap-2">
          {/* Level badge */}
          <div className={`flex items-center ${levelColor}`}>
            <span className="text-xs font-bold">Lv{level}</span>
            {prestige > 0 && (
              <Star className="w-3 h-3 ml-0.5 fill-current" />
            )}
          </div>
          
          {/* XP bar */}
          <div className="flex-1 relative h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${barColor} rounded-full transition-all duration-500 ease-out`}
              style={{ width: `${percentage}%` }}
            />
            {recentGain && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-green-400 animate-pulse">
                  +{recentGain}
                </span>
              </div>
            )}
          </div>
          
          {/* XP text */}
          <span className="text-[10px] text-gray-400 whitespace-nowrap">
            {currentXP}/{requiredXP}
          </span>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`space-y-2 ${className}`}>
      {showLabels && (
        <div className="flex items-center justify-between">
          {/* Level with prestige */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 px-2 py-0.5 border rounded-lg ${levelColor}`}>
              <TrendingUp className="w-3 h-3" />
              <span className="text-sm font-bold">Level {level}</span>
              {prestige > 0 && (
                <div className="flex items-center">
                  {Array.from({ length: Math.min(prestige, 5) }).map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-current text-yellow-400" />
                  ))}
                  {prestige > 5 && (
                    <span className="text-xs text-yellow-400 ml-1">+{prestige - 5}</span>
                  )}
                </div>
              )}
            </div>
            {recentGain && (
              <div className="flex items-center gap-1 text-green-400 animate-pulse">
                <Sparkles className="w-3 h-3" />
                <span className="text-xs font-bold">+{recentGain} XP</span>
              </div>
            )}
          </div>
          
          {/* XP text */}
          <span className="text-xs text-gray-400">
            {currentXP.toLocaleString()} / {requiredXP.toLocaleString()} XP
          </span>
        </div>
      )}
      
      {/* Progress bar */}
      <div className="relative">
        <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className="h-full w-full bg-gradient-to-r from-transparent via-white to-transparent animate-pulse" />
          </div>
          
          {/* Progress fill */}
          <div 
            className={`absolute inset-y-0 left-0 bg-gradient-to-r ${barColor} rounded-full transition-all duration-700 ease-out shadow-lg`}
            style={{ width: `${percentage}%` }}
          >
            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white opacity-20" />
          </div>
          
          {/* Percentage text overlay */}
          {percentage > 10 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white drop-shadow-md">
                {Math.floor(percentage)}%
              </span>
            </div>
          )}
        </div>
        
        {/* XP milestone markers */}
        {!compact && (
          <div className="absolute inset-x-0 top-0 h-3 flex items-center">
            {[25, 50, 75].map(milestone => (
              <div
                key={milestone}
                className="absolute h-2 w-px bg-gray-600"
                style={{ left: `${milestone}%` }}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Next level preview */}
      {!compact && showLabels && level < 100 && (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <span>Next: Level {level + 1}</span>
          <span className="text-gray-600">•</span>
          <span>{requiredXP - currentXP} XP needed</span>
        </div>
      )}
    </div>
  );
}