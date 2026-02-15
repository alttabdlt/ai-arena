import { Request, Response, Router } from 'express';
import { PlotStatus, PlotZone } from '@prisma/client';
import { prisma } from '../config/database';
import { townService } from '../services/townService';
import { crewWarsService } from '../services/crewWarsService';
import { agentLoopService } from '../services/agentLoopService';

const router = Router();
const LOOP_WINDOW_SECONDS = 20;

function safeTrim(value: unknown, maxLen: number): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function normalizeWallet(raw: unknown): string {
  return safeTrim(raw, 140).toLowerCase();
}

function requireAuthenticatedSession(req: Request, res: Response): { wallet: string | null } | null {
  const authFlag = safeTrim(req.headers['x-player-authenticated'], 8);
  if (authFlag !== '1') {
    res.status(401).json({
      ok: false,
      code: 'AUTH_REQUIRED',
      error: 'Sign in required before runtime control actions.',
    });
    return null;
  }
  const wallet = normalizeWallet(req.headers['x-player-wallet']);
  return { wallet: wallet || null };
}

async function ensureWalletOwnsAgent(
  agentId: string,
  wallet: string | null,
): Promise<{ ok: true } | { ok: false; status: number; code: string; error: string }> {
  const agent = await prisma.arenaAgent.findUnique({
    where: { id: agentId },
    select: { id: true, walletAddress: true },
  });

  if (!agent) {
    return {
      ok: false,
      status: 404,
      code: 'TARGET_UNAVAILABLE',
      error: 'Agent is unavailable',
    };
  }

  const ownerWallet = normalizeWallet(agent.walletAddress);
  if (!ownerWallet) return { ok: true };

  if (!wallet) {
    return {
      ok: false,
      status: 401,
      code: 'WALLET_REQUIRED',
      error: 'Signed-in wallet is required for this action.',
    };
  }

  if (wallet !== ownerWallet) {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN_AGENT_ACCESS',
      error: 'Signed-in wallet does not control this agent.',
    };
  }

  return { ok: true };
}

function stripReasonPrefix(reasoning: string): string {
  return safeTrim(
    reasoning
      .replace(/^\[(AUTO|REDIRECT|AUTO-FALLBACK)\]\s*/i, '')
      .replace(/\s+/g, ' '),
    160,
  );
}

function detectBlockedCode(reasoning: string): string | null {
  const text = safeTrim(reasoning, 220).toLowerCase();
  if (!text) return null;
  if (text.includes('insufficient') || text.includes('not enough')) return 'INSUFFICIENT_FUNDS';
  if (text.includes('blocked') || text.includes('constraint')) return 'CONSTRAINT_BLOCK';
  if (text.includes('no active build') || text.includes('no claimable')) return 'NO_TARGET';
  if (text.includes('waiting') || text.includes('cooldown')) return 'WAITING';
  return null;
}

function actionLabel(actionType: string): string {
  const action = safeTrim(actionType, 80).toLowerCase();
  if (!action) return 'IDLE';
  if (action.includes('raid')) return 'RAID';
  if (action.includes('defend')) return 'DEFEND';
  if (action.includes('heist')) return 'HEIST';
  if (action.includes('counter')) return 'COUNTERINTEL';
  if (action.includes('propaganda')) return 'PROPAGANDA';
  if (action.includes('alliance')) return 'ALLIANCE';
  if (action === 'play_arena' || action.includes('fight') || action.includes('arena')) return 'DUEL';
  if (action.includes('claim') || action.includes('build') || action.includes('work') || action.includes('mine')) return 'BUILD';
  if (action.includes('buy_') || action.includes('sell_') || action.includes('trade') || action.includes('transfer')) return 'TRADE';
  if (action === 'rest') return 'REST';
  return action.toUpperCase();
}

