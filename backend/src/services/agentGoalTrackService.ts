import {
  AgentGoalHorizon,
  AgentGoalMetric,
  AgentGoalStatus,
  ArenaAgent,
  PlotZone,
} from '@prisma/client';
import { prisma } from '../config/database';

type GoalObservation = {
  town: { id: string; level?: number; theme?: string; plots?: Array<{ zone?: PlotZone; status?: string }> } | null;
  myPlots: Array<{ zone?: PlotZone; status?: string; ownerId?: string | null; builderId?: string | null }>;
  myContributions: { apiCallsMade?: number } | null;
  availablePlots: Array<{ zone?: PlotZone }>;
};

type GoalSeed = {
  key: string;
  title: string;
  description: string;
  metric: AgentGoalMetric;
  targetDelta: number;
  minTarget?: number;
  deadlineTicks?: number;
  rewardProfile: Record<string, unknown>;
  penaltyProfile: Record<string, unknown>;
  notes?: string;
};

export type GoalTransition = {
  goalId: string;
  horizon: AgentGoalHorizon;
  status: AgentGoalStatus;
  title: string;
  description: string;
  progressLabel: string;
  rewardProfile: Record<string, unknown>;
  penaltyProfile: Record<string, unknown>;
  arenaDelta: number;
  healthDelta: number;
};

export type PersistentGoalView = {
  id: string;
  horizon: AgentGoalHorizon;
  status: AgentGoalStatus;
  templateKey: string;
  title: string;
  description: string;
  metric: AgentGoalMetric;
  focusZone: PlotZone | null;
  targetValue: number;
  progressValue: number;
  progressPct: number;
  progressLabel: string;
  startedTick: number;
  deadlineTick: number | null;
  ticksLeft: number | null;
  rewardProfile: Record<string, unknown>;
  penaltyProfile: Record<string, unknown>;
  townId: string | null;
};

export type GoalStackSnapshot = {
  goals: PersistentGoalView[];
  transitions: GoalTransition[];
  promptBlock: string;
};

