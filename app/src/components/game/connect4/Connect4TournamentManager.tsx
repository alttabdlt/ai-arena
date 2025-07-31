import React, { useState, useEffect } from 'react';
import { TournamentBracket } from './TournamentBracket';
import { Connect4Board } from './Connect4Board';
import { Connect4Status } from './Connect4Status';
import { Connect4DecisionHistory } from './Connect4DecisionHistory';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Gamepad2, ChevronRight } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  avatar?: string;
  aiModel?: string;
}

interface Connect4TournamentManagerProps {
  participants: Player[];
  currentGameState?: any;
  isAIThinking?: boolean;
  currentPlayer?: any;
  makeMove?: (column: number) => void;
  winner?: string;
  isDraw?: boolean;
  isGameComplete?: boolean;
  stats?: any;
  decisionHistory?: any[];
}

export const Connect4TournamentManager: React.FC<Connect4TournamentManagerProps> = ({
  participants,
  currentGameState,
  isAIThinking,
  currentPlayer,
  makeMove,
  winner,
  isDraw,
  isGameComplete,
  stats,
  decisionHistory
}) => {
  // Tournament state
  const [currentStage, setCurrentStage] = useState<'semifinals' | 'finals'>('semifinals');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [semifinalWinners, setSemifinalWinners] = useState<[string?, string?]>([undefined, undefined]);
  const [tournamentWinner, setTournamentWinner] = useState<string>();
  const [showBracket, setShowBracket] = useState(true);

  // Ensure we have 4 participants
  if (!participants || participants.length < 4) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <p className="text-muted-foreground">Waiting for tournament participants...</p>
        </div>
      </Card>
    );
  }

  // Create matches from participants
  const semifinalMatches = [
    {
      id: 'semi1',
      player1: participants[0],
      player2: participants[1],
      winner: semifinalWinners[0],
      status: (currentStage === 'semifinals' && currentMatchIndex === 0 ? 
        (isGameComplete ? 'completed' : 'active') : 
        (semifinalWinners[0] ? 'completed' : 'pending')) as 'completed' | 'active' | 'pending'
    },
    {
      id: 'semi2',
      player1: participants[2],
      player2: participants[3],
      winner: semifinalWinners[1],
      status: (currentStage === 'semifinals' && currentMatchIndex === 1 ? 
        (isGameComplete ? 'completed' : 'active') : 
        (semifinalWinners[1] ? 'completed' : 'pending')) as 'completed' | 'active' | 'pending'
    }
  ];

  const finalMatch = semifinalWinners[0] && semifinalWinners[1] ? {
    id: 'final',
    player1: participants.find(p => p.id === semifinalWinners[0])!,
    player2: participants.find(p => p.id === semifinalWinners[1])!,
    winner: tournamentWinner,
    status: (currentStage === 'finals' ? 
      (isGameComplete ? 'completed' : 'active') : 
      'pending') as 'completed' | 'active' | 'pending'
  } : undefined;

  // Get current match players
  const getCurrentMatchPlayers = () => {
    if (currentStage === 'semifinals') {
      const match = semifinalMatches[currentMatchIndex];
      return [match.player1, match.player2];
    } else if (finalMatch) {
      return [finalMatch.player1, finalMatch.player2];
    }
    return [];
  };

  // Handle match completion
  useEffect(() => {
    if (isGameComplete && winner) {
      if (currentStage === 'semifinals') {
        // Record semifinal winner
        const newWinners = [...semifinalWinners];
        newWinners[currentMatchIndex] = winner;
        setSemifinalWinners(newWinners as [string?, string?]);

        // Move to next match
        if (currentMatchIndex === 0) {
          setCurrentMatchIndex(1);
        } else {
          // Both semifinals complete, move to finals
          if (newWinners[0] && newWinners[1]) {
            setCurrentStage('finals');
            setCurrentMatchIndex(0);
          }
        }
      } else if (currentStage === 'finals') {
        // Tournament complete
        setTournamentWinner(winner);
      }
    }
  }, [isGameComplete, winner, currentStage, currentMatchIndex, semifinalWinners]);

  const currentMatchId = currentStage === 'semifinals' ? 
    semifinalMatches[currentMatchIndex].id : 
    finalMatch?.id;

  return (
    <div className="space-y-6">
      {/* Tournament Progress */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-4 mb-4">
          <Badge variant={currentStage === 'semifinals' ? 'default' : 'outline'}>
            Semifinals
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Badge variant={currentStage === 'finals' ? 'default' : 'outline'}>
            Finals
          </Badge>
          {tournamentWinner && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="destructive" className="flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                Champion
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex justify-center mb-4">
        <div className="inline-flex rounded-lg border p-1">
          <Button
            size="sm"
            variant={showBracket ? 'default' : 'ghost'}
            onClick={() => setShowBracket(true)}
          >
            Tournament Bracket
          </Button>
          <Button
            size="sm"
            variant={!showBracket ? 'default' : 'ghost'}
            onClick={() => setShowBracket(false)}
            disabled={!currentGameState}
          >
            <Gamepad2 className="h-4 w-4 mr-1" />
            Current Game
          </Button>
        </div>
      </div>

      {/* Tournament Complete Banner */}
      {tournamentWinner && (
        <Card className="p-6 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/50">
          <div className="text-center">
            <Trophy className="h-12 w-12 mx-auto mb-3 text-yellow-500" />
            <h2 className="text-2xl font-bold mb-2">Tournament Champion!</h2>
            <p className="text-lg">
              🎉 {participants.find(p => p.id === tournamentWinner)?.name} wins the Connect 4 Tournament! 🎉
            </p>
          </div>
        </Card>
      )}

      {/* Main Content */}
      {showBracket ? (
        <TournamentBracket
          semifinals={semifinalMatches as any}
          finals={finalMatch}
          currentMatchId={currentMatchId}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Game Board */}
          <div className="lg:col-span-2">
            {currentGameState && (
              <Connect4Board
                board={currentGameState.board}
                onColumnClick={makeMove || (() => {})}
                isAIThinking={isAIThinking || false}
                disabled={isGameComplete}
                winningCells={currentGameState.winningCells}
              />
            )}
          </div>

          {/* Game Info */}
          <div className="space-y-4">
            {/* Current Match Info */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Current Match</h3>
              <div className="space-y-2">
                {getCurrentMatchPlayers().map((player, idx) => (
                  <div key={player.id} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full ${idx === 0 ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    <span className="text-sm">{player.name}</span>
                    {winner === player.id && <Trophy className="h-3 w-3 text-primary ml-auto" />}
                  </div>
                ))}
              </div>
            </Card>

            {/* Game Status */}
            {currentGameState && (
              <Connect4Status
                currentPlayer={currentPlayer}
                isAIThinking={isAIThinking || false}
                winner={winner ? {
                  id: winner,
                  name: participants.find(p => p.id === winner)?.name || 'Unknown',
                  color: getCurrentMatchPlayers().findIndex(p => p.id === winner) === 0 ? 'red' : 'yellow',
                  isAI: true,
                  aiModel: undefined
                } : null}
                isDraw={isDraw || false}
                players={participants}
              />
            )}

            {/* Decision History */}
            {decisionHistory && decisionHistory.length > 0 && (
              <Connect4DecisionHistory
                decisions={decisionHistory}
                currentMoveNumber={currentGameState?.moveCount || 0}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};