function runtimeStateFromAgent(input: {
  isActive: boolean;
  isInMatch: boolean;
  actionType: string;
  lastTickAt: Date | null;
  reason: string;
}): 'PLAN' | 'TRAVEL' | 'SETUP' | 'EXECUTE' | 'RESOLVE' | 'COOLDOWN' | 'BLOCKED' | 'IDLE' | 'PAUSED' {
  if (!input.isActive) return 'PAUSED';
  if (input.isInMatch) return 'EXECUTE';

  const blocked = detectBlockedCode(input.reason);
  if (blocked) return 'BLOCKED';

  const action = safeTrim(input.actionType, 80).toLowerCase();
  const ageSec = input.lastTickAt ? Math.max(0, (Date.now() - input.lastTickAt.getTime()) / 1000) : null;

  if (!action) return 'IDLE';

  if (ageSec != null && ageSec <= 4) return 'RESOLVE';
  if (ageSec != null && ageSec <= 10) return 'COOLDOWN';
  if (action === 'rest') return 'IDLE';

  if (
    action.includes('claim')
    || action.includes('build')
    || action.includes('work')
    || action.includes('trade')
    || action.includes('raid')
    || action.includes('defend')
    || action.includes('crew_')
  ) {
    return 'TRAVEL';
  }

  return 'PLAN';
}

