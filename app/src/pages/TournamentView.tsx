import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { GET_MATCH } from '@/graphql/queries/bot';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Eye, Users, Trophy, Activity, Play, Pause, Zap, Timer, Brain, History, ChevronDown, ChevronUp, Sparkles, Loader2 } from 'lucide-react';
import { PokerTable } from '@/components/game/poker/PokerTable';
import { useState, useEffect, useRef } from 'react';
import { useServerSidePoker } from '@/hooks/useServerSidePoker';
import { DecisionHistory } from '@/components/DecisionHistory';
import { StyleBonusNotification } from '@/components/StyleBonusNotification';
import { AIEvaluationPanel } from '@/components/AIEvaluationPanel';
import { HandMisreadAlert } from '@/components/HandMisreadAlert';
import { PointNotification } from '@/components/PointNotification';
import { AchievementNotification } from '@/components/AchievementNotification';
import { CombinedLeaderboard } from '@/components/CombinedLeaderboard';
import { useModelEvaluations } from '@/hooks/useModelEvaluation';
import { IPlayerConfig as PlayerConfig } from '@/game-engine/core/interfaces';
import type { PokerAction } from '@/game-engine/games/poker';
import botGambler from '@/assets/bot-gambler.png';
import botTerminator from '@/assets/bot-terminator.png';
import botZenMaster from '@/assets/bot-zen-master.png';


