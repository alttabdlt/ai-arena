type DegenNudge = 'build' | 'work' | 'fight' | 'trade';
type DegenLoopPhase = 'BUILD' | 'WORK' | 'FIGHT' | 'TRADE';
type CrewOrderStrategy = 'RAID' | 'DEFEND' | 'FARM' | 'TRADE';

interface DegenLoopTelemetry {
  nextIndex: number;
  chain: number;
  loopsCompleted: number;
  lastPhase: DegenLoopPhase | null;
  lastAdvanceAt: number | null;
}

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
  plansLoading?: boolean;
  guidanceMission?: string;
  missionWhy?: string;
  missionBlocked?: string | null;
  missionFallback?: string | null;
  missionSuccess?: string;
  recommendedNudge?: DegenNudge | null;
  blockers?: Partial<Record<DegenNudge, string>>;
  crewOrderBusy?: boolean;
  crewName?: string | null;
  crewColor?: string | null;
  actionsLockedReason?: string | null;
  loopTelemetry: DegenLoopTelemetry | null;
  nowMs: number;
  statusMessage?: string;
  statusTone?: 'neutral' | 'ok' | 'error';
  onToggleLoop: (nextMode: 'DEFAULT' | 'DEGEN_LOOP') => void;
  onNudge: (nudge: DegenNudge) => void;
  onCrewOrder?: (strategy: CrewOrderStrategy) => void;
}

const NUDGES: Array<{ key: DegenNudge; label: string; emoji: string }> = [
  { key: 'build', label: 'Build', emoji: '🏗️' },
  { key: 'work', label: 'Work', emoji: '🔨' },
  { key: 'fight', label: 'Fight', emoji: '⚔️' },
  { key: 'trade', label: 'Trade', emoji: '💱' },
];
const LOOP_STEPS: DegenLoopPhase[] = ['BUILD', 'WORK', 'FIGHT', 'TRADE'];
const CREW_ORDER_ACTIONS: Array<{ key: CrewOrderStrategy; label: string; emoji: string }> = [
  { key: 'RAID', label: 'Raid', emoji: '⚔️' },
  { key: 'DEFEND', label: 'Defend', emoji: '🛡️' },
  { key: 'FARM', label: 'Farm', emoji: '💰' },
  { key: 'TRADE', label: 'Trade', emoji: '📈' },
];
const LOOP_PLAYBOOK: Array<{ key: DegenNudge; label: string; brief: string }> = [
  { key: 'build', label: 'BUILD', brief: 'Spend reserve to claim/upgrade plots.' },
  { key: 'work', label: 'WORK', brief: 'Refill reserve when bankroll is thin.' },
  { key: 'fight', label: 'FIGHT', brief: 'Take arena duels for $ARENA upside.' },
  { key: 'trade', label: 'TRADE', brief: 'Rebalance reserve and $ARENA for next loop.' },
];

