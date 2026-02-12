/**
 * WheelBanner — Floating banner for Wheel of Fate PvP events.
 *
 * Shows during:
 *   ANNOUNCING → VS card with betting UI, countdown timer, live odds
 *   FIGHTING   → Live move feed with agent actions
 *   AFTERMATH  → Winner celebration, payout summary
 *
 * Collapses to a minimal bar during PREP/IDLE.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import type { WheelStatus, WheelOdds, WheelResult, WheelMove } from '../../hooks/useWheelStatus';
import { playSound } from '../../utils/sounds';

const ARCHETYPE_EMOJI: Record<string, string> = {
  SHARK: '🦈',
  DEGEN: '🎰',
  CHAMELEON: '🦎',
  GRINDER: '⚙️',
  VISIONARY: '🔮',
};

const GAME_EMOJI: Record<string, string> = {
  POKER: '🃏',
};

const QUICK_BETS = [50, 100, 250, 500];

interface WheelBannerProps {
  status: WheelStatus | null;
  odds: WheelOdds | null;
  walletAddress: string | null;
  onBet: (wallet: string, side: 'A' | 'B', amount: number) => Promise<any>;
  loading?: boolean;
  isMobile?: boolean;
}

export function WheelBanner({ status, odds, walletAddress, onBet, loading, isMobile }: WheelBannerProps) {
  const [betAmount, setBetAmount] = useState(100);
  const [betting, setBetting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [expanded, setExpanded] = useState(true);

  // Countdown timer for betting window
  useEffect(() => {
    if (status?.phase !== 'ANNOUNCING' || !status.bettingEndsIn) {
      setCountdown(0);
      return;
    }
    setCountdown(Math.ceil(status.bettingEndsIn / 1000));
    const t = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [status?.phase, status?.bettingEndsIn]);

  // Play sound on phase transitions
  const prevPhaseRef = useRef(status?.phase);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    const cur = status?.phase;
    prevPhaseRef.current = cur;
    if (cur === 'ANNOUNCING' && prev !== 'ANNOUNCING') {
      playSound('notify');
    }
  }, [status?.phase]);

  // Auto-expand on phase change
  useEffect(() => {
    if (status?.phase === 'ANNOUNCING' || status?.phase === 'FIGHTING' || status?.phase === 'AFTERMATH') {
      setExpanded(true);
    }
  }, [status?.phase]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleBet = async (side: 'A' | 'B') => {
    if (!walletAddress || betAmount <= 0 || betting) return;
    setBetting(true);
    try {
      await onBet(walletAddress, side, betAmount);
      const name = side === 'A' ? status?.currentMatch?.agent1.name : status?.currentMatch?.agent2.name;
      setToast({ msg: `✅ Bet ${betAmount} on ${name}!`, type: 'ok' });
    } catch (e: any) {
      setToast({ msg: `❌ ${e.message}`, type: 'err' });
    } finally {
      setBetting(false);
    }
  };

  if (!status || status.phase === 'IDLE' || status.phase === 'PREP') {
    // Enhanced next-spin indicator with stats ticker
    if (!status?.nextSpinAt) return null;
    const nextMs = new Date(status.nextSpinAt).getTime() - Date.now();
    if (nextMs <= 0 || nextMs > 20 * 60 * 1000) return null;
    const nextSec = Math.ceil(nextMs / 1000);
    const nextMin = Math.ceil(nextMs / 60000);
    const isLastMinute = nextSec <= 60;
    const stats = status?.sessionStats;
    const records = stats?.agentRecords ? Object.values(stats.agentRecords) : [];
    const hasStats = records.length > 0;

    return (
      <div className={`bg-slate-900/80 border rounded-xl overflow-hidden ${isLastMinute ? 'border-purple-600/40 shadow-lg shadow-purple-900/20' : 'border-slate-700/30'}`}>
        {/* Countdown row */}
        <div className="flex items-center justify-between px-3 py-1.5">
          <div className="flex items-center gap-2">
            <span className={`${isLastMinute ? 'animate-pulse' : ''}`}>🎡</span>
            <span className={`text-xs font-bold ${isLastMinute ? 'text-purple-200' : 'text-slate-400'}`}>
              {isLastMinute ? `Next fight in ${nextSec}s` : `Next fight in ~${nextMin}m`}
            </span>
          </div>
          {stats?.totalMatches ? (
            <span className="text-[10px] text-slate-500">
              {stats.totalMatches} match{stats.totalMatches !== 1 ? 'es' : ''} this session
            </span>
          ) : null}
        </div>

        {/* Stats ticker */}
        {hasStats && (
          <div className="px-3 py-1 border-t border-slate-800/40 flex items-center gap-3 text-[10px] text-slate-500 overflow-x-auto">
            {records.sort((a, b) => b.wins - a.wins).slice(0, 5).map((r, i) => (
              <span key={i} className="shrink-0">
                <span className="text-slate-300">{r.name}</span>{' '}
                <span className="text-emerald-500">{r.wins}W</span>-<span className="text-red-500">{r.losses}L</span>
                {r.streak > 1 && <span className="text-amber-400"> 🔥{r.streak}</span>}
                {r.streak < -1 && <span className="text-red-400"> 💀{Math.abs(r.streak)}</span>}
              </span>
            ))}
            {stats.biggestPot > 0 && (
              <span className="shrink-0 text-amber-400/60">Max pot: {stats.biggestPot}</span>
            )}
            {stats.biggestUpset && (
              <span className="shrink-0 text-purple-400/60">Upset: {stats.biggestUpset}</span>
            )}
            {stats.crowdAccuracy !== null && (
              <span className="shrink-0 text-white/30">Crowd: {stats.crowdAccuracy}% right</span>
            )}
          </div>
        )}
      </div>
    );
  }

  const match = status.currentMatch;
  const result = status.lastResult;

  // ===== ANNOUNCING =====
  if (status.phase === 'ANNOUNCING' && match) {
    const poolA = odds?.odds?.poolA ?? 0;
    const poolB = odds?.odds?.poolB ?? 0;
    const total = poolA + poolB;
    const pctA = total > 0 ? Math.round((poolA / total) * 100) : 50;
    const pctB = total > 0 ? Math.round((poolB / total) * 100) : 50;
    const multA = poolA > 0 ? (total / poolA).toFixed(1) : '-.-';
    const multB = poolB > 0 ? (total / poolB).toFixed(1) : '-.-';

    return (
      <div className={`bg-gradient-to-r from-purple-950/90 via-slate-900/95 to-purple-950/90 border border-purple-600/40 rounded-xl shadow-2xl shadow-purple-900/30 overflow-hidden ${isMobile ? 'mx-2' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-purple-800/30">
          <div className="flex items-center gap-2">
            <span className="text-lg animate-spin" style={{ animationDuration: '3s' }}>🎡</span>
            <span className="text-sm font-bold text-purple-200">WHEEL OF FATE</span>
            <span className="text-xs bg-purple-900/60 text-purple-300 px-2 py-0.5 rounded-full">
              {GAME_EMOJI[match.gameType] || '🎮'} {match.gameType}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-mono font-bold ${countdown <= 10 ? 'text-red-400 animate-pulse' : 'text-amber-300'}`}>
              ⏱️ {countdown}s
            </span>
            <span className="text-[10px] text-purple-400/60 uppercase">betting open</span>
          </div>
        </div>

        {/* VS Card */}
        <div className="px-3 py-3">
          <div className="flex items-stretch gap-2">
            {/* Agent A */}
            <button
              onClick={() => handleBet('A')}
              disabled={!walletAddress || betting || loading || countdown <= 0}
              className="flex-1 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-700/30 rounded-lg p-2 text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
            >
              <div className="text-lg">{ARCHETYPE_EMOJI[match.agent1.archetype] || '🤖'}</div>
              <div className="text-xs font-bold text-emerald-200 truncate group-hover:text-emerald-100">{match.agent1.name}</div>
              <div className="text-[10px] text-emerald-400/70">{match.agent1.archetype} · ELO {match.agent1.elo}</div>
              <div className="text-[10px] text-emerald-400/50">💰 {match.agent1.bankroll}</div>
              <div className="mt-1.5 text-xl font-mono font-black text-emerald-300">{pctA}%</div>
              <div className="text-[10px] text-emerald-400/60 font-mono">{multA}x · {poolA.toLocaleString()} $A</div>
            </button>

            {/* VS */}
            <div className="flex flex-col items-center justify-center px-1">
              <span className="text-xl font-black text-purple-400/80 animate-pulse">VS</span>
              <div className="text-[10px] text-purple-500/60 mt-1">pot</div>
              <div className="text-sm font-mono font-bold text-amber-300">{match.wager * 2}</div>
            </div>

            {/* Agent B */}
            <button
              onClick={() => handleBet('B')}
              disabled={!walletAddress || betting || loading || countdown <= 0}
              className="flex-1 bg-red-950/40 hover:bg-red-900/50 border border-red-700/30 rounded-lg p-2 text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
            >
              <div className="text-lg">{ARCHETYPE_EMOJI[match.agent2.archetype] || '🤖'}</div>
              <div className="text-xs font-bold text-red-200 truncate group-hover:text-red-100">{match.agent2.name}</div>
              <div className="text-[10px] text-red-400/70">{match.agent2.archetype} · ELO {match.agent2.elo}</div>
              <div className="text-[10px] text-red-400/50">💰 {match.agent2.bankroll}</div>
              <div className="mt-1.5 text-xl font-mono font-black text-red-300">{pctB}%</div>
              <div className="text-[10px] text-red-400/60 font-mono">{multB}x · {poolB.toLocaleString()} $A</div>
            </button>
          </div>

          {/* Odds bar */}
          <div className="mt-2 h-1.5 rounded-full overflow-hidden flex bg-slate-800/60">
            <div className="bg-emerald-500/70 transition-all duration-700" style={{ width: `${pctA}%` }} />
            <div className="bg-red-500/70 transition-all duration-700" style={{ width: `${pctB}%` }} />
          </div>

          {/* Bet controls */}
          {walletAddress ? (
            <div className="mt-2 flex items-center gap-1.5">
              {QUICK_BETS.map(q => (
                <button
                  key={q}
                  onClick={() => setBetAmount(q)}
                  className={`flex-1 text-[10px] font-mono py-1 rounded border transition-colors ${
                    betAmount === q
                      ? 'bg-purple-900/50 border-purple-500/50 text-purple-200'
                      : 'bg-slate-800/30 border-slate-700/30 text-slate-500 hover:text-purple-300 hover:border-purple-600/30'
                  }`}
                >
                  {q}
                </button>
              ))}
              <input
                type="number"
                value={betAmount || ''}
                onChange={e => setBetAmount(Math.max(0, Number(e.target.value)))}
                className="w-16 bg-slate-800/50 border border-slate-700/40 rounded px-1.5 py-1 text-[10px] font-mono text-slate-200 outline-none focus:border-purple-600/50"
                placeholder="amt"
                min={1}
              />
            </div>
          ) : (
            <div className="mt-2 text-center text-[10px] text-purple-400/60 bg-purple-900/20 rounded py-1 border border-purple-800/20">
              Connect wallet to bet
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className={`px-3 py-1.5 text-xs font-medium border-t ${
            toast.type === 'ok' ? 'bg-emerald-900/30 border-emerald-800/30 text-emerald-300' : 'bg-red-900/30 border-red-800/30 text-red-300'
          }`}>
            {toast.msg}
          </div>
        )}
      </div>
    );
  }

  // ===== FIGHTING =====
  if (status.phase === 'FIGHTING' && match) {
    // Use LIVE currentMoves, not lastResult.moves
    const liveMoves = status.currentMoves || [];
    const recentMoves = liveMoves.slice(-4);
    const latestSnapshot = liveMoves.length > 0 ? liveMoves[liveMoves.length - 1].gameSnapshot : null;
    const communityCards = latestSnapshot?.communityCards || [];
    const pot = latestSnapshot?.pot ?? match.wager * 2;
    const phase = latestSnapshot?.phase || 'preflop';
    const handNum = latestSnapshot?.handNumber || 1;
    const maxHands = latestSnapshot?.maxHands || 5;
    const blinds = latestSnapshot ? `${latestSnapshot.smallBlind}/${latestSnapshot.bigBlind}` : '10/20';
    const a1Chips = latestSnapshot?.chips?.[match.agent1.id] ?? '—';
    const a2Chips = latestSnapshot?.chips?.[match.agent2.id] ?? '—';

    const SUIT_DISPLAY: Record<string, string> = { '♠': '♠', '♥': '♥', '♦': '♦', '♣': '♣' };
    const SUIT_CLR: Record<string, string> = { '♠': '#cbd5e1', '♥': '#f87171', '♦': '#f87171', '♣': '#cbd5e1' };
    const renderMiniCard = (card: string) => {
      const rank = card[0] === 'T' ? '10' : card[0];
      const suit = card.slice(1);
      return (
        <span key={card} className="inline-flex items-center bg-slate-100 text-[10px] font-bold rounded px-0.5 mx-px" style={{ color: SUIT_CLR[suit] || '#666' }}>
          {rank}{SUIT_DISPLAY[suit] || suit}
        </span>
      );
    };

    return (
      <div className={`bg-gradient-to-r from-red-950/90 via-slate-900/95 to-red-950/90 border border-red-600/40 rounded-xl shadow-2xl shadow-red-900/30 overflow-hidden max-w-xl mx-auto ${isMobile ? 'mx-2' : ''}`}>
        {/* Compact header with game state */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-red-800/30">
          <div className="flex items-center gap-2">
            <span className="animate-pulse">⚔️</span>
            <span className="text-xs font-bold text-red-200">Hand {handNum}/{maxHands}</span>
            <span className="text-[10px] text-red-400/40">{blinds}</span>
            <span className="text-[10px] text-amber-300/60 uppercase">{phase}</span>
          </div>
          <div className="text-[10px] text-amber-300 font-mono font-bold">
            POT {pot}
          </div>
        </div>

        {/* Community cards + agent chips row */}
        <div className="px-3 py-1.5 flex items-center justify-between border-b border-red-800/15">
          <div className="flex items-center gap-1 text-[10px] text-white/40">
            <span className="text-emerald-400 font-mono">{a1Chips}</span>
            <span className="text-white/15">·</span>
            <span className="text-white/25">{match.agent1.name}</span>
          </div>
          <div className="flex items-center gap-0.5">
            {communityCards.length > 0 ? (
              communityCards.map(c => renderMiniCard(c))
            ) : (
              <span className="text-[10px] text-green-400/20 italic">—</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-white/40">
            <span className="text-white/25">{match.agent2.name}</span>
            <span className="text-white/15">·</span>
            <span className="text-red-400 font-mono">{a2Chips}</span>
          </div>
        </div>

        {/* Live move feed */}
        {recentMoves.length > 0 ? (
          <div className="px-3 py-1.5 space-y-1 max-h-[120px] overflow-y-auto">
            {recentMoves.map((move, i) => (
              <div key={`${move.turn}-${move.agentId}-${i}`} className={`text-[11px] rounded-md px-2 py-1 ${
                i === recentMoves.length - 1 ? 'bg-white/5 border border-white/5' : ''
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-mono text-[10px]">#{move.turn}</span>
                  <span className={`font-semibold ${
                    move.agentId === match.agent1.id ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {move.agentName}
                  </span>
                  <span className="text-amber-300 font-mono">{move.action}{move.amount ? ` $${move.amount}` : ''}</span>
                  {move.quip && <span className="text-white/20 italic text-[10px] truncate">"{move.quip}"</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-3 py-2 text-center text-[11px] text-slate-500 animate-pulse">
            Waiting for first move...
          </div>
        )}

        {/* Betting summary */}
        {odds?.odds && odds.odds.total > 0 && (
          <div className="px-3 py-1 border-t border-red-800/20 flex items-center gap-2 text-[10px] text-slate-500">
            <span>🎰 {odds.odds.total.toLocaleString()} $ARENA bet</span>
            <span>•</span>
            <span className="text-emerald-500">{match.agent1.name} {odds.odds.pctA}%</span>
            <span>•</span>
            <span className="text-red-500">{match.agent2.name} {odds.odds.pctB}%</span>
          </div>
        )}
      </div>
    );
  }

  // ===== AFTERMATH =====
  if (status.phase === 'AFTERMATH' && result) {
    const isWinnerA = result.winnerId === match?.agent1?.id;
    return (
      <div className={`bg-gradient-to-r from-amber-950/90 via-slate-900/95 to-amber-950/90 border border-amber-600/40 rounded-xl shadow-2xl shadow-amber-900/30 overflow-hidden ${isMobile ? 'mx-2' : ''}`}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-amber-800/30">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏆</span>
            <span className="text-sm font-bold text-amber-200">{result.winnerName} WINS!</span>
          </div>
          <div className="text-xs text-amber-400/60">
            {result.gameType} · {result.turns} turns · pot {result.pot}
          </div>
        </div>

        <div className="px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`text-center ${isWinnerA ? 'text-emerald-300' : 'text-slate-500'}`}>
              <div className="text-lg">{isWinnerA ? '👑' : '💀'}</div>
              <div className="text-xs font-semibold">{match?.agent1?.name || result.winnerName}</div>
            </div>
            <span className="text-slate-600 text-xs">vs</span>
            <div className={`text-center ${!isWinnerA ? 'text-emerald-300' : 'text-slate-500'}`}>
              <div className="text-lg">{!isWinnerA ? '👑' : '💀'}</div>
              <div className="text-xs font-semibold">{match?.agent2?.name || result.loserName}</div>
            </div>
          </div>

          {result.bettingPool.totalBets > 0 && (
            <div className="text-right text-[10px]">
              <div className="text-amber-300">🎰 {result.bettingPool.totalBets.toLocaleString()} bet</div>
              <div className="text-slate-500">
                A: {result.bettingPool.poolA} · B: {result.bettingPool.poolB}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
