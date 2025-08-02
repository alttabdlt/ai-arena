import React from 'react';
import { motion } from 'framer-motion';

interface LootboxParticlesProps {
  active?: boolean;
  type?: string;
  color?: string;
}

export const LootboxParticles: React.FC<LootboxParticlesProps> = ({ active, type, color = '#FFD700' }) => {
  // Support both 'active' prop and 'type' prop for backward compatibility
  const isActive = active || !!type;
  
  if (!isActive) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            backgroundColor: color,
            left: '50%',
            top: '50%',
          }}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{
            x: Math.cos((i * 30) * Math.PI / 180) * 150,
            y: Math.sin((i * 30) * Math.PI / 180) * 150,
            opacity: 0,
          }}
          transition={{
            duration: 1.5,
            ease: 'easeOut',
            repeat: Infinity,
            delay: i * 0.05,
          }}
        />
      ))}
    </div>
  );
};