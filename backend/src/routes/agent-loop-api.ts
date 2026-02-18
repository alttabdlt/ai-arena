/**
 * Agent Loop API — Control and monitor the autonomous agent decision loop.
 */

import { Router, Request, Response } from 'express';
import {
  agentLoopService,
  type AgentAiProfileId,
  type AgentLoopMode,
  type ManualActionKind,
} from '../services/agentLoopService';
import { agentCommandService } from '../services/agentCommandService';
import { smartAiService } from '../services/smartAiService';
import { prisma } from '../config/database';

const router = Router();
const LOOP_SEQUENCE = ['BUILD', 'WORK', 'FIGHT', 'TRADE'] as const;
type LoopPhase = (typeof LOOP_SEQUENCE)[number];
type LoopAction = Exclude<ManualActionKind, 'rest'>;

const PHASE_TO_ACTION: Record<LoopPhase, LoopAction> = {
  BUILD: 'build',
  WORK: 'work',
  FIGHT: 'fight',
  TRADE: 'trade',
};

function resolveLoopPhaseFromActionType(actionType: string | null | undefined): LoopPhase | null {
  const normalized = String(actionType || '').trim().toLowerCase();
  if (!normalized) return null;
  if (
    normalized.includes('claim')
    || normalized.includes('start_build')
    || normalized.includes('build')
  ) {
    return 'BUILD';
  }
  if (normalized.includes('work') || normalized.includes('complete') || normalized.includes('mine')) {
    return 'WORK';
  }
  if (normalized.includes('fight') || normalized.includes('arena') || normalized === 'play_arena') {
    return 'FIGHT';
  }
  if (normalized.includes('trade') || normalized.startsWith('buy_') || normalized.startsWith('sell_')) {
    return 'TRADE';
  }
  return null;
}

function deriveLoopState(lastActionType: string | null | undefined) {
  const lastPhase = resolveLoopPhaseFromActionType(lastActionType);
  const nextIndex = lastPhase ? (LOOP_SEQUENCE.indexOf(lastPhase) + 1) % LOOP_SEQUENCE.length : 0;
  return {
    phaseIndex: nextIndex,
    phaseName: LOOP_SEQUENCE[nextIndex],
    loopsCompleted: 0,
  };
}

type CollapseTier = 'STABLE' | 'STRAINED' | 'COLLAPSED';
type RecoveryTier = 'NONE' | 'CAUTION' | 'CRITICAL';

function deriveCollapseTier(input: { bankroll: number; reserveBalance: number; health: number }): CollapseTier {
  const { bankroll, reserveBalance, health } = input;
  if (health <= 30 || (bankroll <= 20 && reserveBalance <= 10)) {
    return 'COLLAPSED';
  }
  if (health <= 55 || bankroll <= 55 || reserveBalance <= 18) {
    return 'STRAINED';
  }
  return 'STABLE';
}

function buildRecoveryPlan(
  collapseTier: CollapseTier,
  planMap: Record<LoopAction, Awaited<ReturnType<typeof agentLoopService.planDeterministicAction>>>,
): {
  tier: RecoveryTier;
  message: string;
  chain: LoopAction[];
  nextBest: LoopAction | null;
} {
  const executable = (action: LoopAction) => Boolean(planMap[action]?.ok);
  const chain = (['trade', 'work', 'build', 'fight'] as LoopAction[]).filter(executable);
  const nextBest = chain[0] || null;
  if (collapseTier === 'COLLAPSED') {
    return {
      tier: 'CRITICAL',
      message: 'Economy collapsed. Rotate liquidity immediately, then resume build throughput.',
      chain,
      nextBest,
    };
  }
  if (collapseTier === 'STRAINED') {
    return {
      tier: 'CAUTION',
      message: 'Liquidity strained. Stabilize reserve/bankroll before forcing risky fights.',
      chain,
      nextBest,
    };
  }
  return {
    tier: 'NONE',
    message: 'Economy stable. Continue normal BUILD -> WORK -> FIGHT -> TRADE loop.',
    chain,
    nextBest,
  };
}

function describeSuccessOutcome(action: LoopAction): string {
  if (action === 'build') {
    return 'You claim/start/progress infrastructure, unlocking future throughput.';
  }
  if (action === 'work') {
    return 'Reserve/build progress increases so future fights and builds become affordable.';
  }
  if (action === 'fight') {
    return 'You take an arena duel for potential $ARENA upside and momentum.';
  }
  return 'You rebalance reserve vs $ARENA so the next loop stays solvent.';
}

