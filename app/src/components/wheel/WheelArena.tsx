/**
 * WheelArena — Full-screen spectator overlay for Wheel of Fate PvP.
 *
 * Lifecycle:
 *   1. ANNOUNCING → Wormhole portal + WheelSpin → VS card with betting
 *   2. FIGHTING   → Poker arena with live moves
 *   3. AFTERMATH  → Winner celebration + payout summary
 *
 * Design: Dark, neon-accented, dramatic. Short attention span = fast transitions,
 * big numbers, personality quips, no dead air.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { WheelSpinOverlay } from './WheelSpinOverlay';
import type { WheelStatus, WheelOdds, WheelMove, GameSnapshot } from '../../hooks/useWheelStatus';
import { playSound } from '../../utils/sounds';

// Simple hook to fetch betting stats for current wallet
function useBettingStats(wallet: string | null) {
  const [stats, setStats] = useState<{ netPnL: number; wins: number; losses: number; hitRate: number; balance?: number } | null>(null);
  useEffect(() => {
    if (!wallet) return;
    fetch(`/api/v1/wheel/my-stats?wallet=${wallet}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data); })
      .catch(() => {});
  }, [wallet]);
  return stats;
}

// Hook to fetch leaderboard
function useLeaderboard() {
  const [lb, setLb] = useState<{ wallet: string; netProfit: number; bets: number }[]>([]);
  useEffect(() => {
    fetch('/api/v1/wheel/leaderboard')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setLb(data); })
      .catch(() => {});
  }, []);
  return lb;
}

// Hook to fetch personal bet result during AFTERMATH
function useMyBetResult(wallet: string | null, phase: string | undefined) {
  const [result, setResult] = useState<{ side: string; amount: number; payout: number; netProfit: number; won: boolean } | null>(null);
  useEffect(() => {
    if (!wallet || phase !== 'AFTERMATH') { setResult(null); return; }
    fetch(`/api/v1/wheel/status?wallet=${wallet}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.myBetResult) setResult(data.myBetResult); })
      .catch(() => {});
  }, [wallet, phase]);
  return result;
}

// ============================================
// Constants
// ============================================

const ARCHETYPE_EMOJI: Record<string, string> = {
  SHARK: '🦈', DEGEN: '🎰', CHAMELEON: '🦎', GRINDER: '⚙️', VISIONARY: '🔮',
};

const ARCHETYPE_COLOR: Record<string, string> = {
  SHARK: '#ef4444', DEGEN: '#fbbf24', CHAMELEON: '#34d399', GRINDER: '#818cf8', VISIONARY: '#c084fc',
};

const ARCHETYPE_STYLE: Record<string, { aggression: number; foldRate: number; bluffFreq: string }> = {
  SHARK: { aggression: 85, foldRate: 12, bluffFreq: 'High' },
  ROCK: { aggression: 25, foldRate: 45, bluffFreq: 'Low' },
  CHAMELEON: { aggression: 55, foldRate: 28, bluffFreq: 'Variable' },
  DEGEN: { aggression: 90, foldRate: 8, bluffFreq: 'Very High' },
  GRINDER: { aggression: 50, foldRate: 30, bluffFreq: 'Optimal' },
};

const GAME_BG: Record<string, string> = {
  POKER: 'from-green-950/95 via-slate-950/98 to-green-950/95',
};

const QUICK_BETS = [50, 100, 250, 500];

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
  const [pendingBet, setPendingBet] = useState<{ side: 'A' | 'B' } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [visibleMoves, setVisibleMoves] = useState<WheelMove[]>([]);
  const [showResult, setShowResult] = useState(false);
  const bettingStats = useBettingStats(walletAddress);
  const myBetResult = useMyBetResult(walletAddress, status.phase);
  const leaderboard = useLeaderboard();
  const prevPhaseRef = useRef(status.phase);
  const prevMoveCountRef = useRef(0);

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

  // ---- Show result + sounds on phase transitions ----
  useEffect(() => {
    if (phase === 'AFTERMATH') {
      setTimeout(() => setShowResult(true), 500);
    }
    // Play sounds on phase transitions
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (phase === 'AFTERMATH' && prev !== 'AFTERMATH') {
      // Aftermath sound is triggered after myBetResult loads (see below)
      playSound('kaChing');
    }
  }, [phase]);

  // Play personal bet result sound
  useEffect(() => {
    if (myBetResult) {
      if (myBetResult.won) playSound('bigWin');
      else playSound('womp');
    }
  }, [myBetResult]);

  // Play sound on new moves (all-in detection)
  useEffect(() => {
    const moves = status.currentMoves || [];
    if (moves.length > prevMoveCountRef.current && moves.length > 0) {
      const latest = moves[moves.length - 1];
      if (latest.action === 'all-in') {
        playSound('allIn');
      } else {
        playSound('cardFlip');
      }
    }
    prevMoveCountRef.current = moves.length;
  }, [status.currentMoves?.length]);

  // ---- Toast dismiss ----
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleBetClick = useCallback((side: 'A' | 'B') => {
    if (!walletAddress || betAmount <= 0 || betting) return;
    setPendingBet({ side });
  }, [walletAddress, betAmount, betting]);

  const confirmBet = useCallback(async () => {
    if (!pendingBet || !walletAddress || betting) return;
    setBetting(true);
    setPendingBet(null);
    try {
      await onBet(walletAddress, pendingBet.side, betAmount);
      playSound('stake');
      const name = pendingBet.side === 'A' ? match?.agent1.name : match?.agent2.name;
      setToast(`Bet ${betAmount} $ARENA on ${name}!`);
    } catch (e: any) {
      playSound('error');
      setToast(`${e.message}`);
    } finally {
      setBetting(false);
    }
  }, [pendingBet, walletAddress, betting, onBet, betAmount, match]);

  const cancelBet = useCallback(() => { setPendingBet(null); }, []);

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

  const gameType = match?.gameType || result?.gameType || 'POKER';
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
            🃏 Poker
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
                {match?.h2h && (match.h2h.agent1Wins > 0 || match.h2h.agent2Wins > 0) && (
                  <div className="text-[10px] font-mono text-white/40">
                    H2H: <span className="text-emerald-400">{match.h2h.agent1Wins}</span>-<span className="text-red-400">{match.h2h.agent2Wins}</span>
                    {match.h2h.draws > 0 && <span className="text-white/25">-{match.h2h.draws}</span>}
                  </div>
                )}
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

            {/* Play style meters — real stats from last 10 matches, fallback to archetype defaults */}
            <div className="flex gap-6 z-10 text-[10px]">
              {[a1, a2].map((a, idx) => {
                const realStats = idx === 0 ? match?.agent1Stats : match?.agent2Stats;
                const fallback = ARCHETYPE_STYLE[a.archetype];
                const agg = realStats?.aggression ?? fallback?.aggression ?? 50;
                const fold = realStats?.foldRate ?? fallback?.foldRate ?? 20;
                const isReal = !!realStats;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="text-white/25 text-center">
                      {a.name}
                      {isReal && <span className="text-white/10 ml-1">({realStats.matchesAnalyzed}g)</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-white/30 w-14">AGG</span>
                      <div className="w-16 h-1 rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-red-500/60" style={{ width: `${agg}%` }} />
                      </div>
                      <span className="text-white/20 w-6">{agg}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-white/30 w-14">Fold</span>
                      <div className="w-16 h-1 rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-blue-500/60" style={{ width: `${fold}%` }} />
                      </div>
                      <span className="text-white/20 w-6">{fold}%</span>
                    </div>
                  </div>
                );
              })}
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

            {/* Betting buttons + confirmation */}
            {pendingBet ? (
              <div className="flex flex-col items-center gap-2 z-10 w-full max-w-sm bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="text-sm text-white/70">
                  Bet <span className="font-mono font-bold text-amber-300">{betAmount}</span> $ARENA on{' '}
                  <span className="font-bold" style={{ color: pendingBet.side === 'A' ? '#6ee7b7' : '#fca5a5' }}>
                    {pendingBet.side === 'A' ? a1.name : a2.name}
                  </span>?
                </div>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={confirmBet}
                    disabled={betting}
                    className="flex-1 py-2 rounded-lg bg-emerald-800/60 hover:bg-emerald-700/60 border border-emerald-600/40 text-emerald-200 font-bold text-sm transition-all disabled:opacity-30"
                  >
                    {betting ? 'Placing...' : 'Confirm'}
                  </button>
                  <button
                    onClick={cancelBet}
                    className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 font-bold text-sm transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 z-10 w-full max-w-sm">
                <button
                  onClick={() => handleBetClick('A')}
                  disabled={!walletAddress || betting || loading || countdown <= 0}
                  className="flex-1 py-3 rounded-xl bg-emerald-900/40 hover:bg-emerald-800/50 border border-emerald-700/30 text-emerald-200 font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Bet {a1.name}
                </button>
                <button
                  onClick={() => handleBetClick('B')}
                  disabled={!walletAddress || betting || loading || countdown <= 0}
                  className="flex-1 py-3 rounded-xl bg-red-900/40 hover:bg-red-800/50 border border-red-700/30 text-red-200 font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Bet {a2.name}
                </button>
              </div>
            )}

            {/* Wallet balance + Quick bet amounts */}
            {walletAddress && bettingStats?.balance != null && (
              <div className="text-xs text-white/40 z-10 font-mono">
                Balance: <span className="text-amber-300 font-bold">{bettingStats.balance.toLocaleString()}</span> $ARENA
              </div>
            )}
            {walletAddress && (
              <div className="flex items-center gap-2 z-10">
                {QUICK_BETS.map(q => {
                  const overBalance = bettingStats?.balance != null && q > bettingStats.balance;
                  return (
                    <button
                      key={q}
                      onClick={() => setBetAmount(q)}
                      disabled={overBalance}
                      className={`px-3 py-1 rounded-lg text-xs font-mono border transition-all ${
                        overBalance
                          ? 'bg-white/3 border-white/5 text-white/15 cursor-not-allowed'
                          : betAmount === q
                            ? 'bg-purple-900/50 border-purple-500/50 text-purple-200'
                            : 'bg-white/5 border-white/10 text-white/30 hover:text-purple-300'
                      }`}
                    >
                      {q}
                    </button>
                  );
                })}
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

            {/* Betting stats P&L + crowd indicator */}
            {walletAddress && bettingStats && bettingStats.wins + bettingStats.losses > 0 && (
              <div className="flex items-center gap-3 z-10 text-[10px]">
                <span className={`font-mono font-bold ${bettingStats.netPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {bettingStats.netPnL >= 0 ? '+' : ''}{bettingStats.netPnL} $ARENA
                </span>
                <span className="text-white/30">
                  ({bettingStats.wins}W-{bettingStats.losses}L · {bettingStats.hitRate}%)
                </span>
              </div>
            )}
            {total > 0 && pctA !== pctB && (
              <div className="text-[10px] text-white/25 z-10">
                Favorite: {pctA > pctB ? a1.name : a2.name} ({Math.max(pctA, pctB)}%)
                {status.sessionStats?.crowdAccuracy !== null && status.sessionStats?.crowdAccuracy !== undefined && (
                  <span className="ml-2 text-white/15">Crowd accuracy: {status.sessionStats.crowdAccuracy}%</span>
                )}
              </div>
            )}

            {/* Pre-match trash talk */}
            {match?.trashTalk && (
              <div className="w-full max-w-sm z-10 space-y-1">
                {match.trashTalk.agent1 && (
                  <div className="bg-emerald-950/20 border border-emerald-800/20 rounded-lg px-3 py-1.5 text-xs">
                    <span className="font-bold" style={{ color: ARCHETYPE_COLOR[a1.archetype] }}>{a1.name}:</span>{' '}
                    <span className="text-white/60 italic">"{match.trashTalk.agent1}"</span>
                  </div>
                )}
                {match.trashTalk.agent2 && (
                  <div className="bg-red-950/20 border border-red-800/20 rounded-lg px-3 py-1.5 text-xs">
                    <span className="font-bold" style={{ color: ARCHETYPE_COLOR[a2.archetype] }}>{a2.name}:</span>{' '}
                    <span className="text-white/60 italic">"{match.trashTalk.agent2}"</span>
                  </div>
                )}
              </div>
            )}

            {/* Betting leaderboard */}
            {leaderboard.length > 0 && (
              <div className="w-full max-w-sm z-10 bg-white/3 border border-white/5 rounded-lg p-2">
                <div className="text-[10px] text-white/25 mb-1 font-bold">Top Bettors</div>
                {leaderboard.slice(0, 5).map((entry, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] py-0.5">
                    <span className="text-white/30">#{i + 1} {entry.wallet}</span>
                    <span className={`font-mono ${entry.netProfit >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
                      {entry.netProfit >= 0 ? '+' : ''}{entry.netProfit}
                    </span>
                    <span className="text-white/15">{entry.bets}b</span>
                  </div>
                ))}
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
            <PokerArena agent1={a1} agent2={a2} moves={visibleMoves} wager={match?.wager || 0} />
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

            {/* Personal bet result */}
            {myBetResult && (
              <div className={`rounded-xl px-6 py-4 text-center border ${
                myBetResult.won
                  ? 'bg-emerald-950/40 border-emerald-500/40 animate-pulse'
                  : 'bg-red-950/40 border-red-500/30'
              }`} style={myBetResult.won ? { animationDuration: '2s' } : {}}>
                <div className={`text-2xl font-mono font-black ${myBetResult.won ? 'text-emerald-300' : 'text-red-400'}`}>
                  {myBetResult.won ? '+' : '-'}{Math.abs(myBetResult.won ? myBetResult.netProfit : myBetResult.amount)} $ARENA
                </div>
                <div className="text-xs text-white/40 mt-1">
                  {myBetResult.won ? 'You won!' : 'Better luck next time'}
                </div>
              </div>
            )}

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
interface AgentInfo {
  id: string;
  name: string;
  archetype: string;
  bankroll: number;
  elo: number;
}

// ============================================
// Card rendering helpers
// ============================================

const SUIT_SYMBOL: Record<string, string> = { '♠': '♠', '♥': '♥', '♦': '♦', '♣': '♣' };
const SUIT_COLOR: Record<string, string> = { '♠': '#e2e8f0', '♥': '#f87171', '♦': '#f87171', '♣': '#e2e8f0' };

function CardFace({ card, faceDown, small }: { card: string; faceDown?: boolean; small?: boolean }) {
  if (faceDown || !card || card === '?') {
    return (
      <div className={`${small ? 'w-8 h-11' : 'w-11 h-16'} rounded-lg bg-gradient-to-br from-indigo-800 to-indigo-950 border border-indigo-600/40 flex items-center justify-center shadow-md`}>
        <span className={`${small ? 'text-xs' : 'text-sm'} text-indigo-400/60`}>🂠</span>
      </div>
    );
  }
  const rank = card[0] === 'T' ? '10' : card[0];
  const suit = card.slice(1);
  const color = SUIT_COLOR[suit] || '#e2e8f0';
  return (
    <div className={`${small ? 'w-8 h-11' : 'w-11 h-16'} rounded-lg bg-slate-100 border border-slate-300 flex flex-col items-center justify-center shadow-md relative`}>
      <span className={`${small ? 'text-[10px]' : 'text-xs'} font-black leading-none`} style={{ color }}>{rank}</span>
      <span className={`${small ? 'text-sm' : 'text-lg'} leading-none`} style={{ color }}>{SUIT_SYMBOL[suit] || suit}</span>
    </div>
  );
}

// ============================================
// Poker Arena Sub-component
// ============================================

function PokerArena({ agent1, agent2, moves, wager }: { agent1: AgentInfo; agent2: AgentInfo; moves: WheelMove[]; wager: number }) {
  const latestMove = moves[moves.length - 1];
  const snapshot = latestMove?.gameSnapshot;

  // Find the latest showdown snapshot (hand result)
  const [showdownSnapshot, setShowdownSnapshot] = useState<GameSnapshot | null>(null);
  useEffect(() => {
    // Find the most recent move that has a handResult
    for (let i = moves.length - 1; i >= 0; i--) {
      const gs = moves[i].gameSnapshot;
      if (gs?.handResult) {
        setShowdownSnapshot(gs);
        // Auto-clear after 8s
        const t = setTimeout(() => setShowdownSnapshot(null), 8000);
        return () => clearTimeout(t);
      }
    }
  }, [moves.length]);

  const communityCards = snapshot?.communityCards || [];
  const pot = snapshot?.pot ?? wager * 2;
  const phase = snapshot?.phase || 'preflop';
  const handNumber = snapshot?.handNumber || 1;
  const maxHands = snapshot?.maxHands || 5;
  const smallBlind = snapshot?.smallBlind || 10;
  const bigBlind = snapshot?.bigBlind || 20;
  const a1Chips = snapshot?.chips?.[agent1.id] ?? 1000;
  const a2Chips = snapshot?.chips?.[agent2.id] ?? 1000;
  const a1Bet = snapshot?.bets?.[agent1.id] ?? 0;
  const a2Bet = snapshot?.bets?.[agent2.id] ?? 0;

  // Chip stack comparison bar
  const totalChips = a1Chips + a2Chips;
  const a1Pct = totalChips > 0 ? Math.round((a1Chips / totalChips) * 100) : 50;

  // Phase label
  const phaseLabel: Record<string, string> = {
    preflop: 'PRE-FLOP', flop: 'FLOP', turn: 'TURN', river: 'RIVER',
    showdown: 'SHOWDOWN', handComplete: 'HAND OVER',
  };

  return (
    <div className="w-full space-y-3">
      {/* Hand counter + blinds bar */}
      <div className="flex items-center justify-between max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-amber-300/80">Hand {handNumber}/{maxHands}</span>
          <span className="text-[10px] text-white/30">Blinds {smallBlind}/{bigBlind}</span>
        </div>
        <div className="text-xs font-mono text-white/40">
          {phaseLabel[phase] || phase.toUpperCase()}
        </div>
      </div>

      {/* Poker table */}
      <div className="relative bg-gradient-to-b from-green-900/30 to-green-950/40 border border-green-800/30 rounded-3xl px-6 py-6 max-w-lg mx-auto">

        {/* Agent 1 (top) */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="text-2xl">{ARCHETYPE_EMOJI[agent1.archetype]}</div>
            <div>
              <div className="text-sm font-bold" style={{ color: ARCHETYPE_COLOR[agent1.archetype] }}>{agent1.name}</div>
              <div className="text-[10px] text-white/40 font-mono">{a1Chips.toLocaleString()} chips</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Hole cards (shown on showdown) */}
            {showdownSnapshot?.holeCards?.[agent1.id] ? (
              <div className="flex gap-0.5">
                {showdownSnapshot.holeCards[agent1.id].map((c, i) => <CardFace key={i} card={c} small />)}
              </div>
            ) : (
              <div className="flex gap-0.5">
                <CardFace card="?" faceDown small />
                <CardFace card="?" faceDown small />
              </div>
            )}
            {/* Last action */}
            {moves.filter(m => m.agentId === agent1.id).length > 0 && (() => {
              const lastA1 = moves.filter(m => m.agentId === agent1.id).pop()!;
              return (
                <div className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
                  <span className="text-[10px]">
                    {POKER_ACTION_EMOJI[lastA1.action] || ''} {lastA1.action}
                    {lastA1.amount ? ` $${lastA1.amount}` : ''}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Agent 1 bet */}
        {a1Bet > 0 && (
          <div className="flex justify-end mb-2">
            <div className="bg-amber-900/30 border border-amber-700/30 rounded-full px-2 py-0.5 text-[10px] font-mono text-amber-300">
              {a1Bet}
            </div>
          </div>
        )}

        {/* Community cards + pot center area */}
        <div className="flex flex-col items-center gap-3 py-4">
          {/* Community cards */}
          <div className="flex gap-1.5 min-h-[64px] items-center">
            {communityCards.length > 0 ? (
              communityCards.map((card, i) => <CardFace key={i} card={card} />)
            ) : (
              <div className="text-xs text-green-400/20 italic">Waiting for flop...</div>
            )}
            {/* Placeholder slots for remaining community cards */}
            {communityCards.length > 0 && communityCards.length < 5 && (
              Array.from({ length: 5 - communityCards.length }).map((_, i) => (
                <div key={`ph-${i}`} className="w-11 h-16 rounded-lg border border-green-700/10 border-dashed" />
              ))
            )}
          </div>

          {/* Pot */}
          <div className="text-center">
            <div className="text-[10px] text-green-300/50">POT</div>
            <div className="text-2xl font-mono font-black text-amber-300">{pot.toLocaleString()}</div>
          </div>
        </div>

        {/* Agent 2 bet */}
        {a2Bet > 0 && (
          <div className="flex justify-start mt-2">
            <div className="bg-amber-900/30 border border-amber-700/30 rounded-full px-2 py-0.5 text-[10px] font-mono text-amber-300">
              {a2Bet}
            </div>
          </div>
        )}

        {/* Agent 2 (bottom) */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <div className="text-2xl">{ARCHETYPE_EMOJI[agent2.archetype]}</div>
            <div>
              <div className="text-sm font-bold" style={{ color: ARCHETYPE_COLOR[agent2.archetype] }}>{agent2.name}</div>
              <div className="text-[10px] text-white/40 font-mono">{a2Chips.toLocaleString()} chips</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showdownSnapshot?.holeCards?.[agent2.id] ? (
              <div className="flex gap-0.5">
                {showdownSnapshot.holeCards[agent2.id].map((c, i) => <CardFace key={i} card={c} small />)}
              </div>
            ) : (
              <div className="flex gap-0.5">
                <CardFace card="?" faceDown small />
                <CardFace card="?" faceDown small />
              </div>
            )}
            {moves.filter(m => m.agentId === agent2.id).length > 0 && (() => {
              const lastA2 = moves.filter(m => m.agentId === agent2.id).pop()!;
              return (
                <div className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
                  <span className="text-[10px]">
                    {POKER_ACTION_EMOJI[lastA2.action] || ''} {lastA2.action}
                    {lastA2.amount ? ` $${lastA2.amount}` : ''}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Showdown result overlay */}
        {showdownSnapshot?.handResult && (
          <div className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer" onClick={() => setShowdownSnapshot(null)}>
            <div className="bg-black/80 border border-amber-500/50 rounded-xl px-6 py-3 text-center animate-in fade-in zoom-in duration-300">
              <div className="text-lg font-black text-amber-300">{showdownSnapshot.handResult}</div>
              {showdownSnapshot.handRanks && Object.entries(showdownSnapshot.handRanks).map(([id, rank]) => (
                <div key={id} className="text-xs text-white/50 mt-1">
                  <span style={{ color: id === agent1.id ? ARCHETYPE_COLOR[agent1.archetype] : ARCHETYPE_COLOR[agent2.archetype] }}>
                    {id === agent1.id ? agent1.name : agent2.name}
                  </span>: {rank}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chip stack comparison bar */}
      <div className="max-w-lg mx-auto">
        <div className="h-1.5 rounded-full overflow-hidden flex bg-white/5">
          <div className="bg-emerald-500/60 transition-all duration-500" style={{ width: `${a1Pct}%` }} />
          <div className="bg-red-500/60 transition-all duration-500" style={{ width: `${100 - a1Pct}%` }} />
        </div>
        <div className="flex justify-between mt-0.5 text-[10px] text-white/25 font-mono">
          <span>{a1Chips}</span>
          <span>{a2Chips}</span>
        </div>
      </div>

      {/* Action feed (compact) */}
      <div className="max-w-lg mx-auto max-h-28 overflow-y-auto space-y-0.5 px-1">
        {moves.slice(-6).map((move, i) => (
          <div key={i} className={`flex items-center gap-2 text-[11px] py-0.5 px-2 rounded ${
            i === moves.slice(-6).length - 1 ? 'bg-white/5' : ''
          }`}>
            <span className="text-white/15 font-mono w-4 text-right shrink-0">#{move.turn}</span>
            <span className="font-semibold shrink-0" style={{
              color: move.agentId === agent1.id ? (ARCHETYPE_COLOR[agent1.archetype] || '#fff') : (ARCHETYPE_COLOR[agent2.archetype] || '#fff')
            }}>
              {move.agentName}
            </span>
            <span className="text-amber-300 font-mono shrink-0">
              {POKER_ACTION_EMOJI[move.action] || ''} {move.action}{move.amount ? ` $${move.amount}` : ''}
            </span>
            {move.quip && <span className="text-white/20 truncate italic text-[10px]">"{move.quip}"</span>}
          </div>
        ))}
      </div>

      {/* Latest quip highlight */}
      {latestMove?.quip && (
        <div className="max-w-lg mx-auto bg-white/5 border border-white/5 rounded-lg px-3 py-2">
          <div className="text-[10px] text-white/20 mb-0.5">{latestMove.agentName}:</div>
          <div className="text-sm text-white/70 italic font-medium">"{latestMove.quip}"</div>
        </div>
      )}
    </div>
  );
}
