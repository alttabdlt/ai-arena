/**
 * TownService — World state management for AI Town.
 *
 * Handles: town creation, plot management, building construction (proof of inference),
 * yield distribution, event logging, and world stats.
 */

import {
  Town,
  Plot,
  WorkLog,
  TownContribution,
  TownEvent,
  PlotZone,
  WorkType,
  TownEventType,
} from '@prisma/client';
import { prisma } from '../config/database';
import { degenStakingService } from './degenStakingService';

// ============================================
// Constants
// ============================================

const BASE_PLOTS = 25; // Plots per town at level 1
const PLOTS_PER_LEVEL = 5; // Extra plots per level
const BASE_YIELD_PER_TICK = 10; // $ARENA per yield tick at level 1
const YIELD_MULTIPLIER = 1.5; // Yield scales per level
const BASE_PLOT_COST = 10; // $ARENA to claim a plot at level 1
const COST_PER_LEVEL = 5; // Extra cost per level
const MIN_API_CALLS_TO_BUILD = 3; // Minimum inference calls to complete a building

// Building types and their requirements
// Open-ended building system — agents can build ANYTHING.
// Cost scales by zone complexity. No fixed building type list.
const ZONE_BASE_COST: Record<string, number> = {
  RESIDENTIAL: 10,
  COMMERCIAL: 20,
  CIVIC: 35,
  INDUSTRIAL: 20,
  ENTERTAINMENT: 25,
};
const MIN_API_CALLS_PER_ZONE: Record<string, number> = {
  RESIDENTIAL: 3,
  COMMERCIAL: 4,
  CIVIC: 5,
  INDUSTRIAL: 4,
  ENTERTAINMENT: 4,
};

// Legacy lookup for backwards compat (existing buildings)
const BUILDING_REQUIREMENTS: Record<string, { zone: PlotZone; minApiCalls: number; baseCost: number }> = {
  HOUSE: { zone: 'RESIDENTIAL', minApiCalls: 3, baseCost: 10 },
  APARTMENT: { zone: 'RESIDENTIAL', minApiCalls: 5, baseCost: 20 },
  TAVERN: { zone: 'COMMERCIAL', minApiCalls: 5, baseCost: 25 },
  SHOP: { zone: 'COMMERCIAL', minApiCalls: 4, baseCost: 20 },
  MARKET: { zone: 'COMMERCIAL', minApiCalls: 6, baseCost: 30 },
  TOWN_HALL: { zone: 'CIVIC', minApiCalls: 8, baseCost: 50 },
  LIBRARY: { zone: 'CIVIC', minApiCalls: 6, baseCost: 35 },
  WORKSHOP: { zone: 'INDUSTRIAL', minApiCalls: 4, baseCost: 20 },
  FARM: { zone: 'INDUSTRIAL', minApiCalls: 4, baseCost: 15 },
  MINE: { zone: 'INDUSTRIAL', minApiCalls: 5, baseCost: 25 },
  ARENA: { zone: 'ENTERTAINMENT', minApiCalls: 7, baseCost: 40 },
  PARK: { zone: 'ENTERTAINMENT', minApiCalls: 3, baseCost: 10 },
  THEATER: { zone: 'ENTERTAINMENT', minApiCalls: 6, baseCost: 30 },
};

// Town themes for procedural generation
const TOWN_THEMES = [
  'medieval fishing village',
  'cyberpunk trading hub',
  'steampunk mining outpost',
  'tropical island resort',
  'desert oasis marketplace',
  'mountain fortress town',
  'floating sky city',
  'underground crystal caverns settlement',
  'enchanted forest commune',
  'volcanic forge city',
  'arctic research station',
  'pirate cove harbor',
];

// Plot zone distribution for a town (percentage-based)
const ZONE_DISTRIBUTION: { zone: PlotZone; pct: number }[] = [
  { zone: 'RESIDENTIAL', pct: 0.32 },
  { zone: 'COMMERCIAL', pct: 0.24 },
  { zone: 'CIVIC', pct: 0.08 },
  { zone: 'INDUSTRIAL', pct: 0.20 },
  { zone: 'ENTERTAINMENT', pct: 0.16 },
];

// ============================================
// Town Service
// ============================================

export class TownService {
  // ============================================
  // Town Management
  // ============================================

  async createTown(name: string, theme?: string, totalPlots?: number, level?: number): Promise<Town & { plots: Plot[] }> {
    const lvl = level || 1;
    const plots = totalPlots || BASE_PLOTS + (lvl - 1) * PLOTS_PER_LEVEL;
    const chosenTheme = theme || TOWN_THEMES[Math.floor(Math.random() * TOWN_THEMES.length)];
    const yieldPerTick = Math.floor(BASE_YIELD_PER_TICK * Math.pow(YIELD_MULTIPLIER, lvl - 1));

    // Create town + plots in a transaction
    const town = await prisma.$transaction(async (tx) => {
      const t = await tx.town.create({
        data: {
          name,
          level: lvl,
          theme: chosenTheme,
          totalPlots: plots,
          yieldPerTick,
        },
      });

      // Generate plots with zone distribution
      const plotData = this.generatePlotLayout(t.id, plots);
      await tx.plot.createMany({ data: plotData });

      // Log creation event
      await tx.townEvent.create({
        data: {
          townId: t.id,
          eventType: 'TOWN_CREATED',
          title: `🏗️ ${name} Founded!`,
          description: `A new ${chosenTheme} is being built! ${plots} plots available for construction.`,
          metadata: JSON.stringify({ level: lvl, theme: chosenTheme, totalPlots: plots }),
        },
      });

      return tx.town.findUniqueOrThrow({
        where: { id: t.id },
        include: { plots: { orderBy: { plotIndex: 'asc' } } },
      });
    });

    return town;
  }

