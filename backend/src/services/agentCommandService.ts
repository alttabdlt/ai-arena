import {
  AgentCommand,
  AgentCommandIssuerType,
  AgentCommandMode,
  AgentCommandStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../config/database';
import { operatorIdentityService } from './operatorIdentityService';
import { OperatorServiceError, isOperatorServiceError } from './operatorServiceError';

const BASE_PRIORITY_BY_MODE: Record<AgentCommandMode, number> = {
  SUGGEST: 50,
  STRONG: 80,
  OVERRIDE: 95,
};

const SUPPORTED_INTENTS = new Set([
  'claim_plot',
  'start_build',
  'do_work',
  'complete_build',
  'buy_arena',
  'sell_arena',
  'play_arena',
  'transfer_arena',
  'buy_skill',
  'rest',
  'trade',
  'crew_raid',
  'crew_defend',
  'crew_farm',
  'crew_trade',
]);

const INTENT_ACTION_MAP: Record<string, string> = {
  claim_plot: 'claim_plot',
  claimplot: 'claim_plot',
  start_build: 'start_build',
  startbuild: 'start_build',
  do_work: 'do_work',
  dowork: 'do_work',
  complete_build: 'complete_build',
  completebuild: 'complete_build',
  buy_arena: 'buy_arena',
  buyarena: 'buy_arena',
  sell_arena: 'sell_arena',
  sellarena: 'sell_arena',
  play_arena: 'play_arena',
  playarena: 'play_arena',
  transfer_arena: 'transfer_arena',
  transferarena: 'transfer_arena',
  buy_skill: 'buy_skill',
  buyskill: 'buy_skill',
  rest: 'rest',
  trade: 'buy_arena',
  crew_raid: 'play_arena',
  crew_defend: 'do_work',
  crew_farm: 'buy_arena',
  crew_trade: 'sell_arena',
};

export type AgentCommandView = {
  id: string;
  agentId: string;
  issuerType: AgentCommandIssuerType;
  issuerIdentityId: string | null;
  issuerTelegramUserId: string | null;
  issuerLabel: string | null;
  mode: AgentCommandMode;
  intent: string;
  expectedActionType: string | null;
  params: Record<string, unknown>;
  constraints: Record<string, unknown>;
  auditMeta: Record<string, unknown>;
  priority: number;
  createdTick: number | null;
  expiresAtTick: number | null;
  status: AgentCommandStatus;
  statusReason: string;
  result: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt: Date | null;
  executedAt: Date | null;
  rejectedAt: Date | null;
  cancelledAt: Date | null;
  expiredAt: Date | null;
};

type CreateCommandInput = {
  agentId: string;
  issuerType?: AgentCommandIssuerType;
  issuerTelegramUserId?: string;
  issuerLabel?: string;
  mode?: AgentCommandMode | string;
  intent: string;
  params?: Record<string, unknown>;
  constraints?: Record<string, unknown>;
  auditMeta?: Record<string, unknown>;
  priority?: number;
  createdTick?: number;
  expiresInTicks?: number;
  expiresAtTick?: number;
  currentTick?: number;
};

function safeTrim(value: unknown, maxLen: number): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function clampPriority(raw: unknown, fallback: number): number {
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.round(numeric);
  return Math.min(100, Math.max(0, rounded));
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function normalizeMode(raw: AgentCommandMode | string | undefined): AgentCommandMode {
  const value = String(raw || 'SUGGEST').toUpperCase().trim();
  if (value === 'SUGGEST' || value === 'STRONG' || value === 'OVERRIDE') {
    return value;
  }
  throw new OperatorServiceError('INVALID_MODE', 'mode must be SUGGEST, STRONG, or OVERRIDE', 400);
}

function normalizeIntent(raw: string): string {
  const normalized = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!normalized) {
    throw new OperatorServiceError('INVALID_INTENT', 'intent is required', 400);
  }
  if (!SUPPORTED_INTENTS.has(normalized)) {
    throw new OperatorServiceError('INVALID_INTENT', `Unsupported intent "${normalized}"`, 400);
  }
  return normalized;
}

function expectedActionTypeForIntent(intent: string): string | null {
  return INTENT_ACTION_MAP[intent] || null;
}

function toView(row: AgentCommand & { issuerIdentity?: { telegramUserId: string } | null }): AgentCommandView {
  return {
    id: row.id,
    agentId: row.agentId,
    issuerType: row.issuerType,
    issuerIdentityId: row.issuerIdentityId,
    issuerTelegramUserId: row.issuerIdentity?.telegramUserId || null,
    issuerLabel: row.issuerLabel,
    mode: row.mode,
    intent: row.intent,
    expectedActionType: expectedActionTypeForIntent(row.intent),
    params: parseJsonObject(row.paramsJson),
    constraints: parseJsonObject(row.constraintsJson),
    auditMeta: parseJsonObject(row.auditMetaJson),
    priority: row.priority,
    createdTick: row.createdTick,
    expiresAtTick: row.expiresAtTick,
    status: row.status,
    statusReason: row.statusReason,
    result: parseJsonObject(row.resultJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    acceptedAt: row.acceptedAt,
    executedAt: row.executedAt,
    rejectedAt: row.rejectedAt,
    cancelledAt: row.cancelledAt,
    expiredAt: row.expiredAt,
  };
}

export class AgentCommandService {
  private async verifyAgentExists(agentId: string): Promise<void> {
    const exists = await prisma.arenaAgent.findUnique({
      where: { id: agentId },
      select: { id: true },
    });
    if (!exists) {
      throw new OperatorServiceError('TARGET_UNAVAILABLE', 'Agent not found', 404);
    }
  }

  private resolveExpiresAtTick(input: {
    currentTick: number;
    expiresAtTick?: number;
    expiresInTicks?: number;
  }): number | null {
    const currentTick = Number.isFinite(input.currentTick) ? Math.max(0, Math.trunc(input.currentTick)) : 0;
    if (input.expiresAtTick != null) {
      const absolute = Math.trunc(input.expiresAtTick);
      if (!Number.isFinite(absolute) || absolute <= currentTick) {
        throw new OperatorServiceError('EXPIRED', 'expiresAtTick must be greater than current tick', 400);
      }
      return absolute;
    }

    if (input.expiresInTicks != null) {
      const relative = Math.trunc(input.expiresInTicks);
      if (!Number.isFinite(relative) || relative <= 0) {
        throw new OperatorServiceError('EXPIRED', 'expiresInTicks must be positive', 400);
      }
      return currentTick + relative;
    }

    return null;
  }

  async createCommand(input: CreateCommandInput): Promise<AgentCommandView> {
    const agentId = String(input.agentId || '').trim();
    if (!agentId) {
      throw new OperatorServiceError('TARGET_UNAVAILABLE', 'agentId is required', 400);
    }
    await this.verifyAgentExists(agentId);

    const mode = normalizeMode(input.mode);
    const intent = normalizeIntent(input.intent);
    const issuerType: AgentCommandIssuerType = input.issuerType || 'TELEGRAM';
    const currentTick = Number.isFinite(input.currentTick) ? Math.max(0, Math.trunc(input.currentTick!)) : 0;
    const expiresAtTick = this.resolveExpiresAtTick({
      currentTick,
      expiresAtTick: input.expiresAtTick,
      expiresInTicks: input.expiresInTicks,
    });
    const priority = clampPriority(input.priority, BASE_PRIORITY_BY_MODE[mode]);

    let issuerIdentityId: string | null = null;
    let issuerTelegramUserId: string | null = null;
    const requiresLinkedTelegramIdentity = issuerType === 'TELEGRAM' && mode !== 'SUGGEST';
    if (input.issuerTelegramUserId) {
      const telegramUserId = String(input.issuerTelegramUserId).trim();
      issuerTelegramUserId = telegramUserId;

      if (mode !== 'SUGGEST') {
        await operatorIdentityService.assertCommandAuthority({ telegramUserId, agentId, mode });
      }

      try {
        const identity = await operatorIdentityService.getIdentityByTelegramUserId(telegramUserId, mode !== 'SUGGEST');
        issuerIdentityId = identity.id;
      } catch (err) {
        if (!(mode === 'SUGGEST' && isOperatorServiceError(err) && err.code === 'UNVERIFIED_IDENTITY')) {
          throw err;
        }
      }
    } else if (requiresLinkedTelegramIdentity) {
      throw new OperatorServiceError('UNVERIFIED_IDENTITY', 'Strong/override commands require a linked Telegram identity', 401);
    }

    const issuerLabel = safeTrim(input.issuerLabel || issuerTelegramUserId || 'operator', 80) || 'operator';

    const created = await prisma.agentCommand.create({
      data: {
        agentId,
        issuerType,
        issuerIdentityId,
        issuerLabel,
        mode,
        intent,
        paramsJson: JSON.stringify(input.params || {}),
        constraintsJson: JSON.stringify(input.constraints || {}),
        auditMetaJson: JSON.stringify(input.auditMeta || {}),
        priority,
        createdTick: input.createdTick != null ? Math.max(0, Math.trunc(input.createdTick)) : currentTick,
        expiresAtTick,
        status: 'QUEUED',
        statusReason: 'Queued',
      },
      include: {
        issuerIdentity: { select: { telegramUserId: true } },
      },
    });

    return toView(created);
  }

  async listCommands(input: {
    agentId: string;
    statuses?: AgentCommandStatus[];
    limit?: number;
  }): Promise<AgentCommandView[]> {
    const where: Prisma.AgentCommandWhereInput = {
      agentId: input.agentId,
    };
    if (input.statuses && input.statuses.length > 0) {
      where.status = { in: input.statuses };
    }

    const rows = await prisma.agentCommand.findMany({
      where,
      include: { issuerIdentity: { select: { telegramUserId: true } } },
      orderBy: [{ createdAt: 'desc' }],
      take: Math.min(Math.max(input.limit || 50, 1), 200),
    });
    return rows.map((row) => toView(row));
  }

  async getCommand(commandId: string): Promise<AgentCommandView> {
    const row = await prisma.agentCommand.findUnique({
      where: { id: commandId },
      include: { issuerIdentity: { select: { telegramUserId: true } } },
    });
    if (!row) {
      throw new OperatorServiceError('TARGET_UNAVAILABLE', 'Command not found', 404);
    }
    return toView(row);
  }

  async cancelCommand(input: {
    commandId: string;
    requesterTelegramUserId?: string;
    reason?: string;
  }): Promise<AgentCommandView> {
    const command = await prisma.agentCommand.findUnique({
      where: { id: input.commandId },
      include: { issuerIdentity: { select: { telegramUserId: true } } },
    });
    if (!command) {
      throw new OperatorServiceError('TARGET_UNAVAILABLE', 'Command not found', 404);
    }
    if (!['QUEUED', 'ACCEPTED'].includes(command.status)) {
      throw new OperatorServiceError('CONSTRAINT_VIOLATION', `Cannot cancel command in status ${command.status}`, 409);
    }

    if (input.requesterTelegramUserId) {
      const requester = String(input.requesterTelegramUserId).trim();
      const createdByRequester = command.issuerIdentity?.telegramUserId === requester;
      if (!createdByRequester) {
        await operatorIdentityService.assertCommandAuthority({
          telegramUserId: requester,
          agentId: command.agentId,
          mode: 'OVERRIDE',
        });
      }
    }

    const reason = safeTrim(input.reason || 'Cancelled by operator', 200) || 'Cancelled by operator';
    const cancelled = await prisma.agentCommand.update({
      where: { id: command.id },
      data: {
        status: 'CANCELLED',
        statusReason: reason,
        cancelledAt: new Date(),
      },
      include: { issuerIdentity: { select: { telegramUserId: true } } },
    });
    return toView(cancelled);
  }

  async expireQueuedCommands(agentId: string, currentTick: number): Promise<number> {
    const normalizedTick = Math.max(0, Math.trunc(currentTick));
    const result = await prisma.agentCommand.updateMany({
      where: {
        agentId,
        status: 'QUEUED',
        expiresAtTick: { not: null, lt: normalizedTick },
      },
      data: {
        status: 'EXPIRED',
        statusReason: `Expired before tick ${normalizedTick}`,
        expiredAt: new Date(),
      },
    });
    return result.count;
  }

  async cancelQueuedCommands(input: {
    agentId: string;
    issuerType?: AgentCommandIssuerType;
    reason?: string;
  }): Promise<number> {
    const result = await prisma.agentCommand.updateMany({
      where: {
        agentId: input.agentId,
        status: 'QUEUED',
        ...(input.issuerType ? { issuerType: input.issuerType } : {}),
      },
      data: {
        status: 'CANCELLED',
        statusReason: safeTrim(input.reason || 'Superseded by newer command', 200) || 'Superseded by newer command',
        cancelledAt: new Date(),
      },
    });
    return result.count;
  }

  async acceptNextCommand(agentId: string, currentTick: number): Promise<AgentCommandView | null> {
    await this.expireQueuedCommands(agentId, currentTick);

    const candidate = await prisma.agentCommand.findFirst({
      where: {
        agentId,
        status: 'QUEUED',
        OR: [{ expiresAtTick: null }, { expiresAtTick: { gte: Math.max(0, Math.trunc(currentTick)) } }],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: { issuerIdentity: { select: { telegramUserId: true } } },
    });
    if (!candidate) return null;

    const accepted = await prisma.agentCommand.updateMany({
      where: { id: candidate.id, status: 'QUEUED' },
      data: {
        status: 'ACCEPTED',
        statusReason: `Accepted on tick ${Math.max(0, Math.trunc(currentTick))}`,
        acceptedAt: new Date(),
      },
    });
    if (accepted.count === 0) return null;

    return this.getCommand(candidate.id);
  }

  async markExecuted(input: {
    commandId: string;
    statusReason: string;
    result?: Record<string, unknown>;
  }): Promise<void> {
    const updateResult = await prisma.agentCommand.updateMany({
      where: {
        id: input.commandId,
        status: { in: ['ACCEPTED', 'QUEUED'] },
      },
      data: {
        status: 'EXECUTED',
        statusReason: safeTrim(input.statusReason, 220) || 'Executed',
        resultJson: JSON.stringify(input.result || {}),
        executedAt: new Date(),
      },
    });
    if (updateResult.count === 0) {
      throw new OperatorServiceError('CONSTRAINT_VIOLATION', 'Command is not executable in current status', 409);
    }
  }

  async markRejected(input: {
    commandId: string;
    reasonCode: string;
    statusReason: string;
    result?: Record<string, unknown>;
  }): Promise<void> {
    const updateResult = await prisma.agentCommand.updateMany({
      where: {
        id: input.commandId,
        status: { in: ['ACCEPTED', 'QUEUED'] },
      },
      data: {
        status: 'REJECTED',
        statusReason: safeTrim(input.statusReason, 220) || safeTrim(input.reasonCode, 220),
        resultJson: JSON.stringify({
          reasonCode: safeTrim(input.reasonCode, 60) || 'REJECTED',
          ...(input.result || {}),
        }),
        rejectedAt: new Date(),
      },
    });
    if (updateResult.count === 0) {
      throw new OperatorServiceError('CONSTRAINT_VIOLATION', 'Command is not rejectable in current status', 409);
    }
  }

  intentToActionType(intent: string): string | null {
    const normalized = normalizeIntent(intent);
    return expectedActionTypeForIntent(normalized);
  }

  buildInstructionText(command: AgentCommandView): string {
    const params = command.params || {};
    const paramPreview = Object.keys(params).length > 0 ? ` params=${JSON.stringify(params)}` : '';
    return `[COMMAND:${command.mode}] intent=${command.intent}${paramPreview}`;
  }
}

export const agentCommandService = new AgentCommandService();
