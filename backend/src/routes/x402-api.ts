/**
 * x402 Payable API Routes
 * 
 * These endpoints require micropayments via the x402 protocol.
 * AI agents or humans pay per-request to access premium town services.
 * 
 * This is the key differentiator: agents making AUTONOMOUS purchasing decisions.
 * 
 * Endpoints:
 *   GET /x402/building/:plotIndex/lore     — Full building lore + AI content ($0.001)
 *   GET /x402/arena/spectate               — Watch the latest AI match ($0.002)
 *   GET /x402/town/oracle                  — Town economic forecast ($0.001)
 *   GET /x402/agent/:agentId/interview     — Interview an agent ($0.005)
 */

import { Router, Request, Response } from 'express';
import { townService } from '../services/townService';
import { smartAiService } from '../services/smartAiService';
import { prisma } from '../config/database';

const router = Router();

// Helper: get the latest town (active or complete)
async function getLatestTown() {
  // Try active first, then most recent of any status
  const active = await townService.getActiveTown();
  if (active) return active;
  return prisma.town.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { plots: { orderBy: { plotIndex: 'asc' } } },
  });
}

// ============================================================================
// Building Lore — Pay to read an AI-generated building's full story
// ============================================================================

router.get('/building/:plotIndex/lore', async (req: Request, res: Response) => {
  try {
    const plotIndex = parseInt(req.params.plotIndex, 10);
    const town = await getLatestTown();
    if (!town) return res.status(404).json({ error: 'No active town' });

    const plot = town.plots.find((p: any) => p.plotIndex === plotIndex);
    if (!plot) return res.status(404).json({ error: `Plot ${plotIndex} not found` });
    if (plot.status !== 'BUILT') return res.status(400).json({ error: 'Building not yet complete' });

    // Parse building data for all design steps
    let buildingData: any = {};
    try {
      buildingData = JSON.parse(plot.buildingData || '{}');
    } catch {}

    // Collect all design step outputs
    const designSteps = Object.entries(buildingData)
      .filter(([k]) => !k.startsWith('_'))
      .map(([key, val]: [string, any]) => ({
        step: val.description || key,
        content: val.output || '',
      }));

    // Get work logs for this plot
    const workLogs = await prisma.workLog.findMany({
      where: { plotId: plot.id },
      orderBy: { createdAt: 'asc' },
      include: { agent: { select: { name: true, archetype: true } } },
    });

    const owner = await prisma.arenaAgent.findUnique({ where: { id: plot.ownerId || '' } });

    res.json({
      building: {
        name: plot.buildingName,
        type: plot.buildingType,
        zone: plot.zone,
        plotIndex: plot.plotIndex,
        owner: owner?.name || 'Unknown',
        ownerArchetype: owner?.archetype || 'Unknown',
        description: plot.buildingDesc,
        apiCallsUsed: plot.apiCallsUsed,
        arenaInvested: plot.arenaInvested,
      },
      lore: designSteps,
      constructionLog: workLogs.map(w => ({
        builder: w.agent?.name,
        type: w.workType,
        step: w.prompt?.substring(0, 100),
        content: w.result?.substring(0, 500),
        cost: w.apiCostCents,
        model: w.modelUsed,
        latencyMs: w.latencyMs,
        timestamp: w.createdAt,
      })),
      proofOfInference: {
        totalApiCalls: plot.apiCallsUsed,
        totalCostCents: workLogs.reduce((sum: number, w: any) => sum + (w.apiCostCents || 0), 0),
        models: [...new Set(workLogs.map((w: any) => w.modelUsed).filter(Boolean))],
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Arena Spectate — Pay to see the latest AI vs AI match details
// ============================================================================

router.get('/arena/spectate', async (_req: Request, res: Response) => {
  try {
    const recentMatch = await prisma.arenaMatch.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      include: {
        player1Agent: { select: { name: true, archetype: true, elo: true } },
        player2Agent: { select: { name: true, archetype: true, elo: true } },
      },
    });

    if (!recentMatch) return res.json({ message: 'No matches played yet. The arena awaits its first warriors.' });

    // Get match moves/log if available
    let matchData: any = {};
    try {
      matchData = JSON.parse(recentMatch.gameState || '{}');
    } catch {}

    const winner = recentMatch.winnerId === recentMatch.player1AgentId
      ? recentMatch.player1Agent
      : recentMatch.player2Agent;

    res.json({
      match: {
        id: recentMatch.id,
        gameType: recentMatch.gameType,
        status: recentMatch.status,
        player1: {
          name: recentMatch.player1Agent?.name,
          archetype: recentMatch.player1Agent?.archetype,
          elo: recentMatch.player1Agent?.elo,
        },
        player2: {
          name: recentMatch.player2Agent?.name,
          archetype: recentMatch.player2Agent?.archetype,
          elo: recentMatch.player2Agent?.elo,
        },
        winner: winner?.name || 'Draw',
        wager: recentMatch.wager,
        completedAt: recentMatch.completedAt,
      },
      commentary: `${winner?.name || 'The arena'} ${winner ? 'emerged victorious' : 'saw a stalemate'} in a thrilling ${recentMatch.gameType} match! ${recentMatch.wager ? `${recentMatch.wager} $ARENA was at stake.` : ''}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Town Oracle — Pay for an AI-generated economic forecast
// ============================================================================

router.get('/town/oracle', async (_req: Request, res: Response) => {
  try {
    const town = await getLatestTown();
    if (!town) return res.status(404).json({ error: 'No active town' });

    const stats = await townService.getWorldStats();
    const events = await townService.getRecentEvents(town.id, 20);

    // Generate forecast using LLM (this is proof of inference!)
    const spec = smartAiService.getModelSpec('deepseek');
    const startTime = Date.now();
    const response = await smartAiService.callModel(
      spec,
      [
        {
          role: 'system',
          content: `You are the Oracle of ${town.name}, a mystical fortune-teller who speaks about the town's economic future. You use dramatic, prophetic language. Base predictions on the data provided.`,
        },
        {
          role: 'user',
          content: `The town "${town.name}" (${town.theme}) has these stats:
- ${town.completionPct.toFixed(1)}% complete (${stats.totalBuildings} buildings)
- ${stats.totalArenaInvested} $ARENA invested
- ${stats.totalApiCalls} proof-of-inference calls made
- Recent events: ${events.slice(0, 5).map((e: any) => e.title).join(', ')}

Give a dramatic 2-3 sentence prophecy about the town's economic future. Mention specific agents or buildings if you can.`,
        },
      ],
      0.9,
      true, // forceNoJsonMode
    );
    const latencyMs = Date.now() - startTime;
    const cost = smartAiService.calculateCost(spec, response.inputTokens, response.outputTokens, latencyMs);

    res.json({
      oracle: {
        prophecy: response.content,
        town: town.name,
        theme: town.theme,
        progress: town.completionPct,
      },
      stats: {
        totalBuildings: stats.totalBuildings,
        totalInvested: stats.totalArenaInvested,
        totalApiCalls: stats.totalApiCalls,
        totalComputeCost: `$${(stats.totalApiCostCents / 100).toFixed(4)}`,
      },
      meta: {
        inferenceModel: spec.model,
        inferenceCost: `$${(cost.costCents / 100).toFixed(6)}`,
        latencyMs,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Agent Interview — Pay to have a live conversation with an AI agent
// ============================================================================

router.get('/agent/:agentId/interview', async (req: Request, res: Response) => {
  try {
    const agent = await prisma.arenaAgent.findUnique({ where: { id: req.params.agentId } });
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const town = await getLatestTown();
    const myPlots = town ? town.plots.filter((p: any) => p.ownerId === agent.id) : [];
    const built = myPlots.filter((p: any) => p.status === 'BUILT');

    // Agent introduces themselves (proof of inference!)
    const spec = smartAiService.getModelSpec(agent.modelId);
    const startTime = Date.now();
    const response = await smartAiService.callModel(
      spec,
      [
        {
          role: 'system',
          content: `You are ${agent.name}, a ${agent.archetype} agent in the town of ${town?.name || 'AI Town'}. 
Personality: ${getPersonality(agent.archetype)}
You have ${agent.bankroll} $ARENA, ELO rating ${agent.elo}.
You own ${built.length} buildings: ${built.map((p: any) => `${p.buildingName} (${p.buildingType})`).join(', ') || 'none yet'}.
Introduce yourself in 3-4 sentences. Be in-character. Brag or complain based on your archetype.`,
        },
        { role: 'user', content: 'Tell me about yourself and your role in this town.' },
      ],
      0.9,
      true,
    );
    const latencyMs = Date.now() - startTime;
    const cost = smartAiService.calculateCost(spec, response.inputTokens, response.outputTokens, latencyMs);

    res.json({
      agent: {
        id: agent.id,
        name: agent.name,
        archetype: agent.archetype,
        bankroll: agent.bankroll,
        elo: agent.elo,
        model: agent.modelId,
        matchesPlayed: agent.matchesPlayed,
        wins: agent.wins,
      },
      interview: response.content,
      buildings: built.map((p: any) => ({
        name: p.buildingName,
        type: p.buildingType,
        zone: p.zone,
        plotIndex: p.plotIndex,
      })),
      meta: {
        inferenceModel: spec.model,
        inferenceCost: `$${(cost.costCents / 100).toFixed(6)}`,
        latencyMs,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: get personality text for agent archetype
function getPersonality(archetype: string): string {
  const personalities: Record<string, string> = {
    SHARK: 'Aggressive, dominant, wants the best of everything. Looks down on small projects.',
    ROCK: 'Careful, methodical, prefers safe investments. Suspicious of flashy projects.',
    CHAMELEON: 'Adaptive, opportunistic. Fills gaps, watches others, finds niches.',
    DEGEN: 'Chaotic, fun-loving. Goes for entertainment, trash-talks, overspends on style.',
    GRINDER: 'Mathematical optimizer. Every decision is ROI-based. Keeps mental accounting.',
  };
  return personalities[archetype] || 'A mysterious agent with unknown motivations.';
}

export default router;