  private generatePlotLayout(townId: string, totalPlots: number): Array<{
    townId: string;
    plotIndex: number;
    x: number;
    y: number;
    zone: PlotZone;
  }> {
    const hashToUint32 = (input: string): number => {
      // FNV-1a 32-bit
      let h = 2166136261;
      for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    };

    const mulberry32 = (seed: number) => {
      return () => {
        let t = (seed += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };

    const rng = mulberry32(hashToUint32(`${townId}:layout:v2`));

    const shuffleInPlace = <T>(arr: T[]) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    const pickOne = <T>(arr: T[]): T => {
      return arr[Math.floor(rng() * arr.length)]!;
    };

    const plots: Array<{ townId: string; plotIndex: number; x: number; y: number; zone: PlotZone }> = [];

    // Build zone list based on distribution
    const zoneList: PlotZone[] = [];
    for (const { zone, pct } of ZONE_DISTRIBUTION) {
      const count = Math.round(totalPlots * pct);
      for (let i = 0; i < count; i++) zoneList.push(zone);
    }
    // Fill remaining with RESIDENTIAL
    while (zoneList.length < totalPlots) zoneList.push('RESIDENTIAL');
    shuffleInPlace(zoneList);

    // Seeded, district-style layout:
    // - Keep plot count constant, but spread plots into spatially coherent districts with gaps.
    // - Coordinates are "tile" units (ints) later scaled by the frontend's TOWN_SPACING.
    const zoneCounts: Record<PlotZone, number> = {
      RESIDENTIAL: 0,
      COMMERCIAL: 0,
      CIVIC: 0,
      INDUSTRIAL: 0,
      ENTERTAINMENT: 0,
    };
    for (const z of zoneList) zoneCounts[z] = (zoneCounts[z] || 0) + 1;

    const densityBase = totalPlots <= 25 ? 0.14 : 0.18;
    const density = Math.max(0.10, Math.min(0.24, densityBase + (rng() - 0.5) * 0.06));
    const gridSide = Math.max(8, Math.ceil(Math.sqrt(totalPlots / density)));
    const half = Math.max(5, Math.floor(gridSide / 2));

    const centersByZone: Record<PlotZone, Array<{ x: number; y: number }>> = {
      RESIDENTIAL: [],
      COMMERCIAL: [],
      CIVIC: [],
      INDUSTRIAL: [],
      ENTERTAINMENT: [],
    };

    const placedCenters: Array<{ x: number; y: number }> = [];
    const minSep = Math.max(4, Math.floor(half * 0.55));

    const placeCenter = (zone: PlotZone, radiusMin: number, radiusMax: number) => {
      const maxR = Math.max(radiusMin, Math.min(radiusMax, half));
      for (let attempt = 0; attempt < 80; attempt++) {
        const ang = rng() * Math.PI * 2;
        const r = radiusMin + rng() * (maxR - radiusMin);
        const x = Math.max(-half, Math.min(half, Math.round(Math.cos(ang) * r)));
        const y = Math.max(-half, Math.min(half, Math.round(Math.sin(ang) * r)));
        const ok = placedCenters.every((c) => {
          const dx = c.x - x;
          const dy = c.y - y;
          return dx * dx + dy * dy >= minSep * minSep;
        });
        if (!ok) continue;
        centersByZone[zone].push({ x, y });
        placedCenters.push({ x, y });
        return;
      }
      // Fallback: if we can't place with separation, just drop near the edge.
      const x = Math.round((rng() * 2 - 1) * half);
      const y = Math.round((rng() * 2 - 1) * half);
      centersByZone[zone].push({ x, y });
      placedCenters.push({ x, y });
    };

    // Primary districts
    centersByZone.COMMERCIAL.push({ x: 0, y: 0 });
    placedCenters.push({ x: 0, y: 0 });

    const outerMin = Math.max(4, Math.floor(half * 0.65));
    const outerMax = Math.max(outerMin + 1, half);
    placeCenter('INDUSTRIAL', outerMin, outerMax);
    placeCenter('ENTERTAINMENT', outerMin, outerMax);

    // Residential often sprawls — sometimes split into two districts.
    const resCenters = zoneCounts.RESIDENTIAL >= Math.max(8, Math.floor(totalPlots * 0.28)) ? 2 : 1;
    for (let i = 0; i < resCenters; i++) {
      placeCenter('RESIDENTIAL', Math.max(2, Math.floor(half * 0.35)), Math.max(3, Math.floor(half * 0.85)));
    }

    // Civic hugs the commercial core.
    const civicOffset = () => Math.round((rng() + rng() - 1) * 2); // biased [-2..2]
    centersByZone.CIVIC.push({ x: civicOffset(), y: civicOffset() });

    const spreadByZone: Record<PlotZone, number> = {
      RESIDENTIAL: 4,
      COMMERCIAL: 3,
      CIVIC: 2,
      INDUSTRIAL: 3,
      ENTERTAINMENT: 3,
    };

    const used = new Set<string>();
    const tryPlace = (zone: PlotZone) => {
      const centers = centersByZone[zone].length > 0 ? centersByZone[zone] : centersByZone.COMMERCIAL;
      const center = pickOne(centers);
      const baseSpread = spreadByZone[zone] || 3;

      for (let attempt = 0; attempt < 140; attempt++) {
        const spread = Math.min(baseSpread + Math.floor(attempt / 35), baseSpread + 3);
        const dx = Math.round((rng() + rng() - 1) * spread);
        const dy = Math.round((rng() + rng() - 1) * spread);
        const x = center.x + dx;
        const y = center.y + dy;
        if (x < -half || x > half || y < -half || y > half) continue;
        const key = `${x}:${y}`;
        if (used.has(key)) continue;
        used.add(key);
        return { x, y };
      }

      // Worst-case fallback: brute force find any free tile.
      for (let attempt = 0; attempt < 600; attempt++) {
        const x = Math.round((rng() * 2 - 1) * half);
        const y = Math.round((rng() * 2 - 1) * half);
        const key = `${x}:${y}`;
        if (used.has(key)) continue;
        used.add(key);
        return { x, y };
      }

      // Truly pathological fallback (shouldn't happen for demo sizes).
      return { x: 0, y: 0 };
    };

    for (let i = 0; i < totalPlots; i++) {
      const zone = zoneList[i];
      const { x, y } = tryPlace(zone);
      plots.push({
        townId,
        plotIndex: i,
        x,
        y,
        zone,
      });
    }
    return plots;
  }

  async getTown(townId: string): Promise<(Town & { plots: Plot[]; contributions: TownContribution[] }) | null> {
    return prisma.town.findUnique({
      where: { id: townId },
      include: {
        plots: { orderBy: { plotIndex: 'asc' } },
        contributions: {
          include: { agent: { select: { id: true, name: true, archetype: true } } },
          orderBy: { arenaSpent: 'desc' },
        },
      },
    });
  }

  async getActiveTown(): Promise<(Town & { plots: Plot[] }) | null> {
    return prisma.town.findFirst({
      where: { status: 'BUILDING' },
      orderBy: { createdAt: 'desc' },
      include: { plots: { orderBy: { plotIndex: 'asc' } } },
    });
  }

  async getAllTowns(): Promise<Town[]> {
    return prisma.town.findMany({ orderBy: { level: 'asc' } });
  }

  async getTownProgress(townId: string) {
    const town = await prisma.town.findUniqueOrThrow({ where: { id: townId } });
    const contributions = await prisma.townContribution.findMany({
      where: { townId },
      include: { agent: { select: { id: true, name: true, archetype: true } } },
      orderBy: { arenaSpent: 'desc' },
      take: 10,
    });
    const totalApiCalls = await prisma.workLog.aggregate({
      where: { townId },
      _sum: { apiCalls: true },
    });

    return {
      townId,
      name: town.name,
      level: town.level,
      status: town.status,
      completion: town.completionPct,
      plotsBuilt: town.builtPlots,
      totalPlots: town.totalPlots,
      totalInvested: town.totalInvested,
      totalApiCalls: totalApiCalls._sum.apiCalls || 0,
      yieldPerTick: town.yieldPerTick,
      topContributors: contributions,
    };
  }

  // ============================================
  // Plot Management
  // ============================================

  async claimPlot(agentId: string, townId: string, plotIndex: number): Promise<Plot> {
    return prisma.$transaction(async (tx) => {
      const town = await tx.town.findUniqueOrThrow({ where: { id: townId } });
      if (town.status !== 'BUILDING') {
        throw new Error('Town is not accepting new construction');
      }

      const plot = await tx.plot.findUnique({
        where: { townId_plotIndex: { townId, plotIndex } },
      });
      if (!plot) throw new Error(`Plot ${plotIndex} does not exist`);
      if (plot.status !== 'EMPTY') throw new Error(`Plot ${plotIndex} is already ${plot.status.toLowerCase()}`);

      const claimCost = BASE_PLOT_COST + (town.level - 1) * COST_PER_LEVEL;

      // Check agent balance
      const agent = await tx.arenaAgent.findUniqueOrThrow({ where: { id: agentId } });
      if (agent.bankroll < claimCost) {
        throw new Error(`Not enough $ARENA. Need ${claimCost}, have ${agent.bankroll}`);
      }

      // Deduct cost
      await tx.arenaAgent.update({
        where: { id: agentId },
        data: { bankroll: { decrement: claimCost } },
      });

      // Update plot
      const updated = await tx.plot.update({
        where: { id: plot.id },
        data: { status: 'CLAIMED', ownerId: agentId },
      });

      // Track contribution
      await this.upsertContribution(tx, agentId, townId, claimCost, 0, 0);

      // Update town investment
      await tx.town.update({
        where: { id: townId },
        data: { totalInvested: { increment: claimCost } },
      });

      // Log event
      await tx.townEvent.create({
        data: {
          townId,
          agentId,
          eventType: 'PLOT_CLAIMED',
          title: `📍 Plot ${plotIndex} claimed!`,
          description: `${agent.name} claimed plot ${plotIndex} (${plot.zone}) for ${claimCost} $ARENA`,
          metadata: JSON.stringify({ plotIndex, zone: plot.zone, cost: claimCost }),
        },
      });

      // Resolve any open objective targeting this plot (stakes + follow-up).
      // NOTE: We keep this lightweight by scanning recent CUSTOM events (demo-scale).
      try {
        const now = Date.now();
        const since = new Date(now - 10 * 60_000);
        const recentCustom = await tx.townEvent.findMany({
          where: { townId, eventType: 'CUSTOM', createdAt: { gte: since } },
          orderBy: { createdAt: 'desc' },
          take: 160,
          select: { id: true, title: true, metadata: true, createdAt: true },
        });

        const resolvedIds = new Set<string>();
        for (const e of recentCustom) {
          let meta: any = null;
          try {
            meta = JSON.parse(e.metadata || '{}');
          } catch {
            meta = null;
          }
          if (!meta || typeof meta !== 'object') continue;
          if (String(meta.kind || '') !== 'TOWN_OBJECTIVE_RESOLVED') continue;
          const objectiveId = typeof meta.objectiveId === 'string' ? meta.objectiveId : '';
          if (objectiveId) resolvedIds.add(objectiveId);
        }

        for (const e of recentCustom) {
          if (resolvedIds.has(e.id)) continue;
          let meta: any = null;
          try {
            meta = JSON.parse(e.metadata || '{}');
          } catch {
            meta = null;
          }
          if (!meta || typeof meta !== 'object') continue;
          if (String(meta.kind || '') !== 'TOWN_OBJECTIVE') continue;
          const objectiveType = String(meta.objectiveType || '').toUpperCase();
          if (objectiveType !== 'RACE_CLAIM' && objectiveType !== 'PACT_CLAIM') continue;

          if (objectiveType === 'RACE_CLAIM') {
            const targetPlot = Number(meta.plotIndex);
            if (!Number.isFinite(targetPlot) || targetPlot !== plotIndex) continue;

            const expiresAtMs = Number(meta.expiresAtMs || 0);
            if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) continue;

            const participants = Array.isArray(meta.participants)
              ? meta.participants.filter((p: any) => typeof p === 'string')
              : [];
            if (participants.length < 2) continue;

            const stakeArenaRaw = Number(meta.stakeArena || 0);
            const stakeArena = Number.isFinite(stakeArenaRaw) ? Math.max(0, Math.min(50, Math.trunc(stakeArenaRaw))) : 0;

            const claimerIsParticipant = participants.includes(agentId);
            const winnerId = agentId;
            const loserId = claimerIsParticipant ? (participants.find((p: string) => p !== agentId) || null) : null;

            let paidArena = 0;
            let loserName = '';

            if (claimerIsParticipant && loserId && stakeArena > 0) {
              const loser = await tx.arenaAgent.findUnique({ where: { id: loserId }, select: { name: true, bankroll: true } });
              if (loser) {
                loserName = loser.name;
                paidArena = Math.min(stakeArena, Math.max(0, loser.bankroll));
                if (paidArena > 0) {
                  await tx.arenaAgent.update({ where: { id: loserId }, data: { bankroll: { decrement: paidArena } } });
                  await tx.arenaAgent.update({ where: { id: winnerId }, data: { bankroll: { increment: paidArena } } });
                }
              }
            }

            const zone = typeof meta.zone === 'string' ? meta.zone : String(plot.zone);
            const title = claimerIsParticipant
              ? `🏆 Plot race won: ${agent.name}`
              : `🪓 Plot race sniped by ${agent.name}`;
            const desc = claimerIsParticipant
              ? `${agent.name} claimed plot ${plotIndex} first.${paidArena > 0 && loserName ? ` ${loserName} pays ${paidArena} $ARENA.` : ''}`
              : `${agent.name} claimed plot ${plotIndex}, ruining the race.`;

            await tx.townEvent.create({
              data: {
                townId,
                eventType: 'CUSTOM',
                title,
                description: desc.slice(0, 900),
                metadata: JSON.stringify({
                  kind: 'TOWN_OBJECTIVE_RESOLVED',
                  objectiveId: e.id,
                  objectiveType: 'RACE_CLAIM',
                  participants,
                  plotIndex,
                  zone,
                  stakeArena,
                  paidArena,
                  winnerId,
                  loserId,
                  resolution: claimerIsParticipant ? 'CLAIMED' : 'SNIPED',
                  resolvedAtMs: now,
                  objectiveTitle: e.title,
                }),
              },
            });

            break; // Only resolve one objective per claim.
          }

          if (objectiveType === 'PACT_CLAIM') {
            const expiresAtMs = Number(meta.expiresAtMs || 0);
            if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) continue;

            const participants = Array.isArray(meta.participants)
              ? meta.participants.filter((p: any) => typeof p === 'string')
              : [];
            if (participants.length < 2) continue;

            const assignmentsRaw = meta.assignments;
            const assignmentsObj =
              assignmentsRaw && typeof assignmentsRaw === 'object'
                ? (assignmentsRaw as Record<string, unknown>)
                : null;
            if (!assignmentsObj) continue;

            const assignments = Object.entries(assignmentsObj)
              .map(([aid, idx]) => ({ agentId: String(aid), plotIndex: Number(idx) }))
              .filter((x) => x.agentId && Number.isFinite(x.plotIndex));
            if (assignments.length < 2) continue;

            // Only consider objectives where this claim matches one of the assigned plots.
            const currentAssignment = assignments.find((a) => a.plotIndex === plotIndex) || null;
            if (!currentAssignment) continue;

            const zone = typeof meta.zone === 'string' ? meta.zone : String(plot.zone);

            // Check both assigned plots' owners.
            const plotIndices = Array.from(new Set(assignments.map((a) => a.plotIndex))).slice(0, 2);
            if (plotIndices.length < 2) continue;

            const assignedPlots = await tx.plot.findMany({
              where: { townId, plotIndex: { in: plotIndices } },
              select: { plotIndex: true, ownerId: true },
            });
            const ownerByIndex = new Map<number, string | null>();
            for (const p of assignedPlots) ownerByIndex.set(p.plotIndex, p.ownerId);

            const wrongClaims = assignments
              .map((a) => {
                const ownerId = ownerByIndex.get(a.plotIndex) ?? null;
                return { ...a, ownerId };
              })
              .filter((a) => a.ownerId && a.ownerId !== a.agentId);

            const fulfilled = assignments.every((a) => {
              const ownerId = ownerByIndex.get(a.plotIndex) ?? null;
              return ownerId === a.agentId;
            });

            const broken = wrongClaims.length > 0;

            if (!fulfilled && !broken) {
              continue; // Pact still in progress.
            }

            const breakerId = broken ? (wrongClaims[0]?.ownerId ?? agentId) : null;
            const breaker =
              broken && typeof breakerId === 'string'
                ? await tx.arenaAgent.findUnique({ where: { id: breakerId }, select: { name: true } })
                : null;

            const title = fulfilled
              ? `✅ Pact fulfilled in ${zone}`
              : `💔 Pact broken in ${zone}`;
            const desc = fulfilled
              ? `Both assigned plots were claimed as agreed.`
              : `${breaker?.name || 'Someone'} ruined the pact by claiming an assigned plot.`;

            await tx.townEvent.create({
              data: {
                townId,
                eventType: 'CUSTOM',
                title,
                description: desc.slice(0, 900),
                metadata: JSON.stringify({
                  kind: 'TOWN_OBJECTIVE_RESOLVED',
                  objectiveId: e.id,
                  objectiveType: 'PACT_CLAIM',
                  participants,
                  assignments: assignments.reduce<Record<string, number>>((acc, a) => {
                    acc[a.agentId] = a.plotIndex;
                    return acc;
                  }, {}),
                  owners: assignments.reduce<Record<string, string | null>>((acc, a) => {
                    acc[String(a.plotIndex)] = ownerByIndex.get(a.plotIndex) ?? null;
                    return acc;
                  }, {}),
                  zone,
                  breakerId,
                  resolution: fulfilled ? 'FULFILLED' : 'BROKEN',
                  resolvedAtMs: now,
                  objectiveTitle: e.title,
                }),
              },
            });

            break; // Only resolve one objective per claim.
          }
        }
      } catch {
        // Non-fatal — objectives are a spectator-facing layer.
      }

      return updated;
    });
  }

