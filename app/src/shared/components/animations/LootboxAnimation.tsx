import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@ui/button';
import { Card } from '@ui/card';
import { cn } from '@/lib/utils';
import { LootboxState, LootboxReward, RARITY_COLORS } from '@shared/types/lootbox';
import { Lootbox3D } from './Lootbox3D';
import { LootboxParticles } from './LootboxParticles';
import { LootboxRewardDisplay } from './LootboxReward';

interface LootboxAnimationProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => Promise<LootboxReward>;
  gameType: 'poker' | 'connect4' | 'reverse-hangman';
  winnerId: string;
  winnerName: string;
}

export const LootboxAnimation: React.FC<LootboxAnimationProps> = ({
  isOpen,
  onClose,
  onOpen,
  gameType,
  winnerId,
  winnerName
}) => {
  const [state, setState] = useState<LootboxState>({
    isOpen: false,
    isOpening: false,
    stage: 'idle',
    reward: null
  });

  const handleOpen = useCallback(async () => {
    setState(prev => ({ ...prev, isOpening: true, stage: 'appearing' }));
    
    // Stage 1: Box appears
    setTimeout(() => {
      setState(prev => ({ ...prev, stage: 'shaking' }));
    }, 1000);
    
    // Stage 2: Box shakes
    setTimeout(() => {
      setState(prev => ({ ...prev, stage: 'opening' }));
    }, 2500);
    
    // Fetch reward during animation
    const reward = await onOpen();
    
    // Stage 3: Reveal reward
    setTimeout(() => {
      setState(prev => ({ 
        ...prev, 
        stage: 'revealing',
        reward,
        isOpen: true 
      }));
    }, 4000);
    
    // Stage 4: Complete
    setTimeout(() => {
      setState(prev => ({ 
        ...prev, 
        stage: 'complete',
        isOpening: false 
      }));
    }, 5500);
  }, [onOpen]);

  const handleClose = useCallback(() => {
    setState({
      isOpen: false,
      isOpening: false,
      stage: 'idle',
      reward: null
    });
    onClose();
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Background overlay */}
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={state.stage === 'complete' ? handleClose : undefined}
          />
          
          {/* Main content */}
          <div className="relative z-10">
            {state.stage === 'idle' && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="text-center"
              >
                <Card className="p-8 bg-gray-900 border-gray-700">
                  <h2 className="text-3xl font-bold mb-4">
                    🎉 Victory Reward! 🎉
                  </h2>
                  <p className="text-lg text-gray-300 mb-6">
                    Congratulations {winnerName}!<br />
                    You've earned a lootbox for your victory.
                  </p>
                  <Button
                    size="lg"
                    onClick={handleOpen}
                    disabled={state.isOpening}
                    className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700"
                  >
                    Open Lootbox
                  </Button>
                </Card>
              </motion.div>
            )}
            
            {/* 3D Lootbox */}
            {['appearing', 'shaking', 'opening'].includes(state.stage) && (
              <div className="relative">
                <Lootbox3D
                  stage={state.stage as 'appearing' | 'shaking' | 'opening'}
                  rarity={state.reward?.item.rarity}
                />
                
                {/* Particle effects during opening */}
                {state.stage === 'opening' && (
                  <LootboxParticles
                    type="explosion"
                    color={state.reward ? RARITY_COLORS[state.reward.item.rarity] : '#FFF'}
                  />
                )}
              </div>
            )}
            
            {/* Reward reveal */}
            {['revealing', 'complete'].includes(state.stage) && state.reward && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
              >
                <LootboxRewardDisplay
                  reward={state.reward}
                  onContinue={handleClose}
                />
                
                {/* Celebration particles */}
                <LootboxParticles
                  type="celebration"
                  color={RARITY_COLORS[state.reward.item.rarity]}
                />
              </motion.div>
            )}
          </div>
          
          {/* Skip button (after initial animation) */}
          {state.isOpening && state.stage !== 'idle' && state.stage !== 'complete' && (
            <motion.div
              className="absolute bottom-8 right-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <Button
                variant="ghost"
                onClick={() => {
                  if (state.reward) {
                    setState(prev => ({ 
                      ...prev, 
                      stage: 'complete',
                      isOpening: false,
                      isOpen: true
                    }));
                  }
                }}
                className="text-gray-400 hover:text-white"
              >
                Skip Animation
              </Button>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};