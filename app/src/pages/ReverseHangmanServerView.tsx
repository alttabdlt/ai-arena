import * as React from 'react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { GET_MATCH } from '@/graphql/queries/bot';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { ReverseHangmanBoard } from '@/components/game/reverse-hangman/ReverseHangmanBoard';
import { PromptGenerationAnimation } from '@/components/game/reverse-hangman/PromptGenerationAnimation';
import { useServerSideReverseHangman } from '@/hooks/useServerSideReverseHangman';
import { Tournament } from '@/types/tournament';
import { GameHeader } from '@/components/game/GameHeader';

export default function ReverseHangmanServerView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard' | 'expert'>('medium');

  // Use GraphQL to fetch match data
  const { data: matchData, loading: matchLoading, error: matchError } = useQuery(GET_MATCH, {
    variables: { id },
    skip: !id,
    onCompleted: (data) => {
      console.log('✅ Reverse Hangman match loaded:', {
        matchId: id,
        hasMatch: !!data?.match,
        matchStatus: data?.match?.status,
        gameType: data?.match?.gameHistory?.gameType
      });
      
      // Check game type and redirect if not reverse-hangman
      const gameType = data?.match?.gameHistory?.gameType;
      if (gameType && gameType !== 'reverse-hangman') {
        console.log(`Wrong game type: ${gameType}, redirecting...`);
        // Redirect to correct game view
        if (gameType === 'poker') {
          navigate(`/tournament/${id}`);
        } else if (gameType === 'connect4') {
          navigate(`/tournament/${id}/connect4`);
        }
      }
    },
    onError: (error) => {
      console.error('❌ Reverse Hangman match query error:', error);
    }
  });

  // Transform match data to tournament format
  useEffect(() => {
    if (matchData?.match) {
      const match = matchData.match;
      const gameHistory = match.gameHistory || {};
      const gameType = gameHistory.gameType || 'reverse-hangman';
      
      if (gameType !== 'reverse-hangman') {
        return; // Will redirect in onCompleted
      }
      
      // Transform match data to tournament format
      const tournamentData: Tournament = {
        id: match.id,
        name: match.tournament?.name || `Match ${match.id.slice(0, 8)}`,
        status: match.status === 'SCHEDULED' ? 'waiting' : match.status === 'IN_PROGRESS' ? 'in-progress' : 'completed',
        gameType: gameType,
        config: {
          maxRounds: 3,
          timeLimit: 30,
          difficulty: 'medium'
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
        currentRound: 'Round 1',
        viewers: Math.floor(Math.random() * 500) + 100,
        maxPlayers: 4,
        minPlayers: 4,
        isPublic: true,
        createdBy: 'system',
        createdAt: match.createdAt,
        startedAt: match.startedAt,
        completedAt: match.completedAt,
        tournamentType: 'SINGLE_ELIMINATION'
      };
      
      setTournament(tournamentData);
    }
  }, [matchData, navigate]);

  // Use server-side game execution
  const {
    gameState,
    isAIThinking,
    currentAgent,
    tournamentStats,
    showDifficultySelect,
    startRound,
    animationPhase,
    animationOutput,
    isActive,
    toggleGamePause
  } = useServerSideReverseHangman({ tournament });
  
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
  if (matchError || (!tournament && !matchLoading)) {
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
              <h2 className="text-xl font-semibold mb-4 text-destructive">
                {matchError ? 'Error Loading Tournament' : 'Tournament Not Found'}
              </h2>
              <p className="text-muted-foreground mb-6">
                {matchError ? matchError.message : 
                 'The tournament you are looking for does not exist or has been removed.'}
              </p>
              <Button onClick={() => navigate('/tournaments')}>
                Return to Tournaments
              </Button>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const handleStartRound = () => {
    startRound(selectedDifficulty);
  };

  // Show difficulty selection for first round
  if (showDifficultySelect && (!gameState || gameState.phase === 'waiting')) {
    return (
      <div className="min-h-screen bg-background">
        <GameHeader
          tournamentName={tournament?.name || `Match ${id?.slice(0, 8)}`}
          matchId={id || ''}
          totalPrize={1000000}
          playerCount={tournament?.players.length || 4}
          viewerCount={tournament?.viewers || Math.floor(Math.random() * 500) + 100}
          currentRound="Round 1"
          gameType="reverse-hangman"
          status={tournament?.status as 'waiting' | 'in-progress' | 'completed' || 'waiting'}
          onBack={() => navigate('/tournaments')}
        />
        <div className="container mx-auto px-4 py-8">
          
          <div className="max-w-4xl mx-auto">
            <Card className="p-8">
              <h1 className="text-3xl font-bold mb-6 text-center">Reverse Hangman: AI vs AI</h1>
              
              <div className="mb-8 text-center">
                <p className="text-lg text-muted-foreground mb-4">
                  Watch AI models compete to guess the prompts behind generated outputs!
                </p>
              </div>

              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4 text-center">Select Difficulty</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(['easy', 'medium', 'hard', 'expert'] as const).map((diff) => (
                    <Button
                      key={diff}
                      variant={selectedDifficulty === diff ? 'default' : 'outline'}
                      onClick={() => setSelectedDifficulty(diff)}
                      className="capitalize"
                    >
                      {diff}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="text-center">
                <Button 
                  size="lg" 
                  onClick={handleStartRound}
                  className="min-w-[200px]"
                >
                  Start Tournament
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Show animation phase only if we don't have game state ready
  if ((animationPhase === 'generating' || (animationPhase === 'revealing' && !gameState))) {
    return (
      <div className="min-h-screen bg-background">
        <GameHeader
          tournamentName={tournament?.name || `Match ${id?.slice(0, 8)}`}
          matchId={id || ''}
          totalPrize={1000000}
          playerCount={tournament?.players.length || 4}
          viewerCount={tournament?.viewers || Math.floor(Math.random() * 500) + 100}
          currentRound="Round 1"
          gameType="reverse-hangman"
          status={tournament?.status as 'waiting' | 'in-progress' | 'completed' || 'in-progress'}
          onBack={() => navigate('/tournaments')}
        />
        <div className="container mx-auto px-4 py-8">
          
          <PromptGenerationAnimation
            phase={animationPhase}
            output={animationOutput}
          />
        </div>
      </div>
    );
  }

  // Main game view
  return (
    <div className="min-h-screen bg-background">
      <GameHeader
        tournamentName={tournament?.name || `Match ${id?.slice(0, 8)}`}
        matchId={id || ''}
        totalPrize={1000000}
        playerCount={tournament?.players.length || 4}
        viewerCount={tournament?.viewers || Math.floor(Math.random() * 500) + 100}
        currentRound={`Round ${tournamentStats.currentRound} of ${tournamentStats.totalRounds}`}
        gameType="reverse-hangman"
        status={tournament?.status as 'waiting' | 'in-progress' | 'completed' || 'in-progress'}
        onBack={() => navigate('/tournaments')}
      />
      <div className="container mx-auto px-4 py-8">

        {gameState && (
          <ReverseHangmanBoard
            gameState={gameState}
            isAIThinking={isAIThinking}
            currentAgent={currentAgent}
          />
        )}
      </div>
    </div>
  );
}