  async getAvailablePlots(townId: string): Promise<Plot[]> {
    return prisma.plot.findMany({
      where: { townId, status: 'EMPTY' },
      orderBy: { plotIndex: 'asc' },
    });
  }

  async getAgentPlots(agentId: string): Promise<Plot[]> {
    return prisma.plot.findMany({
      where: { OR: [{ ownerId: agentId }, { builderId: agentId }] },
      include: { town: { select: { name: true, level: true, status: true } } },
    });
  }

  // ============================================
  // Building (Proof of Inference)
  // ============================================

  async startBuild(agentId: string, plotId: string, buildingType: string): Promise<Plot> {
    const bt = buildingType.toUpperCase();

    return prisma.$transaction(async (tx) => {
      const plot = await tx.plot.findUniqueOrThrow({
        where: { id: plotId },
        include: { town: true },
      });

      if (plot.status !== 'CLAIMED') {
        throw new Error(`Plot must be CLAIMED before building. Current: ${plot.status}`);
      }
      if (plot.ownerId !== agentId) {
        throw new Error('You do not own this plot');
      }

      // Open-ended: any building type is allowed. Cost based on zone.
      const legacyReqs = BUILDING_REQUIREMENTS[bt];
      const baseCost = legacyReqs?.baseCost || ZONE_BASE_COST[plot.zone] || 15;
      const buildCost = baseCost * plot.town.level;
      const agent = await tx.arenaAgent.findUniqueOrThrow({ where: { id: agentId } });
      if (agent.bankroll < buildCost) {
        throw new Error(`Not enough $ARENA. Building ${bt} costs ${buildCost}, have ${agent.bankroll}`);
      }

      // Deduct build cost
      await tx.arenaAgent.update({
        where: { id: agentId },
        data: { bankroll: { decrement: buildCost } },
      });

      // Update plot
      const updated = await tx.plot.update({
        where: { id: plotId },
        data: {
          status: 'UNDER_CONSTRUCTION',
          buildingType: bt,
          builderId: agentId,
          buildCostArena: buildCost,
          buildStartedAt: new Date(),
        },
      });

      // Track contribution
      await this.upsertContribution(tx, agentId, plot.townId, buildCost, 0, 0);

      // Update town investment
      await tx.town.update({
        where: { id: plot.townId },
        data: { totalInvested: { increment: buildCost } },
      });

      // Log event
      await tx.townEvent.create({
        data: {
          townId: plot.townId,
          agentId,
          eventType: 'BUILD_STARTED',
          title: `🔨 ${bt} construction started!`,
          description: `${agent.name} began building a ${bt} on plot ${plot.plotIndex} (${buildCost} $ARENA)`,
          metadata: JSON.stringify({ plotIndex: plot.plotIndex, buildingType: bt, cost: buildCost }),
        },
      });

      return updated;
    });
  }

