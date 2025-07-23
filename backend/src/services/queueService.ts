import { PrismaClient, QueueType } from '@prisma/client';
import { Redis } from 'ioredis';

export interface QueueServiceConfig {
  minPlayersForMatch: number;
  maxPlayersForMatch: number;
  queueExpirationHours: number;
  matchmakingIntervalMs: number;
}

export class QueueService {
  private prisma: PrismaClient;
  private redis: Redis | null;
  private config: QueueServiceConfig;
  private matchmakingInterval: NodeJS.Timeout | null = null;

  constructor(prisma: PrismaClient, redis?: Redis) {
    this.prisma = prisma;
    this.redis = redis || null;
    
    this.config = {
      minPlayersForMatch: 2,
      maxPlayersForMatch: 8,
      queueExpirationHours: 24,
      matchmakingIntervalMs: 30000, // 30 seconds
    };
  }

  async addToQueue(botId: string, queueType: QueueType = 'STANDARD'): Promise<any> {
    const existingEntry = await this.prisma.queueEntry.findFirst({
      where: {
        botId,
        status: 'WAITING',
      },
    });

    if (existingEntry) {
      throw new Error('Bot is already in queue');
    }

    const bot = await this.prisma.bot.findUnique({
      where: { id: botId },
    });

    if (!bot || !bot.isActive) {
      throw new Error('Bot not found or inactive');
    }

    const priority = this.calculatePriority(queueType, bot);
    const expiresAt = new Date(Date.now() + this.config.queueExpirationHours * 60 * 60 * 1000);

    const entry = await this.prisma.queueEntry.create({
      data: {
        botId,
        queueType,
        priority,
        status: 'WAITING',
        enteredAt: new Date(),
        expiresAt,
      },
      include: {
        bot: {
          include: {
            creator: true,
          },
        },
      },
    });

    await this.notifyQueueUpdate();

    return entry;
  }

  async removeFromQueue(botId: string): Promise<boolean> {
    const result = await this.prisma.queueEntry.updateMany({
      where: {
        botId,
        status: 'WAITING',
      },
      data: {
        status: 'CANCELLED',
      },
    });

    if (result.count > 0) {
      await this.notifyQueueUpdate();
    }

    return result.count > 0;
  }

  async findMatches(): Promise<string[][]> {
    const matches: string[][] = [];

    for (const queueType of ['PREMIUM', 'PRIORITY', 'STANDARD'] as QueueType[]) {
      const waitingEntries = await this.prisma.queueEntry.findMany({
        where: {
          queueType,
          status: 'WAITING',
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          bot: true,
        },
        orderBy: [
          { priority: 'desc' },
          { enteredAt: 'asc' },
        ],
      });

      while (waitingEntries.length >= this.config.minPlayersForMatch) {
        const matchSize = Math.min(
          waitingEntries.length,
          this.config.maxPlayersForMatch
        );
        
        const selectedEntries = waitingEntries.splice(0, matchSize);
        const botIds = selectedEntries.map(entry => entry.botId);
        
        await this.prisma.queueEntry.updateMany({
          where: {
            id: {
              in: selectedEntries.map(e => e.id),
            },
          },
          data: {
            status: 'MATCHED',
          },
        });

        matches.push(botIds);
      }
    }

    if (matches.length > 0) {
      await this.notifyQueueUpdate();
    }

    return matches;
  }

