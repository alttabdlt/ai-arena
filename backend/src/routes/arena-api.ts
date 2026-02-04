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
    res.json(agents.map(a => ({
      id: a.id,
      name: a.name,
      archetype: a.archetype,
      modelId: a.modelId,
      elo: a.elo,
      wins: a.wins,
      losses: a.losses,
      draws: a.draws,
      bankroll: a.bankroll,
      isInMatch: a.isInMatch,
      apiCostCents: a.apiCostCents,
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
    const state = await arenaService.getMatchState(req.params.id);
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

export default router;
