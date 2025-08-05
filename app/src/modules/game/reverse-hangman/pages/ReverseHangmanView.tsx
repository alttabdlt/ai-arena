import * as React from 'react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@ui/button';
import { Card } from '@ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { ReverseHangmanBoard } from '@game/reverse-hangman/components/ReverseHangmanBoard';
import { PromptGenerationAnimation } from '@game/reverse-hangman/components/PromptGenerationAnimation';
import { useServerSideReverseHangman as useReverseHangmanGame } from '@game/reverse-hangman/hooks/useServerSideReverseHangman';
import { Tournament } from '@shared/types/tournament';

export default function ReverseHangmanView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard' | 'expert'>('medium');
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingRound, setIsStartingRound] = useState(false);

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
          setLoadingError('Tournament not found. It may have been removed or expired.');
          clearTimeout(timeoutId);
          setIsLoading(false);
          return;
        }

        const loadedTournament = JSON.parse(tournamentData);
        if (loadedTournament.gameType !== 'reverse-hangman') {
          setLoadingError(`This tournament is for ${loadedTournament.gameType}, not reverse-hangman.`);
          clearTimeout(timeoutId);
          setIsLoading(false);
          
          // Redirect to correct game view after a short delay
          setTimeout(() => {
            if (loadedTournament.gameType === 'poker') {
              navigate(`/tournament/${id}`);
            } else {
              navigate('/tournaments');
            }
          }, 2000);
          return;
        }

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

  // Always call the hook to respect React's rules
  const {
    gameState,
    isAIThinking,
    currentAgent,
    tournamentStats,
    showDifficultySelect,
    startRound,
    animationPhase,
    animationOutput
  } = useReverseHangmanGame({ tournament: tournament! });
  
  // Show loading state
  if (isLoading && !loadingError) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/tournaments')}
            className="mb-4"
            size="sm"
          >
            Back to Tournaments
          </Button>
          <div className="flex items-center justify-center mt-20">
            <Card className="p-6 text-center max-w-md">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-base font-medium mb-2">Loading Tournament</h2>
              <p className="text-sm text-muted-foreground">Tournament ID: {id}</p>
              <p className="text-xs text-muted-foreground mt-2">This may take a few seconds...</p>
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
            variant="ghost" 
            onClick={() => navigate('/tournaments')}
            className="mb-4"
            size="sm"
          >
            Back to Tournaments
          </Button>
          <div className="flex items-center justify-center mt-20">
            <Card className="p-6 text-center max-w-md">
              <h2 className="text-base font-medium mb-2">Unable to Load Tournament</h2>
              <p className="text-sm text-muted-foreground mb-4">{loadingError || 'Tournament not found'}</p>
              <div className="space-y-2">
                <Button onClick={() => navigate('/tournaments')} size="sm" className="w-full">
                  Go to Tournaments
                </Button>
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

  const handleDifficultySelect = async () => {
    setIsStartingRound(true);
    try {
      await startRound(selectedDifficulty);
    } catch (error) {
      console.error('Error starting round:', error);
      toast.error('Failed to start the round. Please try again.');
    } finally {
      setIsStartingRound(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-medium">{tournament.name}</h1>
              <p className="text-sm text-muted-foreground">Reverse Engineering Challenge</p>
            </div>
            <Button variant="ghost" onClick={() => navigate('/tournaments')} size="sm">
              Back to Tournaments
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            {animationPhase !== 'idle' ? (
              <PromptGenerationAnimation
                phase={animationPhase}
                output={animationOutput}
                onComplete={() => {
                  // Animation complete callback
                }}
              />
            ) : (
              <Card className="p-6">
                {showDifficultySelect ? (
                  <div className="text-center py-8">
                    <h2 className="text-base font-medium mb-4">Select Difficulty for Round {tournamentStats.currentRound + 1}</h2>
                    <p className="text-sm text-muted-foreground mb-6">Choose how challenging you want the next prompt to be</p>
                    
                    <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto mb-6">
                      <Card 
                        className={`p-4 cursor-pointer transition-shadow ${selectedDifficulty === 'easy' ? 'border-primary' : 'hover:shadow-md'}`}
                        onClick={() => setSelectedDifficulty('easy')}
                      >
                        <h3 className="font-medium text-sm mb-1">Easy</h3>
                        <p className="text-xs text-muted-foreground">6-8 words</p>
                        <p className="text-xs text-muted-foreground mt-1">Simple prompts with clear outputs</p>
                      </Card>
                      
                      <Card 
                        className={`p-4 cursor-pointer transition-shadow ${selectedDifficulty === 'medium' ? 'border-primary' : 'hover:shadow-md'}`}
                        onClick={() => setSelectedDifficulty('medium')}
                      >
                        <h3 className="font-medium text-sm mb-1">Medium</h3>
                        <p className="text-xs text-muted-foreground">8-12 words</p>
                        <p className="text-xs text-muted-foreground mt-1">Moderate complexity prompts</p>
                      </Card>
                      
                      <Card 
                        className={`p-4 cursor-pointer transition-shadow ${selectedDifficulty === 'hard' ? 'border-primary' : 'hover:shadow-md'}`}
                        onClick={() => setSelectedDifficulty('hard')}
                      >
                        <h3 className="font-medium text-sm mb-1">Hard</h3>
                        <p className="text-xs text-muted-foreground">10-15 words</p>
                        <p className="text-xs text-muted-foreground mt-1">Complex prompts with nuance</p>
                      </Card>
                      
                      <Card 
                        className={`p-4 cursor-pointer transition-shadow ${selectedDifficulty === 'expert' ? 'border-primary' : 'hover:shadow-md'}`}
                        onClick={() => setSelectedDifficulty('expert')}
                      >
                        <h3 className="font-medium text-sm mb-1">Expert</h3>
                        <p className="text-xs text-muted-foreground">12-20 words</p>
                        <p className="text-xs text-muted-foreground mt-1">Highly specific technical prompts</p>
                      </Card>
                    </div>
                    
                    <Button 
                      size="sm" 
                      onClick={handleDifficultySelect}
                      disabled={isStartingRound}
                    >
                      {isStartingRound ? 'Starting...' : 'Start Round'}
                    </Button>
                  </div>
                ) : gameState ? (
                  <ReverseHangmanBoard
                    gameState={gameState}
                    isAIThinking={isAIThinking}
                  />
                ) : (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Preparing round...</p>
                  </div>
                )}
              </Card>
            )}
          </div>

          <div className="space-y-3">
            <Card className="p-3">
              <h3 className="text-sm font-medium mb-2">Current Player</h3>
              {currentAgent ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium">
                        {currentAgent.name[0]}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm">{currentAgent.name}</div>
                      <div className="text-xs text-muted-foreground">{currentAgent.model}</div>
                    </div>
                  </div>
                  {currentAgent.strategy && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {currentAgent.strategy}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Waiting for player...</p>
              )}
            </Card>

            <Card className="p-3">
              <h3 className="text-sm font-medium mb-2">Tournament Progress</h3>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Round</span>
                  <span>
                    {tournamentStats.currentRound} / {tournamentStats.totalRounds}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total Score</span>
                  <span>
                    {tournamentStats.totalScore}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-3">
              <h3 className="text-sm font-medium mb-2">Players</h3>
              <div className="space-y-1">
                {tournament.players.map((player) => (
                  <div 
                    key={player.id}
                    className={`flex items-center justify-between p-1.5 rounded ${
                      currentAgent?.id === player.id ? 'bg-muted' : ''
                    }`}
                  >
                    <span className="text-xs">{player.name}</span>
                    <span className="text-xs text-muted-foreground">{player.aiModel}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}