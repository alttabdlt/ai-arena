import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@ui/dialog';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import { DialogTitle } from '@ui/dialog';
import { VisuallyHidden } from '@ui/visually-hidden';
import { 
  Package, 
  Sparkles, 
  Sword, 
  Shield as ShieldIcon, 
  Home, 
  Coins, 
  X,
  Zap
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface LootboxReward {
  id: string;
  lootboxRarity: string;
  equipmentRewards: Array<{
    name: string;
    type: string;
    rarity: string;
    powerBonus: number;
    defenseBonus: number;
  }>;
  furnitureRewards: Array<{
    name: string;
    type: string;
    rarity: string;
    scoreBonus: number;
    defenseBonus: number;
  }>;
  currencyReward: number;
}

interface LootboxOpeningAnimationProps {
  isOpen: boolean;
  onClose: () => void;
  reward: LootboxReward | null;
  autoCloseDelay?: number;
}

export function LootboxOpeningAnimation({ 
  isOpen, 
  onClose, 
  reward,
  autoCloseDelay = 8000 
}: LootboxOpeningAnimationProps) {
  const [showRewards, setShowRewards] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<'opening' | 'revealing' | 'complete'>('opening');

  useEffect(() => {
    if (isOpen && reward) {
      setAnimationPhase('opening');
      setShowRewards(false);

      // Chest opening animation
      const openTimer = setTimeout(() => {
        setAnimationPhase('revealing');
        setShowRewards(true);
        
        // Trigger confetti for rare or better lootboxes
        if (reward.lootboxRarity && reward.lootboxRarity !== 'COMMON') {
          triggerConfetti(reward.lootboxRarity);
        }
      }, 1500);

      // Complete animation
      const completeTimer = setTimeout(() => {
        setAnimationPhase('complete');
      }, 3000);

      // Auto close
      const closeTimer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);

      return () => {
        clearTimeout(openTimer);
        clearTimeout(completeTimer);
        clearTimeout(closeTimer);
      };
    }
  }, [isOpen, reward, onClose, autoCloseDelay]);

  const triggerConfetti = (rarity: string | undefined) => {
    const colors = {
      LEGENDARY: ['#FFD700', '#FFA500', '#FF6347'],
      EPIC: ['#9B59B6', '#8E44AD', '#663399'],
      RARE: ['#3498DB', '#2980B9', '#5DADE2'],
      UNCOMMON: ['#2ECC71', '#27AE60', '#82E0AA'],
      COMMON: ['#95A5A6', '#7F8C8D', '#BDC3C7'],
    };

    const rarityKey = rarity?.toUpperCase() || 'COMMON';
    const selectedColors = colors[rarityKey as keyof typeof colors] || colors.COMMON;

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: selectedColors,
    });
  };

  const getRarityColor = (rarity: string | undefined) => {
    if (!rarity) return 'from-gray-500 to-gray-700';
    
    switch (rarity.toUpperCase()) {
      case 'LEGENDARY':
        return 'from-yellow-500 to-amber-600';
      case 'EPIC':
        return 'from-purple-500 to-purple-700';
      case 'RARE':
        return 'from-blue-500 to-blue-700';
      case 'UNCOMMON':
        return 'from-green-500 to-green-700';
      default:
        return 'from-gray-500 to-gray-700';
    }
  };

  const getRarityGlow = (rarity: string | undefined) => {
    if (!rarity) return 'shadow-[0_0_30px_rgba(107,114,128,0.6)]';
    
    switch (rarity.toUpperCase()) {
      case 'LEGENDARY':
        return 'shadow-[0_0_60px_rgba(255,215,0,0.8)]';
      case 'EPIC':
        return 'shadow-[0_0_60px_rgba(155,89,182,0.8)]';
      case 'RARE':
        return 'shadow-[0_0_60px_rgba(52,152,219,0.8)]';
      case 'UNCOMMON':
        return 'shadow-[0_0_60px_rgba(46,204,113,0.8)]';
      default:
        return 'shadow-[0_0_30px_rgba(107,114,128,0.6)]';
    }
  };

  const getItemIcon = (type: string | undefined) => {
    if (!type) return <Package className="h-5 w-5" />;
    
    switch (type.toUpperCase()) {
      case 'WEAPON':
        return <Sword className="h-5 w-5" />;
      case 'ARMOR':
        return <ShieldIcon className="h-5 w-5" />;
      case 'DECORATION':
      case 'FUNCTIONAL':
      case 'DEFENSIVE':
      case 'TROPHY':
        return <Home className="h-5 w-5" />;
      default:
        return <Package className="h-5 w-5" />;
    }
  };

  if (!reward) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="max-w-2xl border-0 bg-transparent shadow-none p-0 overflow-visible">
            <VisuallyHidden>
              <DialogTitle>Lootbox Opening</DialogTitle>
            </VisuallyHidden>
            <div className="relative flex flex-col items-center justify-center min-h-[500px]">
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="absolute top-4 right-4 z-50 bg-background/80 backdrop-blur"
              >
                <X className="h-4 w-4" />
              </Button>

              {/* Lootbox animation */}
              <motion.div
                className="relative"
                initial={{ scale: 0 }}
                animate={{ scale: animationPhase === 'opening' ? 1 : 0.8 }}
                transition={{ duration: 0.5, type: "spring" }}
              >
                <motion.div
                  className={`w-48 h-48 rounded-2xl bg-gradient-to-br ${getRarityColor(reward.lootboxRarity)} ${getRarityGlow(reward.lootboxRarity)} flex items-center justify-center`}
                  animate={animationPhase === 'opening' ? {
                    rotateY: [0, 10, -10, 10, -10, 0],
                    scale: [1, 1.1, 1, 1.1, 1, 1.2]
                  } : {}}
                  transition={{ duration: 1.5 }}
                >
                  <Package className="h-24 w-24 text-white" />
                </motion.div>

                {/* Sparkle effects */}
                <AnimatePresence>
                  {animationPhase === 'opening' && (
                    <>
                      {[...Array(6)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute inset-0 flex items-center justify-center"
                          initial={{ scale: 0, rotate: i * 60 }}
                          animate={{ 
                            scale: [0, 1, 0],
                            rotate: [i * 60, i * 60 + 180],
                          }}
                          exit={{ scale: 0 }}
                          transition={{ 
                            duration: 1.5,
                            delay: i * 0.1,
                            repeat: 1,
                          }}
                        >
                          <Sparkles className="h-8 w-8 text-yellow-400 absolute top-0" />
                        </motion.div>
                      ))}
                    </>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Rewards display */}
              <AnimatePresence>
                {showRewards && (
                  <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -50 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 backdrop-blur rounded-2xl p-8"
                  >
                    <div className="text-center mb-6">
                      <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                        {reward.lootboxRarity} Lootbox Opened!
                      </h2>
                      <p className="text-muted-foreground">Here are your rewards:</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto w-full">
                      {/* Equipment rewards */}
                      {reward.equipmentRewards.map((item, index) => (
                        <motion.div
                          key={`equipment-${index}`}
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.5 + index * 0.1 }}
                          className="bg-card p-4 rounded-lg border-2 hover:shadow-lg transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getItemIcon(item.type)}
                              <span className="font-semibold">{item.name}</span>
                            </div>
                            <Badge variant="outline" className={getRarityColor(item.rarity)}>
                              {item.rarity}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <p className="capitalize">{item.type}</p>
                            <div className="flex gap-3 mt-1">
                              {item.powerBonus > 0 && (
                                <span className="text-red-500">+{item.powerBonus} Power</span>
                              )}
                              {item.defenseBonus > 0 && (
                                <span className="text-blue-500">+{item.defenseBonus} Defense</span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      {/* Furniture rewards */}
                      {reward.furnitureRewards.map((item, index) => (
                        <motion.div
                          key={`furniture-${index}`}
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.5 + (reward.equipmentRewards.length + index) * 0.1 }}
                          className="bg-card p-4 rounded-lg border-2 hover:shadow-lg transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Home className="h-5 w-5" />
                              <span className="font-semibold">{item.name}</span>
                            </div>
                            <Badge variant="outline" className={getRarityColor(item.rarity)}>
                              {item.rarity}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <p className="capitalize">{item.type}</p>
                            <div className="flex gap-3 mt-1">
                              {item.scoreBonus > 0 && (
                                <span className="text-green-500">+{item.scoreBonus} Score</span>
                              )}
                              {item.defenseBonus > 0 && (
                                <span className="text-blue-500">+{item.defenseBonus} Defense</span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      {/* Currency reward */}
                      {reward.currencyReward > 0 && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.5 + (reward.equipmentRewards.length + reward.furnitureRewards.length) * 0.1 }}
                          className="bg-gradient-to-r from-yellow-500/20 to-amber-600/20 p-4 rounded-lg border-2 border-yellow-500/50"
                        >
                          <div className="flex items-center gap-3">
                            <Coins className="h-8 w-8 text-yellow-500" />
                            <div>
                              <p className="font-semibold text-lg">+{reward.currencyReward} HYPE</p>
                              <p className="text-sm text-muted-foreground">Currency reward</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1 }}
                      className="mt-6"
                    >
                      <Button onClick={onClose} size="lg" className="gap-2">
                        <Zap className="h-4 w-4" />
                        Awesome!
                      </Button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
}