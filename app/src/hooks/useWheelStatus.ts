/**
 * useWheelStatus — Polls the Wheel of Fate status endpoint.
 * During ANNOUNCING, polls every 2s (for live odds).
 * During FIGHTING/AFTERMATH, polls every 1s (for live moves).
 * During PREP/IDLE, polls every 10s.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = '/api/v1';

export interface WheelAgent {
  id: string;
  name: string;
  archetype: string;
  bankroll: number;
  elo: number;
}

export interface WheelBuff {
  type: 'SHELTER' | 'MARKET' | 'INTEL' | 'SABOTAGE' | 'MORALE';
  zone: string;
  count: number;
  description: string;
}

export interface WheelMatch {
  matchId: string;
  marketId: string | null;
  gameType: string;
  agent1: WheelAgent;
  agent2: WheelAgent;
  wager: number;
  buffs: { agent1: WheelBuff[]; agent2: WheelBuff[] };
  trashTalk?: { agent1: string; agent2: string };
  h2h?: { agent1Wins: number; agent2Wins: number; draws: number };
  agent1Stats?: { aggression: number; foldRate: number; callRate: number; totalActions: number; matchesAnalyzed: number };
  agent2Stats?: { aggression: number; foldRate: number; callRate: number; totalActions: number; matchesAnalyzed: number };
  announcedAt: number;
  fightStartsAt: number;
}

export interface GameSnapshot {
  communityCards: string[];
  pot: number;
  phase: string;
  chips: Record<string, number>;
  bets: Record<string, number>;
  handNumber: number;
  maxHands: number;
  smallBlind: number;
  bigBlind: number;
  holeCards?: Record<string, string[]>;
  handRanks?: Record<string, string>;
  handWinner?: string | null;
  handResult?: string;
}

export interface WheelMove {
  agentId: string;
  agentName: string;
  turn: number;
  action: string;
  reasoning: string;
  quip: string;
  amount?: number;
  gameSnapshot?: GameSnapshot;
}

export interface WheelResult {
  matchId: string;
  marketId: string | null;
  gameType: string;
  winnerId: string | null;
  winnerName: string;
  winnerQuip: string;
  loserId: string | null;
  loserName: string;
  loserQuip: string;
  pot: number;
  rake: number;
  turns: number;
  moves: WheelMove[];
  bettingPool: { poolA: number; poolB: number; totalBets: number };
  timestamp: string;
}

export type WheelPhase = 'PREP' | 'ANNOUNCING' | 'FIGHTING' | 'AFTERMATH' | 'IDLE';

export interface SessionStats {
  agentRecords: Record<string, { name: string; wins: number; losses: number; streak: number }>;
  biggestPot: number;
  biggestUpset: string | null;
  totalMatches: number;
  crowdAccuracy: number | null;
}

export interface WheelStatus {
  phase: WheelPhase;
  nextSpinAt: string | null;
  currentMatch: WheelMatch | null;
  currentMoves: WheelMove[];  // Live moves during FIGHTING
  lastResult: WheelResult | null;
  cycleCount: number;
  bettingEndsIn: number | null;
  sessionStats: SessionStats;
  myBetResult?: { side: string; amount: number; payout: number; netProfit: number; won: boolean };
  config: {
    cycleMs: number;
    wagerPct: number;
    minBankroll: number;
    bettingWindowMs: number;
  };
}

export interface WheelOdds {
  betting: boolean;
  marketId?: string;
  odds?: {
    poolA: number;
    poolB: number;
    total: number;
    pctA: number;
    pctB: number;
    multA: number | null;
    multB: number | null;
  };
  betCount?: number;
  bettingEndsIn?: number;
}

export function useWheelStatus(walletAddress?: string | null) {
  const [status, setStatus] = useState<WheelStatus | null>(null);
  const [odds, setOdds] = useState<WheelOdds | null>(null);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);
  const walletRef = useRef(walletAddress);
  walletRef.current = walletAddress;

  const fetchStatus = useCallback(async () => {
    try {
      const w = walletRef.current;
      const url = w ? `${API_BASE}/wheel/status?wallet=${encodeURIComponent(w)}` : `${API_BASE}/wheel/status`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (mountedRef.current) setStatus(data);
    } catch {}
  }, []);

  const fetchOdds = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/wheel/odds`);
      if (!res.ok) return;
      const data = await res.json();
      if (mountedRef.current) setOdds(data);
    } catch {}
  }, []);

  const placeBet = useCallback(async (wallet: string, side: 'A' | 'B', amount: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/wheel/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, side, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bet failed');
      // Refresh odds immediately
      await fetchOdds();
      return data;
    } finally {
      setLoading(false);
    }
  }, [fetchOdds]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchOdds();

    // Dynamic polling rate based on phase
    let statusInterval: ReturnType<typeof setInterval>;
    let oddsInterval: ReturnType<typeof setInterval>;

    const setupPolling = () => {
      const phase = status?.phase;
      const statusRate = (phase === 'FIGHTING' || phase === 'AFTERMATH') ? 1500
        : phase === 'ANNOUNCING' ? 2000
        : 10000;
      const oddsRate = phase === 'ANNOUNCING' ? 2000 : 10000;

      clearInterval(statusInterval);
      clearInterval(oddsInterval);
      statusInterval = setInterval(fetchStatus, statusRate);
      oddsInterval = setInterval(fetchOdds, oddsRate);
    };

    setupPolling();

    return () => {
      clearInterval(statusInterval);
      clearInterval(oddsInterval);
    };
  }, [status?.phase, fetchStatus, fetchOdds]);

  return { status, odds, loading, placeBet, refresh: () => Promise.all([fetchStatus(), fetchOdds()]) };
}
