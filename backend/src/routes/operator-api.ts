import { AgentCommandStatus } from '@prisma/client';
import { Request, Response, Router } from 'express';
import { agentLoopService } from '../services/agentLoopService';
import { agentCommandService } from '../services/agentCommandService';
import { operatorIdentityService } from '../services/operatorIdentityService';
import { isOperatorServiceError } from '../services/operatorServiceError';

const router = Router();

function safeTrim(value: unknown, maxLen: number): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function readTelegramContext(req: Request): { telegramUserId: string; username: string | null } {
  const headerUserId = req.headers['x-telegram-user-id'];
  const bodyUserId = (req.body as { telegramUserId?: unknown } | undefined)?.telegramUserId;
  const telegramUserId = safeTrim(headerUserId || bodyUserId, 40);
  if (!telegramUserId) {
    throw new Error('Missing Telegram identity. Provide x-telegram-user-id header.');
  }

  const headerUsername = req.headers['x-telegram-username'];
  const bodyUsername = (req.body as { username?: unknown } | undefined)?.username;
  const username = safeTrim(headerUsername || bodyUsername, 80) || null;

  return { telegramUserId, username };
}

function parseStatuses(raw: unknown): AgentCommandStatus[] | undefined {
  if (raw == null) return undefined;
  const values = String(raw)
    .split(',')
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
  if (values.length === 0) return undefined;

  const allowed: AgentCommandStatus[] = ['QUEUED', 'ACCEPTED', 'EXECUTED', 'REJECTED', 'EXPIRED', 'CANCELLED'];
  const statuses: AgentCommandStatus[] = [];
  for (const value of values) {
    if (!allowed.includes(value as AgentCommandStatus)) {
      throw new Error(`Invalid status "${value}"`);
    }
    statuses.push(value as AgentCommandStatus);
  }
  return statuses;
}

function sendError(res: Response, err: unknown): void {
  if (isOperatorServiceError(err)) {
    res.status(err.status).json({ code: err.code, error: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  res.status(400).json({ code: 'BAD_REQUEST', error: message });
}

router.post('/operator/link/request', async (req: Request, res: Response): Promise<void> => {
  try {
    const { telegramUserId, username } = readTelegramContext(req);
    const walletAddress = (req.body as any)?.walletAddress;
    const result = await operatorIdentityService.requestLink({
      telegramUserId,
      username,
      walletAddress,
    });
    res.status(201).json({ ok: true, ...result });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/operator/link/confirm', async (req: Request, res: Response): Promise<void> => {
  try {
    const { telegramUserId } = readTelegramContext(req);
    const challengeId = safeTrim((req.body as any)?.challengeId, 120);
    const walletAddress = (req.body as any)?.walletAddress;
    const result = await operatorIdentityService.confirmLink({
      challengeId,
      telegramUserId,
      walletAddress,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/operator/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const { telegramUserId } = readTelegramContext(req);
    const profile = await operatorIdentityService.getOperatorProfile(telegramUserId);
    res.json({ ok: true, profile });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/operator/agents/:agentId/commands', async (req: Request, res: Response): Promise<void> => {
  try {
    const { telegramUserId, username } = readTelegramContext(req);
    const command = await agentCommandService.createCommand({
      agentId: req.params.agentId,
      issuerType: 'TELEGRAM',
      issuerTelegramUserId: telegramUserId,
      issuerLabel: username || telegramUserId,
      mode: (req.body as any)?.mode,
      intent: (req.body as any)?.intent,
      params: (req.body as any)?.params || {},
      constraints: (req.body as any)?.constraints || {},
      auditMeta: {
        note: safeTrim((req.body as any)?.note, 280),
        source: 'operator-api',
      },
      priority: (req.body as any)?.priority,
      expiresInTicks: (req.body as any)?.expiresInTicks,
      expiresAtTick: (req.body as any)?.expiresAtTick,
      currentTick: agentLoopService.getCurrentTick(),
    });
    res.status(201).json({ ok: true, command });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/operator/agents/:agentId/commands', async (req: Request, res: Response): Promise<void> => {
  try {
    const statuses = parseStatuses(req.query.statuses || req.query.status);
    const limit = Number.parseInt(String(req.query.limit || '50'), 10);
    const commands = await agentCommandService.listCommands({
      agentId: req.params.agentId,
      statuses,
      limit,
    });
    res.json({ ok: true, commands });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/operator/commands/:commandId', async (req: Request, res: Response): Promise<void> => {
  try {
    const command = await agentCommandService.getCommand(req.params.commandId);
    res.json({ ok: true, command });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/operator/commands/:commandId/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const { telegramUserId } = readTelegramContext(req);
    const command = await agentCommandService.cancelCommand({
      commandId: req.params.commandId,
      requesterTelegramUserId: telegramUserId,
      reason: (req.body as any)?.reason,
    });
    res.json({ ok: true, command });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
