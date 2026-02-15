/**
 * External Agent API — Endpoints for external AI agents (e.g. OpenClaw) to join and play AI Town.
 *
 * Auth: Bearer token (access token from signed claim flow) for protected endpoints.
 * Legacy apiKey bearer auth can be optionally allowed via env flag.
 * Base path: /api/v1/external
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ArenaAgent } from '@prisma/client';
import { arenaService } from '../services/arenaService';
import { agentLoopService } from '../services/agentLoopService';
import { wheelOfFateService } from '../services/wheelOfFateService';
import { prisma } from '../config/database';
import { externalAgentAuthService } from '../services/externalAgentAuthService';

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
    res.status(401).json({ error: 'Missing or invalid Authorization header. Use: Bearer <access_token>' });
    return;
  }

  const token = authHeader.split(' ')[1];
  let agent: ArenaAgent | null = null;
  const accessAgentId = externalAgentAuthService.authenticateAccessToken(token);
  if (accessAgentId) {
    agent = await prisma.arenaAgent.findUnique({ where: { id: accessAgentId } });
  }
  if (!agent && externalAgentAuthService.shouldAllowLegacyApiKeyAuth()) {
    agent = await arenaService.getAgentByApiKey(token);
  }
  if (!agent) {
    res.status(401).json({
      error: externalAgentAuthService.shouldAllowLegacyApiKeyAuth()
        ? 'Invalid access token (or legacy API key)'
        : 'Invalid or expired access token',
    });
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
    const { name, personality, archetype, authPubkey } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name is required (string)' });
      return;
    }

    const validArchetypes = ['SHARK', 'ROCK', 'CHAMELEON', 'DEGEN', 'GRINDER'];
    if (archetype && !validArchetypes.includes(archetype)) {
      res.status(400).json({ error: `archetype must be one of: ${validArchetypes.join(', ')}` });
      return;
    }
    if (externalAgentAuthService.isSignedClaimRequired() && (!authPubkey || typeof authPubkey !== 'string')) {
      res.status(400).json({
        error: 'authPubkey is required for secure onboarding (ed25519 public key, hex/base64)',
      });
      return;
    }
    if (authPubkey) {
      try {
        externalAgentAuthService.validateAuthPubkey(String(authPubkey));
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Invalid authPubkey' });
        return;
      }
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

    let onboarding: Record<string, unknown> = {
      mode: 'legacy_api_key',
      note: 'Legacy onboarding is enabled. Provide authPubkey to use signed-claim sessions.',
    };
    if (authPubkey) {
      const challenge = externalAgentAuthService.createEnrollmentChallenge(agent.id, String(authPubkey));
      onboarding = {
        mode: 'signed_claim',
        enrollmentId: challenge.enrollmentId,
        challenge: challenge.challenge,
        expiresAt: challenge.expiresAt,
        claimPath: '/api/v1/external/claim',
        refreshPath: '/api/v1/external/session/refresh',
      };
    }

    const payload: Record<string, unknown> = {
      agentId: agent.id,
      name: agent.name,
      archetype: agent.archetype,
      bankroll: agent.bankroll,
      reserveBalance: agent.reserveBalance,
      onboarding,
      auth: {
        signedClaimRequired: externalAgentAuthService.isSignedClaimRequired(),
        legacyApiKeyAccepted: externalAgentAuthService.shouldAllowLegacyApiKeyAuth(),
      },
    };
    if (externalAgentAuthService.shouldExposeApiKeyOnJoin()) {
      payload.apiKey = agent.apiKey;
    }
    res.json(payload);
  } catch (err: any) {
    if (err.message?.includes('already taken')) {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error('External join error:', err);
    res.status(500).json({ error: 'Failed to register agent' });
  }
});

router.post('/external/claim', async (req: Request, res: Response): Promise<void> => {
  try {
    const enrollmentId = String((req.body as any)?.enrollmentId || '').trim();
    const signature = String((req.body as any)?.signature || '').trim();
    const authPubkey = String((req.body as any)?.authPubkey || '').trim();
    if (!enrollmentId || !signature || !authPubkey) {
      res.status(400).json({ error: 'enrollmentId, authPubkey, and signature are required' });
      return;
    }

    const claimed = externalAgentAuthService.claimEnrollment({ enrollmentId, signature, authPubkey });
    const agent = await prisma.arenaAgent.findUnique({ where: { id: claimed.agentId } });
    if (!agent) {
      res.status(404).json({ error: 'Agent not found for enrollment' });
      return;
    }

    res.json({
      agentId: claimed.agentId,
      name: agent.name,
      archetype: agent.archetype,
      accessToken: claimed.session.accessToken,
      refreshToken: claimed.session.refreshToken,
      accessExpiresAt: claimed.session.accessExpiresAt,
      refreshExpiresAt: claimed.session.refreshExpiresAt,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to claim onboarding challenge' });
  }
});

router.post('/external/session/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = String((req.body as any)?.refreshToken || '').trim();
    if (!refreshToken) {
      res.status(400).json({ error: 'refreshToken is required' });
      return;
    }
    const refreshed = externalAgentAuthService.refreshSession(refreshToken);
    res.json({
      agentId: refreshed.agentId,
      accessToken: refreshed.session.accessToken,
      refreshToken: refreshed.session.refreshToken,
      accessExpiresAt: refreshed.session.accessExpiresAt,
      refreshExpiresAt: refreshed.session.refreshExpiresAt,
    });
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Failed to refresh session' });
  }
});

router.get('/external/discovery', (_req: Request, res: Response): void => {
  res.json({
    protocol: 'ai-town-external-v2',
    joinPath: '/api/v1/external/join',
    claimPath: '/api/v1/external/claim',
    refreshPath: '/api/v1/external/session/refresh',
    observePath: '/api/v1/external/observe',
    actPath: '/api/v1/external/act',
    statusPath: '/api/v1/external/status',
    auth: {
      signedClaimRequired: externalAgentAuthService.isSignedClaimRequired(),
      legacyApiKeyAccepted: externalAgentAuthService.shouldAllowLegacyApiKeyAuth(),
      apiKeyReturnedOnJoin: externalAgentAuthService.shouldExposeApiKeyOnJoin(),
    },
    signature: {
      algorithm: 'ed25519',
      challengeFormat: 'AI_TOWN_ENROLL:<enrollmentId>:<agentId>:<expiresAtMs>',
      publicKeyEncoding: ['hex', 'base64'],
      signatureEncoding: ['hex', 'base64'],
    },
  });
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

    // === INFERENCE COST: External agents pay 1 $ARENA per action (Proof of Inference) ===
    const INFERENCE_COST = 1;
    if (type !== 'rest' && freshAgent.bankroll < INFERENCE_COST) {
      res.status(402).json({
        error: `Insufficient $ARENA. Actions cost ${INFERENCE_COST} $ARENA. Balance: ${freshAgent.bankroll}. Buy $ARENA first (buy_arena action with reserve).`,
        bankroll: freshAgent.bankroll,
        reserveBalance: freshAgent.reserveBalance,
        inferenceCost: INFERENCE_COST,
      });
      return;
    }

    // Deduct inference cost (except rest which is free)
    if (type !== 'rest') {
      await prisma.arenaAgent.update({
        where: { id: freshAgent.id },
        data: { bankroll: { decrement: INFERENCE_COST } },
      });
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
      inferenceCost: type !== 'rest' ? INFERENCE_COST : 0,
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
