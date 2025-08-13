import * as cron from 'node-cron';
import { energyService } from './energyService';
import { simpleLogger as logger } from '@ai-arena/shared-logger';

export class EnergyScheduler {
  private task: cron.ScheduledTask | null = null;

  /**
   * Start the energy consumption scheduler
   * Runs every hour to process energy consumption for all active bots
   */
  start(): void {
    // Run every hour at minute 0
    this.task = cron.schedule('0 * * * *', async () => {
      logger.info('Starting hourly energy consumption processing...');
      
      try {
        await energyService.processAllBotsEnergyConsumption();
        logger.info('Hourly energy consumption processing completed');
      } catch (error) {
        logger.error('Error during energy consumption processing:', error);
      }
    });

    logger.info('Energy scheduler started - will run every hour');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      logger.info('Energy scheduler stopped');
    }
  }

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean {
    return this.task !== null;
  }

  /**
   * Manually trigger energy consumption (for testing)
   */
  async triggerManually(): Promise<void> {
    logger.info('Manually triggering energy consumption...');
    await energyService.processAllBotsEnergyConsumption();
  }
}

export const energyScheduler = new EnergyScheduler();