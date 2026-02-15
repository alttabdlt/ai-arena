import { Request, Response, Router } from 'express';
import { AgentCommandMode } from '@prisma/client';
import { agentCommandService } from '../services/agentCommandService';
import { agentLoopService } from '../services/agentLoopService';
import { crewWarsService } from '../services/crewWarsService';
import { operatorIdentityService } from '../services/operatorIdentityService';

const router = Router();

function safeTrim(value: unknown, maxLen: number): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function normalizeMode(raw: unknown): AgentCommandMode {
  const value = String(raw || 'STRONG').trim().toUpperCase();
  if (value === 'SUGGEST' || value === 'STRONG' || value === 'OVERRIDE') {
    return value as AgentCommandMode;
  }
  throw new Error('mode must be SUGGEST, STRONG, or OVERRIDE');
}

router.get('/crew-wars/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const battles = Number.parseInt(String(req.query.battles || '8'), 10);
    const snapshot = await crewWarsService.getDashboard(battles);
    res.json(snapshot);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/crew-wars/agent/:agentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const crew = await crewWarsService.getAgentCrew(req.params.agentId);
    const recentOrders = await crewWarsService.getRecentOrders(req.params.agentId, 12);
    res.json({
      agent: crew,
      recentOrders,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/crew-wars/orders', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const agentId = safeTrim(body.agentId, 120);
    if (!agentId) {
      res.status(400).json({ error: 'agentId is required' });
      return;
    }

    const telegramUserId = safeTrim(body.telegramUserId || req.headers['x-telegram-user-id'], 40) || null;
    const issuerLabel = safeTrim(
      body.username || req.headers['x-telegram-username'] || body.issuerLabel || telegramUserId || 'operator',
      80,
    ) || 'operator';

    let issuerIdentityId: string | null = null;
    if (telegramUserId) {
      const modeForAuth = normalizeMode(body.mode);
      await operatorIdentityService.assertCommandAuthority({
        telegramUserId,
        agentId,
        mode: modeForAuth,
      });
      const identity = await operatorIdentityService.getIdentityByTelegramUserId(telegramUserId, true);
      issuerIdentityId = identity.id;
    }

    const currentTick = agentLoopService.getCurrentTick();
    const order = await crewWarsService.queueOrder({
      agentId,
      strategy: safeTrim(body.strategy, 40),
      intensity: Number(body.intensity ?? 1),
      source: safeTrim(body.source || 'api', 40) || 'api',
      note: safeTrim(body.note, 220),
      issuerIdentityId,
      issuerLabel,
      params:
        body.params && typeof body.params === 'object' && !Array.isArray(body.params)
          ? (body.params as Record<string, unknown>)
          : {},
      createdTick: currentTick,
      expiresInTicks: Number(body.expiresInTicks ?? 3),
      expiresAtTick: body.expiresAtTick != null ? Number(body.expiresAtTick) : undefined,
    });

    const mode = normalizeMode(body.mode);
    const command = await agentCommandService.createCommand({
      agentId,
      issuerType: telegramUserId ? 'TELEGRAM' : 'API',
      issuerTelegramUserId: telegramUserId || undefined,
      issuerLabel,
      mode,
      intent: crewWarsService.intentForStrategy(order.strategy),
      params: {
        intensity: order.intensity,
        ...(body.params && typeof body.params === 'object' && !Array.isArray(body.params)
          ? (body.params as Record<string, unknown>)
          : {}),
      },
      priority: mode === 'OVERRIDE' ? 100 : mode === 'STRONG' ? 88 : 66,
      currentTick,
      expiresInTicks: Number(body.expiresInTicks ?? 3),
      expiresAtTick: body.expiresAtTick != null ? Number(body.expiresAtTick) : undefined,
      auditMeta: {
        source: 'crew-wars-api',
        strategy: order.strategy,
        crewOrderId: order.id,
        note: order.note || '',
      },
    });

    const immediate = body.immediate !== false;
    let tickResult: any = null;
    let commandStatus: any = null;
    if (immediate) {
      tickResult = await agentLoopService.processAgent(agentId);
      commandStatus = await agentCommandService.getCommand(command.id);
    }

    res.status(201).json({
      ok: true,
      order,
      commandId: command.id,
      commandStatus: commandStatus?.status || command.status,
      commandReceipt: tickResult?.commandReceipt || null,
      tickResult: tickResult
        ? {
            tick: tickResult.tick,
            action: tickResult.action.type,
            success: tickResult.success,
            narrative: tickResult.narrative,
          }
        : null,
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ ok: false, error: message });
  }
});

router.post('/crew-wars/sync', async (_req: Request, res: Response): Promise<void> => {
  try {
    const assigned = await crewWarsService.ensureMembershipsForActiveAgents(500);
    const snapshot = await crewWarsService.getDashboard(6);
    res.json({
      ok: true,
      assigned,
      crews: snapshot.crews.map((crew) => ({
        id: crew.id,
        name: crew.name,
        members: crew.memberCount,
        territory: crew.territoryControl,
        treasury: crew.treasuryArena,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;