  // Sanitize strings for PostgreSQL — strip null bytes and invalid sequences
  private sanitize(s: string): string {
    return s.replace(/\x00/g, '').replace(/\\x[0-9a-fA-F]{0,1}(?![0-9a-fA-F])/g, '');
  }

  async submitWork(
    agentId: string,
    plotId: string,
    workType: WorkType,
    description: string,
    input: string,
    output: string,
    apiCalls: number,
    apiCostCents: number,
    modelUsed: string,
    responseTimeMs: number = 0,
  ): Promise<WorkLog> {
    const plot = await prisma.plot.findUniqueOrThrow({
      where: { id: plotId },
      include: { town: true },
    });

    if (plot.status !== 'UNDER_CONSTRUCTION') {
      throw new Error(`Plot is not under construction. Status: ${plot.status}`);
    }
    if (plot.builderId !== agentId && plot.ownerId !== agentId) {
      throw new Error('You are not the builder or owner of this plot');
    }

    // Create work log (sanitize LLM output for DB safety)
    const safeDesc = this.sanitize(description);
    const safeInput = this.sanitize(input);
    const safeOutput = this.sanitize(output);
    const workLog = await prisma.workLog.create({
      data: {
        agentId,
        plotId,
        townId: plot.townId,
        workType,
        description: safeDesc,
        input: safeInput,
        output: safeOutput,
        apiCalls,
        apiCostCents,
        modelUsed,
        responseTimeMs,
      },
    });

    // Update plot API call count and building data
    const existingData = JSON.parse(plot.buildingData || '{}');
    const workKey = `${workType.toLowerCase()}_${Date.now()}`;
    existingData[workKey] = { description: safeDesc, output: safeOutput.substring(0, 2000) }; // Cap stored output

    await prisma.plot.update({
      where: { id: plotId },
      data: {
        apiCallsUsed: { increment: apiCalls },
        buildingData: JSON.stringify(existingData),
      },
    });

    // Track contribution (api calls)
    await this.upsertContribution(prisma, agentId, plot.townId, 0, apiCalls, 0);

    // Update agent API cost tracking
    await prisma.arenaAgent.update({
      where: { id: agentId },
      data: { apiCostCents: { increment: apiCostCents } },
    });

    return workLog;
  }

