/**
 * External Agent API — Endpoints for external AI agents (e.g. OpenClaw) to join and play AI Town.
 *
 * Auth: Bearer token (agent's apiKey) for all endpoints except /external/join.
 * Base path: /api/v1/external
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ArenaAgent } from '@prisma/client';
import { arenaService } from '../services/arenaService';
import { agentLoopService } from '../services/agentLoopService';
import { wheelOfFateService } from '../services/wheelOfFateService';
import { prisma } from '../config/database';

const router = Router();

// ============================================
// Auth Middleware
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

// ============================================
// POST /external/join — Register a new external agent
// ============================================

router.post('/external/join', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, personality, archetype } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name is required (string)' });
      return;
    }

    const validArchetypes = ['SHARK', 'ROCK', 'CHAMELEON', 'DEGEN', 'GRINDER'];
    if (archetype && !validArchetypes.includes(archetype)) {
      res.status(400).json({ error: `archetype must be one of: ${validArchetypes.join(', ')}` });
      return;
    }

    const agent = await arenaService.registerAgent({
      name: name.trim(),
      archetype: archetype || 'CHAMELEON',
      modelId: 'external',
      systemPrompt: personality || '',
    });

    // Mark as spawned by user
    await prisma.arenaAgent.update({
      where: { id: agent.id },
      data: { spawnedByUser: true },
    });

    res.json({
      agentId: agent.id,
      apiKey: agent.apiKey,
      name: agent.name,
      archetype: agent.archetype,
      bankroll: agent.bankroll,
      reserveBalance: agent.reserveBalance,
    });
  } catch (err: any) {
    if (err.message?.includes('already taken')) {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error('External join error:', err);
    res.status(500).json({ error: 'Failed to register agent' });
  }
});

// ============================================
// GET /external/observe — Full world state
// ============================================

router.get('/external/observe', authenticateAgent as any, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const agent = req.agent!;

    // Refresh agent state
    const freshAgent = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
    if (!freshAgent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const obs = await agentLoopService.observe(freshAgent);

    // Get wheel status
    const wheelStatus = wheelOfFateService.getStatus();

    // Build response
    const response: any = {
      town: obs.town ? {
        id: obs.town.id,
        name: obs.town.name,
        plots: obs.town.plots,
      } : null,
      self: {
        id: freshAgent.id,
        name: freshAgent.name,
        archetype: freshAgent.archetype,
        bankroll: freshAgent.bankroll,
        reserveBalance: freshAgent.reserveBalance,
        health: freshAgent.health,
        elo: freshAgent.elo,
        plots: obs.myPlots,
        scratchpad: freshAgent.scratchpad,
        lastActionType: freshAgent.lastActionType,
        isInMatch: freshAgent.isInMatch,
      },
      otherAgents: obs.otherAgents,
      recentEvents: obs.recentEvents.slice(0, 20),
      economy: obs.economy,
      wheel: {
        phase: wheelStatus.phase,
        currentMatch: wheelStatus.currentMatch ? {
          matchId: wheelStatus.currentMatch.matchId,
          agent1: wheelStatus.currentMatch.agent1,
          agent2: wheelStatus.currentMatch.agent2,
          wager: wheelStatus.currentMatch.wager,
          gameType: wheelStatus.currentMatch.gameType,
        } : null,
        nextSpinAt: wheelStatus.nextSpinAt,
      },
    };

    // If agent is in a fight, include game state
    if (freshAgent.isInMatch && freshAgent.currentMatchId) {
      try {
        const match = await prisma.arenaMatch.findUnique({ where: { id: freshAgent.currentMatchId } });
        if (match && match.status === 'ACTIVE') {
          response.activeMatch = {
            matchId: match.id,
            gameType: match.gameType,
            gameState: match.gameState ? JSON.parse(match.gameState as string) : null,
            wagerAmount: match.wagerAmount,
            opponentId: match.player1Id === freshAgent.id ? match.player2Id : match.player1Id,
          };
        }
      } catch { /* ignore parse errors */ }
    }

    res.json(response);
  } catch (err: any) {
    console.error('External observe error:', err);
    res.status(500).json({ error: 'Failed to observe world state' });
  }
});

// ============================================
// POST /external/act — Submit an action
// ============================================

