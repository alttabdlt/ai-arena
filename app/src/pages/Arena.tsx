import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@ui/card';
import { Badge } from '@ui/badge';
import { Button } from '@ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/table';
import { Progress } from '@ui/progress';
import { Loader2, Trophy, Swords, Brain, TrendingUp, Zap, ChevronDown, ChevronUp } from 'lucide-react';

const API_BASE = '/api/v1';

// ============================================
// Types
// ============================================

interface Agent {
  id: string;
  name: string;
  archetype: string;
  modelId: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  bankroll: number;
  isInMatch: boolean;
  apiCostCents: number;
  winRate?: number;
  profit?: number;
  apiCostDollars?: string;
  rank?: number;
  totalWagered?: number;
  totalWon?: number;
}

interface MatchState {
  matchId: string;
  gameType: string;
  status: string;
  wagerAmount: number;
  totalPot: number;
  rakeAmount: number;
  winnerId: string | null;
  player1: { id: string; name: string; archetype: string; elo: number };
  player2: { id: string; name: string; archetype: string; elo: number } | null;
  currentTurnId: string | null;
  turnNumber: number;
  gameState: any;
  moves: Array<{
    turnNumber: number;
    agentId: string;
    action: string;
    reasoning: string;
    timestamp: string;
  }>;
}

// ============================================
// API helpers
// ============================================

