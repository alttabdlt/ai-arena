import { useEffect, useState } from 'react';
import { AchievementEvent } from '@/poker/achievements/achievement-system';
import { Trophy, Star, Award, Crown } from 'lucide-react';

interface AchievementNotificationProps {
  events: AchievementEvent[];
  players: Map<string, { name: string; avatar: string }>;
}

const getRarityColor = (rarity: string) => {
  switch (rarity) {
    case 'common':
      return 'from-gray-600 to-gray-800 border-gray-500';
    case 'rare':
      return 'from-blue-600 to-blue-800 border-blue-500';
    case 'epic':
      return 'from-purple-600 to-purple-800 border-purple-500';
    case 'legendary':
      return 'from-yellow-600 to-amber-800 border-yellow-500';
    default:
      return 'from-gray-600 to-gray-800 border-gray-500';
  }
};

const getRarityIcon = (rarity: string) => {
  switch (rarity) {
    case 'common':
      return <Star className="h-5 w-5" />;
    case 'rare':
      return <Award className="h-5 w-5" />;
    case 'epic':
      return <Trophy className="h-5 w-5" />;
    case 'legendary':
      return <Crown className="h-5 w-5" />;
    default:
      return <Star className="h-5 w-5" />;
  }
};

const getRarityGlow = (rarity: string) => {
  switch (rarity) {
    case 'legendary':
      return 'animate-pulse shadow-lg shadow-yellow-500/50';
    case 'epic':
      return 'shadow-lg shadow-purple-500/30';
    case 'rare':
      return 'shadow-md shadow-blue-500/20';
    default:
      return '';
  }
};

export function AchievementNotification({ events, players }: AchievementNotificationProps) {
  const [visibleEvents, setVisibleEvents] = useState<(AchievementEvent & { id: number; isVisible: boolean })[]>([]);
  const [nextId, setNextId] = useState(0);

  useEffect(() => {
    if (events.length > 0) {
      const newEvents = events.map((event, index) => ({
        ...event,
        id: nextId + index,
        isVisible: false
      }));
      
      setVisibleEvents(prev => [...prev, ...newEvents]);
      setNextId(prev => prev + events.length);

      // Animate in with stagger
      newEvents.forEach((event, index) => {
        setTimeout(() => {
          setVisibleEvents(prev => 
            prev.map(e => e.id === event.id ? { ...e, isVisible: true } : e)
          );
        }, index * 200);
      });

      // Animate out after delay
      const baseDelay = 5000; // Show achievements longer than points
      const timer = setTimeout(() => {
        newEvents.forEach((event, index) => {
          setTimeout(() => {
            setVisibleEvents(prev => 
              prev.map(e => e.id === event.id ? { ...e, isVisible: false } : e)
            );
            
            // Remove after transition
            setTimeout(() => {
              setVisibleEvents(prev => prev.filter(e => e.id !== event.id));
            }, 300);
          }, index * 100);
        });
      }, baseDelay);

      return () => clearTimeout(timer);
    }
  }, [events]);

  return (
    <div className="fixed top-24 right-8 z-50 space-y-3 pointer-events-none">
      {visibleEvents.map((event) => {
        const player = players.get(event.playerId);
        if (!player) return null;
        
        return (
          <div
            key={event.id}
            className={`transition-all duration-500 transform ${
              event.isVisible 
                ? 'opacity-100 translate-x-0 scale-100' 
                : 'opacity-0 translate-x-24 scale-75'
            }`}
          >
            <div className={`
              bg-gradient-to-r ${getRarityColor(event.achievement.rarity)} 
              text-white rounded-lg shadow-2xl p-4 min-w-[320px] max-w-[400px]
              border-l-4 ${getRarityColor(event.achievement.rarity).split(' ')[2]}
              ${getRarityGlow(event.achievement.rarity)}
            `}>
              <div className="flex items-start gap-3">
                <div className="text-3xl flex-shrink-0">
                  {event.achievement.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-lg">Achievement Unlocked!</h3>
                    <div className="opacity-80">
                      {getRarityIcon(event.achievement.rarity)}
                    </div>
                  </div>
                  <div className="font-semibold text-xl mb-1">
                    {event.achievement.name}
                  </div>
                  <div className="text-sm opacity-90 mb-2">
                    {event.achievement.description}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img 
                        src={player.avatar} 
                        alt={player.name}
                        className="w-6 h-6 rounded-full"
                      />
                      <span className="text-sm font-medium">{player.name}</span>
                    </div>
                    <div className="text-sm font-bold">
                      +{event.achievement.points} pts
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}