router.post('/external/act', authenticateAgent as any, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const agent = req.agent!;
    const { type, reasoning, details } = req.body;

    const validActions = ['buy_arena', 'sell_arena', 'claim_plot', 'start_build', 'do_work', 'complete_build', 'play_arena', 'transfer_arena', 'buy_skill', 'rest'];
    if (!type || !validActions.includes(type)) {
      res.status(400).json({ error: `type must be one of: ${validActions.join(', ')}` });
      return;
    }

    if (!reasoning || typeof reasoning !== 'string') {
      res.status(400).json({ error: 'reasoning is required (string)' });
      return;
    }

    // Refresh agent
    const freshAgent = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
    if (!freshAgent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    if (freshAgent.health <= 0) {
      res.status(400).json({ error: 'Agent is dead (health = 0). Cannot act.' });
      return;
    }

    const action = {
      type: type as any,
      reasoning: reasoning.slice(0, 500),
      details: details || {},
    };

    // Get observation for execute context
    const obs = await agentLoopService.observe(freshAgent);

    // Execute the action
    const result = await agentLoopService.execute(freshAgent, action, obs);

    // Update scratchpad
    const entry = `[T${Date.now()}] ${type}: ${reasoning.slice(0, 100)} → ${result.success ? 'OK' : 'FAIL'}`;
    const existingPad = freshAgent.scratchpad || '';
    const lines = existingPad.split('\n').filter((l: string) => l.trim());
    lines.push(entry);
    const newScratchpad = lines.slice(-20).join('\n');

    await prisma.arenaAgent.update({
      where: { id: freshAgent.id },
      data: {
        scratchpad: newScratchpad,
        lastActionType: type,
        lastReasoning: reasoning.slice(0, 500),
        lastNarrative: result.narrative?.slice(0, 500) || '',
        lastTickAt: new Date(),
      },
    });

    // Fetch updated state
    const updatedAgent = await prisma.arenaAgent.findUnique({ where: { id: freshAgent.id } });

    res.json({
      success: result.success,
      narrative: result.narrative,
      error: result.error,
      agentState: updatedAgent ? {
        bankroll: updatedAgent.bankroll,
        reserve: updatedAgent.reserveBalance,
        health: updatedAgent.health,
        elo: updatedAgent.elo,
      } : null,
    });
  } catch (err: any) {
    console.error('External act error:', err);
    res.status(500).json({ error: 'Failed to execute action' });
  }
});

// ============================================
// POST /external/act/poker-move — Submit a poker move
// ============================================

router.post('/external/act/poker-move', authenticateAgent as any, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const agent = req.agent!;
    const { action, amount, reasoning, quip } = req.body;

    const validActions = ['fold', 'check', 'call', 'raise', 'all-in'];
    if (!action || !validActions.includes(action)) {
      res.status(400).json({ error: `action must be one of: ${validActions.join(', ')}` });
      return;
    }

    // Refresh agent to check match status
    const freshAgent = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
    if (!freshAgent || !freshAgent.isInMatch || !freshAgent.currentMatchId) {
      res.status(400).json({ error: 'Agent is not currently in an active match' });
      return;
    }

    const result = await arenaService.submitMove({
      matchId: freshAgent.currentMatchId,
      agentId: freshAgent.id,
      action,
      amount: amount || 0,
      data: { reasoning, quip },
    });

    res.json({
      success: true,
      gameState: result.matchState,
      matchOver: result.isComplete,
    });
  } catch (err: any) {
    console.error('External poker-move error:', err);
    res.status(500).json({ error: err.message || 'Failed to submit poker move' });
  }
});

// ============================================
// GET /external/events — Recent events
// ============================================

router.get('/external/events', authenticateAgent as any, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const sinceMs = req.query.since ? Number(req.query.since) : Date.now() - 5 * 60 * 1000;
    const since = new Date(sinceMs);

    const [townEvents, swaps, matches] = await Promise.all([
      prisma.townEvent.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.economySwap.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.arenaMatch.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    res.json({ townEvents, swaps, matches });
  } catch (err: any) {
    console.error('External events error:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// ============================================
// GET /external/status — Agent's current state
// ============================================

router.get('/external/status', authenticateAgent as any, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const agent = req.agent!;
    const freshAgent = await prisma.arenaAgent.findUnique({ where: { id: agent.id } });
    if (!freshAgent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const stats = await arenaService.getAgentStats(freshAgent.id);

    res.json({
      id: freshAgent.id,
      name: freshAgent.name,
      archetype: freshAgent.archetype,
      bankroll: freshAgent.bankroll,
      reserveBalance: freshAgent.reserveBalance,
      health: freshAgent.health,
      elo: freshAgent.elo,
      isInMatch: freshAgent.isInMatch,
      currentMatchId: freshAgent.currentMatchId,
      lastActionType: freshAgent.lastActionType,
      lastReasoning: freshAgent.lastReasoning,
      lastNarrative: freshAgent.lastNarrative,
      scratchpad: freshAgent.scratchpad,
      stats: stats ? {
        wins: stats.wins,
        losses: stats.losses,
        totalMatches: stats.totalMatches,
        recentWinRate: stats.recentWinRate,
        streak: stats.streak,
      } : null,
    });
  } catch (err: any) {
    console.error('External status error:', err);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

export default router;