  async completeBuild(agentId: string, plotId: string): Promise<Plot> {
    return prisma.$transaction(async (tx) => {
      const plot = await tx.plot.findUniqueOrThrow({
        where: { id: plotId },
        include: { town: true },
      });

      if (plot.status !== 'UNDER_CONSTRUCTION') {
        throw new Error(`Plot is not under construction. Status: ${plot.status}`);
      }
      if (plot.builderId !== agentId && plot.ownerId !== agentId) {
        throw new Error('You are not the builder or owner of this plot');
      }

      // Check minimum API calls — open-ended system uses zone-based minimums
      const bt = plot.buildingType || '';
      const legacyReqs = BUILDING_REQUIREMENTS[bt];
      const minCalls = legacyReqs?.minApiCalls || MIN_API_CALLS_PER_ZONE[plot.zone] || MIN_API_CALLS_TO_BUILD;
      if (plot.apiCallsUsed < minCalls) {
        throw new Error(`Not enough work done. Requires ${minCalls} API calls, only ${plot.apiCallsUsed} submitted.`);
      }

      // Complete the build
      const updated = await tx.plot.update({
        where: { id: plotId },
        data: {
          status: 'BUILT',
          buildCompletedAt: new Date(),
        },
      });

      // Update town progress
      const town = await tx.town.update({
        where: { id: plot.townId },
        data: {
          builtPlots: { increment: 1 },
          completionPct: ((plot.town.builtPlots + 1) / plot.town.totalPlots) * 100,
        },
      });

      // Track plots built
      await this.upsertContribution(tx, agentId, plot.townId, 0, 0, 1);

      // Get agent name for event
      const agent = await tx.arenaAgent.findUniqueOrThrow({
        where: { id: agentId },
        select: { name: true },
      });

      // Log event
      await tx.townEvent.create({
        data: {
          townId: plot.townId,
          agentId,
          eventType: 'BUILD_COMPLETED',
          title: `🏠 ${plot.buildingName || bt} complete!`,
          description: `${agent.name} finished building ${plot.buildingName || `a ${bt}`} on plot ${plot.plotIndex}. ${plot.apiCallsUsed} API calls of work invested.`,
          metadata: JSON.stringify({
            plotIndex: plot.plotIndex,
            buildingType: bt,
            buildingName: plot.buildingName,
            apiCalls: plot.apiCallsUsed,
            costArena: plot.buildCostArena,
          }),
        },
      });

      // Check town completion
      if (town.builtPlots + 1 >= town.totalPlots) {
        await this.completeTown(tx, plot.townId);
      }

      return updated;
    });
  }

