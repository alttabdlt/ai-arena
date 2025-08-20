import { START_DEBUG_LOGGING } from '@/graphql/mutations/debug';
import { SET_TEST_GAME_TYPE } from '@/graphql/mutations/test';
// Metaverse query removed - using idle game now
import { GET_USER_BOTS } from '@/graphql/queries/user';
import { useMutation, useQuery, useSubscription } from '@apollo/client';
import { useAuth } from '@auth/contexts/AuthContext';
import PortalTransition from '@shared/components/animations/PortalTransition';
import InteractiveGlobe from '@shared/components/globe/InteractiveGlobe';
import { Tournament } from '@shared/types/tournament';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import { Card } from '@ui/card';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Clock, Gamepad2, Globe, Loader2, Trophy, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
// import { METAVERSE_STATS_SUBSCRIPTION } from '@/graphql/subscriptions/metaverse';
import { LootboxAnimation } from '@shared/components/animations/LootboxAnimation';
import { DebugLogViewer } from '@shared/components/DebugLogViewer';
import { DebugSubscriptionListener } from '@shared/components/DebugSubscriptionListener';
import { useToast } from '@shared/hooks/use-toast';
import { useLootbox } from '@shared/hooks/useLootbox';
import { debugLogger } from '@shared/services/debugLogger';

