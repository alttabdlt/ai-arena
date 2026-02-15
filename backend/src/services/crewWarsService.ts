import { CrewOrderStatus, CrewStrategy, Prisma } from '@prisma/client';
import { prisma } from '../config/database';

const CREW_EPOCH_TICKS = 12;
const CREW_SCORE_DECAY = 0.55;

const DEFAULT_CREWS = [
  {
    slug: 'neon-syndicate',
    name: 'Neon Syndicate',
    colorHex: '#22d3ee',
    description: 'Fast raid pressure and volatility farming.',
  },
  {
    slug: 'iron-cartel',
    name: 'Iron Cartel',
    colorHex: '#f97316',
    description: 'Defense-heavy builders with siege discipline.',
  },
  {
    slug: 'vault-collective',
    name: 'Vault Collective',
    colorHex: '#34d399',
    description: 'Treasury maximizers and capital rotators.',
  },
] as const;

type EconomyDelta = {
  arenaDelta: number;
  reserveDelta: number;
  healthDelta: number;
};

type CrewOrderView = {
  id: string;
  crewId: string;
  crewName: string;
  agentId: string;
  strategy: CrewStrategy;
  intensity: number;
  source: string;
  note: string;
  status: CrewOrderStatus;
  statusReason: string;
  createdTick: number;
  expiresAtTick: number | null;
  createdAt: Date;
};

type QueueOrderInput = {
  agentId: string;
  strategy: CrewStrategy | string;
  intensity?: number;
  source?: string;
  note?: string;
  issuerIdentityId?: string | null;
  issuerLabel?: string | null;
  params?: Record<string, unknown>;
  createdTick?: number;
  expiresInTicks?: number;
  expiresAtTick?: number;
};

function safeTrim(value: unknown, maxLen: number): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n);
  return Math.min(max, Math.max(min, rounded));
}

function normalizeStrategy(raw: CrewStrategy | string): CrewStrategy {
  const strategy = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (strategy === 'RAID' || strategy === 'DEFEND' || strategy === 'FARM' || strategy === 'TRADE') {
    return strategy as CrewStrategy;
  }
  throw new Error('strategy must be RAID, DEFEND, FARM, or TRADE');
}

function isPositiveStatus(status: string): boolean {
  return status === 'SUCCESS' || status === 'EXECUTED' || status === 'APPLIED';
}

export class CrewWarsService {
  private lastEpochResolutionTick = 0;

  private async bootstrapCrews(): Promise<void> {
    const count = await prisma.crew.count();
    if (count > 0) return;

    for (const seed of DEFAULT_CREWS) {
      await prisma.crew.create({
        data: {
          slug: seed.slug,
          name: seed.name,
          colorHex: seed.colorHex,
          description: seed.description,
          territoryControl: 10,
          treasuryArena: 500,
          momentum: 0,
          warScore: 0,
          lastResolvedTick: 0,
        },
      });
    }
  }

  private chooseCrewSlugForArchetype(archetype: string): string {
    const tag = String(archetype || '').toUpperCase();
    if (tag === 'DEGEN') return 'neon-syndicate';
    if (tag === 'SHARK') return 'iron-cartel';
    if (tag === 'GRINDER') return 'vault-collective';
    if (tag === 'CHAMELEON') return 'neon-syndicate';
    return 'vault-collective';
  }