const TournamentView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Load match data from GraphQL
  const { data: matchData, loading: matchLoading, error: matchError } = useQuery(GET_MATCH, {
    variables: { id },
    skip: !id,
    onCompleted: (data) => {
      console.log('🏆 Match data loaded:', {
        matchId: id,
        hasMatch: !!data?.match,
        matchStatus: data?.match?.status,
        participantCount: data?.match?.participants?.length
      });
    },
    onError: (error) => {
      console.error('❌ Match query error:', {
        matchId: id,
        error: error.message,
        graphQLErrors: error.graphQLErrors,
        networkError: error.networkError
      });
    }
  });
  
  const [tournament, setTournament] = useState<{
    id: string;
    name: string;
    status: string;
    totalPrize: number;
    participants: number;
    currentRound: string;
    viewers: number;
    gameType: string;
    config: any;
    players: any[];
  } | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAIThinking, setShowAIThinking] = useState(true);
  const [showDecisionHistory, setShowDecisionHistory] = useState(true);
  const [showAIEvaluation, setShowAIEvaluation] = useState(true);
  const [playerConfigs, setPlayerConfigs] = useState<PlayerConfig[]>([]);
  const [selectedTournamentMode, setSelectedTournamentMode] = useState<'STYLE_MASTER' | 'BALANCED' | 'CLASSIC'>('BALANCED');
  
  // Check if this is actually a poker game
  const isPokerGame = !matchData?.match?.gameHistory || 
    matchData?.match?.gameHistory?.gameType === 'poker' || 
    !matchData?.match?.gameHistory?.gameType;
  
  // Only use poker hook for poker games, provide empty values for other games
  const pokerHookResult = isPokerGame ? useServerSidePoker({ 
    gameId: id || '', 
    tournament: matchData?.match || null
  }) : null;

  // Provide default values for non-poker games
  const { 
    gameState = { players: [], communityCards: [], pot: 0, currentBet: 0, phase: 'waiting', currentPlayer: null, winners: [], isHandComplete: false, currentAIThinking: null, currentAIReasoning: null, recentActions: [], aiDecisionHistory: new Map(), recentStyleBonuses: [], recentMisreads: [], recentPointEvents: [], recentAchievementEvents: [] },
    isInitialized = false, 
    isPaused = false, 
    gameSpeed = 'normal',
    config = {},
    currentGameState = 'setup',
    startNewHand = () => Promise.resolve(), 
    pauseGame = () => {}, 
    resumeGame = () => {}, 
    changeSpeed = () => {},
    getDecisionHistory = () => [],
    getCurrentHandDecisions = () => new Map(),
    getCurrentHandNumber = () => 1,
    updateConfig = () => {},
    startGame = () => {},
    stopGame = () => {},
    clearGame = () => {},
    getStyleLeaderboard = () => [],
    getPlayerStyleStats = () => null,
    getAllStyleStats = () => new Map(),
    getPointLeaderboard = () => [],
    getPlayerPoints = () => ({ base: 0, style: 0, penalty: 0, total: 0 })
  } = pokerHookResult || {};
  
  // Fetch AI evaluation data
  const { evaluations } = useModelEvaluations();
  
  // Mock tournament-specific functions not in server-side hook
  const setTournamentMode = (mode: any) => setSelectedTournamentMode(mode);
  const getPlayerAchievements = () => [];
  const getAchievementProgress = () => ({ unlocked: 0, total: 0, percentage: 0 });
  const getAllAchievements = () => [];
  const getTotalAchievementPoints = () => 0;

  // Generate default player configurations
  const generateDefaultPlayerConfigs = (count: number, defaultModel: PlayerConfig['aiModel'] = 'gpt-4o'): PlayerConfig[] => {
    const botProfiles = [
      { id: 'gambler', name: 'The Gambler', avatar: botGambler },
      { id: 'terminator', name: 'Terminator', avatar: botTerminator },
      { id: 'zenmaster', name: 'Zen Master', avatar: botZenMaster }
    ];
    
    const additionalNames = ['Shark', 'Bluffer', 'Calculator', 'Rock', 'Maniac', 'Trickster'];
    
    const configs: PlayerConfig[] = [];
    
    for (let i = 0; i < count; i++) {
      if (i < botProfiles.length) {
        configs.push({
          ...botProfiles[i],
          aiModel: defaultModel
        });
      } else {
        const avatarIndex = i % botProfiles.length;
        const nameIndex = (i - botProfiles.length) % additionalNames.length;
        configs.push({
          id: `bot-${i}`,
          name: additionalNames[nameIndex],
          avatar: botProfiles[avatarIndex].avatar,
          aiModel: defaultModel
        });
      }
    }
    
    return configs;
  };

  // Update player model
  const updatePlayerModel = (playerId: string, model: PlayerConfig['aiModel']) => {
    setPlayerConfigs(prev => 
      prev.map(p => p.id === playerId ? { ...p, aiModel: model } : p)
    );
  };

  // Process match data when loaded
  useEffect(() => {
    if (matchData?.match) {
      const match = matchData.match;
      
      // Check game type and redirect if not poker
      const gameHistory = match.gameHistory || null;
      const gameType = gameHistory?.gameType;
      
      // Log for debugging
      console.log('🎮 TournamentView game type detection:', {
        matchId: match.id,
        hasGameHistory: !!gameHistory,
        gameType: gameType,
        rawGameHistory: gameHistory
      });
      
      // Redirect based on game type
      if (gameType === 'poker' || !gameType) {
        // Redirect poker games to dedicated poker view
        navigate(`/tournament/${match.id}/poker`);
        return;
      } else if (gameType === 'reverse-hangman') {
        navigate(`/tournament/${match.id}/hangman-server`);
        return;
      } else if (gameType === 'connect4') {
        navigate(`/tournament/${match.id}/connect4`);
        return;
      }
      
      // Transform match data to tournament format
      const tournamentData = {
        id: match.id,
        name: match.tournament?.name || `Match ${match.id.slice(0, 8)}`,
        status: match.status === 'SCHEDULED' ? 'waiting' : match.status === 'IN_PROGRESS' ? 'in-progress' : 'completed',
        gameType: gameType,
        config: {
          startingChips: 100000, // 100k chips as requested
          blindStructure: 'normal', // Normal speed
          maxHands: 20, // 20 hands as requested
          speed: 'normal',
          mode: 'balanced' // Balanced mode
        },
        players: match.participants.map((participant: any) => ({
          id: participant.bot.id,
          name: participant.bot.name,
          aiModel: participant.bot.modelType,
          strategy: participant.bot.prompt,
          status: 'playing',
          isReady: true,
          joinedAt: match.createdAt,
          avatar: participant.bot.avatar,
          seat: participant.position
        })),
        totalPrize: 0,
        participants: match.participants.length,
        currentRound: 'Main Event',
        viewers: Math.floor(Math.random() * 1000) + 500,
        maxPlayers: 4,
        minPlayers: 4,
        isPublic: true,
        createdBy: 'system',
        createdAt: match.createdAt
      };
      
      setTournament(tournamentData);
      setIsLoading(false);
      
      // Generate player configs from match participants
      const configs = match.participants.map((participant: any) => ({
        id: participant.bot.id,
        name: participant.bot.name,
        avatar: participant.bot.avatar,
        aiModel: participant.bot.modelType
      }));
      setPlayerConfigs(configs);
    }
  }, [matchData, navigate]);

  // Update config when tournament data is loaded
  useEffect(() => {
    if (tournament && playerConfigs.length > 0) {
      // Update config with standardized settings and player configurations
      updateConfig({ 
        playerConfigs,
        startingChips: 100000,
        blindStructure: 'normal',
        maxHands: 20,
        speed: 'normal',
        mode: 'balanced'
      });
    }
  }, [tournament, playerConfigs, updateConfig]);

  // Handle loading and error states
  useEffect(() => {
    if (matchError) {
      console.error('🚨 Match loading error:', matchError);
      const errorMessage = matchError.message || 'Failed to load match data. Please try again.';
      setLoadingError(errorMessage);
      setIsLoading(false);
    }
  }, [matchError]);

  // Update loading state
  useEffect(() => {
    setIsLoading(matchLoading);
  }, [matchLoading]);

  // Sync local state with config
  useEffect(() => {
    if (config) {
      setShowAIThinking(config.showAIThinking);
      setShowDecisionHistory(config.showDecisionHistory);
    }
  }, [config]);
  
  // Initialize player configs from tournament data
  useEffect(() => {
    if (tournament?.players) {
      const configs: PlayerConfig[] = tournament.players.map(player => ({
        id: player.id,
        name: player.name,
        aiModel: player.aiModel || 'gpt-4o',
        avatar: player.avatar
      }));
      setPlayerConfigs(configs);
    } else if (config?.playerCount && playerConfigs.length === 0) {
      // Fall back to generating default configs if no tournament data
      setPlayerConfigs(generateDefaultPlayerConfigs(config.playerCount));
    }
  }, [tournament?.players, config?.playerCount]);


  // Cleanup on unmount to prevent orphaned games
  useEffect(() => {
    return () => {
      // Stop the game when leaving the page
      if (currentGameState === 'playing') {
        stopGame();
      }
    };
  }, [currentGameState, stopGame]);

  // Show loading state
  if (isLoading && !loadingError) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Button 
            variant="outline" 
            onClick={() => navigate('/tournaments')}
            className="mb-4"
          >
            Back to Tournaments
          </Button>
          <div className="flex items-center justify-center mt-20">
            <Card className="p-8 text-center max-w-md">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold mb-2">Loading Tournament</h2>
              <p className="text-muted-foreground">Tournament ID: {id}</p>
              <p className="text-sm text-muted-foreground mt-2">This may take a few seconds...</p>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (loadingError || (!tournament && !isLoading)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Button 
            variant="outline" 
            onClick={() => navigate('/tournaments')}
            className="mb-4"
          >
            Back to Tournaments
          </Button>
          <div className="flex items-center justify-center mt-20">
            <Card className="p-8 text-center max-w-md">
              <div className="text-destructive mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">Unable to Load Tournament</h2>
              <p className="text-muted-foreground mb-4">{loadingError || 'Failed to load match data. Please try again.'}</p>
              {id && (
                <p className="text-sm text-muted-foreground mb-4">Match ID: {id}</p>
              )}
              <div className="space-y-2">
                <Button onClick={() => navigate('/tournaments')} className="w-full">
                  Go to Tournaments
                </Button>
                {import.meta.env.DEV && (
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.reload()} 
                    className="w-full"
                  >
                    Retry
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4" />
          <p className="text-muted-foreground">Initializing game...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Style Bonus Notifications */}
      <StyleBonusNotification bonuses={gameState.recentStyleBonuses} />
      
      {/* Hand Misread Alerts */}
      {gameState.recentMisreads.map((misread, index) => (
        <HandMisreadAlert 
          key={`${misread.handNumber}-${index}`}
          misread={misread}
        />
      ))}
      
      {/* Point Notifications */}
      <PointNotification events={gameState.recentPointEvents} />
      
      {/* Achievement Notifications */}
      <AchievementNotification 
        events={gameState.recentAchievementEvents} 
        players={new Map(gameState.players.map(p => [p.id, { name: p.name, avatar: p.avatar }] as [string, { name: string; avatar: string }]))}
      />
      
      <div className="container mx-auto px-4 py-8">
        {/* Tournament Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">{tournament.name}</h1>
              <p className="text-muted-foreground">{tournament.currentRound}</p>
            </div>
            <Badge className={tournament.status === 'live' ? 'bg-destructive' : 'bg-muted'}>
              {tournament.status === 'live' && <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />}
              {tournament.status.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Game Controls - Only show during game */}
        {(currentGameState === 'playing' || currentGameState === 'paused' || currentGameState === 'finished') && (
        <>
        <div className="mb-6">
          {/* Game Controls - Horizontal Layout */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="outline">
                      Hand {getCurrentHandNumber()}{config?.maxHands !== -1 ? ` of ${config?.maxHands || 20}` : ''}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="secondary">
                      {config?.speed === 'thinking' ? '1 Min Thinking' : config?.speed === 'fast' ? 'Fast' : 'Normal'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={isPaused ? resumeGame : pauseGame}
                  >
                    {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </Button>
                  {gameState.isHandComplete && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={startNewHand}
                    >
                      Start New Hand
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm('Are you sure you want to exit this game?')) {
                        clearGame();
                      }
                    }}
                  >
                    Exit Game
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        </>
        )}
        
        {/* Combined Leaderboard Popup - renders outside of main content flow */}
        <CombinedLeaderboard
          players={new Map(gameState.players.map(p => [p.id, { id: p.id, name: p.name, avatar: p.avatar }] as [string, { id: string; name: string; avatar: string }]))}
          getPointLeaderboard={getPointLeaderboard}
          currentChips={new Map(gameState.players.map(p => [p.id, p.chips] as [string, number]))}
          currentHandNumber={getCurrentHandNumber()}
          mode={selectedTournamentMode}
          startingChips={config?.startingChips || 10000}
        />

        
        {/* Game Configuration Panel - Disabled for auto-start */}
        {currentGameState === 'setup' && isInitialized && false && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Timer className="h-5 w-5" />
                  Game Configuration
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={clearGame}
                >
                  Clear Game
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Game Speed</label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={config?.speed === 'thinking' ? 'default' : 'outline'}
                        onClick={() => updateConfig({ speed: 'thinking' })}
                      >
                        1 Min Thinking
                      </Button>
                      <Button
                        size="sm"
                        variant={config?.speed === 'normal' ? 'default' : 'outline'}
                        onClick={() => updateConfig({ speed: 'normal' })}
                      >
                        Normal
                      </Button>
                      <Button
                        size="sm"
                        variant={config?.speed === 'fast' ? 'default' : 'outline'}
                        onClick={() => updateConfig({ speed: 'fast' })}
                      >
                        Fast
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Tournament Mode</label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={selectedTournamentMode === 'CLASSIC' ? 'default' : 'outline'}
                        onClick={() => {
                          setSelectedTournamentMode('CLASSIC');
                          setTournamentMode('CLASSIC');
                        }}
                        title="70% chips, 30% style points"
                      >
                        Classic
                      </Button>
                      <Button
                        size="sm"
                        variant={selectedTournamentMode === 'BALANCED' ? 'default' : 'outline'}
                        onClick={() => {
                          setSelectedTournamentMode('BALANCED');
                          setTournamentMode('BALANCED');
                        }}
                        title="50% chips, 50% style points"
                      >
                        Balanced
                      </Button>
                      <Button
                        size="sm"
                        variant={selectedTournamentMode === 'STYLE_MASTER' ? 'default' : 'outline'}
                        onClick={() => {
                          setSelectedTournamentMode('STYLE_MASTER');
                          setTournamentMode('STYLE_MASTER');
                        }}
                        title="30% chips, 70% style points"
                      >
                        Style Master
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Number of Players: {config?.playerCount || 3}
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {[2, 3, 4, 5, 6, 7, 8].map(count => (
                        <Button
                          key={count}
                          size="sm"
                          variant={config?.playerCount === count ? 'default' : 'outline'}
                          onClick={() => updateConfig({ playerCount: count })}
                        >
                          {count} Players
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Starting Chips: ${config?.startingChips || 10000}
                    </label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={config?.startingChips === 10000 ? 'default' : 'outline'}
                        onClick={() => updateConfig({ startingChips: 10000 })}
                      >
                        10K
                      </Button>
                      <Button
                        size="sm"
                        variant={config?.startingChips === 25000 ? 'default' : 'outline'}
                        onClick={() => updateConfig({ startingChips: 25000 })}
                      >
                        25K
                      </Button>
                      <Button
                        size="sm"
                        variant={config?.startingChips === 50000 ? 'default' : 'outline'}
                        onClick={() => updateConfig({ startingChips: 50000 })}
                      >
                        50K
                      </Button>
                      <Button
                        size="sm"
                        variant={config?.startingChips === 100000 ? 'default' : 'outline'}
                        onClick={() => updateConfig({ startingChips: 100000 })}
                      >
                        100K
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Number of Hands: {config?.maxHands === -1 ? 'Infinite' : (config?.maxHands || 20)}
                    </label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={config?.maxHands === 20 ? 'default' : 'outline'}
                        onClick={() => updateConfig({ maxHands: 20 })}
                      >
                        20
                      </Button>
                      <Button
                        size="sm"
                        variant={config?.maxHands === 50 ? 'default' : 'outline'}
                        onClick={() => updateConfig({ maxHands: 50 })}
                      >
                        50
                      </Button>
                      <Button
                        size="sm"
                        variant={config?.maxHands === 100 ? 'default' : 'outline'}
                        onClick={() => updateConfig({ maxHands: 100 })}
                      >
                        100
                      </Button>
                      <Button
                        size="sm"
                        variant={config?.maxHands === -1 ? 'default' : 'outline'}
                        onClick={() => updateConfig({ maxHands: -1 })}
                      >
                        Infinite
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* AI Model Configuration */}
              <div className="mt-6">
                <label className="text-sm font-medium mb-3 block">AI Model Configuration</label>
                <div className="space-y-3">
                  {playerConfigs.map((player, index) => (
                    <div key={player.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                      <img 
                        src={player.avatar} 
                        alt={player.name}
                        className="w-10 h-10 rounded-full"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{player.name}</div>
                        <div className="text-xs text-muted-foreground">Position {index + 1}</div>
                      </div>
                      <Select
                        value={player.aiModel}
                        onValueChange={(value) => updatePlayerModel(player.id, value as PlayerConfig['aiModel'])}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select AI Model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deepseek-chat">
                            <div className="flex items-center gap-2">
                              <Zap className="h-4 w-4 text-blue-500" />
                              Deepseek Chat
                            </div>
                          </SelectItem>
                          <SelectItem value="gpt-4o">
                            <div className="flex items-center gap-2">
                              <Brain className="h-4 w-4 text-green-500" />
                              GPT-4o
                            </div>
                          </SelectItem>
                          <SelectItem value="claude-3-5-sonnet">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-purple-500" />
                              Claude 3.5 Sonnet
                            </div>
                          </SelectItem>
                          <SelectItem value="claude-3-opus">
                            <div className="flex items-center gap-2">
                              <Trophy className="h-4 w-4 text-yellow-500" />
                              Claude 3 Opus
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mt-6 flex justify-center">
                <Button
                  size="lg"
                  onClick={() => {
                    // Update config with player configurations before starting
                    updateConfig({ playerConfigs });
                    startGame();
                  }}
                  className="flex items-center gap-2"
                >
                  <Play className="h-5 w-5" />
                  Start Game
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Game Finished State */}
        {currentGameState === 'finished' && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-500" />
                Game Complete!
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-lg mb-4">
                {getCurrentHandNumber()} hands played
              </p>
              <Button size="lg" onClick={clearGame}>
                Start New Game
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Main Game Area */}
        {(currentGameState === 'playing' || currentGameState === 'paused' || currentGameState === 'finished') && (
        <div className="space-y-6 mb-8">
          {/* Poker Table - Full Width */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-xl">
                  <Play className="mr-2 h-5 w-5 text-destructive" />
                  AI Battle Arena
                </CardTitle>
                <div className="flex items-center gap-4">
                  {/* Toggle Buttons */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAIThinking(!showAIThinking)}
                    className="flex items-center gap-1"
                  >
                    <Brain className="h-4 w-4" />
                    AI Thinking
                    {showAIThinking ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowDecisionHistory(!showDecisionHistory)}
                    className="flex items-center gap-1"
                  >
                    <History className="h-4 w-4" />
                    History
                    {showDecisionHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAIEvaluation(!showAIEvaluation)}
                    className="flex items-center gap-1"
                  >
                    <Activity className="h-4 w-4" />
                    Evaluation
                    {showAIEvaluation ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                  <Badge variant="destructive" className="animate-pulse">
                    LIVE
                  </Badge>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Eye className="h-4 w-4 mr-1" />
                    {tournament?.viewers || 0}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isInitialized && (
                <PokerTable
                  players={gameState.players}
                  communityCards={gameState.communityCards}
                  pot={gameState.pot}
                  currentBet={gameState.currentBet}
                  phase={gameState.phase}
                  currentPlayer={gameState.currentPlayer}
                  winners={gameState.winners}
                  isHandComplete={gameState.isHandComplete}
                  currentAIThinking={gameState.currentAIThinking}
                  aiDecisionHistory={gameState.aiDecisionHistory}
                  onStartNewHand={startNewHand}
                  viewers={tournament?.viewers || 0}
                  getPlayerPoints={getPlayerPoints}
                />
              )}
            </CardContent>
            </Card>


          {/* Decision History - Below AI Thinking Panel */}
          {(config?.showDecisionHistory ?? true) && showDecisionHistory && (
            <DecisionHistory
              history={getDecisionHistory()}
              currentHandNumber={getCurrentHandNumber()}
            />
          )}
          
          {/* AI Evaluation Panel - Below Decision History */}
          {showAIEvaluation && (
            <AIEvaluationPanel
              evaluations={evaluations}
              currentHandNumber={getCurrentHandNumber()}
            />
          )}
        </div>
        )}

      </div>
    </div>
  );
};

export default TournamentView;