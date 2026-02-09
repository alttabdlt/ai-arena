/**
 * Arena REST API — Endpoints for OpenClaw agents to interact with the arena.
 * 
 * Auth: Bearer token (agent's apiKey)
 * Base path: /api/v1
 */

import { Router, Request, Response, NextFunction } from 'express';
import { arenaService } from '../services/arenaService';
import { ArenaAgent, ArenaGameType } from '@prisma/client';

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
// Agent Endpoints (Public)
// ============================================

router.post('/agents/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, archetype, modelId, systemPrompt, riskTolerance, maxWagerPercent, walletAddress } = req.body;

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const agent = await arenaService.registerAgent({
      name,
      archetype,
      modelId,
      systemPrompt,
      riskTolerance,
      maxWagerPercent,
      walletAddress,
    });

    res.status(201).json({
      id: agent.id,
      name: agent.name,
      archetype: agent.archetype,
      modelId: agent.modelId,
      elo: agent.elo,
      bankroll: agent.bankroll,
      apiKey: agent.apiKey,
      walletAddress: agent.walletAddress,
    });
  } catch (error: any) {
    console.error('Agent registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.get('/agents', async (_req: Request, res: Response): Promise<void> => {
  try {
    const agents = await arenaService.listAgents();
    res.json(agents.map((a: any) => ({
      id: a.id,
      name: a.name,
      archetype: a.archetype,
      modelId: a.modelId,
      elo: a.elo,
      wins: a.wins,
      losses: a.losses,
      draws: a.draws,
      bankroll: a.bankroll,
      reserveBalance: a.reserveBalance,
      health: a.health ?? 100,
      isInMatch: a.isInMatch,
      spawnedByUser: a.spawnedByUser || false,
      walletAddress: a.walletAddress || null,
      apiCostCents: a.apiCostCents,
      // Progressive thinking fields
      lastActionType: a.lastActionType || '',
      lastReasoning: a.lastReasoning || '',
      lastNarrative: a.lastNarrative || '',
      lastTargetPlot: a.lastTargetPlot ?? null,
      lastTickAt: a.lastTickAt || null,
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/agents/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await arenaService.getAgentStats(req.params.id);
    if (!stats) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    const { apiKey, ...publicStats } = stats as any;
    void apiKey;
    res.json(publicStats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/leaderboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const leaderboard = await arenaService.getLeaderboard(limit);
    res.json(leaderboard.map((a, i) => ({
      rank: i + 1,
      ...a,
      winRate: a.wins + a.losses > 0 ? Math.round((a.wins / (a.wins + a.losses)) * 100) : 0,
      profit: a.totalWon - a.totalWagered,
      apiCostDollars: (a.apiCostCents / 100).toFixed(2),
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Authenticated Agent Endpoints
// ============================================

router.get('/me', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const stats = await arenaService.getAgentStats(req.agent!.id);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/me/meta-decision', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { decision, cost } = await arenaService.getMetaDecision(req.agent!.id);
    res.json({ decision, cost });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Match Endpoints
// ============================================

// Recent completed matches (public, no auth needed)
router.get('/matches/recent', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const matches = await import('@prisma/client').then(async () => {
      const { prisma } = await import('../config/database');
      return prisma.arenaMatch.findMany({
        where: { status: { in: ['COMPLETED', 'CANCELLED'] } },
        include: {
          player1: { select: { id: true, name: true, archetype: true, elo: true } },
          player2: { select: { id: true, name: true, archetype: true, elo: true } },
          winner: { select: { id: true, name: true } },
        },
        orderBy: { completedAt: 'desc' },
        take: limit,
      });
    });
    res.json(matches.map(m => ({
      id: m.id,
      gameType: m.gameType,
      status: m.status,
      wagerAmount: m.wagerAmount,
      totalPot: m.totalPot,
      rakeAmount: m.rakeAmount,
      player1: m.player1,
      player2: m.player2,
      winner: m.winner,
      turnNumber: m.turnNumber,
      completedAt: m.completedAt,
      createdAt: m.createdAt,
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/matches/available', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const matches = await arenaService.getAvailableMatches(req.agent!.id);
    res.json(matches);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/matches/create', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { gameType, wagerAmount, opponentId } = req.body;

    if (!gameType || !wagerAmount) {
      res.status(400).json({ error: 'gameType and wagerAmount are required' });
      return;
    }

    if (!['POKER', 'RPS', 'BATTLESHIP'].includes(gameType)) {
      res.status(400).json({ error: 'Invalid game type. Must be POKER, RPS, or BATTLESHIP' });
      return;
    }

    const match = await arenaService.createMatch({
      agentId: req.agent!.id,
      gameType: gameType as ArenaGameType,
      wagerAmount: parseInt(wagerAmount),
      opponentId,
    });

    res.status(201).json(match);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/matches/:id/join', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const match = await arenaService.joinMatch(req.params.id, req.agent!.id);
    res.json(match);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/matches/:id/state', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const state = await arenaService.getMatchState(req.params.id, req.agent!.id);
    res.json(state);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/matches/:id/move', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { action, amount, data } = req.body;

    if (!action) {
      res.status(400).json({ error: 'action is required' });
      return;
    }

    const result = await arenaService.submitMove({
      matchId: req.params.id,
      agentId: req.agent!.id,
      action,
      amount,
      data,
    });

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/matches/:id/ai-move', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await arenaService.playAITurn(req.params.id, req.agent!.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/matches/:id/cancel', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await arenaService.cancelMatch(req.params.id, req.agent!.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Public spectator view — works for both live and completed matches (no auth needed)
router.get('/matches/:id/spectate', async (req: Request, res: Response): Promise<void> => {
  try {
    // Pass no viewerId → triggers spectator view for live matches, full view for completed
    const state = await arenaService.getMatchState(req.params.id);
    res.json(state);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/matches/:id/result', async (req: Request, res: Response): Promise<void> => {
  try {
    const state = await arenaService.getMatchState(req.params.id);
    if (state.status !== 'COMPLETED') {
      res.status(400).json({ error: 'Match is not completed yet', status: state.status });
      return;
    }
    res.json(state);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// Opponent Scouting
// ============================================

router.get('/opponents/:id', authenticateAgent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const opponent = await arenaService.getAgentStats(req.params.id);
    if (!opponent) {
      res.status(404).json({ error: 'Opponent not found' });
      return;
    }
    res.json({
      id: opponent.id,
      name: opponent.name,
      archetype: opponent.archetype,
      elo: opponent.elo,
      wins: opponent.wins,
      losses: opponent.losses,
      winRate: (opponent as any).winRate,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Available Models
// ============================================

router.get('/models', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { smartAiService } = await import('../services/smartAiService');
    const models = smartAiService.getAvailableModels();
    res.json(models);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Match Moves (with reasoning — spectator view)
// ============================================

router.get('/matches/:id/moves', async (req: Request, res: Response): Promise<void> => {
  try {
    const matchId = req.params.id;
    const { prisma } = await import('../config/database');

    // Get match to check status
    const match = await prisma.arenaMatch.findUnique({
      where: { id: matchId },
      select: { status: true, player1Id: true, player2Id: true },
    });

    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    // Check if requester is a player in this match (via auth header)
    let requesterId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const apiKey = authHeader.slice(7);
      const agent = await prisma.arenaAgent.findUnique({ where: { apiKey } });
      if (agent) requesterId = agent.id;
    }

    const moves = await prisma.arenaMove.findMany({
      where: { matchId },
      include: {
        agent: { select: { id: true, name: true, archetype: true } },
      },
      orderBy: { turnNumber: 'asc' },
    });

    const isLive = match.status === 'ACTIVE';

    res.json(moves.map(m => {
      // During live match: hide opponent's reasoning from the other player
      // Spectators (no auth or non-players) always see reasoning
      const hideReasoning = isLive && requesterId &&
        (requesterId === match.player1Id || requesterId === match.player2Id) &&
        m.agentId !== requesterId;

      return {
        turnNumber: m.turnNumber,
        agent: m.agent,
        action: m.action,
        reasoning: hideReasoning ? '(hidden during live match)' : m.reasoning,
        apiCostCents: m.apiCostCents,
        responseTimeMs: m.responseTimeMs,
        timestamp: m.timestamp,
      };
    }));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Monad On-Chain Status
// ============================================

router.get('/chain/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { monadService } = await import('../services/monadService');
    const status = await monadService.getStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
