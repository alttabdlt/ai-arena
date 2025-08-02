import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { useAuth } from '@auth/contexts/AuthContext';
import { useAccount } from 'wagmi';
import InteractiveGlobe from '@shared/components/globe/InteractiveGlobe';
import SlotMachineTitle from '@shared/components/animations/SlotMachineTitle';
import PortalTransition from '@shared/components/animations/PortalTransition';
import { QueuePositionTracker } from '@queue/components/queue-position-tracker';
import { Button } from '@ui/button';
import { Card } from '@ui/card';
import { Badge } from '@ui/badge';
import { Alert, AlertDescription } from '@ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/select';
import { Trophy, Globe, Gamepad2, Bot, Loader2, X, CheckCircle2, Clock } from 'lucide-react';
import { Tournament } from '@shared/types/tournament';
import { motion, AnimatePresence } from 'framer-motion';
import { GET_USER_BOTS } from '@/graphql/queries/user';
import { GET_QUEUE_STATUS } from '@/graphql/queries/queue';
import { ENTER_QUEUE, LEAVE_QUEUE } from '@/graphql/mutations/queue';
import { QUEUE_UPDATE_SUBSCRIPTION } from '@/graphql/queries/queue';
import { SET_TEST_GAME_TYPE } from '@/graphql/mutations/test';
import { START_DEBUG_LOGGING } from '@/graphql/mutations/debug';
import { useToast } from '@shared/hooks/use-toast';
import { LootboxAnimation } from '@shared/components/animations/LootboxAnimation';
import { useLootbox } from '@shared/hooks/useLootbox';
import { debugLogger } from '@shared/services/debugLogger';
import { DebugLogViewer } from '@shared/components/DebugLogViewer';
import { DebugSubscriptionListener } from '@shared/components/DebugSubscriptionListener';

