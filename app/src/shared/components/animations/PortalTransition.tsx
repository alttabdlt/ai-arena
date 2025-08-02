import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PortalTransitionProps {
  isActive: boolean;
  onComplete?: () => void;
  className?: string;
}

const PortalTransition: React.FC<PortalTransitionProps> = ({ 
  isActive, 
  onComplete,
  className 
}) => {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className={cn(
            "fixed inset-0 z-50 pointer-events-none",
            className
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Background fade */}
          <motion.div
            className="absolute inset-0 bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5, delay: 0.3 }}
          />

          {/* Portal vortex effect */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className="relative"
              initial={{ scale: 0, rotate: 0 }}
              animate={{ 
                scale: [0, 1.5, 20],
                rotate: [0, 180, 720]
              }}
              transition={{ 
                duration: 2,
                ease: "easeInOut",
                times: [0, 0.5, 1]
              }}
              onAnimationComplete={onComplete}
            >
              {/* Inner portal */}
              <div className="w-96 h-96 rounded-full bg-gradient-to-r from-primary via-accent to-primary opacity-80 blur-2xl" />
              
              {/* Outer rings */}
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-primary/50"
                animate={{ 
                  scale: [1, 1.5, 2],
                  opacity: [1, 0.5, 0]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "loop"
                }}
              />
              
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-accent/50"
                animate={{ 
                  scale: [1, 1.3, 1.8],
                  opacity: [1, 0.5, 0]
                }}
                transition={{ 
                  duration: 2,
                  delay: 0.5,
                  repeat: Infinity,
                  repeatType: "loop"
                }}
              />
            </motion.div>
          </div>

          {/* Light streaks */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute top-1/2 left-1/2 w-1 h-32 bg-gradient-to-b from-transparent via-white to-transparent"
                style={{
                  transformOrigin: 'center top',
                }}
                initial={{ 
                  rotate: i * 30,
                  opacity: 0,
                  scale: 0
                }}
                animate={{ 
                  rotate: i * 30 + 360,
                  opacity: [0, 1, 0],
                  scale: [0, 1, 5]
                }}
                transition={{
                  duration: 2,
                  delay: i * 0.1,
                  ease: "easeOut"
                }}
              />
            ))}
          </div>

          {/* Center loading text */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.5 }}
          >
            <div className="text-center">
              <motion.div
                className="text-white text-2xl font-bold mb-4"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ENTERING ARENA
              </motion.div>
              <motion.div
                className="flex justify-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-3 h-3 bg-white rounded-full"
                    animate={{ 
                      y: [0, -10, 0],
                      opacity: [0.3, 1, 0.3]
                    }}
                    transition={{
                      duration: 1,
                      delay: i * 0.2,
                      repeat: Infinity
                    }}
                  />
                ))}
              </motion.div>
            </div>
          </motion.div>

          {/* Particle effects */}
          <div className="absolute inset-0">
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={`particle-${i}`}
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ 
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0],
                  x: (Math.random() - 0.5) * 200,
                  y: (Math.random() - 0.5) * 200,
                }}
                transition={{
                  duration: 2,
                  delay: Math.random() * 2,
                  ease: "easeOut"
                }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PortalTransition;