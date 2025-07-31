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
import botGambler from '@/assets/bot-gambler.png';
import botTerminator from '@/assets/bot-terminator.png';
import botZenMaster from '@/assets/bot-zen-master.png';

const PokerView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Load match data from GraphQL
  const { data: matchData, loading: matchLoading, error: matchError } = useQuery(GET_MATCH, {
    variables: { id },
    skip: !id,
    onCompleted: (data) => {
      console.log('🎲 Poker match data loaded:', {
        matchId: id,
        hasMatch: !!data?.match,
        matchStatus: data?.match?.status,
        gameType: data?.match?.gameHistory?.gameType
      });
      
      // Check if this is the correct game type
      const gameHistory = data?.match?.gameHistory;
      const gameType = gameHistory?.gameType;
      
      // If gameType is specified and not poker, redirect to correct view
      if (gameType && gameType !== 'poker') {
        console.log(`Wrong game type: ${gameType}, redirecting...`);
        if (gameType === 'reverse-hangman') {
          navigate(`/tournament/${id}/hangman-server`);
        } else if (gameType === 'connect4') {
          navigate(`/tournament/${id}/connect4`);
        }
      }
    },
    onError: (error) => {
      console.error('❌ Poker match query error:', error);
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
  const [thinkingTimeLeft, setThinkingTimeLeft] = useState(60);
  const thinkingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showAIThinking, setShowAIThinking] = useState(true);
  const [showDecisionHistory, setShowDecisionHistory] = useState(true);
  const [showAIEvaluation, setShowAIEvaluation] = useState(true);
  const [playerConfigs, setPlayerConfigs] = useState<PlayerConfig[]>([]);
  const [selectedTournamentMode, setSelectedTournamentMode] = useState<'STYLE_MASTER' | 'BALANCED' | 'CLASSIC'>('BALANCED');
  
  // Use poker hook for poker games
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
    getPlayerPoints
  } = useServerSidePoker({ 
    gameId: id || '', 
    tournament: matchData?.match || null
  });
  
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
      
      // Transform match data to tournament format
      const tournamentData = {
        id: match.id,
        name: match.tournament?.name || `Poker Match ${match.id.slice(0, 8)}`,
        status: match.status === 'SCHEDULED' ? 'waiting' : match.status === 'IN_PROGRESS' ? 'in-progress' : 'completed',
        totalPrize: 1000000,
        participants: match.participants.length,
        currentRound: 'Round 1',
        viewers: Math.floor(Math.random() * 500) + 100,
        gameType: match.gameHistory?.gameType || 'poker',
        config: {
          startingChips: 100000,
          blindStructure: 'normal',
          maxHands: 20,
          mode: 'balanced'
        },
        players: match.participants.map((participant: any) => ({
          id: participant.bot.id,
          name: participant.bot.name,
          aiModel: participant.bot.modelType,
          strategy: participant.bot.prompt,
          chips: 100000,
          status: 'playing',
          isReady: true,
          avatar: participant.bot.avatar || botGambler,
          seat: participant.position
        }))
      };
      
      setTournament(tournamentData);
      setIsLoading(false);
      
      // Initialize player configs with AI models from match data
      const configs = match.participants.map((participant: any) => ({
        id: participant.bot.id,
        name: participant.bot.name,
        aiModel: participant.bot.modelType as PlayerConfig['aiModel'],
        avatar: participant.bot.avatar || botGambler
      }));
      setPlayerConfigs(configs);
    }
  }, [matchData]);

  // Update thinking timer
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

  // Show loading state
  if (matchLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Card className="p-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-center text-muted-foreground">Loading poker match...</p>
        </Card>
      </div>
    );
  }

  // Show error state
  if (matchError || loadingError || !tournament) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <h2 className="text-xl font-bold mb-4 text-destructive">Error Loading Match</h2>
          <p className="text-muted-foreground mb-4">
            {matchError?.message || loadingError || 'Failed to load match data'}
          </p>
          <Button onClick={() => navigate('/tournaments')}>
            Back to Tournaments
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/tournaments')}
              className="text-gray-400 hover:text-white"
            >
              ← Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {tournament.name}
                <Badge className="bg-green-900 text-green-100">Live</Badge>
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                <span className="flex items-center gap-1">
                  <Trophy className="h-4 w-4" />
                  ${tournament.totalPrize.toLocaleString()} Prize Pool
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {tournament.participants} Players
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {tournament.viewers} Viewers
                </span>
                <span className="flex items-center gap-1">
                  <Activity className="h-4 w-4" />
                  {tournament.currentRound}
                </span>
              </div>
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={showAIThinking ? () => setShowAIThinking(false) : () => setShowAIThinking(true)}
                    className={showAIThinking ? "bg-blue-900 text-blue-100" : ""}
                  >
                    <Brain className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {showAIThinking ? "Hide AI Thinking" : "Show AI Thinking"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={showDecisionHistory ? () => setShowDecisionHistory(false) : () => setShowDecisionHistory(true)}
                    className={showDecisionHistory ? "bg-blue-900 text-blue-100" : ""}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {showDecisionHistory ? "Hide Decision History" : "Show Decision History"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={showAIEvaluation ? () => setShowAIEvaluation(false) : () => setShowAIEvaluation(true)}
                    className={showAIEvaluation ? "bg-blue-900 text-blue-100" : ""}
                  >
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {showAIEvaluation ? "Hide AI Evaluation" : "Show AI Evaluation"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Select value={gameSpeed} onValueChange={(value: any) => changeSpeed(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="slow">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    Slow
                  </div>
                </SelectItem>
                <SelectItem value="normal">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Normal
                  </div>
                </SelectItem>
                <SelectItem value="fast">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    Fast
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={isPaused ? resumeGame : pauseGame}
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Poker Table - Main Area */}
          <div className="lg:col-span-3">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <PokerTable
                  players={gameState.players}
                  communityCards={gameState.communityCards}
                  pot={gameState.pot}
                  currentBet={gameState.currentBet}
                  phase={gameState.phase}
                  currentPlayer={gameState.players.find(p => p.id === gameState.currentTurn) || null}
                  winners={gameState.winners}
                  isHandComplete={gameState.isHandComplete}
                  currentAIThinking={currentThinking?.playerId || null}
                  aiDecisionHistory={new Map()}
                  onStartNewHand={() => {}}
                  viewers={0}
                  getPlayerPoints={getPlayerPoints}
                />
              </CardContent>
            </Card>

            {/* Combined Leaderboard Below Table */}
            <CombinedLeaderboard
              players={new Map(gameState.players.map(p => [p.id, {
                id: p.id,
                name: p.name,
                avatar: p.avatar || ''
              }]))}
              getPointLeaderboard={getPointLeaderboard}
              currentChips={new Map(gameState.players.map(p => [p.id, p.chips]))}
              currentHandNumber={gameState.handNumber}
              mode={'BALANCED'}
              startingChips={10000}
            />
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            {/* AI Thinking Panel */}
            {showAIThinking && gameState.currentAIThinking && (
              <AIThinkingPanel
                currentThinking={{
                  playerId: gameState.currentAIThinking,
                  playerName: gameState.players.find(p => p.id === gameState.currentAIThinking)?.name || 'Unknown',
                  decision: null
                }}
                recentDecisions={[]}
                thinkingTimeLeft={thinkingTimeLeft}
                maxThinkingTime={30}
              />
            )}

            {/* Decision History */}
            {showDecisionHistory && (
              <DecisionHistory
                history={getDecisionHistory()}
                currentHandNumber={getCurrentHandNumber()}
              />
            )}

            {/* AI Evaluation Panel */}
            {showAIEvaluation && (
              <AIEvaluationPanel
                evaluations={evaluations}
                currentHandNumber={gameState.handNumber}
              />
            )}
          </div>
        </div>
      </div>

      {/* Notifications */}
      <StyleBonusNotification bonuses={gameState.recentStyleBonuses} />
      {gameState.recentMisreads && gameState.recentMisreads.map((misread, index) => (
        <HandMisreadAlert key={index} misread={misread} />
      ))}
      <PointNotification events={gameState.recentPointEvents} />
      <AchievementNotification 
        events={gameState.recentAchievementEvents || []}
        players={new Map(gameState.players.map(p => [p.id, { name: p.name, avatar: p.avatar || '' }]))}
      />
    </div>
  );
};

export default PokerView;