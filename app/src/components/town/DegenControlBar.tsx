type DegenNudge = 'build' | 'work' | 'fight' | 'trade';

interface OwnedAgentLite {
  id: string;
  name: string;
  archetype: string;
}

interface DegenControlBarProps {
  ownedAgent: OwnedAgentLite | null;
  loopMode: 'DEFAULT' | 'DEGEN_LOOP';
  loopUpdating: boolean;
  nudgeBusy: boolean;
  statusMessage?: string;
  statusTone?: 'neutral' | 'ok' | 'error';
  onToggleLoop: (nextMode: 'DEFAULT' | 'DEGEN_LOOP') => void;
  onNudge: (nudge: DegenNudge) => void;
}

const NUDGES: Array<{ key: DegenNudge; label: string; emoji: string }> = [
  { key: 'build', label: 'Build', emoji: '🏗️' },
  { key: 'work', label: 'Work', emoji: '🔨' },
  { key: 'fight', label: 'Fight', emoji: '⚔️' },
  { key: 'trade', label: 'Trade', emoji: '💱' },
];

export function DegenControlBar({
  ownedAgent,
  loopMode,
  loopUpdating,
  nudgeBusy,
  statusMessage,
  statusTone = 'neutral',
  onToggleLoop,
  onNudge,
}: DegenControlBarProps) {
  if (!ownedAgent) return null;

  const loopOn = loopMode === 'DEGEN_LOOP';

  return (
    <div className="w-[420px] max-w-[calc(100vw-24px)] rounded-xl border border-amber-500/30 bg-slate-950/85 p-3 backdrop-blur-md shadow-lg shadow-black/35">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-amber-300">DEGEN LOOP</div>
          <div className="truncate text-[10px] text-slate-400">
            {ownedAgent.name} · {ownedAgent.archetype}
          </div>
        </div>
        <button
          type="button"
          disabled={loopUpdating}
          onClick={() => onToggleLoop(loopOn ? 'DEFAULT' : 'DEGEN_LOOP')}
          className={`rounded-lg border px-2 py-1 text-[10px] font-mono transition-colors ${
            loopOn
              ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/45'
              : 'border-slate-700/70 bg-slate-900/40 text-slate-300 hover:bg-slate-800/45'
          } ${loopUpdating ? 'cursor-not-allowed opacity-60' : ''}`}
          title="Toggle deterministic build/work/fight/trade loop"
        >
          {loopUpdating ? 'SYNC…' : loopOn ? 'AUTO ON' : 'AUTO OFF'}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {NUDGES.map((nudge) => (
          <button
            key={nudge.key}
            type="button"
            disabled={nudgeBusy}
            onClick={() => onNudge(nudge.key)}
            className={`rounded-md border border-slate-700/70 bg-slate-900/30 px-1 py-1 text-[10px] text-slate-200 transition-colors hover:border-amber-500/50 hover:bg-slate-800/50 ${
              nudgeBusy ? 'cursor-not-allowed opacity-60' : ''
            }`}
            title={`Execute deterministic ${nudge.label.toLowerCase()} command for ${ownedAgent.name}`}
          >
            <span>{nudge.emoji}</span> {nudge.label}
          </button>
        ))}
      </div>
      {statusMessage && (
        <div
          className={`mt-2 text-[10px] leading-tight ${
            statusTone === 'ok'
              ? 'text-emerald-300'
              : statusTone === 'error'
                ? 'text-rose-300'
                : 'text-slate-400'
          }`}
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
}
