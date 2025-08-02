import { useEffect, useState } from 'react';
import { PokerStyleBonus as StyleBonus } from '@game/engine/games/poker/scoring/PokerScoringSystem';
import { Trophy, Zap, TrendingUp, Shield, Target } from 'lucide-react';

interface StyleBonusNotificationProps {
  bonuses: StyleBonus[];
}

const getIconForBonus = (type: StyleBonus['type']) => {
  switch (type) {
    case 'david-goliath':
      return <Shield className="h-6 w-6" />;
    case 'bluff-master':
      return <Zap className="h-6 w-6" />;
    case 'unconventional':
      return <Trophy className="h-6 w-6" />;
    case 'comeback':
      return <TrendingUp className="h-6 w-6" />;
    case 'action-player':
      return <Target className="h-6 w-6" />;
    default:
      return <Trophy className="h-6 w-6" />;
  }
};

const getColorForBonus = (type: StyleBonus['type']) => {
  switch (type) {
    case 'david-goliath':
      return 'from-purple-500 to-purple-700';
    case 'bluff-master':
      return 'from-orange-500 to-orange-700';
    case 'unconventional':
      return 'from-yellow-500 to-yellow-700';
    case 'comeback':
      return 'from-green-500 to-green-700';
    case 'action-player':
      return 'from-blue-500 to-blue-700';
    default:
      return 'from-gray-500 to-gray-700';
  }
};

export function StyleBonusNotification({ bonuses }: StyleBonusNotificationProps) {
  const [visibleBonuses, setVisibleBonuses] = useState<(StyleBonus & { id: number; isVisible: boolean })[]>([]);
  const [nextId, setNextId] = useState(0);

  useEffect(() => {
    if (bonuses.length > 0) {
      const newBonuses = bonuses.map((bonus, index) => ({
        ...bonus,
        id: nextId + index,
        isVisible: false
      }));
      
      setVisibleBonuses(prev => [...prev, ...newBonuses]);
      setNextId(prev => prev + bonuses.length);

      // Animate in
      setTimeout(() => {
        setVisibleBonuses(prev => 
          prev.map(b => 
            newBonuses.find(nb => nb.id === b.id) ? { ...b, isVisible: true } : b
          )
        );
      }, 10);

      // Animate out
      const timer = setTimeout(() => {
        setVisibleBonuses(prev => 
          prev.map(b => 
            newBonuses.find(nb => nb.id === b.id) ? { ...b, isVisible: false } : b
          )
        );
        
        // Remove after transition
        setTimeout(() => {
          setVisibleBonuses(prev => prev.filter(b => !newBonuses.find(nb => nb.id === b.id)));
        }, 300);
      }, 3500);

      return () => clearTimeout(timer);
    }
  }, [bonuses]);

  return (
    <div className="fixed top-24 right-8 z-50 space-y-4">
      {visibleBonuses.map((bonus) => (
        <div
          key={bonus.id}
          className={`transition-all duration-300 transform ${
            bonus.isVisible 
              ? 'opacity-100 translate-x-0 scale-100' 
              : 'opacity-0 translate-x-24 scale-75'
          }`}
        >
          <div className={`bg-gradient-to-r ${getColorForBonus(bonus.type)} text-white rounded-lg shadow-xl p-4 min-w-[300px]`}>
            <div className="flex items-center gap-3">
              <div className="text-white/90">
                {getIconForBonus(bonus.type)}
              </div>
              <div className="flex-1">
                <div className="font-bold text-lg">+{bonus.points} Style Points!</div>
                <div className="text-sm text-white/90">{bonus.description}</div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}