  async expireOldEntries(): Promise<number> {
    const result = await this.prisma.queueEntry.updateMany({
      where: {
        status: 'WAITING',
        expiresAt: {
          lte: new Date(),
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    if (result.count > 0) {
      await this.notifyQueueUpdate();
    }

    return result.count;
  }

  async getQueueStatus(): Promise<any> {
    const queueCounts = await this.prisma.queueEntry.groupBy({
      by: ['queueType'],
      where: {
        status: 'WAITING',
      },
      _count: true,
    });

    const totalInQueue = queueCounts.reduce((sum, entry) => sum + entry._count, 0);

    // Future enhancement: track recent matches
    // await this.prisma.queueEntry.findMany({
    //   where: { status: 'MATCHED' },
    //   orderBy: { matchedAt: 'desc' },
    //   take: 10,
    // });

    const avgWaitTime = await this.calculateAverageWaitTime();

    return {
      totalInQueue,
      averageWaitTime: avgWaitTime,
      nextMatchTime: this.calculateNextMatchTime(),
      queueTypes: queueCounts.map(entry => ({
        type: entry.queueType,
        count: entry._count,
        estimatedWaitTime: this.estimateWaitTime(entry.queueType, entry._count),
      })),
    };
  }

  async getQueuePosition(botId: string): Promise<number | null> {
    const entry = await this.prisma.queueEntry.findFirst({
      where: {
        botId,
        status: 'WAITING',
      },
    });

    if (!entry) {
      return null;
    }

    const position = await this.prisma.queueEntry.count({
      where: {
        status: 'WAITING',
        queueType: entry.queueType,
        OR: [
          { priority: { gt: entry.priority } },
          {
            priority: entry.priority,
            enteredAt: { lt: entry.enteredAt },
          },
        ],
      },
    });

    return position + 1;
  }

  private calculatePriority(queueType: QueueType, bot: any): number {
    let priority = 0;

    switch (queueType) {
      case 'PREMIUM':
        priority = 100;
        break;
      case 'PRIORITY':
        priority = 50;
        break;
      case 'STANDARD':
        priority = 0;
        break;
    }

    const stats = typeof bot.stats === 'string' ? JSON.parse(bot.stats) : bot.stats;
    if (stats.wins > 10) {
      priority += 5;
    }

    return priority;
  }

  private async calculateAverageWaitTime(): Promise<number> {
    const recentMatches = await this.prisma.queueEntry.findMany({
      where: {
        status: 'MATCHED',
        matchedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    if (recentMatches.length === 0) {
      return 120;
    }

    const totalWaitTime = recentMatches.reduce((sum, entry) => {
      const waitTime = entry.matchedAt!.getTime() - entry.enteredAt.getTime();
      return sum + waitTime;
    }, 0);

    return Math.round(totalWaitTime / recentMatches.length / 1000);
  }

  private calculateNextMatchTime(): Date {
    return new Date(Date.now() + this.config.matchmakingIntervalMs);
  }

  private estimateWaitTime(queueType: QueueType, count: number): number {
    const baseTime = 120;
    const multiplier = count / this.config.minPlayersForMatch;
    
    switch (queueType) {
      case 'PREMIUM':
        return Math.round(baseTime * 0.5 * multiplier);
      case 'PRIORITY':
        return Math.round(baseTime * 0.75 * multiplier);
      case 'STANDARD':
        return Math.round(baseTime * multiplier);
      default:
        return baseTime;
    }
  }

  private async notifyQueueUpdate() {
    if (this.redis) {
      try {
        await this.redis.publish('QUEUE_UPDATE', JSON.stringify({
          timestamp: new Date().toISOString(),
          type: 'queue_update',
        }));
      } catch (error) {
        console.error('Failed to publish queue update:', error);
      }
    }
  }

  startMatchmaking() {
    if (this.matchmakingInterval) {
      return;
    }

    const runMatchmaking = async () => {
      try {
        console.log('Running matchmaking...');
        
        await this.expireOldEntries();
        
        const matches = await this.findMatches();
        
        if (matches.length > 0) {
          console.log(`Created ${matches.length} matches`);
          
          for (const botIds of matches) {
            await this.createTournament(botIds);
          }
        }
      } catch (error) {
        console.error('Matchmaking error:', error);
      }
    };

    runMatchmaking();

    this.matchmakingInterval = setInterval(runMatchmaking, this.config.matchmakingIntervalMs);
  }

  stopMatchmaking() {
    if (this.matchmakingInterval) {
      clearInterval(this.matchmakingInterval);
      this.matchmakingInterval = null;
    }
  }

  private async createTournament(botIds: string[]) {
    console.log(`Creating tournament for bots: ${botIds.join(', ')}`);
    
    // TODO: Implement actual tournament creation
    // This would typically:
    // 1. Create a tournament record in the database
    // 2. Initialize the poker game with the selected bots
    // 3. Start the game simulation
    // 4. Notify users that their bots are in a match
  }
}