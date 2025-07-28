import * as React from 'react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Connect4Board } from '@/components/game/connect4/Connect4Board';
import { Connect4Status } from '@/components/game/connect4/Connect4Status';
import { Connect4DecisionHistory } from '@/components/game/connect4/Connect4DecisionHistory';
import { useConnect4Game } from '@/hooks/useConnect4Game';
import { Tournament } from '@/types/tournament';
import { ArrowLeft, Zap, Trophy, Timer } from 'lucide-react';

export default function Connect4View() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        if (loadedTournament.gameType !== 'connect4') {
          setLoadingError(`This tournament is for ${loadedTournament.gameType}, not Connect 4.`);
          clearTimeout(timeoutId);
          setIsLoading(false);
          
          // Redirect to correct game view after a short delay
          setTimeout(() => {
            if (loadedTournament.gameType === 'poker') {
              navigate(`/tournament/${id}`);
            } else if (loadedTournament.gameType === 'reverse-hangman') {
              navigate(`/tournament/${id}/hangman`);
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
    currentPlayer,
    makeMove,
    winner,
    isDraw,
    isGameComplete,
    stats,
    decisionHistory
  } = useConnect4Game({ tournament });
  
  // Debug logging
  useEffect(() => {
    console.log('Connect4View state:', {
      hasGameState: !!gameState,
      board: gameState?.board,
      boardLength: gameState?.board?.length,
      boardFirstRow: gameState?.board?.[0],
      isAIThinking,
      currentPlayer,
      isGameComplete,
      moveCount: stats?.moveCount
    });
    
    // Additional debug: log the exact board structure
    if (gameState?.board) {
      console.log('Board structure check:', {
        isArray: Array.isArray(gameState.board),
        boardType: typeof gameState.board,
        firstRowType: typeof gameState.board[0],
        sample: gameState.board[0]?.[0],
        fullBoard: gameState.board
      });
    } else {
      console.log('No board in gameState:', gameState);
    }
  }, [gameState, isAIThinking, currentPlayer, isGameComplete, stats]);
  
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
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tournaments
          </Button>
          
          <Card className="p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Loading Tournament...</h2>
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Show error state
  if (loadingError || !tournament) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Button 
            variant="outline" 
            onClick={() => navigate('/tournaments')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tournaments
          </Button>
          
          <Card className="p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4 text-destructive">Error Loading Tournament</h2>
              <p className="text-muted-foreground mb-6">{loadingError || 'Tournament not found'}</p>
              <Button onClick={() => navigate('/tournaments')}>
                Return to Tournaments
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Main game view
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/tournaments')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold">{tournament.name}</h1>
            <p className="text-muted-foreground">Connect 4 Tournament</p>
          </div>

          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm">
              {tournament.config.timeLimit}s per move
            </span>
          </div>
        </div>

        {/* Game Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Game Board */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              {gameState && gameState.board && Array.isArray(gameState.board) && gameState.board.length > 0 ? (
                <>
                  <Connect4Board
                    board={gameState.board}
                    onColumnClick={makeMove}
                    isAIThinking={isAIThinking}
                    disabled={isGameComplete || isAIThinking}
                    winningCells={gameState.winningCells}
                  />
                  
                  {/* Game Status */}
                  <div className="mt-6">
                    <Connect4Status
                      currentPlayer={currentPlayer}
                      isAIThinking={isAIThinking}
                      winner={winner}
                      isDraw={isDraw}
                      players={tournament.players}
                    />
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    {!gameState ? 'Initializing game state...' :
                     !gameState.board ? 'Waiting for board initialization...' :
                     !Array.isArray(gameState.board) ? 'Invalid board format...' :
                     'Setting up game board...'}
                  </p>
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                  {/* Debug info */}
                  <div className="mt-4 text-xs text-muted-foreground">
                    <p>Debug: gameState exists: {!!gameState ? 'Yes' : 'No'}</p>
                    <p>Debug: board exists: {!!(gameState?.board) ? 'Yes' : 'No'}</p>
                    <p>Debug: board is array: {Array.isArray(gameState?.board) ? 'Yes' : 'No'}</p>
                    <p>Debug: board length: {gameState?.board?.length || 'N/A'}</p>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Side Panel */}
          <div className="space-y-4">
            {/* Players */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Players
              </h3>
              <div className="space-y-2">
                {tournament.players.map((player, index) => (
                  <div 
                    key={player.id}
                    className={`flex items-center justify-between p-2 rounded ${
                      currentPlayer?.id === player.id ? 'bg-primary/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        index === 0 ? 'bg-red-500' : 'bg-yellow-500'
                      }`} />
                      <span className="font-medium">{player.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {player.aiModel}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Game Stats */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Game Stats
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Moves</span>
                  <span>{stats.moveCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time per Move</span>
                  <span>{tournament.config.timeLimit}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Board Size</span>
                  <span>
                    {gameState?.board ? `${gameState.board[0]?.length || 0}×${gameState.board.length}` : '8×8'}
                  </span>
                </div>
              </div>
            </Card>

            {/* AI Decision History */}
            <Connect4DecisionHistory 
              decisions={decisionHistory}
              currentMoveNumber={stats.moveCount}
            />

            {/* Game Complete Actions */}
            {isGameComplete && (
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Game Complete!</h3>
                <div className="space-y-2">
                  <Button 
                    className="w-full"
                    onClick={() => navigate('/tournaments')}
                  >
                    Back to Tournaments
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate('/tournaments/create')}
                  >
                    Create New Tournament
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}