import * as React from 'react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { ReverseHangmanBoard } from '@/reverse-hangman/components/ReverseHangmanBoard';
import { PromptGenerationAnimation } from '@/reverse-hangman/components/PromptGenerationAnimation';
import { useReverseHangmanGame } from '@/hooks/useReverseHangmanGame';
import { Tournament } from '@/types/tournament';

export default function ReverseHangmanView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard' | 'expert'>('medium');

  useEffect(() => {
    // Load tournament from sessionStorage
    const tournamentData = sessionStorage.getItem(`tournament-${id}`);
    if (!tournamentData) {
      toast.error('Tournament not found');
      navigate('/tournaments');
      return;
    }

    const loadedTournament = JSON.parse(tournamentData);
    if (loadedTournament.gameType !== 'reverse-hangman') {
      toast.error('Invalid game type for this view');
      navigate('/tournaments');
      return;
    }

    setTournament(loadedTournament);
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
  } = useReverseHangmanGame({ tournament });
  
  if (!tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading tournament...</p>
        </div>
      </div>
    );
  }

  const handleDifficultySelect = () => {
    startRound(selectedDifficulty);
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
                    
                    <Button size="lg" onClick={handleDifficultySelect}>
                      Start Round
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