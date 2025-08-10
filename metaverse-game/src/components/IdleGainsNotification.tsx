import React, { useState, useEffect } from 'react';
import { 
  X, TrendingUp, Package, Footprints, Zap, Clock, 
  Trophy, Sparkles, ChevronRight, Coins, Users, 
  Swords, DollarSign, Star
} from 'lucide-react';

interface IdleGains {
  timeAway: number; // milliseconds
  xpGained: number;
  levelsGained: number;
  stepsWalked: number;
  energyConsumed: number;
  lootCollected: {
    common: number;
    uncommon: number;
    rare: number;
    epic: number;
    legendary: number;
    total: number;
  };
  combatResults: {
    wins: number;
    losses: number;
  };
  robberyResults: {
    successful: number;
    failed: number;
    moneyStolen: number;
  };
  socialEvents: {
    conversations: number;
    newAlliances: number;
    newEnemies: number;
  };
  achievements?: string[];
}

interface IdleGainsNotificationProps {
  gains: IdleGains;
  botName: string;
  onClose: () => void;
  onViewDetails?: () => void;
  className?: string;
}

export default function IdleGainsNotification({
  gains,
  botName,
  onClose,
  onViewDetails,
  className = ''
}: IdleGainsNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  
  useEffect(() => {
    // Auto-collapse after 10 seconds if not interacted with
    const timer = setTimeout(() => {
      if (!isExpanded) {
        setIsVisible(false);
      }
    }, 10000);
    
    return () => clearTimeout(timer);
  }, [isExpanded]);
  
  if (!isVisible) return null;
  
  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };
  
  const getLootRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'text-orange-400';
      case 'epic': return 'text-purple-400';
      case 'rare': return 'text-blue-400';
      case 'uncommon': return 'text-green-400';
      case 'common': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };
  
  const hasSignificantGains = gains.xpGained > 0 || gains.lootCollected.total > 0 || 
                               gains.combatResults.wins > 0 || gains.robberyResults.successful > 0;
  
  return (
    <div 
      className={`
        fixed top-20 right-4 z-50 
        bg-gray-900 border rounded-lg shadow-2xl
        transition-all duration-300 ease-out
        ${isExpanded ? 'w-96 border-yellow-400/50' : 'w-80 border-gray-700'}
        ${className}
      `}
    >
      {/* Header */}
      <div className="p-3 border-b border-gray-700 bg-gradient-to-r from-gray-800/50 to-gray-900/50">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
              <h3 className="text-sm font-bold text-gray-100">Welcome Back!</h3>
            </div>
            <p className="text-xs text-gray-400">
              {botName} was active for {formatTime(gains.timeAway)}
            </p>
          </div>
          <button
            onClick={() => {
              setIsVisible(false);
              onClose();
            }}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Main Stats */}
      <div className="p-3 space-y-2">
        {/* XP & Level */}
        {gains.xpGained > 0 && (
          <div className="flex items-center justify-between p-2 bg-gradient-to-r from-purple-900/20 to-purple-800/10 rounded">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-gray-200">Experience</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-purple-400">+{gains.xpGained.toLocaleString()} XP</div>
              {gains.levelsGained > 0 && (
                <div className="text-xs text-yellow-400">+{gains.levelsGained} Level{gains.levelsGained > 1 ? 's' : ''}</div>
              )}
            </div>
          </div>
        )}
        
        {/* Loot */}
        {gains.lootCollected.total > 0 && (
          <div className="flex items-center justify-between p-2 bg-gradient-to-r from-blue-900/20 to-blue-800/10 rounded">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-gray-200">Loot Found</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-blue-400">{gains.lootCollected.total} Items</div>
              <div className="flex gap-1 justify-end mt-0.5">
                {gains.lootCollected.legendary > 0 && (
                  <span className="text-xs text-orange-400">L:{gains.lootCollected.legendary}</span>
                )}
                {gains.lootCollected.epic > 0 && (
                  <span className="text-xs text-purple-400">E:{gains.lootCollected.epic}</span>
                )}
                {gains.lootCollected.rare > 0 && (
                  <span className="text-xs text-blue-400">R:{gains.lootCollected.rare}</span>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Movement & Energy */}
        <div className="flex gap-2">
          <div className="flex-1 p-2 bg-gray-800/50 rounded">
            <div className="flex items-center gap-1.5 mb-1">
              <Footprints className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-400">Steps</span>
            </div>
            <div className="text-sm font-bold text-gray-200">{gains.stepsWalked.toLocaleString()}</div>
          </div>
          <div className="flex-1 p-2 bg-gray-800/50 rounded">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3 h-3 text-yellow-400" />
              <span className="text-xs text-gray-400">Energy Used</span>
            </div>
            <div className="text-sm font-bold text-yellow-400">-{gains.energyConsumed}</div>
          </div>
        </div>
        
        {/* Combat & Crime - Only show if there's activity */}
        {(gains.combatResults.wins > 0 || gains.combatResults.losses > 0 || 
          gains.robberyResults.successful > 0 || gains.robberyResults.failed > 0) && (
          <div className="pt-2 border-t border-gray-700">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-gray-300 transition-colors"
            >
              <span>View Details</span>
              <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </button>
          </div>
        )}
      </div>
      
      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 animate-in slide-in-from-top duration-200">
          {/* Combat Results */}
          {(gains.combatResults.wins > 0 || gains.combatResults.losses > 0) && (
            <div className="p-2 bg-gray-800/30 rounded">
              <div className="flex items-center gap-2 mb-1">
                <Swords className="w-3 h-3 text-red-400" />
                <span className="text-xs font-medium text-gray-300">Combat</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-green-400">Wins: {gains.combatResults.wins}</span>
                <span className="text-red-400">Losses: {gains.combatResults.losses}</span>
              </div>
            </div>
          )}
          
          {/* Robbery Results */}
          {(gains.robberyResults.successful > 0 || gains.robberyResults.failed > 0) && (
            <div className="p-2 bg-gray-800/30 rounded">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-3 h-3 text-yellow-400" />
                <span className="text-xs font-medium text-gray-300">Robberies</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-green-400">Success: {gains.robberyResults.successful}</span>
                  <span className="text-red-400">Failed: {gains.robberyResults.failed}</span>
                </div>
                {gains.robberyResults.moneyStolen > 0 && (
                  <div className="text-xs text-yellow-400">
                    Stolen: ${gains.robberyResults.moneyStolen.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Social Events */}
          {(gains.socialEvents.conversations > 0 || gains.socialEvents.newAlliances > 0 || 
            gains.socialEvents.newEnemies > 0) && (
            <div className="p-2 bg-gray-800/30 rounded">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-3 h-3 text-green-400" />
                <span className="text-xs font-medium text-gray-300">Social</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-gray-400">Chats</div>
                  <div className="text-gray-200 font-medium">{gains.socialEvents.conversations}</div>
                </div>
                <div>
                  <div className="text-gray-400">Allies</div>
                  <div className="text-green-400 font-medium">+{gains.socialEvents.newAlliances}</div>
                </div>
                <div>
                  <div className="text-gray-400">Enemies</div>
                  <div className="text-red-400 font-medium">+{gains.socialEvents.newEnemies}</div>
                </div>
              </div>
            </div>
          )}
          
          {/* Achievements */}
          {gains.achievements && gains.achievements.length > 0 && (
            <div className="p-2 bg-gradient-to-r from-yellow-900/20 to-yellow-800/10 rounded">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-3 h-3 text-yellow-400" />
                <span className="text-xs font-medium text-gray-300">New Achievements!</span>
              </div>
              <div className="space-y-1">
                {gains.achievements.map((achievement, idx) => (
                  <div key={idx} className="flex items-center gap-1 text-xs">
                    <Star className="w-3 h-3 text-yellow-400" />
                    <span className="text-gray-200">{achievement}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Action Buttons */}
      {hasSignificantGains && (
        <div className="p-3 pt-0">
          <button
            onClick={() => {
              onViewDetails?.();
              setIsVisible(false);
            }}
            className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
          >
            View Activity Logs
          </button>
        </div>
      )}
    </div>
  );
}