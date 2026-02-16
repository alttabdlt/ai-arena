/**
 * useDegenState — Manages all degen mode state: balance, positions, price history,
 * predictions. Polls the backend at appropriate intervals.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE } from '../lib/api-base';

export interface UserBalance {
  id: string;
  walletAddress: string;
  balance: number;
  totalEarned: number;
  totalStaked: number;
}

export interface Position {
  id: string;
  agentId: string;
  agentName: string;
  agentArchetype: string;
  agentElo: number;
  agentWins: number;
  agentLosses: number;
  amount: number;
  yieldEarned: number;
  pnl: number;
  stakedAt: string;
}

export interface PricePoint {
  price: number;
  volume: number;
  createdAt: string;
}

export interface PredictionMarket {
  id: string;
  matchId: string | null;
  question: string;
  optionA: string;
  optionB: string;
  optionAAgentId: string | null;
  optionBAgentId: string | null;
  status: string;
  poolA: number;
  poolB: number;
  bets: { id: string; side: string; amount: number }[];
}

export interface LeaderboardEntry {
  walletAddress: string;
  totalPnL: number;
  totalStaked: number;
  stakeCount: number;
}

export interface AgentBackingInfo {
  backerCount: number;
  totalStaked: number;
}

export function useDegenState(walletAddress: string | null) {
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [predictions, setPredictions] = useState<PredictionMarket[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  // Fetch balance
  const fetchBalance = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`${API_BASE}/degen/balance/${walletAddress}`);
      const data = await res.json();
      if (mountedRef.current && data.balance) setBalance(data.balance);
    } catch {
      return;
    }
  }, [walletAddress]);

  // Fetch positions
  const fetchPositions = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`${API_BASE}/degen/positions/${walletAddress}`);
      const data = await res.json();
      if (mountedRef.current && data.positions) setPositions(data.positions);
    } catch {
      return;
    }
  }, [walletAddress]);

  // Fetch price history
  const fetchPriceHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/economy/price-history?period=1h`);
      const data = await res.json();
      if (mountedRef.current && data.snapshots) setPriceHistory(data.snapshots);
    } catch {
      return;
    }
  }, []);

  // Fetch active predictions
  const fetchPredictions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/degen/predictions/active`);
      const data = await res.json();
      if (mountedRef.current && data.markets) setPredictions(data.markets);
    } catch {
      return;
    }
  }, []);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/degen/leaderboard`);
      const data = await res.json();
      if (mountedRef.current && data.leaderboard) setLeaderboard(data.leaderboard);
    } catch {
      return;
    }
  }, []);

  // Back an agent
  const backAgent = useCallback(async (agentId: string, amount: number) => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/degen/back`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({ agentId, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to back agent');
      // Refresh balance and positions
      await Promise.all([fetchBalance(), fetchPositions()]);
      return data;
    } finally {
      setLoading(false);
    }
  }, [walletAddress, fetchBalance, fetchPositions]);

  // Unback an agent
  const unbackAgent = useCallback(async (stakeId: string) => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/degen/unback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({ stakeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to unback');
      await Promise.all([fetchBalance(), fetchPositions()]);
      return data;
    } finally {
      setLoading(false);
    }
  }, [walletAddress, fetchBalance, fetchPositions]);

  // Place a prediction bet
  const placeBet = useCallback(async (marketId: string, side: 'A' | 'B', amount: number) => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/degen/predictions/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({ marketId, side, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place bet');
      await Promise.all([fetchBalance(), fetchPredictions()]);
      return data;
    } finally {
      setLoading(false);
    }
  }, [walletAddress, fetchBalance, fetchPredictions]);

  // Get agent backing info
  const getAgentBackers = useCallback(async (agentId: string): Promise<AgentBackingInfo> => {
    try {
      const res = await fetch(`${API_BASE}/degen/agent/${agentId}/backers`);
      return await res.json();
    } catch {
      return { backerCount: 0, totalStaked: 0 };
    }
  }, []);

  // Total PnL across all positions
  const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);

  // Polling
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!walletAddress) {
      setBalance(null);
      setPositions([]);
      return;
    }
    fetchBalance();
    fetchPositions();
    const t1 = setInterval(fetchBalance, 5000);
    const t2 = setInterval(fetchPositions, 3000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [walletAddress, fetchBalance, fetchPositions]);

  useEffect(() => {
    fetchPriceHistory();
    fetchPredictions();
    fetchLeaderboard();
    const t1 = setInterval(fetchPriceHistory, 10000);
    const t2 = setInterval(fetchPredictions, 5000);
    const t3 = setInterval(fetchLeaderboard, 15000);
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); };
  }, [fetchPriceHistory, fetchPredictions, fetchLeaderboard]);

  return {
    balance,
    positions,
    totalPnL,
    priceHistory,
    predictions,
    leaderboard,
    loading,
    backAgent,
    unbackAgent,
    placeBet,
    getAgentBackers,
    refresh: () => Promise.all([fetchBalance(), fetchPositions(), fetchPriceHistory(), fetchPredictions(), fetchLeaderboard()]),
  };
}
