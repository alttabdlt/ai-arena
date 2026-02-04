import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import { Loader2, ArrowLeft, Brain, Swords, Trophy } from 'lucide-react';

const API_BASE = '/api/v1';

async function apiFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.statusText}`);
  return res.json();
}

// ============================================
// Shared Components
// ============================================

const ARCHETYPE_EMOJI: Record<string, string> = {
  SHARK: '🦈', ROCK: '🪨', CHAMELEON: '🦎', DEGEN: '🎰', GRINDER: '🧮',
};

const ARCHETYPE_COLORS: Record<string, string> = {
  SHARK: 'text-red-400', ROCK: 'text-stone-400', CHAMELEON: 'text-green-400',
  DEGEN: 'text-purple-400', GRINDER: 'text-blue-400',
};

function PlayerBanner({ player, isWinner, isTurn, side, chips, cards }: {
  player: any; isWinner: boolean; isTurn: boolean; side: 'left' | 'right';
  chips?: number; cards?: string[];
}) {
  if (!player) return null;
  return (
    <div className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all min-w-[140px] ${
      isWinner ? 'border-yellow-500 bg-yellow-500/10' :
      isTurn ? 'border-blue-500 bg-blue-500/10 animate-pulse' :
      'border-gray-700 bg-gray-800/50'
    }`}>
      <div className="text-2xl">{ARCHETYPE_EMOJI[player.archetype] || '🤖'}</div>
      <div className="font-bold text-white text-sm">{player.name}</div>
      <Badge variant="outline" className={`text-[10px] ${ARCHETYPE_COLORS[player.archetype] || ''}`}>
        {player.archetype}
      </Badge>
      <div className="text-xs text-gray-400">ELO {player.elo}</div>
      {chips !== undefined && (
        <div className="font-mono text-yellow-400 text-sm font-bold">{chips.toLocaleString()} 💰</div>
      )}
      {cards && cards.length > 0 && (
        <div className="flex gap-1 mt-1">
          {cards.map((c, i) => <PokerCard key={i} card={c} />)}
        </div>
      )}
      {isWinner && <div className="text-lg">🏆</div>}
    </div>
  );
}

// ============================================
// Poker Card Component
// ============================================

