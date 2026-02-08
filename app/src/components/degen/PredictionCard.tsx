import { useState } from 'react';
import { Button } from '@ui/button';
import { playSound } from '../../utils/sounds';
import type { PredictionMarket } from '../../hooks/useDegenState';

const QUICK_BETS = [50, 100, 500];

interface PredictionCardProps {
  market: PredictionMarket;
  onBet: (marketId: string, side: 'A' | 'B', amount: number) => Promise<any>;
  loading?: boolean;
  walletConnected: boolean;
  onToast?: (msg: string, type: 'success' | 'error') => void;
}

export function PredictionCard({ market, onBet, loading, walletConnected, onToast }: PredictionCardProps) {
  const [amount, setAmount] = useState(100);
  const [betting, setBetting] = useState(false);

  const total = market.poolA + market.poolB;
  const pctA = total > 0 ? (market.poolA / total) * 100 : 50;
  const pctB = total > 0 ? (market.poolB / total) * 100 : 50;
  const multA = total > 0 && market.poolA > 0 ? (total / market.poolA).toFixed(1) : '-.--';
  const multB = total > 0 && market.poolB > 0 ? (total / market.poolB).toFixed(1) : '-.--';

  const handleBet = async (side: 'A' | 'B') => {
    if (!walletConnected || amount <= 0) return;
    setBetting(true);
    try {
      await onBet(market.id, side, amount);
      playSound('prediction');
      const sideName = side === 'A' ? market.optionA : market.optionB;
      onToast?.(`Bet placed! ${sideName} for ${amount.toLocaleString()} $ARENA`, 'success');
      setAmount(0);
    } catch (e: any) {
      playSound('error');
      onToast?.(e.message || 'Bet failed', 'error');
    } finally {
      setBetting(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-purple-700/40 rounded-lg p-3 space-y-3">
      <div className="text-sm font-semibold text-purple-200">{market.question}</div>

      {/* Pool distribution bar */}
      <div className="h-1.5 rounded-full overflow-hidden flex bg-slate-800/60">
        <div
          className="bg-emerald-500/70 transition-all duration-500"
          style={{ width: `${pctA}%` }}
        />
        <div
          className="bg-red-500/70 transition-all duration-500"
          style={{ width: `${pctB}%` }}
        />
      </div>

      {/* Bet sides */}
      <div className="flex gap-2 items-stretch">
        <button
          onClick={() => handleBet('A')}
          disabled={loading || betting || !walletConnected}
          className="flex-1 bg-emerald-900/40 hover:bg-emerald-800/50 border border-emerald-700/30 rounded-lg py-2.5 px-2 text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
        >
          <div className="text-xs font-semibold text-emerald-300 group-hover:text-emerald-200">{market.optionA}</div>
          <div className="text-lg font-mono font-bold text-emerald-200">{pctA.toFixed(0)}%</div>
          <div className="text-[10px] text-emerald-400/80 font-mono">{multA}x · {market.poolA.toLocaleString()} $ARENA</div>
        </button>

        <div className="flex items-center px-1">
          <span className="text-sm font-black text-slate-400">VS</span>
        </div>

        <button
          onClick={() => handleBet('B')}
          disabled={loading || betting || !walletConnected}
          className="flex-1 bg-red-900/40 hover:bg-red-800/50 border border-red-700/30 rounded-lg py-2.5 px-2 text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
        >
          <div className="text-xs font-semibold text-red-300 group-hover:text-red-200">{market.optionB}</div>
          <div className="text-lg font-mono font-bold text-red-200">{pctB.toFixed(0)}%</div>
          <div className="text-[10px] text-red-400/80 font-mono">{multB}x · {market.poolB.toLocaleString()} $ARENA</div>
        </button>
      </div>

      {/* Bet input */}
      {walletConnected ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            {QUICK_BETS.map((q) => (
              <button
                key={q}
                onClick={() => setAmount(q)}
                className={`flex-1 text-[10px] font-mono py-0.5 rounded border transition-colors ${
                  amount === q
                    ? 'bg-purple-900/40 border-purple-600/40 text-purple-300'
                    : 'bg-slate-800/30 border-slate-700/30 text-slate-500 hover:text-purple-300 hover:border-purple-600/30'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={amount || ''}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
              placeholder="Bet amount"
              className="flex-1 bg-slate-800/50 border border-slate-700/40 rounded px-2 py-1.5 text-xs font-mono text-slate-200 outline-none focus:border-purple-600/50 placeholder:text-slate-600"
              min={1}
            />
            <span className="text-[10px] text-slate-500 font-mono">$ARENA</span>
          </div>
        </div>
      ) : (
        <div className="text-center py-1.5 text-[11px] text-purple-400/70 bg-purple-900/20 rounded border border-purple-800/20">
          Connect wallet to place bets
        </div>
      )}
    </div>
  );
}
