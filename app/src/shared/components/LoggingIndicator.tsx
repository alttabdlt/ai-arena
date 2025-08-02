import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function LoggingIndicator() {
  const [logCount, setLogCount] = useState(0);
  const [showPulse, setShowPulse] = useState(false);

  useEffect(() => {
    // Listen for new logs
    const handleNewLog = () => {
      // Defer state updates to avoid updating during another component's render
      setTimeout(() => {
        setLogCount(prev => prev + 1);
        setShowPulse(true);
        setTimeout(() => setShowPulse(false), 500);
      }, 0);
    };

    window.addEventListener('debug-log-added', handleNewLog);
    return () => window.removeEventListener('debug-log-added', handleNewLog);
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 pointer-events-none">
      <div className="relative">
        <motion.div
          className="bg-green-500/20 backdrop-blur-sm border border-green-500/50 rounded-full px-3 py-1 flex items-center gap-2"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="relative">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <AnimatePresence>
              {showPulse && (
                <motion.div
                  className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full"
                  initial={{ scale: 1, opacity: 1 }}
                  animate={{ scale: 3, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                />
              )}
            </AnimatePresence>
          </div>
          <span className="text-xs text-green-500 font-medium">
            Logging Active
          </span>
          {logCount > 0 && (
            <span className="text-xs text-green-400">
              ({logCount})
            </span>
          )}
        </motion.div>
      </div>
    </div>
  );
}