/**
 * Town REST API — Endpoints for AI agents to interact with the AI Town world.
 *
 * Auth: Bearer token (agent's apiKey) for mutation endpoints.
 * Base path: /api/v1
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ArenaAgent } from '@prisma/client';
import { townService } from '../services/townService';
import { arenaService } from '../services/arenaService';
import { agentConversationService, type RelationshipContext, type AgentActivity, type PairConversationMemory } from '../services/agentConversationService';
import { socialGraphService } from '../services/socialGraphService';
import { agentGoalService } from '../services/agentGoalService';
import { agentGoalTrackService } from '../services/agentGoalTrackService';
import { agentLoopService } from '../services/agentLoopService';
import { smartAiService } from '../services/smartAiService';
import { agentFundingService } from '../services/agentFundingService';
import { prisma } from '../config/database';
import { isOpenRouterActiveConfig } from '../config/llm';

const router = Router();

// ============================================
// Auth Middleware (shared pattern with arena-api)
// ============================================

interface AuthenticatedRequest extends Request {
  agent?: ArenaAgent;
}

async function authenticateAgent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header. Use: Bearer <api_key>' });
    return;
  }

  const apiKey = authHeader.split(' ')[1];
  const agent = await arenaService.getAgentByApiKey(apiKey);
  if (!agent) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  req.agent = agent;
  next();
}

function requireSpectatorToken(req: Request, res: Response): boolean {
  // Optional hardening: if set, require a token for spectator-triggered side-effects like chat.
  const expected = process.env.TOWN_SPECTATOR_TOKEN;
  if (!expected) return true;
  const provided = String(req.headers['x-arena-spectator-token'] || '');
  if (!provided || provided !== expected) {
    res.status(401).json({ error: 'Missing or invalid spectator token' });
    return false;
  }
  return true;
}

function safeTrim(s: unknown, maxLen: number): string {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function normalizeWallet(value: unknown): string {
  return safeTrim(value, 140).toLowerCase();
}

function requireAuthenticatedSession(req: Request, res: Response): { wallet: string | null } | null {
  const authFlag = safeTrim(req.headers['x-player-authenticated'], 8);
  if (authFlag !== '1') {
    res.status(401).json({
      ok: false,
      code: 'AUTH_REQUIRED',
      error: 'Sign in required before funding actions.',
    });
    return null;
  }
  const wallet = normalizeWallet(req.headers['x-player-wallet']);
  return { wallet: wallet || null };
}

async function ensureWalletOwnsAgent(
  agentId: string,
  wallet: string | null,
): Promise<{ ok: true; agent: { id: string; walletAddress: string | null } } | { ok: false; status: number; code: string; error: string }> {
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
  if (!ownerWallet) return { ok: true, agent };

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

  return { ok: true, agent };
}

function pickRandom<T>(arr: T[]): T | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)] || null;
}

// ============================================
// Town Endpoints (Public — read)
// ============================================

// Get active (currently building) town
router.get('/town', async (_req: Request, res: Response): Promise<void> => {
  try {
    const town = await townService.getActiveTown();
    if (!town) {
      res.json({ town: null, message: 'No active town. Create one first.' });
      return;
    }
    res.json({ town });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all towns
router.get('/towns', async (_req: Request, res: Response): Promise<void> => {
  try {
    const towns = await townService.getAllTowns();
    res.json({ towns });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Lightweight world overview — minimal town data for the multi-town world renderer
router.get('/world/towns', async (_req: Request, res: Response): Promise<void> => {
  try {
    const towns = await prisma.town.findMany({
      select: { id: true, name: true, level: true, status: true, totalPlots: true },
      orderBy: { id: 'asc' },
    });
    res.json(towns);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific town by ID
router.get('/town/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const town = await townService.getTown(req.params.id);
    if (!town) {
      res.status(404).json({ error: 'Town not found' });
      return;
    }
    res.json({ town });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get town progress summary
router.get('/town/:id/progress', async (req: Request, res: Response): Promise<void> => {
  try {
    const progress = await townService.getTownProgress(req.params.id);
    res.json(progress);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get available (empty) plots in a town
router.get('/town/:id/plots', async (req: Request, res: Response): Promise<void> => {
  try {
    const available = req.query.available === 'true';
    if (available) {
      const plots = await townService.getAvailablePlots(req.params.id);
      res.json({ plots });
    } else {
      const town = await townService.getTown(req.params.id);
      res.json({ plots: town?.plots || [] });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get town event feed
router.get('/town/:id/events', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const events = await townService.getRecentEvents(req.params.id, limit);
    res.json({ events });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get town contributor leaderboard
router.get('/town/:id/contributors', async (req: Request, res: Response): Promise<void> => {
  try {
    const progress = await townService.getTownProgress(req.params.id);
    res.json({ contributors: progress.topContributors });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Town Endpoints (Auth — write)
// ============================================

// Create a new town (can be done by any agent or admin)
router.post('/town', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, theme, totalPlots, level } = req.body;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const town = await townService.createTown(name, theme, totalPlots, level);
    res.status(201).json({ town });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Start next town (auto-names, increments level)
router.post('/town/next', async (_req: Request, res: Response): Promise<void> => {
  try {
    const town = await townService.startNextTown();
    res.status(201).json({ town });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Claim a plot
router.post('/town/:id/claim', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { plotIndex } = req.body;
    if (plotIndex === undefined || plotIndex === null) {
      res.status(400).json({ error: 'plotIndex is required' });
      return;
    }
    const plot = await townService.claimPlot(req.agent!.id, req.params.id, plotIndex);
    res.json({ plot });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Start building on a claimed plot
router.post('/town/:id/build', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { plotId, buildingType } = req.body;
    if (!plotId || !buildingType) {
      res.status(400).json({ error: 'plotId and buildingType are required' });
      return;
    }
    const plot = await townService.startBuild(req.agent!.id, plotId, buildingType);
    res.json({ plot });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Submit work (proof of inference) for a building
router.post('/town/:id/work', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { plotId, workType, description, input, output, apiCalls, apiCostCents, modelUsed, responseTimeMs } = req.body;
    if (!plotId || !workType) {
      res.status(400).json({ error: 'plotId and workType are required' });
      return;
    }
    const workLog = await townService.submitWork(
      req.agent!.id,
      plotId,
      workType,
      description || '',
      input || '',
      output || '',
      apiCalls || 1,
      apiCostCents || 0,
      modelUsed || 'unknown',
      responseTimeMs || 0,
    );
    res.json({ workLog });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Complete a build (finalize when enough work is done)
router.post('/town/:id/complete-build', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { plotId } = req.body;
    if (!plotId) {
      res.status(400).json({ error: 'plotId is required' });
      return;
    }
    const plot = await townService.completeBuild(req.agent!.id, plotId);
    res.json({ plot, message: 'Building complete!' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Submit mining work (earn $ARENA)
router.post('/town/:id/mine', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { description, input, output, apiCalls, apiCostCents, modelUsed, arenaEarned, responseTimeMs } = req.body;
    const workLog = await townService.submitMiningWork(
      req.agent!.id,
      req.params.id,
      description || '',
      input || '',
      output || '',
      apiCalls || 1,
      apiCostCents || 0,
      modelUsed || 'unknown',
      Math.min(50, Math.max(0, arenaEarned || 0)),
      responseTimeMs || 0,
    );
    res.json({ workLog });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// Agent Economy
// ============================================

router.get('/agent/:id/economy', async (req: Request, res: Response): Promise<void> => {
  try {
    const economy = await townService.getAgentEconomy(req.params.id);
    res.json(economy);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/agent/me/economy', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const economy = await townService.getAgentEconomy(req.agent!.id);
    res.json(economy);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// World Stats
// ============================================

router.get('/world/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await townService.getWorldStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/world/events', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const events = await townService.getGlobalEvents(limit);
    res.json({ events });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Social (Spectator)
// ============================================

// Generate a short in-world conversation between two agents and update their relationship.
// NOTE: This is intentionally public for demos/spectators. Other agents should not see transcripts.
router.post('/town/:id/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!requireSpectatorToken(req, res)) return;

    const townId = req.params.id;
    const { agentAId, agentBId, topic, openerHint } = req.body || {};
    if (!agentAId || !agentBId) {
      res.status(400).json({ error: 'agentAId and agentBId are required' });
      return;
    }
    if (agentAId === agentBId) {
      res.status(400).json({ error: 'Agents must be different' });
      return;
    }

    const town = await townService.getTown(townId);
    if (!town) {
      res.status(404).json({ error: 'Town not found' });
      return;
    }

    const [agentA, agentB] = await Promise.all([
      prisma.arenaAgent.findUnique({ where: { id: String(agentAId) } }),
      prisma.arenaAgent.findUnique({ where: { id: String(agentBId) } }),
    ]);
    if (!agentA || !agentB) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    // Early cooldown check (before paying for LLM call)
    const pair = agentA.id < agentB.id ? { a: agentA.id, b: agentB.id } : { a: agentB.id, b: agentA.id };
    const existingRel = await prisma.agentRelationship.findUnique({
      where: { agentAId_agentBId: { agentAId: pair.a, agentBId: pair.b } },
    });
    if (existingRel?.lastInteractionAt) {
      const ms = Date.now() - existingRel.lastInteractionAt.getTime();
      if (ms < 45_000) {
        res.status(429).json({ error: 'Pair chat cooldown' });
        return;
      }
    }

    // Pair memory: last 2 chat summaries between these agents (avoid repeating openers)
    let pairMemory: PairConversationMemory | undefined = undefined;
    try {
      const recentCustom = await prisma.townEvent.findMany({
        where: { townId: town.id, eventType: 'CUSTOM' },
        orderBy: { createdAt: 'desc' },
        take: 150,
        select: { description: true, metadata: true },
      });
      const lastSummaries: string[] = [];
      for (const e of recentCustom) {
        if (lastSummaries.length >= 2) break;
        let meta: any = null;
        try {
          meta = JSON.parse(e.metadata || '{}');
        } catch {
          meta = null;
        }
        if (!meta || typeof meta !== 'object') continue;
        if (String(meta.kind || '') !== 'AGENT_CHAT') continue;
        const participants = Array.isArray(meta.participants) ? meta.participants : [];
        if (!participants.includes(pair.a) || !participants.includes(pair.b)) continue;

        const summary = typeof meta.summary === 'string' ? meta.summary : '';
        if (summary) {
          lastSummaries.push(String(summary).slice(0, 180));
          continue;
        }
        // Fallback: try to use a short snippet from the stored transcript or description.
        const line0 = Array.isArray(meta.lines) && meta.lines[0] && typeof meta.lines[0].text === 'string' ? String(meta.lines[0].text) : '';
        const fromDesc = typeof e.description === 'string' ? e.description : '';
        const fallback = (line0 || fromDesc).trim().slice(0, 180);
        if (fallback) lastSummaries.push(fallback);
      }
      if (lastSummaries.length > 0) pairMemory = { lastSummaries };
    } catch {
      pairMemory = undefined;
    }

    // Fetch context for richer prompts (parallel)
    const [workA, workB, eventsA, eventsB] = await Promise.all([
      prisma.workLog.findMany({ where: { agentId: agentA.id }, orderBy: { createdAt: 'desc' }, take: 2,
        select: { description: true, workType: true } }),
      prisma.workLog.findMany({ where: { agentId: agentB.id }, orderBy: { createdAt: 'desc' }, take: 2,
        select: { description: true, workType: true } }),
      prisma.townEvent.findMany({ where: { agentId: agentA.id }, orderBy: { createdAt: 'desc' }, take: 3,
        select: { title: true } }),
      prisma.townEvent.findMany({ where: { agentId: agentB.id }, orderBy: { createdAt: 'desc' }, take: 3,
        select: { title: true } }),
    ]);

    const agentAActivity: AgentActivity = {
      recentBuilds: workA.map(w => String(w.description || w.workType).slice(0, 120)),
      recentEvents: eventsA.map(e => String(e.title || '').slice(0, 120)),
    };
    const agentBActivity: AgentActivity = {
      recentBuilds: workB.map(w => String(w.description || w.workType).slice(0, 120)),
      recentEvents: eventsB.map(e => String(e.title || '').slice(0, 120)),
    };

    const relationship: RelationshipContext | undefined = existingRel ? {
      status: existingRel.status as RelationshipContext['status'],
      score: existingRel.score,
      interactions: existingRel.interactions,
    } : undefined;

    const convo = await agentConversationService.generate({
      town: {
        id: town.id,
        name: town.name,
        theme: town.theme,
        status: town.status,
        builtPlots: town.builtPlots,
        totalPlots: town.totalPlots,
        completionPct: town.completionPct,
        level: town.level,
      },
      agentA: {
        id: agentA.id,
        name: agentA.name,
        archetype: agentA.archetype,
        bankroll: agentA.bankroll,
        reserveBalance: agentA.reserveBalance,
        systemPrompt: agentA.systemPrompt || undefined,
      },
      agentB: {
        id: agentB.id,
        name: agentB.name,
        archetype: agentB.archetype,
        bankroll: agentB.bankroll,
        reserveBalance: agentB.reserveBalance,
        systemPrompt: agentB.systemPrompt || undefined,
      },
      context: { topic, openerHint },
      relationship,
      agentAActivity,
      agentBActivity,
      pairMemory,
    });

    const relUpdate = await socialGraphService.upsertInteraction({
      agentAId: agentA.id,
      agentBId: agentB.id,
      outcome: convo.outcome,
      delta: convo.delta,
    });

    // --- Economic consequences of chat ---
    let economicEffect: { type: string; amount: number; detail: string } | null = null;

    if (convo.outcome === 'BOND') {
      const richer = agentA.bankroll >= agentB.bankroll ? agentA : agentB;
      const poorer = richer.id === agentA.id ? agentB : agentA;
      const tip = Math.max(1, Math.min(50, Math.floor(poorer.bankroll * 0.04)));
      if (richer.bankroll >= tip * 2) {
        await prisma.arenaAgent.update({ where: { id: richer.id }, data: { bankroll: { decrement: tip } } });
        await prisma.arenaAgent.update({ where: { id: poorer.id }, data: { bankroll: { increment: tip } } });
        economicEffect = {
          type: 'TIP',
          amount: tip,
          detail: `💰 ${richer.name} tipped ${tip} $ARENA to ${poorer.name}`,
        };
      }
    } else if (convo.outcome === 'BEEF') {
      const taxA = Math.max(1, Math.min(20, Math.floor(agentA.bankroll * 0.015)));
      const taxB = Math.max(1, Math.min(20, Math.floor(agentB.bankroll * 0.015)));
      if (agentA.bankroll >= taxA && agentB.bankroll >= taxB) {
        await prisma.arenaAgent.update({ where: { id: agentA.id }, data: { bankroll: { decrement: taxA } } });
        await prisma.arenaAgent.update({ where: { id: agentB.id }, data: { bankroll: { decrement: taxB } } });
        economicEffect = {
          type: 'BEEF_TAX',
          amount: taxA + taxB,
          detail: `🔥 Beef tax: ${agentA.name} -${taxA}, ${agentB.name} -${taxB} $ARENA`,
        };
      }
    }

    // Credit beef tax to pool treasury
    if (economicEffect?.type === 'BEEF_TAX') {
      const pool = await prisma.economyPool.findFirst();
      if (pool) {
        await prisma.economyPool.update({
          where: { id: pool.id },
          data: { cumulativeFeesArena: { increment: economicEffect.amount } },
        });
      }
    }

    const linesForDesc = convo.lines
      .map((l) => {
        const who = l.agentId === agentA.id ? agentA.name : agentB.name;
        return `${who}: "${l.text}"`;
      })
      .join('  ');

    const chatEvent = await townService.logEvent(
      town.id,
      'CUSTOM',
      `💬 ${agentA.name} ↔ ${agentB.name}`,
      `${linesForDesc}${convo.summary ? ` — ${convo.summary}` : ''}${economicEffect ? ` · ${economicEffect.detail}` : ''}`.slice(0, 900),
      undefined,
      {
        kind: 'AGENT_CHAT',
        participants: [pair.a, pair.b],
        lines: convo.lines,
        outcome: convo.outcome,
        delta: convo.delta,
        economicIntent: convo.economicIntent,
        summary: convo.summary,
        economicEffect,
        relationship: {
          id: relUpdate.relationship.id,
          status: relUpdate.relationship.status,
          score: relUpdate.relationship.score,
          interactions: relUpdate.relationship.interactions,
          friendCapHit: relUpdate.friendCapHit,
        },
      },
    );

    let relationshipEventId: string | null = null;
    if (relUpdate.statusChanged) {
      const to = relUpdate.statusChanged.to;
      const emoji = to === 'FRIEND' ? '🤝' : to === 'RIVAL' ? '💢' : '🧊';
      const title =
        to === 'FRIEND'
          ? `${emoji} ${agentA.name} and ${agentB.name} became friends`
          : to === 'RIVAL'
            ? `${emoji} ${agentA.name} and ${agentB.name} became rivals`
            : `${emoji} ${agentA.name} and ${agentB.name} cooled off`;

      const relEvent = await townService.logEvent(
        town.id,
        'CUSTOM',
        title,
        `${convo.summary} (score: ${relUpdate.relationship.score})`.slice(0, 700),
        undefined,
        {
          kind: 'RELATIONSHIP_CHANGE',
          participants: [pair.a, pair.b],
          from: relUpdate.statusChanged.from,
          to: relUpdate.statusChanged.to,
          score: relUpdate.relationship.score,
          interactions: relUpdate.relationship.interactions,
        },
      );
      relationshipEventId = relEvent.id;
    }

    // ── Town objectives (stakes + follow-up) ──
    // These create visible, time-bounded consequences so chats turn into action.
    let objectiveEventId: string | null = null;
    try {
      if (convo.outcome === 'BEEF' || convo.outcome === 'BOND') {
        const now = Date.now();
        const emptyPlots = (town.plots || []).filter((p: any) => p && p.status === 'EMPTY');

        // Avoid objective spam between the same pair.
        const recentObjectives = await prisma.townEvent.findMany({
          where: {
            townId: town.id,
            eventType: 'CUSTOM',
            createdAt: { gte: new Date(now - 3 * 60_000) },
          },
          orderBy: { createdAt: 'desc' },
          take: 120,
          select: { metadata: true },
        });
        let hasRecentForPair = false;
        for (const e of recentObjectives) {
          let meta: any = null;
          try {
            meta = JSON.parse(e.metadata || '{}');
          } catch {
            meta = null;
          }
          if (!meta || typeof meta !== 'object') continue;
          if (String(meta.kind || '') !== 'TOWN_OBJECTIVE') continue;
          const participants = Array.isArray(meta.participants) ? meta.participants : [];
          if (participants.includes(pair.a) && participants.includes(pair.b)) {
            hasRecentForPair = true;
            break;
          }
        }

        if (!hasRecentForPair && emptyPlots.length > 0) {
          const zonePriority = ['COMMERCIAL', 'ENTERTAINMENT', 'INDUSTRIAL', 'CIVIC', 'RESIDENTIAL'];
          const emptiesByZone = new Map<string, any[]>();
          for (const p of emptyPlots) {
            const z = String(p.zone || '').toUpperCase();
            if (!emptiesByZone.has(z)) emptiesByZone.set(z, []);
            emptiesByZone.get(z)!.push(p);
          }

          if (convo.outcome === 'BEEF') {
            // Plot race: both agents sprint to claim a single target plot.
            let candidates: any[] = [];
            for (const z of zonePriority) {
              const c = emptiesByZone.get(z);
              if (c && c.length > 0) { candidates = c; break; }
            }
            if (candidates.length === 0) candidates = emptyPlots;

            const target = pickRandom(candidates);
            const plotIndex = typeof (target as any)?.plotIndex === 'number' ? (target as any).plotIndex : null;
            const zone = safeTrim((target as any)?.zone, 24).toUpperCase();
            if (plotIndex != null) {
              const stakeArena = 10; // loser pays winner on resolution (best-effort)
              const expiresAtMs = now + 3 * 60_000;
              const obj = await townService.logEvent(
                town.id,
                'CUSTOM',
                `🏁 Rivalry Race: Claim plot ${plotIndex} (${zone})`,
                `${agentA.name} and ${agentB.name} are beefing. First to claim plot ${plotIndex} wins. Loser pays ${stakeArena} $ARENA.`,
                undefined,
                {
                  kind: 'TOWN_OBJECTIVE',
                  objectiveType: 'RACE_CLAIM',
                  participants: [pair.a, pair.b],
                  plotIndex,
                  zone,
                  stakeArena,
                  createdAtMs: now,
                  expiresAtMs,
                  triggeredBy: { chatEventId: chatEvent.id, outcome: convo.outcome, economicIntent: convo.economicIntent },
                },
              );
              objectiveEventId = obj.id;
            }
          } else {
            // Pact: assign each agent a plot to claim in the same zone (collab vibes).
            const shouldCreate =
              convo.economicIntent === 'COLLAB' || convo.economicIntent === 'TIP' || Math.random() < 0.6;
            if (shouldCreate && emptyPlots.length >= 2) {
              // Pick the most "available" zone with >= 2 empty plots.
              let bestZone: string | null = null;
              let bestCount = 0;
              for (const [z, arr] of emptiesByZone.entries()) {
                if (arr.length >= 2 && arr.length > bestCount) {
                  bestZone = z;
                  bestCount = arr.length;
                }
              }
              const pool = bestZone ? (emptiesByZone.get(bestZone) || []) : emptyPlots;
              const shuffled = [...pool].sort(() => Math.random() - 0.5);
              const p0 = shuffled[0];
              const p1 = shuffled.find((p: any) => p && p.plotIndex !== p0.plotIndex) || null;
              if (p0 && p1) {
                const aGetsFirst = Math.random() < 0.5;
                const aPlot = aGetsFirst ? p0 : p1;
                const bPlot = aGetsFirst ? p1 : p0;
                const expiresAtMs = now + 5 * 60_000;
                const zone = safeTrim((aPlot as any)?.zone, 24).toUpperCase() || safeTrim((bPlot as any)?.zone, 24).toUpperCase();
                const obj = await townService.logEvent(
                  town.id,
                  'CUSTOM',
                  `🤝 Pact: Split the ${zone} district`,
                  `${agentA.name} claims plot ${aPlot.plotIndex}. ${agentB.name} claims plot ${bPlot.plotIndex}. Do it within 5 minutes.`,
                  undefined,
                  {
                    kind: 'TOWN_OBJECTIVE',
                    objectiveType: 'PACT_CLAIM',
                    participants: [pair.a, pair.b],
                    assignments: { [agentA.id]: aPlot.plotIndex, [agentB.id]: bPlot.plotIndex },
                    zone,
                    createdAtMs: now,
                    expiresAtMs,
                    triggeredBy: { chatEventId: chatEvent.id, outcome: convo.outcome, economicIntent: convo.economicIntent },
                  },
                );
                objectiveEventId = obj.id;
              }
            }
          }
        }
      }
    } catch {
      objectiveEventId = null;
    }

    res.json({
      conversation: convo,
      relationship: relUpdate.relationship,
      statusChanged: relUpdate.statusChanged,
      economicEffect,
      economicIntent: convo.economicIntent,
      chatEventId: chatEvent.id,
      relationshipEventId,
      objectiveEventId,
    });
  } catch (error: any) {
    const msg = String(error?.message || 'Unknown error');
    // Make cooldown errors non-fatal.
    if (msg.toLowerCase().includes('cooldown')) {
      res.status(429).json({ error: msg });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

// List an agent's friends/rivals (public).
router.get('/agent/:id/relationships', async (req: Request, res: Response): Promise<void> => {
  try {
    const agentId = req.params.id;
    const result = await socialGraphService.listRelationships(agentId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/agent/:id/retention', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await agentLoopService.getRetentionSnapshot(req.params.id);
    res.json(snapshot);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Batch endpoint: all non-neutral relationships in a town (for frontend navigation)
router.get('/town/:id/relationships', async (_req: Request, res: Response): Promise<void> => {
  try {
    const rels = await prisma.agentRelationship.findMany({
      where: { status: { not: 'NEUTRAL' } },
      select: { agentAId: true, agentBId: true, status: true, score: true },
      take: 100,
    });
    res.json({ relationships: rels });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/agent/:id/goals', async (req: Request, res: Response): Promise<void> => {
  try {
    const agentId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
    const status = String(req.query.status || '').toUpperCase();
    const horizon = String(req.query.horizon || '').toUpperCase();

    const rows = await agentGoalTrackService.getAgentGoalHistory(agentId, limit);
    const filtered = rows.filter((row) => {
      const statusOk = status ? row.status === status : true;
      const horizonOk = horizon ? row.horizon === horizon : true;
      return statusOk && horizonOk;
    });

    res.json({ agentId, goals: filtered });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/town/:id/goals', async (req: Request, res: Response): Promise<void> => {
  try {
    const town = await townService.getTown(req.params.id);
    if (!town) {
      res.status(404).json({ error: 'Town not found' });
      return;
    }

    const agents = await prisma.arenaAgent.findMany({
      where: { isActive: true },
      select: { id: true, name: true, archetype: true },
    });

    const townLite = {
      id: town.id,
      level: town.level,
      theme: town.theme,
      plots: town.plots.map((p) => ({
        id: p.id,
        plotIndex: p.plotIndex,
        zone: p.zone,
        status: p.status,
        ownerId: p.ownerId,
        builderId: p.builderId,
        buildingType: p.buildingType,
        apiCallsUsed: p.apiCallsUsed,
      })),
    };

    const goals = agentGoalService.computeGoalsForTown({
      town: townLite as any,
      agents: agents.map((a) => ({ id: a.id, name: a.name, archetype: a.archetype })) as any,
    });

    const persistentRows = await prisma.agentGoalTrack.findMany({
      where: { townId: town.id, status: 'ACTIVE' },
      orderBy: [{ horizon: 'asc' }, { updatedAt: 'desc' }],
    });
    const persistentGoals = persistentRows.map((row) => {
      let rewardProfile: Record<string, unknown> = {};
      let penaltyProfile: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(row.rewardProfile || '{}');
        rewardProfile = parsed && typeof parsed === 'object' ? parsed : {};
      } catch {}
      try {
        const parsed = JSON.parse(row.penaltyProfile || '{}');
        penaltyProfile = parsed && typeof parsed === 'object' ? parsed : {};
      } catch {}
      return {
        id: row.id,
        agentId: row.agentId,
        horizon: row.horizon,
        status: row.status,
        title: row.title,
        description: row.description,
        metric: row.metric,
        focusZone: row.focusZone,
        targetValue: row.targetValue,
        progressValue: row.progressValue,
        deadlineTick: row.deadlineTick,
        lastProgressLabel: row.lastProgressLabel,
        rewardProfile,
        penaltyProfile,
      };
    });

    res.json({ townId: town.id, goals, persistentGoals });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Agent Action Logs
// ============================================

router.get('/agent/:id/actions', async (req: Request, res: Response): Promise<void> => {
  try {
    const agentId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    
    // Get work logs for this agent
    const workLogs = await prisma.workLog.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        plot: {
          select: { plotIndex: true, buildingName: true, zone: true },
        },
      },
    });

    // Get town events for this agent
    const events = await prisma.townEvent.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Social events store participants in metadata (agentId may be null), so pull a small window and filter.
    const recentCustom = await prisma.townEvent.findMany({
      where: { eventType: 'CUSTOM' },
      orderBy: { createdAt: 'desc' },
      take: 250,
    });
    const socialEvents = recentCustom.filter((e: any) => {
      try {
        const meta = JSON.parse(e.metadata || '{}');
        if (!meta || typeof meta !== 'object') return false;
        if (!['AGENT_CHAT', 'RELATIONSHIP_CHANGE'].includes(String(meta.kind || ''))) return false;
        const parts = Array.isArray(meta.participants) ? meta.participants : [];
        return parts.includes(agentId);
      } catch {
        return false;
      }
    });

    // Combine and sort
    const seenEventIds = new Set<string>();
    const eventActions = [...events, ...socialEvents].filter((e: any) => {
      if (!e?.id) return false;
      if (seenEventIds.has(e.id)) return false;
      seenEventIds.add(e.id);
      return true;
    });

    const actions = [
      ...workLogs.map((w: any) => ({
        type: 'work',
        id: w.id,
        workType: w.workType,
        content: w.description || w.input || '',
        input: w.input,
        output: w.output,
        plotIndex: w.plot?.plotIndex,
        buildingName: w.plot?.buildingName,
        zone: w.plot?.zone,
        createdAt: w.createdAt,
      })),
      ...eventActions.map((e: any) => ({
        type: 'event',
        id: e.id,
        eventType: e.eventType,
        title: e.title,
        description: e.description,
        metadata: e.metadata,
        createdAt: e.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
     .slice(0, limit);

    res.json({ actions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Agent Scratchpad (memory/journal)
// ============================================

router.get('/agent/:id/scratchpad', async (req: Request, res: Response): Promise<void> => {
  try {
    const agent = await prisma.arenaAgent.findUnique({
      where: { id: req.params.id },
      select: {
        scratchpad: true,
        lastActionType: true,
        lastReasoning: true,
        lastNarrative: true,
        lastTargetPlot: true,
        lastTickAt: true,
      },
    });
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    res.json(agent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Yield Distribution (admin/cron)
// ============================================

router.post('/town/:id/distribute-yield', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await townService.distributeYield(req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// Sprite Library API
// ============================================

router.get('/sprites', async (req: Request, res: Response): Promise<void> => {
  try {
    const spriteLib = await import('../services/spriteLibraryService');
    
    const category = req.query.category as string | undefined;
    const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined;
    const search = req.query.search as string | undefined;
    
    const result = spriteLib.browseSprites({
      category: category as any,
      tags,
      searchText: search,
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sprites/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const spriteLib = await import('../services/spriteLibraryService');
    const stats = spriteLib.getCatalogStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sprites/refresh', async (_req: Request, res: Response): Promise<void> => {
  try {
    const spriteLib = await import('../services/spriteLibraryService');
    const catalog = spriteLib.refreshCatalog();
    res.json({ refreshed: true, total: catalog.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sprites/find', async (req: Request, res: Response): Promise<void> => {
  try {
    const spriteLib = await import('../services/spriteLibraryService');
    const type = req.query.type as string || 'house';
    const name = req.query.name as string | undefined;
    
    const sprite = spriteLib.findSpriteForBuilding(type, name);
    res.json({ buildingType: type, buildingName: name, sprite });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Gallery page to browse sprite library
router.get('/sprites/gallery', async (_req: Request, res: Response): Promise<void> => {
  try {
    const spriteLib = await import('../services/spriteLibraryService');
    const result = spriteLib.browseSprites({});
    const stats = spriteLib.getCatalogStats();
    
    const html = `<!DOCTYPE html>
<html><head><title>🎨 Sprite Library</title>
<style>
  body { font-family: system-ui, sans-serif; background: #1a1a2e; color: #eee; padding: 20px; margin: 0; }
  h1 { color: #ffd700; margin-bottom: 8px; }
  .stats { color: #888; margin-bottom: 20px; }
  .categories { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
  .cat { background: #16213e; padding: 6px 12px; border-radius: 20px; font-size: 13px; }
  .cat.active { background: #ffd700; color: #1a1a2e; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; }
  .card { background: #16213e; border-radius: 12px; padding: 12px; text-align: center; }
  .card img { width: 64px; height: 64px; image-rendering: pixelated; background: #0f3460; border-radius: 8px; }
  .card h4 { margin: 8px 0 4px; font-size: 13px; color: #ffd700; }
  .card p { margin: 2px 0; font-size: 11px; color: #666; }
  .empty { text-align: center; padding: 60px; color: #666; }
  .empty h2 { color: #888; }
  code { background: #0f3460; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
</style></head>
<body>
<h1>🎨 Sprite Library</h1>
<p class="stats">${stats.total} sprites across ${Object.values(stats.byCategory).filter(n => n > 0).length} categories</p>

<div class="categories">
  <span class="cat active">All (${stats.total})</span>
  ${Object.entries(stats.byCategory).filter(([,n]) => n > 0).map(([cat, n]) => 
    `<span class="cat">${cat} (${n})</span>`
  ).join('')}
</div>

${result.sprites.length === 0 ? `
<div class="empty">
  <h2>📭 Library is empty</h2>
  <p>Add sprites to: <code>backend/public/sprite-library/{category}/</code></p>
  <p>Categories: residential, commercial, industrial, civic, entertainment, nature</p>
  <p>Naming: <code>sprite-name-64px.png</code></p>
  <p>Then hit <a href="/api/v1/sprites/refresh" style="color:#ffd700">/api/v1/sprites/refresh</a></p>
</div>
` : `
<div class="grid">
${result.sprites.map(s => `
  <div class="card">
    <img src="${s.url}" alt="${s.name}" onerror="this.style.display='none'">
    <h4>${s.name}</h4>
    <p>${s.category} • ${s.size}px</p>
    <p>${s.tags.slice(0, 3).join(', ')}</p>
  </div>
`).join('')}
</div>
`}
</body></html>`;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Agent Spawning (user onboarding)
// ============================================

router.post('/agents/spawn', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      personality,
      walletAddress,
      modelId: reqModelId,
      riskTolerance: reqRiskTolerance,
      maxWagerPercent: reqMaxWagerPercent,
      aiProfileId,
    } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 20) {
      res.status(400).json({ error: 'Name must be 2-20 characters' });
      return;
    }
    if (!walletAddress || typeof walletAddress !== 'string' || !walletAddress.startsWith('0x')) {
      res.status(400).json({ error: 'Valid wallet address required' });
      return;
    }
    
    // Check if wallet already has an agent (case-insensitive for EIP-55 checksums)
    const allAgents = await prisma.arenaAgent.findMany({ where: { walletAddress: { not: '' } }, select: { id: true, name: true, archetype: true, bankroll: true, health: true, elo: true, wins: true, losses: true, walletAddress: true } });
    const existing = allAgents.find(a => a.walletAddress?.toLowerCase() === walletAddress.toLowerCase()) || null;
    if (existing) {
      res.status(409).json({ error: 'Wallet already has an agent', agent: existing });
      return;
    }
    
    // Check if name is taken
    const nameTaken = await prisma.arenaAgent.findFirst({ where: { name: name.trim() } });
    if (nameTaken) {
      res.status(409).json({ error: 'Agent name already taken' });
      return;
    }
    
    const validPersonalities = ['SHARK', 'DEGEN', 'CHAMELEON', 'GRINDER', 'VISIONARY'];
    const archetype = validPersonalities.includes(personality?.toUpperCase()) ? personality.toUpperCase() : 'CHAMELEON';
    const selectedProfile = aiProfileId ? agentLoopService.getAiProfilePresetById(aiProfileId) : null;
    if (aiProfileId && !selectedProfile) {
      res.status(400).json({ error: 'aiProfileId must be one of: BUDGET, BALANCED, MAX_AGENCY' });
      return;
    }

    const fallbackRisk = archetype === 'DEGEN' ? 0.8 : archetype === 'SHARK' ? 0.3 : 0.5;
    const parsedRisk = Number(reqRiskTolerance);
    const parsedMaxWager = Number(reqMaxWagerPercent);
    const riskTolerance = Math.min(
      0.95,
      Math.max(
        0.05,
        Number.isFinite(parsedRisk)
          ? parsedRisk
          : selectedProfile?.targetRiskTolerance ?? fallbackRisk,
      ),
    );
    const maxWagerPercent = Math.min(
      0.6,
      Math.max(
        0.05,
        Number.isFinite(parsedMaxWager)
          ? parsedMaxWager
          : selectedProfile?.targetMaxWagerPercent ?? 0.15,
      ),
    );

    const modelCandidate = typeof reqModelId === 'string' ? reqModelId.trim() : '';
    const modelId = modelCandidate || (isOpenRouterActiveConfig() ? 'or-gemini-2.0-flash' : 'deepseek-v3');
    // Keep spawn resilient: unknown models auto-fallback inside SmartAI service.
    smartAiService.getModelSpec(modelId);
    
    // Find a building town to assign to
    const buildingTown = await prisma.town.findFirst({ where: { status: 'BUILDING' }, orderBy: { level: 'asc' } });
    
    const agent = await prisma.arenaAgent.create({
      data: {
        name: name.trim(),
        archetype: archetype as any,
        modelId,
        walletAddress,
        apiKey: `spawn_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        reserveBalance: 100,
        bankroll: 50,
        health: 100,
        isActive: true,
        spawnedByUser: true,
        systemPrompt: '',
        riskTolerance,
        maxWagerPercent,
      },
    });
    
    console.log(`[Spawn] New agent created: ${agent.name} (${archetype}) by wallet ${walletAddress}`);
    res.json({
      agent,
      assignedTown: buildingTown?.name || null,
      aiProfile: agentLoopService.resolveAiProfileFromRisk(agent.riskTolerance, agent.maxWagerPercent),
    });
    return;
  } catch (error: any) {
    res.status(500).json({ error: error.message });
    return;
  }
});

// ============================================
// Agent Funding (wallet user flow via nad.fun tx hash proof)
// ============================================

router.get('/agents/:id/funding', async (req: Request, res: Response): Promise<void> => {
  try {
    const session = requireAuthenticatedSession(req, res);
    if (!session) return;
    const ownership = await ensureWalletOwnsAgent(req.params.id, session.wallet);
    if (!ownership.ok) {
      res.status(ownership.status).json({ ok: false, code: ownership.code, error: ownership.error });
      return;
    }

    const receipts = await prisma.agentFundingReceipt.findMany({
      where: { agentId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        txHash: true,
        walletAddress: true,
        arenaAmount: true,
        blockNumber: true,
        createdAt: true,
      },
    });

    const total = await prisma.agentFundingReceipt.aggregate({
      where: { agentId: req.params.id },
      _sum: { arenaAmount: true },
      _count: { id: true },
    });

    res.json({
      ok: true,
      tokenAddress: agentFundingService.getTokenAddress(),
      receipts,
      totals: {
        creditedArena: total._sum.arenaAmount || 0,
        receiptCount: total._count.id || 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || 'Failed to load funding history' });
  }
});

router.post('/agents/:id/fund', async (req: Request, res: Response): Promise<void> => {
  try {
    const session = requireAuthenticatedSession(req, res);
    if (!session) return;
    const ownership = await ensureWalletOwnsAgent(req.params.id, session.wallet);
    if (!ownership.ok) {
      res.status(ownership.status).json({ ok: false, code: ownership.code, error: ownership.error });
      return;
    }
    if (!session.wallet) {
      res.status(401).json({ ok: false, code: 'WALLET_REQUIRED', error: 'Signed-in wallet is required.' });
      return;
    }
    const playerWallet = session.wallet;

    const txHash = safeTrim((req.body as { txHash?: unknown })?.txHash, 100).toLowerCase();
    if (!/^0x[a-f0-9]{64}$/.test(txHash)) {
      res.status(400).json({ ok: false, code: 'INVALID_TX_HASH', error: 'Enter a valid Monad transaction hash.' });
      return;
    }

    if (!agentFundingService.isReady()) {
      res.status(503).json({
        ok: false,
        code: 'FUNDING_UNAVAILABLE',
        error: 'Funding verifier unavailable on this backend (missing Monad RPC config).',
      });
      return;
    }

    const alreadyUsed = await prisma.agentFundingReceipt.findUnique({ where: { txHash } });
    if (alreadyUsed) {
      res.status(409).json({
        ok: false,
        code: 'TX_ALREADY_USED',
        error: 'This tx hash was already used for funding credit.',
      });
      return;
    }

    const verified = await agentFundingService.verifyFundingTx({
      txHash,
      walletAddress: playerWallet,
    });

    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.agentFundingReceipt.create({
        data: {
          txHash: verified.txHash,
          walletAddress: playerWallet,
          agentId: req.params.id,
          arenaAmount: verified.creditedArena,
          rawAmount: verified.rawAmount,
          blockNumber: verified.blockNumber,
        },
      });

      const agent = await tx.arenaAgent.update({
        where: { id: req.params.id },
        data: { bankroll: { increment: verified.creditedArena } },
        select: {
          id: true,
          name: true,
          bankroll: true,
          reserveBalance: true,
        },
      });

      return { receipt, agent };
    });

    res.json({
      ok: true,
      funding: {
        txHash: result.receipt.txHash,
        arenaAmount: result.receipt.arenaAmount,
        blockNumber: result.receipt.blockNumber,
        createdAt: result.receipt.createdAt,
      },
      agent: result.agent,
    });
  } catch (error: any) {
    const message = String(error?.message || 'Funding verification failed');
    if (/already used/i.test(message) || /unique constraint/i.test(message)) {
      res.status(409).json({ ok: false, code: 'TX_ALREADY_USED', error: 'This tx hash was already used for funding credit.' });
      return;
    }
    res.status(400).json({ ok: false, code: 'FUNDING_VERIFY_FAILED', error: message });
  }
});

// NOTE: /agents/me is in arena-api.ts (must be before /agents/:id to avoid Express param matching)

// ============================================
// World Events API
// ============================================

import { worldEventService } from '../services/worldEventService';

router.get('/events/active', async (_req: Request, res: Response) => {
  try {
    const events = worldEventService.getActiveEvents();
    res.json({ events, multipliers: {
      cost: worldEventService.getCostMultiplier(),
      yield: worldEventService.getYieldMultiplier(),
      upkeep: worldEventService.getUpkeepMultiplier(),
    }});
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Leaderboard
// ============================================

router.get('/town-leaderboard', async (_req: Request, res: Response) => {
  try {
    const agents = await prisma.arenaAgent.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, archetype: true, bankroll: true, reserveBalance: true,
        health: true, wins: true, losses: true, spawnedByUser: true, walletAddress: true,
        ownedPlots: { where: { status: 'BUILT' }, select: { qualityScore: true, totalInvested: true } },
      },
      orderBy: { bankroll: 'desc' },
    });
    
    const leaderboard = agents.map((a, i) => ({
      rank: i + 1,
      name: a.name,
      archetype: a.archetype,
      bankroll: a.bankroll,
      reserve: a.reserveBalance,
      health: a.health,
      buildings: a.ownedPlots.length,
      avgQuality: a.ownedPlots.length > 0 
        ? Math.round(a.ownedPlots.reduce((sum: number, p) => sum + (p.qualityScore || 5), 0) / a.ownedPlots.length * 10) / 10
        : null,
      totalInvested: a.ownedPlots.reduce((sum: number, p) => sum + (p.totalInvested || 0), 0),
      isUser: a.spawnedByUser,
    }));
    
    res.json({ leaderboard });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