  private async completeTown(tx: any, townId: string): Promise<void> {
    const town = await tx.town.update({
      where: { id: townId },
      data: { status: 'COMPLETE', completedAt: new Date(), completionPct: 100 },
    });

    // Calculate yield shares based on contributions
    const contributions = await tx.townContribution.findMany({ where: { townId } });
    const totalWeight = contributions.reduce(
      (sum: number, c: TownContribution) => sum + c.arenaSpent + c.apiCallsMade * 2, // Weight API calls 2x
      0,
    );

    if (totalWeight > 0) {
      for (const c of contributions) {
        const weight = c.arenaSpent + c.apiCallsMade * 2;
        const share = weight / totalWeight;
        await tx.townContribution.update({
          where: { id: c.id },
          data: { yieldShare: share },
        });
      }
    }

    // Log event
    await tx.townEvent.create({
      data: {
        townId,
        eventType: 'TOWN_COMPLETED',
        title: `🎉 ${town.name} is COMPLETE!`,
        description: `All ${town.totalPlots} plots have been built! The town now generates ${town.yieldPerTick} $ARENA per tick. Contributors will earn yield based on their share.`,
        metadata: JSON.stringify({
          level: town.level,
          totalInvested: town.totalInvested,
          contributors: contributions.length,
        }),
      },
    });
  }