export function DegenControlBar({
  ownedAgent,
  loopMode,
  loopUpdating,
  nudgeBusy,
  plansLoading = false,
  guidanceMission = 'Checking next move...',
  missionWhy = 'Waiting for planner state...',
  missionBlocked = null,
  missionFallback = null,
  missionSuccess = 'Complete this step to advance the loop.',
  recommendedNudge = null,
  blockers,
  crewOrderBusy = false,
  crewName = null,
  crewColor = null,
  actionsLockedReason = null,
  loopTelemetry,
  nowMs,
  statusMessage,
  statusTone = 'neutral',
  onToggleLoop,
  onNudge,
  onCrewOrder,
}: DegenControlBarProps) {
  if (!ownedAgent) {
    return (
      <div className="w-[420px] max-w-[calc(100vw-24px)] rounded-xl border border-cyan-500/35 bg-slate-950/88 p-3 backdrop-blur-md shadow-lg shadow-black/35">
        <div className="text-[11px] font-semibold text-amber-300">DEGEN LOOP</div>
        <div className="text-[10px] text-cyan-200/85">Build &gt; Work &gt; Fight &gt; Trade cycle</div>
        <div className="mt-2 rounded-lg border border-slate-700/70 bg-slate-900/45 px-2 py-2 text-[10px] leading-tight text-slate-300">
          {actionsLockedReason || 'Sign in and spawn/select your wallet-linked agent to unlock loop controls.'}
        </div>
      </div>
    );
  }

  const loopOn = loopMode === 'DEGEN_LOOP';
  const controlsLocked = Boolean(actionsLockedReason);
  const safeNextIndex = Math.max(0, Math.min(LOOP_STEPS.length - 1, loopTelemetry?.nextIndex ?? 0));
  const elapsedMs = loopTelemetry?.lastAdvanceAt != null ? Math.max(0, nowMs - loopTelemetry.lastAdvanceAt) : Number.POSITIVE_INFINITY;
  const heat = Number.isFinite(elapsedMs) ? Math.max(0, 1 - elapsedMs / 9000) : 0;
  const heatPct = Math.round(heat * 100);
  const chain = Math.max(1, loopTelemetry?.chain ?? 0);
  const loopsCompleted = Math.max(0, loopTelemetry?.loopsCompleted ?? 0);
  const lastPhase = loopTelemetry?.lastPhase;
  const recommendedLabel = NUDGES.find((nudge) => nudge.key === recommendedNudge)?.label ?? null;

  return (
    <div className="w-[420px] max-w-[calc(100vw-24px)] rounded-xl border border-amber-500/30 bg-slate-950/85 p-3 backdrop-blur-md shadow-lg shadow-black/35">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-amber-300">DEGEN LOOP</div>
          <div className="text-[10px] text-cyan-200/85">Build &gt; Work &gt; Fight &gt; Trade cycle</div>
          <div className="truncate text-[10px] text-slate-400">
            {ownedAgent.name} · {ownedAgent.archetype}
          </div>
        </div>
        <button
          type="button"
          disabled={loopUpdating || controlsLocked}
          onClick={() => onToggleLoop(loopOn ? 'DEFAULT' : 'DEGEN_LOOP')}
          className={`rounded-lg border px-2 py-1 text-[10px] font-mono transition-colors ${
            loopOn
              ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/45'
              : 'border-slate-700/70 bg-slate-900/40 text-slate-300 hover:bg-slate-800/45'
          } ${loopUpdating || controlsLocked ? 'cursor-not-allowed opacity-60' : ''}`}
          title="Toggle deterministic build/work/fight/trade loop"
        >
          {loopUpdating ? 'SYNC…' : loopOn ? 'AUTO ON' : 'AUTO OFF'}
        </button>
      </div>
      <div className="mb-2 rounded-lg border border-amber-500/25 bg-slate-900/45 px-2 py-1.5">
        <div className="mb-1 flex items-center justify-between text-[10px]">
          <span className="font-mono text-amber-200" title="Loop heat = consecutive non-rest loop actions (higher means stronger momentum).">
            HEAT x{chain}
          </span>
          <span className="font-mono text-slate-400">LOOPS {loopsCompleted}</span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {LOOP_STEPS.map((step, index) => {
            const isDone = loopTelemetry ? index < safeNextIndex : false;
            const isNext = loopTelemetry ? index === safeNextIndex : index === 0;
            const tone = isNext
              ? 'border-amber-400/70 bg-amber-500/18 text-amber-100'
              : isDone
                ? 'border-emerald-500/55 bg-emerald-500/14 text-emerald-200'
                : 'border-slate-700/70 bg-slate-900/35 text-slate-500';
            return (
              <div key={step} className={`rounded border px-1 py-0.5 text-center text-[9px] font-mono ${tone}`}>
                {step}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-800/80">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-400 to-rose-400 transition-[width] duration-200"
            style={{ width: `${heatPct}%` }}
          />
        </div>
        <div className="mt-1 text-[9px] text-slate-500">
          {loopTelemetry
            ? `Last ${lastPhase || '—'} · Next ${LOOP_STEPS[safeNextIndex]}`
            : 'Run BUILD → WORK → FIGHT → TRADE to start your chain'}
        </div>
      </div>
      <div className="mb-2 rounded-lg border border-cyan-500/20 bg-slate-900/40 px-2 py-1.5">
        <div className="mb-1 flex items-center justify-between text-[10px]">
          <span className="font-mono text-cyan-200">NEXT MISSION</span>
          <span className="font-mono text-slate-500">{plansLoading ? 'SYNC…' : recommendedLabel ? `DO ${recommendedLabel.toUpperCase()}` : 'BLOCKED'}</span>
        </div>
        <div className="space-y-1 text-[10px] leading-tight">
          <div className="text-slate-200"><span className="font-mono text-cyan-300/90">DO</span> {guidanceMission}</div>
          <div className="text-slate-400"><span className="font-mono text-slate-300">WHY</span> {missionWhy}</div>
          <div className="text-slate-400">
            <span className="font-mono text-slate-300">IF BLOCKED</span>{' '}
            {missionFallback || missionBlocked || 'Auto-redirect to the best executable fallback.'}
          </div>
          <div className="text-emerald-300/90"><span className="font-mono text-emerald-300">SUCCESS</span> {missionSuccess}</div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {NUDGES.map((nudge) => {
          const blocker = blockers?.[nudge.key];
          const disabled = controlsLocked || nudgeBusy || plansLoading || Boolean(blocker);
          const recommended = recommendedNudge === nudge.key && !blocker;
          return (
            <button
              key={nudge.key}
              type="button"
              disabled={disabled}
              onClick={() => onNudge(nudge.key)}
              className={`rounded-md border px-1 py-1 text-[10px] transition-colors ${
                blocker
                  ? 'cursor-not-allowed border-rose-500/35 bg-rose-950/20 text-rose-200/80'
                  : recommended
                    ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-100 hover:border-cyan-300/80 hover:bg-cyan-500/24'
                    : 'border-slate-700/70 bg-slate-900/30 text-slate-200 hover:border-amber-500/50 hover:bg-slate-800/50'
              } ${disabled && !blocker ? 'cursor-not-allowed opacity-60' : ''}`}
              title={blocker
                ? `${nudge.label} blocked: ${blocker}`
                : controlsLocked
                  ? actionsLockedReason || 'Sign in first to run commands'
                : `Execute deterministic ${nudge.label.toLowerCase()} command for ${ownedAgent.name}`}
            >
              <span>{nudge.emoji}</span> {nudge.label}
            </button>
          );
        })}
      </div>
      <div className="mt-2 rounded-lg border border-slate-700/60 bg-slate-900/35 px-2 py-1.5">
        <div className="mb-1 text-[10px] font-mono text-slate-300">HOW THIS LOOP WORKS</div>
        <div className="space-y-1">
          {LOOP_PLAYBOOK.map((step) => (
            <div key={step.key} className="text-[9px] leading-snug text-slate-400">
              <span className="font-mono text-slate-200">{step.label}</span> {step.brief}
            </div>
          ))}
        </div>
        <div className="mt-1 text-[9px] text-cyan-200/80">
          Telegram bot is optional. This HUD can run the full loop.
        </div>
      </div>
      {crewName && onCrewOrder && (
        <div className="mt-2 rounded-lg border border-cyan-500/25 bg-slate-900/45 px-2 py-1.5">
          <div className="mb-1 flex items-center justify-between text-[10px]">
            <span className="font-mono" style={{ color: crewColor || '#67e8f9' }}>
              ⚑ {crewName}
            </span>
            <span className="font-mono text-slate-500">Crew Orders</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {CREW_ORDER_ACTIONS.map((action) => (
              <button
                key={action.key}
                type="button"
                disabled={crewOrderBusy || controlsLocked}
                onClick={() => onCrewOrder(action.key)}
                className={`rounded-md border border-slate-700/70 bg-slate-900/35 px-1 py-1 text-[10px] text-slate-200 transition-colors hover:border-cyan-400/50 hover:bg-slate-800/55 ${
                  crewOrderBusy || controlsLocked ? 'cursor-not-allowed opacity-60' : ''
                }`}
                title={`Issue ${action.label.toUpperCase()} crew order for ${ownedAgent.name}`}
              >
                <span>{action.emoji}</span> {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
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
      {!statusMessage && controlsLocked && (
        <div className="mt-2 text-[10px] leading-tight text-amber-200">
          {actionsLockedReason}
        </div>
      )}
    </div>
  );
}
