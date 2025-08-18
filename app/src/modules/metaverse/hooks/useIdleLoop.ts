import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation } from '@apollo/client';
import { UPDATE_BOT_EXPERIENCE, LOG_BOT_ACTIVITY } from '@/modules/metaverse/queries';

// Activity pools by personality
const ACTIVITIES = {
  CRIMINAL: [
    { emoji: '🔪', activity: 'Planning a heist' },
    { emoji: '💰', activity: 'Counting stolen money' },
    { emoji: '🚗', activity: 'Escaping the cops' },
    { emoji: '🔫', activity: 'Loading weapons' },
    { emoji: '📱', activity: 'Making shady deals' },
    { emoji: '🎭', activity: 'Creating fake identities' },
    { emoji: '💊', activity: 'Moving contraband' },
    { emoji: '🔓', activity: 'Picking locks' },
  ],
  GAMBLER: [
    { emoji: '🎰', activity: 'Playing slots' },
    { emoji: '🎲', activity: 'Rolling dice' },
    { emoji: '🃏', activity: 'Shuffling cards' },
    { emoji: '💸', activity: 'Betting big' },
    { emoji: '🎯', activity: 'Calculating odds' },
    { emoji: '🍀', activity: 'Testing luck' },
    { emoji: '💎', activity: 'Chasing jackpots' },
    { emoji: '🎪', activity: 'Bluffing opponents' },
  ],
  WORKER: [
    { emoji: '⚒️', activity: 'Mining resources' },
    { emoji: '🏗️', activity: 'Building structures' },
    { emoji: '📦', activity: 'Organizing inventory' },
    { emoji: '🔧', activity: 'Fixing equipment' },
    { emoji: '📊', activity: 'Analyzing data' },
    { emoji: '🏪', activity: 'Managing shop' },
    { emoji: '🚚', activity: 'Delivering goods' },
    { emoji: '📝', activity: 'Filing reports' },
  ],
};

// XP rates per personality
const XP_RATES = {
  CRIMINAL: 1.2,  // 20% bonus
  GAMBLER: 1.0,   // Standard rate
  WORKER: 1.5,    // 50% bonus
};

const BASE_XP_PER_TICK = 1;
const TICK_INTERVAL = 3000; // 3 seconds
const ACTIVITY_ROTATION_INTERVAL = 15000; // 15 seconds
const SAVE_INTERVAL = 30000; // 30 seconds

interface Activity {
  emoji: string;
  activity: string;
  xpGained?: number;
}

