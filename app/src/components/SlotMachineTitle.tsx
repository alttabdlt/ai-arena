import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameType, GAME_TYPE_INFO } from '@/types/tournament';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SlotMachineTitleProps {
  onGameSelected: (gameType: GameType) => void;
  className?: string;
}

const SlotMachineTitle: React.FC<SlotMachineTitleProps> = ({ onGameSelected, className }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentGameIndex, setCurrentGameIndex] = useState(0);
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null);
  const [spinSpeed, setSpinSpeed] = useState(50); // milliseconds between changes
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const enabledGames = Object.entries(GAME_TYPE_INFO)
    .filter(([_, info]) => !info.disabled)
    .map(([key, info]) => ({ key: key as GameType, ...info }));

  const startSpinning = () => {
    if (isSpinning || selectedGame) return;
    
    setIsSpinning(true);
    setSpinSpeed(50);
    
    const targetIndex = Math.floor(Math.random() * enabledGames.length);
    const targetGame = enabledGames[targetIndex];
    
    let currentSpeed = 50;
    const totalDuration = 4000; // 4 seconds total
    const startTime = Date.now();
    
    const spin = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / totalDuration;
      
      // Exponential slowdown
      currentSpeed = 50 + (450 * Math.pow(progress, 3));
      
      setCurrentGameIndex(prev => (prev + 1) % enabledGames.length);
      
      if (elapsed >= totalDuration) {
        // Stop at target game
        setCurrentGameIndex(targetIndex);
        setSelectedGame(targetGame.key);
        setIsSpinning(false);
        
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        
        // Trigger game selection after a brief pause
        setTimeout(() => {
          onGameSelected(targetGame.key);
        }, 1500);
      } else {
        // Schedule next spin with new speed
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        intervalRef.current = setTimeout(spin, currentSpeed);
      }
    };
    
    // Start spinning
    spin();
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const currentGame = enabledGames[currentGameIndex];

  return (
    <div className={cn("flex flex-col items-center space-y-8", className)}>
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-muted-foreground">Select Game Mode</h2>
        <p className="text-sm text-muted-foreground">
          Let fate decide your competitive arena
        </p>
      </div>

      <div className="relative w-full max-w-md">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent blur-xl" />
        
        <div className="relative bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl p-8 border border-primary/20">
          <div className="h-24 flex items-center justify-center overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentGameIndex}
                initial={{ y: 100, opacity: 0, scale: 0.8 }}
                animate={{ 
                  y: 0, 
                  opacity: 1, 
                  scale: selectedGame ? 1.2 : 1,
                  rotate: selectedGame ? [0, 10] : 0
                }}
                exit={{ y: -100, opacity: 0, scale: 0.8 }}
                transition={{ 
                  duration: isSpinning ? 0.1 : 0.3,
                  type: isSpinning ? "tween" : "spring",
                  stiffness: 200,
                  damping: selectedGame ? 10 : 20,
                  mass: selectedGame ? 0.5 : 1
                }}
                className="flex flex-col items-center"
              >
                <span className={cn(
                  "text-6xl mb-2 transition-all duration-300",
                  selectedGame && "animate-bounce"
                )}>
                  {currentGame.icon}
                </span>
                <h3 className={cn(
                  "text-2xl font-bold transition-all duration-300",
                  selectedGame ? "text-primary" : "text-foreground"
                )}>
                  {currentGame.name}
                </h3>
              </motion.div>
            </AnimatePresence>
          </div>

          {selectedGame && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-center text-sm text-muted-foreground mt-4"
            >
              {currentGame.description}
            </motion.p>
          )}
        </div>

        {/* Visual effects during spinning */}
        {isSpinning && (
          <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent animate-pulse" />
            <div className="absolute -top-2 -left-2 -right-2 h-4 bg-gradient-to-b from-primary/40 to-transparent blur-md" />
            <div className="absolute -bottom-2 -left-2 -right-2 h-4 bg-gradient-to-t from-primary/40 to-transparent blur-md" />
          </div>
        )}
      </div>

      <div className="space-y-4 text-center">
        {!selectedGame && (
          <Button
            size="lg"
            onClick={startSpinning}
            disabled={isSpinning}
            className={cn(
              "min-w-[200px] relative overflow-hidden",
              isSpinning && "animate-pulse"
            )}
          >
            <span className="relative z-10">
              {isSpinning ? 'Selecting...' : 'Start Game Selection'}
            </span>
            {!isSpinning && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/20 to-primary/0"
                animate={{ x: [-200, 200] }}
                transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
              />
            )}
          </Button>
        )}

        {selectedGame && !isSpinning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-center gap-2 text-primary">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
              />
              <p className="text-sm font-medium">Preparing game configuration...</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Game type indicators */}
      <div className="flex items-center gap-2 opacity-50">
        {enabledGames.map((game, index) => (
          <div
            key={game.key}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              currentGameIndex === index 
                ? "bg-primary w-8" 
                : "bg-muted-foreground/30"
            )}
          />
        ))}
      </div>
    </div>
  );
};

export default SlotMachineTitle;