function zoneMinCalls(zone: PlotZone): number {
  if (zone === 'INDUSTRIAL' || zone === 'ENTERTAINMENT') return 5;
  if (zone === 'COMMERCIAL' || zone === 'CIVIC') return 4;
  return 3;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatImpact(meta: Record<string, unknown>): string {
  const delta = Number(meta.bankrollDelta || 0);
  if (Number.isFinite(delta) && delta !== 0) {
    return `${delta > 0 ? '+' : ''}${Math.round(delta)} $ARENA`;
  }
  if (typeof meta.summary === 'string' && meta.summary.trim()) return safeTrim(meta.summary, 80);
  return 'state updated';
}

router.get('/runtime/agents', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [agents, activeTown, memberships, loopStatus] = await Promise.all([
      prisma.arenaAgent.findMany({
        where: {
          OR: [
            { isActive: true },
            { lastTickAt: { not: null } },
          ],
        },
        orderBy: [{ isActive: 'desc' }, { elo: 'desc' }],
        select: {
          id: true,
          name: true,
          archetype: true,
          walletAddress: true,
          isActive: true,
          isInMatch: true,
          bankroll: true,
          reserveBalance: true,
          health: true,
          elo: true,
          wins: true,
          losses: true,
          lastActionType: true,
          lastReasoning: true,
          lastNarrative: true,
          lastTargetPlot: true,
          lastTickAt: true,
        },
      }),
      townService.getActiveTown(),
      prisma.crewMembership.findMany({
        where: { isActive: true },
        include: {
          crew: {
            select: {
              id: true,
              name: true,
              colorHex: true,
            },
          },
        },
      }),
      Promise.resolve({ running: agentLoopService.isRunning(), tick: agentLoopService.getCurrentTick() }),
    ]);

    const membershipByAgentId = new Map(
      memberships.map((row) => [row.agentId, row]),
    );
    const plotByIndex = new Map((activeTown?.plots || []).map((plot) => [plot.plotIndex, plot]));

    const rows = agents.map((agent) => {
      const reason = stripReasonPrefix(agent.lastReasoning || agent.lastNarrative || '');
      const state = runtimeStateFromAgent({
        isActive: agent.isActive,
        isInMatch: agent.isInMatch,
        actionType: agent.lastActionType || '',
        lastTickAt: agent.lastTickAt,
        reason,
      });
      const action = actionLabel(agent.lastActionType || '');
      const ageSec = agent.lastTickAt
        ? Math.max(0, Math.round((Date.now() - agent.lastTickAt.getTime()) / 1000))
        : null;
      const etaSec = state === 'PAUSED'
        ? null
        : ageSec == null
          ? LOOP_WINDOW_SECONDS
          : Math.max(0, LOOP_WINDOW_SECONDS - ageSec);
      const progressPct = etaSec == null
        ? 0
        : clamp(Math.round(((LOOP_WINDOW_SECONDS - etaSec) / LOOP_WINDOW_SECONDS) * 100), 0, 100);

      const targetPlot = Number.isFinite(agent.lastTargetPlot as number)
        ? plotByIndex.get(Number(agent.lastTargetPlot))
        : null;
      const targetLabel = targetPlot
        ? `Plot ${targetPlot.plotIndex} (${targetPlot.zone})`
        : agent.isInMatch
          ? 'Arena duel'
          : action === 'TRADE'
            ? 'Liquidity route'
            : action === 'BUILD'
              ? 'Town objective'
              : action === 'DUEL'
                ? 'Rival agent'
                : 'No target';

      const crew = membershipByAgentId.get(agent.id)?.crew;

      return {
        agentId: agent.id,
        name: agent.name,
        archetype: agent.archetype,
        crewId: crew?.id || null,
        crewName: crew?.name || null,
        crewColor: crew?.colorHex || null,
        isActive: agent.isActive,
        loopRunning: loopStatus.running,
        currentTick: loopStatus.tick,
        state,
        action,
        reason: reason || 'Awaiting next decision cycle.',
        targetType: targetPlot ? 'PLOT' : action === 'DUEL' ? 'AGENT' : 'SYSTEM',
        targetId: targetPlot?.id || null,
        targetLabel,
        etaSec,
        progressPct,
        blockedCode: detectBlockedCode(reason),
        lastOutcome: safeTrim(agent.lastNarrative || '', 120),
        stats: {
          bankroll: agent.bankroll,
          reserveBalance: agent.reserveBalance,
          health: agent.health,
          elo: agent.elo,
          wins: agent.wins,
          losses: agent.losses,
        },
        updatedAt: agent.lastTickAt?.toISOString() || null,
      };
    });

    res.json({
      ok: true,
      running: loopStatus.running,
      tick: loopStatus.tick,
      town: activeTown
        ? { id: activeTown.id, name: activeTown.name, level: activeTown.level }
        : null,
      agents: rows,
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/runtime/crews', async (_req: Request, res: Response): Promise<void> => {
  try {
    const currentTick = agentLoopService.getCurrentTick();
    const [dashboard, recentOrders, memberships] = await Promise.all([
      crewWarsService.getDashboard(8, currentTick),
      prisma.crewOrder.findMany({
        where: { status: { in: ['QUEUED', 'APPLIED'] } },
        include: {
          crew: { select: { id: true, name: true, colorHex: true } },
          agent: { select: { id: true, name: true, archetype: true, lastActionType: true, lastTickAt: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 120,
      }),
      prisma.crewMembership.findMany({
        where: { isActive: true },
        include: {
          crew: { select: { id: true } },
          agent: {
            select: {
              id: true,
              name: true,
              archetype: true,
              lastActionType: true,
              lastTickAt: true,
              isActive: true,
            },
          },
        },
      }),
    ]);

    const latestOrderByCrewId = new Map<string, (typeof recentOrders)[number]>();
    for (const order of recentOrders) {
      if (!latestOrderByCrewId.has(order.crewId)) {
        latestOrderByCrewId.set(order.crewId, order);
      }
    }

    const membersByCrewId = new Map<string, Array<(typeof memberships)[number]['agent']>>();
    for (const membership of memberships) {
      const list = membersByCrewId.get(membership.crewId) || [];
      list.push(membership.agent);
      membersByCrewId.set(membership.crewId, list);
    }

    const rows = dashboard.crews.map((crew) => {
      const latestOrder = latestOrderByCrewId.get(crew.id);
      const crewMembers = (membersByCrewId.get(crew.id) || [])
        .sort((a, b) => {
          const aTick = a.lastTickAt ? a.lastTickAt.getTime() : 0;
          const bTick = b.lastTickAt ? b.lastTickAt.getTime() : 0;
          return bTick - aTick;
        })
        .slice(0, 3)
        .map((agent) => ({
          agentId: agent.id,
          name: agent.name,
          archetype: agent.archetype,
          action: actionLabel(agent.lastActionType || ''),
          state: runtimeStateFromAgent({
            isActive: agent.isActive,
            isInMatch: false,
            actionType: agent.lastActionType || '',
            lastTickAt: agent.lastTickAt,
            reason: '',
          }),
        }));

      const lastBattle = dashboard.recentBattles.find(
        (battle) => battle.winnerCrewId === crew.id || battle.loserCrewId === crew.id,
      );

      return {
        crewId: crew.id,
        name: crew.name,
        colorHex: crew.colorHex,
        objective: dashboard.campaign.objective,
        activeOperation: latestOrder
          ? `${latestOrder.strategy} (${latestOrder.status.toLowerCase()})`
          : 'No active order',
        status: crew.momentum > 0 ? 'PRESSURE' : crew.momentum < 0 ? 'RECOVERING' : 'STABLE',
        activeMembers: crewMembers,
        impactSummary: lastBattle
          ? `${lastBattle.winnerCrewName} vs ${lastBattle.loserCrewName}: ${lastBattle.territorySwing} territory swing`
          : 'No recent battle impact',
        territoryControl: crew.territoryControl,
        treasuryArena: crew.treasuryArena,
        momentum: crew.momentum,
        warScore: crew.warScore,
      };
    });

    res.json({
      ok: true,
      tick: currentTick,
      campaign: dashboard.campaign,
      crews: rows,
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/runtime/zones', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [town, memberships, dashboard] = await Promise.all([
      townService.getActiveTown(),
      prisma.crewMembership.findMany({
        where: { isActive: true },
        select: {
          agentId: true,
          crewId: true,
          crew: { select: { id: true, name: true, colorHex: true } },
        },
      }),
      crewWarsService.getDashboard(4, agentLoopService.getCurrentTick()),
    ]);

    if (!town) {
      res.json({ ok: true, town: null, zones: [] });
      return;
    }

    const membershipByAgentId = new Map(memberships.map((row) => [row.agentId, row]));
    const zones: PlotZone[] = ['RESIDENTIAL', 'COMMERCIAL', 'CIVIC', 'INDUSTRIAL', 'ENTERTAINMENT'];

    const rows = zones.map((zone) => {
      const zonePlots = town.plots.filter((plot) => plot.zone === zone);
      const crewControlCounter = new Map<string, { crewId: string; crewName: string; colorHex: string; score: number }>();

      for (const plot of zonePlots) {
        const ownerMembership = plot.ownerId ? membershipByAgentId.get(plot.ownerId) : null;
        const builderMembership = plot.builderId ? membershipByAgentId.get(plot.builderId) : null;
        const points = plot.status === 'BUILT' ? 3 : plot.status === 'UNDER_CONSTRUCTION' ? 2 : plot.status === 'CLAIMED' ? 1 : 0;

        for (const membership of [ownerMembership, builderMembership]) {
          if (!membership || points <= 0) continue;
          const existing = crewControlCounter.get(membership.crewId);
          if (existing) {
            existing.score += points;
          } else {
            crewControlCounter.set(membership.crewId, {
              crewId: membership.crewId,
              crewName: membership.crew.name,
              colorHex: membership.crew.colorHex,
              score: points,
            });
          }
        }
      }

      const ranked = [...crewControlCounter.values()].sort((a, b) => b.score - a.score);
      const controller = ranked[0] || null;
      const contesting = ranked.slice(1).filter((row) => row.score > 0);
      const threatLevel = contesting.length >= 2
        ? 'HIGH'
        : contesting.length === 1
          ? 'MEDIUM'
          : controller
            ? 'LOW'
            : 'NONE';

      return {
        zoneId: zone,
        label: zone,
        controllerCrewId: controller?.crewId || null,
        controllerCrewName: controller?.crewName || null,
        controllerColorHex: controller?.colorHex || null,
        contestingCrewIds: contesting.map((row) => row.crewId),
        conflictEndsAtTick: dashboard.campaign.nextEpochTick,
        threatLevel,
        totals: {
          plots: zonePlots.length,
          built: zonePlots.filter((plot) => plot.status === 'BUILT').length,
          underConstruction: zonePlots.filter((plot) => plot.status === 'UNDER_CONSTRUCTION').length,
          claimed: zonePlots.filter((plot) => plot.status === 'CLAIMED').length,
        },
      };
    });

    res.json({
      ok: true,
      town: {
        id: town.id,
        name: town.name,
        level: town.level,
      },
      zones: rows,
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/runtime/buildings', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [town, agents] = await Promise.all([
      townService.getActiveTown(),
      prisma.arenaAgent.findMany({
        where: { isActive: true },
        select: { id: true, name: true, archetype: true, lastActionType: true, lastTargetPlot: true, lastTickAt: true },
      }),
    ]);

    if (!town) {
      res.json({ ok: true, town: null, buildings: [] });
      return;
    }

    const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
    const activeTargeting = new Map<number, Array<{ id: string; name: string; archetype: string }>>();
    for (const agent of agents) {
      if (!Number.isFinite(agent.lastTargetPlot as number)) continue;
      const idx = Number(agent.lastTargetPlot);
      const list = activeTargeting.get(idx) || [];
      list.push({ id: agent.id, name: agent.name, archetype: agent.archetype });
      activeTargeting.set(idx, list);
    }

    const rows = town.plots
      .filter((plot) => plot.status !== PlotStatus.EMPTY)
      .map((plot) => {
        const minCalls = zoneMinCalls(plot.zone);
        const progressPct = plot.status === PlotStatus.UNDER_CONSTRUCTION
          ? clamp(Math.round((plot.apiCallsUsed / Math.max(1, minCalls)) * 100), 0, 100)
          : plot.status === PlotStatus.BUILT
            ? 100
            : plot.status === PlotStatus.CLAIMED
              ? 20
              : 0;

        const occupants: Array<{ agentId: string; name: string; archetype: string; role: string }> = [];
        if (plot.ownerId && agentsById.has(plot.ownerId)) {
          const owner = agentsById.get(plot.ownerId)!;
          occupants.push({ agentId: owner.id, name: owner.name, archetype: owner.archetype, role: 'OWNER' });
        }
        if (plot.builderId && agentsById.has(plot.builderId) && plot.builderId !== plot.ownerId) {
          const builder = agentsById.get(plot.builderId)!;
          occupants.push({ agentId: builder.id, name: builder.name, archetype: builder.archetype, role: 'BUILDER' });
        }
        for (const targeter of activeTargeting.get(plot.plotIndex) || []) {
          if (occupants.some((o) => o.agentId === targeter.id)) continue;
          occupants.push({
            agentId: targeter.id,
            name: targeter.name,
            archetype: targeter.archetype,
            role: 'TARGETING',
          });
        }

        const task = plot.status === PlotStatus.UNDER_CONSTRUCTION
          ? 'construction'
          : plot.status === PlotStatus.CLAIMED
            ? 'staging'
            : 'operating';
        const etaSec = plot.status === PlotStatus.UNDER_CONSTRUCTION
          ? Math.max(0, (minCalls - plot.apiCallsUsed) * LOOP_WINDOW_SECONDS)
          : plot.status === PlotStatus.CLAIMED
            ? LOOP_WINDOW_SECONDS
            : 0;

        return {
          plotId: plot.id,
          plotIndex: plot.plotIndex,
          zone: plot.zone,
          status: plot.status,
          buildingType: plot.buildingType || null,
          buildingName: plot.buildingName || null,
          task,
          progressPct,
          etaSec,
          occupants,
        };
      });

    res.json({
      ok: true,
      town: {
        id: town.id,
        name: town.name,
        level: town.level,
      },
      buildings: rows,
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get('/runtime/feed', async (req: Request, res: Response): Promise<void> => {
  try {
    const limitRaw = Number.parseInt(String(req.query.limit || '40'), 10);
    const limit = Number.isFinite(limitRaw) ? clamp(limitRaw, 10, 120) : 40;

    const [events, battles] = await Promise.all([
      townService.getGlobalEvents(limit),
      crewWarsService.getDashboard(Math.min(30, Math.max(6, Math.floor(limit / 2))), agentLoopService.getCurrentTick()),
    ]);

    const eventCards = events.map((event) => {
      let meta: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(event.metadata || '{}');
        if (parsed && typeof parsed === 'object') meta = parsed as Record<string, unknown>;
      } catch {
        meta = {};
      }

      const subject = safeTrim(meta.agentName || meta.builderName || event.title.split(' ')[0] || 'Agent', 40) || 'Agent';
      const verb = safeTrim(meta.kind || event.eventType || 'updated', 30).toLowerCase();
      const object = safeTrim(meta.targetName || meta.buildingName || event.title, 60) || 'objective';
      const location = Number.isFinite(Number(meta.plotIndex)) ? `plot ${Number(meta.plotIndex)}` : 'town';
      const impact = formatImpact(meta);

      return {
        id: `event:${event.id}`,
        timestamp: event.createdAt,
        subject,
        verb,
        object,
        location,
        impact,
        severity: event.eventType === 'TOWN_COMPLETED' ? 'HIGH' : event.eventType === 'BUILD_COMPLETED' ? 'MEDIUM' : 'LOW',
        line: `${subject} ${verb} ${object} at ${location} -> ${impact}`,
        detailsRef: event.id,
      };
    });

    const battleCards = battles.recentBattles.map((battle) => ({
      id: `battle:${battle.id}`,
      timestamp: battle.createdAt,
      subject: battle.winnerCrewName,
      verb: 'defeated',
      object: battle.loserCrewName,
      location: 'crew front',
      impact: `+${battle.territorySwing} territory, +${Math.round(battle.treasurySwing)} $ARENA`,
      severity: 'HIGH',
      line: `${battle.winnerCrewName} defeated ${battle.loserCrewName} at crew front -> +${battle.territorySwing} territory`,
      detailsRef: battle.id,
    }));

    const cards = [...eventCards, ...battleCards]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    res.json({ ok: true, feed: cards });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/runtime/agent/:agentId/pause', async (req: Request, res: Response): Promise<void> => {
  try {
    const session = requireAuthenticatedSession(req, res);
    if (!session) return;

    const ownership = await ensureWalletOwnsAgent(req.params.agentId, session.wallet);
    if (!ownership.ok) {
      res.status(ownership.status).json({ ok: false, code: ownership.code, error: ownership.error });
      return;
    }

    const agent = await prisma.arenaAgent.update({
      where: { id: req.params.agentId },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true },
    });

    res.json({ ok: true, agentId: agent.id, name: agent.name, paused: !agent.isActive });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

router.post('/runtime/agent/:agentId/resume', async (req: Request, res: Response): Promise<void> => {
  try {
    const session = requireAuthenticatedSession(req, res);
    if (!session) return;

    const ownership = await ensureWalletOwnsAgent(req.params.agentId, session.wallet);
    if (!ownership.ok) {
      res.status(ownership.status).json({ ok: false, code: ownership.code, error: ownership.error });
      return;
    }

    const agent = await prisma.arenaAgent.update({
      where: { id: req.params.agentId },
      data: { isActive: true, lastActiveAt: new Date() },
      select: { id: true, name: true, isActive: true },
    });

    res.json({ ok: true, agentId: agent.id, name: agent.name, resumed: agent.isActive });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

export default router;
