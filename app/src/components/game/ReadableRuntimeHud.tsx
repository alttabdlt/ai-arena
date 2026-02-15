import { useMemo } from 'react';

export type RuntimeAgentCard = {
  agentId: string;
  name: string;
  archetype: string;
  crewName: string | null;
  state: string;
  action: string;
  reason: string;
  targetLabel: string;
  etaSec: number | null;
  blockedCode: string | null;
  lastOutcome: string;
};

export type RuntimeCrewCard = {
  crewId: string;
  name: string;
  colorHex: string;
  objective: string;
  activeOperation: string;
  impactSummary: string;
  activeMembers: Array<{ name: string; action: string; state: string }>;
};

export type RuntimeBuildingCard = {
  plotId: string;
  plotIndex: number;
  zone: string;
  status: string;
  buildingName: string | null;
  task: string;
  progressPct: number;
  etaSec: number;
  occupants: Array<{ name: string; role: string }>;
};

export type RuntimeFeedCard = {
  id: string;
  line: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | string;
};

interface ReadableRuntimeHudProps {
  ownedAgentId: string | null;
  agents: RuntimeAgentCard[];
  crews: RuntimeCrewCard[];
  buildings: RuntimeBuildingCard[];
  feed: RuntimeFeedCard[];
  running: boolean;
  tick: number;
  loading: boolean;
}

function severityClass(severity: string): string {
  if (severity === 'HIGH') return 'border-rose-500/35 bg-rose-950/25 text-rose-100';
  if (severity === 'MEDIUM') return 'border-amber-500/35 bg-amber-950/25 text-amber-100';
  return 'border-slate-700/60 bg-slate-950/35 text-slate-200';
}

