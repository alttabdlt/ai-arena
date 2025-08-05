import { useState, useEffect } from 'react';
import { useQuery, useSubscription, useMutation } from '@apollo/client';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import { Users, Timer, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GET_QUEUE_STATUS, QUEUE_UPDATE_SUBSCRIPTION, GET_USER_BOTS_IN_QUEUE } from '@/graphql/queries/queue';
import { LEAVE_QUEUE } from '@/graphql/mutations/queue';
import { cn } from '@/lib/utils';
import { useAuth } from '@auth/contexts/AuthContext';
import { useToast } from '@shared/hooks/use-toast';

export function QueueStatusBar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [queueEntryTime, setQueueEntryTime] = useState<Date | null>(null);
  const [isMatchReady, setIsMatchReady] = useState(false);
  
  // Query queue status
  const { data: queueData, loading } = useQuery(GET_QUEUE_STATUS, {
    pollInterval: 5000, // Poll every 5 seconds as backup
  });
  
  // Query user's bots in queue
  const { data: userBotsData } = useQuery(GET_USER_BOTS_IN_QUEUE, {
    variables: { address: user?.address || '' },
    skip: !user?.address,
    pollInterval: 5000,
  });
  
  // Subscribe to real-time updates
  const { data: queueUpdate } = useSubscription(QUEUE_UPDATE_SUBSCRIPTION);
  
  // Leave queue mutation
  const [leaveQueue] = useMutation(LEAVE_QUEUE, {
    onCompleted: () => {
      setQueueEntryTime(null);
      toast({
        title: 'Left queue',
        description: 'Your bot has been removed from the queue',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  // Get user's bot in queue
  const userBotInQueue = userBotsData?.bots?.find((bot: any) => 
    bot.queueEntries?.some((entry: any) => entry.status === 'WAITING')
  );
  const queueEntry = userBotInQueue?.queueEntries?.find((entry: any) => entry.status === 'WAITING');
  
  // Check if the bot is a demo bot
  const isDemoBot = userBotInQueue?.isDemo || false;
  
  // Calculate elapsed time
  useEffect(() => {
    if (queueEntry?.enteredAt) {
      setQueueEntryTime(new Date(queueEntry.enteredAt));
    } else {
      setQueueEntryTime(null);
      setElapsedTime(0);
    }
  }, [queueEntry?.enteredAt]);
  
  useEffect(() => {
    if (!queueEntryTime) {
      setElapsedTime(0);
      return;
    }
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const entered = queueEntryTime.getTime();
      const elapsed = Math.floor((now - entered) / 1000);
      setElapsedTime(elapsed);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [queueEntry, queueEntryTime]);
  
  // Check if match is ready (4/4 players)
  useEffect(() => {
    const totalInQueue = queueData?.queueStatus?.totalInQueue || 0;
    setIsMatchReady(totalInQueue >= 4);
    
    // Auto-navigate when match is ready and user is in queue
    if (totalInQueue >= 4 && userBotInQueue) {
      // Small delay to ensure all players see the ready state
      setTimeout(() => {
        // Add a flag to indicate match is being created
        navigate('/queue?matchCreating=true');
      }, 500);
    }
  }, [queueData, userBotInQueue, navigate]);
  
  // Handle queue updates
  useEffect(() => {
    if (queueUpdate?.queueUpdate) {
      // If user's bot matched, clear entry time
      if (queueUpdate.queueUpdate.status === 'MATCHED' && 
          queueUpdate.queueUpdate.bot?.id === userBotInQueue?.id) {
        setQueueEntryTime(null);
      }
    }
  }, [queueUpdate, userBotInQueue]);
  
  const handleCancelQueue = async () => {
    if (!userBotInQueue) return;
    
    try {
      await leaveQueue({
        variables: {
          botId: userBotInQueue.id,
        },
        refetchQueries: ['GetUserBots', 'GetQueueStatus'],
        awaitRefetchQueries: true,
      });
      setQueueEntryTime(null);
      
      // Clear any queue-related state in localStorage
      localStorage.removeItem('selectedBotId');
      localStorage.removeItem('isInQueue');
    } catch (error) {
      console.error('Failed to leave queue:', error);
    }
  };
  
  if (loading || !queueData?.queueStatus) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="relative h-8 px-2"
        disabled
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </Button>
    );
  }
  
  const totalInQueue = queueData.queueStatus.totalInQueue || 0;
  const playersNeeded = 4;
  const isAlmostReady = totalInQueue >= 3;
  const isReady = totalInQueue >= 4;
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "relative h-8 px-2 gap-1.5 text-xs",
          isReady && "text-green-600 dark:text-green-400",
          isAlmostReady && !isReady && "text-yellow-600 dark:text-yellow-400"
        )}
        onClick={() => isReady ? navigate('/queue') : null}
        disabled={!isReady}
      >
        <div className="flex items-center gap-2">
          {/* Player Count */}
          <div className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>
              {totalInQueue}/{playersNeeded}
            </span>
          </div>
          
          {/* Timer - Show elapsed time if user is in queue */}
          {userBotInQueue && (
            <>
              <div className="w-px h-3 bg-border" />
              <div className="flex items-center gap-1">
                <Timer className="h-3.5 w-3.5" />
                <span className="font-mono">
                  {formatTime(elapsedTime)}
                </span>
              </div>
            </>
          )}
        </div>
        
        {/* Ready indicator */}
        {isReady && (
          <div className="absolute -top-0.5 -right-0.5">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
        )}
      </Button>
      
      {/* Cancel button if user is in queue (not shown for demo bots) */}
      {userBotInQueue && !isReady && !isDemoBot && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={handleCancelQueue}
          title="Leave queue"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}