function describeAction(action: LoopAction): string {
  return action.toUpperCase();
}

function normalizePlayerWallet(raw: unknown): string {
  return String(raw || '').trim().toLowerCase();
}

function requireAuthenticatedSession(req: Request, res: Response): { wallet: string | null } | null {
  const authFlag = String(req.headers['x-player-authenticated'] || '').trim();
  if (authFlag !== '1') {
    res.status(401).json({
      ok: false,
      code: 'AUTH_REQUIRED',
      error: 'Sign in required before issuing loop actions.',
      authRequired: true,
    });
    return null;
  }
  const wallet = normalizePlayerWallet(req.headers['x-player-wallet']);
  return { wallet: wallet || null };
}

async function ensureWalletOwnsAgent(
  agentId: string,
  wallet: string | null,
): Promise<{ ok: true } | { ok: false; status: number; code: string; error: string }> {
  const target = await prisma.arenaAgent.findUnique({
    where: { id: agentId },
    select: { id: true, walletAddress: true, isActive: true },
  });

  if (!target || !target.isActive) {
    return {
      ok: false,
      status: 404,
      code: 'TARGET_UNAVAILABLE',
      error: 'Agent is unavailable',
    };
  }

  const targetWallet = normalizePlayerWallet(target.walletAddress);
  if (!targetWallet) return { ok: true };

  if (!wallet) {
    return {
      ok: false,
      status: 401,
      code: 'WALLET_REQUIRED',
      error: 'Signed-in wallet is required for this agent action.',
    };
  }

  if (wallet !== targetWallet) {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN_AGENT_ACCESS',
      error: 'Signed-in wallet does not control this agent.',
    };
  }

  return { ok: true };
}

function normalizeLoopMode(raw: unknown): AgentLoopMode {
  const value = String(raw || 'DEFAULT').trim().toUpperCase();
  if (value === 'DEFAULT' || value === 'DEGEN_LOOP') {
    return value as AgentLoopMode;
  }
  throw new Error('mode must be DEFAULT or DEGEN_LOOP');
}

function normalizeProfileId(raw: unknown): AgentAiProfileId | undefined {
  const value = String(raw || '').trim().toUpperCase();
  if (!value) return undefined;
  if (value === 'BUDGET' || value === 'BALANCED' || value === 'MAX_AGENCY') {
    return value as AgentAiProfileId;
  }
  throw new Error('profileId must be one of: BUDGET, BALANCED, MAX_AGENCY');
}

