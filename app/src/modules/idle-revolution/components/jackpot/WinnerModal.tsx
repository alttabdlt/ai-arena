import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';

interface WinnerData {
  botId: string;
  botName: string;
  personality: 'CRIMINAL' | 'GAMBLER' | 'WORKER';
  amount: number;
  timestamp: string;
}

interface WinnerModalProps {
  winner: WinnerData | null;
  onClose: () => void;
}

export const WinnerModal: React.FC<WinnerModalProps> = ({ winner, onClose }) => {
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateWindowSize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    
    updateWindowSize();
    window.addEventListener('resize', updateWindowSize);
    
    return () => window.removeEventListener('resize', updateWindowSize);
  }, []);

  useEffect(() => {
    if (winner) {
      setShowConfetti(true);
      // Auto close after 10 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 10000);
      
      // Stop confetti after 5 seconds
      const confettiTimer = setTimeout(() => {
        setShowConfetti(false);
      }, 5000);
      
      return () => {
        clearTimeout(timer);
        clearTimeout(confettiTimer);
      };
    }
  }, [winner, onClose]);

  const getPersonalityEmoji = (personality: string) => {
    switch (personality) {
      case 'CRIMINAL': return '🔫';
      case 'GAMBLER': return '🎲';
      case 'WORKER': return '⚒️';
      default: return '🤖';
    }
  };

  const getPersonalityColor = (personality: string) => {
    switch (personality) {
      case 'CRIMINAL': return 'text-red-400';
      case 'GAMBLER': return 'text-purple-400';
      case 'WORKER': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <AnimatePresence>
      {winner && (
        <>
          {/* Confetti */}
          {showConfetti && (
            <Confetti
              width={windowSize.width}
              height={windowSize.height}
              numberOfPieces={500}
              recycle={false}
              colors={['#FFD700', '#FFA500', '#FF6347', '#FFE4B5', '#FFFF00']}
              gravity={0.3}
            />
          )}

          {/* Modal Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={onClose}
          >
            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotateY: -180 }}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotateY: 180 }}
              transition={{ type: "spring", damping: 15 }}
              className="bg-gradient-to-br from-yellow-900/90 to-yellow-600/90 rounded-2xl p-8 max-w-md mx-4 border-4 border-yellow-400 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Jackpot Won Header */}
              <motion.div
                className="text-center mb-6"
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{
                  duration: 0.5,
                  repeat: 3,
                  repeatType: "reverse"
                }}
              >
                <h2 className="text-5xl font-bold text-yellow-300 mb-2">
                  🎰 JACKPOT! 🎰
                </h2>
                <div className="text-2xl text-yellow-200">
                  WINNER WINNER CHICKEN DINNER!
                </div>
              </motion.div>

              {/* Winner Info */}
              <div className="bg-black/30 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-center mb-4">
                  <span className="text-4xl mr-3">
                    {getPersonalityEmoji(winner.personality)}
                  </span>
                  <div>
                    <div className={`text-2xl font-bold ${getPersonalityColor(winner.personality)}`}>
                      {winner.botName}
                    </div>
                    <div className="text-sm text-gray-400">
                      {winner.personality} Bot
                    </div>
                  </div>
                </div>

                {/* Amount Won */}
                <motion.div
                  className="text-center"
                  animate={{
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                >
                  <div className="text-sm text-yellow-600 mb-1">WON</div>
                  <div className="text-4xl font-bold text-yellow-300">
                    {winner.amount.toLocaleString()} $IDLE
                  </div>
                </motion.div>
              </div>

              {/* Fun Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-black/20 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-400">Odds Beaten</div>
                  <div className="text-lg font-bold text-yellow-400">1 in 1,000</div>
                </div>
                <div className="bg-black/20 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-400">Lucky Time</div>
                  <div className="text-lg font-bold text-yellow-400">
                    {new Date(winner.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              {/* Celebration Messages */}
              <motion.div
                className="text-center text-sm text-yellow-200"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {winner.personality === 'CRIMINAL' && "Crime does pay! 🔫💰"}
                {winner.personality === 'GAMBLER' && "The house doesn't always win! 🎲🎰"}
                {winner.personality === 'WORKER' && "Hard work finally pays off! ⚒️💪"}
              </motion.div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="mt-6 w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 px-6 rounded-lg transition-colors"
              >
                HELL YEAH! 🚀
              </button>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default WinnerModal;