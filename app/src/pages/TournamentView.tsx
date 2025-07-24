import { useParams, useNavigate } from 'react-router-dom';
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
import { Eye, Users, Trophy, Activity, Play, Pause, Zap, Timer, Brain, History, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { usePokerGame } from '@/hooks/usePokerGame';
import { AIThinkingPanel } from '@/components/AIThinkingPanel';
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
import { 
  formatChips, 
  getCardColor, 
  getCardDisplayValue, 
  getPlayerPosition,
  getPhaseDisplayName,
  getActionDisplayText,
  shouldShowCard,
  getPlayerStatusColor
} from '@/poker/engine/poker-helpers';
import botGambler from '@/assets/bot-gambler.png';
import botTerminator from '@/assets/bot-terminator.png';
import botZenMaster from '@/assets/bot-zen-master.png';


const TournamentView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
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
  const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null);
  const [thinkingTimeLeft, setThinkingTimeLeft] = useState(60);
  const thinkingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showAIThinking, setShowAIThinking] = useState(true);
  const [showDecisionHistory, setShowDecisionHistory] = useState(true);
  const [showAIEvaluation, setShowAIEvaluation] = useState(true);
  const [playerConfigs, setPlayerConfigs] = useState<PlayerConfig[]>([]);
  const [selectedTournamentMode, setSelectedTournamentMode] = useState<'STYLE_MASTER' | 'BALANCED' | 'CLASSIC'>('BALANCED');
  
  // Fetch AI evaluation data
  const { evaluations } = useModelEvaluations();
  
  const { 
    gameState, 
    isInitialized, 
    isPaused, 
    gameSpeed,
    config,
    currentGameState,
    startNewHand, 
    pauseGame, 
    resumeGame, 
    changeSpeed,
    getDecisionHistory,
    getCurrentHandDecisions,
    getCurrentHandNumber,
    updateConfig,
    startGame,
    stopGame,
    clearGame,
    getStyleLeaderboard,
    getPlayerStyleStats,
    getAllStyleStats,
    getPointLeaderboard,
    getPlayerPoints,
    setTournamentMode,
    getPlayerAchievements,
    getAchievementProgress,
    getAllAchievements,
    getTotalAchievementPoints
  } = usePokerGame(tournament);

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

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const loadTournament = async () => {
      try {
        // Set a timeout for loading
        timeoutId = setTimeout(() => {
          setLoadingError('Tournament loading timed out. The tournament data may be missing.');
          setIsLoading(false);
        }, 5000);

        // Load tournament from sessionStorage
        const tournamentData = sessionStorage.getItem(`tournament-${id}`);
        
        if (!tournamentData) {
          // In development, create a demo tournament if needed
          if (import.meta.env.DEV) {
            console.warn('Tournament not found in sessionStorage, creating demo tournament');
            const demoTournament = {
              id: id!,
              name: 'Demo Poker Tournament',
              status: 'in-progress',
              gameType: 'poker',
              config: {
                startingChips: 10000,
                blindStructure: 'standard',
                maxHands: 100,
                speed: 'normal'
              },
              players: generateDefaultPlayerConfigs(3).map((config, idx) => ({
                id: config.id,
                name: config.name,
                aiModel: config.aiModel,
                strategy: 'Aggressive poker player focused on maximizing value',
                status: 'playing',
                isReady: true,
                joinedAt: new Date(),
                avatar: config.avatar
              })),
              totalPrize: 0,
              participants: 3,
              currentRound: 'Exhibition Match',
              viewers: Math.floor(Math.random() * 1000) + 500,
              maxPlayers: 8,
              minPlayers: 2,
              isPublic: true,
              createdBy: 'demo',
              createdAt: new Date()
            };
            sessionStorage.setItem(`tournament-${id}`, JSON.stringify(demoTournament));
            setTournament(demoTournament);
            clearTimeout(timeoutId);
            setIsLoading(false);
            return;
          }
          
          setLoadingError('Tournament not found. It may have been removed or expired.');
          clearTimeout(timeoutId);
          setIsLoading(false);
          return;
        }

        const loadedTournament = JSON.parse(tournamentData);
        if (loadedTournament.gameType !== 'poker') {
          setLoadingError(`This tournament is for ${loadedTournament.gameType}, not poker.`);
          clearTimeout(timeoutId);
          setIsLoading(false);
          
          // Redirect to correct game view after a short delay
          setTimeout(() => {
            if (loadedTournament.gameType === 'reverse-hangman') {
              navigate(`/tournament/${id}/hangman`);
            } else {
              navigate('/tournaments');
            }
          }, 2000);
          return;
        }

        // Set default values for display
        loadedTournament.totalPrize = loadedTournament.totalPrize || 0;
        loadedTournament.participants = loadedTournament.players?.length || loadedTournament.participants || 0;
        loadedTournament.currentRound = loadedTournament.currentRound || 'Exhibition Match';
        loadedTournament.viewers = loadedTournament.viewers || Math.floor(Math.random() * 1000) + 500;

        setTournament(loadedTournament);
        clearTimeout(timeoutId);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading tournament:', error);
        setLoadingError('Failed to load tournament data.');
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    };

    loadTournament();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [id, navigate]);

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

  // Handle thinking timer
  useEffect(() => {
    if (gameState.currentAIThinking) {
      // Set initial time based on speed setting
      const initialTime = config?.speed === 'thinking' ? 2 : 
                        config?.speed === 'fast' ? 0.5 : 
                        1; // normal
      setThinkingTimeLeft(initialTime);
      
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
      }
      
      // For fast mode, use smaller intervals
      const interval = config?.speed === 'fast' ? 50 : 100; // 50ms for fast, 100ms otherwise
      
      thinkingTimerRef.current = setInterval(() => {
        setThinkingTimeLeft(prev => {
          const decrement = interval / 1000; // Convert to seconds
          if (prev <= decrement) {
            if (thinkingTimerRef.current) {
              clearInterval(thinkingTimerRef.current);
            }
            return 0;
          }
          return prev - decrement;
        });
      }, interval);
    } else {
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
      }
    }
    
    return () => {
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
      }
    };
  }, [gameState.currentAIThinking, config?.speed]);

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
              <p className="text-muted-foreground mb-4">{loadingError || 'Tournament not found'}</p>
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
    return null;
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
        players={new Map(gameState.players.map(p => [p.id, { name: p.name, avatar: p.avatar }]))}
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
          players={new Map(gameState.players.map(p => [p.id, { id: p.id, name: p.name, avatar: p.avatar }]))}
          getPointLeaderboard={getPointLeaderboard}
          currentChips={new Map(gameState.players.map(p => [p.id, p.chips]))}
          currentHandNumber={getCurrentHandNumber()}
          mode={selectedTournamentMode}
          startingChips={config?.startingChips || 10000}
        />

        {/* Game Setup Phase */}
        {currentGameState === 'setup' && isInitialized && (
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
              <div className="poker-table-container relative bg-gradient-to-br from-green-800 to-green-900 rounded-xl p-4 min-h-[600px] overflow-hidden">
                {/* Poker Table Felt */}
                <div className="absolute inset-8 bg-green-700 rounded-full opacity-90 shadow-inner"></div>
                
                {/* Community Cards */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
                  <div className="text-center mb-4">
                    <div className="text-white text-lg font-bold mb-2">
                      Pot: {formatChips(gameState.pot)} chips
                    </div>
                    <div className="flex gap-2 justify-center">
                      {[0, 1, 2, 3, 4].map((index) => {
                        const card = gameState.communityCards[index];
                        const showCard = shouldShowCard(index, gameState.phase, gameState.communityCards.length);
                        
                        if (showCard && card) {
                          const { rank, suit } = getCardDisplayValue(card);
                          const color = getCardColor(card);
                          return (
                            <div
                              key={index}
                              className="w-12 h-16 bg-white rounded border-2 border-gray-300 flex items-center justify-center font-bold shadow-lg transition-all duration-500"
                            >
                              <span className={`text-lg ${color === 'red' ? 'text-red-600' : 'text-black'}`}>
                                {rank}{suit}
                              </span>
                            </div>
                          );
                        }
                        
                        return (
                          <div
                            key={index}
                            className="w-12 h-16 bg-blue-800 rounded border-2 border-blue-600 shadow-lg opacity-50"
                          />
                        );
                      })}
                    </div>
                    <div className="text-green-200 text-sm mt-2">
                      {getPhaseDisplayName(gameState.phase)}
                    </div>
                    {gameState.currentBet > 0 && (
                      <div className="text-yellow-300 text-sm mt-1">
                        Current Bet: {formatChips(gameState.currentBet)} chips
                      </div>
                    )}
                  </div>
                </div>

                {/* Players */}
                {gameState.players.map((player, index) => {
                  const isCurrentPlayer = gameState.currentPlayer?.id === player.id;
                  const hasWon = gameState.winners.some(w => w.playerId === player.id);
                  const isThinking = gameState.currentAIThinking === player.id;
                  const position = getPlayerPosition(index, gameState.players.length);
                  
                  const aiDecision = gameState.aiDecisionHistory?.get(player.id);
                  
                  return (
                    <TooltipProvider key={player.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`absolute ${position} z-20`}
                            onMouseEnter={() => setHoveredPlayerId(player.id)}
                            onMouseLeave={() => setHoveredPlayerId(null)}
                          >
                      <Card className={`${
                        gameState.players.length > 6 ? 'w-28' : 
                        gameState.players.length > 4 ? 'w-32' : 'w-36'
                      } transition-all duration-300 ${
                        getPlayerStatusColor(isCurrentPlayer, player.folded, player.allIn, hasWon)
                      }`}>
                        <CardContent className="p-2">
                          {/* Compact header with avatar and name */}
                          <div className="flex items-center gap-2 mb-1">
                            <img 
                              src={player.avatar} 
                              alt={player.name}
                              className="w-8 h-8 rounded-full"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-xs truncate">{player.name}</div>
                              <div className="text-xs text-muted-foreground">
                                ${formatChips(player.chips)}
                              </div>
                              {(() => {
                                const playerPoints = getPlayerPoints(player.id);
                                if (playerPoints && playerPoints.total > 0) {
                                  return (
                                    <div className="text-[10px] text-purple-400 font-medium">
                                      {playerPoints.total} pts
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                            {isThinking && (
                              <Zap className="h-3 w-3 text-yellow-400 animate-pulse flex-shrink-0" />
                            )}
                          </div>
                          
                          {/* Compact Cards */}
                          <div className="flex gap-0.5 mb-1 justify-center">
                            {player.cards.length > 0 && player.cards.map((card, cardIndex) => {
                              const showCard = gameState.phase === 'showdown' || !player.isAI || hoveredPlayerId === player.id;
                              if (showCard) {
                                const { rank, suit } = getCardDisplayValue(card);
                                const color = getCardColor(card);
                                return (
                                  <div
                                    key={cardIndex}
                                    className="w-6 h-8 bg-white rounded border flex items-center justify-center text-[10px] font-bold shadow-sm"
                                  >
                                    <span className={color === 'red' ? 'text-red-600' : 'text-black'}>
                                      {rank}{suit}
                                    </span>
                                  </div>
                                );
                              }
                              return (
                                <div
                                  key={cardIndex}
                                  className="w-6 h-8 bg-blue-800 rounded border border-blue-600 shadow-sm"
                                />
                              );
                            })}
                          </div>
                          
                          {/* Action display */}
                          <div className="text-center">
                            {player.folded ? (
                              <span className="text-xs text-muted-foreground">Folded</span>
                            ) : player.allIn ? (
                              <span className="text-xs text-red-400 font-semibold">All-In</span>
                            ) : aiDecision ? (
                              <span className="text-xs font-medium">
                                {aiDecision.action.type === 'check' ? 'Check' :
                                 aiDecision.action.type === 'call' ? 'Call' :
                                 aiDecision.action.type === 'raise' ? `Raise $${(aiDecision.action as PokerAction).amount}` :
                                 aiDecision.action.type === 'bet' ? `Bet $${(aiDecision.action as PokerAction).amount}` :
                                 aiDecision.action.type === 'all-in' ? 'All-In' :
                                 aiDecision.action.type}
                              </span>
                            ) : player.bet > 0 ? (
                              <span className="text-xs text-yellow-400">Bet ${formatChips(player.bet)}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Waiting</span>
                            )}
                          </div>
                          
                          {/* Winner display */}
                          {hasWon && (
                            <div className="mt-1 text-[10px] text-yellow-400 font-bold text-center">
                              Won ${formatChips(gameState.winners.find(w => w.playerId === player.id)?.amount || 0)}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TooltipTrigger>
                  {player.isAI && aiDecision && (
                    <TooltipContent side="top" className="max-w-lg p-0 border-0">
                      <div className="bg-background/95 backdrop-blur border rounded-lg shadow-lg max-h-96 overflow-hidden">
                        <div className="sticky top-0 bg-background border-b px-4 py-3">
                          <div className="font-semibold text-lg">{player.name}'s Thinking</div>
                          <div className="text-xs text-muted-foreground">
                            {aiDecision.metadata?.personality || 'AI Analysis'}
                          </div>
                        </div>
                        <div className="overflow-y-auto max-h-80 px-4 py-3 space-y-3">
                          {/* Action Taken */}
                          <div className="font-medium text-sm">
                            Action: {aiDecision.action.type.toUpperCase()}
                            {(aiDecision.action as PokerAction).amount && ` $${(aiDecision.action as PokerAction).amount}`}
                          </div>
                          
                          {/* Main Reasoning */}
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Reasoning:</div>
                            <div className="text-sm whitespace-pre-wrap">{aiDecision.reasoning}</div>
                          </div>
                          
                          {/* Confidence Level */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Confidence:</span>
                            <div className="flex-1 bg-secondary rounded-full h-2">
                              <div 
                                className="bg-primary h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(aiDecision.confidence * 100).toFixed(0)}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{(aiDecision.confidence * 100).toFixed(0)}%</span>
                          </div>
                          
                          {/* Detailed Analysis if available */}
                          {aiDecision.metadata && (
                            <>
                              <div className="border-t pt-3 space-y-2">
                                <div className="text-sm font-medium">Detailed Analysis:</div>
                                
                                {/* Hand Evaluation */}
                                {aiDecision.metadata.cardEvaluation && (
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Hand: </span>
                                    {aiDecision.metadata.cardEvaluation}
                                  </div>
                                )}
                                
                                {/* Mathematical Breakdown */}
                                {aiDecision.metadata.mathBreakdown && (
                                  <div className="text-sm whitespace-pre-wrap">
                                    <span className="text-muted-foreground">Math: </span>
                                    {aiDecision.metadata.mathBreakdown}
                                  </div>
                                )}
                                
                                {/* Bluffing Status */}
                                {aiDecision.metadata.isBluffing !== undefined && (
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Bluffing: </span>
                                    <span className={aiDecision.metadata.isBluffing ? 'text-orange-500' : 'text-green-500'}>
                                      {aiDecision.metadata.isBluffing ? 'Yes - Attempting to deceive' : 'No - Playing honestly'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                          
                          {/* Model Info */}
                          <div className="border-t pt-3 text-xs text-muted-foreground">
                            {aiDecision.metadata?.modelUsed ? `Powered by ${aiDecision.metadata.modelUsed}` : 'Using fallback logic'}
                          </div>
                        </div>
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          })}

                {/* Game Info Overlay */}
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                  <div className="text-white">
                    <div className="text-sm opacity-75">
                      {gameState.phase !== 'waiting' ? getPhaseDisplayName(gameState.phase) : 'Ready to Start'}
                    </div>
                    {gameState.isHandComplete && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={startNewHand}
                        className="mt-2"
                      >
                        Start New Hand
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
              </CardContent>
            </Card>

          {/* AI Thinking Panel - Below Poker Table */}
          {(config?.showAIThinking ?? true) && showAIThinking && (
            <AIThinkingPanel
              currentThinking={
                gameState.currentAIThinking
                  ? {
                      playerId: gameState.currentAIThinking,
                      playerName: gameState.players.find(p => p.id === gameState.currentAIThinking)?.name || '',
                      decision: gameState.aiDecisionHistory?.get(gameState.currentAIThinking) || null,
                    }
                  : null
              }
              recentDecisions={getCurrentHandDecisions()}
              thinkingTimeLeft={thinkingTimeLeft}
              maxThinkingTime={
                config?.speed === 'thinking' ? 2 : 
                config?.speed === 'fast' ? 0.5 : 
                1
              }
            />
          )}

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