import { AnimatedCounter } from './AnimatedCounter';
import type { UserBalance } from '../../hooks/useDegenState';

interface PositionTrackerProps {
  balance: UserBalance | null;
  totalPnL: number;
  spotPrice: number | null;
}

export function PositionTracker({ balance, totalPnL, spotPrice }: PositionTrackerProps) {
  return (
    <div className="flex items-center gap-4 text-xs">
      {spotPrice != null && (
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">$ARENA</span>
          <span className="font-mono font-semibold text-slate-200">{spotPrice.toFixed(4)}</span>
        </div>
      )}
      {balance && (
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Bal</span>
          <AnimatedCounter value={balance.balance} className="font-semibold text-slate-200 text-xs" />
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <span className="text-slate-500">PnL</span>
        <AnimatedCounter
          value={totalPnL}
          prefix={totalPnL >= 0 ? '+' : ''}
          className="font-semibold text-xs"
          colorize
        />
      </div>
    </div>
  );
}
