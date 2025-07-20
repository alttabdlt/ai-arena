import { useEffect, useState } from 'react';
import { PointEvent } from '@/poker/scoring/point-scoring';
import { Trophy, Zap, TrendingUp, Shield, Target, AlertTriangle, Star, Coins } from 'lucide-react';

interface PointNotificationProps {
  events: PointEvent[];
}

const getIconForCategory = (category: string) => {
  switch (category) {
    case 'chips':
      return <Coins className="h-5 w-5" />;
    case 'unconventional':
      return <Star className="h-5 w-5" />;
    case 'bluff':
      return <Zap className="h-5 w-5" />;
    case 'comeback':
      return <TrendingUp className="h-5 w-5" />;
    case 'david_goliath':
      return <Shield className="h-5 w-5" />;
    case 'elimination':
      return <Target className="h-5 w-5" />;
    case 'misread':
    case 'illogical':
    case 'passive':
    case 'predictable':
      return <AlertTriangle className="h-5 w-5" />;
    default:
      return <Trophy className="h-5 w-5" />;
  }
};

const getColorForType = (type: 'base' | 'style' | 'penalty', points: number) => {
  if (type === 'penalty' || points < 0) {
    return 'from-red-600 to-red-800 border-red-500';
  }
  switch (type) {
    case 'base':
      return 'from-blue-600 to-blue-800 border-blue-500';
    case 'style':
      return 'from-purple-600 to-purple-800 border-purple-500';
    default:
      return 'from-gray-600 to-gray-800 border-gray-500';
  }
};

const getTextColorForType = (type: 'base' | 'style' | 'penalty', points: number) => {
  if (type === 'penalty' || points < 0) {
    return 'text-red-100';
  }
  switch (type) {
    case 'base':
      return 'text-blue-100';
    case 'style':
      return 'text-purple-100';
    default:
      return 'text-gray-100';
  }
};

export function PointNotification({ events }: PointNotificationProps) {
  const [visibleEvents, setVisibleEvents] = useState<(PointEvent & { id: number; isVisible: boolean })[]>([]);
  const [nextId, setNextId] = useState(0);

  useEffect(() => {
    if (events.length > 0) {
      // Filter out routine chip updates to reduce spam
      const filteredEvents = events.filter(event => {
        // Skip routine chip updates (base points from chips)
        if (event.type === 'base' && event.category === 'chips') {
          return false;
        }
        return true;
      });
      
      if (filteredEvents.length === 0) return;
      
      const newEvents = filteredEvents.map((event, index) => ({
        ...event,
        id: nextId + index,
        isVisible: false
      }));
      
      setVisibleEvents(prev => [...prev, ...newEvents]);
      setNextId(prev => prev + filteredEvents.length);

      // Animate in with stagger
      newEvents.forEach((event, index) => {
        setTimeout(() => {
          setVisibleEvents(prev => 
            prev.map(e => e.id === event.id ? { ...e, isVisible: true } : e)
          );
        }, index * 100);
      });

      // Animate out after delay
      const baseDelay = 3000;
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
          }, index * 50);
        });
      }, baseDelay);

      return () => clearTimeout(timer);
    }
  }, [events]);

  return (
    <div className="fixed top-24 left-8 z-50 space-y-3 pointer-events-none">
      {visibleEvents.map((event) => {
        const isNegative = event.points < 0;
        const displayPoints = isNegative ? event.points : `+${event.points}`;
        
        return (
          <div
            key={event.id}
            className={`transition-all duration-300 transform ${
              event.isVisible 
                ? 'opacity-100 translate-x-0 scale-100' 
                : 'opacity-0 -translate-x-24 scale-75'
            }`}
          >
            <div className={`
              bg-gradient-to-r ${getColorForType(event.type, event.points)} 
              text-white rounded-lg shadow-xl p-3 min-w-[280px] max-w-[350px]
              border-l-4 ${getColorForType(event.type, event.points).split(' ')[2]}
            `}>
              <div className="flex items-center gap-3">
                <div className={`${getTextColorForType(event.type, event.points)} opacity-90`}>
                  {getIconForCategory(event.category)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-lg">
                      {displayPoints} points
                    </div>
                    <div className={`text-xs ${getTextColorForType(event.type, event.points)} opacity-80 uppercase`}>
                      {event.type}
                    </div>
                  </div>
                  <div className={`text-sm ${getTextColorForType(event.type, event.points)} opacity-90`}>
                    {event.description}
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