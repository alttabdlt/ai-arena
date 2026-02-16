type DegenNudge = 'build' | 'work' | 'fight' | 'trade';

interface BottomCenterHudProps {
  agentName: string | null;
  archetype: string | null;
  bankroll: number | null;
  wins: number;
  losses: number;
  elo: number;
  loopMode: 'DEFAULT' | 'DEGEN_LOOP';
  loopUpdating: boolean;
  nudgeBusy: boolean;
  recommendedNudge: DegenNudge | null;
  blockers: Partial<Record<DegenNudge, string>>;
  onToggleLoop: (next: 'DEFAULT' | 'DEGEN_LOOP') => void;
  onNudge: (nudge: DegenNudge) => void;
  onOpenFunding: () => void;
  onDeploy: () => void;
  hasAgent: boolean;
}

const ACTIONS: Array<{ key: DegenNudge; emoji: string; label: string }> = [
  { key: 'build', emoji: '🏗', label: 'Build' },
  { key: 'work', emoji: '🔨', label: 'Work' },
  { key: 'fight', emoji: '⚔', label: 'Fight' },
  { key: 'trade', emoji: '💱', label: 'Trade' },
];

export function BottomCenterHud({
  agentName,
  archetype,
  bankroll,
  wins,
  losses,
  elo,
  loopMode,
  loopUpdating,
  nudgeBusy,
  recommendedNudge,
  blockers,
  onToggleLoop,
  onNudge,
  onOpenFunding,
  onDeploy,
  hasAgent,
}: BottomCenterHudProps) {
  const lowBankroll = bankroll !== null && bankroll < 30;

  return (
    <div className="pointer-events-auto w-[560px] max-w-[calc(100vw-32px)] rounded-2xl border border-slate-700/50 bg-slate-950/92 backdrop-blur-xl shadow-2xl px-5 py-4">
      {/* Hero balance */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="text-[11px] font-mono uppercase text-slate-400">$ARENA</span>
          <span className={`text-3xl font-black tabular-nums ${hasAgent ? 'text-amber-300' : 'text-slate-600'}`}>
            {hasAgent && bankroll !== null ? Math.round(bankroll).toLocaleString() : '--'}
          </span>
        </div>
        {/* Stat line */}
        {hasAgent && (
          <div className="mt-1 text-[11px] font-mono text-slate-400 tracking-wide">
            W:{wins} &nbsp;L:{losses} &nbsp;ELO {Math.round(elo).toLocaleString()}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-3 flex items-center justify-center gap-2">
        {ACTIONS.map(({ key, emoji, label }) => {
          const isBlocked = Boolean(blockers[key]);
          const isRecommended = recommendedNudge === key;
          return (
            <button
              key={key}
              type="button"
              disabled={!hasAgent || nudgeBusy || isBlocked}
              onClick={() => onNudge(key)}
              className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl border text-xs font-semibold transition-all ${
                isRecommended && hasAgent
                  ? 'border-amber-400/60 bg-amber-500/15 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.18)]'
                  : 'border-slate-700/50 bg-slate-900/50 text-slate-300'
              } ${isBlocked || !hasAgent ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-800/60 hover:border-slate-600/70'}`}
              title={isBlocked ? blockers[key] : label}
            >
              <span className="text-lg leading-none">{emoji}</span>
              <span className="mt-0.5">{label}</span>
            </button>
          );
        })}

        {/* Fund / Deploy button */}
        {hasAgent ? (
          <button
            type="button"
            onClick={onOpenFunding}
            className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl border text-xs font-semibold transition-all ${
              lowBankroll
                ? 'border-rose-500/60 bg-rose-500/15 text-rose-200 animate-pulse'
                : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
            }`}
            title="Fund your agent"
          >
            <span className="text-lg leading-none">⛽</span>
            <span className="mt-0.5">Fund</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onDeploy}
            className="flex flex-col items-center justify-center w-16 h-12 rounded-xl border border-amber-500/60 bg-gradient-to-b from-amber-600/70 to-orange-600/70 text-xs font-bold text-white transition-all hover:from-amber-500 hover:to-orange-500"
          >
            <span className="text-lg leading-none">🤖</span>
            <span className="mt-0.5">Deploy</span>
          </button>
        )}
      </div>

      {/* Bottom row: AUTO toggle + agent name */}
      <div className="mt-3 flex items-center justify-between">
        {hasAgent ? (
          <button
            type="button"
            disabled={loopUpdating}
            onClick={() => onToggleLoop(loopMode === 'DEGEN_LOOP' ? 'DEFAULT' : 'DEGEN_LOOP')}
            className={`rounded-full px-3 py-1 text-[10px] font-mono font-semibold border transition-colors ${
              loopMode === 'DEGEN_LOOP'
                ? 'border-emerald-500/60 bg-emerald-950/50 text-emerald-300'
                : 'border-slate-700/60 bg-slate-900/50 text-slate-400'
            } ${loopUpdating ? 'opacity-50' : ''}`}
          >
            {loopMode === 'DEGEN_LOOP' ? 'AUTO ON' : 'AUTO OFF'}
          </button>
        ) : (
          <span className="text-[10px] text-slate-600 font-mono">No agent</span>
        )}
        <span className="text-[11px] font-mono text-slate-400 truncate max-w-[220px]">
          {agentName ? `${agentName} · ${archetype || ''}` : 'Spectator'}
        </span>
      </div>
    </div>
  );
}
