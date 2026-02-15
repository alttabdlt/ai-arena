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

interface DesktopActivityPanelProps {
  activityFeed: ActivityItem[];
  recentSwapsCount: number;
  ownedAgentId: string | null;
  agentById: ReadonlyMap<string, AgentLite>;
  latestThoughts: LatestThought[];
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
  agentById,
  latestThoughts,
  archetypeColors,
  archetypeGlyph,
  timeAgo,
  safeTrim,
  formatTimeLeft,
}: DesktopActivityPanelProps) {
  const ownedAgent = ownedAgentId ? agentById.get(ownedAgentId) ?? null : null;
  const ownedThoughts = ownedAgentId
    ? latestThoughts.filter((thought) => thought.agentId === ownedAgentId)
    : [];

  const formatBlock = (value: unknown): string => {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const includesOwnedAgent = (item: ActivityItem): boolean => {
    if (!ownedAgentId) return false;
    if (item.kind === 'swap') return item.data.agent?.id === ownedAgentId;
    const eventItem = item.data;
    if (eventItem.agentId === ownedAgentId) return true;
    try {
      const metadata = JSON.parse(eventItem.metadata || '{}') as Record<string, unknown>;
      if (metadata?.winnerId === ownedAgentId || metadata?.loserId === ownedAgentId) return true;
      if (Array.isArray(metadata?.participants)) {
        return metadata.participants.some((participant) => participant === ownedAgentId);
      }
      return false;
    } catch {
      return false;
    }
  };

  const ownedFeed = activityFeed.filter(includesOwnedAgent);

  return (
    <div className="w-[420px] max-w-[calc(100vw-24px)]">
      <div className="hud-panel p-3">
        {(ownedFeed.length > 0 || recentSwapsCount > 0) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-100">
                <span>📋 Your Agent Log</span>
                {ownedAgent && (
                  <span className="font-mono text-amber-300">
                    {archetypeGlyph[ownedAgent.archetype] || '●'} {ownedAgent.name}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-500">
                {recentSwapsCount > 0 ? `swaps ${recentSwapsCount}` : ''}
              </div>
            </div>
            {!ownedAgentId && (
              <div className="rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[11px] text-slate-400">
                Connect/select your wallet-owned agent to see a personal activity log.
              </div>
            )}
            <div className="max-h-[220px] overflow-auto pr-1 space-y-1 scrollbar-thin scrollbar-thumb-slate-700/60">
              {ownedFeed
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
                    goalTransitions.length > 0;

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

        {ownedThoughts.length > 0 && (
          <div className="mt-3 pt-2 border-t border-slate-800/40">
            <div className="text-[11px] font-semibold text-slate-100 mb-2">🧠 Agent Thoughts</div>
            <div className="max-h-[200px] overflow-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700/60">
              {ownedThoughts.slice(0, 12).map((thought) => {
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
                };
                return (
                  <details
                    key={`${thought.agentId}:${thought.tickAt}`}
                    className="rounded-md border border-amber-500/40 bg-amber-950/20 px-2 py-1 text-[11px] text-slate-300"
                    open
                  >
                    <summary className="cursor-pointer select-none flex items-center justify-between gap-2">
                      <div className="min-w-0 truncate">
                        <span>{actionEmoji[thought.actionType] || '🤔'}</span>{' '}
                        <span className="text-amber-400 text-[9px] mr-1">YOU</span>
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
      </div>
    </div>
  );
}
