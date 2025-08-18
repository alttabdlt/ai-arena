import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { CALCULATE_IDLE_PROGRESS, CLAIM_IDLE_REWARDS } from '@/modules/metaverse/queries';

interface OfflineProgress {
  pendingXP: number;
  timeAwaySeconds: number;
  activities: Array<{
    id: string;
    activity: string;
    emoji: string;
    xpGained: number;
    timestamp: string;
  }>;
  currentLevel: number;
  currentXP: number;
}

export const useOfflineProgress = (botId: string | null) => {
  const [offlineProgress, setOfflineProgress] = useState<OfflineProgress | null>(null);
  const [hasClaimed, setHasClaimed] = useState(false);
  
  // Query for calculating idle progress
  const { data, loading, error, refetch } = useQuery(CALCULATE_IDLE_PROGRESS, {
    variables: { botId },
    skip: !botId || hasClaimed,
    fetchPolicy: 'network-only'
  });
  
  // Mutation for claiming rewards
  const [claimRewards, { loading: claiming }] = useMutation(CLAIM_IDLE_REWARDS, {
    onCompleted: (data) => {
      console.log('✅ Claimed idle rewards:', data.claimIdleRewards);
      setHasClaimed(true);
      setOfflineProgress(null);
    },
    onError: (error) => {
      console.error('Failed to claim rewards:', error);
    }
  });
  
  // Update offline progress when data changes
  useEffect(() => {
    if (data?.calculateIdleProgress && !hasClaimed) {
      const progress = data.calculateIdleProgress;
      
      // Only show if there's meaningful time away (more than 1 minute)
      if (progress.timeAwaySeconds > 60) {
        setOfflineProgress({
          pendingXP: progress.pendingXP,
          timeAwaySeconds: progress.timeAwaySeconds,
          activities: progress.activities || [],
          currentLevel: progress.currentLevel,
          currentXP: progress.currentXP
        });
      }
    }
  }, [data, hasClaimed]);
  
  // Reset when bot changes
  useEffect(() => {
    setHasClaimed(false);
    setOfflineProgress(null);
  }, [botId]);
  
  const handleClaimRewards = async () => {
    if (!botId || !offlineProgress || claiming) return;
    
    try {
      await claimRewards({
        variables: { botId }
      });
    } catch (err) {
      console.error('Error claiming rewards:', err);
    }
  };
  
  const formatTimeAway = (seconds: number): string => {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  };
  
  return {
    offlineProgress,
    loading,
    error,
    claiming,
    hasClaimed,
    handleClaimRewards,
    formatTimeAway,
    refetch
  };
};