import { AgentCommandMode, OperatorLinkRole, Prisma, TelegramVerificationState } from '@prisma/client';
import { randomBytes } from 'crypto';
import { prisma } from '../config/database';
import { OperatorServiceError } from './operatorServiceError';

type LinkChallenge = {
  challengeId: string;
  telegramUserId: string;
  walletAddress: string;
  expiresAtMs: number;
};

export type OperatorProfile = {
  telegramUserId: string;
  username: string | null;
  linkedWalletAddress: string | null;
  verificationState: TelegramVerificationState;
  links: Array<{
    agentId: string;
    agentName: string;
    walletAddress: string;
    role: OperatorLinkRole;
    isActive: boolean;
  }>;
};

function normalizeTelegramUserId(raw: unknown): string {
  const value = String(raw || '').trim();
  if (!value) {
    throw new OperatorServiceError('UNVERIFIED_IDENTITY', 'telegramUserId is required', 401);
  }
  if (!/^\d+$/.test(value)) {
    throw new OperatorServiceError('INVALID_TELEGRAM_USER', 'telegramUserId must be numeric', 400);
  }
  return value;
}

function normalizeUsername(raw: unknown): string | null {
  const value = String(raw || '').trim();
  return value ? value.slice(0, 64) : null;
}

function normalizeWalletAddress(raw: unknown): string {
  const value = String(raw || '').trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(value)) {
    throw new OperatorServiceError('INVALID_WALLET', 'walletAddress must be a valid EVM address', 400);
  }
  return value;
}

function roleAllowedForMode(role: OperatorLinkRole, mode: AgentCommandMode): boolean {
  if (mode === 'OVERRIDE') return role === 'OWNER';
  if (mode === 'STRONG') return role === 'OWNER' || role === 'DELEGATE';
  return true;
}

export class OperatorIdentityService {
  private readonly linkChallengeTtlMs: number;
  private readonly pendingLinkChallenges: Map<string, LinkChallenge>;

  constructor() {
    this.linkChallengeTtlMs = Number.parseInt(process.env.OPERATOR_LINK_TTL_MS || '600000', 10);
    this.pendingLinkChallenges = new Map<string, LinkChallenge>();
  }

  private cleanupExpiredChallenges(nowMs: number): void {
    for (const [challengeId, challenge] of this.pendingLinkChallenges.entries()) {
      if (challenge.expiresAtMs <= nowMs) {
        this.pendingLinkChallenges.delete(challengeId);
      }
    }
  }

  async upsertIdentity(input: {
    telegramUserId: string;
    username?: string | null;
    linkedWalletAddress?: string | null;
    verificationState?: TelegramVerificationState;
  }) {
    const telegramUserId = normalizeTelegramUserId(input.telegramUserId);
    const username = normalizeUsername(input.username);
    const linkedWalletAddress =
      input.linkedWalletAddress == null ? undefined : normalizeWalletAddress(input.linkedWalletAddress);
    const verificationState = input.verificationState;

    const updateData: Prisma.TelegramIdentityUpdateInput = {};
    if (username !== null) updateData.username = username;
    if (linkedWalletAddress !== undefined) updateData.linkedWalletAddress = linkedWalletAddress;
    if (verificationState) updateData.verificationState = verificationState;

    return prisma.telegramIdentity.upsert({
      where: { telegramUserId },
      update: updateData,
      create: {
        telegramUserId,
        username,
        linkedWalletAddress: linkedWalletAddress || null,
        verificationState: verificationState || 'UNVERIFIED',
      },
    });
  }

  async requestLink(input: { telegramUserId: string; username?: string | null; walletAddress: string }) {
    const telegramUserId = normalizeTelegramUserId(input.telegramUserId);
    const username = normalizeUsername(input.username);
    const walletAddress = normalizeWalletAddress(input.walletAddress);
    const nowMs = Date.now();
    this.cleanupExpiredChallenges(nowMs);

    await this.upsertIdentity({
      telegramUserId,
      username,
      linkedWalletAddress: walletAddress,
      verificationState: 'PENDING',
    });

    const challengeId = randomBytes(16).toString('hex');
    const challenge: LinkChallenge = {
      challengeId,
      telegramUserId,
      walletAddress,
      expiresAtMs: nowMs + this.linkChallengeTtlMs,
    };
    this.pendingLinkChallenges.set(challengeId, challenge);

    return {
      challengeId,
      walletAddress,
      expiresAt: new Date(challenge.expiresAtMs).toISOString(),
    };
  }

  private async findAgentByWallet(walletAddress: string) {
    const all = await prisma.arenaAgent.findMany({
      where: { NOT: { walletAddress: null } },
      select: { id: true, name: true, walletAddress: true },
    });
    return all.find((candidate) => candidate.walletAddress?.toLowerCase() === walletAddress) || null;
  }

