/**
 * WheelArena — Full-screen spectator overlay for Wheel of Fate PvP.
 *
 * Lifecycle:
 *   1. ANNOUNCING → Wormhole portal + WheelSpin → VS card with betting
 *   2. FIGHTING   → Game-specific arena (Poker table / RPS face-off)
 *   3. AFTERMATH  → Winner celebration + payout summary
 *
 * Design: Dark, neon-accented, dramatic. Short attention span = fast transitions,
 * big numbers, personality quips, no dead air.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { WheelSpinOverlay } from './WheelSpinOverlay';
import type { WheelStatus, WheelOdds, WheelMove } from '../../hooks/useWheelStatus';

// ============================================
// Constants
// ============================================

const ARCHETYPE_EMOJI: Record<string, string> = {
  SHARK: '🦈', DEGEN: '🎰', CHAMELEON: '🦎', GRINDER: '⚙️', VISIONARY: '🔮',
};

const ARCHETYPE_COLOR: Record<string, string> = {
  SHARK: '#ef4444', DEGEN: '#fbbf24', CHAMELEON: '#34d399', GRINDER: '#818cf8', VISIONARY: '#c084fc',
};

const GAME_BG: Record<string, string> = {
  POKER: 'from-green-950/95 via-slate-950/98 to-green-950/95',
  RPS: 'from-red-950/95 via-slate-950/98 to-red-950/95',
};

const QUICK_BETS = [50, 100, 250, 500];

const RPS_EMOJI: Record<string, string> = { rock: '🪨', paper: '📄', scissors: '✂️' };
const RPS_WINS: Record<string, string> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

const POKER_ACTION_EMOJI: Record<string, string> = {
  fold: '🏳️', check: '✅', call: '📞', raise: '⬆️', bet: '💰', 'all-in': '🔥',
};

// ============================================
// Types
// ============================================

interface WheelArenaProps {
  status: WheelStatus;
  odds: WheelOdds | null;
  walletAddress: string | null;
  onBet: (wallet: string, side: 'A' | 'B', amount: number) => Promise<any>;
  loading?: boolean;
  onClose?: () => void;
}

// ============================================
// Component
// ============================================

export function WheelArena({ status, odds, walletAddress, onBet, loading, onClose }: WheelArenaProps) {
  const [showSpin, setShowSpin] = useState(false);
  const [spinDone, setSpinDone] = useState(false);
  const [betAmount, setBetAmount] = useState(100);
  const [betting, setBetting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [visibleMoves, setVisibleMoves] = useState<WheelMove[]>([]);
  const [showResult, setShowResult] = useState(false);

  const match = status.currentMatch;
  const result = status.lastResult;
  const phase = status.phase;

  // ---- Spin overlay on ANNOUNCING ----
  useEffect(() => {
    if (phase === 'ANNOUNCING' && match && !spinDone) {
      setShowSpin(true);
      setVisibleMoves([]);
      setShowResult(false);
    }
  }, [phase, match, spinDone]);

  // Reset spinDone when a new cycle starts
  useEffect(() => {
    if (phase === 'PREP' || phase === 'IDLE') {
      setSpinDone(false);
      setShowSpin(false);
      setVisibleMoves([]);
      setShowResult(false);
    }
  }, [phase]);

  // ---- Countdown timer ----
  useEffect(() => {
    if (phase !== 'ANNOUNCING' || !status.bettingEndsIn) { setCountdown(0); return; }
    setCountdown(Math.ceil(status.bettingEndsIn / 1000));
    const t = setInterval(() => setCountdown(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(t);
  }, [phase, status.bettingEndsIn]);

  // ---- Update moves during FIGHTING from live currentMoves ----
  useEffect(() => {
    if (phase !== 'FIGHTING') return;
    const liveMoves = status.currentMoves || [];
    if (liveMoves.length > visibleMoves.length) {
      setVisibleMoves(liveMoves);
    }
  }, [phase, status.currentMoves?.length]);

  // ---- Show result ----
  useEffect(() => {
    if (phase === 'AFTERMATH') {
      setTimeout(() => setShowResult(true), 500);
    }
  }, [phase]);

  // ---- Toast dismiss ----
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleBet = useCallback(async (side: 'A' | 'B') => {
    if (!walletAddress || betAmount <= 0 || betting) return;
    setBetting(true);
    try {
      await onBet(walletAddress, side, betAmount);
      const name = side === 'A' ? match?.agent1.name : match?.agent2.name;
      setToast(`✅ Bet ${betAmount} $ARENA on ${name}!`);
    } catch (e: any) {
      setToast(`❌ ${e.message}`);
    } finally {
      setBetting(false);
    }
  }, [walletAddress, betAmount, betting, onBet, match]);

  const handleSpinComplete = useCallback(() => {
    setShowSpin(false);
    setSpinDone(true);
  }, []);

  // Don't render if no active match phase
  if (phase === 'PREP' || phase === 'IDLE') return null;

  // ---- Wheel Spin Overlay ----
  if (showSpin && match) {
    return <WheelSpinOverlay selectedGame={match.gameType} onComplete={handleSpinComplete} />;
  }

  const gameType = match?.gameType || result?.gameType || 'RPS';
  const a1 = match?.agent1 || (result ? { id: result.winnerId || '', name: result.winnerName, archetype: 'SHARK', bankroll: 0, elo: 0 } : null);
  const a2 = match?.agent2 || (result ? { id: result.loserId || '', name: result.loserName, archetype: 'CHAMELEON', bankroll: 0, elo: 0 } : null);
  if (!a1 || !a2) return null;

  const poolA = odds?.odds?.poolA ?? 0;
  const poolB = odds?.odds?.poolB ?? 0;
  const total = poolA + poolB;
  const pctA = total > 0 ? Math.round((poolA / total) * 100) : 50;
  const pctB = total > 0 ? Math.round((poolB / total) * 100) : 50;

  return (
    <div className={`fixed inset-0 z-[150] flex flex-col bg-gradient-to-b ${GAME_BG[gameType] || 'from-slate-950 to-slate-950'}`}>
      {/* Ambient effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-white/5 z-10">
        <div className="flex items-center gap-3">
          <span className="text-lg">
            {phase === 'ANNOUNCING' ? '🎡' : phase === 'FIGHTING' ? '⚔️' : '🏆'}
          </span>
          <span className="text-sm font-bold text-white/90">WHEEL OF FATE</span>
          <span className="text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded-full">
            {gameType === 'POKER' ? '🃏 Poker' : '✊ Rock Paper Scissors'}
          </span>
          {phase === 'ANNOUNCING' && (
            <span className={`text-sm font-mono font-bold ${countdown <= 10 ? 'text-red-400 animate-pulse' : 'text-amber-300'}`}>
              ⏱️ {countdown}s
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {total > 0 && (
            <span className="text-xs text-purple-300/60">🎰 {total.toLocaleString()} $ARENA bet</span>
          )}
          {onClose && (
            <button onClick={onClose} className="text-white/30 hover:text-white/60 text-lg transition-colors">✕</button>
          )}
        </div>
      </div>

      {/* Main arena area */}
      <div className="flex-1 flex flex-col items-center justify-center relative min-h-0 px-4">
        
        {/* ===== ANNOUNCING: VS Card + Betting ===== */}
        {phase === 'ANNOUNCING' && (
          <div className="flex flex-col items-center gap-6 w-full max-w-lg animate-in fade-in duration-500">
            {/* Wormhole portal effect */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-80 h-80 rounded-full border border-purple-500/20 animate-spin" style={{ animationDuration: '8s' }} />
              <div className="absolute w-60 h-60 rounded-full border border-purple-400/15 animate-spin" style={{ animationDuration: '6s', animationDirection: 'reverse' }} />
              <div className="absolute w-40 h-40 rounded-full border border-purple-300/10 animate-spin" style={{ animationDuration: '4s' }} />
            </div>

            {/* VS Card */}
            <div className="flex items-center gap-4 z-10">
              {/* Agent 1 */}
              <div className="text-center space-y-2">
                <div className="text-5xl">{ARCHETYPE_EMOJI[a1.archetype] || '🤖'}</div>
                <div className="text-lg font-bold" style={{ color: ARCHETYPE_COLOR[a1.archetype] || '#fff' }}>{a1.name}</div>
                <div className="text-xs text-white/40">{a1.archetype} · ELO {a1.elo}</div>
                <div className="text-xs text-white/30">💰 {a1.bankroll} $ARENA</div>
                {match?.buffs?.agent1?.length ? (
                  <div className="flex gap-1 justify-center flex-wrap">
                    {match.buffs.agent1.map((b, i) => (
                      <span key={i} className="text-[9px] bg-white/5 text-white/40 px-1.5 py-0.5 rounded" title={b.description}>
                        {b.type}×{b.count}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* VS */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-3xl font-black text-white/20 animate-pulse">VS</span>
                <div className="text-xs text-amber-300/80">pot</div>
                <div className="text-2xl font-mono font-black text-amber-300">{(match?.wager || 0) * 2}</div>
              </div>

              {/* Agent 2 */}
              <div className="text-center space-y-2">
                <div className="text-5xl">{ARCHETYPE_EMOJI[a2.archetype] || '🤖'}</div>
                <div className="text-lg font-bold" style={{ color: ARCHETYPE_COLOR[a2.archetype] || '#fff' }}>{a2.name}</div>
                <div className="text-xs text-white/40">{a2.archetype} · ELO {a2.elo}</div>
                <div className="text-xs text-white/30">💰 {a2.bankroll} $ARENA</div>
                {match?.buffs?.agent2?.length ? (
                  <div className="flex gap-1 justify-center flex-wrap">
                    {match.buffs.agent2.map((b, i) => (
                      <span key={i} className="text-[9px] bg-white/5 text-white/40 px-1.5 py-0.5 rounded" title={b.description}>
                        {b.type}×{b.count}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Odds bar */}
            <div className="w-full max-w-sm z-10">
              <div className="h-2 rounded-full overflow-hidden flex bg-white/5">
                <div className="bg-emerald-500/70 transition-all duration-700" style={{ width: `${pctA}%` }} />
                <div className="bg-red-500/70 transition-all duration-700" style={{ width: `${pctB}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-white/30 font-mono">
                <span>{pctA}%</span>
                <span>{pctB}%</span>
              </div>
            </div>

            {/* Betting buttons */}
            <div className="flex gap-3 z-10 w-full max-w-sm">
              <button
                onClick={() => handleBet('A')}
                disabled={!walletAddress || betting || loading || countdown <= 0}
                className="flex-1 py-3 rounded-xl bg-emerald-900/40 hover:bg-emerald-800/50 border border-emerald-700/30 text-emerald-200 font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Bet {a1.name}
              </button>
              <button
                onClick={() => handleBet('B')}
                disabled={!walletAddress || betting || loading || countdown <= 0}
                className="flex-1 py-3 rounded-xl bg-red-900/40 hover:bg-red-800/50 border border-red-700/30 text-red-200 font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Bet {a2.name}
              </button>
            </div>

            {/* Quick bet amounts */}
            {walletAddress && (
              <div className="flex items-center gap-2 z-10">
                {QUICK_BETS.map(q => (
                  <button
                    key={q}
                    onClick={() => setBetAmount(q)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono border transition-all ${
                      betAmount === q
                        ? 'bg-purple-900/50 border-purple-500/50 text-purple-200'
                        : 'bg-white/5 border-white/10 text-white/30 hover:text-purple-300'
                    }`}
                  >
                    {q}
                  </button>
                ))}
                <input
                  type="number"
                  value={betAmount || ''}
                  onChange={e => setBetAmount(Math.max(0, Number(e.target.value)))}
                  className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs font-mono text-white/60 outline-none focus:border-purple-500/50"
                  placeholder="custom"
                  min={1}
                />
              </div>
            )}

            {!walletAddress && (
              <div className="text-xs text-purple-400/40 z-10">Connect wallet to bet</div>
            )}
          </div>
        )}

        {/* ===== FIGHTING: Game Arena ===== */}
        {phase === 'FIGHTING' && (
          <div className="flex flex-col items-center gap-4 w-full max-w-2xl animate-in fade-in duration-300">
            {gameType === 'RPS' ? (
              <RPSArena agent1={a1} agent2={a2} moves={visibleMoves} />
            ) : (
              <PokerArena agent1={a1} agent2={a2} moves={visibleMoves} wager={match?.wager || 0} />
            )}
          </div>
        )}

        {/* ===== AFTERMATH: Winner ===== */}
        {phase === 'AFTERMATH' && result && showResult && (
          <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
            {/* Winner crown */}
            <div className="text-6xl animate-bounce" style={{ animationDuration: '2s' }}>👑</div>
            <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300">
              {result.winnerName} WINS!
            </div>
            
            {/* Winner quip */}
            {result.winnerQuip && (
              <div className="text-lg text-amber-200/80 italic font-medium">
                "{result.winnerQuip}"
              </div>
            )}

            <div className="text-sm text-white/40">
              {result.gameType === 'POKER' ? '🃏' : '✊'} {result.gameType} · {result.turns} turns · pot {result.pot} $ARENA
            </div>

            {/* Loser with quip */}
            <div className="text-center">
              <div className="text-white/20 text-sm">
                💀 {result.loserName} defeated
              </div>
              {result.loserQuip && (
                <div className="text-xs text-white/15 italic mt-1">
                  "{result.loserQuip}"
                </div>
              )}
            </div>

            {/* Betting payouts */}
            {result.bettingPool.totalBets > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-3 text-center">
                <div className="text-xs text-purple-300/60 mb-1">Spectator Bets</div>
                <div className="text-lg font-mono font-bold text-purple-200">{result.bettingPool.totalBets.toLocaleString()} $ARENA</div>
                <div className="text-[10px] text-white/20 mt-1">
                  {result.winnerName}: {result.winnerId === a1?.id ? result.bettingPool.poolA : result.bettingPool.poolB} · 
                  {result.loserName}: {result.loserId === a1?.id ? result.bettingPool.poolA : result.bettingPool.poolB}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] px-4 py-2 bg-slate-800/90 border border-white/10 rounded-lg text-sm text-white/80 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

// ============================================
// RPS Arena Sub-component
// ============================================

interface AgentInfo {
  id: string;
  name: string;
  archetype: string;
  bankroll: number;
  elo: number;
}

function RPSArena({ agent1, agent2, moves }: { agent1: AgentInfo; agent2: AgentInfo; moves: WheelMove[] }) {
  // Parse RPS rounds from moves (pairs of moves)
  const rounds: { a1Move: string; a2Move: string; winner: string | null }[] = [];
  for (let i = 0; i < moves.length - 1; i += 2) {
    const m1 = moves[i];
    const m2 = moves[i + 1];
    if (!m1 || !m2) break;
    
    const a1Move = m1.agentId === agent1.id ? m1.action : m2.action;
    const a2Move = m1.agentId === agent2.id ? m1.action : m2.action;
    
    let winner: string | null = null;
    if (a1Move !== a2Move) {
      winner = RPS_WINS[a1Move] === a2Move ? agent1.id : agent2.id;
    }
    rounds.push({ a1Move, a2Move, winner });
  }

  const a1Score = rounds.filter(r => r.winner === agent1.id).length;
  const a2Score = rounds.filter(r => r.winner === agent2.id).length;
  const currentRound = rounds.length;
  const latestRound = rounds[rounds.length - 1];

  // If we have an odd number of moves, the latest is a pending move
  const pendingMove = moves.length % 2 === 1 ? moves[moves.length - 1] : null;

  return (
    <div className="w-full space-y-6">
      {/* Score */}
      <div className="flex items-center justify-center gap-6">
        <div className="text-center">
          <div className="text-2xl">{ARCHETYPE_EMOJI[agent1.archetype]}</div>
          <div className="text-sm font-bold" style={{ color: ARCHETYPE_COLOR[agent1.archetype] }}>{agent1.name}</div>
        </div>
        <div className="text-center">
          <div className="text-4xl font-mono font-black text-white/80">{a1Score} — {a2Score}</div>
          <div className="text-[10px] text-white/20 mt-1">Round {currentRound + 1} / 3</div>
        </div>
        <div className="text-center">
          <div className="text-2xl">{ARCHETYPE_EMOJI[agent2.archetype]}</div>
          <div className="text-sm font-bold" style={{ color: ARCHETYPE_COLOR[agent2.archetype] }}>{agent2.name}</div>
        </div>
      </div>

      {/* Current/Latest throw */}
      <div className="flex items-center justify-center gap-12">
        <div className={`text-7xl transition-all duration-500 ${
          latestRound?.winner === agent1.id ? 'scale-125' : latestRound?.winner === agent2.id ? 'scale-75 opacity-50' : ''
        }`}>
          {latestRound ? (RPS_EMOJI[latestRound.a1Move] || '❓') : (pendingMove?.agentId === agent1.id ? '🤔' : '❓')}
        </div>
        <div className="text-2xl text-white/10 font-black">VS</div>
        <div className={`text-7xl transition-all duration-500 ${
          latestRound?.winner === agent2.id ? 'scale-125' : latestRound?.winner === agent1.id ? 'scale-75 opacity-50' : ''
        }`}>
          {latestRound ? (RPS_EMOJI[latestRound.a2Move] || '❓') : (pendingMove?.agentId === agent2.id ? '🤔' : '❓')}
        </div>
      </div>

      {/* Round result */}
      {latestRound && (
        <div className="text-center text-sm text-white/40">
          {latestRound.winner === null ? '🤝 Draw!' : 
           latestRound.winner === agent1.id ? `${agent1.name} takes the round!` :
           `${agent2.name} takes the round!`}
        </div>
      )}

      {/* Round history */}
      {rounds.length > 0 && (
        <div className="flex items-center justify-center gap-3">
          {rounds.map((r, i) => (
            <div key={i} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs border ${
              r.winner === agent1.id ? 'border-emerald-700/30 bg-emerald-950/30 text-emerald-300' :
              r.winner === agent2.id ? 'border-red-700/30 bg-red-950/30 text-red-300' :
              'border-white/10 bg-white/5 text-white/30'
            }`}>
              <span>R{i + 1}:</span>
              <span>{RPS_EMOJI[r.a1Move]}</span>
              <span className="text-white/10">vs</span>
              <span>{RPS_EMOJI[r.a2Move]}</span>
            </div>
          ))}
        </div>
      )}

      {/* Agent quip from latest move */}
      {(pendingMove || moves[moves.length - 1]) && (() => {
        const m = pendingMove || moves[moves.length - 1];
        const quipText = m.quip || m.reasoning;
        return (
          <div className="max-w-md mx-auto bg-white/5 border border-white/5 rounded-lg px-3 py-2">
            <div className="text-[10px] text-white/20 mb-1">
              {m.agentName}:
            </div>
            <div className="text-sm text-white/70 italic font-medium">
              "{quipText}"
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ============================================
// Poker Arena Sub-component
// ============================================

function PokerArena({ agent1, agent2, moves, wager }: { agent1: AgentInfo; agent2: AgentInfo; moves: WheelMove[]; wager: number }) {
  const latestMove = moves[moves.length - 1];
  const a1Moves = moves.filter(m => m.agentId === agent1.id);
  const a2Moves = moves.filter(m => m.agentId === agent2.id);

  return (
    <div className="w-full space-y-4">
      {/* Poker table */}
      <div className="relative bg-green-900/20 border border-green-800/20 rounded-3xl px-8 py-10 max-w-lg mx-auto">
        {/* Center pot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="text-xs text-green-300/40">POT</div>
          <div className="text-3xl font-mono font-black text-amber-300">{wager * 2}</div>
          <div className="text-[10px] text-green-300/30">$ARENA</div>
        </div>

        {/* Agent 1 (top) */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <div className="text-3xl">{ARCHETYPE_EMOJI[agent1.archetype]}</div>
          <div>
            <div className="text-sm font-bold" style={{ color: ARCHETYPE_COLOR[agent1.archetype] }}>{agent1.name}</div>
            <div className="text-[10px] text-white/30">{a1Moves.length} actions</div>
          </div>
          {a1Moves.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-lg px-2 py-1">
              <span className="text-xs">
                {POKER_ACTION_EMOJI[a1Moves[a1Moves.length - 1].action] || '❓'} {a1Moves[a1Moves.length - 1].action}
                {a1Moves[a1Moves.length - 1].amount ? ` $${a1Moves[a1Moves.length - 1].amount}` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Decorative cards */}
        <div className="flex justify-center gap-2 mb-12">
          {[1,2,3].map(i => (
            <div key={i} className="w-10 h-14 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-lg text-white/10">
              🂠
            </div>
          ))}
        </div>

        {/* Agent 2 (bottom) */}
        <div className="flex items-center justify-center gap-3">
          <div className="text-3xl">{ARCHETYPE_EMOJI[agent2.archetype]}</div>
          <div>
            <div className="text-sm font-bold" style={{ color: ARCHETYPE_COLOR[agent2.archetype] }}>{agent2.name}</div>
            <div className="text-[10px] text-white/30">{a2Moves.length} actions</div>
          </div>
          {a2Moves.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-lg px-2 py-1">
              <span className="text-xs">
                {POKER_ACTION_EMOJI[a2Moves[a2Moves.length - 1].action] || '❓'} {a2Moves[a2Moves.length - 1].action}
                {a2Moves[a2Moves.length - 1].amount ? ` $${a2Moves[a2Moves.length - 1].amount}` : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action feed */}
      <div className="max-w-lg mx-auto max-h-40 overflow-y-auto space-y-1 px-2">
        {moves.slice(-8).map((move, i) => (
          <div key={i} className={`flex items-center gap-2 text-xs py-1 px-2 rounded transition-all ${
            i === moves.slice(-8).length - 1 ? 'bg-white/5' : ''
          }`}>
            <span className="text-white/20 font-mono w-5 text-right">#{move.turn}</span>
            <span className="font-semibold shrink-0" style={{ 
              color: move.agentId === agent1.id ? (ARCHETYPE_COLOR[agent1.archetype] || '#fff') : (ARCHETYPE_COLOR[agent2.archetype] || '#fff')
            }}>
              {move.agentName}
            </span>
            <span className="text-amber-300 font-mono shrink-0">
              {POKER_ACTION_EMOJI[move.action] || ''} {move.action}{move.amount ? ` $${move.amount}` : ''}
            </span>
            <span className="text-white/20 truncate italic text-[10px]">{move.quip || move.reasoning}</span>
          </div>
        ))}
      </div>

      {/* Latest quip highlight */}
      {latestMove && (
        <div className="max-w-lg mx-auto bg-white/5 border border-white/5 rounded-lg px-3 py-2">
          <div className="text-[10px] text-white/20 mb-1">{latestMove.agentName}:</div>
          <div className="text-sm text-white/70 italic font-medium">"{latestMove.quip || latestMove.reasoning}"</div>
        </div>
      )}
    </div>
  );
}
