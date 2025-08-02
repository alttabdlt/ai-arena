import React from 'react';
import { 
  formatChips, 
  getCardColor, 
  getCardDisplayValue, 
  getPhaseDisplayName,
  shouldShowCard 
} from '@game/engine/games/poker/utils/poker-helpers';
import type { Card as PokerCard, PokerPhase } from '@game/engine/games/poker/PokerTypes';
import { motion } from 'framer-motion';

interface PokerCommunityCardsProps {
  communityCards: PokerCard[];
  pot: number;
  currentBet: number;
  phase: PokerPhase;
}

export const PokerCommunityCards: React.FC<PokerCommunityCardsProps> = ({
  communityCards,
  pot,
  currentBet,
  phase
}) => {
  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
      <div className="text-center mb-4">
        {/* Pot Display */}
        <motion.div 
          className="text-white text-lg font-bold mb-2"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 0.3 }}
          key={pot}
        >
          Pot: {formatChips(pot)} chips
        </motion.div>
        
        {/* Community Cards */}
        <div className="flex gap-2 justify-center">
          {[0, 1, 2, 3, 4].map((index) => {
            const card = communityCards[index];
            const showCard = shouldShowCard(index, phase, communityCards.length);
            
            if (showCard && card) {
              const { rank, suit } = getCardDisplayValue(card);
              const color = getCardColor(card);
              return (
                <motion.div
                  key={index}
                  initial={{ rotateY: 180, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{ 
                    duration: 0.6, 
                    delay: index * 0.1,
                    type: "spring",
                    stiffness: 100
                  }}
                  className="w-12 h-16 bg-white rounded border-2 border-gray-300 flex items-center justify-center font-bold shadow-lg"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <span className={`text-lg ${color === 'red' ? 'text-red-600' : 'text-black'}`}>
                    {rank}{suit}
                  </span>
                </motion.div>
              );
            }
            
            return (
              <div
                key={index}
                className="w-12 h-16 bg-blue-800 rounded border-2 border-blue-600 shadow-lg opacity-50"
              />
            );
          })}
        </div>
        
        {/* Phase Display */}
        <div className="text-green-200 text-sm mt-2">
          {getPhaseDisplayName(phase)}
        </div>
        
        {/* Current Bet Display */}
        {currentBet > 0 && (
          <motion.div 
            className="text-yellow-300 text-sm mt-1"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            Current Bet: {formatChips(currentBet)} chips
          </motion.div>
        )}
      </div>
    </div>
  );
};