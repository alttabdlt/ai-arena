import { PrismaClient, QueueStatus, MatchStatus } from '@prisma/client';
import { logger } from '@ai-arena/shared-logger';

export class ScheduledTasksService {
  private static instance: ScheduledTasksService;
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private prisma: PrismaClient
  ) {
    // Bot deployment service removed - no longer needed
  }

  static getInstance(prisma: PrismaClient): ScheduledTasksService {
    if (!ScheduledTasksService.instance) {
      ScheduledTasksService.instance = new ScheduledTasksService(prisma);
    }
    return ScheduledTasksService.instance;
  }

  /**
   * Start all scheduled tasks
   */
  startAll(): void {
    logger.info('🕐 Starting scheduled tasks...');

    // Auto-deploy bots every 5 minutes
    this.startTask('auto-deploy-bots', 5 * 60 * 1000, async () => {
      await this.autoDeployBots();
    });

    // Sync bot stats every 2 minutes
    this.startTask('sync-bot-stats', 2 * 60 * 1000, async () => {
      await this.syncAllBotStats();
    });

    // Clean up stale data every hour
    this.startTask('cleanup-stale-data', 60 * 60 * 1000, async () => {
      await this.cleanupStaleData();
    });

    // Check metaverse health every minute
    this.startTask('health-check', 60 * 1000, async () => {
      await this.checkMetaverseHealth();
    });

    logger.info('✅ All scheduled tasks started');
  }

  /**
   * Stop all scheduled tasks
   */
  stopAll(): void {
    logger.info('🛑 Stopping scheduled tasks...');
    
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
      logger.info(`  Stopped: ${name}`);
    }
    
    this.intervals.clear();
  }

  /**
   * Start a scheduled task
   */
  private startTask(name: string, intervalMs: number, task: () => Promise<void>): void {
    // Stop existing task if it exists
    if (this.intervals.has(name)) {
      clearInterval(this.intervals.get(name)!);
    }

    // Run immediately on start
    task().catch(error => {
      logger.error(`Error in scheduled task ${name}:`, error);
    });

    // Schedule recurring execution
    const interval = setInterval(async () => {
      try {
        await task();
      } catch (error: any) {
        logger.error(`Error in scheduled task ${name}:`, error.message);
      }
    }, intervalMs);

    this.intervals.set(name, interval);
    logger.info(`  Started task: ${name} (every ${intervalMs / 1000}s)`);
  }

  /**
   * Auto-deploy undeployed bots - REMOVED: No longer needed
   */
  private async autoDeployBots(): Promise<void> {
    // Metaverse deployment removed - this task is no longer needed
    logger.debug('Auto-deploy task skipped - metaverse deployment removed');
  }

  /**
   * Sync all bot stats to metaverse - REMOVED: No longer needed
   */
  private async syncAllBotStats(): Promise<void> {
    // Metaverse sync removed - this task is no longer needed
    logger.debug('Stats sync task skipped - metaverse sync removed');
  }

  /**
   * Clean up stale data
   */
  private async cleanupStaleData(): Promise<void> {
    try {
      logger.debug('Running cleanup task...');

      // Clean up old queue entries
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const deleted = await this.prisma.queueEntry.deleteMany({
        where: {
          enteredAt: { lt: oneHourAgo },
          status: QueueStatus.MATCHED
        }
      });

      if (deleted.count > 0) {
        logger.info(`Cleaned up ${deleted.count} old queue entries`);
      }

      // Reset stuck matches
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const resetMatches = await this.prisma.match.updateMany({
        where: {
          status: 'IN_PROGRESS',
          startedAt: { lt: tenMinutesAgo }
        },
        data: {
          status: MatchStatus.COMPLETED,
          completedAt: new Date()
        }
      });

      if (resetMatches.count > 0) {
        logger.info(`Reset ${resetMatches.count} stuck matches`);
      }

      // Clear deployment errors older than 1 day from stats JSON
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const botsWithErrors = await this.prisma.bot.findMany({
        where: {
          updatedAt: { lt: oneDayAgo }
        },
        select: { id: true, stats: true }
      });

      for (const bot of botsWithErrors) {
        const stats = (bot.stats as any) || {};
        if (stats.deploymentError) {
          delete stats.deploymentError;
          await this.prisma.bot.update({
            where: { id: bot.id },
            data: { stats }
          });
        }
      }

    } catch (error: any) {
      logger.error('Cleanup failed:', error.message);
    }
  }

  /**
   * Check metaverse health
   */
  private async checkMetaverseHealth(): Promise<void> {
    try {
      const metaverseUrl = process.env.METAVERSE_BACKEND_URL || 'http://localhost:5001';
      const response = await fetch(`${metaverseUrl}/health`);
      
      if (!response.ok) {
        logger.warn('⚠️ Metaverse backend health check failed');
        
        // BotSync model removed - skip this update
        /*
        await this.prisma.botSync.updateMany({
          where: { 
            bot: {
              metaverseAgentId: { not: null }
            }
          },
          data: { syncStatus: SyncStatus.PENDING }
        });
        */
      }
    } catch (error: any) {
      logger.error('Health check failed:', error.message);
    }
  }

  /**
   * Get task status
   */
  getStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    
    for (const name of this.intervals.keys()) {
      status[name] = true;
    }
    
    return status;
  }
}