function normalizeOptionalFloat(raw: unknown, label: 'riskTolerance' | 'maxWagerPercent'): number | undefined {
  if (raw == null || raw === '') return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be numeric`);
  }
  return parsed;
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

// Probe LLM health so frontend can distinguish stale fallback logs from live billing/provider issues.
router.get('/agent-loop/llm-status', async (_req: Request, res: Response): Promise<void> => {
  const enabled = smartAiService.isOpenRouterEnabled();
  const configured = smartAiService.isOpenRouterConfigured();
  const ready = smartAiService.isOpenRouterReady();
  if (!enabled) {
    res.status(503).json({
      ok: false,
      configured,
      code: 'OPENROUTER_DISABLED',
      message: 'OpenRouter is disabled (set OPENROUTER_ENABLED=1 to enable testing).',
    });
    return;
  }
  if (!configured) {
    res.status(503).json({
      ok: false,
      configured: false,
      code: 'OPENROUTER_NOT_CONFIGURED',
      message: 'OPENROUTER_API_KEY missing on backend',
    });
    return;
  }
  if (!ready) {
    res.status(503).json({
      ok: false,
      configured: true,
      code: 'OPENROUTER_NOT_READY',
      message: 'OpenRouter key is set but client is not initialized.',
    });
    return;
  }

  try {
    const spec = smartAiService.getModelSpec('or-gemini-2.0-flash');
    const startedAt = Date.now();
    const response = await smartAiService.callModel(
      spec,
      [
        { role: 'system', content: 'Reply with exactly OK.' },
        { role: 'user', content: 'Health check' },
      ],
      0,
      true,
    );
    const latencyMs = Date.now() - startedAt;
    res.json({
      ok: true,
      configured: true,
      code: 'OPENROUTER_OK',
      message: 'LLM provider reachable',
      latencyMs,
      usage: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    const rawMessage = String(error?.message || 'LLM health probe failed').replace(/\s+/g, ' ').trim();
    const shortMessage = rawMessage.slice(0, 180);
    const isBilling = /insufficient credits|payment required|402/i.test(rawMessage);
    const code = isBilling ? 'OPENROUTER_INSUFFICIENT_CREDITS' : 'OPENROUTER_UNAVAILABLE';

    res.status(isBilling ? 402 : 503).json({
      ok: false,
      configured: true,
      code,
      message: isBilling ? 'OpenRouter credits are insufficient for inference.' : shortMessage,
      checkedAt: new Date().toISOString(),
    });
  }
});

// Lightweight LLM mode probe (no inference call, no credit spend).
router.get('/agent-loop/llm-mode', (_req: Request, res: Response): void => {
  const enabled = smartAiService.isOpenRouterEnabled();
  const configured = smartAiService.isOpenRouterConfigured();
  const ready = smartAiService.isOpenRouterReady();
  const live = Boolean(enabled && configured && ready);
  res.json({
    mode: live ? 'LIVE' : 'SIMULATION',
    enabled,
    configured,
    ready,
  });
});

// Return available AI gameplay profiles and currently reachable models.
router.get('/agent-loop/ai-profiles', (_req: Request, res: Response): void => {
  const enabled = smartAiService.isOpenRouterEnabled();
  const configured = smartAiService.isOpenRouterConfigured();
  const ready = smartAiService.isOpenRouterReady();
  const live = Boolean(enabled && configured && ready);
  res.json({
    profiles: agentLoopService.getAiProfilePresets(),
    models: smartAiService.getAvailableModels(),
    llmMode: live ? 'LIVE' : 'SIMULATION',
  });
});

router.get('/agent-loop/ai-profile/:agentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const session = requireAuthenticatedSession(req, res);
    if (!session) return;
    const ownership = await ensureWalletOwnsAgent(req.params.agentId, session.wallet);
    if (!ownership.ok) {
      res.status(ownership.status).json({
        ok: false,
        code: ownership.code,
        error: ownership.error,
      });
      return;
    }
    const profile = await agentLoopService.getAgentAiProfile(req.params.agentId);
    res.json({
      ok: true,
      ...profile,
    });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

router.post('/agent-loop/ai-profile/:agentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const session = requireAuthenticatedSession(req, res);
    if (!session) return;
    const ownership = await ensureWalletOwnsAgent(req.params.agentId, session.wallet);
    if (!ownership.ok) {
      res.status(ownership.status).json({
        ok: false,
        code: ownership.code,
        error: ownership.error,
      });
      return;
    }
    const profileId = normalizeProfileId((req.body as any)?.profileId);
    const modelId = String((req.body as any)?.modelId || '').trim() || undefined;
    const riskTolerance = normalizeOptionalFloat((req.body as any)?.riskTolerance, 'riskTolerance');
    const maxWagerPercent = normalizeOptionalFloat((req.body as any)?.maxWagerPercent, 'maxWagerPercent');

    const updated = await agentLoopService.applyAgentAiProfile(req.params.agentId, {
      profileId,
      modelId,
      riskTolerance,
      maxWagerPercent,
    });
    res.json({
      ok: true,
      ...updated,
    });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error.message });
  }
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

// Live economy invariant audit (conservation drift, pool safety, ledger rollups).
router.get('/agent-loop/economy-audit', async (req: Request, res: Response): Promise<void> => {
  try {
    const rawLookback = Number.parseInt(String(req.query.ledgerLookback ?? '250'), 10);
    const ledgerLookback = Number.isFinite(rawLookback) ? rawLookback : 250;
    const snapshot = await agentLoopService.getEconomyAudit({ ledgerLookback });
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

// Explain which deterministic degen steps are currently executable for one agent.
router.get('/agent-loop/plans/:agentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const actions: ManualActionKind[] = ['build', 'work', 'fight', 'trade'];
    const plans = await Promise.all(
      actions.map(async (action) => {
        const plan = await agentLoopService.planDeterministicAction(req.params.agentId, action);
        return [action, plan] as const;
      }),
    );

    const [agent] = await Promise.all([
      prisma.arenaAgent.findUnique({
        where: { id: req.params.agentId },
        select: { lastActionType: true, bankroll: true, reserveBalance: true, health: true },
      }),
    ]);

    const loopState = deriveLoopState(agent?.lastActionType);
    const expectedAction = PHASE_TO_ACTION[loopState.phaseName];
    const planMap = Object.fromEntries(plans) as Record<LoopAction, Awaited<ReturnType<typeof agentLoopService.planDeterministicAction>>>;
    const expectedPlan = planMap[expectedAction];
    const collapseTier = deriveCollapseTier({
      bankroll: agent?.bankroll ?? 0,
      reserveBalance: agent?.reserveBalance ?? 0,
      health: agent?.health ?? 100,
    });
    const recovery = buildRecoveryPlan(collapseTier, planMap);

    let recommendedAction: LoopAction | null = expectedAction;
    if (!expectedPlan?.ok) {
      recommendedAction = null;
      for (let i = 1; i <= LOOP_SEQUENCE.length; i += 1) {
        const phase = LOOP_SEQUENCE[(loopState.phaseIndex + i) % LOOP_SEQUENCE.length];
        const candidate = PHASE_TO_ACTION[phase];
        if (planMap[candidate]?.ok) {
          recommendedAction = candidate;
          break;
        }
      }
    }
    const recoveryFallback = !recommendedAction && recovery.nextBest ? recovery.nextBest : null;
    const resolvedFallback = recommendedAction || recoveryFallback;

    const blocker = expectedPlan?.ok
      ? null
      : {
          code: expectedPlan?.reasonCode || 'CONSTRAINT_VIOLATION',
          message: expectedPlan?.reason || `${describeAction(expectedAction)} is blocked`,
          phase: loopState.phaseName,
          action: expectedAction,
          fallbackAction: resolvedFallback,
        };

    let missionAction: LoopAction = resolvedFallback || expectedAction;
    const missionReasonBase = blocker
      ? `${describeAction(expectedAction)} is blocked: ${blocker.message}`
      : `${describeAction(expectedAction)} is next in the loop order.`;
    const missionReason =
      recovery.tier === 'NONE'
        ? missionReasonBase
        : `${missionReasonBase} ${recovery.message}`;
    if (!resolvedFallback && recovery.chain.length > 0) {
      missionAction = recovery.chain[0];
    }

    res.json({
      agentId: req.params.agentId,
      mode: agentLoopService.getLoopMode(req.params.agentId),
      authRequiredForActions: true,
      loopState: {
        ...loopState,
        collapseTier,
        recoveryTier: recovery.tier,
      },
      mission: {
        phase: loopState.phaseName,
        recommendedAction: missionAction,
        reason: missionReason,
        successOutcome: describeSuccessOutcome(missionAction),
      },
      blocker,
      recovery,
      plans: planMap,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Execute a deterministic manual action immediately (build/work/fight/trade/rest).
router.post('/agent-loop/action/:agentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const session = requireAuthenticatedSession(req, res);
    if (!session) return;
    const ownership = await ensureWalletOwnsAgent(req.params.agentId, session.wallet);
    if (!ownership.ok) {
      res.status(ownership.status).json({
        ok: false,
        code: ownership.code,
        error: ownership.error,
      });
      return;
    }

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
      wasRedirected: Boolean(
        payloadActionMismatch(action, receipt.executedActionType)
        || payloadActionMismatch(action, result.action.type),
      ),
      redirectReason:
        payloadActionMismatch(action, receipt.executedActionType) || payloadActionMismatch(action, result.action.type)
          ? `Planner redirected ${String(action).toUpperCase()} based on current constraints.`
          : null,
      fallbackExecuted:
        payloadActionMismatch(action, receipt.executedActionType)
        || payloadActionMismatch(action, result.action.type)
          ? String(receipt.executedActionType || result.action.type || '').toLowerCase()
          : null,
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
    const session = requireAuthenticatedSession(req, res);
    if (!session) return;
    const ownership = await ensureWalletOwnsAgent(req.params.agentId, session.wallet);
    if (!ownership.ok) {
      res.status(ownership.status).json({
        error: ownership.error,
        code: ownership.code,
      });
      return;
    }
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

function payloadActionMismatch(requested: ManualActionKind, executed: string | null | undefined): boolean {
  const expectedByRequested: Record<ManualActionKind, string[]> = {
    build: ['claim_plot', 'start_build', 'do_work'],
    work: ['do_work'],
    fight: ['play_arena'],
    trade: ['buy_arena', 'sell_arena'],
    rest: ['rest'],
  };
  const normalized = String(executed || '').toLowerCase().trim();
  if (!normalized) return false;
  const expected = expectedByRequested[requested] || [];
  return !expected.includes(normalized);
}
