import { useParams, Link } from 'react-router-dom';
import { Button } from '@ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { useServerSidePoker } from '@game/poker/hooks/useServerSidePoker';
import { PokerTable } from '@game/poker/components/PokerTable';
import type { Card as PokerCard, PokerPhase, PokerPlayer } from '@game/shared/types';

type PokerWinner = { playerId: string; amount: number };

function isPokerWinner(value: unknown): value is PokerWinner {
  if (!value || typeof value !== 'object') return false;
  const maybeWinner = value as { playerId?: unknown; amount?: unknown };
  return typeof maybeWinner.playerId === 'string' && typeof maybeWinner.amount === 'number';
}

type RecentAction = { t: number; text: string };

const PokerViewer = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const { gameState, startNewHand, getPlayerPoints } = useServerSidePoker({ gameId: gameId || '' });
  const winners = gameState.winners.filter(isPokerWinner);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold pixel-title">Poker Table</h1>
        <Button asChild variant="outline"><Link to="/">Exit</Link></Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Table</CardTitle>
          </CardHeader>
          <CardContent>
            <PokerTable
              players={gameState.players as PokerPlayer[]}
              communityCards={gameState.communityCards as PokerCard[]}
              pot={gameState.pot}
              currentBet={gameState.currentBet}
              phase={gameState.phase as PokerPhase}
              currentPlayer={gameState.currentPlayer as PokerPlayer | null}
              winners={winners}
              isHandComplete={gameState.isHandComplete}
              currentAIThinking={gameState.currentAIThinking}
              aiDecisionHistory={gameState.aiDecisionHistory}
              onStartNewHand={startNewHand}
              viewers={0}
              getPlayerPoints={getPlayerPoints}
              dealerPosition={gameState.dealerPosition}
              smallBlindPosition={gameState.smallBlindPosition}
              bigBlindPosition={gameState.bigBlindPosition}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
          </CardHeader>
          <CardContent>
            {gameState.recentActions?.length ? (
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {gameState.recentActions.slice(-12).map((e: RecentAction, idx: number) => (
                  <div key={e.t ?? idx} className="text-sm">
                    <span className="text-muted-foreground">•</span> {e.text}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Live actions will appear here.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PokerViewer;
