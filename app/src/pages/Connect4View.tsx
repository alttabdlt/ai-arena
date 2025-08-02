import * as React from 'react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Connect4Board } from '@/components/game/connect4/Connect4Board';
import { Connect4Status } from '@/components/game/connect4/Connect4Status';
import { Connect4DecisionHistory } from '@/components/game/connect4/Connect4DecisionHistory';
import { useServerSideConnect4 } from '@/hooks/useServerSideConnect4';
import { GET_MATCH } from '@/graphql/queries/bot';
import { Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Connect4TournamentManager } from '@/components/game/connect4/Connect4TournamentManager';
import { GameHeader } from '@/components/game/GameHeader';
import { LootboxAnimation } from '@/components/lootbox/LootboxAnimation';
import { useLootbox } from '@/components/lootbox/hooks/useLootbox';

export default function Connect4View() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showTournamentView, setShowTournamentView] = useState(true);
  
  // Load match data from GraphQL
  const { data: matchData, loading: matchLoading, error: matchError } = useQuery(GET_MATCH, {
    variables: { id },
    skip: !id,
    onCompleted: (data) => {
      console.log('🎮 Connect4 match data loaded:', {
        matchId: id,
        hasMatch: !!data?.match,
        matchStatus: data?.match?.status,
        gameType: data?.match?.gameHistory?.gameType
      });
      
      // Check if this is the correct game type
      const gameHistory = data?.match?.gameHistory;
      const gameType = gameHistory?.gameType;
      
      console.log('🎮 Connect4View game type detection:', {
        matchId: id,
        hasGameHistory: !!gameHistory,
        gameType: gameType,
        rawGameHistory: gameHistory
      });
      
      // If gameHistory exists but gameType is not connect4, redirect
      if (gameHistory && (!gameType || gameType !== 'connect4')) {
        console.log(`Wrong or missing game type: ${gameType}, redirecting to poker...`);
        navigate(`/tournament/${id}`);
        return;
      }
      
      // If gameType is specified and not connect4, redirect to correct view
      if (gameType && gameType !== 'connect4') {
        console.log(`Wrong game type: ${gameType}, redirecting...`);
        if (gameType === 'poker') {
          navigate(`/tournament/${id}`);
        } else if (gameType === 'reverse-hangman') {
          navigate(`/tournament/${id}/hangman-server`);
        }
      }
    },
    onError: (error) => {
      console.error('❌ Connect4 match query error:', error);
    }
  });

  // Check if this is actually a Connect4 game
  // Only consider it a Connect4 game if explicitly marked as such or no gameHistory exists yet
  const gameHistory = matchData?.match?.gameHistory;
  const gameType = gameHistory?.gameType;
  const isConnect4Game = gameType === 'connect4' || (!gameHistory && matchData?.match);

  // Use server-side Connect4 hook
  const {
    gameState,
    isAIThinking,
    currentPlayer,
    makeMove,
    winner,
    isDraw,
    isGameComplete,
    stats,
    decisionHistory,
    isInitialized
  } = useServerSideConnect4({ 
    gameId: isConnect4Game ? (id || '') : '', 
    tournament: isConnect4Game ? matchData?.match : null
  });
  
  // Debug logging - minimal
  useEffect(() => {
    if (decisionHistory.length > 0) {
      console.log(`Connect4: ${decisionHistory.length} AI decisions recorded`);
    }
  }, [decisionHistory]);
  
  // Lootbox integration
  const { isOpen, openLootbox, closeLootbox, generateReward } = useLootbox({
    winnerId: winner?.id || '',
    gameType: 'connect4',
    onRewardReceived: (reward) => {
      console.log('Connect4 winner received lootbox reward:', reward);
    }
  });
  
  // Show lootbox when game has a winner
  useEffect(() => {
    if (winner && isGameComplete && !isOpen) {
      // Delay slightly to let the winning animation finish
      setTimeout(() => {
        openLootbox();
      }, 2000);
    }
  }, [winner?.id, isGameComplete]);
  
  // Show loading state
  if (matchLoading) {
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
          
          <Card className="p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Loading Match...</h2>
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Show error state
  if (matchError || !matchData?.match) {
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
          
          <Card className="p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4 text-destructive">Error Loading Match</h2>
              <p className="text-muted-foreground mb-6">{matchError?.message || 'Match not found'}</p>
              <Button onClick={() => navigate('/tournaments')}>
                Return to Tournaments
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const match = matchData.match;

  // Main game view
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <GameHeader
          tournamentName={match.tournament?.name || `Match ${match.id.slice(0, 8)}`}
          matchId={match.id}
          totalPrize={1000000}
          playerCount={match.participants.length}
          viewerCount={Math.floor(Math.random() * 500) + 100}
          currentRound={gameHistory?.round === 'semifinal' ? 'Semifinal' : gameHistory?.round === 'final' ? 'Final' : 'Round 1'}
          gameType="connect4"
          status={match.status === 'SCHEDULED' ? 'waiting' : match.status === 'IN_PROGRESS' ? 'in-progress' : 'completed'}
          onBack={() => navigate('/tournaments')}
        />

        {/* Connect4 Tournament View */}
        <div className="space-y-6">
          {/* Tournament Info - Simple display for now */}
          {match.tournament && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Connect4 Tournament</h2>
                <Badge variant="outline">
                  {gameHistory?.round === 'semifinal' ? 'Semifinal' : 
                   gameHistory?.round === 'final' ? 'Final' : 'Match'}
                </Badge>
              </div>
              
              {/* Current Match Participants */}
              <div className="grid grid-cols-2 gap-4">
                {match.participants?.map((p: any, idx: number) => (
                  <div key={p.bot.id} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                    <div className={`w-4 h-4 rounded-full ${idx === 0 ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    <div className="flex-1">
                      <p className="font-medium">{p.bot.name}</p>
                      <p className="text-xs text-muted-foreground">{p.bot.modelType}</p>
                    </div>
                    {winner === p.bot.id && <Trophy className="h-4 w-4 text-primary" />}
                  </div>
                ))}
              </div>
            </Card>
          )}
          
          {/* Current Match View */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Game Board */}
            <div className="lg:col-span-2">
              {gameState && gameState.board ? (
                <Connect4Board
                  board={gameState.board}
                  onColumnClick={makeMove || (() => {})}
                  isAIThinking={isAIThinking || false}
                  disabled={isGameComplete}
                  winningCells={gameState.winningCells}
                />
              ) : (
                <Card className="p-8">
                  <div className="text-center">
                    <h3 className="text-xl font-semibold mb-2">Waiting for game to start...</h3>
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                  </div>
                </Card>
              )}
            </div>

            {/* Game Info */}
            <div className="space-y-4">
              {/* Current Match Info */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">
                  {gameHistory?.round === 'semifinal' ? 'Semifinal Match' : 
                   gameHistory?.round === 'final' ? 'Final Match' : 'Match'}
                </h3>
                <div className="space-y-2">
                  {match.participants.map((p: any, idx: number) => (
                    <div key={p.bot.id} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full ${idx === 0 ? 'bg-red-500' : 'bg-yellow-500'}`} />
                      <span className="text-sm">{p.bot.name}</span>
                      {winner === p.bot.id && <Trophy className="h-3 w-3 text-primary ml-auto" />}
                    </div>
                  ))}
                </div>
              </Card>

              {/* Game Status */}
              {gameState && (
                <Connect4Status
                  currentPlayer={currentPlayer}
                  isAIThinking={isAIThinking || false}
                  winner={winner ? {
                    id: winner,
                    name: matchData?.match?.participants?.find((p: any) => p.bot.id === winner)?.bot.name || 'Unknown',
                    color: matchData?.match?.participants?.findIndex((p: any) => p.bot.id === winner) === 0 ? 'red' : 'yellow',
                    isAI: true,
                    aiModel: matchData?.match?.participants?.find((p: any) => p.bot.id === winner)?.bot.modelType
                  } : null}
                  isDraw={isDraw || false}
                  players={gameState.players || []}
                />
              )}

              {/* Decision History */}
              <Connect4DecisionHistory
                decisions={decisionHistory || []}
                currentMoveNumber={gameState?.moveCount || 0}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Lootbox Animation */}
      {winner && (
        <LootboxAnimation
          isOpen={isOpen}
          onClose={closeLootbox}
          onOpen={generateReward}
          gameType="connect4"
          winnerId={winner.id}
          winnerName={winner.name}
        />
      )}
    </div>
  );
}
