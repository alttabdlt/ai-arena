type ActivitySwapItem = {
  id: string;
  createdAt: string;
  agent?: { id?: string; name?: string; archetype?: string };
  side: 'BUY_ARENA' | 'SELL_ARENA';
  amountIn: number;
  amountOut: number;
};

type ActivityEventItem = {
  id: string;
  agentId: string | null;
  eventType: string;
  title: string;
  description: string;
  metadata: string;
  createdAt: string;
};

type ActivityItem = { kind: 'swap'; data: ActivitySwapItem } | { kind: 'event'; data: ActivityEventItem };

type AgentLite = {
  id: string;
  name: string;
  archetype: string;
};

type LatestThought = {
  agentId: string;
  agentName: string;
  archetype: string;
  actionType: string;
  reasoning: string;
  tickAt: string;
  isMine: boolean;
};

type EconomyAuditCheck = {
  code: string;
  ok: boolean;
  message: string;
};

type EconomyAuditSnapshot = {
  ok: boolean;
  currentTick: number;
  loopRunning: boolean;
  sampledAt: string;
  baseline: {
    trackedArenaFloat: number;
    capturedAtTick: number;
    capturedAt: string;
    driftSinceBaseline: number;
  } | null;
  snapshot: {
    agentCount: number;
    trackedArenaFloat: number;
    budgetTotals: {
      sum: number;
      warBudget: number;
    };
  };
  ledger: {
    totalRows: number;
    lookbackRows: number;
    latestEntryAt: string | null;
  };
  checks: EconomyAuditCheck[];
};

interface DesktopActivityPanelProps {
  activityFeed: ActivityItem[];
  recentSwapsCount: number;
  ownedAgentId: string | null;
  focusAgentId?: string | null;
  agentById: ReadonlyMap<string, AgentLite>;
  latestThoughts: LatestThought[];
  economyAudit: EconomyAuditSnapshot | null;
  archetypeColors: Record<string, string>;
  archetypeGlyph: Record<string, string>;
  timeAgo: (ts: string) => string;
  safeTrim: (value: unknown, maxLen: number) => string;
  formatTimeLeft: (ms: number) => string;
}

