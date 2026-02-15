import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { Button } from '@ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { CREATE_GAME, START_GAME, QUICK_MATCH } from '@/graphql/mutations/game';

type DemoBot = { id: string; name: string; mmr: number };

const DEMO_OPPONENTS: DemoBot[] = [
  { id: 'demo-poker-aggro', name: 'AggroBot', mmr: 1250 },
  { id: 'demo-poker-solid', name: 'SolidBot', mmr: 1150 },
  { id: 'demo-poker-nit', name: 'NitBot', mmr: 1050 },
  { id: 'demo-poker-loose', name: 'LooseBot', mmr: 950 },
];

function getUserMMR(): number {
  const stored = localStorage.getItem('poker-mmr');
  if (!stored) return 1100;
  const n = parseInt(stored, 10);
  return Number.isFinite(n) ? n : 1100;
}

function chooseOpponent(userMMR: number): DemoBot {
  return DEMO_OPPONENTS.reduce((best, cur) => {
    const bestDiff = Math.abs(best.mmr - userMMR);
    const curDiff = Math.abs(cur.mmr - userMMR);
    return curDiff < bestDiff ? cur : best;
  }, DEMO_OPPONENTS[0]);
}

const PlayPoker = () => {
  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userMMR = useMemo(() => getUserMMR(), []);
  const opponent = useMemo(() => chooseOpponent(userMMR), [userMMR]);

  const [quickMatch] = useMutation(QUICK_MATCH);
  const [createGame] = useMutation(CREATE_GAME);
  const [startGame] = useMutation(START_GAME);

  const onFindMatch = useCallback(async () => {
    setSearching(true);
    setError(null);
    try {
      // Determine player IDs
      const selectedBotId = localStorage.getItem('selectedBotId') || 'demo-user-bot';
      const gameId = `poker-${Date.now()}`;

      // Try quick matchmaking first
      const { data: qm } = await quickMatch({ variables: { botId: selectedBotId, mmr: userMMR, timeoutMs: 10000 } });
      const result = qm?.quickMatch;
      if (result?.status === 'MATCHED' && result?.gameId) {
        navigate(`/play/poker/${result.gameId}`);
        return;
      }

      // Fallback to demo opponent
      await createGame({
        variables: {
          gameId,
          type: 'POKER',
          players: [selectedBotId, opponent.id],
        },
      });
      await startGame({ variables: { gameId } });
      navigate(`/play/poker/${gameId}`);
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'Failed to start match. Ensure backend is running.';
      setError(message);
    } finally {
      setSearching(false);
    }
  }, [createGame, quickMatch, startGame, navigate, opponent.id, userMMR]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold pixel-title">Quick Match: Poker</h1>
        <p className="text-muted-foreground mt-2">Matchmaking pairs you by MMR vs a demo bot.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Matchmaking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Your MMR: <span className="font-medium text-foreground">{userMMR}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Opponent: <span className="font-medium">{opponent.name}</span> (MMR {opponent.mmr})
              </div>
              <Button className="pixel-btn" onClick={onFindMatch} disabled={searching}>
                {searching ? 'Searching…' : 'Find Match'}
              </Button>
              {error && <div className="text-red-500 text-sm">{error}</div>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc ml-5 text-sm text-muted-foreground space-y-2">
              <li>Click Find Match to create a 2‑player poker game.</li>
              <li>We choose an opponent near your MMR for fair games.</li>
              <li>The match starts immediately; you can spectate the table.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PlayPoker;
