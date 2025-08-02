import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { GET_MATCH } from '@/graphql/queries/bot';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { PokerTable } from '@/components/game/poker/PokerTable';
import React, { useState, useEffect, useRef } from 'react';
import { useServerSidePoker } from '@/hooks/useServerSidePoker';
import { DecisionHistory } from '@/components/DecisionHistory';
import { StyleBonusNotification } from '@/components/StyleBonusNotification';
import { HandMisreadAlert } from '@/components/HandMisreadAlert';
import { PointNotification } from '@/components/PointNotification';
import { AchievementNotification } from '@/components/AchievementNotification';
import { CombinedLeaderboard } from '@/components/CombinedLeaderboard';
import { GameHeader } from '@/components/game/GameHeader';
import { IPlayerConfig as PlayerConfig } from '@/game-engine/core/interfaces';
import type { PokerAction } from '@/game-engine/games/poker';
import botGambler from '@/assets/bot-gambler.png';
import botTerminator from '@/assets/bot-terminator.png';
import botZenMaster from '@/assets/bot-zen-master.png';
import { LootboxAnimation } from '@/components/lootbox/LootboxAnimation';
import { useLootbox } from '@/components/lootbox/hooks/useLootbox';

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
  
  // Mock tournament-specific functions not in server-side hook
  const setTournamentMode = (mode: any) => setSelectedTournamentMode(mode);
  const getPlayerAchievements = () => [];
  const getAchievementProgress = () => ({ unlocked: 0, total: 0, percentage: 0 });
  const getAllAchievements = () => [];
  const getTotalAchievementPoints = () => 0;
  
  // Check for game winner (only one player with chips)
  const gameWinner = gameState.players.filter(p => p.chips > 0).length === 1 
    ? gameState.players.find(p => p.chips > 0)
    : null;
  
  // Lootbox integration
  const { isOpen, openLootbox, closeLootbox, generateReward } = useLootbox({
    winnerId: gameWinner?.id || '',
    gameType: 'poker',
    onRewardReceived: (reward) => {
      console.log('Poker winner received lootbox reward:', reward);
    }
  });
  
  // Show lootbox when game has a winner
  useEffect(() => {
    if (gameWinner && !isOpen) {
      // Delay slightly to let the final hand complete animation finish
      setTimeout(() => {
        openLootbox();
      }, 2000);
    }
  }, [gameWinner?.id]);

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
      <GameHeader
        tournamentName={tournament.name}
        matchId={tournament.id}
        totalPrize={tournament.totalPrize}
        playerCount={tournament.participants}
        viewerCount={tournament.viewers}
        currentRound={tournament.currentRound}
        gameType="poker"
        status={tournament.status as 'waiting' | 'in-progress' | 'completed'}
        onBack={() => navigate('/tournaments')}
      />

      {/* Main Content */}
      <div className="container mx-auto p-4">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Poker Table - Main Area */}
          <div className="xl:col-span-2">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
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
                  viewers={tournament.viewers}
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
              currentHandNumber={getCurrentHandNumber()}
              mode={'BALANCED'}
              startingChips={10000}
            />
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">

            {/* Decision History - Always visible */}
            <DecisionHistory
              history={getDecisionHistory()}
              currentHandNumber={getCurrentHandNumber()}
            />
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
      
      {/* Lootbox Animation */}
      {gameWinner && (
        <LootboxAnimation
          isOpen={isOpen}
          onClose={closeLootbox}
          onOpen={generateReward}
          gameType="poker"
          winnerId={gameWinner.id}
          winnerName={gameWinner.name}
        />
      )}
    </div>
  );
};

export default PokerView;