  // ============================================
  // Mining (earn $ARENA through computational work)
  // ============================================

  async submitMiningWork(
    agentId: string,
    townId: string,
    description: string,
    input: string,
    output: string,
    apiCalls: number,
    apiCostCents: number,
    modelUsed: string,
    arenaEarned: number,
    responseTimeMs: number = 0,
  ): Promise<WorkLog> {
    // Verify town exists and is building
    const town = await prisma.town.findUniqueOrThrow({ where: { id: townId } });
    if (town.status !== 'BUILDING') {
      throw new Error('Can only mine in towns under construction');
    }

    // Cap mining reward
    const MAX_MINING_REWARD = 50;
    arenaEarned = Math.max(0, Math.min(MAX_MINING_REWARD, arenaEarned));

    // Rate limit rewarded mining (decision logs also use workType=MINE with arenaEarned=0)
    if (arenaEarned > 0) {
      const recentRewardedMine = await prisma.workLog.findFirst({
        where: {
          agentId,
          workType: 'MINE',
          arenaEarned: { gt: 0 },
          createdAt: { gte: new Date(Date.now() - 30_000) },
        },
      });
      if (recentRewardedMine) throw new Error('Mining cooldown — try again in 30 seconds');
    }

    return prisma.$transaction(async (tx) => {
      const workLog = await tx.workLog.create({
        data: {
          agentId,
          townId,
          workType: 'MINE',
          description: this.sanitize(description),
          input: this.sanitize(input),
          output: this.sanitize(output),
          apiCalls,
          apiCostCents,
          modelUsed,
          responseTimeMs,
          arenaEarned,
        },
      });

      // Credit agent
      await tx.arenaAgent.update({
        where: { id: agentId },
        data: {
          bankroll: { increment: arenaEarned },
          apiCostCents: { increment: apiCostCents },
        },
      });

      // Mining contributes 0 apiCalls to yield weight (it already earns $ARENA directly)
      await this.upsertContribution(tx, agentId, townId, 0, 0, 0);

      return workLog;
    });
  }

  // ============================================
  // Economics
  // ============================================

  async distributeYield(townId: string): Promise<{ distributed: number; recipients: number }> {
    const result = await prisma.$transaction(async (tx) => {
      const town = await tx.town.findUniqueOrThrow({ where: { id: townId } });
      if (town.status !== 'COMPLETE') {
        throw new Error('Town is not complete — no yield to distribute');
      }

      const contributions = await tx.townContribution.findMany({
        where: { townId, yieldShare: { gt: 0 } },
      });

      let totalDistributed = 0;
      for (const c of contributions) {
        const amount = Math.floor(town.yieldPerTick * c.yieldShare);
        if (amount > 0) {
          await tx.arenaAgent.update({
            where: { id: c.agentId },
            data: { bankroll: { increment: amount } },
          });
          await tx.townContribution.update({
            where: { id: c.id },
            data: { totalYieldClaimed: { increment: amount } },
          });
          totalDistributed += amount;
        }
      }

      await tx.town.update({
        where: { id: townId },
        data: { totalYieldPaid: { increment: totalDistributed } },
      });

      return { distributed: totalDistributed, recipients: contributions.length };
    });

    // After transaction: distribute 30% of each agent's yield to their backers (non-blocking)
    if (result.distributed > 0) {
      const contributions = await prisma.townContribution.findMany({
        where: { townId, yieldShare: { gt: 0 } },
      });
      const town = await prisma.town.findUnique({ where: { id: townId } });
      if (town) {
        for (const c of contributions) {
          const agentYield = Math.floor(town.yieldPerTick * c.yieldShare);
          const backerShare = Math.floor(agentYield * 0.3);
          if (backerShare > 0) {
            degenStakingService.distributeYieldToBackers(c.agentId, backerShare).catch(() => {});
          }
        }
      }
    }

    return result;
  }

