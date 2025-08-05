import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, Sparkles, Sword, Shield, Home, Coins } from 'lucide-react';
import clsx from 'clsx';

interface LootboxOpeningProps {
  isOpen: boolean;
  onClose: () => void;
  lootbox: any;
}

export default function LootboxOpening({ isOpen, onClose, lootbox }: LootboxOpeningProps) {
  const [showRewards, setShowRewards] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<'opening' | 'revealing' | 'complete'>('opening');

  useEffect(() => {
    if (isOpen && lootbox) {
      setAnimationPhase('opening');
      setShowRewards(false);

      // Opening animation
      const openTimer = setTimeout(() => {
        setAnimationPhase('revealing');
        setShowRewards(true);
        
        // Create blood splatter effect for crime theme
        if (lootbox.rarity !== 'COMMON') {
          triggerBloodEffect(lootbox.rarity);
        }
      }, 1500);

      // Complete animation
      const completeTimer = setTimeout(() => {
        setAnimationPhase('complete');
      }, 3000);

      // Auto close
      const closeTimer = setTimeout(() => {
        onClose();
      }, 6000);

      return () => {
        clearTimeout(openTimer);
        clearTimeout(completeTimer);
        clearTimeout(closeTimer);
      };
    }
  }, [isOpen, lootbox, onClose]);

  const triggerBloodEffect = (rarity: string) => {
    // Create multiple blood drops
    const container = document.getElementById('lootbox-container');
    if (!container) return;

    for (let i = 0; i < 20; i++) {
      const drop = document.createElement('div');
      drop.className = 'blood-drop';
      drop.style.left = `${50 + (Math.random() - 0.5) * 30}%`;
      drop.style.animationDelay = `${Math.random() * 0.5}s`;
      container.appendChild(drop);
      
      setTimeout(() => drop.remove(), 2000);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'LEGENDARY':
        return 'from-yellow-600 to-amber-800';
      case 'EPIC':
        return 'from-purple-600 to-purple-900';
      case 'RARE':
        return 'from-blue-600 to-blue-900';
      case 'UNCOMMON':
        return 'from-green-600 to-green-900';
      default:
        return 'from-gray-600 to-gray-800';
    }
  };

  const getRarityGlow = (rarity: string) => {
    switch (rarity) {
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

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'WEAPON':
        return <Sword className="w-5 h-5" />;
      case 'ARMOR':
        return <Shield className="w-5 h-5" />;
      case 'FURNITURE':
        return <Home className="w-5 h-5" />;
      default:
        return <Package className="w-5 h-5" />;
    }
  };

  if (!lootbox) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center">
          <div id="lootbox-container" className="relative">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-50 p-2 bg-gray-900/80 backdrop-blur rounded-lg hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>

            {/* Lootbox animation */}
            <motion.div
              className="relative"
              initial={{ scale: 0 }}
              animate={{ scale: animationPhase === 'opening' ? 1 : 0.8 }}
              transition={{ duration: 0.5, type: "spring" }}
            >
              <motion.div
                className={clsx(
                  'w-48 h-48 rounded-2xl bg-gradient-to-br flex items-center justify-center',
                  getRarityColor(lootbox.rarity),
                  getRarityGlow(lootbox.rarity),
                  'border-2 border-red-900'
                )}
                animate={animationPhase === 'opening' ? {
                  rotateY: [0, 10, -10, 10, -10, 0],
                  scale: [1, 1.1, 1, 1.1, 1, 1.2]
                } : {}}
                transition={{ duration: 1.5 }}
              >
                <Package className="w-24 h-24 text-white" />
              </motion.div>

              {/* Blood splatter effect placeholder */}
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
                        <Sparkles className="h-8 w-8 text-red-400 absolute top-0" />
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
                  className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/95 backdrop-blur rounded-2xl p-8 border border-red-900/50"
                >
                  <div className="text-center mb-6">
                    <h2 className="text-3xl font-bold mb-2 text-red-400">
                      {lootbox.rarity} Lootbox Opened!
                    </h2>
                    <p className="text-gray-400">Your rewards:</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto w-full max-w-2xl">
                    {lootbox.rewards?.map((item: any, index: number) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 + index * 0.1 }}
                        className="bg-gray-800 p-4 rounded-lg border-2 border-gray-700 hover:border-red-900/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getItemIcon(item.type)}
                            <span className="font-semibold text-gray-200">{item.name}</span>
                          </div>
                          <span className={clsx(
                            'px-2 py-1 text-xs rounded font-medium',
                            item.rarity === 'LEGENDARY' && 'bg-yellow-500/20 text-yellow-400',
                            item.rarity === 'EPIC' && 'bg-purple-500/20 text-purple-400',
                            item.rarity === 'RARE' && 'bg-blue-500/20 text-blue-400',
                            item.rarity === 'UNCOMMON' && 'bg-green-500/20 text-green-400',
                            item.rarity === 'COMMON' && 'bg-gray-500/20 text-gray-400'
                          )}>
                            {item.rarity}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400">
                          <p className="capitalize">{item.type.toLowerCase()}</p>
                          <div className="flex gap-3 mt-1">
                            {item.stats?.powerBonus > 0 && (
                              <span className="text-red-400">+{item.stats.powerBonus} Power</span>
                            )}
                            {item.stats?.defenseBonus > 0 && (
                              <span className="text-blue-400">+{item.stats.defenseBonus} Defense</span>
                            )}
                            {item.stats?.scoreBonus > 0 && (
                              <span className="text-yellow-400">+{item.stats.scoreBonus} Score</span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    onClick={onClose}
                    className="mt-6 px-6 py-2 bg-red-900/50 hover:bg-red-900/70 text-red-400 rounded-lg font-semibold transition-colors"
                  >
                    Continue
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <style>{`
            .blood-drop {
              position: absolute;
              width: 8px;
              height: 12px;
              background: linear-gradient(to bottom, #dc2626, #7f1d1d);
              border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
              top: 50%;
              animation: bloodFall 2s ease-in forwards;
              z-index: 10;
            }

            @keyframes bloodFall {
              to {
                transform: translateY(200px);
                opacity: 0;
              }
            }
          `}</style>
        </div>
      )}
    </AnimatePresence>
  );
}