  private async getCrewBySlug(slug: string) {
    return prisma.crew.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        colorHex: true,
        territoryControl: true,
        treasuryArena: true,
        momentum: true,
        warScore: true,
      },
    });
  }

  async ensureMembershipForAgent(agentId: string): Promise<{ crewId: string; crewName: string }> {
    const normalizedId = safeTrim(agentId, 120);
    if (!normalizedId) throw new Error('agentId is required');

    await this.bootstrapCrews();

    const existing = await prisma.crewMembership.findUnique({
      where: { agentId: normalizedId },
      include: { crew: { select: { id: true, name: true } } },
    });
    if (existing?.isActive) {
      return { crewId: existing.crew.id, crewName: existing.crew.name };
    }

    const agent = await prisma.arenaAgent.findUnique({
      where: { id: normalizedId },
      select: { id: true, archetype: true, isActive: true },
    });
    if (!agent || !agent.isActive) {
      throw new Error('Agent unavailable for crew assignment');
    }

    const preferredSlug = this.chooseCrewSlugForArchetype(agent.archetype);
    const preferredCrew = await this.getCrewBySlug(preferredSlug);
    if (!preferredCrew) throw new Error('Crew bootstrap failed');

    const memberCount = await prisma.crewMembership.count({
      where: { crewId: preferredCrew.id, isActive: true },
    });

    await prisma.crewMembership.upsert({
      where: { agentId: normalizedId },
      update: {
        crewId: preferredCrew.id,
        role: memberCount === 0 ? 'CAPTAIN' : 'MEMBER',
        isActive: true,
        leftAt: null,
      },
      create: {
        agentId: normalizedId,
        crewId: preferredCrew.id,
        role: memberCount === 0 ? 'CAPTAIN' : 'MEMBER',
        isActive: true,
      },
    });

    return { crewId: preferredCrew.id, crewName: preferredCrew.name };
  }

  async ensureMembershipsForActiveAgents(limit = 200): Promise<number> {
    await this.bootstrapCrews();
    const agents = await prisma.arenaAgent.findMany({
      where: { isActive: true },
      select: { id: true },
      take: Math.max(1, Math.min(1000, Math.floor(limit))),
    });
    let assigned = 0;
    for (const agent of agents) {
      const membership = await prisma.crewMembership.findUnique({
        where: { agentId: agent.id },
        select: { isActive: true },
      });
      if (!membership?.isActive) {
        await this.ensureMembershipForAgent(agent.id);
        assigned += 1;
      }
    }
    return assigned;
  }

  async getAgentCrew(agentId: string): Promise<{
    agentId: string;
    crewId: string | null;
    crewName: string | null;
    role: string | null;
    colorHex: string | null;
  }> {
    await this.bootstrapCrews();
    const membership = await prisma.crewMembership.findUnique({
      where: { agentId },
      include: {
        crew: {
          select: { id: true, name: true, colorHex: true },
        },
      },
    });

    if (!membership || !membership.isActive) {
      return {
        agentId,
        crewId: null,
        crewName: null,
        role: null,
        colorHex: null,
      };
    }

    return {
      agentId,
      crewId: membership.crewId,
      crewName: membership.crew.name,
      role: membership.role,
      colorHex: membership.crew.colorHex,
    };
  }

  private toOrderView(row: Prisma.CrewOrderGetPayload<{
    include: { crew: { select: { id: true; name: true } } };
  }>): CrewOrderView {
    return {
      id: row.id,
      crewId: row.crewId,
      crewName: row.crew.name,
      agentId: row.agentId,
      strategy: row.strategy,
      intensity: row.intensity,
      source: row.source,
      note: row.note,
      status: row.status,
      statusReason: row.statusReason,
      createdTick: row.createdTick,
      expiresAtTick: row.expiresAtTick,
      createdAt: row.createdAt,
    };
  }

  async queueOrder(input: QueueOrderInput): Promise<CrewOrderView> {
    const agentId = safeTrim(input.agentId, 120);
    if (!agentId) throw new Error('agentId is required');

    const strategy = normalizeStrategy(input.strategy);
    const intensity = clampInt(input.intensity, 1, 3, 1);
    const source = safeTrim(input.source || 'telegram', 40) || 'telegram';
    const note = safeTrim(input.note || '', 220);
    const createdTick = Math.max(0, Math.trunc(input.createdTick || 0));
    const expiresAtTick =
      Number.isFinite(input.expiresAtTick)
        ? Math.max(createdTick + 1, Math.trunc(Number(input.expiresAtTick)))
        : Number.isFinite(input.expiresInTicks)
          ? createdTick + Math.max(1, Math.trunc(Number(input.expiresInTicks)))
          : null;

    const membership = await this.ensureMembershipForAgent(agentId);
    const row = await prisma.crewOrder.create({
      data: {
        crewId: membership.crewId,
        agentId,
        strategy,
        intensity,
        source,
        note,
        paramsJson: JSON.stringify(input.params || {}),
        issuerIdentityId: input.issuerIdentityId || null,
        issuerLabel: safeTrim(input.issuerLabel || '', 80) || null,
        createdTick,
        expiresAtTick,
        status: 'QUEUED',
        statusReason: 'Queued',
      },
      include: {
        crew: {
          select: { id: true, name: true },
        },
      },
    });

    return this.toOrderView(row);
  }

  async expireOrders(agentId: string, currentTick: number): Promise<number> {
    const tick = Math.max(0, Math.trunc(currentTick));
    const result = await prisma.crewOrder.updateMany({
      where: {
        agentId,
        status: 'QUEUED',
        expiresAtTick: { not: null, lt: tick },
      },
      data: {
        status: 'EXPIRED',
        statusReason: `Expired before tick ${tick}`,
        expiredAt: new Date(),
      },
    });
    return result.count;
  }

  async markOrderApplied(orderId: string, statusReason: string): Promise<void> {
    await prisma.crewOrder.updateMany({
      where: { id: orderId, status: 'QUEUED' },
      data: {
        status: 'APPLIED',
        statusReason: safeTrim(statusReason, 200) || 'Applied',
        appliedAt: new Date(),
      },
    });
  }

  async getDashboard(limitBattles = 8, currentTick = 0): Promise<{
    crews: Array<{
      id: string;
      slug: string;
      name: string;
      colorHex: string;
      territoryControl: number;
      treasuryArena: number;
      momentum: number;
      warScore: number;
      memberCount: number;
      captains: Array<{ id: string; name: string; archetype: string }>;
    }>;
    agentCrewById: Record<string, { crewId: string; crewName: string; colorHex: string; role: string }>;
    recentBattles: Array<{
      id: string;
      tick: number;
      winnerCrewId: string;
      winnerCrewName: string;
      loserCrewId: string;
      loserCrewName: string;
      territorySwing: number;
      treasurySwing: number;
      summary: string;
      createdAt: Date;
    }>;
    epochTicks: number;
    campaign: {
      currentTick: number;
      nextEpochTick: number;
      ticksUntilEpoch: number;
      leadingCrewId: string | null;
      leadingCrewName: string | null;
      trailingCrewId: string | null;
      trailingCrewName: string | null;
      objective: string;
      counterplayWindowTicks: number;
    };
  }> {
    await this.bootstrapCrews();
    await this.ensureMembershipsForActiveAgents();

    const [crews, battles, memberships] = await Promise.all([
      prisma.crew.findMany({
        include: {
          memberships: {
            where: { isActive: true },
            include: {
              agent: {
                select: { id: true, name: true, archetype: true },
              },
            },
          },
        },
        orderBy: [{ warScore: 'desc' }, { territoryControl: 'desc' }, { treasuryArena: 'desc' }],
      }),
      prisma.crewBattleEvent.findMany({
        include: {
          winnerCrew: { select: { id: true, name: true } },
          loserCrew: { select: { id: true, name: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: Math.max(1, Math.min(50, Math.floor(limitBattles))),
      }),
      prisma.crewMembership.findMany({
        where: { isActive: true },
        include: {
          crew: { select: { id: true, name: true, colorHex: true } },
        },
      }),
    ]);

    const agentCrewById: Record<string, { crewId: string; crewName: string; colorHex: string; role: string }> = {};
    for (const m of memberships) {
      agentCrewById[m.agentId] = {
        crewId: m.crewId,
        crewName: m.crew.name,
        colorHex: m.crew.colorHex,
        role: m.role,
      };
    }

    const mappedCrews = crews.map((crew) => ({
        id: crew.id,
        slug: crew.slug,
        name: crew.name,
        colorHex: crew.colorHex,
        territoryControl: crew.territoryControl,
        treasuryArena: crew.treasuryArena,
        momentum: crew.momentum,
        warScore: crew.warScore,
        memberCount: crew.memberships.length,
        captains: crew.memberships
          .filter((m) => m.role === 'CAPTAIN')
          .map((m) => ({
            id: m.agent.id,
            name: m.agent.name,
            archetype: m.agent.archetype,
          })),
      }));
    const leadingCrew = mappedCrews[0] || null;
    const trailingCrew = mappedCrews[mappedCrews.length - 1] || null;
    const normalizedTick = Math.max(0, Math.trunc(currentTick || 0));
    const nextEpochTick = Math.floor(normalizedTick / CREW_EPOCH_TICKS) * CREW_EPOCH_TICKS + CREW_EPOCH_TICKS;
    const ticksUntilEpoch = Math.max(0, nextEpochTick - normalizedTick);
    const objective = leadingCrew && trailingCrew && leadingCrew.id !== trailingCrew.id
      ? `${leadingCrew.name} must hold momentum for ${ticksUntilEpoch} tick(s) to lock this epoch.`
      : 'Crews are initializing. Keep issuing orders to establish control.';

    return {
      crews: mappedCrews,
      agentCrewById,
      recentBattles: battles.map((battle) => ({
        id: battle.id,
        tick: battle.tick,
        winnerCrewId: battle.winnerCrewId,
        winnerCrewName: battle.winnerCrew.name,
        loserCrewId: battle.loserCrewId,
        loserCrewName: battle.loserCrew.name,
        territorySwing: battle.territorySwing,
        treasurySwing: battle.treasurySwing,
        summary: battle.summary,
        createdAt: battle.createdAt,
      })),
      epochTicks: CREW_EPOCH_TICKS,
      campaign: {
        currentTick: normalizedTick,
        nextEpochTick,
        ticksUntilEpoch,
        leadingCrewId: leadingCrew?.id || null,
        leadingCrewName: leadingCrew?.name || null,
        trailingCrewId: trailingCrew?.id || null,
        trailingCrewName: trailingCrew?.name || null,
        objective,
        counterplayWindowTicks: Math.max(1, Math.min(4, ticksUntilEpoch)),
      },
    };
  }

  intentForStrategy(strategy: CrewStrategy): string {
    if (strategy === 'RAID') return 'crew_raid';
    if (strategy === 'DEFEND') return 'crew_defend';
    if (strategy === 'FARM') return 'crew_farm';
    return 'crew_trade';
  }

  private calculateContribution(input: {
    actionType: string;
    success: boolean;
    delta: EconomyDelta;
  }): {
    warScoreDelta: number;
    territoryDelta: number;
    treasuryDelta: number;
    momentumDelta: number;
  } {
    const action = String(input.actionType || '').toLowerCase();
    const d = input.delta;

    let score = input.success ? 2 : -3;
    if (action === 'play_arena') score += 8;
    else if (action === 'complete_build') score += 7;
    else if (action === 'do_work') score += 5;
    else if (action === 'start_build' || action === 'claim_plot') score += 4;
    else if (action === 'buy_arena' || action === 'sell_arena') score += 3;
    else if (action === 'rest') score -= 2;

    score += Math.max(-6, Math.min(6, Math.round((d.arenaDelta || 0) / 20)));
    score += Math.max(-4, Math.min(4, Math.round((d.reserveDelta || 0) / 30)));
    score += Math.max(-2, Math.min(2, Math.round((d.healthDelta || 0) / 12)));

    let territoryDelta = 0;
    if (input.success && ['claim_plot', 'start_build', 'do_work', 'complete_build', 'play_arena'].includes(action)) {
      territoryDelta += score >= 8 ? 2 : 1;
    }
    if (!input.success || (action === 'play_arena' && (d.arenaDelta || 0) < 0)) {
      territoryDelta -= 1;
    }

    let treasuryDelta = 0;
    if ((d.arenaDelta || 0) > 0) {
      treasuryDelta += Math.max(0, Math.floor((d.arenaDelta || 0) * 0.2));
    }
    if ((d.reserveDelta || 0) > 0) {
      treasuryDelta += Math.max(0, Math.floor((d.reserveDelta || 0) * 0.1));
    }
    if (!input.success) {
      treasuryDelta -= 2;
    }

    const momentumDelta = score > 0 ? 1 : score < 0 ? -1 : 0;
    return { warScoreDelta: score, territoryDelta, treasuryDelta, momentumDelta };
  }

  async recordActionOutcome(input: {
    agentId: string;
    actionType: string;
    success: boolean;
    delta: EconomyDelta;
    tick: number;
    commandMetadata?: { intent?: string | null };
  }): Promise<void> {
    const agentId = safeTrim(input.agentId, 120);
    if (!agentId) return;

    const membership = await this.ensureMembershipForAgent(agentId);
    const crew = await prisma.crew.findUnique({
      where: { id: membership.crewId },
      select: {
        id: true,
        territoryControl: true,
        treasuryArena: true,
        momentum: true,
      },
    });
    if (!crew) return;

    const effect = this.calculateContribution({
      actionType: input.actionType,
      success: input.success,
      delta: input.delta,
    });

    const nextTerritory = Math.max(0, crew.territoryControl + effect.territoryDelta);
    const nextTreasury = Math.max(0, crew.treasuryArena + effect.treasuryDelta);
    const nextMomentum = Math.max(-100, Math.min(100, crew.momentum + effect.momentumDelta));

    await prisma.crew.update({
      where: { id: crew.id },
      data: {
        warScore: { increment: effect.warScoreDelta },
        territoryControl: nextTerritory,
        treasuryArena: nextTreasury,
        momentum: nextMomentum,
      },
    });

    if (input.commandMetadata?.intent?.startsWith('crew_')) {
      const latestOrder = await prisma.crewOrder.findFirst({
        where: {
          agentId,
          status: 'QUEUED',
          OR: [{ expiresAtTick: null }, { expiresAtTick: { gte: input.tick } }],
        },
        orderBy: [{ createdAt: 'desc' }],
      });
      if (latestOrder) {
        await this.markOrderApplied(latestOrder.id, `Applied on tick ${input.tick} as ${input.actionType}`);
      }
    }

    await this.resolveEpochIfNeeded(input.tick);
  }

  private async decayScoresAndMarkEpoch(tick: number): Promise<void> {
    const crews = await prisma.crew.findMany({
      select: { id: true, warScore: true },
    });
    for (const crew of crews) {
      const decayed = Math.trunc(crew.warScore * CREW_SCORE_DECAY);
      await prisma.crew.update({
        where: { id: crew.id },
        data: {
          warScore: decayed,
          lastResolvedTick: tick,
        },
      });
    }
  }

  async resolveEpochIfNeeded(currentTick: number): Promise<void> {
    const tick = Math.max(0, Math.trunc(currentTick));
    if (tick < this.lastEpochResolutionTick + CREW_EPOCH_TICKS) return;
    this.lastEpochResolutionTick = tick;

    const crews = await prisma.crew.findMany({
      orderBy: [{ warScore: 'desc' }, { territoryControl: 'desc' }, { treasuryArena: 'desc' }],
      select: {
        id: true,
        name: true,
        warScore: true,
        territoryControl: true,
        treasuryArena: true,
        momentum: true,
      },
    });

    if (crews.length < 2) {
      await this.decayScoresAndMarkEpoch(tick);
      return;
    }

    const winner = crews[0];
    const loser = crews[crews.length - 1];
    const scoreGap = Math.max(0, winner.warScore - loser.warScore);

    if (winner.id === loser.id || scoreGap < 8) {
      await this.decayScoresAndMarkEpoch(tick);
      return;
    }

    const territorySwing = Math.max(1, Math.min(4, Math.floor(scoreGap / 10) || 1));
    const treasurySwing = Math.max(4, Math.min(180, Math.floor(Math.max(0, loser.treasuryArena) * 0.08)));

    const winnerTerritory = winner.territoryControl + territorySwing;
    const loserTerritory = Math.max(0, loser.territoryControl - territorySwing);
    const actualTreasurySwing = Math.min(treasurySwing, Math.max(0, loser.treasuryArena));
    const winnerTreasury = winner.treasuryArena + actualTreasurySwing;
    const loserTreasury = Math.max(0, loser.treasuryArena - actualTreasurySwing);

    await prisma.$transaction(async (tx) => {
      await tx.crew.update({
        where: { id: winner.id },
        data: {
          territoryControl: winnerTerritory,
          treasuryArena: winnerTreasury,
          momentum: Math.min(100, winner.momentum + 3),
          warScore: Math.trunc(winner.warScore * CREW_SCORE_DECAY),
          lastResolvedTick: tick,
        },
      });
      await tx.crew.update({
        where: { id: loser.id },
        data: {
          territoryControl: loserTerritory,
          treasuryArena: loserTreasury,
          momentum: Math.max(-100, loser.momentum - 3),
          warScore: Math.trunc(loser.warScore * CREW_SCORE_DECAY),
          lastResolvedTick: tick,
        },
      });

      for (const crew of crews.slice(1, crews.length - 1)) {
        await tx.crew.update({
          where: { id: crew.id },
          data: {
            warScore: Math.trunc(crew.warScore * CREW_SCORE_DECAY),
            lastResolvedTick: tick,
          },
        });
      }

      await tx.crewBattleEvent.create({
        data: {
          tick,
          winnerCrewId: winner.id,
          loserCrewId: loser.id,
          territorySwing,
          treasurySwing: actualTreasurySwing,
          summary:
            `${winner.name} outperformed ${loser.name} this epoch. ` +
            `Territory ${winner.name} +${territorySwing}, ${loser.name} -${territorySwing}; ` +
            `treasury swing ${actualTreasurySwing} $ARENA.`,
          metadataJson: JSON.stringify({
            winnerScore: winner.warScore,
            loserScore: loser.warScore,
            scoreGap,
          }),
        },
      });
    });
  }

  async getRecentOrders(agentId: string, limit = 12): Promise<CrewOrderView[]> {
    const rows = await prisma.crewOrder.findMany({
      where: { agentId: safeTrim(agentId, 120) },
      include: { crew: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: 'desc' }],
      take: Math.max(1, Math.min(100, Math.floor(limit))),
    });
    return rows.map((row) => this.toOrderView(row));
  }

  orderStatusApplied(status: string): boolean {
    return isPositiveStatus(status);
  }
}

export const crewWarsService = new CrewWarsService();
