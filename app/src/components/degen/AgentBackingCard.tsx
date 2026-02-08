import { useState, useEffect, useRef } from 'react';
import { Button } from '@ui/button';
import { playSound } from '../../utils/sounds';

const ARCHETYPE_COLORS: Record<string, string> = {
  SHARK: '#ef4444', ROCK: '#94a3b8', CHAMELEON: '#34d399', DEGEN: '#fbbf24', GRINDER: '#818cf8',
};
const ARCHETYPE_GLYPH: Record<string, string> = {
  SHARK: '▲', ROCK: '●', CHAMELEON: '◆', DEGEN: '★', GRINDER: '◎',
};

const QUICK_AMOUNTS = [100, 500, 1000];

interface Agent {
  id: string;
  name: string;
  archetype: string;
  elo: number;
  wins: number;
  losses: number;
  bankroll: number;
}

interface AgentBackingCardProps {
  agent: Agent;
  onBack: (agentId: string, amount: number) => Promise<any>;
  getBackers: (agentId: string) => Promise<{ backerCount: number; totalStaked: number }>;
  loading?: boolean;
  walletConnected: boolean;
  isBacked?: boolean;
  onToast?: (msg: string, type: 'success' | 'error') => void;
  userBalance?: number;
}

export function AgentBackingCard({ agent, onBack, getBackers, loading, walletConnected, isBacked, onToast, userBalance }: AgentBackingCardProps) {
  const [amount, setAmount] = useState(500);
  const [backerInfo, setBackerInfo] = useState<{ backerCount: number; totalStaked: number } | null>(null);
  const [backing, setBacking] = useState(false);
  const [flashBorder, setFlashBorder] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const color = ARCHETYPE_COLORS[agent.archetype] || '#93c5fd';
  const glyph = ARCHETYPE_GLYPH[agent.archetype] || '●';
  const winRate = agent.wins + agent.losses > 0 ? ((agent.wins / (agent.wins + agent.losses)) * 100).toFixed(0) : '-';
  const streak = agent.wins > agent.losses ? agent.wins - agent.losses : 0;

  useEffect(() => {
    getBackers(agent.id).then(setBackerInfo).catch(() => {});
    const t = setInterval(() => getBackers(agent.id).then(setBackerInfo).catch(() => {}), 10000);
    return () => clearInterval(t);
  }, [agent.id, getBackers]);

  const handleBack = async () => {
    if (!walletConnected || amount <= 0) return;
    setBacking(true);
    try {
      await onBack(agent.id, amount);
      playSound('stake');
      onToast?.(`Backed ${agent.name} for ${amount.toLocaleString()} $ARENA!`, 'success');
      setFlashBorder(true);
      setTimeout(() => setFlashBorder(false), 800);
      setAmount(0);
    } catch (e: any) {
      playSound('error');
      onToast?.(e.message || 'Back failed', 'error');
    } finally {
      setBacking(false);
    }
  };

  const setQuickAmount = (val: number | 'MAX') => {
    if (val === 'MAX') {
      setAmount(userBalance ? Math.floor(userBalance) : 10000);
    } else {
      setAmount(val);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`relative rounded-lg p-3 space-y-2 transition-all duration-300
        ${isBacked
          ? 'bg-slate-900/80 border border-emerald-500/30 ring-1 ring-emerald-500/20'
          : 'bg-slate-900/60 border border-slate-700/40'}
        ${flashBorder ? 'ring-2 ring-emerald-400/60' : ''}
        ${streak > 2 ? 'border-amber-600/30' : ''}
      `}
      style={{ borderLeftWidth: '4px', borderLeftColor: color }}
    >
      {/* Streak fire indicator */}
      {streak > 2 && (
        <div className="absolute -top-1 -right-1 text-xs" title={`${streak} win streak`}>
          {'🔥'.repeat(Math.min(streak - 2, 3))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ color }} className="text-xl font-bold">{glyph}</span>
          <div>
            <div className="text-sm font-semibold text-slate-100">{agent.name}</div>
            <div className="text-[11px] text-slate-400">
              <span style={{ color }} className="font-semibold">{agent.archetype}</span>
              {' · '}ELO {agent.elo}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-mono font-semibold ${
            winRate !== '-' && Number(winRate) >= 60 ? 'text-emerald-400' :
            winRate !== '-' && Number(winRate) < 40 ? 'text-red-400' : 'text-slate-300'
          }`}>
            {winRate}% WR
          </div>
          <div className="text-[10px] text-slate-500">
            {agent.wins}W / {agent.losses}L
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>{backerInfo?.backerCount || 0} backers · {(backerInfo?.totalStaked || 0).toLocaleString()} staked</span>
        <span className="font-mono text-slate-300">{agent.bankroll.toLocaleString()} $ARENA</span>
      </div>

      {walletConnected && (
        <div className="space-y-2">
          {/* Quick amount buttons */}
          <div className="flex items-center gap-1">
            {QUICK_AMOUNTS.map((q) => (
              <button
                key={q}
                onClick={() => setQuickAmount(q)}
                className={`flex-1 text-[10px] font-mono py-0.5 rounded border transition-colors ${
                  amount === q
                    ? 'bg-slate-700/60 border-slate-500/50 text-slate-200'
                    : 'bg-slate-800/30 border-slate-700/30 text-slate-500 hover:text-slate-300 hover:border-slate-600/50'
                }`}
              >
                {q >= 1000 ? `${q / 1000}K` : q}
              </button>
            ))}
            <button
              onClick={() => setQuickAmount('MAX')}
              className={`flex-1 text-[10px] font-mono font-semibold py-0.5 rounded border transition-colors ${
                userBalance && amount === Math.floor(userBalance)
                  ? 'bg-amber-900/40 border-amber-600/40 text-amber-300'
                  : 'bg-slate-800/30 border-slate-700/30 text-amber-500/70 hover:text-amber-400 hover:border-amber-600/40'
              }`}
            >
              MAX
            </button>
          </div>

          {/* Input + Back button */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={amount || ''}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
              placeholder="Amount"
              className="flex-1 bg-slate-800/50 border border-slate-700/40 rounded px-2 py-1.5 text-xs font-mono text-slate-200 outline-none focus:border-emerald-600/50 placeholder:text-slate-600"
              min={1}
            />
            <Button
              size="sm"
              onClick={handleBack}
              disabled={loading || backing || amount <= 0}
              className="text-xs font-bold px-4 py-1.5 transition-all"
              style={{
                backgroundColor: `${color}cc`,
                color: '#fff',
              }}
            >
              {backing ? '...' : 'BACK'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