export const useIdleLoop = (botId: string | null, personality: string = 'WORKER') => {
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [maxXp, setMaxXp] = useState(100);
  const [totalXp, setTotalXp] = useState(0);
  
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingXpRef = useRef(0);
  const lastActivityIndexRef = useRef(0);
  const hasActivityRef = useRef(false);
  
  const [updateExperience] = useMutation(UPDATE_BOT_EXPERIENCE, {
    onError: (error) => {
      console.error('Failed to update experience:', error);
    }
  });
  
  const [logActivity] = useMutation(LOG_BOT_ACTIVITY, {
    onError: (error) => {
      console.error('Failed to log activity:', error);
    }
  });

  // Calculate XP required for next level
  const calculateMaxXp = useCallback((currentLevel: number) => {
    return 100 * Math.pow(1.2, currentLevel - 1);
  }, []);

  // Get random activity for personality
  const getRandomActivity = useCallback((personalityType: string): Activity => {
    const activities = ACTIVITIES[personalityType as keyof typeof ACTIVITIES] || ACTIVITIES.WORKER;
    
    // Get next activity in rotation (avoid repeating)
    let nextIndex = (lastActivityIndexRef.current + 1) % activities.length;
    
    // If we've cycled through all, shuffle the order
    if (nextIndex === 0) {
      nextIndex = Math.floor(Math.random() * activities.length);
    }
    
    lastActivityIndexRef.current = nextIndex;
    
    const activity = activities[nextIndex];
    const xpRate = XP_RATES[personalityType as keyof typeof XP_RATES] || 1.0;
    const xpGained = Math.floor(BASE_XP_PER_TICK * xpRate);
    
    return {
      ...activity,
      xpGained
    };
  }, []);

  // Rotate activity
  const rotateActivity = useCallback(() => {
    if (!botId) return;
    
    const newActivity = getRandomActivity(personality);
    setCurrentActivity(newActivity);
    hasActivityRef.current = true;
    
    // Log activity to backend
    if (newActivity.xpGained) {
      logActivity({
        variables: {
          botId,
          activity: newActivity.activity,
          emoji: newActivity.emoji,
          personality: personality.toUpperCase(),
          xpGained: newActivity.xpGained
        }
      }).catch(err => {
        // Silently fail for now - activity logging is not critical
        console.debug('Activity log failed:', err);
      });
    }
  }, [botId, personality, getRandomActivity, logActivity]);

  // Handle XP tick - removed currentActivity dependency to prevent infinite loop
  const handleXpTick = useCallback(() => {
    if (!botId || !hasActivityRef.current) return;
    
    const xpRate = XP_RATES[personality as keyof typeof XP_RATES] || 1.0;
    const xpGained = Math.floor(BASE_XP_PER_TICK * xpRate);
    
    setXp(prevXp => {
      const newXp = prevXp + xpGained;
      
      setMaxXp(prevMaxXp => {
        // Check for level up
        if (newXp >= prevMaxXp) {
          const overflow = newXp - prevMaxXp;
          
          setLevel(prevLevel => {
            const newLevel = prevLevel + 1;
            const newMaxXp = calculateMaxXp(newLevel);
            
            // Update max XP for new level
            setTimeout(() => setMaxXp(newMaxXp), 0);
            
            // Level up notification
            console.log(`🎉 Level up! Now level ${newLevel}`);
            
            return newLevel;
          });
          
          setTotalXp(prev => prev + xpGained);
          return overflow; // Start next level with overflow XP
        }
        
        return prevMaxXp; // No change to maxXp
      });
      
      setTotalXp(prev => prev + xpGained);
      return (newXp >= maxXp) ? 0 : newXp; // Reset to 0 if leveled up
    });
    
    // Track pending XP for batch save
    pendingXpRef.current += xpGained;
  }, [botId, personality, calculateMaxXp]);

  // Save progress to backend
  const saveProgress = useCallback(async () => {
    if (!botId || pendingXpRef.current === 0) return;
    
    const xpToSave = pendingXpRef.current;
    pendingXpRef.current = 0; // Reset pending XP
    
    try {
      await updateExperience({
        variables: {
          botId,
          xpGained: xpToSave
        }
      });
      console.log(`💾 Saved ${xpToSave} XP to backend`);
    } catch (error) {
      // Re-add XP to pending if save failed
      pendingXpRef.current += xpToSave;
      console.error('Failed to save progress:', error);
    }
  }, [botId, updateExperience]);

  // Initialize and start loops - Fixed dependencies to prevent infinite loop
  useEffect(() => {
    if (!botId) {
      // Clear all intervals
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (activityIntervalRef.current) clearInterval(activityIntervalRef.current);
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
      hasActivityRef.current = false;
      return;
    }

    // Clear any existing intervals before setting new ones
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    if (activityIntervalRef.current) clearInterval(activityIntervalRef.current);
    if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);

    // Initialize with first activity
    rotateActivity();

    // Start XP tick loop
    tickIntervalRef.current = setInterval(handleXpTick, TICK_INTERVAL);

    // Start activity rotation loop
    activityIntervalRef.current = setInterval(rotateActivity, ACTIVITY_ROTATION_INTERVAL);

    // Start save loop
    saveIntervalRef.current = setInterval(saveProgress, SAVE_INTERVAL);

    // Cleanup on unmount or bot change
    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (activityIntervalRef.current) clearInterval(activityIntervalRef.current);
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
      hasActivityRef.current = false;
      
      // Save any pending XP on cleanup
      if (pendingXpRef.current > 0) {
        saveProgress();
      }
    };
  }, [botId, personality]); // Only depend on stable values

  // Save on window unload
  useEffect(() => {
    const handleUnload = () => {
      if (pendingXpRef.current > 0) {
        // Try to save synchronously (may not always work)
        navigator.sendBeacon(
          '/api/save-progress',
          JSON.stringify({ botId, xp: pendingXpRef.current })
        );
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [botId]);

  return {
    currentActivity,
    level,
    xp,
    maxXp,
    totalXp,
    xpPerSecond: (XP_RATES[personality as keyof typeof XP_RATES] || 1.0) * (BASE_XP_PER_TICK / (TICK_INTERVAL / 1000))
  };
};