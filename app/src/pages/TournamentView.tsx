import { useParams } from 'react-router-dom';
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
import { PlayerConfig } from '@/poker/game/poker-game-manager';
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
  const [tournament, setTournament] = useState<{
    id: string;
    name: string;
    status: string;
    totalPrize: number;
    participants: number;
    currentRound: string;
    viewers: number;
  } | null>(null);
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
  } = usePokerGame();

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
          position: i,
          aiModel: defaultModel
        });
      } else {
        const avatarIndex = i % botProfiles.length;
        const nameIndex = (i - botProfiles.length) % additionalNames.length;
        configs.push({
          id: `bot-${i}`,
          name: additionalNames[nameIndex],
          avatar: botProfiles[avatarIndex].avatar,
          position: i,
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
    // Mock tournament data
    setTournament({
      id,
      name: 'AI Battle Championship',
      status: 'live',
      totalPrize: 0, // Hidden crypto elements
      participants: config?.playerCount || 3,
      currentRound: 'Exhibition Match',
      viewers: Math.floor(Math.random() * 1000) + 500
    });
  }, [id, config]);

  // Sync local state with config
  useEffect(() => {
    if (config) {
      setShowAIThinking(config.showAIThinking);
      setShowDecisionHistory(config.showDecisionHistory);
    }
  }, [config]);
  
  // Initialize player configs when player count changes
  useEffect(() => {
    if (config?.playerCount) {
      setPlayerConfigs(prev => {
        // Only regenerate if the count actually changed or we have no configs
        if (prev.length !== config.playerCount || prev.length === 0) {
          // If we have existing configs and the count increased, preserve existing selections
          if (prev.length > 0 && prev.length < config.playerCount) {
            const newConfigs = [...prev];
            const additionalCount = config.playerCount - prev.length;
            const additionalConfigs = generateDefaultPlayerConfigs(config.playerCount).slice(-additionalCount);
            return [...newConfigs, ...additionalConfigs];
          }
          // If count decreased, keep the first N configs
          if (prev.length > config.playerCount) {
            return prev.slice(0, config.playerCount);
          }
          // Otherwise generate new configs
          return generateDefaultPlayerConfigs(config.playerCount);
        }
        // Keep existing configs if count hasn't changed
        return prev;
      });
    }
  }, [config?.playerCount]);

  // Handle thinking timer
  useEffect(() => {
    if (gameState.currentAIThinking) {
      setThinkingTimeLeft(60);
      
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
      }
      
      thinkingTimerRef.current = setInterval(() => {
        setThinkingTimeLeft(prev => {
          if (prev <= 1) {
            if (thinkingTimerRef.current) {
              clearInterval(thinkingTimerRef.current);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
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
  }, [gameState.currentAIThinking]);

  // Cleanup on unmount to prevent orphaned games
  useEffect(() => {
    return () => {
      // Stop the game when leaving the page
      if (currentGameState === 'playing') {
        stopGame();
      }
    };
  }, [currentGameState, stopGame]);

  if (!tournament) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
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
                                if (playerPoints && playerPoints.totalPoints > 0) {
                                  return (
                                    <div className="text-[10px] text-purple-400 font-medium">
                                      {playerPoints.totalPoints} pts
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
                                 aiDecision.action.type === 'raise' ? `Raise $${aiDecision.action.amount}` :
                                 aiDecision.action.type === 'bet' ? `Bet $${aiDecision.action.amount}` :
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
                            {aiDecision.details?.personality || 'AI Analysis'}
                          </div>
                        </div>
                        <div className="overflow-y-auto max-h-80 px-4 py-3 space-y-3">
                          {/* Action Taken */}
                          <div className="font-medium text-sm">
                            Action: {aiDecision.action.type.toUpperCase()}
                            {aiDecision.action.amount && ` $${aiDecision.action.amount}`}
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
                          {aiDecision.details && (
                            <>
                              <div className="border-t pt-3 space-y-2">
                                <div className="text-sm font-medium">Detailed Analysis:</div>
                                
                                {/* Hand Evaluation */}
                                {aiDecision.details.cardEvaluation && (
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Hand: </span>
                                    {aiDecision.details.cardEvaluation}
                                  </div>
                                )}
                                
                                {/* Mathematical Breakdown */}
                                {aiDecision.details.mathBreakdown && (
                                  <div className="text-sm whitespace-pre-wrap">
                                    <span className="text-muted-foreground">Math: </span>
                                    {aiDecision.details.mathBreakdown}
                                  </div>
                                )}
                                
                                {/* Bluffing Status */}
                                {aiDecision.details.isBluffing !== undefined && (
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Bluffing: </span>
                                    <span className={aiDecision.details.isBluffing ? 'text-orange-500' : 'text-green-500'}>
                                      {aiDecision.details.isBluffing ? 'Yes - Attempting to deceive' : 'No - Playing honestly'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                          
                          {/* Model Info */}
                          <div className="border-t pt-3 text-xs text-muted-foreground">
                            {aiDecision.details?.modelUsed ? `Powered by ${aiDecision.details.modelUsed}` : 'Using fallback logic'}
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