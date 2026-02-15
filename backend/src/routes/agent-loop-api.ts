/**
 * Agent Loop API — Control and monitor the autonomous agent decision loop.
 */

import { Router, Request, Response } from 'express';
import { agentLoopService, type AgentLoopMode, type ManualActionKind } from '../services/agentLoopService';
import { agentCommandService } from '../services/agentCommandService';

const router = Router();

function normalizeLoopMode(raw: unknown): AgentLoopMode {
  const value = String(raw || 'DEFAULT').trim().toUpperCase();
  if (value === 'DEFAULT' || value === 'DEGEN_LOOP') {
    return value as AgentLoopMode;
  }
  throw new Error('mode must be DEFAULT or DEGEN_LOOP');
}

function normalizeManualAction(raw: unknown): ManualActionKind {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'build' || value === 'work' || value === 'fight' || value === 'trade' || value === 'rest') {
    return value;
  }
  throw new Error('action must be one of: build, work, fight, trade, rest');
}

// Start the agent loop
router.post('/agent-loop/start', async (req: Request, res: Response): Promise<void> => {
  try {
    // `req.body` is only populated when the request has a JSON Content-Type.
    // Allow calls with no body (or wrong content-type) to still work.
    const raw = (req.body as any)?.intervalMs;
    const parsed = typeof raw === 'number' ? raw : raw != null ? Number.parseInt(String(raw), 10) : NaN;
    const envDefault = parseInt(process.env.TICK_INTERVAL_MS || '') || 20000; // Default 20s for demo
    const intervalMs = Number.isFinite(parsed) && parsed > 0 ? parsed : envDefault;
    agentLoopService.start(intervalMs);
    res.json({ status: 'started', intervalMs });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Stop the agent loop
router.post('/agent-loop/stop', async (_req: Request, res: Response): Promise<void> => {
  try {
    agentLoopService.stop();
    res.json({ status: 'stopped' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get loop status
router.get('/agent-loop/status', async (_req: Request, res: Response): Promise<void> => {
  res.json({
    running: agentLoopService.isRunning(),
    currentTick: agentLoopService.getCurrentTick(),
  });
});

// Inspect rescue debt/window telemetry for balancing and debugging.
router.get('/agent-loop/rescue-stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawLimit = Number.parseInt(String(req.query.limit ?? '25'), 10);
    const limit = Number.isFinite(rawLimit) ? rawLimit : 25;
    const snapshot = await agentLoopService.getRescueTelemetry(limit);
    res.json(snapshot);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Economy pacing and loop health snapshot for balancing decisions.
router.get('/agent-loop/economy-metrics', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawLimit = Number.parseInt(String(req.query.limit ?? '250'), 10);
    const limit = Number.isFinite(rawLimit) ? rawLimit : 250;
    const snapshot = await agentLoopService.getEconomyMetrics(limit);
    res.json(snapshot);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger one tick (process all agents once)
router.post('/agent-loop/tick', async (_req: Request, res: Response): Promise<void> => {
  try {
    const results = await agentLoopService.tick();
    res.json({ tick: agentLoopService.getCurrentTick(), results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger one agent
router.post('/agent-loop/tick/:agentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await agentLoopService.processAgent(req.params.agentId);
    res.json({ result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send an instruction to an agent (will be processed on next tick)
router.post('/agent-loop/tell/:agentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, from } = req.body || {};
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message is required' });
      return;
    }
    agentLoopService.queueInstruction(
      req.params.agentId,
      message,
      'api',
      typeof from === 'string' ? from : 'API User',
    );
    res.json({ status: 'queued', agentId: req.params.agentId, message });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Execute a deterministic manual action immediately (build/work/fight/trade/rest).
router.post('/agent-loop/action/:agentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const action = normalizeManualAction((req.body as any)?.action);
    const source = String((req.body as any)?.source || 'api').trim().slice(0, 60) || 'api';
    const plan = await agentLoopService.planDeterministicAction(req.params.agentId, action);
    if (!plan.ok) {
      res.status(409).json({
        ok: false,
        action,
        code: plan.reasonCode,
        error: plan.reason,
      });
      return;
    }

    await agentCommandService.cancelQueuedCommands({
      agentId: req.params.agentId,
      issuerType: 'API',
      reason: 'Superseded by newer manual action',
    });

    const command = await agentCommandService.createCommand({
      agentId: req.params.agentId,
      issuerType: 'API',
      issuerLabel: source,
      mode: 'OVERRIDE',
      intent: plan.intent,
      params: plan.params,
      priority: 100,
      expiresInTicks: 2,
      currentTick: agentLoopService.getCurrentTick(),
      auditMeta: {
        source: 'agent-loop-action',
        action,
      },
    });

    const result = await agentLoopService.processAgent(req.params.agentId);
    const commandState = await agentCommandService.getCommand(command.id);
    const receipt = result.commandReceipt?.commandId === command.id
      ? result.commandReceipt
      : {
          commandId: commandState.id,
          mode: commandState.mode,
          intent: commandState.intent,
          expectedActionType: commandState.expectedActionType,
          executedActionType: null,
          compliance: 'PARTIAL' as const,
          status: commandState.status === 'EXECUTED' ? 'EXECUTED' : 'REJECTED',
          statusReason: commandState.statusReason,
        };

    res.json({
      ok: commandState.status === 'EXECUTED',
      action,
      plan: {
        intent: plan.intent,
        note: plan.note,
      },
      commandId: command.id,
      commandStatus: commandState.status,
      receipt,
      result: {
        tick: result.tick,
        action: result.action.type,
        narrative: result.narrative,
        success: result.success,
      },
    });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

// Set deterministic loop mode for one agent (DEFAULT | DEGEN_LOOP)
router.post('/agent-loop/mode/:agentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const mode = normalizeLoopMode((req.body as any)?.mode);
    const applied = agentLoopService.setLoopMode(req.params.agentId, mode);
    res.json({ agentId: req.params.agentId, mode: applied });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get loop mode for one agent
router.get('/agent-loop/mode/:agentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const mode = agentLoopService.getLoopMode(req.params.agentId);
    res.json({ agentId: req.params.agentId, mode });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
