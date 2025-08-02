import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Trophy, Shield, Home } from 'lucide-react';
import { LootboxReward, RARITY_COLORS } from '@/types/lootbox';
import { cn } from '@/lib/utils';

interface LootboxRewardDisplayProps {
  reward: LootboxReward;
  onContinue: () => void;
}

const getItemIcon = (type: string) => {
  switch (type) {
    case 'equipment':
      return Shield;
    case 'furniture':
      return Home;
    case 'cosmetic':
      return Sparkles;
    default:
      return Trophy;
  }
};

const getRarityGlow = (rarity: string) => {
  const color = RARITY_COLORS[rarity as keyof typeof RARITY_COLORS];
  return {
    boxShadow: `0 0 40px ${color}50, 0 0 80px ${color}30`,
    border: `2px solid ${color}`
  };
};

export const LootboxRewardDisplay: React.FC<LootboxRewardDisplayProps> = ({
  reward,
  onContinue
}) => {
  const Icon = getItemIcon(reward.item.type);
  const rarityColor = RARITY_COLORS[reward.item.rarity];
  
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", duration: 0.5 }}
      className="relative"
    >
      <Card 
        className="p-8 bg-gray-900 border-gray-700 text-center relative overflow-hidden"
        style={getRarityGlow(reward.item.rarity)}
      >
        {/* Background gradient effect */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background: `radial-gradient(circle at center, ${rarityColor} 0%, transparent 70%)`
          }}
        />
        
        {/* Rarity badge */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-4"
        >
          <Badge
            className={cn(
              "text-white font-bold px-4 py-2 text-lg",
              reward.item.rarity === 'legendary' && "animate-pulse"
            )}
            style={{ backgroundColor: rarityColor }}
          >
            {reward.item.rarity.toUpperCase()}
          </Badge>
        </motion.div>
        
        {/* Item icon container */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.3, type: "spring" }}
          className="relative inline-block mb-6"
        >
          {/* Outer glow ring */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle, ${rarityColor}40 0%, transparent 70%)`,
              filter: 'blur(20px)'
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.8, 0.5]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          
          {/* Icon background */}
          <div
            className="relative w-32 h-32 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: `${rarityColor}20`,
              border: `3px solid ${rarityColor}`
            }}
          >
            <Icon
              className="w-16 h-16"
              style={{ color: rarityColor }}
            />
          </div>
          
          {/* Sparkle effects for rare+ items */}
          {['rare', 'epic', 'legendary'].includes(reward.item.rarity) && (
            <>
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: rarityColor,
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${i * 60}deg) translateY(-60px)`
                  }}
                  animate={{
                    scale: [0, 1, 0],
                    opacity: [0, 1, 0]
                  }}
                  transition={{
                    duration: 2,
                    delay: i * 0.1,
                    repeat: Infinity,
                    repeatDelay: 1
                  }}
                />
              ))}
            </>
          )}
        </motion.div>
        
        {/* Item name */}
        <motion.h3
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-2xl font-bold mb-2"
          style={{ color: rarityColor }}
        >
          {reward.item.name}
        </motion.h3>
        
        {/* Item description */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-gray-300 mb-6"
        >
          {reward.item.description}
        </motion.p>
        
        {/* New item indicator */}
        {reward.isNew && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.6, type: "spring" }}
            className="mb-6"
          >
            <Badge variant="secondary" className="text-yellow-500">
              ✨ NEW ITEM! ✨
            </Badge>
          </motion.div>
        )}
        
        {/* Action buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex gap-4 justify-center"
        >
          <Button
            size="lg"
            onClick={onContinue}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
          >
            Add to Inventory
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={onContinue}
          >
            Continue
          </Button>
        </motion.div>
        
        {/* Value indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-4 text-sm text-gray-400"
        >
          Value: {reward.item.value} 🪙
        </motion.div>
      </Card>
    </motion.div>
  );
};