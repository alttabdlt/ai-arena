type SelectedAgent = {
  id: string;
  name: string;
  archetype: string;
  bankroll: number;
  reserveBalance: number;
  wins: number;
  losses: number;
  elo: number;
  lastReasoning?: string;
  lastNarrative?: string;
  lastActionType?: string;
  lastTickAt?: string | null;
};

export type AgentOutcome = {
  id: string;
  actionType: string;
  reasoning: string;
  bankrollDelta: number;
  reserveDelta: number;
  at: string;
};

interface DesktopAgentHudPanelProps {
  selectedAgent: SelectedAgent | null;
  myAgentId: string | null;
  recentOutcomes: AgentOutcome[];
  archetypeColors: Record<string, string>;
  archetypeGlyph: Record<string, string>;
  timeAgo: (ts: string) => string;
}

export function DesktopAgentHudPanel({
  selectedAgent,
  myAgentId,
  recentOutcomes,
  archetypeColors,
  archetypeGlyph,
  timeAgo,
}: DesktopAgentHudPanelProps) {
  const formatSigned = (value: number) => {
    if (!Number.isFinite(value)) return '0';
    if (value > 0) return `+${Math.round(value)}`;
    return `${Math.round(value)}`;
  };

  const deltaToneClass = (value: number) => {
    if (value > 0) return 'text-emerald-300';
    if (value < 0) return 'text-rose-300';
    return 'text-slate-400';
  };

  const latestOutcome = recentOutcomes[0] || null;
  const rawReasoning = selectedAgent?.lastReasoning || '';
  const hasCreditFallback = /\binsufficient credits\b/i.test(rawReasoning);
  const reasoningAgeMs = selectedAgent?.lastTickAt ? Date.now() - new Date(selectedAgent.lastTickAt).getTime() : null;
  const staleCreditFallback = hasCreditFallback && typeof reasoningAgeMs === 'number' && Number.isFinite(reasoningAgeMs) && reasoningAgeMs > 5 * 60 * 1000;

  return (
    <div
      className="pointer-events-auto w-[340px] max-w-[calc(100vw-24px)]"
      data-testid="agent-hud-panel"
    >
      {selectedAgent && (
        <div className="hud-panel p-3" data-testid="agent-hud-card">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-4 w-4 rounded-full shrink-0"
              style={{ backgroundColor: archetypeColors[selectedAgent.archetype] || '#93c5fd' }}
            />
            <div className="min-w-0">
              <div className="font-mono text-sm font-semibold text-slate-100 truncate">
                {(archetypeGlyph[selectedAgent.archetype] || '●') + ' ' + selectedAgent.name}
                {selectedAgent.id === myAgentId && (
                  <span className="ml-1.5 text-[9px] text-amber-400 font-sans font-medium bg-amber-500/10 px-1.5 py-0.5 rounded">
                    YOU
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400">{selectedAgent.archetype}</div>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] text-slate-300">
            <div className="rounded-md border border-slate-800 bg-slate-950/40 p-1.5 text-center">
              <div className="text-slate-500">$ARENA</div>
              <div className="font-mono text-slate-100">{Math.round(selectedAgent.bankroll)}</div>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950/40 p-1.5 text-center">
              <div className="text-slate-500">RESERVE</div>
              <div className="font-mono text-slate-100">{Math.round(selectedAgent.reserveBalance)}</div>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950/40 p-1.5 text-center">
              <div className="text-slate-500">W/L</div>
              <div className="font-mono text-slate-100">
                {selectedAgent.wins}/{selectedAgent.losses}
              </div>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950/40 p-1.5 text-center">
              <div className="text-slate-500">ELO</div>
              <div className="font-mono text-slate-100">{selectedAgent.elo}</div>
            </div>
          </div>
          {selectedAgent.lastReasoning && (
            <div className="mt-2 pt-2 border-t border-slate-800/50" data-testid="agent-hud-reasoning">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                <span>🧠</span>
                <span className="font-medium uppercase tracking-wide">
                  {(selectedAgent.lastActionType || 'thinking').replace(/_/g, ' ')}
                </span>
                {selectedAgent.lastTickAt && (
                  <span className="ml-auto">{timeAgo(selectedAgent.lastTickAt)}</span>
                )}
              </div>
              <div className="text-[11px] text-slate-300 italic leading-relaxed max-h-[80px] overflow-auto scrollbar-thin scrollbar-thumb-slate-700/60">
                &ldquo;{selectedAgent.lastReasoning.slice(0, 300)}
                {selectedAgent.lastReasoning.length > 300 ? '…' : ''}&rdquo;
              </div>
              {staleCreditFallback && (
                <div className="mt-1.5 rounded border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
                  This credit warning is old. If loop is running and credits are topped up, it should clear on the next live tick.
                </div>
              )}
              {latestOutcome && (
                <div className="mt-1.5 flex items-center gap-2 text-[10px]">
                  <span className={deltaToneClass(latestOutcome.bankrollDelta)}>
                    Δ$A {formatSigned(latestOutcome.bankrollDelta)}
                  </span>
                  <span className={deltaToneClass(latestOutcome.reserveDelta)}>
                    ΔR {formatSigned(latestOutcome.reserveDelta)}
                  </span>
                </div>
              )}
            </div>
          )}
          {recentOutcomes.length > 0 && (
            <div
              className="mt-2 rounded-md border border-slate-800/70 bg-slate-950/30 p-2"
              data-testid="agent-hud-outcomes"
            >
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">Recent Outcomes</div>
              <div className="space-y-1.5">
                {recentOutcomes.slice(0, 3).map((outcome) => (
                  <div key={outcome.id} className="rounded border border-slate-800/70 bg-slate-950/45 p-1.5">
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="font-medium uppercase tracking-wide text-slate-300">
                        {outcome.actionType.replace(/_/g, ' ')}
                      </span>
                      <span className={deltaToneClass(outcome.bankrollDelta)}>
                        {formatSigned(outcome.bankrollDelta)} $A
                      </span>
                      <span className={deltaToneClass(outcome.reserveDelta)}>
                        {formatSigned(outcome.reserveDelta)} R
                      </span>
                      <span className="ml-auto text-slate-500">{timeAgo(outcome.at)}</span>
                    </div>
                    <div className="mt-1 text-[10px] leading-snug text-slate-400">
                      {outcome.reasoning.slice(0, 120)}
                      {outcome.reasoning.length > 120 ? '…' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
