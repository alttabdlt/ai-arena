import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useSubscription } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import SlotMachineTitle from '@shared/components/animations/SlotMachineTitle';
import { Card } from '@ui/card';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import { Loader2, Users, Zap, Trophy, Clock, Wifi, WifiOff } from 'lucide-react';
import { GameType, GAME_TYPE_INFO } from '@shared/types/tournament';
import { GET_QUEUE_STATUS, QUEUE_UPDATE_SUBSCRIPTION } from '@/graphql/queries/queue';
import { useToast } from '@shared/hooks/use-toast';
import { useWebSocketStatus } from '@shared/hooks/useWebSocketStatus';
import { gql } from '@apollo/client';
import { useAuth } from '@auth/contexts/AuthContext';

const Queue = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, isAuthReady } = useAuth();
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [backendGameType, setBackendGameType] = useState<GameType | null>(null);
  const [pendingMatchRoute, setPendingMatchRoute] = useState<string | null>(null);
  const [matchedBots, setMatchedBots] = useState<any[]>([]);
  const { isConnected, reconnectAttempts } = useWebSocketStatus();
  
  // Check authentication and redirect if not authenticated
  useEffect(() => {
    if (isAuthReady && !isAuthenticated) {
      console.log('⚠️ User not authenticated, redirecting to home');
      toast({
        title: 'Authentication Required',
        description: 'Please connect your wallet to join the queue',
        variant: 'destructive',
      });
      navigate('/');
    }
  }, [isAuthReady, isAuthenticated, navigate, toast]);
  
  // Debug state changes
  useEffect(() => {
    console.log('🎮 Queue state update:', {
      selectedGame,
      isMatching,
      backendGameType,
      pendingMatchRoute,
      matchedBots: matchedBots.map(b => ({ id: b.id, name: b.name }))
    });
  }, [selectedGame, isMatching, backendGameType, pendingMatchRoute, matchedBots]);
  
  // Query queue status
  const { data: queueData, loading } = useQuery(GET_QUEUE_STATUS, {
    pollInterval: 1000, // Fast polling while on this page
  });
  
  // Subscribe to queue updates
  const { data: queueUpdate, loading: subLoading, error: subError } = useSubscription(QUEUE_UPDATE_SUBSCRIPTION, {
    skip: false,
    fetchPolicy: 'no-cache',
    onData: ({ data }) => {
      console.log('📡 Queue subscription onData callback:', {
        hasData: !!data,
        dataStructure: data,
        dataKeys: data ? Object.keys(data) : [],
        timestamp: new Date().toISOString()
      });
      
      // Handle different data structures - Apollo sometimes wraps the data
      const subscriptionData = data?.data || data;
      const update = subscriptionData?.queueUpdate;
      
      if (update) {
        console.log('🔄 Processing subscription update:', {
          status: update.status,
          matchId: update.matchId,
          gameType: update.gameType,
          botName: update.bot?.name,
          botId: update.bot?.id
        });
        
        // Add bot to matched list if MATCHED
        if (update.status === 'MATCHED' && update.bot) {
          setMatchedBots(prev => {
            const exists = prev.some(bot => bot.id === update.bot.id);
            if (!exists) {
              return [...prev, update.bot];
            }
            return prev;
          });
        }
        
        // Store backend game type immediately (only once)
        if (update.gameType && !backendGameType) {
          console.log('🎯 Setting game type from subscription:', update.gameType);
          setBackendGameType(prevGameType => {
            // Double-check in the setter to prevent race conditions
            if (!prevGameType) {
              return update.gameType as GameType;
            }
            return prevGameType;
          });
        }
        
        // Store match route immediately (only once)
        if (update.status === 'MATCHED' && update.matchId && update.gameType && !pendingMatchRoute) {
          const GAME_ROUTES: Record<string, string> = {
            'poker': '/poker',
            'reverse-hangman': '/hangman-server',
            'connect4': '/connect4'
          };
          
          const routeSuffix = GAME_ROUTES[update.gameType] || '';
          const route = `/tournament/${update.matchId}${routeSuffix}`;
          console.log('🛣️ Setting pending match route:', route);
          setPendingMatchRoute(prevRoute => {
            // Double-check in the setter to prevent race conditions
            if (!prevRoute) {
              return route;
            }
            return prevRoute;
          });
        }
      }
    },
    onError: (error) => {
      console.error('❌ Queue subscription error:', {
        message: error.message,
        graphQLErrors: error.graphQLErrors,
        networkError: error.networkError,
        stack: error.stack
      });
    },
    onComplete: () => {
      console.log('✅ Queue subscription complete');
    },
  });
  
  // Debug subscription data deeply
  useEffect(() => {
    if (queueUpdate) {
      console.log('🔍 Raw subscription data:', JSON.stringify(queueUpdate, null, 2));
    }
  }, [queueUpdate]);
  
  // Log subscription status
  useEffect(() => {
    console.log('🔌 Queue subscription status:', {
      loading: subLoading,
      error: subError,
      hasData: !!queueUpdate,
      queueUpdate
    });
  }, [subLoading, subError, queueUpdate]);
  
  // Check if enough players and redirect if not
  useEffect(() => {
    // Skip this check on initial load to allow subscriptions to arrive
    if (!queueData || loading) return;
    
    const totalInQueue = queueData?.queueStatus?.totalInQueue || 0;
    
    // Check if we were already matched (came here with a matchId in subscription)
    const isAlreadyMatched = queueUpdate?.queueUpdate?.status === 'MATCHED' && queueUpdate?.queueUpdate?.matchId;
    
    // Check URL params - if we came here with a match being created, don't redirect
    const urlParams = new URLSearchParams(window.location.search);
    const isMatchCreating = urlParams.get('matchCreating') === 'true';
    
    // Check if we're in the middle of matching
    const isMatchingInProgress = isMatching || selectedGame !== null;
    
    console.log('🔍 Queue page check:', {
      totalInQueue,
      isAlreadyMatched,
      isMatchCreating,
      isMatchingInProgress,
      queueUpdate: queueUpdate?.queueUpdate
    });
    
    // Only redirect if not enough players AND we're not already matched AND not creating a match AND not in matching process
    if (totalInQueue < 4 && !isAlreadyMatched && !isMatchCreating && !isMatchingInProgress) {
      // Give a longer delay to allow subscription updates to arrive
      const redirectTimer = setTimeout(() => {
        // Double-check before redirecting
        const currentTotalInQueue = queueData?.queueStatus?.totalInQueue || 0;
        if (currentTotalInQueue < 4 && !isMatching) {
          console.log('⚠️ Redirecting - not enough players');
          toast({
            title: 'Not enough players',
            description: 'Need 4 players to start a match',
            variant: 'destructive',
          });
          navigate('/');
        }
      }, 3000); // 3 second delay instead of 1
      
      return () => clearTimeout(redirectTimer);
    }
  }, [queueData, queueUpdate, navigate, toast, loading, isMatching, selectedGame]);
  
  // Check URL parameters on mount and reset state
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isMatchCreating = urlParams.get('matchCreating') === 'true';
    console.log('🌐 Queue page mounted:', {
      isMatchCreating,
      totalInQueue: queueData?.queueStatus?.totalInQueue,
      isLoading: loading
    });
    
    // Clear previous match data on mount
    setMatchedBots([]);
    setBackendGameType(null);
    setPendingMatchRoute(null);
    setSelectedGame(null);
    setIsMatching(false);
  }, []);
  
  // Handle game selection
  const handleGameSelected = (gameType: GameType) => {
    console.log('🎮 handleGameSelected called with:', gameType);
    setSelectedGame(gameType);
    setIsMatching(true);
    
    // Show matching animation
    toast({
      title: `${GAME_TYPE_INFO[gameType].name} selected!`,
      description: 'Creating match...',
    });
    
    // Check if we have a pending match route to navigate to
    if (pendingMatchRoute) {
      console.log('🎰 Slot machine animation complete, navigating to:', pendingMatchRoute);
      // Small delay to let the toast show
      setTimeout(() => {
        console.log('🚀 Actually navigating now to:', pendingMatchRoute);
        navigate(pendingMatchRoute);
      }, 500);
    } else {
      console.log('⚠️ No pending match route available yet');
    }
  };
  
  // Handle queue updates for match creation
  useEffect(() => {
    console.log('🔄 Queue update effect triggered (should be minimal now):', {
      hasQueueUpdate: !!queueUpdate,
      backendGameType,
      pendingMatchRoute,
      selectedGame
    });
    
    // If slot machine already completed and we have a route, navigate
    if (selectedGame && pendingMatchRoute) {
      console.log('🎰 Slot machine completed and route available, navigating');
      setTimeout(() => {
        navigate(pendingMatchRoute);
      }, 500);
    }
  }, [queueUpdate, navigate, selectedGame, pendingMatchRoute, backendGameType]);
  
  // Fallback: Check for active matches via polling when WebSocket is disconnected
  useEffect(() => {
    if (!isConnected && selectedGame) {
      console.log('🔄 WebSocket disconnected, using polling fallback');
      
      // Poll more aggressively when disconnected
      const pollInterval = setInterval(() => {
        // Re-fetch queue status
        if (queueData?.queueStatus?.totalMatched && queueData.queueStatus.totalMatched >= 4) {
          console.log('🎮 Match likely created (4+ matched), attempting navigation');
          // Give backend time to create match
          setTimeout(() => {
            // Navigate to bots page as fallback
            toast({
              title: 'Match may have been created',
              description: 'Check your bots page for active matches',
            });
            navigate('/bots');
          }, 3000);
          clearInterval(pollInterval);
        }
      }, 2000);
      
      return () => clearInterval(pollInterval);
    }
  }, [isConnected, selectedGame, queueData, navigate, toast]);
  
  if (loading || !isAuthReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const totalInQueue = queueData?.queueStatus?.totalInQueue || 0;
  
  return (
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/20 rounded-full blur-3xl animate-pulse" />
      </div>
      
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* WebSocket Status */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed top-4 right-4 z-50"
          >
            <Card className="p-3 bg-destructive/10 border-destructive/20">
              <div className="flex items-center gap-2 text-destructive">
                <WifiOff className="h-4 w-4" />
                <span className="text-sm font-medium">
                  WebSocket disconnected
                  {reconnectAttempts > 0 && ` (Retry ${reconnectAttempts})`}
                </span>
              </div>
            </Card>
          </motion.div>
        )}
        
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-full border border-green-500/20 mb-6"
          >
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-500 font-medium">Match Ready!</span>
          </motion.div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Game Selection
          </h1>
          <p className="text-xl text-muted-foreground">
            {totalInQueue} players ready • Starting match...
          </p>
        </div>
        
        {/* Players in queue */}
        <Card className="mb-8 p-6 bg-muted/5 backdrop-blur-sm border-primary/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Players Ready
            </h3>
            <Badge variant="secondary" className="bg-green-500/10 text-green-500">
              {totalInQueue}/4 Players
            </Badge>
          </div>
          
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => {
              const bot = matchedBots[i];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className={`p-4 rounded-lg border ${
                    bot || i < totalInQueue 
                      ? 'bg-primary/10 border-primary/20' 
                      : 'bg-muted/10 border-border'
                  }`}
                >
                  <div className="flex items-center justify-center">
                    {bot ? (
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                          <span className="text-2xl">
                            {bot.avatar && !bot.avatar.startsWith('bot-') ? bot.avatar : '🤖'}
                          </span>
                        </div>
                        <p className="text-xs font-medium">{bot.name}</p>
                        <p className="text-xs text-muted-foreground opacity-75">
                          {bot.creator?.address === '0x0000000000000000000000000000000000000001' ? 'Demo Bot' : 'Player Bot'}
                        </p>
                      </div>
                    ) : i < totalInQueue ? (
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                          <Trophy className="h-6 w-6 text-primary" />
                        </div>
                        <p className="text-xs text-muted-foreground">Player {i + 1}</p>
                      </div>
                    ) : (
                      <div className="text-center opacity-50">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                          <Users className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground">Waiting...</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Card>
        
        {/* Game Selection */}
        <AnimatePresence mode="wait">
          {!selectedGame && !isMatching ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <SlotMachineTitle 
                onGameSelected={handleGameSelected}
                className="max-w-2xl mx-auto"
                preSelectedGame={backendGameType || undefined}
                autoStartDelay={500}
              />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6"
            >
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-primary/10 rounded-full">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-lg font-medium">Creating match...</span>
              </div>
              
              {selectedGame && (
                <div className="space-y-2">
                  <p className="text-2xl font-bold">
                    {GAME_TYPE_INFO[selectedGame].icon} {GAME_TYPE_INFO[selectedGame].name}
                  </p>
                  <p className="text-muted-foreground">
                    Preparing tournament setup...
                  </p>
                </div>
              )}
              
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>This will take a few seconds</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Auto-start hint */}
        {!selectedGame && !isMatching && totalInQueue >= 4 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-8"
          >
            <p className="text-sm text-muted-foreground">
              Game selection will start automatically in a moment...
            </p>
          </motion.div>
        )}
        
        {/* Debug button - remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed bottom-4 right-4 space-y-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                console.log('🧪 Manual test: Setting game type');
                setBackendGameType('reverse-hangman' as GameType);
                setPendingMatchRoute('/tournament/test-match/hangman-server');
              }}
            >
              Test Set Game
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // Get the latest match ID from backend logs
                const testMatchId = prompt('Enter match ID from backend logs:');
                if (testMatchId) {
                  navigate(`/tournament/${testMatchId}/hangman-server`);
                }
              }}
            >
              Go to Match
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Queue;