async function apiFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.statusText}`);
  return res.json();
}

// ============================================
// Sub-components
// ============================================

const ARCHETYPE_COLORS: Record<string, string> = {
  SHARK: 'bg-red-500/10 text-red-400 border-red-500/20',
  ROCK: 'bg-stone-500/10 text-stone-400 border-stone-500/20',
  CHAMELEON: 'bg-green-500/10 text-green-400 border-green-500/20',
  DEGEN: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  GRINDER: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const ARCHETYPE_EMOJI: Record<string, string> = {
  SHARK: '🦈',
  ROCK: '🪨',
  CHAMELEON: '🦎',
  DEGEN: '🎰',
  GRINDER: '🧮',
};

function ArchetypeBadge({ archetype }: { archetype: string }) {
  return (
    <Badge variant="outline" className={`${ARCHETYPE_COLORS[archetype] || ''} font-mono text-xs`}>
      {ARCHETYPE_EMOJI[archetype] || '🤖'} {archetype}
    </Badge>
  );
}

function EloDisplay({ elo, size = 'sm' }: { elo: number; size?: 'sm' | 'lg' }) {
  const color = elo >= 1600 ? 'text-yellow-400' : elo >= 1500 ? 'text-green-400' : 'text-gray-400';
  return (
    <span className={`font-mono font-bold ${color} ${size === 'lg' ? 'text-2xl' : 'text-sm'}`}>
      {elo}
    </span>
  );
}

function ProfitDisplay({ profit }: { profit: number }) {
  if (profit > 0) return <span className="text-green-400 font-mono">+{profit.toLocaleString()}</span>;
  if (profit < 0) return <span className="text-red-400 font-mono">{profit.toLocaleString()}</span>;
  return <span className="text-gray-500 font-mono">0</span>;
}

// ============================================
// Leaderboard
// ============================================

function Leaderboard({ agents }: { agents: Agent[] }) {
  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Arena Leaderboard
        </CardTitle>
        <CardDescription>Ranked by ELO rating</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-gray-800">
              <TableHead className="w-12">#</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead className="text-center">ELO</TableHead>
              <TableHead className="text-center">W-L-D</TableHead>
              <TableHead className="text-right">Bankroll</TableHead>
              <TableHead className="text-right">Profit</TableHead>
              <TableHead className="text-right">API Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((a, i) => (
              <TableRow key={a.id} className="border-gray-800/50 hover:bg-gray-800/30">
                <TableCell className="font-mono text-gray-500">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{a.name}</span>
                    <ArchetypeBadge archetype={a.archetype} />
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{a.modelId}</div>
                </TableCell>
                <TableCell className="text-center">
                  <EloDisplay elo={a.elo} />
                </TableCell>
                <TableCell className="text-center font-mono text-sm">
                  <span className="text-green-400">{a.wins}</span>
                  <span className="text-gray-600">-</span>
                  <span className="text-red-400">{a.losses}</span>
                  <span className="text-gray-600">-</span>
                  <span className="text-gray-400">{a.draws}</span>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {a.bankroll.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <ProfitDisplay profit={a.profit || 0} />
                </TableCell>
                <TableCell className="text-right text-xs text-gray-500 font-mono">
                  ${a.apiCostDollars || (a.apiCostCents / 100).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============================================
// Match Viewer
// ============================================

function MatchViewer({ match }: { match: MatchState }) {
  const [showReasoning, setShowReasoning] = useState<number | null>(null);

  const gameType = match.gameType;
  const gs = match.gameState;

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-blue-400" />
            {match.player1?.name} vs {match.player2?.name || '???'}
          </CardTitle>
          <Badge variant={match.status === 'COMPLETED' ? 'default' : 'secondary'}>
            {match.status}
          </Badge>
        </div>
        <CardDescription>
          {gameType} • Wager: {match.wagerAmount} $ARENA • Pot: {match.totalPot} • Rake: {match.rakeAmount}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Players */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[match.player1, match.player2].filter(Boolean).map((p: any) => (
            <div key={p.id} className={`p-3 rounded-lg border ${
              match.winnerId === p.id ? 'border-yellow-500/50 bg-yellow-500/5' :
              match.currentTurnId === p.id ? 'border-blue-500/50 bg-blue-500/5' :
              'border-gray-800 bg-gray-900/30'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-white flex items-center gap-1">
                    {match.winnerId === p.id && '🏆 '}
                    {match.currentTurnId === p.id && '▶️ '}
                    {p.name}
                  </div>
                  <ArchetypeBadge archetype={p.archetype} />
                </div>
                <EloDisplay elo={p.elo} />
              </div>
            </div>
          ))}
        </div>

        {/* Game-specific state */}
        {gameType === 'RPS' && gs?.history && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-400 flex items-center gap-1">
              <Zap className="w-4 h-4" /> Round History
            </h4>
            <div className="grid gap-1">
              {gs.history.map((h: any, i: number) => {
                const moves = Object.entries(h.moves);
                return (
                  <div key={i} className="flex items-center gap-2 text-sm font-mono bg-gray-800/30 rounded px-3 py-1.5">
                    <span className="text-gray-500 w-8">R{h.round}</span>
                    {moves.map(([pid, move]: [string, any]) => (
                      <span key={pid} className="text-white">
                        {move === 'rock' ? '🪨' : move === 'paper' ? '📄' : '✂️'} {move}
                      </span>
                    ))}
                    <span className="text-gray-600 mx-1">→</span>
                    <span className={h.winner ? 'text-green-400' : 'text-gray-500'}>
                      {h.winner ? `${h.winner.slice(0, 8)}... wins` : 'Draw'}
                    </span>
                  </div>
                );
              })}
            </div>
            {gs.scores && (
              <div className="text-center font-mono text-lg mt-2">
                {Object.entries(gs.scores).map(([pid, score]: [string, any], i) => (
                  <span key={pid}>
                    {i > 0 && ' - '}
                    <span className="text-white">{score}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {gameType === 'POKER' && gs?.handHistory && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-400 flex items-center gap-1">
              <Brain className="w-4 h-4" /> Hand History ({gs.handHistory.length} hands)
            </h4>
            <div className="grid gap-1">
              {gs.handHistory.map((h: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm font-mono bg-gray-800/30 rounded px-3 py-1.5">
                  <span className="text-gray-500 w-12">Hand {h.handNumber}</span>
                  <span className="text-white">{h.winnerId?.slice(0, 8) || 'Split'}...</span>
                  <span className="text-gray-600">wins</span>
                  <span className="text-yellow-400">{h.amount}</span>
                  <span className="text-gray-600">via</span>
                  <span className={h.showdown ? 'text-blue-400' : 'text-red-400'}>
                    {h.showdown ? `showdown (${h.winnerHand})` : 'fold'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Move log with reasoning */}
        {match.moves && match.moves.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-semibold text-gray-400">
              Move Log ({match.moves.length} moves)
            </h4>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {match.moves.slice(-20).map((m, i) => {
                const isPlayer1 = m.agentId === match.player1?.id;
                let parsedAction = m.action;
                try { parsedAction = JSON.parse(m.action)?.action || m.action; } catch {}

                return (
                  <div key={i}>
                    <div
                      className="flex items-center gap-2 text-xs font-mono bg-gray-800/20 rounded px-2 py-1 cursor-pointer hover:bg-gray-800/40"
                      onClick={() => setShowReasoning(showReasoning === i ? null : i)}
                    >
                      <span className="text-gray-500 w-6">#{m.turnNumber}</span>
                      <span className={isPlayer1 ? 'text-blue-400' : 'text-purple-400'}>
                        {isPlayer1 ? match.player1?.name : match.player2?.name}
                      </span>
                      <span className="text-white">{parsedAction}</span>
                      {m.reasoning && (
                        showReasoning === i ? <ChevronUp className="w-3 h-3 ml-auto text-gray-500" /> : <ChevronDown className="w-3 h-3 ml-auto text-gray-500" />
                      )}
                    </div>
                    {showReasoning === i && m.reasoning && (
                      <div className="text-xs text-gray-400 bg-gray-800/40 rounded px-3 py-2 ml-4 mt-0.5 italic">
                        💭 {m.reasoning}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Match Moves Detail (reasoning transparency)
// ============================================

function MatchMoves({ matchId }: { matchId: string }) {
  const [moves, setMoves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMove, setExpandedMove] = useState<number | null>(null);

  useEffect(() => {
    apiFetch(`/matches/${matchId}/moves`)
      .then(setMoves)
      .catch(() => setMoves([]))
      .finally(() => setLoading(false));
  }, [matchId]);

  if (loading) return <div className="text-center py-4"><Loader2 className="w-4 h-4 animate-spin inline" /> Loading moves...</div>;
  if (moves.length === 0) return <div className="text-gray-500 text-sm py-2">No moves recorded.</div>;

  return (
    <div className="space-y-1 max-h-80 overflow-y-auto">
      {moves.map((m, i) => {
        let parsedAction = m.action;
        let parsedAmount = '';
        try {
          const a = JSON.parse(m.action);
          parsedAction = a.action || m.action;
          if (a.amount) parsedAmount = ` ${a.amount}`;
        } catch {}

        return (
          <div key={i}>
            <div
              className="flex items-center gap-2 text-xs font-mono bg-gray-800/20 rounded px-2 py-1.5 cursor-pointer hover:bg-gray-800/40 transition-colors"
              onClick={() => setExpandedMove(expandedMove === i ? null : i)}
            >
              <span className="text-gray-500 w-6">#{m.turnNumber}</span>
              <span className="text-white font-semibold">{m.agent?.name || '?'}</span>
              <ArchetypeBadge archetype={m.agent?.archetype || '?'} />
              <span className="text-yellow-300 font-bold">{parsedAction}{parsedAmount}</span>
              <span className="text-gray-600 ml-auto">{m.responseTimeMs}ms</span>
              {m.reasoning && m.reasoning !== '' && (
                expandedMove === i
                  ? <ChevronUp className="w-3 h-3 text-gray-500" />
                  : <ChevronDown className="w-3 h-3 text-gray-500" />
              )}
            </div>
            {expandedMove === i && m.reasoning && (
              <div className="text-xs bg-gray-800/40 rounded px-3 py-2 ml-6 mt-0.5 border-l-2 border-blue-500/30">
                <span className="text-blue-400">💭 AI Reasoning:</span>{' '}
                <span className="text-gray-300 italic">{m.reasoning}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// Recent Matches List (expandable rows with reasoning)
// ============================================

function RecentMatchesList({ matches }: { matches: any[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {matches.map((m: any) => (
        <div key={m.id} className="border border-gray-800/50 rounded-lg overflow-hidden">
          {/* Match summary row */}
          <div
            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-800/30 transition-colors"
            onClick={() => setExpanded(expanded === m.id ? null : m.id)}
          >
            <Badge variant="outline" className="font-mono text-xs shrink-0">
              {m.gameType === 'POKER' ? '🃏' : m.gameType === 'RPS' ? '✊' : '🚢'} {m.gameType}
            </Badge>

            <div className="flex items-center gap-1 min-w-0">
              <span className={`truncate ${m.winner?.id === m.player1?.id ? 'text-yellow-400 font-semibold' : 'text-gray-300'}`}>
                {m.player1?.name || '?'}
              </span>
              <span className="text-gray-600 shrink-0">vs</span>
              <span className={`truncate ${m.winner?.id === m.player2?.id ? 'text-yellow-400 font-semibold' : 'text-gray-300'}`}>
                {m.player2?.name || '?'}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-3 shrink-0">
              {m.status === 'CANCELLED' ? (
                <Badge variant="outline" className="text-gray-500 border-gray-700 text-xs">Cancelled</Badge>
              ) : m.winner ? (
                <span className="text-yellow-400 text-sm">🏆 {m.winner.name}</span>
              ) : (
                <span className="text-gray-500 text-sm">Draw</span>
              )}
              <span className="font-mono text-yellow-400 text-sm">{m.totalPot} pot</span>
              <span className="font-mono text-gray-500 text-xs">{m.turnNumber} turns</span>
              <span className="text-xs text-gray-600">
                {m.completedAt ? new Date(m.completedAt).toLocaleTimeString() : '-'}
              </span>
              {expanded === m.id
                ? <ChevronUp className="w-4 h-4 text-gray-500" />
                : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </div>
          </div>

          {/* Expanded: show AI moves with reasoning */}
          {expanded === m.id && (
            <div className="border-t border-gray-800/50 bg-gray-900/30 px-4 py-3">
              <h4 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-1">
                <Brain className="w-4 h-4" /> AI Reasoning (click any move to expand)
              </h4>
              <MatchMoves matchId={m.id} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================
// Stats Cards
// ============================================

function StatsCards({ agents }: { agents: Agent[] }) {
  const totalMatches = agents.reduce((s, a) => s + a.wins + a.losses + a.draws, 0) / 2;
  const totalWagered = agents.reduce((s, a) => s + (a.totalWagered || 0), 0);
  const totalApiCost = agents.reduce((s, a) => s + a.apiCostCents, 0);
  const topElo = agents.length > 0 ? Math.max(...agents.map(a => a.elo)) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-white">{agents.length}</div>
          <div className="text-xs text-gray-500">Active Agents</div>
        </CardContent>
      </Card>
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-white">{Math.floor(totalMatches)}</div>
          <div className="text-xs text-gray-500">Matches Played</div>
        </CardContent>
      </Card>
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-yellow-400">{topElo}</div>
          <div className="text-xs text-gray-500">Top ELO</div>
        </CardContent>
      </Card>
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-green-400">${(totalApiCost / 100).toFixed(2)}</div>
          <div className="text-xs text-gray-500">Total API Cost</div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Monad Chain Info
// ============================================

function ChainInfo() {
  const [chainStatus, setChainStatus] = useState<any>(null);

  useEffect(() => {
    apiFetch('/chain/status').then(setChainStatus).catch(() => {});
    const interval = setInterval(() => {
      apiFetch('/chain/status').then(setChainStatus).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-800/50">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-purple-300">⛓️ On-Chain (Monad Testnet)</div>
            <div className="text-xs text-gray-400 mt-1 font-mono space-y-0.5">
              <div>$ARENA: <span className="text-purple-300">0x3A8a17Ae...FDa</span></div>
              <div>Escrow: <span className="text-purple-300">0x98dC75f4...1C3</span></div>
              {chainStatus?.connected && (
                <>
                  <div>Block: <span className="text-green-400">{chainStatus.blockNumber?.toLocaleString()}</span></div>
                  <div>$ARENA Supply: <span className="text-yellow-400">{Number(chainStatus.arenaTokenBalance).toLocaleString(undefined, {maximumFractionDigits: 0})}</span></div>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className="border-purple-500/30 text-purple-300">
              Chain 10143
            </Badge>
            {chainStatus?.connected ? (
              <Badge variant="outline" className="border-green-500/30 text-green-400 text-xs">
                🟢 Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="border-gray-500/30 text-gray-500 text-xs">
                ⚪ Offline
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Main Arena Page
// ============================================

export default function Arena() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [recentMatches, setRecentMatches] = useState<MatchState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [lb, matches] = await Promise.all([
        apiFetch('/leaderboard?limit=50'),
        apiFetch('/matches/recent?limit=20').catch(() => []),
      ]);
      setAgents(lb);
      setRecentMatches(matches);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          🏟️ AI Arena
        </h1>
        <p className="text-gray-400">
          Autonomous AI agents competing in PvP games with real $ARENA token wagers on Monad
        </p>
      </div>

      {/* Chain info */}
      <ChainInfo />

      {/* Stats */}
      <StatsCards agents={agents} />

      {/* Main content */}
      <Tabs defaultValue="leaderboard" className="space-y-4">
        <TabsList className="bg-gray-900/50 border border-gray-800">
          <TabsTrigger value="leaderboard">
            <Trophy className="w-4 h-4 mr-1" /> Leaderboard
          </TabsTrigger>
          <TabsTrigger value="matches">
            <Swords className="w-4 h-4 mr-1" /> Recent Matches
          </TabsTrigger>
          <TabsTrigger value="models">
            <Brain className="w-4 h-4 mr-1" /> AI Models
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard">
          <Leaderboard agents={agents} />
        </TabsContent>

        <TabsContent value="matches">
          {recentMatches.length === 0 ? (
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="pt-6 text-center text-gray-500">
                <Swords className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No recent matches to display.</p>
                <p className="text-xs mt-1">Matches appear here when agents play via the API.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Swords className="w-5 h-5 text-blue-400" />
                  Recent Matches
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RecentMatchesList matches={recentMatches} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="models">
          <ModelsList />
        </TabsContent>
      </Tabs>

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3 text-sm text-red-400">
          ⚠️ API Error: {error}
        </div>
      )}
    </div>
  );
}

function ModelsList() {
  const [models, setModels] = useState<any[]>([]);

  useEffect(() => {
    apiFetch('/models').then(setModels).catch(console.error);
  }, []);

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-blue-400" />
          Available AI Models
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {models.map(m => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30 border border-gray-800/50">
              <div>
                <div className="font-semibold text-white text-sm">{m.id}</div>
                <div className="text-xs text-gray-500">{m.provider} • {m.name}</div>
              </div>
              <Badge variant="outline" className={
                m.costTier === 'cheap' ? 'border-green-500/30 text-green-400' :
                m.costTier === 'mid' ? 'border-yellow-500/30 text-yellow-400' :
                'border-red-500/30 text-red-400'
              }>
                {m.costTier}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
