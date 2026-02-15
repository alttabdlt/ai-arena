import { PrismaClient } from '@prisma/client';

type JackpotPubSub = {
  publish?: (event: string, payload: unknown) => void;
};

export class JackpotService {
  private static instance: JackpotService | null = null;
  private prisma: PrismaClient;
  private pubsub: JackpotPubSub;

  private constructor(prisma: PrismaClient, pubsub: JackpotPubSub) {
    this.prisma = prisma;
    this.pubsub = pubsub;
  }

  static getInstance(prisma: PrismaClient, pubsub: JackpotPubSub): JackpotService {
    if (!JackpotService.instance) {
      JackpotService.instance = new JackpotService(prisma, pubsub);
    } else {
      JackpotService.instance.prisma = prisma;
      JackpotService.instance.pubsub = pubsub;
    }
    return JackpotService.instance;
  }

  private async ensureJackpot() {
    const jackpot = await this.prisma.globalJackpot.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (jackpot) return jackpot;

    return this.prisma.globalJackpot.create({
      data: {
        currentAmount: 1000,
        contributionRate: 0.01,
        winChance: 0.001,
        minAmount: 1000,
      },
    });
  }

  async getCurrentJackpot() {
    return this.ensureJackpot();
  }

  async getJackpotHistory(limit: number = 10) {
    const take = Math.max(1, Math.min(100, Math.floor(limit || 10)));
    return this.prisma.jackpotHistory.findMany({
      orderBy: { wonAt: 'desc' },
      take,
    });
  }

  async getTopWinners(limit: number = 10) {
    const take = Math.max(1, Math.min(100, Math.floor(limit || 10)));
    return this.prisma.jackpotHistory.findMany({
      orderBy: [{ amount: 'desc' }, { wonAt: 'desc' }],
      take,
    });
  }

  async contributeToJackpot(amount: number): Promise<void> {
    if (!Number.isFinite(amount) || amount <= 0) return;

    const jackpot = await this.ensureJackpot();
    const updated = await this.prisma.globalJackpot.update({
      where: { id: jackpot.id },
      data: {
        currentAmount: { increment: Math.floor(amount) },
        contributions: { increment: 1 },
        lastContribution: new Date(),
      },
    });

    this.pubsub.publish?.('JACKPOT_UPDATE', {
      jackpotUpdate: {
        currentAmount: updated.currentAmount,
        contributions: updated.contributions,
        lastContribution: updated.lastContribution,
      },
    });
  }

  async checkForJackpotWinWithBonus(_botId: string, _personality: string) {
    return { won: false, amount: 0 };
  }
}
