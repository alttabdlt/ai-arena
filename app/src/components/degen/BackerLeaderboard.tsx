import { useState } from 'react';
import type { LeaderboardEntry } from '../../hooks/useDegenState';

interface BackerLeaderboardProps {
  data: LeaderboardEntry[];
}

export function BackerLeaderboard({ data }: BackerLeaderboardProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <div className="text-center py-6 space-y-2">
        <div className="text-2xl">🏆</div>
        <div className="text-xs text-slate-400">Be the first to back an agent</div>
        <div className="text-[10px] text-slate-600">Top degens will appear here</div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-amber-400 tracking-wider">TOP DEGENS</span>
        <span className="text-[10px] text-slate-500">{data.length} stakers</span>
      </div>

      <div className="space-y-0.5">
        {data.slice(0, 10).map((entry, i) => {
          const short = `${entry.walletAddress.slice(0, 6)}...${entry.walletAddress.slice(-4)}`;
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
          const isExpanded = expandedRow === entry.walletAddress;
          const isTopThree = i < 3;

          return (
            <div key={entry.walletAddress}>
              <button
                onClick={() => setExpandedRow(isExpanded ? null : entry.walletAddress)}
                className={`w-full flex items-center justify-between text-[11px] py-1.5 px-2 rounded transition-colors ${
                  isExpanded ? 'bg-slate-800/60' : 'hover:bg-slate-800/30'
                } ${isTopThree ? 'border-l-2' : ''}`}
                style={isTopThree ? { borderLeftColor: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : '#cd7f32' } : undefined}
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 text-center font-mono text-slate-500">
                    {medal || <span className="text-[10px]">{i + 1}.</span>}
                  </span>
                  <span className="font-mono text-slate-300">{short}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-mono">{entry.stakeCount} stakes</span>
                  <span className="text-slate-500 font-mono">{entry.totalStaked.toLocaleString()}</span>
                  <span className={`font-mono font-semibold min-w-[60px] text-right ${entry.totalPnL > 0 ? 'text-emerald-400' : entry.totalPnL < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                    {entry.totalPnL > 0 ? '+' : ''}{entry.totalPnL.toLocaleString()}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="px-8 py-1.5 text-[10px] text-slate-500 bg-slate-800/30 rounded-b space-y-0.5">
                  <div>Total staked: <span className="text-slate-300 font-mono">{entry.totalStaked.toLocaleString()} $ARENA</span></div>
                  <div>Active positions: <span className="text-slate-300 font-mono">{entry.stakeCount}</span></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
