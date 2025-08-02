import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Lootbox3DProps {
  stage: 'idle' | 'appearing' | 'shaking' | 'opening' | 'revealing' | 'complete';
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  className?: string;
}

export const Lootbox3D: React.FC<Lootbox3DProps> = ({ stage, rarity = 'common', className }) => {
  return (
    <motion.div
      className={cn(
        'w-64 h-64 relative mx-auto',
        'bg-gradient-to-br from-gray-700 to-gray-900',
        'rounded-xl shadow-2xl',
        'flex items-center justify-center',
        className
      )}
      animate={{
        scale: stage === 'shaking' ? [1, 1.1, 0.9, 1] : 1,
        rotate: stage === 'shaking' ? [-5, 5, -5, 0] : 0,
      }}
      transition={{
        duration: 0.5,
        repeat: stage === 'shaking' ? Infinity : 0,
      }}
    >
      <div className="text-6xl">📦</div>
      {stage === 'opening' && (
        <motion.div
          className="absolute inset-0 bg-white/50 rounded-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.5 }}
        />
      )}
    </motion.div>
  );
};