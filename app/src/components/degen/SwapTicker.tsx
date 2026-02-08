import { useMemo } from 'react';

interface TradeEntry {
  id: string;
  agent: { name: string; archetype: string };
  side: 'BUY_ARENA' | 'SELL_ARENA';
  amountArena: number;
  note?: string;
}

const ARCHETYPE_EMOJI: Record<string, string> = {
  SHARK: '🦈', ROCK: '🪨', CHAMELEON: '🦎', DEGEN: '🎰', GRINDER: '⚙️',
};

const DEGEN_VERBS_BUY = ['scooped', 'loaded up', 'aped into', 'grabbed', 'bought'];
const DEGEN_VERBS_SELL = ['dumped', 'rug-pulled', 'sold', 'offloaded', 'exited'];

function degenVerb(isBuy: boolean, seed: number): string {
  const verbs = isBuy ? DEGEN_VERBS_BUY : DEGEN_VERBS_SELL;
  return verbs[seed % verbs.length];
}

interface SwapTickerProps {
  trades: TradeEntry[];
}

export function SwapTicker({ trades }: SwapTickerProps) {
  const items = useMemo(() => {
    return trades.slice(0, 20).map((s, i) => {
      const emoji = ARCHETYPE_EMOJI[s.agent.archetype] || '🤖';
      const isBuy = s.side === 'BUY_ARENA';
      const verb = degenVerb(isBuy, i);
      const amount = Math.max(0, Math.round(Number(s.amountArena) || 0));
      const note = String(s.note || '').replace(/\\s+/g, ' ').trim().slice(0, 56);
      return { emoji, name: s.agent.name, verb, amount, isBuy, note };
    }).filter((x) => x.amount > 0);
  }, [trades]);

  if (items.length === 0) return null;

  const renderItems = (key: string) => (
    <span key={key} className="inline-flex items-center">
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center">
          {i > 0 && <span className="text-slate-700 mx-3">·</span>}
          <span>{item.emoji}</span>
          <span className="text-slate-300 font-semibold ml-1">{item.name}</span>
          <span className={`ml-1 ${item.isBuy ? 'text-emerald-400' : 'text-red-400'}`}>{item.verb}</span>
          <span className={`ml-1 font-mono font-semibold ${item.isBuy ? 'text-emerald-300' : 'text-red-300'}`}>
            {item.amount.toLocaleString()}
          </span>
          <span className="text-slate-500 ml-1">$ARENA</span>
          {item.note && (
            <span className="text-slate-600 ml-2">{item.note}</span>
          )}
        </span>
      ))}
    </span>
  );

  return (
    <div className="w-full overflow-hidden bg-slate-950/80 border-t border-slate-800/50 py-1.5 group">
      <div className="animate-marquee-fast whitespace-nowrap text-xs group-hover:[animation-play-state:paused]">
        {renderItems('a')}
        <span className="inline-block w-20" />
        {renderItems('b')}
      </div>
    </div>
  );
}
