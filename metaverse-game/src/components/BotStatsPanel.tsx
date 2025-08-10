import React from 'react';
import { 
  TrendingUp, Shield, Swords, Heart, Zap, Trophy, Target, 
  DollarSign, Users, MapPin, Package, Star, Activity,
  Sparkles, Clock, Footprints, Gem
} from 'lucide-react';
import XPBar from './XPBar';

interface BotStats {
  // Basic Info
  name: string;
  personality: 'CRIMINAL' | 'GAMBLER' | 'WORKER';
  tokenId?: string;
  
  // Experience & Level
  level: number;
  currentXP: number;
  requiredXP: number;
  prestige: number;
  
  // Category XP
  categoryXP: {
    combat: number;
    social: number;
    exploration: number;
    achievement: number;
    robbery: number;
  };
  
  // Skills
  skills: {
    strength: number;
    agility: number;
    intelligence: number;
    charisma: number;
    luck: number;
  };
  
  // Movement & Energy
  totalSteps: number;
  dailySteps: number;
  stepStreak: number;
  currentEnergy: number;
  maxEnergy: number;
  energyRegenRate: number;
  
  // Combat & Crime
  powerBonus: number;
  defenseBonus: number;
  robberySuccess: number;
  robberyAttempts: number;
  combatWins: number;
  combatLosses: number;
  
  // Loot & Items
  totalLootDrops: number;
  itemsCollected: number;
  rareItemsFound: number;
  
  // Social
  conversations: number;
  alliances: number;
  enemies: number;
}

interface BotStatsPanelProps {
  stats: BotStats;
  className?: string;
}

// Generate a stable rank based on bot identifier (1-100)
const getStableRank = (identifier: string): number => {
  if (!identifier) return 1;
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = ((hash << 5) - hash) + identifier.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return (Math.abs(hash) % 100) + 1;
};

export default function BotStatsPanel({ stats, className = '' }: BotStatsPanelProps) {
  const getPersonalityColor = (personality: string) => {
    switch (personality) {
      case 'CRIMINAL': return 'text-red-400 bg-red-400/10 border-red-400/30';
      case 'GAMBLER': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
      case 'WORKER': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };
  
  const getSkillColor = (value: number) => {
    if (value >= 80) return 'text-purple-400';
    if (value >= 60) return 'text-blue-400';
    if (value >= 40) return 'text-green-400';
    if (value >= 20) return 'text-yellow-400';
    return 'text-gray-400';
  };
  
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };
  
  const robberyRate = stats.robberyAttempts > 0 
    ? Math.round((stats.robberySuccess / stats.robberyAttempts) * 100)
    : 0;
  
  const combatWinRate = (stats.combatWins + stats.combatLosses) > 0
    ? Math.round((stats.combatWins / (stats.combatWins + stats.combatLosses)) * 100)
    : 0;
    
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with name and personality */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-700">
        <div>
          <h3 className="text-lg font-bold text-gray-100">{stats.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getPersonalityColor(stats.personality)}`}>
              {stats.personality}
            </span>
            {stats.tokenId && (
              <span className="text-xs text-gray-500">#{stats.tokenId}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-bold text-yellow-400">
            Rank #{getStableRank(stats.tokenId || stats.name)}
          </span>
        </div>
      </div>
      
      {/* Level & XP */}
      <div>
        <XPBar
          currentXP={stats.currentXP}
          requiredXP={stats.requiredXP}
          level={stats.level}
          prestige={stats.prestige}
          showLabels={true}
          compact={false}
        />
      </div>
      
      {/* Category XP Breakdown */}
      <div className="bg-gray-800/30 rounded-lg p-3 space-y-2">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Category Experience
        </h4>
        {Object.entries(stats.categoryXP).map(([category, xp]) => {
          const icon = {
            combat: <Swords className="w-3 h-3" />,
            social: <Users className="w-3 h-3" />,
            exploration: <MapPin className="w-3 h-3" />,
            achievement: <Trophy className="w-3 h-3" />,
            robbery: <DollarSign className="w-3 h-3" />
          }[category];
          
          return (
            <div key={category} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">{icon}</span>
                <span className="text-xs capitalize text-gray-300">{category}</span>
              </div>
              <span className="text-xs font-medium text-gray-100">
                {formatNumber(xp)} XP
              </span>
            </div>
          );
        })}
      </div>
      
      {/* Skills */}
      <div className="bg-gray-800/30 rounded-lg p-3 space-y-2">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Skills
        </h4>
        {Object.entries(stats.skills).map(([skill, value]) => (
          <div key={skill} className="flex items-center justify-between">
            <span className="text-xs capitalize text-gray-300">{skill}</span>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r from-gray-500 ${getSkillColor(value)} rounded-full transition-all`}
                  style={{ width: `${value}%` }}
                />
              </div>
              <span className={`text-xs font-medium ${getSkillColor(value)}`}>
                {value}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      {/* Combat Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Swords className="w-3.5 h-3.5 text-red-400" />
            <h4 className="text-xs font-semibold text-gray-300">Combat</h4>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Power</span>
              <span className="text-red-400 font-medium">+{stats.powerBonus}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Defense</span>
              <span className="text-blue-400 font-medium">+{stats.defenseBonus}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Win Rate</span>
              <span className={`font-medium ${combatWinRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                {combatWinRate}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">W/L</span>
              <span className="text-gray-300">{stats.combatWins}/{stats.combatLosses}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-3.5 h-3.5 text-yellow-400" />
            <h4 className="text-xs font-semibold text-gray-300">Crime</h4>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Success</span>
              <span className={`font-medium ${robberyRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                {robberyRate}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Robberies</span>
              <span className="text-gray-300">{stats.robberyAttempts}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Successful</span>
              <span className="text-green-400">{stats.robberySuccess}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Movement & Energy */}
      <div className="bg-gray-800/30 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Footprints className="w-3.5 h-3.5 text-purple-400" />
          <h4 className="text-xs font-semibold text-gray-300">Movement & Energy</h4>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Total Steps</span>
            <span className="text-gray-300 font-medium">{formatNumber(stats.totalSteps)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Today</span>
            <span className="text-gray-300 font-medium">{formatNumber(stats.dailySteps)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Streak</span>
            <span className="text-orange-400 font-medium">{stats.stepStreak} days</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Energy</span>
            <span className="text-yellow-400 font-medium">
              {stats.currentEnergy}/{stats.maxEnergy}
            </span>
          </div>
        </div>
      </div>
      
      {/* Loot Stats */}
      <div className="bg-gray-800/30 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Package className="w-3.5 h-3.5 text-purple-400" />
          <h4 className="text-xs font-semibold text-gray-300">Loot Collection</h4>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-100">{formatNumber(stats.totalLootDrops)}</div>
            <div className="text-gray-400">Total Drops</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-400">{stats.itemsCollected}</div>
            <div className="text-gray-400">Items</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-purple-400">{stats.rareItemsFound}</div>
            <div className="text-gray-400">Rare</div>
          </div>
        </div>
      </div>
      
      {/* Social Stats */}
      <div className="bg-gray-800/30 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-3.5 h-3.5 text-green-400" />
          <h4 className="text-xs font-semibold text-gray-300">Social Network</h4>
        </div>
        <div className="flex justify-around text-xs">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-100">{stats.conversations}</div>
            <div className="text-gray-400">Conversations</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-400">{stats.alliances}</div>
            <div className="text-gray-400">Allies</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-400">{stats.enemies}</div>
            <div className="text-gray-400">Enemies</div>
          </div>
        </div>
      </div>
    </div>
  );
}