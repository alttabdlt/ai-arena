/**
 * SpawnAgent — Wallet connect + personality picker to spawn a new autonomous agent
 */
import { useState, useCallback } from 'react';

const API_BASE = '/api/v1';

const PERSONALITIES = [
  { type: 'SHARK', emoji: '🦈', label: 'Shark', desc: 'Ruthless optimizer. Dominates markets.' },
  { type: 'DEGEN', emoji: '🎲', label: 'Degen', desc: 'Chaotic risk-taker. YOLO everything.' },
  { type: 'CHAMELEON', emoji: '🦎', label: 'Chameleon', desc: 'Adaptive mimic. Copies winners.' },
  { type: 'GRINDER', emoji: '⚙️', label: 'Grinder', desc: 'Steady builder. Max efficiency.' },
  { type: 'VISIONARY', emoji: '🔮', label: 'Visionary', desc: 'Long-term planner. Big bets.' },
];

interface SpawnAgentProps {
  walletAddress: string | null;
  onConnectWallet: () => Promise<string | null>;
  onSpawned?: (agent: SpawnedAgent) => void;
}

interface SpawnedAgent {
  name: string;
  archetype: string;
  walletAddress: string;
}

interface SpawnSuccess {
  agent: SpawnedAgent;
  assignedTown?: string;
}

interface SpawnResponse {
  error?: string;
  agent?: SpawnedAgent;
  assignedTown?: string;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  return 'Failed to spawn';
}

export function SpawnAgent({ walletAddress, onConnectWallet, onSpawned }: SpawnAgentProps) {
  const [name, setName] = useState('');
  const [personality, setPersonality] = useState('CHAMELEON');
  const [error, setError] = useState<string | null>(null);
  const [spawning, setSpawning] = useState(false);
  const [success, setSuccess] = useState<SpawnSuccess | null>(null);

  const handleSpawn = useCallback(async () => {
    setError(null);
    
    let wallet = walletAddress;
    if (!wallet) {
      wallet = await onConnectWallet();
      if (!wallet) { setError('Wallet connection required'); return; }
    }

    if (!name.trim() || name.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }

    setSpawning(true);
    try {
      const res = await fetch(`${API_BASE}/agents/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), personality, walletAddress: wallet }),
      });
      const data = (await res.json()) as SpawnResponse;
      if (!res.ok) throw new Error(data.error || 'Failed to spawn');
      if (!data.agent) throw new Error('Spawn response missing agent');
      const nextSuccess: SpawnSuccess = {
        agent: data.agent,
        assignedTown: data.assignedTown,
      };
      setSuccess(nextSuccess);
      onSpawned?.(nextSuccess.agent);
    } catch (error: unknown) {
      setError(toErrorMessage(error));
    } finally {
      setSpawning(false);
    }
  }, [name, personality, walletAddress, onConnectWallet, onSpawned]);

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 p-4 bg-emerald-950/50 border border-emerald-500/30 rounded-lg">
        <div className="text-2xl">🎉</div>
        <div className="text-emerald-300 font-bold text-lg">{success.agent.name} is alive!</div>
        <div className="text-emerald-400/70 text-sm text-center">
          Your {success.agent.archetype} agent has spawned with 50 $ARENA and 100 reserve.
          {success.assignedTown && <> Deployed to <strong>{success.assignedTown}</strong>.</>}
        </div>
        <div className="text-xs text-slate-500 font-mono">{success.agent.walletAddress}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="text-center mb-1">
        <div className="text-lg font-bold text-amber-300">🤖 Spawn Your Agent</div>
        <div className="text-xs text-slate-400">Create an autonomous AI agent that builds, trades, and competes</div>
      </div>

      {/* Wallet */}
      <div className="text-xs">
        {walletAddress ? (
          <div className="flex items-center gap-2 bg-emerald-950/30 border border-emerald-800/40 rounded px-2 py-1">
            <span className="text-emerald-400">✓</span>
            <span className="font-mono text-emerald-300">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
          </div>
        ) : (
          <button
            onClick={onConnectWallet}
            className="w-full py-2 bg-blue-600/20 border border-blue-500/40 rounded text-blue-300 hover:bg-blue-600/30 transition-colors"
          >
            🔗 Connect Wallet
          </button>
        )}
      </div>

      {/* Name */}
      <input
        type="text"
        placeholder="Agent name..."
        value={name}
        onChange={e => setName(e.target.value)}
        maxLength={20}
        className="w-full px-3 py-2 bg-slate-900/80 border border-slate-700/50 rounded text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
      />

      {/* Personality picker */}
      <div className="grid grid-cols-5 gap-1">
        {PERSONALITIES.map(p => (
          <button
            key={p.type}
            onClick={() => setPersonality(p.type)}
            className={`flex flex-col items-center gap-0.5 p-2 rounded border text-center transition-all ${
              personality === p.type
                ? 'border-amber-500/70 bg-amber-950/40 shadow-sm shadow-amber-500/20'
                : 'border-slate-800/50 bg-slate-900/30 hover:border-slate-600/50'
            }`}
          >
            <span className="text-xl">{p.emoji}</span>
            <span className="text-[10px] text-slate-300 font-medium">{p.label}</span>
          </button>
        ))}
      </div>
      <div className="text-[10px] text-slate-500 text-center">
        {PERSONALITIES.find(p => p.type === personality)?.desc}
      </div>

      {error && <div className="text-xs text-red-400 text-center">{error}</div>}

      {/* Spawn button */}
      <button
        onClick={handleSpawn}
        disabled={spawning || !name.trim()}
        className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold rounded-lg text-sm hover:from-amber-500 hover:to-orange-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/20"
      >
        {spawning ? '⏳ Spawning...' : '🚀 Spawn Agent (50 $ARENA)'}
      </button>

      <div className="text-[9px] text-slate-600 text-center">
        Starting funds: 50 $ARENA + 100 reserve · 1 $ARENA/tick upkeep · Fully autonomous
      </div>
    </div>
  );
}
