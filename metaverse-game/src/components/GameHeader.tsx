import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Coins, TrendingUp } from 'lucide-react';
import BotSelector from './BotSelector';

interface GameHeaderProps {
  tokens?: number;
  selectedBotId?: string;
  onBotSelect?: (bot: any) => void;
}

export default function GameHeader({ tokens = 1234567, selectedBotId, onBotSelect }: GameHeaderProps) {
  const [displayTokens, setDisplayTokens] = useState(tokens);
  const [prevTokens, setPrevTokens] = useState(tokens);

  // Animate token counter
  useEffect(() => {
    if (tokens !== prevTokens) {
      const difference = tokens - prevTokens;
      const steps = 20;
      const increment = difference / steps;
      let current = prevTokens;

      const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= tokens) || (increment < 0 && current <= tokens)) {
          setDisplayTokens(tokens);
          clearInterval(timer);
        } else {
          setDisplayTokens(Math.floor(current));
        }
      }, 50);

      setPrevTokens(tokens);
      return () => clearInterval(timer);
    }
  }, [tokens, prevTokens]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const handleBackToArena = () => {
    window.location.href = 'http://localhost:8080';
  };

  return (
    <motion.header 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative w-full h-20 bg-gradient-to-b from-black via-gray-900 to-transparent backdrop-blur-md border-b border-red-900/30 flex-shrink-0"
    >
      {/* Animated background pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {/* Create a dot pattern background */}
          <div 
            className="absolute inset-0" 
            style={{
              backgroundImage: 'radial-gradient(circle, #ff0040 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}
          />
        </div>
      </div>

      <div className="relative flex items-center justify-between h-full px-8 mx-auto w-full">
        {/* Left Section - Back Button */}
        <motion.button
          onClick={handleBackToArena}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="group flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-red-900/50 to-red-800/30 hover:from-red-800/60 hover:to-red-700/40 border border-red-700/50 rounded-lg transition-all duration-200 shadow-lg hover:shadow-red-900/50"
        >
          <ArrowLeft className="w-5 h-5 text-red-400 group-hover:text-red-300 transition-colors" />
          <span className="text-sm font-bold text-gray-200 group-hover:text-white uppercase tracking-wider">
            Back to Arena
          </span>
        </motion.button>

        {/* Center Section - Game Title */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            <motion.h1 
              animate={{ 
                textShadow: [
                  "0 0 20px rgba(255,0,64,0.5)",
                  "0 0 30px rgba(255,0,64,0.8)",
                  "0 0 20px rgba(255,0,64,0.5)"
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-4xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-red-400 to-red-600"
              style={{ fontFamily: "'Bebas Neue', 'Arial Black', sans-serif", letterSpacing: '0.1em' }}
            >
              Crime City
            </motion.h1>
            <div className="text-xs uppercase tracking-widest text-red-400/60 text-center mt-1">
              Metaverse
            </div>
          </motion.div>
        </div>

        {/* Right Section - Token Display */}
        <div className="flex items-center gap-6">
          {/* Token Counter */}
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="relative flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-yellow-900/40 to-amber-900/30 border border-yellow-700/50 rounded-lg shadow-lg"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-yellow-500/20 to-amber-500/20 blur-xl"></div>
            
            <div className="relative flex items-center gap-3">
              {/* Token Icon */}
              <div className="relative">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full blur-md"
                ></motion.div>
                <Coins className="relative w-6 h-6 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" />
              </div>

              {/* Token Amount */}
              <div className="flex flex-col">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Blood Tokens</span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={displayTokens}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    className="text-xl font-black text-yellow-400 tabular-nums"
                    style={{ fontFamily: "'Roboto Mono', monospace" }}
                  >
                    {formatNumber(displayTokens)}
                  </motion.span>
                </AnimatePresence>
              </div>

              {/* Trend Indicator */}
              {tokens > prevTokens && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="flex items-center text-green-400"
                >
                  <TrendingUp className="w-4 h-4" />
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Bot Selector */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Watching</span>
              <BotSelector 
                selectedBotId={selectedBotId}
                onBotSelect={onBotSelect || (() => {})}
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom border glow */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-600/50 to-transparent"></div>
    </motion.header>
  );
}