const Index = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoggingIn, isAuthReady, login } = useAuth();
  const { connected: isConnected } = useWallet();
  const { toast } = useToast();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [showGameSelection, setShowGameSelection] = useState(false);
  const [showPortalTransition, setShowPortalTransition] = useState(false);
  const [selectedGameType, setSelectedGameType] = useState<string | null>(null);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const globeRef = useRef<any>(null);
  
  // Lootbox test integration
  const { isOpen, openLootbox, closeLootbox, generateReward } = useLootbox({
    winnerId: 'test-winner',
    gameType: 'poker',
    onRewardReceived: (reward) => {
      console.log('Test lootbox reward:', reward);
    }
  });
  const [pendingPlayAction, setPendingPlayAction] = useState(false);
  const [showDebugLogs, setShowDebugLogs] = useState(false);

  // GraphQL Queries
  const { data: userBotsData, loading: botsLoading, refetch: refetchBots } = useQuery(GET_USER_BOTS, {
    variables: { address: user?.address || '' },
    skip: !user?.address,
    fetchPolicy: 'cache-and-network',
  });


  // Metaverse query removed - using idle game now
  const metaverseBotsData = null;

  // GraphQL Mutations
  const [setTestGameType] = useMutation(SET_TEST_GAME_TYPE);
  const [startDebugLogging] = useMutation(START_DEBUG_LOGGING);
  
  // Queue mutations removed - no longer used

  // Queue subscriptions removed
  
  // Subscribe to metaverse stats updates
  // TODO: Implement metaverseStats subscription in backend
  // const { data: metaverseStats } = useSubscription(METAVERSE_STATS_SUBSCRIPTION);
  const metaverseStats = null; // Temporarily disabled until backend implementation
  
  // Check localStorage for selected bot on mount
  useEffect(() => {
    const storedBotId = localStorage.getItem('selectedBotId');
    if (storedBotId) {
      setSelectedBotId(storedBotId);
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
  

  // Queue update handling removed

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
          navigate('/metaverse');
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
      navigate('/metaverse');
    } else {
      // Show bot selection
      setShowGameSelection(true);
    }
  };

  const handleBotSelect = (botId: string) => {
    setSelectedBotId(botId);
    localStorage.setItem('selectedBotId', botId);
    setShowGameSelection(false);
    // Navigate to tournaments or bots page
    navigate('/tournaments');
  };

  // Navigate to tournaments instead of queue
  const navigateToTournaments = () => {
    navigate('/tournaments');
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

  const handleEnterMetaverse = () => {
    // Start zoom animation on globe
    if (metaverseBotsData?.bots && metaverseBotsData.bots.length > 0) {
      // Find the zone with most bots (only count active bots with zones)
      const zoneCounts: Record<string, number> = {};
      metaverseBotsData.bots
        .filter((bot: any) => bot.isActive && bot.currentZone)
        .forEach((bot: any) => {
          zoneCounts[bot.currentZone] = (zoneCounts[bot.currentZone] || 0) + 1;
        });
      
      // Only try to find popular zone if we have any zones
      const zoneEntries = Object.entries(zoneCounts);
      if (zoneEntries.length > 0) {
        const popularZone = zoneEntries.reduce((a, b) => 
          a[1] > b[1] ? a : b
        )[0];

        // Trigger globe zoom animation
        const zoneCoords = {
          casino: { lat: 36.1699, lng: -115.1398 },
          darkAlley: { lat: 40.7128, lng: -74.0060 },
          suburb: { lat: 34.0522, lng: -118.2437 },
        };

        if (zoneCoords[popularZone as keyof typeof zoneCoords] && globeRef.current && globeRef.current.zoomToLocation) {
          const coords = zoneCoords[popularZone as keyof typeof zoneCoords];
          try {
            globeRef.current.zoomToLocation(coords.lat, coords.lng, 0.3);
          } catch (error) {
            console.warn('Globe zoom failed:', error);
          }
        }
      }
    }
    
    // Show portal transition and navigate after delay
    setTimeout(() => {
      setShowPortalTransition(true);
      setTimeout(() => {
        // Navigate to the metaverse game running on port 5175
        // Pass the user's wallet address and auth token as URL parameters
        const token = localStorage.getItem('ai-arena-access-token');
        const params = new URLSearchParams();
        if (user?.address) {
          params.append('address', user.address);
        }
        if (token) {
          params.append('token', token);
        }
        const metaverseUrl = params.toString() 
          ? `http://localhost:5175?${params.toString()}`
          : 'http://localhost:5175';
        window.open(metaverseUrl, '_blank');
        // Reset globe view after navigation
        setTimeout(() => {
          if (globeRef.current && globeRef.current.resetView) {
            try {
              globeRef.current.resetView();
            } catch (error) {
              console.warn('Globe reset failed:', error);
            }
          }
          setShowPortalTransition(false);
        }, 1000);
      }, 1000);
    }, 2000);
  };

  const userBots = userBotsData?.bots || [];
  const activeBots = userBots.filter((bot: any) => bot.isActive);
  // Get selected bot
  const selectedBot = activeBots.find((bot: any) => bot.id === selectedBotId);

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
        globeRef={globeRef}
        onZoomComplete={() => {
          // Optional: Add any additional logic after zoom completes
        }}
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
                      {activeBots.length} Active Bots
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                    <span className="text-sm text-white">{tournaments.filter(t => t.status === 'in-progress').length} Live Matches</span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 backdrop-blur-sm rounded-full border border-primary/20 mb-4 pixel-border">
                  <Globe className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-sm font-medium pixel-title">AI Arena Global Network</span>
                </div>
                
                <h1 className="text-5xl md:text-7xl font-bold text-white drop-shadow-2xl pixel-title">
                  AI Battle Arena
                  <span className="block text-3xl md:text-5xl mt-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    4-Player Tournaments
                  </span>
                </h1>
                
                <p className="text-xl text-white/80 max-w-2xl mx-auto drop-shadow-lg">
                  Deploy your AI bot and compete in real-time 4-player tournaments. No configuration needed - just click and play!
                </p>
                
                {/* Play Interface */}
                {true ? (
                  <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                    <Button 
                      size="lg" 
                      onClick={handlePlayNow}
                      disabled={botsLoading || isLoggingIn}
                      className="pixel-btn bg-primary hover:bg-primary/90 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all"
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
                      className="pixel-btn bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
                    >
                      <Trophy className="mr-2 h-5 w-5" />
                      Watch Live
                    </Button>
                  </div>
                ) : null}
              </motion.div>
            ) : (
              <motion.div
                key="bot-selection"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.2 }}
                className="bg-background/95 backdrop-blur-sm rounded-lg p-6 shadow-xl border border-border max-w-md w-full"
              >
                <div className="space-y-4">
                  <div className="text-center">
                    <h2 className="text-xl font-semibold mb-1">Select Your Bot</h2>
                    <p className="text-sm text-muted-foreground">Choose a bot to start playing</p>
                  </div>
                  
                  <div className="space-y-2">
                    {activeBots.map((bot: any) => (
                      <Card 
                        key={bot.id}
                        className="p-3 cursor-pointer hover:bg-muted/50 transition-colors border-border"
                        onClick={() => handleBotSelect(bot.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {bot.avatar && bot.avatar.startsWith('data:image') ? (
                              <img 
                                src={bot.avatar} 
                                alt={bot.name}
                                className="w-10 h-10 rounded-full object-cover"
                                style={{ imageRendering: 'pixelated' }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                <Bot className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-sm">{bot.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {bot.stats.wins}W - {bot.stats.losses}L
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="secondary" className="text-xs">
                              {bot.stats.winRate.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={() => setShowGameSelection(false)}
                    className="w-full"
                    size="sm"
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