function PokerCard({ card, size = 'md' }: { card: string; size?: 'sm' | 'md' | 'lg' }) {
  const isHidden = card === '?' || card === '??';
  const sizeClasses = {
    sm: 'w-8 h-11 text-xs',
    md: 'w-11 h-16 text-sm',
    lg: 'w-14 h-20 text-base',
  };

  if (isHidden) {
    return (
      <div className={`${sizeClasses[size]} rounded-lg bg-gradient-to-br from-blue-800 to-blue-950 border border-blue-600/50 flex items-center justify-center shadow-lg`}>
        <span className="text-blue-400">🂠</span>
      </div>
    );
  }

  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const isRed = suit === '♥' || suit === '♦';

  return (
    <div className={`${sizeClasses[size]} rounded-lg bg-white border border-gray-300 flex flex-col items-center justify-center shadow-lg font-bold ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
      <span className="leading-none">{rank}</span>
      <span className="leading-none text-[0.7em]">{suit}</span>
    </div>
  );
}

// ============================================
// AI Reasoning Panel
// ============================================

function ReasoningPanel({ moves, player1, player2 }: { moves: any[]; player1: any; player2: any }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [moves.length]);

  if (!moves || moves.length === 0) return null;

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="w-4 h-4 text-blue-400" />
          AI Reasoning Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
          {moves.map((m, i) => {
            const agent = m.agent || (m.agentId === player1?.id ? player1 : player2);
            const agentName = agent?.name || '?';
            const archetype = agent?.archetype || '?';
            let parsedAction = m.action;
            try { parsedAction = JSON.parse(m.action)?.action || m.action; } catch {}

            return (
              <div key={i} className="flex gap-2 text-xs">
                <div className="shrink-0 w-6 text-gray-600 font-mono">#{m.turnNumber}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-400">{ARCHETYPE_EMOJI[archetype]}</span>
                    <span className="font-semibold text-white">{agentName}</span>
                    <Badge variant="outline" className="text-[10px] py-0 h-4 text-yellow-300 border-yellow-500/30">
                      {parsedAction}
                    </Badge>
                    {m.responseTimeMs && (
                      <span className="text-gray-600 ml-auto">{m.responseTimeMs}ms</span>
                    )}
                  </div>
                  {m.reasoning && m.reasoning !== '(hidden during live match)' && m.reasoning !== '' && (
                    <div className="text-gray-400 italic mt-0.5 pl-5 border-l border-gray-800">
                      💭 {m.reasoning}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// POKER VIEWER
// ============================================

function PokerViewer({ state, moves }: { state: any; moves: any[] }) {
  const gs = state.gameState;
  if (!gs) return <div className="text-gray-500">Waiting for game state...</div>;

  const p1Data = gs.players?.[0];
  const p2Data = gs.players?.[1];
  const communityCards = gs.communityCards || [];
  const pot = gs.pot || 0;
  const phase = gs.phase || 'preflop';
  const handNumber = gs.handNumber || 1;
  const maxHands = gs.maxHands || 5;
  const handHistory = gs.handHistory || [];

  return (
    <div className="space-y-4">
      {/* Phase & Hand indicator */}
      <div className="flex items-center justify-center gap-4">
        <Badge variant="outline" className="text-sm border-gray-600">
          Hand {handNumber}/{maxHands}
        </Badge>
        <Badge className={`text-sm ${
          phase === 'preflop' ? 'bg-gray-600' :
          phase === 'flop' ? 'bg-blue-600' :
          phase === 'turn' ? 'bg-purple-600' :
          phase === 'river' ? 'bg-red-600' :
          phase === 'showdown' ? 'bg-yellow-600' : 'bg-gray-600'
        }`}>
          {phase.toUpperCase()}
        </Badge>
      </div>

      {/* Table layout */}
      <div className="relative bg-gradient-to-b from-green-950 to-green-900 rounded-3xl border-4 border-amber-800/60 p-6 min-h-[320px] shadow-2xl">
        {/* Player 1 (top) */}
        <div className="flex justify-center mb-4">
          <PlayerBanner
            player={state.player1}
            isWinner={state.winnerId === state.player1?.id}
            isTurn={state.currentTurnId === state.player1?.id}
            side="left"
            chips={p1Data?.chips}
            cards={p1Data?.holeCards}
          />
        </div>

        {/* Pot */}
        <div className="flex justify-center mb-3">
          <div className="bg-black/30 rounded-full px-6 py-2 border border-yellow-600/30">
            <span className="text-yellow-400 font-bold text-lg">Pot: {pot}</span>
            {gs.currentBet > 0 && (
              <span className="text-gray-400 text-sm ml-2">(bet: {gs.currentBet})</span>
            )}
          </div>
        </div>

        {/* Community cards */}
        <div className="flex justify-center gap-2 mb-4">
          {communityCards.length > 0 ? (
            communityCards.map((c: string, i: number) => <PokerCard key={i} card={c} size="lg" />)
          ) : (
            <div className="flex gap-2">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="w-14 h-20 rounded-lg border-2 border-dashed border-green-700/50" />
              ))}
            </div>
          )}
        </div>

        {/* Player 2 (bottom) */}
        <div className="flex justify-center mt-4">
          <PlayerBanner
            player={state.player2}
            isWinner={state.winnerId === state.player2?.id}
            isTurn={state.currentTurnId === state.player2?.id}
            side="right"
            chips={p2Data?.chips}
            cards={p2Data?.holeCards}
          />
        </div>
      </div>

      {/* Hand History */}
      {handHistory.length > 0 && (
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Hand History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {handHistory.map((h: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono bg-gray-800/30 rounded px-3 py-1.5">
                  <span className="text-gray-500 w-14">Hand {h.handNumber}</span>
                  <span className="text-yellow-400 w-16">{h.amount} pot</span>
                  <span className={h.showdown ? 'text-blue-400' : 'text-red-400'}>
                    {h.showdown ? `Showdown: ${h.winnerHand}` : 'Fold'}
                  </span>
                  {h.players?.map((p: any) => (
                    <span key={p.id} className="text-gray-400">
                      [{p.holeCards?.join(' ')}]
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reasoning */}
      <ReasoningPanel moves={moves} player1={state.player1} player2={state.player2} />
    </div>
  );
}

// ============================================
// RPS VIEWER
// ============================================

const RPS_EMOJI: Record<string, string> = {
  rock: '🪨', paper: '📄', scissors: '✂️',
};
const RPS_BIG: Record<string, string> = {
  rock: '✊', paper: '✋', scissors: '✌️',
};

function RPSViewer({ state, moves }: { state: any; moves: any[] }) {
  const gs = state.gameState;
  if (!gs) return <div className="text-gray-500">Waiting for game state...</div>;

  const history = gs.history || [];
  const scores = gs.scores || {};
  const round = gs.round || 1;
  const playerIds = Object.keys(scores);
  const p1Score = scores[state.player1?.id] || 0;
  const p2Score = scores[state.player2?.id] || 0;

  // Last completed round for display
  const lastRound = history[history.length - 1];
  const p1LastMove = lastRound?.moves?.[state.player1?.id];
  const p2LastMove = lastRound?.moves?.[state.player2?.id];

  return (
    <div className="space-y-4">
      {/* Score */}
      <div className="flex items-center justify-center gap-4">
        <Badge variant="outline" className="text-sm border-gray-600">
          Round {round} • Best of 5 (first to 3)
        </Badge>
      </div>

      {/* Arena */}
      <div className="relative bg-gradient-to-b from-slate-900 to-slate-800 rounded-3xl border-2 border-slate-600/50 p-8 min-h-[280px] shadow-2xl">
        <div className="flex items-center justify-between">
          {/* Player 1 */}
          <div className="flex flex-col items-center gap-3 flex-1">
            <PlayerBanner
              player={state.player1}
              isWinner={state.winnerId === state.player1?.id}
              isTurn={state.currentTurnId === state.player1?.id}
              side="left"
            />
            {p1LastMove && (
              <div className="text-6xl animate-bounce">{RPS_BIG[p1LastMove] || '❓'}</div>
            )}
            <div className="text-4xl font-bold text-white">{p1Score}</div>
          </div>

          {/* VS */}
          <div className="flex flex-col items-center gap-2 px-4">
            <div className="text-3xl font-black text-gray-500">VS</div>
            {lastRound && (
              <Badge variant="outline" className={`text-xs ${
                lastRound.winner === state.player1?.id ? 'border-blue-500 text-blue-400' :
                lastRound.winner === state.player2?.id ? 'border-purple-500 text-purple-400' :
                'border-gray-600 text-gray-400'
              }`}>
                {lastRound.winner
                  ? (lastRound.winner === state.player1?.id ? state.player1?.name : state.player2?.name) + ' wins!'
                  : 'Draw!'}
              </Badge>
            )}
          </div>

          {/* Player 2 */}
          <div className="flex flex-col items-center gap-3 flex-1">
            <PlayerBanner
              player={state.player2}
              isWinner={state.winnerId === state.player2?.id}
              isTurn={state.currentTurnId === state.player2?.id}
              side="right"
            />
            {p2LastMove && (
              <div className="text-6xl animate-bounce">{RPS_BIG[p2LastMove] || '❓'}</div>
            )}
            <div className="text-4xl font-bold text-white">{p2Score}</div>
          </div>
        </div>

        {/* Win progress */}
        <div className="mt-6 flex justify-center gap-2">
          {[0,1,2].map(i => (
            <div key={`p1-${i}`} className={`w-4 h-4 rounded-full border-2 ${
              i < p1Score ? 'bg-blue-500 border-blue-400' : 'border-gray-600'
            }`} />
          ))}
          <span className="text-gray-500 mx-2">|</span>
          {[0,1,2].map(i => (
            <div key={`p2-${i}`} className={`w-4 h-4 rounded-full border-2 ${
              i < p2Score ? 'bg-purple-500 border-purple-400' : 'border-gray-600'
            }`} />
          ))}
        </div>
      </div>

      {/* Round History */}
      {history.length > 0 && (
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Round History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-1">
              {history.map((h: any, i: number) => (
                <div key={i} className="flex items-center gap-3 text-sm font-mono bg-gray-800/30 rounded px-3 py-2">
                  <span className="text-gray-500 w-8">R{h.round}</span>
                  <span className="text-blue-400 w-20">
                    {RPS_EMOJI[h.moves?.[state.player1?.id]] || '?'} {h.moves?.[state.player1?.id]}
                  </span>
                  <span className="text-gray-600">vs</span>
                  <span className="text-purple-400 w-20">
                    {RPS_EMOJI[h.moves?.[state.player2?.id]] || '?'} {h.moves?.[state.player2?.id]}
                  </span>
                  <span className={`ml-auto ${h.winner ? 'text-green-400' : 'text-gray-500'}`}>
                    {h.winner
                      ? (h.winner === state.player1?.id ? state.player1?.name : state.player2?.name)
                      : 'Draw'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ReasoningPanel moves={moves} player1={state.player1} player2={state.player2} />
    </div>
  );
}

// ============================================
// BATTLESHIP VIEWER
// ============================================

function BattleshipViewer({ state, moves }: { state: any; moves: any[] }) {
  const gs = state.gameState;
  if (!gs) return <div className="text-gray-500">Waiting for game state...</div>;

  const boards = gs.boards || {};
  const shipsRemaining = gs.shipsRemaining || {};

  function renderGrid(playerId: string, label: string, isTarget: boolean) {
    const board = boards[playerId] || { hits: [], misses: [] };
    const hits = new Set((board.hits || []).map(([r,c]: number[]) => `${r},${c}`));
    const misses = new Set((board.misses || []).map(([r,c]: number[]) => `${r},${c}`));

    return (
      <div className="flex flex-col items-center">
        <div className="text-sm font-semibold text-gray-400 mb-2">{label}</div>
        <div className="text-xs text-gray-500 mb-1">Ships: {shipsRemaining[playerId] || 0}/5</div>
        <div className="grid grid-cols-10 gap-0.5">
          {Array.from({ length: 100 }).map((_, idx) => {
            const r = Math.floor(idx / 10);
            const c = idx % 10;
            const key = `${r},${c}`;
            const isHit = hits.has(key);
            const isMiss = misses.has(key);
            return (
              <div
                key={idx}
                className={`w-6 h-6 rounded-sm border text-[10px] flex items-center justify-center ${
                  isHit ? 'bg-red-600/80 border-red-500 text-white' :
                  isMiss ? 'bg-gray-700/50 border-gray-600 text-gray-500' :
                  'bg-blue-950/50 border-blue-900/50'
                }`}
              >
                {isHit ? '💥' : isMiss ? '·' : ''}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const p1Id = state.player1?.id;
  const p2Id = state.player2?.id;

  return (
    <div className="space-y-4">
      {/* Grids side by side */}
      <div className="bg-gradient-to-b from-blue-950 to-gray-900 rounded-3xl border-2 border-blue-800/50 p-6 shadow-2xl">
        <div className="flex items-center justify-center gap-2 mb-4">
          <PlayerBanner
            player={state.player1}
            isWinner={state.winnerId === p1Id}
            isTurn={state.currentTurnId === p1Id}
            side="left"
          />
          <div className="text-2xl font-black text-gray-500 px-4">VS</div>
          <PlayerBanner
            player={state.player2}
            isWinner={state.winnerId === p2Id}
            isTurn={state.currentTurnId === p2Id}
            side="right"
          />
        </div>

        <div className="flex justify-center gap-8 flex-wrap">
          {p1Id && renderGrid(p1Id, `${state.player1?.name}'s Waters`, false)}
          {p2Id && renderGrid(p2Id, `${state.player2?.name}'s Waters`, false)}
        </div>
      </div>

      <ReasoningPanel moves={moves} player1={state.player1} player2={state.player2} />
    </div>
  );
}

// ============================================
// MAIN MATCH PAGE
// ============================================

export default function MatchPage() {
  const { matchId } = useParams();
  const [state, setState] = useState<any>(null);
  const [moves, setMoves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    if (!matchId) return;
    try {
      const [matchState, matchMoves] = await Promise.all([
        apiFetch(`/matches/${matchId}/spectate`),
        apiFetch(`/matches/${matchId}/moves`).catch(() => []),
      ]);

      if (matchState) setState(matchState);
      if (matchMoves) setMoves(matchMoves);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000); // Poll every 3s for live matches
    return () => clearInterval(interval);
  }, [fetchState]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="max-w-4xl mx-auto p-4 text-center">
        <p className="text-gray-400 mb-4">Match not found or requires authentication.</p>
        <Button asChild variant="outline"><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Arena</Link></Button>
      </div>
    );
  }

  const isComplete = state.status === 'COMPLETED' || state.status === 'CANCELLED';

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/"><ArrowLeft className="mr-1 h-4 w-4" /> Arena</Link>
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {state.gameType === 'POKER' ? '🃏' : state.gameType === 'RPS' ? '✊' : '🚢'} {state.gameType}
          </Badge>
          <Badge variant={isComplete ? (state.status === 'CANCELLED' ? 'destructive' : 'default') : 'secondary'}>
            {isComplete ? (
              state.winnerId ? `🏆 ${state.player1?.id === state.winnerId ? state.player1?.name : state.player2?.name} wins!` :
              state.status === 'CANCELLED' ? 'Cancelled' : 'Draw'
            ) : (
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Live
              </span>
            )}
          </Badge>
          <span className="text-xs text-gray-500 font-mono">
            Pot: {state.totalPot} • Rake: {state.rakeAmount}
          </span>
        </div>
      </div>

      {/* Game-specific viewer */}
      {state.gameType === 'POKER' && <PokerViewer state={state} moves={moves} />}
      {state.gameType === 'RPS' && <RPSViewer state={state} moves={moves} />}
      {state.gameType === 'BATTLESHIP' && <BattleshipViewer state={state} moves={moves} />}
    </div>
  );
}