export function ReadableRuntimeHud({
  ownedAgentId,
  agents,
  crews,
  buildings,
  feed,
  running,
  tick,
  loading,
}: ReadableRuntimeHudProps) {
  const ownedAgent = useMemo(
    () => (ownedAgentId ? agents.find((agent) => agent.agentId === ownedAgentId) || null : null),
    [ownedAgentId, agents],
  );

  const highlightedCrew = useMemo(() => {
    if (ownedAgent?.crewName) {
      return crews.find((crew) => crew.name === ownedAgent.crewName) || crews[0] || null;
    }
    return crews[0] || null;
  }, [ownedAgent, crews]);

  const buildingRows = useMemo(() => {
    return buildings
      .filter((building) => building.occupants.length > 0 || building.status !== 'BUILT')
      .slice(0, 6);
  }, [buildings]);

  const agentRows = useMemo(() => {
    return agents
      .filter((agent) => agent.agentId !== ownedAgentId)
      .slice(0, 6);
  }, [agents, ownedAgentId]);

  return (
    <div className="pointer-events-auto w-[390px] max-w-[calc(100vw-24px)] rounded-xl border border-cyan-500/30 bg-slate-950/88 p-3 backdrop-blur-md shadow-xl shadow-black/35">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Runtime Clarity</div>
          <div className="text-[10px] text-slate-400">Tick {tick} · {running ? 'Loop running' : 'Loop paused'}</div>
        </div>
        <div className="text-[10px] font-mono text-slate-500">{loading ? 'SYNC...' : 'LIVE'}</div>
      </div>

      <div className="space-y-2">
        <div className="rounded-lg border border-cyan-500/25 bg-slate-900/45 p-2">
          <div className="mb-1 text-[10px] font-mono text-cyan-200">MY AGENT</div>
          {ownedAgent ? (
            <>
              <div className="text-[11px] font-semibold text-slate-100">{ownedAgent.name} · {ownedAgent.state}</div>
              <div className="mt-1 text-[10px] text-slate-200"><span className="text-cyan-300/90">DOING</span> {ownedAgent.action}</div>
              <div className="text-[10px] text-slate-300"><span className="text-slate-400">WHY</span> {ownedAgent.reason || 'No reason emitted yet.'}</div>
              <div className="text-[10px] text-slate-300"><span className="text-slate-400">TO</span> {ownedAgent.targetLabel}</div>
              <div className="text-[10px] text-slate-300"><span className="text-slate-400">ETA</span> {ownedAgent.etaSec == null ? '-' : `${ownedAgent.etaSec}s`}</div>
              {ownedAgent.blockedCode && (
                <div className="mt-1 rounded border border-rose-500/35 bg-rose-950/30 px-1.5 py-1 text-[10px] text-rose-200">
                  Blocked: {ownedAgent.blockedCode}
                </div>
              )}
            </>
          ) : (
            <div className="text-[10px] text-slate-400">Deploy/select your wallet agent to enable direct runtime clarity.</div>
          )}
        </div>

        <div className="rounded-lg border border-amber-500/20 bg-slate-900/35 p-2">
          <div className="mb-1 text-[10px] font-mono text-amber-200">CREW OPS</div>
          {highlightedCrew ? (
            <>
              <div className="text-[11px] font-semibold" style={{ color: highlightedCrew.colorHex }}>{highlightedCrew.name}</div>
              <div className="text-[10px] text-slate-300"><span className="text-slate-400">OBJECTIVE</span> {highlightedCrew.objective}</div>
              <div className="text-[10px] text-slate-300"><span className="text-slate-400">ACTIVE OP</span> {highlightedCrew.activeOperation}</div>
              <div className="text-[10px] text-slate-300"><span className="text-slate-400">LAST IMPACT</span> {highlightedCrew.impactSummary}</div>
              <div className="mt-1 grid grid-cols-1 gap-1">
                {highlightedCrew.activeMembers.slice(0, 3).map((member) => (
                  <div key={`${highlightedCrew.crewId}:${member.name}`} className="rounded border border-slate-800/60 bg-slate-950/35 px-1.5 py-1 text-[10px] text-slate-300">
                    {member.name}: {member.action} ({member.state})
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-[10px] text-slate-400">No crew snapshot available.</div>
          )}
        </div>

        <div className="rounded-lg border border-slate-700/60 bg-slate-900/35 p-2">
          <div className="mb-1 text-[10px] font-mono text-slate-200">BUILDING OCCUPANCY</div>
          <div className="max-h-[110px] space-y-1 overflow-auto pr-1">
            {buildingRows.length > 0 ? buildingRows.map((building) => (
              <div key={building.plotId} className="rounded border border-slate-800/70 bg-slate-950/35 px-1.5 py-1 text-[10px] text-slate-300">
                Plot {building.plotIndex} ({building.zone}) · {building.task}
                <span className="text-slate-500"> · {building.progressPct}%</span>
                {building.etaSec > 0 && <span className="text-slate-500"> · eta {building.etaSec}s</span>}
                <div className="text-slate-400">
                  {building.occupants.length > 0
                    ? building.occupants.map((occupant) => `${occupant.name} (${occupant.role})`).join(', ')
                    : 'No active occupants'}
                </div>
              </div>
            )) : (
              <div className="text-[10px] text-slate-500">No active occupancy signals.</div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-700/60 bg-slate-900/35 p-2">
          <div className="mb-1 text-[10px] font-mono text-slate-200">LIVE FEED</div>
          <div className="max-h-[120px] space-y-1 overflow-auto pr-1">
            {feed.slice(0, 8).map((item) => (
              <div key={item.id} className={`rounded border px-1.5 py-1 text-[10px] ${severityClass(item.severity)}`}>
                {item.line}
              </div>
            ))}
            {feed.length === 0 && <div className="text-[10px] text-slate-500">No runtime events yet.</div>}
          </div>
        </div>

        {agentRows.length > 0 && (
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/35 p-2">
            <div className="mb-1 text-[10px] font-mono text-slate-200">OTHER AGENTS</div>
            <div className="max-h-[100px] space-y-1 overflow-auto pr-1">
              {agentRows.map((agent) => (
                <div key={agent.agentId} className="rounded border border-slate-800/70 bg-slate-950/30 px-1.5 py-1 text-[10px] text-slate-300">
                  {agent.name}: {agent.action} -&gt; {agent.targetLabel} ({agent.etaSec == null ? '-' : `${agent.etaSec}s`})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