function safeTrim(value: unknown, maxLen: number): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function parseProfile(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function hashToUint32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function archetypeKey(archetype: string): string {
  return String(archetype || '').toUpperCase().trim() || 'CHAMELEON';
}

function pickDeterministic<T>(list: T[], seedKey: string): T {
  const seed = hashToUint32(seedKey);
  const rng = mulberry32(seed);
  return list[Math.floor(rng() * list.length)] || list[0];
}

function preferredZones(archetype: string): PlotZone[] {
  const key = archetypeKey(archetype);
  switch (key) {
    case 'SHARK':
      return ['COMMERCIAL', 'INDUSTRIAL', 'CIVIC'];
    case 'ROCK':
      return ['RESIDENTIAL', 'CIVIC', 'INDUSTRIAL'];
    case 'DEGEN':
      return ['ENTERTAINMENT', 'COMMERCIAL', 'INDUSTRIAL'];
    case 'GRINDER':
      return ['INDUSTRIAL', 'COMMERCIAL', 'RESIDENTIAL'];
    case 'CHAMELEON':
    default:
      return ['COMMERCIAL', 'CIVIC', 'INDUSTRIAL', 'RESIDENTIAL', 'ENTERTAINMENT'];
  }
}

const SHORT_GOAL_SEEDS: GoalSeed[] = [
  {
    key: 'short_pipeline',
    title: 'Keep the pipeline warm',
    description: 'Push inference/build throughput this session.',
    metric: 'API_CALLS_TOTAL',
    targetDelta: 2,
    minTarget: 3,
    deadlineTicks: 8,
    rewardProfile: { kind: 'tick_bonus', arenaBonus: 12, label: '+12 ARENA' },
    penaltyProfile: { kind: 'friction', arenaPenalty: 8, healthPenalty: 1, label: '-8 ARENA, -1 HP' },
    notes: 'session throughput',
  },
  {
    key: 'short_foothold',
    title: 'Secure actionable footing',
    description: 'Ensure you own or are building at least one plot.',
    metric: 'CLAIMED_OR_UC_TOTAL',
    targetDelta: 1,
    minTarget: 1,
    deadlineTicks: 6,
    rewardProfile: { kind: 'positioning', arenaBonus: 10, label: '+10 ARENA' },
    penaltyProfile: { kind: 'stall_penalty', arenaPenalty: 6, label: '-6 ARENA' },
    notes: 'anti-stall',
  },
];

const MID_GOAL_SEEDS: GoalSeed[] = [
  {
    key: 'mid_zone_control',
    title: 'Win your archetype lane',
    description: 'Establish control in your preferred zone.',
    metric: 'BUILT_IN_ZONE',
    targetDelta: 1,
    minTarget: 1,
    deadlineTicks: 30,
    rewardProfile: { kind: 'zone_mastery', arenaBonus: 30, healthBonus: 3, label: '+30 ARENA, +3 HP' },
    penaltyProfile: { kind: 'lane_loss', arenaPenalty: 18, label: '-18 ARENA' },
    notes: 'zone ownership',
  },
  {
    key: 'mid_build_volume',
    title: 'Ship concrete progress',
    description: 'Get additional completed buildings this town.',
    metric: 'BUILT_TOTAL',
    targetDelta: 2,
    minTarget: 2,
    deadlineTicks: 36,
    rewardProfile: { kind: 'volume', arenaBonus: 36, label: '+36 ARENA' },
    penaltyProfile: { kind: 'delay', arenaPenalty: 22, healthPenalty: 2, label: '-22 ARENA, -2 HP' },
    notes: 'mid-cycle delivery',
  },
];

const LONG_GOAL_BY_ARCHETYPE: Record<string, GoalSeed[]> = {
  SHARK: [
    {
      key: 'long_treasury_takeover',
      title: 'Scale treasury dominance',
      description: 'Grow bankroll aggressively and stay top-heavy.',
      metric: 'BANKROLL',
      targetDelta: 650,
      minTarget: 11000,
      deadlineTicks: 140,
      rewardProfile: { kind: 'treasury', arenaBonus: 80, healthBonus: 4, label: '+80 ARENA, +4 HP' },
      penaltyProfile: { kind: 'capital_drag', arenaPenalty: 40, label: '-40 ARENA' },
      notes: 'long capital growth',
    },
  ],
  ROCK: [
    {
      key: 'long_stability_grid',
      title: 'Finish a stability grid',
      description: 'Accumulate durable completed buildings over multiple cycles.',
      metric: 'BUILT_TOTAL',
      targetDelta: 4,
      minTarget: 4,
      deadlineTicks: 150,
      rewardProfile: { kind: 'stability', arenaBonus: 70, healthBonus: 5, label: '+70 ARENA, +5 HP' },
      penaltyProfile: { kind: 'decay', arenaPenalty: 34, healthPenalty: 2, label: '-34 ARENA, -2 HP' },
      notes: 'long compounding',
    },
  ],
  DEGEN: [
    {
      key: 'long_chaos_champion',
      title: 'Convert chaos into wins',
      description: 'Stack arena wins while keeping town operations alive.',
      metric: 'WINS_TOTAL',
      targetDelta: 2,
      minTarget: 2,
      deadlineTicks: 120,
      rewardProfile: { kind: 'arena_legend', arenaBonus: 90, label: '+90 ARENA' },
      penaltyProfile: { kind: 'tilt_tax', arenaPenalty: 45, healthPenalty: 2, label: '-45 ARENA, -2 HP' },
      notes: 'long pvp arc',
    },
  ],
  GRINDER: [
    {
      key: 'long_efficiency_index',
      title: 'Compound inference edge',
      description: 'Sustain high inference throughput over many ticks.',
      metric: 'API_CALLS_TOTAL',
      targetDelta: 22,
      minTarget: 22,
      deadlineTicks: 160,
      rewardProfile: { kind: 'efficiency', arenaBonus: 75, healthBonus: 2, label: '+75 ARENA, +2 HP' },
      penaltyProfile: { kind: 'throughput_slip', arenaPenalty: 38, label: '-38 ARENA' },
      notes: 'long throughput',
    },
  ],
  CHAMELEON: [
    {
      key: 'long_adapt_and_expand',
      title: 'Out-adapt the board',
      description: 'Grow across cycles with flexible build volume.',
      metric: 'BUILT_TOTAL',
      targetDelta: 3,
      minTarget: 3,
      deadlineTicks: 140,
      rewardProfile: { kind: 'adaptation', arenaBonus: 68, healthBonus: 3, label: '+68 ARENA, +3 HP' },
      penaltyProfile: { kind: 'stagnation', arenaPenalty: 32, healthPenalty: 1, label: '-32 ARENA, -1 HP' },
      notes: 'long adaptation',
    },
  ],
};

function horizonSort(horizon: AgentGoalHorizon): number {
  if (horizon === 'SHORT') return 0;
  if (horizon === 'MID') return 1;
  return 2;
}

export class AgentGoalTrackService {
  private chooseFocusZone(agent: ArenaAgent, obs: GoalObservation): PlotZone | null {
    const preferred = preferredZones(agent.archetype);
    const availableSet = new Set(
      (obs.availablePlots || [])
        .map((p) => (p.zone ? String(p.zone).toUpperCase() : ''))
        .filter(Boolean),
    );
    const preferredAvailable = preferred.find((zone) => availableSet.has(zone));
    if (preferredAvailable) return preferredAvailable;

    const townPlots = Array.isArray(obs.town?.plots) ? obs.town?.plots || [] : [];
    const emptyByZone = new Map<PlotZone, number>();
    for (const zone of preferred) {
      const empty = townPlots.filter((plot) => plot.status === 'EMPTY' && plot.zone === zone).length;
      emptyByZone.set(zone, empty);
    }
    const ranked = [...emptyByZone.entries()].sort((a, b) => b[1] - a[1]);
    return ranked[0]?.[0] || preferred[0] || null;
  }

  private chooseSeed(agent: ArenaAgent, obs: GoalObservation, horizon: AgentGoalHorizon): GoalSeed {
    const key = archetypeKey(agent.archetype);
    const seedKey = `${obs.town?.id || 'global'}:${agent.id}:${horizon}:${key}`;
    if (horizon === 'SHORT') return pickDeterministic(SHORT_GOAL_SEEDS, seedKey);
    if (horizon === 'MID') return pickDeterministic(MID_GOAL_SEEDS, seedKey);
    const longSeeds = LONG_GOAL_BY_ARCHETYPE[key] || LONG_GOAL_BY_ARCHETYPE.CHAMELEON;
    return pickDeterministic(longSeeds, seedKey);
  }

  private async metricValue(
    metric: AgentGoalMetric,
    goalTownId: string | null,
    focusZone: PlotZone | null,
    agent: ArenaAgent,
    obs: GoalObservation,
  ): Promise<number> {
    switch (metric) {
      case 'CLAIMED_OR_UC_TOTAL': {
        if (goalTownId && obs.town?.id === goalTownId) {
          return obs.myPlots.filter(
            (plot) => plot.status === 'CLAIMED' || plot.status === 'UNDER_CONSTRUCTION',
          ).length;
        }
        if (!goalTownId) return 0;
        return prisma.plot.count({
          where: {
            townId: goalTownId,
            ownerId: agent.id,
            status: { in: ['CLAIMED', 'UNDER_CONSTRUCTION'] },
          },
        });
      }
      case 'BUILT_IN_ZONE': {
        if (!focusZone) return 0;
        if (goalTownId && obs.town?.id === goalTownId) {
          return obs.myPlots.filter((plot) => plot.status === 'BUILT' && plot.zone === focusZone).length;
        }
        return prisma.plot.count({
          where: {
            builderId: agent.id,
            status: 'BUILT',
            zone: focusZone,
            ...(goalTownId ? { townId: goalTownId } : {}),
          },
        });
      }
      case 'BUILT_TOTAL': {
        return prisma.plot.count({
          where: {
            builderId: agent.id,
            status: 'BUILT',
            ...(goalTownId ? { townId: goalTownId } : {}),
          },
        });
      }
      case 'BANKROLL':
        return Math.max(0, agent.bankroll);
      case 'WINS_TOTAL':
        return Math.max(0, agent.wins);
      case 'API_CALLS_TOTAL': {
        if (goalTownId && obs.town?.id === goalTownId && obs.myContributions?.apiCallsMade != null) {
          return Math.max(0, Number(obs.myContributions.apiCallsMade) || 0);
        }
        if (goalTownId) {
          const contribution = await prisma.townContribution.findUnique({
            where: { agentId_townId: { agentId: agent.id, townId: goalTownId } },
            select: { apiCallsMade: true },
          });
          return Math.max(0, contribution?.apiCallsMade || 0);
        }
        const aggregate = await prisma.townContribution.aggregate({
          where: { agentId: agent.id },
          _sum: { apiCallsMade: true },
        });
        return Math.max(0, aggregate._sum.apiCallsMade || 0);
      }
      default:
        return 0;
    }
  }

  private progressLabel(metric: AgentGoalMetric, current: number, target: number, zone: PlotZone | null): string {
    if (metric === 'BUILT_IN_ZONE' && zone) {
      return `${Math.min(current, target)}/${target} built in ${zone}`;
    }
    if (metric === 'BANKROLL') {
      return `${current}/${target} bankroll`;
    }
    if (metric === 'WINS_TOTAL') {
      return `${current}/${target} wins`;
    }
    if (metric === 'API_CALLS_TOTAL') {
      return `${current}/${target} inference calls`;
    }
    if (metric === 'CLAIMED_OR_UC_TOTAL') {
      return `${Math.min(current, target)}/${target} active plots`;
    }
    return `${Math.min(current, target)}/${target}`;
  }

  private async applyTransitionIncentives(
    agentId: string,
    status: AgentGoalStatus,
    rewardProfile: Record<string, unknown>,
    penaltyProfile: Record<string, unknown>,
  ): Promise<{ arenaDelta: number; healthDelta: number }> {
    const rewardArena = status === 'COMPLETED' ? Math.max(0, Number(rewardProfile.arenaBonus || 0)) : 0;
    const rewardHealth = status === 'COMPLETED' ? Math.max(0, Number(rewardProfile.healthBonus || 0)) : 0;
    const penaltyArena = status === 'FAILED' ? Math.max(0, Number(penaltyProfile.arenaPenalty || 0)) : 0;
    const penaltyHealth = status === 'FAILED' ? Math.max(0, Number(penaltyProfile.healthPenalty || 0)) : 0;

    const agent = await prisma.arenaAgent.findUnique({
      where: { id: agentId },
      select: { bankroll: true, health: true },
    });
    if (!agent) return { arenaDelta: 0, healthDelta: 0 };

    const nextBankroll = Math.max(0, agent.bankroll + rewardArena - penaltyArena);
    const nextHealth = Math.max(0, Math.min(100, agent.health + rewardHealth - penaltyHealth));

    await prisma.arenaAgent.update({
      where: { id: agentId },
      data: {
        bankroll: nextBankroll,
        health: nextHealth,
      },
    });

    return {
      arenaDelta: nextBankroll - agent.bankroll,
      healthDelta: nextHealth - agent.health,
    };
  }

  private async ensureActiveGoals(agent: ArenaAgent, obs: GoalObservation, currentTick: number): Promise<void> {
    const active = await prisma.agentGoalTrack.findMany({
      where: { agentId: agent.id, status: 'ACTIVE' },
      select: { id: true, horizon: true },
    });
    const activeHorizons = new Set(active.map((goal) => goal.horizon));

    const horizons: AgentGoalHorizon[] = ['SHORT', 'MID', 'LONG'];
    for (const horizon of horizons) {
      if (activeHorizons.has(horizon)) continue;
      if ((horizon === 'SHORT' || horizon === 'MID') && !obs.town) continue;

      const seed = this.chooseSeed(agent, obs, horizon);
      const focusZone = seed.metric === 'BUILT_IN_ZONE' ? this.chooseFocusZone(agent, obs) : null;
      const townId = horizon === 'LONG' ? null : obs.town?.id || null;
      const baseline = await this.metricValue(seed.metric, townId, focusZone, agent, obs);
      const targetValue = Math.max(seed.minTarget || 1, baseline + seed.targetDelta);
      const deadlineTick = seed.deadlineTicks ? currentTick + seed.deadlineTicks : null;

      await prisma.agentGoalTrack.create({
        data: {
          agentId: agent.id,
          townId,
          horizon,
          status: 'ACTIVE',
          templateKey: seed.key,
          title: safeTrim(seed.title, 120),
          description: safeTrim(seed.description, 320),
          metric: seed.metric,
          focusZone: focusZone || undefined,
          targetValue,
          progressValue: baseline,
          startedTick: currentTick,
          deadlineTick: deadlineTick ?? undefined,
          lastEvaluatedTick: currentTick,
          rewardProfile: JSON.stringify(seed.rewardProfile),
          penaltyProfile: JSON.stringify(seed.penaltyProfile),
          lastProgressLabel: this.progressLabel(seed.metric, baseline, targetValue, focusZone),
          notes: safeTrim(seed.notes || '', 300),
        },
      });
    }
  }

  private toGoalView(goal: any, currentTick: number): PersistentGoalView {
    const current = Math.max(0, Number(goal.progressValue || 0));
    const target = Math.max(1, Number(goal.targetValue || 1));
    const pct = Math.max(0, Math.min(100, Math.round((current / target) * 100)));
    const ticksLeft =
      goal.deadlineTick != null
        ? Math.max(0, Number(goal.deadlineTick) - currentTick)
        : null;
    return {
      id: goal.id,
      horizon: goal.horizon,
      status: goal.status,
      templateKey: goal.templateKey,
      title: goal.title,
      description: goal.description,
      metric: goal.metric,
      focusZone: goal.focusZone ?? null,
      targetValue: target,
      progressValue: current,
      progressPct: pct,
      progressLabel: goal.lastProgressLabel || `${Math.min(current, target)}/${target}`,
      startedTick: goal.startedTick,
      deadlineTick: goal.deadlineTick ?? null,
      ticksLeft,
      rewardProfile: parseProfile(goal.rewardProfile),
      penaltyProfile: parseProfile(goal.penaltyProfile),
      townId: goal.townId ?? null,
    };
  }

  private buildPromptBlock(goals: PersistentGoalView[], currentTick: number): string {
    if (goals.length === 0) return 'No persistent goals active.';
    const sorted = [...goals].sort((a, b) => horizonSort(a.horizon) - horizonSort(b.horizon));
    const lines = sorted.map((goal) => {
      const deadlineText =
        goal.deadlineTick != null
          ? `deadline T${goal.deadlineTick} (${Math.max(0, goal.deadlineTick - currentTick)} ticks left)`
          : 'no hard deadline';
      const reward = safeTrim(goal.rewardProfile.label, 60) || 'reward set';
      const penalty = safeTrim(goal.penaltyProfile.label, 60) || 'penalty set';
      return `- [${goal.horizon}] ${goal.title} :: ${goal.progressLabel} · ${deadlineText} · reward ${reward} · fail ${penalty}`;
    });
    return lines.join('\n');
  }

  async refreshGoalStack(agent: ArenaAgent, obs: GoalObservation, currentTick: number): Promise<GoalStackSnapshot> {
    await this.ensureActiveGoals(agent, obs, currentTick);

    const activeGoals = await prisma.agentGoalTrack.findMany({
      where: { agentId: agent.id, status: 'ACTIVE' },
      orderBy: [{ horizon: 'asc' }, { createdAt: 'asc' }],
    });

    const transitions: GoalTransition[] = [];

    for (const goal of activeGoals) {
      const currentValue = await this.metricValue(goal.metric, goal.townId, goal.focusZone, agent, obs);
      const progressLabel = this.progressLabel(goal.metric, currentValue, goal.targetValue, goal.focusZone);
      const reachedTarget = currentValue >= goal.targetValue;
      const missedDeadline = !reachedTarget && goal.deadlineTick != null && currentTick > goal.deadlineTick;

      if (reachedTarget || missedDeadline) {
        const nextStatus: AgentGoalStatus = reachedTarget ? 'COMPLETED' : 'FAILED';
        const rewardProfile = parseProfile(goal.rewardProfile);
        const penaltyProfile = parseProfile(goal.penaltyProfile);
        const incentive = await this.applyTransitionIncentives(agent.id, nextStatus, rewardProfile, penaltyProfile);

        await prisma.agentGoalTrack.update({
          where: { id: goal.id },
          data: {
            status: nextStatus,
            progressValue: currentValue,
            lastProgressLabel: progressLabel,
            lastEvaluatedTick: currentTick,
            completedTick: reachedTarget ? currentTick : undefined,
            failedTick: missedDeadline ? currentTick : undefined,
          },
        });

        transitions.push({
          goalId: goal.id,
          horizon: goal.horizon,
          status: nextStatus,
          title: goal.title,
          description: goal.description,
          progressLabel,
          rewardProfile,
          penaltyProfile,
          arenaDelta: incentive.arenaDelta,
          healthDelta: incentive.healthDelta,
        });
      } else {
        await prisma.agentGoalTrack.update({
          where: { id: goal.id },
          data: {
            progressValue: currentValue,
            lastProgressLabel: progressLabel,
            lastEvaluatedTick: currentTick,
          },
        });
      }
    }

    if (transitions.length > 0) {
      await this.ensureActiveGoals(agent, obs, currentTick);
    }

    const refreshed = await prisma.agentGoalTrack.findMany({
      where: { agentId: agent.id, status: 'ACTIVE' },
      orderBy: [{ horizon: 'asc' }, { createdAt: 'asc' }],
    });
    const goals = refreshed.map((goal) => this.toGoalView(goal, currentTick));
    return {
      goals,
      transitions,
      promptBlock: this.buildPromptBlock(goals, currentTick),
    };
  }

  async getAgentGoalHistory(agentId: string, limit: number = 30) {
    const rows = await prisma.agentGoalTrack.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(1, limit), 100),
    });
    return rows.map((goal) => ({
      ...goal,
      rewardProfile: parseProfile(goal.rewardProfile),
      penaltyProfile: parseProfile(goal.penaltyProfile),
    }));
  }
}

export const agentGoalTrackService = new AgentGoalTrackService();