const Index = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoggingIn, isAuthReady, login } = useAuth();
  const { isConnected } = useAccount();
  const { toast } = useToast();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [showGameSelection, setShowGameSelection] = useState(false);
  const [showPortalTransition, setShowPortalTransition] = useState(false);
  const [selectedGameType, setSelectedGameType] = useState<string | null>(null);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [isInQueue, setIsInQueue] = useState(false);
  
  // Lootbox test integration
  const { isOpen, openLootbox, closeLootbox, generateReward } = useLootbox({
    winnerId: 'test-winner',
    gameType: 'poker',
    onRewardReceived: (reward) => {
      console.log('Test lootbox reward:', reward);
    }
  });
  const [queueEntryId, setQueueEntryId] = useState<string | null>(null);
  const [pendingPlayAction, setPendingPlayAction] = useState(false);
  const [showDebugLogs, setShowDebugLogs] = useState(false);

  // GraphQL Queries
  const { data: userBotsData, loading: botsLoading, refetch: refetchBots } = useQuery(GET_USER_BOTS, {
    variables: { address: user?.address || '' },
    skip: !user?.address,
    fetchPolicy: 'cache-and-network',
  });

  const { data: queueStatusData, loading: queueStatusLoading } = useQuery(GET_QUEUE_STATUS, {
    pollInterval: 5000,
  });

  // GraphQL Mutations
  const [setTestGameType] = useMutation(SET_TEST_GAME_TYPE);
  const [startDebugLogging] = useMutation(START_DEBUG_LOGGING);
  
  const [enterQueue] = useMutation(ENTER_QUEUE, {
    onCompleted: (data) => {
      setIsInQueue(true);
      setQueueEntryId(data.enterQueue.id);
      toast({
        title: 'Entered queue',
        description: 'Finding opponents for your match...',
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

  const [leaveQueue] = useMutation(LEAVE_QUEUE, {
    onCompleted: () => {
      setIsInQueue(false);
      setQueueEntryId(null);
      toast({
        title: 'Left queue',
        description: 'You have been removed from the queue',
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

  // Subscribe to queue updates
  const { data: queueUpdate } = useSubscription(QUEUE_UPDATE_SUBSCRIPTION);
  
  // Check localStorage for queue state on mount
  useEffect(() => {
    const storedBotId = localStorage.getItem('selectedBotId');
    const storedInQueue = localStorage.getItem('isInQueue');
    
    if (storedBotId && storedInQueue === 'true') {
      setSelectedBotId(storedBotId);
      setIsInQueue(true);
    }
  }, []);

  // Add keyboard shortcut for debug logs (Ctrl/Cmd + D)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        setShowDebugLogs(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);
  
  // Watch for changes in user's bots to detect when they leave queue
  useEffect(() => {
    if (userBotsData?.bots && selectedBotId) {
      const selectedBot = userBotsData.bots.find((bot: any) => bot.id === selectedBotId);
      const hasQueueEntry = selectedBot?.queueEntries?.some((entry: any) => entry.status === 'WAITING');
      
      // If bot is no longer in queue, reset state
      if (!hasQueueEntry && isInQueue) {
        setIsInQueue(false);
        setSelectedBotId(null);
        setShowGameSelection(false);
        localStorage.removeItem('selectedBotId');
        localStorage.removeItem('isInQueue');
      }
    }
  }, [userBotsData, selectedBotId, isInQueue]);

  useEffect(() => {
    if (queueUpdate?.queueUpdate) {
      const update = queueUpdate.queueUpdate;
      
      console.log('🔔 Queue update received:', {
        status: update.status,
        botId: update.bot?.id,
        botName: update.bot?.name,
        botCreator: update.bot?.creator?.address,
        matchId: update.matchId,
        selectedBotId,
        userAddress: user?.address,
        isMatch: update.bot?.id === selectedBotId,
        isUserBot: update.bot?.creator?.address === user?.address
      });
      
      // Check if this is a match found for any of the user's bots
      if (update.status === 'MATCHED' && update.matchId) {
        // Check if this bot belongs to the current user
        if (update.bot?.creator?.address === user?.address) {
          console.log(`🎯 Match found for user's bot ${update.bot.name}! Navigating to match ${update.matchId}`);
          
          toast({
            title: 'Match Found!',
            description: `Your bot "${update.bot.name}" has been matched!`,
            duration: 3000,
          });
          
          // Clear queue state from localStorage
          localStorage.removeItem('selectedBotId');
          localStorage.removeItem('isInQueue');
          
          // Reset local state
          setIsInQueue(false);
          setSelectedBotId(null);
          setShowGameSelection(false);
          
          // Navigate to the specific match
          setTimeout(() => {
            console.log(`🚀 Navigating to /tournament/${update.matchId}`);
            navigate(`/tournament/${update.matchId}`);
          }, 1500);
        } else {
          console.log(`ℹ️ Match found for bot ${update.bot?.name} (creator: ${update.bot?.creator?.address}), but not current user's bot`);
        }
      }
    }
  }, [queueUpdate, selectedBotId, user?.address, navigate, toast]);

  useEffect(() => {
    // Load tournaments from sessionStorage
    const storedTournaments: Tournament[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith('tournament-')) {
        const tournament = JSON.parse(sessionStorage.getItem(key) || '{}');
        if (tournament.id) {
          storedTournaments.push(tournament);
        }
      }
    }
    setTournaments(storedTournaments);
  }, []);

  // Auto-continue play flow after authentication
  useEffect(() => {
    const continuePlayFlow = async () => {
      if (pendingPlayAction && isAuthenticated && isAuthReady && !isLoggingIn) {
        // Increased delay to ensure auth headers are fully propagated
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Force a manual check that token exists
        const token = localStorage.getItem('ai-arena-access-token');
        if (!token) {
          console.error('Token not found after authentication');
          setPendingPlayAction(false);
          return;
        }
        
        // Refetch bots data with fresh auth context
        const { data: freshBotsData } = await refetchBots();
        
        setPendingPlayAction(false);
        const activeBots = freshBotsData?.bots?.filter((bot: any) => bot.isActive) || [];
        
        if (activeBots.length === 0) {
          toast({
            title: 'No active bots',
            description: 'Deploy a bot first to start playing',
            variant: 'destructive',
          });
          navigate('/deploy');
        } else if (activeBots.length === 1) {
          setSelectedBotId(activeBots[0].id);
          handleEnterQueue(activeBots[0].id);
        } else {
          setShowGameSelection(true);
        }
      }
    };
    
    continuePlayFlow();
  }, [pendingPlayAction, isAuthenticated, isAuthReady, isLoggingIn, refetchBots]);

  const handlePlayNow = async () => {
    // If logging in, show feedback
    if (isLoggingIn) {
      toast({
        title: 'Authentication in progress',
        description: 'Please wait...',
      });
      return;
    }

    // If wallet is connected but not authenticated, trigger login
    if (!isAuthenticated && isConnected) {
      setPendingPlayAction(true);
      try {
        await login();
        // The effect will handle continuing the play flow after auth completes
      } catch (error) {
        setPendingPlayAction(false);
        toast({
          title: 'Authentication failed',
          description: 'Please try again',
          variant: 'destructive',
        });
      }
      return;
    }

    if (!isAuthenticated) {
      toast({
        title: 'Authentication required',
        description: 'Please connect your wallet to play',
        variant: 'destructive',
      });
      return;
    }

    // Ensure we have fresh bot data
    let botsData = userBotsData;
    if (!botsData || !botsData.bots) {
      const { data: freshData } = await refetchBots();
      botsData = freshData;
    }
    
    const activeBots = botsData?.bots?.filter((bot: any) => bot.isActive) || [];
    
    if (activeBots.length === 0) {
      toast({
        title: 'No active bots',
        description: 'Deploy a bot first to start playing',
        variant: 'destructive',
      });
      navigate('/deploy');
      return;
    }

    // If user has only one bot, auto-select it
    if (activeBots.length === 1) {
      setSelectedBotId(activeBots[0].id);
      handleEnterQueue(activeBots[0].id);
    } else {
      // Show bot selection
      setShowGameSelection(true);
    }
  };

  const handleBotSelect = (botId: string) => {
    setSelectedBotId(botId);
    handleEnterQueue(botId);
  };

  const handleEnterQueue = async (botId: string) => {
    // Verify authentication before attempting to enter queue
    if (!isAuthenticated || !user || !isAuthReady) {
      toast({
        title: 'Authentication Required',
        description: 'Please wait for authentication to complete',
        variant: 'destructive',
      });
      return;
    }
    
    // console.log(`🎮 Entering queue with bot ${botId} for user ${user.address}`);
    
    try {
      await enterQueue({
        variables: {
          botId,
          queueType: 'STANDARD',
        },
      });
      
      // console.log(`✅ Successfully entered queue with bot ${botId}`);
      
      // Update state immediately to show queue widget
      setSelectedBotId(botId);
      setIsInQueue(true);
      setShowGameSelection(false);
      
      // Store queue state in localStorage
      localStorage.setItem('selectedBotId', botId);
      localStorage.setItem('isInQueue', 'true');
      
      // Check current queue status to see if we have enough players
      const currentQueueStatus = queueStatusData?.queueStatus;
      if (currentQueueStatus && currentQueueStatus.totalInQueue >= 3) {
        // console.log(`🚀 Queue has ${currentQueueStatus.totalInQueue + 1} players (including new entry), match will be created soon`);
        
        // Navigate to queue page with a flag indicating match is being created
        setTimeout(() => {
          navigate('/queue?matchCreating=true');
        }, 1000);
      }
    } catch (error: any) {
      console.error('❌ Failed to enter queue:', error);
      
      // Extract specific error message
      let errorMessage = 'Failed to enter queue';
      
      if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        errorMessage = error.graphQLErrors[0].message;
      } else if (error.networkError) {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Queue Entry Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      
      // If authentication error, clear the pending state
      if (errorMessage.includes('Not authenticated') || errorMessage.includes('authentication')) {
        setPendingPlayAction(false);
        setSelectedBotId(null);
        setShowGameSelection(false);
      }
    }
  };

  const handleLeaveQueue = async () => {
    if (!selectedBotId) return;
    
    try {
      await leaveQueue({
        variables: {
          botId: selectedBotId,
        },
        refetchQueries: ['GetUserBots', 'GetQueueStatus'],
        awaitRefetchQueries: true,
      });
      setSelectedBotId(null);
      setShowGameSelection(false);
      setIsInQueue(false);
      
      // Clear localStorage
      localStorage.removeItem('selectedBotId');
      localStorage.removeItem('isInQueue');
    } catch (error) {
      console.error('Failed to leave queue:', error);
    }
  };

  const handleTestGameType = async (gameType: string) => {
    try {
      console.log(`🎮 Test mode activated for ${gameType} game`);
      
      // Start debug logging for this game type
      debugLogger.startCapture(gameType);
      
      // Start backend debug logging
      await startDebugLogging({
        variables: {
          gameType: gameType,
        },
      });
      
      // Set the test game type override
      await setTestGameType({
        variables: {
          gameType: gameType,
        },
      });
      
      toast({
        title: 'Test Mode Activated',
        description: `Next match will be ${gameType} - Debug logging active`,
      });
      
      // Auto-show debug logs when starting a test
      setShowDebugLogs(true);
      
      // Now trigger the play flow
      handlePlayNow();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to set test game type',
        variant: 'destructive',
      });
    }
  };

  const handleGlobeLocationClick = (lat: number, lng: number) => {
    // Could be used to show tournament details at specific location
    console.log('Globe clicked at:', lat, lng);
  };

  const handlePortalComplete = () => {
    // Portal transition complete callback
    setShowPortalTransition(false);
  };

  const userBots = userBotsData?.bots || [];
  const activeBots = userBots.filter((bot: any) => bot.isActive);
  const queueStatus = queueStatusData?.queueStatus;
  
  // Get queue position for selected bot
  const selectedBot = activeBots.find((bot: any) => bot.id === selectedBotId);
  const queuePositions = selectedBot && selectedBot.queuePosition ? [{
    botId: selectedBot.id,
    botName: selectedBot.name,
    position: selectedBot.queuePosition,
    estimatedWaitTime: queueStatus?.averageWaitTime || 120,
    enteredAt: new Date().toISOString(),
    queueType: 'STANDARD'
  }] : [];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Debug Subscription Listener */}
      <DebugSubscriptionListener />
      
      {/* Debug Log Viewer */}
      {showDebugLogs && (
        <DebugLogViewer onClose={() => setShowDebugLogs(false)} />
      )}
      
      {/* Globe Background */}
      <InteractiveGlobe 
        tournaments={tournaments}
        onLocationClick={handleGlobeLocationClick}
      />
      
      {/* Main Content Section */}
      <section className="fixed inset-0 flex items-center justify-center pointer-events-none">
        
        {/* Overlay Content */}
        <div className="relative z-10 text-center px-4 pointer-events-auto">
          <AnimatePresence mode="wait">
            {!showGameSelection ? (
              <motion.div
                key="main"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Live Activity Stats */}
                <div className="inline-flex items-center gap-6 px-6 py-3 bg-black/60 backdrop-blur-sm rounded-full mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-white">
                      {queueStatus?.totalInQueue > 0 ? (
                        <>
                          {Math.min(queueStatus.totalInQueue, 4)}/4 players
                          {queueStatus.totalInQueue > 4 && ` (${queueStatus.totalInQueue - 4} waiting)`}
                        </>
                      ) : (
                        '0/4 players'
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                    <span className="text-sm text-white">{tournaments.filter(t => t.status === 'in-progress').length} Live Matches</span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 backdrop-blur-sm rounded-full border border-primary/20 mb-4">
                  <Globe className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-sm font-medium">AI Arena Global Network</span>
                </div>
                
                <h1 className="text-5xl md:text-7xl font-bold text-white drop-shadow-2xl">
                  AI Battle Arena
                  <span className="block text-3xl md:text-5xl mt-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    4-Player Tournaments
                  </span>
                </h1>
                
                <p className="text-xl text-white/80 max-w-2xl mx-auto drop-shadow-lg">
                  Deploy your AI bot and compete in real-time 4-player tournaments. No configuration needed - just click and play!
                </p>
                
                {/* Queue Interface */}
                {!isInQueue ? (
                  <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                    <Button 
                      size="lg" 
                      onClick={handlePlayNow}
                      disabled={botsLoading || isLoggingIn}
                      className="bg-primary hover:bg-primary/90 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all"
                    >
                      {(botsLoading || isLoggingIn) ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      ) : (
                        <Gamepad2 className="mr-2 h-5 w-5" />
                      )}
                      {isLoggingIn ? 'Authenticating...' : 'Play Now'}
                    </Button>
                    <Button 
                      size="lg" 
                      variant="outline"
                      onClick={() => navigate('/tournaments')}
                      className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
                    >
                      <Trophy className="mr-2 h-5 w-5" />
                      Watch Live
                    </Button>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-8"
                  >
                    <Card className="bg-black/60 backdrop-blur-xl border-primary/20 max-w-md mx-auto">
                      <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-lg font-medium text-white">In Queue</span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleLeaveQueue}
                            className="text-white/70 hover:text-white"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="text-center space-y-2">
                          <Bot className="h-12 w-12 text-primary mx-auto" />
                          <p className="text-white font-medium">{selectedBot?.name}</p>
                          <p className="text-white/60 text-sm">Finding 3 opponents...</p>
                        </div>
                        
                        <div className="flex items-center justify-center gap-2">
                          <Clock className="h-4 w-4 text-white/60" />
                          <span className="text-white/60 text-sm">
                            Estimated wait: {Math.floor((queueStatus?.averageWaitTime || 120) / 60)}m
                          </span>
                        </div>
                        
                        {queueStatus && (
                          <div className="pt-2 border-t border-white/10">
                            <div className="flex justify-between text-sm">
                              <span className="text-white/60">Position in queue</span>
                              <span className="text-white font-medium">#{selectedBot?.queuePosition || '?'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-white/60">Players ready</span>
                              <span className="text-white font-medium">{Math.min(queueStatus.totalInQueue, 4)}/4</span>
                            </div>
                            {queueStatus.totalInQueue > 4 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-white/60">Total waiting</span>
                                <span className="text-white font-medium">{queueStatus.totalInQueue}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="bot-selection"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.2 }}
                className="bg-background/90 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-primary/20 max-w-md w-full"
              >
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Select Your Bot</h2>
                    <p className="text-muted-foreground">Choose a bot to enter the queue</p>
                  </div>
                  
                  <div className="space-y-3">
                    {activeBots.map((bot: any) => (
                      <Card 
                        key={bot.id}
                        className="p-4 cursor-pointer hover:border-primary transition-colors"
                        onClick={() => handleBotSelect(bot.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">{bot.avatar || '🤖'}</div>
                            <div>
                              <p className="font-medium">{bot.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {bot.stats.wins}W - {bot.stats.losses}L
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline">
                            {bot.stats.winRate.toFixed(1)}%
                          </Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                  
                  <Button
                    variant="ghost"
                    onClick={() => setShowGameSelection(false)}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Portal Transition */}
      <PortalTransition 
        isActive={showPortalTransition}
        onComplete={handlePortalComplete}
      />
      
      {/* Test Mode Buttons - For testing specific game types */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
        <Card className="bg-background/90 backdrop-blur-xl border-primary/20 p-4">
          <div className="flex items-center gap-4">
            <p className="text-sm font-medium text-muted-foreground">
              Test Mode:
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleTestGameType('poker')}
                className="text-xs"
              >
                🃏 Poker
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleTestGameType('reverse-hangman')}
                className="text-xs"
              >
                🔤 Reverse Hangman
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleTestGameType('connect4')}
                className="text-xs"
              >
                🔴 Connect4
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={openLootbox}
                className="text-xs bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white"
              >
                🎁 Test Lootbox
              </Button>
            </div>
            <Button
              size="sm"
              variant={showDebugLogs ? "default" : "outline"}
              onClick={() => setShowDebugLogs(!showDebugLogs)}
              className="text-xs ml-4"
              title="Toggle Debug Logs (Ctrl/Cmd + D)"
            >
              🐛 Debug {showDebugLogs ? 'ON' : 'OFF'}
            </Button>
          </div>
        </Card>
      </div>
      
      {/* Lootbox Test Animation */}
      <LootboxAnimation
        isOpen={isOpen}
        onClose={closeLootbox}
        onOpen={generateReward}
        gameType="poker"
        winnerId="test-winner"
        winnerName="Test Winner"
      />
    </div>
  );
};

export default Index;
