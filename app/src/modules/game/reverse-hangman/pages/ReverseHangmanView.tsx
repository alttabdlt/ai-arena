import * as React from 'react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@ui/button';
import { Card } from '@ui/card';
import { toast } from 'sonner';
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
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{tournament.name}</h1>
              <p className="text-gray-700">Reverse Engineering Challenge</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/tournaments')}>
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
                  <div className="text-center py-12">
                    <h2 className="text-2xl font-bold mb-6">Select Difficulty for Round {tournamentStats.currentRound + 1}</h2>
                    <p className="text-gray-700 mb-8">Choose how challenging you want the next prompt to be</p>
                    
                    <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto mb-8">
                      <Card 
                        className={`p-6 cursor-pointer transition-all ${selectedDifficulty === 'easy' ? 'border-primary ring-2 ring-primary' : 'hover:border-primary'}`}
                        onClick={() => setSelectedDifficulty('easy')}
                      >
                        <h3 className="font-bold text-lg mb-2">Easy</h3>
                        <p className="text-sm text-gray-700">6-8 words</p>
                        <p className="text-xs text-gray-700 mt-1">Simple prompts with clear outputs</p>
                      </Card>
                      
                      <Card 
                        className={`p-6 cursor-pointer transition-all ${selectedDifficulty === 'medium' ? 'border-primary ring-2 ring-primary' : 'hover:border-primary'}`}
                        onClick={() => setSelectedDifficulty('medium')}
                      >
                        <h3 className="font-bold text-lg mb-2">Medium</h3>
                        <p className="text-sm text-gray-700">8-12 words</p>
                        <p className="text-xs text-gray-700 mt-1">Moderate complexity prompts</p>
                      </Card>
                      
                      <Card 
                        className={`p-6 cursor-pointer transition-all ${selectedDifficulty === 'hard' ? 'border-primary ring-2 ring-primary' : 'hover:border-primary'}`}
                        onClick={() => setSelectedDifficulty('hard')}
                      >
                        <h3 className="font-bold text-lg mb-2">Hard</h3>
                        <p className="text-sm text-gray-700">10-15 words</p>
                        <p className="text-xs text-gray-700 mt-1">Complex prompts with nuance</p>
                      </Card>
                      
                      <Card 
                        className={`p-6 cursor-pointer transition-all ${selectedDifficulty === 'expert' ? 'border-primary ring-2 ring-primary' : 'hover:border-primary'}`}
                        onClick={() => setSelectedDifficulty('expert')}
                      >
                        <h3 className="font-bold text-lg mb-2">Expert</h3>
                        <p className="text-sm text-gray-700">12-20 words</p>
                        <p className="text-xs text-gray-700 mt-1">Highly specific technical prompts</p>
                      </Card>
                    </div>
                    
                    <Button 
                      size="lg" 
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
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p>Preparing round...</p>
                  </div>
                )}
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Current Player</h3>
              {currentAgent ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-lg font-semibold">
                        {currentAgent.name[0]}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">{currentAgent.name}</div>
                      <div className="text-sm text-gray-700">{currentAgent.model}</div>
                    </div>
                  </div>
                  {currentAgent.strategy && (
                    <p className="text-sm text-gray-700 mt-2">
                      {currentAgent.strategy}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-700">Waiting for player...</p>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-3">Tournament Progress</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Round</span>
                  <span className="font-medium">
                    {tournamentStats.currentRound} / {tournamentStats.totalRounds}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Total Score</span>
                  <span className="font-medium">
                    {tournamentStats.totalScore}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-3">Players</h3>
              <div className="space-y-2">
                {tournament.players.map((player) => (
                  <div 
                    key={player.id}
                    className={`flex items-center justify-between p-2 rounded ${
                      currentAgent?.id === player.id ? 'bg-primary/10' : ''
                    }`}
                  >
                    <span className="text-sm">{player.name}</span>
                    <span className="text-xs text-gray-700">{player.aiModel}</span>
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