  async confirmLink(input: { challengeId: string; telegramUserId: string; walletAddress: string }) {
    const challengeId = String(input.challengeId || '').trim();
    const telegramUserId = normalizeTelegramUserId(input.telegramUserId);
    const walletAddress = normalizeWalletAddress(input.walletAddress);
    const nowMs = Date.now();
    this.cleanupExpiredChallenges(nowMs);

    if (!challengeId) {
      throw new OperatorServiceError('INVALID_CHALLENGE', 'challengeId is required', 400);
    }
    const challenge = this.pendingLinkChallenges.get(challengeId);
    if (!challenge) {
      throw new OperatorServiceError('INVALID_CHALLENGE', 'Unknown or expired link challenge', 400);
    }
    if (challenge.expiresAtMs <= nowMs) {
      this.pendingLinkChallenges.delete(challengeId);
      throw new OperatorServiceError('INVALID_CHALLENGE', 'Link challenge expired', 400);
    }
    if (challenge.telegramUserId !== telegramUserId || challenge.walletAddress !== walletAddress) {
      throw new OperatorServiceError('INVALID_CHALLENGE', 'Challenge does not match provided identity', 400);
    }

    const identity = await this.upsertIdentity({
      telegramUserId,
      linkedWalletAddress: walletAddress,
      verificationState: 'VERIFIED',
    });

    const linkedAgent = await this.findAgentByWallet(walletAddress);
    if (linkedAgent) {
      await prisma.$transaction(async (tx) => {
        await tx.agentOperatorLink.updateMany({
          where: { agentId: linkedAgent.id, role: 'OWNER', isActive: true },
          data: { isActive: false },
        });

        await tx.agentOperatorLink.upsert({
          where: {
            agentId_telegramIdentityId_role: {
              agentId: linkedAgent.id,
              telegramIdentityId: identity.id,
              role: 'OWNER',
            },
          },
          update: {
            walletAddress,
            isActive: true,
          },
          create: {
            agentId: linkedAgent.id,
            walletAddress,
            telegramIdentityId: identity.id,
            role: 'OWNER',
            isActive: true,
          },
        });
      });
    }

    this.pendingLinkChallenges.delete(challengeId);

    return {
      identity: {
        telegramUserId: identity.telegramUserId,
        username: identity.username,
        linkedWalletAddress: identity.linkedWalletAddress,
        verificationState: identity.verificationState,
      },
      linkedAgent: linkedAgent
        ? {
            id: linkedAgent.id,
            name: linkedAgent.name,
            walletAddress: linkedAgent.walletAddress,
          }
        : null,
    };
  }

  async getIdentityByTelegramUserId(telegramUserIdRaw: string, requireVerified = false) {
    const telegramUserId = normalizeTelegramUserId(telegramUserIdRaw);
    const identity = await prisma.telegramIdentity.findUnique({ where: { telegramUserId } });
    if (!identity) {
      throw new OperatorServiceError('UNVERIFIED_IDENTITY', 'Telegram identity is not linked', 401);
    }
    if (requireVerified && identity.verificationState !== 'VERIFIED') {
      throw new OperatorServiceError('UNVERIFIED_IDENTITY', 'Telegram identity is not verified', 401);
    }
    return identity;
  }

  async getOperatorProfile(telegramUserIdRaw: string): Promise<OperatorProfile> {
    const telegramUserId = normalizeTelegramUserId(telegramUserIdRaw);
    const identity = await prisma.telegramIdentity.findUnique({
      where: { telegramUserId },
      include: {
        operatorLinks: {
          include: {
            agent: { select: { id: true, name: true } },
          },
          orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });
    if (!identity) {
      throw new OperatorServiceError('UNVERIFIED_IDENTITY', 'Telegram identity is not linked', 401);
    }

    return {
      telegramUserId: identity.telegramUserId,
      username: identity.username,
      linkedWalletAddress: identity.linkedWalletAddress,
      verificationState: identity.verificationState,
      links: identity.operatorLinks.map((link) => ({
        agentId: link.agent.id,
        agentName: link.agent.name,
        walletAddress: link.walletAddress,
        role: link.role,
        isActive: link.isActive,
      })),
    };
  }

  async assertCommandAuthority(input: {
    telegramUserId: string;
    agentId: string;
    mode: AgentCommandMode;
  }) {
    if (input.mode === 'SUGGEST') return;

    const identity = await this.getIdentityByTelegramUserId(input.telegramUserId, true);
    const links = await prisma.agentOperatorLink.findMany({
      where: {
        telegramIdentityId: identity.id,
        agentId: input.agentId,
        isActive: true,
      },
      select: { role: true },
    });

    const authorized = links.some((link) => roleAllowedForMode(link.role, input.mode));
    if (!authorized) {
      throw new OperatorServiceError('NOT_OWNER', 'Not authorized for this command mode on the target agent', 403);
    }
  }
}

export const operatorIdentityService = new OperatorIdentityService();
