import React, { useEffect, useState } from 'react';
import { useQuery, useSubscription } from '@apollo/client';
import { gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';

const CURRENT_JACKPOT_QUERY = gql`
  query CurrentJackpot {
    currentJackpot {
      id
      currentAmount
      contributions
      lastContribution
      totalWinners
      biggestWin
    }
  }
`;

const JACKPOT_UPDATE_SUBSCRIPTION = gql`
  subscription JackpotUpdate {
    jackpotUpdate {
      currentAmount
      contributions
      lastContribution
    }
  }
`;

const JACKPOT_WON_SUBSCRIPTION = gql`
  subscription JackpotWon {
    jackpotWon {
      botId
      botName
      personality
      amount
      timestamp
    }
  }
`;

interface JackpotDisplayProps {
  onWin?: (winner: any) => void;
  className?: string;
}

export const JackpotDisplay: React.FC<JackpotDisplayProps> = ({ onWin, className = '' }) => {
  const [displayAmount, setDisplayAmount] = useState(0);
  const [targetAmount, setTargetAmount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [recentContribution, setRecentContribution] = useState<number | null>(null);

  // Query initial jackpot data
  const { data, loading, error } = useQuery(CURRENT_JACKPOT_QUERY, {
    pollInterval: 30000 // Poll every 30 seconds as backup
  });

  // Subscribe to jackpot updates
  const { data: updateData } = useSubscription(JACKPOT_UPDATE_SUBSCRIPTION);

  // Subscribe to jackpot wins
  const { data: winData } = useSubscription(JACKPOT_WON_SUBSCRIPTION, {
    onSubscriptionData: ({ subscriptionData }) => {
      if (subscriptionData.data?.jackpotWon && onWin) {
        onWin(subscriptionData.data.jackpotWon);
      }
    }
  });

  // Update target amount from query or subscription
  useEffect(() => {
    const newAmount = updateData?.jackpotUpdate?.currentAmount || data?.currentJackpot?.currentAmount || 0;
    
    if (newAmount !== targetAmount) {
      const contribution = newAmount - targetAmount;
      if (contribution > 0 && targetAmount > 0) {
        setRecentContribution(contribution);
        setTimeout(() => setRecentContribution(null), 3000);
      }
      setTargetAmount(newAmount);
    }
  }, [data, updateData, targetAmount]);

  // Animate counter
  useEffect(() => {
    if (displayAmount === targetAmount) return;

    setIsAnimating(true);
    const difference = targetAmount - displayAmount;
    const increment = Math.ceil(difference / 20);
    const timer = setTimeout(() => {
      if (Math.abs(difference) < 2) {
        setDisplayAmount(targetAmount);
        setIsAnimating(false);
      } else {
        setDisplayAmount(displayAmount + increment);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [displayAmount, targetAmount]);

  // Format number with commas and $IDLE
  const formatAmount = (amount: number) => {
    return `${amount.toLocaleString()} $IDLE`;
  };

  // Calculate percentage to next milestone
  const getProgressToMilestone = () => {
    const milestones = [10000, 25000, 50000, 100000, 250000, 500000, 1000000];
    const nextMilestone = milestones.find(m => m > displayAmount) || 1000000;
    const prevMilestone = milestones[milestones.indexOf(nextMilestone) - 1] || 0;
    const progress = ((displayAmount - prevMilestone) / (nextMilestone - prevMilestone)) * 100;
    return { progress, nextMilestone };
  };

  const { progress, nextMilestone } = getProgressToMilestone();

  if (loading) {
    return (
      <div className={`jackpot-display loading ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-700 rounded w-32"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return null; // Silently fail
  }

  return (
    <div className={`jackpot-display ${className}`}>
      <div className="jackpot-container bg-gradient-to-r from-yellow-900/20 to-yellow-600/20 border border-yellow-600/30 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-pulse">🎰</span>
            <span className="text-sm font-semibold text-yellow-400 uppercase tracking-wide">
              Progressive Jackpot
            </span>
          </div>
          {data?.currentJackpot?.totalWinners > 0 && (
            <div className="text-xs text-yellow-600">
              {data.currentJackpot.totalWinners} winner{data.currentJackpot.totalWinners > 1 ? 's' : ''}
            </div>
          )}
        </div>

        <div className="relative">
          {/* Main amount display */}
          <motion.div 
            className={`text-3xl font-bold text-yellow-300 mb-2 ${isAnimating ? 'text-yellow-200' : ''}`}
            animate={{ scale: isAnimating ? 1.02 : 1 }}
            transition={{ duration: 0.1 }}
          >
            {formatAmount(displayAmount)}
          </motion.div>

          {/* Recent contribution popup */}
          <AnimatePresence>
            {recentContribution && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute -top-6 right-0 text-xs text-green-400 font-semibold"
              >
                +{recentContribution} $IDLE
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Progress bar to next milestone */}
        <div className="mb-2">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Progress</span>
            <span>Next: {formatAmount(nextMilestone)}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex justify-between text-xs text-gray-400">
          <div>
            <span className="text-gray-500">Contributions:</span>{' '}
            <span className="text-gray-300">
              {data?.currentJackpot?.contributions?.toLocaleString() || 0}
            </span>
          </div>
          {data?.currentJackpot?.biggestWin > 0 && (
            <div>
              <span className="text-gray-500">Record:</span>{' '}
              <span className="text-yellow-500">
                {formatAmount(data.currentJackpot.biggestWin)}
              </span>
            </div>
          )}
        </div>

        {/* Win chance indicator */}
        <div className="mt-3 pt-3 border-t border-yellow-900/30">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Win Chance: <span className="text-yellow-600">0.1% per tick</span>
            </div>
            <div className="text-xs text-gray-500">
              <span className="text-yellow-600">1%</span> of XP contributes
            </div>
          </div>
        </div>

        {/* Pulsing glow effect when high */}
        {displayAmount > 100000 && (
          <motion.div
            className="absolute inset-0 rounded-lg pointer-events-none"
            animate={{
              boxShadow: [
                '0 0 20px rgba(251, 191, 36, 0.2)',
                '0 0 40px rgba(251, 191, 36, 0.4)',
                '0 0 20px rgba(251, 191, 36, 0.2)',
              ]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        )}
      </div>
    </div>
  );
};

export default JackpotDisplay;