export function DesktopActivityPanel({
  activityFeed,
  recentSwapsCount,
  ownedAgentId,
  focusAgentId,
  agentById,
  latestThoughts,
  economyAudit,
  archetypeColors,
  archetypeGlyph,
  timeAgo,
  safeTrim,
  formatTimeLeft,
}: DesktopActivityPanelProps) {
  const targetAgentId = focusAgentId || ownedAgentId;
  const targetAgent = targetAgentId ? agentById.get(targetAgentId) ?? null : null;
  const targetThoughts = targetAgentId
    ? latestThoughts.filter((thought) => thought.agentId === targetAgentId)
    : [];
  const isOwnedFocus = !!targetAgentId && targetAgentId === ownedAgentId;

  const formatBlock = (value: unknown): string => {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const includesTargetAgent = (item: ActivityItem): boolean => {
    if (!targetAgentId) return false;
    if (item.kind === 'swap') return item.data.agent?.id === targetAgentId;
    const eventItem = item.data;
    if (eventItem.agentId === targetAgentId) return true;
    try {
      const metadata = JSON.parse(eventItem.metadata || '{}') as Record<string, unknown>;
      if (metadata?.winnerId === targetAgentId || metadata?.loserId === targetAgentId) return true;
      if (Array.isArray(metadata?.participants)) {
        return metadata.participants.some((participant) => participant === targetAgentId);
      }
      return false;
    } catch {
      return false;
    }
  };

  const targetFeed = activityFeed.filter(includesTargetAgent);

  return (
    <div
      className="pointer-events-auto w-[420px] max-w-[calc(100vw-24px)]"
      data-testid="activity-panel"
    >
      <div className="hud-panel p-3" data-testid="agent-activity-log">
        {(targetFeed.length > 0 || recentSwapsCount > 0 || targetAgentId) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-100">
                <span>{isOwnedFocus ? '📋 Your Agent Log' : '📋 Agent Log'}</span>
                {targetAgent && (
                  <span className="font-mono text-amber-300">
                    {archetypeGlyph[targetAgent.archetype] || '●'} {targetAgent.name}
                    {isOwnedFocus && <span className="ml-1 text-[9px] text-amber-400">YOU</span>}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-500">
                {recentSwapsCount > 0 ? `swaps ${recentSwapsCount}` : ''}
              </div>
            </div>
            {!targetAgentId && (
              <div className="rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[11px] text-slate-400">
                Select an agent or connect your wallet-owned agent to see a focused activity log.
              </div>
            )}
            <div className="max-h-[220px] overflow-auto pr-1 space-y-1 scrollbar-thin scrollbar-thumb-slate-700/60">
              {targetFeed
                .map((item) => {
                  if (item.kind === 'swap') {
                    const swap = item.data;
                    const color = archetypeColors[swap.agent?.archetype || ''] || '#93c5fd';
                    const glyph = archetypeGlyph[swap.agent?.archetype || ''] || '●';
                    const isBuy = swap.side === 'BUY_ARENA';
                    const price = isBuy
                      ? swap.amountIn / Math.max(1, swap.amountOut)
                      : swap.amountOut / Math.max(1, swap.amountIn);
                    const amountArena = isBuy ? swap.amountOut : swap.amountIn;
                    return (
                      <div
                        key={swap.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-slate-800/50 bg-slate-950/30 px-2 py-1 text-[11px] text-slate-300 transition-colors hover:bg-slate-900/30"
                      >
                        <div className="min-w-0 truncate">
                          <span className="text-slate-500">💱</span>{' '}
                          <span className="font-mono" style={{ color }}>
                            {glyph} {swap.agent?.name || 'Unknown'}
                          </span>{' '}
                          <span className="text-slate-400">{isBuy ? 'bought' : 'sold'}</span>{' '}
                          <span className="font-mono text-slate-200">{Math.round(amountArena).toLocaleString()}</span>{' '}
                          <span className="text-slate-400">ARENA</span>
                        </div>
                        <div className="shrink-0 font-mono text-slate-500">@ {price.toFixed(3)}</div>
                      </div>
                    );
                  }

                  const eventItem = item.data;
                  const agent = eventItem.agentId ? agentById.get(eventItem.agentId) : null;
                  const color = agent ? archetypeColors[agent.archetype] || '#93c5fd' : '#93c5fd';
                  const glyph = agent ? archetypeGlyph[agent.archetype] || '●' : '●';

                  let metadata: unknown = null;
                  try {
                    metadata = JSON.parse(eventItem.metadata || '{}');
                  } catch {
                    metadata = null;
                  }
                  const metadataObject = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : null;
                  const kind = typeof metadataObject?.kind === 'string' ? metadataObject.kind : '';
                  const skillName = typeof metadataObject?.skill === 'string' ? metadataObject.skill : null;
                  const participants = Array.isArray(metadataObject?.participants)
                    ? metadataObject.participants.filter((participant): participant is string => typeof participant === 'string')
                    : [];
                  type LineLike = { agentId?: unknown; text?: unknown };
                  const rawLines = Array.isArray(metadataObject?.lines) ? metadataObject.lines : [];
                  const lines: LineLike[] = rawLines.filter((line): line is LineLike => !!line && typeof line === 'object');

                  const isSkill = kind === 'X402_SKILL' && !!skillName;
                  const isChat = kind === 'AGENT_CHAT' && participants.length >= 2 && lines.length >= 1;
                  const isRelationshipChange = kind === 'RELATIONSHIP_CHANGE' && participants.length >= 2;
                  const objectiveType = typeof metadataObject?.objectiveType === 'string'
                    ? String(metadataObject.objectiveType).toUpperCase()
                    : '';
                  const isObjective = kind === 'TOWN_OBJECTIVE' && participants.length >= 2;
                  const isObjectiveResolved = kind === 'TOWN_OBJECTIVE_RESOLVED' && participants.length >= 2;
                  const resolution = isObjectiveResolved ? String(metadataObject?.resolution || '').toUpperCase() : '';

                  const relationshipTo = isRelationshipChange ? String(metadataObject?.to || '').toUpperCase() : '';
                  const relationshipEmoji = relationshipTo === 'FRIEND' ? '🤝' : relationshipTo === 'RIVAL' ? '💢' : '🧊';

                  const objectiveEmoji = isObjective
                    ? objectiveType === 'RACE_CLAIM'
                      ? '🏁'
                      : objectiveType === 'PACT_CLAIM'
                        ? '🤝'
                        : '🎯'
                    : '';
                  const objectiveResolvedEmoji = isObjectiveResolved
                    ? resolution === 'FULFILLED'
                      ? '✅'
                      : resolution === 'BROKEN'
                        ? '💔'
                        : resolution === 'SNIPED'
                          ? '🪓'
                          : resolution === 'CLAIMED'
                            ? '🏆'
                            : '🎯'
                    : '';

                  const emoji = isSkill
                    ? '💳'
                    : isChat
                      ? '💬'
                      : isRelationshipChange
                        ? relationshipEmoji
                        : isObjective
                          ? objectiveEmoji
                          : isObjectiveResolved
                            ? objectiveResolvedEmoji
                            : eventItem.eventType === 'PLOT_CLAIMED'
                              ? '📍'
                              : eventItem.eventType === 'BUILD_STARTED'
                                ? '🏗️'
                                : eventItem.eventType === 'BUILD_COMPLETED'
                                  ? '✅'
                                  : eventItem.eventType === 'TOWN_COMPLETED'
                                    ? '🎉'
                                    : eventItem.eventType === 'YIELD_DISTRIBUTED'
                                      ? '💎'
                                      : eventItem.eventType === 'TRADE'
                                        ? '💱'
                                        : '📝';

                  const chatSnippet = isChat && typeof lines[0]?.text === 'string' ? lines[0].text.slice(0, 70) : '';
                  const expiresAtMs = isObjective ? Number(metadataObject?.expiresAtMs || 0) : Number.NaN;
                  const leftMs = Number.isFinite(expiresAtMs) ? expiresAtMs - Date.now() : 0;
                  const description = isSkill
                    ? eventItem.description || `bought ${(skillName ?? '').toUpperCase()}`
                    : isChat
                      ? chatSnippet
                        ? `chatted: "${chatSnippet}${chatSnippet.length >= 70 ? '…' : ''}"`
                        : 'chatted'
                      : isRelationshipChange
                        ? eventItem.title || (relationshipTo === 'FRIEND' ? 'became friends' : relationshipTo === 'RIVAL' ? 'became rivals' : 'changed relationship')
                        : isObjective
                          ? `${safeTrim(eventItem.title || 'Objective', 120)}${leftMs > 0 ? ` · ${formatTimeLeft(leftMs)} left` : ''}`
                          : isObjectiveResolved
                            ? eventItem.title || 'Objective resolved'
                            : eventItem.eventType === 'PLOT_CLAIMED'
                              ? eventItem.title || 'claimed a plot'
                              : eventItem.eventType === 'BUILD_STARTED'
                                ? eventItem.title || 'started building'
                                : eventItem.eventType === 'BUILD_COMPLETED'
                                  ? eventItem.title || 'completed a build'
                                  : eventItem.eventType === 'TOWN_COMPLETED'
                                    ? eventItem.title || 'Town completed!'
                                    : eventItem.title || eventItem.description || eventItem.eventType;

                  const isPairEvent = (isChat || isRelationshipChange || isObjective || isObjectiveResolved) && participants.length >= 2;
                  const participantA = isPairEvent && participants[0] ? agentById.get(participants[0]) : null;
                  const participantB = isPairEvent && participants[1] ? agentById.get(participants[1]) : null;
                  const header = (
                    <div className="min-w-0 truncate">
                      <span>{emoji}</span>{' '}
                      {isPairEvent && participantA && participantB ? (
                        <>
                          <span className="font-mono" style={{ color: archetypeColors[participantA.archetype] || '#93c5fd' }}>
                            {(archetypeGlyph[participantA.archetype] || '●')} {participantA.name}
                          </span>
                          <span className="text-slate-600"> ↔ </span>
                          <span className="font-mono" style={{ color: archetypeColors[participantB.archetype] || '#93c5fd' }}>
                            {(archetypeGlyph[participantB.archetype] || '●')} {participantB.name}
                          </span>{' '}
                        </>
                      ) : agent ? (
                        <span className="font-mono" style={{ color }}>
                          {glyph} {agent.name}
                        </span>
                      ) : null}{' '}
                      <span className="text-slate-400">{description}</span>
                    </div>
                  );

                  if (isChat) {
                    const chatLines = lines
                      .map((line) => ({
                        agentId: typeof line.agentId === 'string' ? line.agentId : '',
                        text: typeof line.text === 'string' ? line.text : '',
                      }))
                      .filter((line) => line.agentId && line.text);

                    const relationship = metadataObject?.relationship;
                    const relationshipObject = relationship && typeof relationship === 'object'
                      ? (relationship as Record<string, unknown>)
                      : null;
                    const relationshipStatus = typeof relationshipObject?.status === 'string' ? relationshipObject.status : null;
                    const relationshipScore = relationshipObject?.score != null ? Number(relationshipObject.score) : null;

                    return (
                      <details
                        key={eventItem.id}
                        className="rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[11px] text-slate-300"
                        data-testid="agent-log-chat"
                      >
                        <summary className="cursor-pointer select-none flex items-center justify-between gap-2">
                          {header}
                          <span className="shrink-0 text-slate-600">· {timeAgo(eventItem.createdAt)}</span>
                        </summary>
                        <div className="mt-1 space-y-1">
                          {chatLines.map((line, lineIndex) => {
                            const lineAgent = agentById.get(line.agentId);
                            const lineGlyph = lineAgent ? archetypeGlyph[lineAgent.archetype] || '●' : '●';
                            const lineColor = lineAgent ? archetypeColors[lineAgent.archetype] || '#93c5fd' : '#93c5fd';
                            const lineName = lineAgent?.name || line.agentId.slice(0, 6);
                            return (
                              <div key={lineIndex} className="font-mono text-[10px]">
                                <span style={{ color: lineColor }}>
                                  {lineGlyph} {lineName}:
                                </span>{' '}
                                <span className="text-slate-300">"{line.text}"</span>
                              </div>
                            );
                          })}
                          {relationshipStatus && (
                            <div className="text-[10px] text-slate-500">
                              rel: {relationshipStatus} · score {Number.isFinite(relationshipScore) ? relationshipScore : 0}
                            </div>
                          )}
                        </div>
                      </details>
                    );
                  }

                  if (isObjective || isObjectiveResolved) {
                    const extra = isObjective && leftMs > 0 ? `expires in ${formatTimeLeft(leftMs)}` : null;
                    return (
                      <details
                        key={eventItem.id}
                        className="rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[11px] text-slate-300"
                        data-testid="agent-log-objective"
                      >
                        <summary className="cursor-pointer select-none flex items-center justify-between gap-2">
                          {header}
                          <span className="shrink-0 text-slate-600">· {timeAgo(eventItem.createdAt)}</span>
                        </summary>
                        <div className="mt-1 space-y-1 text-[10px] text-slate-400">
                          {eventItem.description && <div className="whitespace-pre-wrap">{safeTrim(eventItem.description, 420)}</div>}
                          {extra && <div className="text-slate-500">{extra}</div>}
                        </div>
                      </details>
                    );
                  }

                  const decisionRaw = metadataObject?.decision;
                  const decision = decisionRaw && typeof decisionRaw === 'object'
                    ? (decisionRaw as Record<string, unknown>)
                    : null;
                  const executedReasoning = typeof decision?.executedReasoning === 'string'
                    ? decision.executedReasoning
                    : typeof metadataObject?.reasoning === 'string'
                      ? String(metadataObject.reasoning)
                      : '';
                  const chosenReasoning = typeof decision?.chosenReasoning === 'string' ? decision.chosenReasoning : '';
                  const calculations = decision?.calculations ?? metadataObject?.calculations ?? null;
                  const chosenDetails = decision?.chosenDetails ?? null;
                  const executedDetails = decision?.executedDetails ?? metadataObject?.details ?? null;
                  const redirectReason = typeof decision?.redirectReason === 'string' ? decision.redirectReason : '';
                  const redirected = decision?.redirected === true;
                  const autonomyRateAfter = typeof decision?.autonomyRateAfter === 'number'
                    ? decision.autonomyRateAfter
                    : null;
                  const autonomyRateBefore = typeof decision?.autonomyRateBefore === 'number'
                    ? decision.autonomyRateBefore
                    : null;
                  const softPolicyEnabled = typeof decision?.softPolicyEnabled === 'boolean'
                    ? decision.softPolicyEnabled
                    : null;
                  const softPolicyApplied = decision?.softPolicyApplied === true;
                  type PolicyNote = { tier?: unknown; code?: unknown; message?: unknown; applied?: unknown };
                  const rawPolicyNotes = Array.isArray(decision?.policyNotes) ? decision.policyNotes : [];
                  const policyNotes: PolicyNote[] = rawPolicyNotes.filter(
                    (note): note is PolicyNote => !!note && typeof note === 'object',
                  );
                  type GoalItem = { horizon?: unknown; title?: unknown; progressLabel?: unknown; deadlineTick?: unknown; ticksLeft?: unknown };
                  type GoalTransition = { status?: unknown; horizon?: unknown; title?: unknown; progressLabel?: unknown; arenaDelta?: unknown; healthDelta?: unknown };
                  const goalStackBeforeRaw = Array.isArray(decision?.goalStackBefore) ? decision.goalStackBefore : [];
                  const goalStackAfterRaw = Array.isArray(decision?.goalStackAfter) ? decision.goalStackAfter : [];
                  const goalTransitionsRaw = Array.isArray(decision?.goalTransitions) ? decision.goalTransitions : [];
                  const goalStackBefore: GoalItem[] = goalStackBeforeRaw.filter(
                    (goal): goal is GoalItem => !!goal && typeof goal === 'object',
                  );
                  const goalStackAfter: GoalItem[] = goalStackAfterRaw.filter(
                    (goal): goal is GoalItem => !!goal && typeof goal === 'object',
                  );
                  const goalTransitions: GoalTransition[] = goalTransitionsRaw.filter(
                    (transition): transition is GoalTransition => !!transition && typeof transition === 'object',
                  );

                  // War Market V1: multi-option decisioning fields
                  type WarOption = { type?: unknown; target?: unknown; ev?: unknown; risk?: unknown; confidence?: unknown; ttp?: unknown; reasoning?: unknown };
                  const rawWarOptions = Array.isArray(decision?.warOptions) ? decision.warOptions : [];
                  const warOptions: WarOption[] = rawWarOptions.filter(
                    (opt): opt is WarOption => !!opt && typeof opt === 'object',
                  );
                  const warObjective = typeof decision?.warObjective === 'string' ? decision.warObjective : null;
                  const fundingSource = typeof decision?.fundingSource === 'string' ? decision.fundingSource : null;
                  const chosenOptionIndex = typeof decision?.chosenOptionIndex === 'number' ? decision.chosenOptionIndex : 0;
                  const postmortemRaw = decision?.postmortem && typeof decision.postmortem === 'object' ? (decision.postmortem as Record<string, unknown>) : null;
                  const postmortem = postmortemRaw
                    ? {
                        expectedEV: typeof postmortemRaw.expectedEV === 'number' ? postmortemRaw.expectedEV : 0,
                        actualDelta: typeof postmortemRaw.actualDelta === 'number' ? postmortemRaw.actualDelta : 0,
                      }
                    : null;

                  const hasBreakdown =
                    !!executedReasoning ||
                    !!chosenReasoning ||
                    !!redirectReason ||
                    calculations != null ||
                    chosenDetails != null ||
                    executedDetails != null ||
                    policyNotes.length > 0 ||
                    autonomyRateAfter != null ||
                    goalStackBefore.length > 0 ||
                    goalStackAfter.length > 0 ||
                    goalTransitions.length > 0 ||
                    warOptions.length > 0 ||
                    !!warObjective ||
                    !!postmortem;

                  if (!hasBreakdown) {
                    return (
                      <div
                        key={eventItem.id}
                        className="rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[11px] text-slate-300"
                      >
                        <div className="flex items-center justify-between gap-2">
                          {header}
                          <span className="shrink-0 text-slate-600">· {timeAgo(eventItem.createdAt)}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <details
                      key={eventItem.id}
                      className="rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[11px] text-slate-300"
                      data-testid="agent-log-breakdown"
                    >
                      <summary className="cursor-pointer select-none flex items-center justify-between gap-2">
                        {header}
                        <span className="shrink-0 text-slate-600">· {timeAgo(eventItem.createdAt)}</span>
                      </summary>
                      <div className="mt-1 space-y-1.5 text-[10px] leading-snug">
                        {redirected && (
                          <div className="rounded border border-amber-700/40 bg-amber-950/20 px-1.5 py-1 text-amber-200">
                            Redirected by rules: {redirectReason || 'system safety/priority override'}
                          </div>
                        )}
                        {(autonomyRateAfter != null || autonomyRateBefore != null || softPolicyEnabled != null) && (
                          <div className="rounded border border-cyan-800/40 bg-cyan-950/10 px-1.5 py-1 text-cyan-200">
                            <div className="text-[9px] uppercase tracking-wide text-cyan-300/80">Autonomy metrics</div>
                            {autonomyRateBefore != null && (
                              <div>Override rate (before tick): {(autonomyRateBefore * 100).toFixed(0)}%</div>
                            )}
                            {autonomyRateAfter != null && (
                              <div>Override rate (after tick): {(autonomyRateAfter * 100).toFixed(0)}%</div>
                            )}
                            {softPolicyEnabled != null && (
                              <div>Soft policy: {softPolicyEnabled ? 'enabled' : 'paused'}{softPolicyApplied ? ' (applied this tick)' : ''}</div>
                            )}
                          </div>
                        )}
                        {chosenReasoning && (
                          <div>
                            <div className="text-slate-500 uppercase tracking-wide">Chosen reasoning</div>
                            <div className="whitespace-pre-wrap text-slate-300">{chosenReasoning}</div>
                          </div>
                        )}
                        {executedReasoning && (
                          <div>
                            <div className="text-slate-500 uppercase tracking-wide">Executed reasoning</div>
                            <div className="whitespace-pre-wrap text-slate-300">{executedReasoning}</div>
                          </div>
                        )}
                        {calculations != null && (
                          <div>
                            <div className="text-slate-500 uppercase tracking-wide">Calculations</div>
                            <pre className="mt-0.5 rounded border border-slate-800/60 bg-slate-950/70 px-1.5 py-1 whitespace-pre-wrap break-all text-slate-300">
                              {formatBlock(calculations)}
                            </pre>
                          </div>
                        )}
                        {warObjective && (
                          <div>
                            <div className="text-slate-500 text-[9px] uppercase tracking-wide">Objective</div>
                            <div className="text-slate-300 text-[10px]">{warObjective}</div>
                          </div>
                        )}
                        {warOptions.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-slate-500 text-[9px] uppercase tracking-wide">Options Evaluated</div>
                            {warOptions.map((opt, idx) => {
                              const isChosen = idx === chosenOptionIndex;
                              const ev = typeof opt.ev === 'number' ? opt.ev : 0;
                              const risk = typeof opt.risk === 'number' ? opt.risk : 0;
                              const ttp = typeof opt.ttp === 'string' ? opt.ttp : '';
                              const optType = typeof opt.type === 'string' ? opt.type : '?';
                              const optTarget = typeof opt.target === 'string' ? opt.target : null;
                              const optReasoning = typeof opt.reasoning === 'string' ? opt.reasoning : '';
                              return (
                                <div key={idx} className={`rounded border px-1.5 py-0.5 ${isChosen ? 'border-amber-500/50 bg-amber-950/20' : 'border-slate-700/50'}`}>
                                  <div className="flex items-center gap-2 text-[9px] uppercase font-mono">
                                    <span className="text-slate-300">{isChosen ? '► ' : '  '}{optType}{optTarget ? ` → ${optTarget}` : ''}</span>
                                    <span className="ml-auto" style={{ color: ev >= 0 ? '#34d399' : '#f87171' }}>
                                      EV {ev >= 0 ? '+' : ''}{ev}
                                    </span>
                                    <span className="text-slate-500">risk {Math.round(risk * 100)}%</span>
                                    {ttp && <span className="text-slate-600">{ttp}</span>}
                                  </div>
                                  <div className="mt-0.5 h-0.5 w-full rounded bg-slate-800">
                                    <div className="h-0.5 rounded" style={{
                                      width: `${Math.min(100, Math.abs(ev))}%`,
                                      background: ev >= 0 ? '#34d399' : '#f87171'
                                    }} />
                                  </div>
                                  {isChosen && optReasoning && (
                                    <div className="text-[10px] text-slate-400 italic mt-0.5">{optReasoning.slice(0, 100)}</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {fundingSource && (
                          <div className="text-[10px] text-slate-500">
                            Funding: <span className="text-slate-300">{fundingSource}</span>
                          </div>
                        )}
                        {postmortem && (
                          <div className="flex gap-3 text-[10px]">
                            <span className="text-slate-500">Expected EV: <span className="text-slate-300">{postmortem.expectedEV >= 0 ? '+' : ''}{postmortem.expectedEV}</span></span>
                            <span style={{ color: postmortem.actualDelta >= 0 ? '#34d399' : '#f87171' }}>
                              Actual: {postmortem.actualDelta >= 0 ? '+' : ''}{postmortem.actualDelta}
                            </span>
                          </div>
                        )}
                        {chosenDetails != null && (
                          <div>
                            <div className="text-slate-500 uppercase tracking-wide">Chosen action details</div>
                            <pre className="mt-0.5 rounded border border-slate-800/60 bg-slate-950/70 px-1.5 py-1 whitespace-pre-wrap break-all text-slate-300">
                              {formatBlock(chosenDetails)}
                            </pre>
                          </div>
                        )}
                        {executedDetails != null && (
                          <div>
                            <div className="text-slate-500 uppercase tracking-wide">Executed action details</div>
                            <pre className="mt-0.5 rounded border border-slate-800/60 bg-slate-950/70 px-1.5 py-1 whitespace-pre-wrap break-all text-slate-300">
                              {formatBlock(executedDetails)}
                            </pre>
                          </div>
                        )}
                        {policyNotes.length > 0 && (
                          <div>
                            <div className="text-slate-500 uppercase tracking-wide">Policy notes</div>
                            <div className="space-y-1">
                              {policyNotes.map((note, idx) => {
                                const tier = typeof note.tier === 'string' ? note.tier : 'unknown';
                                const code = typeof note.code === 'string' ? note.code : 'POLICY_NOTE';
                                const message = typeof note.message === 'string' ? note.message : '';
                                const applied = note.applied === true;
                                return (
                                  <div
                                    key={`${code}:${idx}`}
                                    className={`rounded border px-1.5 py-1 ${
                                      applied
                                        ? 'border-amber-700/50 bg-amber-950/20 text-amber-200'
                                        : 'border-slate-700/50 bg-slate-900/30 text-slate-300'
                                    }`}
                                  >
                                    <div className="text-[9px] uppercase tracking-wide">
                                      {tier} · {code} {applied ? '(applied)' : '(advisory)'}
                                    </div>
                                    {message && <div className="whitespace-pre-wrap">{message}</div>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {goalStackBefore.length > 0 && (
                          <div>
                            <div className="text-slate-500 uppercase tracking-wide">Goal stack (before)</div>
                            <div className="space-y-1">
                              {goalStackBefore.map((goal, idx) => {
                                const horizon = typeof goal.horizon === 'string' ? goal.horizon : 'GOAL';
                                const title = typeof goal.title === 'string' ? goal.title : 'Untitled goal';
                                const progress = typeof goal.progressLabel === 'string' ? goal.progressLabel : '';
                                const ticksLeft = typeof goal.ticksLeft === 'number' ? goal.ticksLeft : null;
                                return (
                                  <div key={`goal-before:${idx}`} className="rounded border border-slate-700/50 bg-slate-900/30 px-1.5 py-1 text-slate-300">
                                    <div className="text-[9px] uppercase tracking-wide">{horizon}</div>
                                    <div>{title}</div>
                                    {progress && <div className="text-slate-400">{progress}</div>}
                                    {ticksLeft != null && <div className="text-slate-500">{ticksLeft} ticks left</div>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {goalStackAfter.length > 0 && (
                          <div>
                            <div className="text-slate-500 uppercase tracking-wide">Goal stack (after)</div>
                            <div className="space-y-1">
                              {goalStackAfter.map((goal, idx) => {
                                const horizon = typeof goal.horizon === 'string' ? goal.horizon : 'GOAL';
                                const title = typeof goal.title === 'string' ? goal.title : 'Untitled goal';
                                const progress = typeof goal.progressLabel === 'string' ? goal.progressLabel : '';
                                const ticksLeft = typeof goal.ticksLeft === 'number' ? goal.ticksLeft : null;
                                return (
                                  <div key={`goal-after:${idx}`} className="rounded border border-slate-700/50 bg-slate-900/30 px-1.5 py-1 text-slate-300">
                                    <div className="text-[9px] uppercase tracking-wide">{horizon}</div>
                                    <div>{title}</div>
                                    {progress && <div className="text-slate-400">{progress}</div>}
                                    {ticksLeft != null && <div className="text-slate-500">{ticksLeft} ticks left</div>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {goalTransitions.length > 0 && (
                          <div>
                            <div className="text-slate-500 uppercase tracking-wide">Goal transitions</div>
                            <div className="space-y-1">
                              {goalTransitions.map((transition, idx) => {
                                const status = typeof transition.status === 'string' ? transition.status : 'UPDATED';
                                const horizon = typeof transition.horizon === 'string' ? transition.horizon : 'GOAL';
                                const title = typeof transition.title === 'string' ? transition.title : 'Goal';
                                const progress = typeof transition.progressLabel === 'string' ? transition.progressLabel : '';
                                const arenaDelta = typeof transition.arenaDelta === 'number' ? transition.arenaDelta : 0;
                                const healthDelta = typeof transition.healthDelta === 'number' ? transition.healthDelta : 0;
                                const deltaBits = [
                                  arenaDelta !== 0 ? `${arenaDelta > 0 ? '+' : ''}${arenaDelta} ARENA` : '',
                                  healthDelta !== 0 ? `${healthDelta > 0 ? '+' : ''}${healthDelta} HP` : '',
                                ].filter(Boolean).join(' · ');
                                return (
                                  <div
                                    key={`goal-transition:${idx}`}
                                    className={`rounded border px-1.5 py-1 ${
                                      status === 'COMPLETED'
                                        ? 'border-emerald-700/50 bg-emerald-950/20 text-emerald-200'
                                        : 'border-rose-700/50 bg-rose-950/20 text-rose-200'
                                    }`}
                                  >
                                    <div className="text-[9px] uppercase tracking-wide">
                                      {status} · {horizon}
                                    </div>
                                    <div>{title}</div>
                                    {progress && <div className="text-[10px]">{progress}</div>}
                                    {deltaBits && <div className="text-[10px]">{deltaBits}</div>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })}
            </div>
          </div>
        )}

        {targetThoughts.length > 0 && (
          <div className="mt-3 pt-2 border-t border-slate-800/40" data-testid="decision-trace-panel">
            <div className="text-[11px] font-semibold text-slate-100 mb-2">🧠 Decision Trace</div>
            <div className="max-h-[200px] overflow-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700/60">
              {targetThoughts.slice(0, 12).map((thought, idx) => {
                const color = archetypeColors[thought.archetype] || '#93c5fd';
                const glyph = archetypeGlyph[thought.archetype] || '●';
                const actionEmoji: Record<string, string> = {
                  buy_arena: '💰',
                  sell_arena: '📤',
                  claim_plot: '📍',
                  start_build: '🏗️',
                  do_work: '🔨',
                  complete_build: '✅',
                  mine: '⛏️',
                  play_arena: '🎮',
                  buy_skill: '💳',
                  rest: '😴',
                  transfer_arena: '💸',
                  raid: '⚔️',
                  heist: '🥷',
                  defend: '🛡️',
                };
                return (
                  <details
                    key={`${thought.agentId}:${thought.tickAt}`}
                    className="rounded-md border border-amber-500/40 bg-amber-950/20 px-2 py-1 text-[11px] text-slate-300"
                    open
                    data-testid={`decision-trace-item-${idx}`}
                  >
                    <summary className="cursor-pointer select-none flex items-center justify-between gap-2">
                      <div className="min-w-0 truncate">
                        <span>{actionEmoji[thought.actionType] || '🤔'}</span>{' '}
                        {thought.isMine && <span className="text-amber-400 text-[9px] mr-1">YOU</span>}
                        <span className="font-mono" style={{ color }}>
                          {glyph} {thought.agentName}
                        </span>{' '}
                        <span className="text-slate-400">{thought.actionType.replace(/_/g, ' ')}</span>
                      </div>
                      <span className="shrink-0 text-slate-600">· {timeAgo(thought.tickAt)}</span>
                    </summary>
                    <div className="mt-1 text-[10px] text-slate-400 italic leading-relaxed whitespace-pre-wrap">
                      &ldquo;{thought.reasoning}&rdquo;
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        )}

        {economyAudit && (
          <div className="mt-3 pt-2 border-t border-slate-800/40" data-testid="economy-audit-panel">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold">
              <span className="text-slate-100">🏦 Economy Audit</span>
              <span className={economyAudit.ok ? 'text-emerald-300' : 'text-rose-300'}>
                {economyAudit.ok ? 'PASS' : 'FAIL'}
              </span>
            </div>
            <div className="space-y-1 rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[10px] text-slate-300">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Tick</span>
                <span className="font-mono">{economyAudit.currentTick}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Loop</span>
                <span className={economyAudit.loopRunning ? 'text-emerald-300' : 'text-amber-300'}>
                  {economyAudit.loopRunning ? 'running' : 'paused'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Tracked Float</span>
                <span className="font-mono">{Math.round(economyAudit.snapshot.trackedArenaFloat).toLocaleString()} $A</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Drift</span>
                <span
                  className="font-mono"
                  style={{
                    color:
                      Number(economyAudit.baseline?.driftSinceBaseline || 0) === 0
                        ? '#34d399'
                        : '#f87171',
                  }}
                >
                  {(Number(economyAudit.baseline?.driftSinceBaseline || 0) >= 0 ? '+' : '')}
                  {Number(economyAudit.baseline?.driftSinceBaseline || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">War Budget</span>
                <span className="font-mono">{Math.round(economyAudit.snapshot.budgetTotals.warBudget).toLocaleString()} $A</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Ledger</span>
                <span className="font-mono">{economyAudit.ledger.totalRows} rows</span>
              </div>
            </div>
            <div className="mt-1.5 space-y-1">
              {economyAudit.checks.map((check) => (
                <div
                  key={check.code}
                  className={`rounded border px-1.5 py-1 text-[10px] ${
                    check.ok
                      ? 'border-emerald-800/40 bg-emerald-950/15 text-emerald-200'
                      : 'border-rose-800/40 bg-rose-950/15 text-rose-200'
                  }`}
                >
                  <div className="font-mono text-[9px] uppercase tracking-wide">
                    {check.ok ? 'PASS' : 'FAIL'} · {check.code}
                  </div>
                  <div>{safeTrim(check.message, 200)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