  async getAgentEconomy(agentId: string) {
    const agent = await prisma.arenaAgent.findUniqueOrThrow({
      where: { id: agentId },
      select: { id: true, name: true, bankroll: true, apiCostCents: true },
    });

    const contributions = await prisma.townContribution.findMany({
      where: { agentId },
      include: { town: { select: { name: true, status: true, yieldPerTick: true } } },
    });

    const totalYieldPending = contributions
      .filter((c) => c.yieldShare > 0)
      .reduce((sum, c) => sum + Math.floor((c as any).town.yieldPerTick * c.yieldShare), 0);

    const totalWorkLogs = await prisma.workLog.count({ where: { agentId } });
    const totalApiCalls = await prisma.workLog.aggregate({
      where: { agentId },
      _sum: { apiCalls: true },
    });

    return {
      agentId: agent.id,
      name: agent.name,
      bankroll: agent.bankroll,
      apiCostCents: agent.apiCostCents,
      totalWorkDone: totalWorkLogs,
      totalApiCalls: totalApiCalls._sum.apiCalls || 0,
      yieldPerTick: totalYieldPending,
      contributions: contributions.map((c) => ({
        townName: (c as any).town.name,
        townStatus: (c as any).town.status,
        arenaSpent: c.arenaSpent,
        apiCallsMade: c.apiCallsMade,
        plotsBuilt: c.plotsBuilt,
        yieldShare: c.yieldShare,
        totalYieldClaimed: c.totalYieldClaimed,
      })),
    };
  }

  // ============================================
  // Town Progression
  // ============================================

  async startNextTown(): Promise<Town & { plots: Plot[] }> {
    // Find current highest level
    const latest = await prisma.town.findFirst({ orderBy: { level: 'desc' } });
    const nextLevel = (latest?.level || 0) + 1;

    // Generate name
    const adjectives = ['New', 'Old', 'Greater', 'Lower', 'Upper', 'North', 'South', 'East', 'West', 'Inner', 'Outer'];
    const nouns = [
      'Haven', 'Creek', 'Ridge', 'Falls', 'Harbor', 'Crossing', 'Hollow',
      'Summit', 'Valley', 'Forge', 'Watch', 'Gate', 'Keep', 'Shore',
    ];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const name = `${adj} ${noun}`;

    return this.createTown(name, undefined, undefined, nextLevel);
  }

  // ============================================
  // Events
  // ============================================

  async logEvent(
    townId: string,
    eventType: TownEventType,
    title: string,
    description: string,
    agentId?: string,
    metadata?: any,
  ): Promise<TownEvent> {
    return prisma.townEvent.create({
      data: {
        townId,
        agentId,
        eventType,
        title,
        description,
        metadata: metadata ? JSON.stringify(metadata) : '{}',
      },
    });
  }

  async getRecentEvents(townId: string, limit: number = 20): Promise<TownEvent[]> {
    return prisma.townEvent.findMany({
      where: { townId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getGlobalEvents(limit: number = 50): Promise<TownEvent[]> {
    return prisma.townEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ============================================
  // Stats
  // ============================================

  async getWorldStats() {
    const [towns, agents, workAgg] = await Promise.all([
      prisma.town.findMany({ select: { status: true, totalInvested: true, totalYieldPaid: true } }),
      prisma.arenaAgent.count({ where: { isActive: true } }),
      prisma.workLog.aggregate({ _sum: { apiCalls: true, apiCostCents: true }, _count: true }),
    ]);

    return {
      totalTowns: towns.length,
      completedTowns: towns.filter((t) => t.status === 'COMPLETE').length,
      buildingTowns: towns.filter((t) => t.status === 'BUILDING').length,
      totalAgents: agents,
      totalArenaInvested: towns.reduce((s, t) => s + t.totalInvested, 0),
      totalYieldPaid: towns.reduce((s, t) => s + t.totalYieldPaid, 0),
      totalWorkLogs: workAgg._count,
      totalApiCalls: workAgg._sum.apiCalls || 0,
      totalApiCostCents: workAgg._sum.apiCostCents || 0,
    };
  }

  // ============================================
  // Helpers
  // ============================================

  private async upsertContribution(
    tx: any,
    agentId: string,
    townId: string,
    arenaSpent: number,
    apiCalls: number,
    plotsBuilt: number,
  ): Promise<void> {
    const existing = await tx.townContribution.findUnique({
      where: { agentId_townId: { agentId, townId } },
    });

    if (existing) {
      await tx.townContribution.update({
        where: { id: existing.id },
        data: {
          arenaSpent: { increment: arenaSpent },
          apiCallsMade: { increment: apiCalls },
          plotsBuilt: { increment: plotsBuilt },
        },
      });
    } else {
      await tx.townContribution.create({
        data: { agentId, townId, arenaSpent, apiCallsMade: apiCalls, plotsBuilt },
      });
    }
  }
}

export const townService = new TownService();
