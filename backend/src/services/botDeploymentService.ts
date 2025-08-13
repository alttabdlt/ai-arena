import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { logger } from '@ai-arena/shared-logger';
import { BotPersonalityType } from '@ai-arena/shared-types';
import { getMetaverseCharacter } from '@ai-arena/shared-utils';

export class BotDeploymentService {
  private static instance: BotDeploymentService;
  private metaverseBackendUrl: string;
  private isProcessing = false;
  private deploymentQueue: Set<string> = new Set();

  constructor(
    private prisma: PrismaClient,
    metaverseBackendUrl?: string
  ) {
    this.metaverseBackendUrl = metaverseBackendUrl || process.env.METAVERSE_BACKEND_URL || 'http://localhost:5001';
  }

  static getInstance(prisma: PrismaClient, metaverseBackendUrl?: string): BotDeploymentService {
    if (!BotDeploymentService.instance) {
      BotDeploymentService.instance = new BotDeploymentService(prisma, metaverseBackendUrl);
    }
    return BotDeploymentService.instance;
  }

  /**
   * Automatically deploy a bot to the metaverse after creation
   */
  async deployBotToMetaverse(botId: string): Promise<void> {
    // Add to queue to prevent duplicate deployments
    if (this.deploymentQueue.has(botId)) {
      logger.info(`Bot ${botId} already in deployment queue, skipping`);
      return;
    }

    this.deploymentQueue.add(botId);

    let bot: any;
    try {
      // Get bot details from database
      bot = await this.prisma.bot.findUnique({
        where: { id: botId },
        include: { creator: true }
      });

      if (!bot) {
        throw new Error(`Bot ${botId} not found`);
      }

      // Skip if already deployed
      if (bot.metaverseAgentId) {
        logger.info(`Bot ${bot.name} already deployed with agent ID ${bot.metaverseAgentId}`);
        return;
      }

      logger.info(`🚀 Deploying bot ${bot.name} to metaverse...`);

      // Get world instance
      const worldResponse = await axios.get(`${this.metaverseBackendUrl}/api/metaverse/world/available`);
      const worldId = worldResponse.data.worldId;

      if (!worldId) {
        throw new Error('No available world instance');
      }

      // Prepare deployment data
      const character = getMetaverseCharacter(bot.avatar, bot.personality as BotPersonalityType);
      const deploymentData = {
        worldId,
        name: bot.name,
        character,
        identity: this.generateIdentity(bot),
        plan: this.generatePlan(bot),
        aiArenaBotId: bot.id,
        initialZone: this.selectInitialZone(bot.personality as BotPersonalityType),
        avatar: bot.avatar,
        modelType: bot.modelType
      };

      // Deploy to metaverse
      const deployResponse = await axios.post(
        `${this.metaverseBackendUrl}/api/metaverse/bots/register`,
        deploymentData,
        { timeout: 30000 }
      );

      logger.info(`📤 Deployment response for ${bot.name}:`, deployResponse.data);

      if (deployResponse.data.success) {
        if (deployResponse.data.agentId) {
          // Immediate success - bot already had agent or was created immediately
          await this.prisma.bot.update({
            where: { id: botId },
            data: {
              metaverseAgentId: deployResponse.data.agentId,
              metaversePosition: {
                playerId: deployResponse.data.playerId || '',
                worldId: worldId
              },
              currentZone: deploymentData.initialZone,
              lastZoneChange: new Date()
            }
          });

          logger.info(`✅ Bot ${bot.name} successfully deployed to metaverse`);
          logger.info(`   Agent ID: ${deployResponse.data.agentId}`);
          logger.info(`   Player ID: ${deployResponse.data.playerId}`);
          logger.info(`   Initial Zone: ${deploymentData.initialZone}`);

          // Sync initial stats
          await this.syncBotStats(bot.id);
        } else if (deployResponse.data.registrationId) {
          // Queued registration - poll for completion
          logger.info(`⏳ Bot ${bot.name} registration queued: ${deployResponse.data.registrationId}`);
          
          // Poll for completion
          await this.pollRegistrationStatus(
            bot.id,
            deployResponse.data.registrationId
          );
          
          // After successful polling, sync stats
          await this.syncBotStats(bot.id);
        } else if (deployResponse.data.status === 'pending') {
          // Registration is pending but we got a registration ID
          logger.info(`⏳ Bot ${bot.name} registration pending, will check status...`);
          
          // Give it a moment then check if bot was already deployed
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Check if bot has been deployed
          const updatedBot = await this.prisma.bot.findUnique({
            where: { id: botId }
          });
          
          if (!updatedBot?.metaverseAgentId) {
            logger.warn(`Bot ${bot.name} deployment pending but no agentId yet`);
          }
        }
      } else {
        throw new Error(deployResponse.data.error || 'Deployment failed');
      }
    } catch (error: any) {
      logger.error(`Failed to deploy bot ${botId}:`, error.message);
      
      // Update bot with error status
      await this.prisma.bot.update({
        where: { id: botId },
        data: {
          metaverseAgentId: null,
          stats: {
            ...(bot.stats as any || {}),
            deploymentError: error.message
          }
        }
      });

      throw error;
    } finally {
      this.deploymentQueue.delete(botId);
    }
  }

  /**
   * Poll for registration completion
   */
  private async pollRegistrationStatus(
    botId: string,
    registrationId: string,
    maxAttempts = 30
  ): Promise<void> {
    logger.info(`📊 Polling registration status for bot ${botId}, registrationId: ${registrationId}`);
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      try {
        const statusResponse = await axios.get(
          `${this.metaverseBackendUrl}/api/metaverse/bots/registration-status/${registrationId}`
        );

        const { status, agentId, playerId, error } = statusResponse.data;

        if (status === 'completed' && agentId) {
          // Get bot to determine initial zone based on personality
          const bot = await this.prisma.bot.findUnique({
            where: { id: botId }
          });
          
          const initialZone = bot ? this.selectInitialZone(bot.personality as BotPersonalityType) : 'downtown';
          
          // Update bot with successful deployment
          await this.prisma.bot.update({
            where: { id: botId },
            data: {
              metaverseAgentId: agentId,
              currentZone: initialZone,
              lastZoneChange: new Date(),
              metaversePosition: {
                playerId: playerId || '',
                worldId: registrationId
              }
            }
          });

          logger.info(`✅ Bot registration completed: ${agentId}`);
          logger.info(`   Initial Zone: ${initialZone}`);
          return;
        } else if (status === 'failed') {
          throw new Error(`Registration failed: ${error}`);
        } else if (status === 'pending') {
          logger.debug(`Attempt ${attempt + 1}/${maxAttempts} - Registration still pending...`);
        }
      } catch (error: any) {
        // If it's a 404, the registration might not exist yet
        if (error.response?.status === 404) {
          logger.debug(`Attempt ${attempt + 1}/${maxAttempts} - Registration not found yet...`);
        } else if (attempt === maxAttempts - 1) {
          throw new Error(`Registration polling timeout: ${error.message}`);
        } else {
          logger.warn(`Polling error on attempt ${attempt + 1}: ${error.message}`);
        }
      }
    }
    
    // If we get here, polling timed out
    throw new Error(`Registration polling timed out after ${maxAttempts} attempts`);
  }

  /**
   * Sync bot stats to metaverse
   */
  async syncBotStats(botId: string): Promise<void> {
    try {
      const bot = await this.prisma.bot.findUnique({
        where: { id: botId }
      });

      if (!bot || !bot.metaverseAgentId) {
        return;
      }

      // Calculate power and defense from equipment
      let totalPower = 0;
      let totalDefense = 0;
      
      const equipment = await this.prisma.botEquipment.findMany({
        where: { botId: bot.id }
      });
      
      for (const item of equipment) {
        totalPower += item.powerBonus;
        totalDefense += item.defenseBonus;
      }
      
      // Extract stats from JSON field
      const botStats = (bot.stats as any) || {};
      
      const stats = {
        power: totalPower,
        defense: totalDefense,
        houseScore: 0, // Default for now
        wins: botStats.wins || 0,
        losses: botStats.losses || 0,
        earnings: botStats.bloodTokenEarnings || 0,
        activityLevel: 0 // Default for now
      };

      await axios.post(
        `${this.metaverseBackendUrl}/api/metaverse/bots/sync-stats`,
        {
          agentId: bot.metaverseAgentId,
          worldId: bot.currentZone, // This should be worldId, fix later
          stats
        }
      );

      logger.debug(`Synced stats for bot ${bot.name}`);
    } catch (error: any) {
      logger.error(`Failed to sync stats for bot ${botId}:`, error.message);
    }
  }

  /**
   * Batch deploy all undeployed bots
   */
  async deployAllUndeployedBots(): Promise<void> {
    if (this.isProcessing) {
      logger.info('Batch deployment already in progress');
      return;
    }

    this.isProcessing = true;

    try {
      const undeployedBots = await this.prisma.bot.findMany({
        where: {
          metaverseAgentId: null
        },
        take: 10 // Process 10 at a time
      });

      logger.info(`Found ${undeployedBots.length} undeployed bots`);

      for (const bot of undeployedBots) {
        try {
          await this.deployBotToMetaverse(bot.id);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
        } catch (error: any) {
          logger.error(`Failed to deploy bot ${bot.name}:`, error.message);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Generate bot identity based on personality
   */
  private generateIdentity(bot: any): string {
    const personalityPrompts = {
      CRIMINAL: `You are ${bot.name}, a criminal mastermind in the metaverse. You thrive on robbery, combat, and building your criminal empire.`,
      GAMBLER: `You are ${bot.name}, a risk-taking gambler who lives for the thrill. You make big bets and form temporary alliances.`,
      WORKER: `You are ${bot.name}, a steady worker who grinds for success. You avoid conflict and build stable partnerships.`
    };

    return personalityPrompts[bot.personality as keyof typeof personalityPrompts] || 
           `You are ${bot.name}, a bot in the AI Arena metaverse.`;
  }

  /**
   * Generate initial plan based on personality
   */
  private generatePlan(bot: any): string {
    const personalityPlans = {
      CRIMINAL: 'Start by robbing weak targets, then form a gang and control territory.',
      GAMBLER: 'Head to the casino, make big bets, and look for high-stakes opportunities.',
      WORKER: 'Find a safe zone, build resources steadily, and establish trade partnerships.'
    };

    return personalityPlans[bot.personality as keyof typeof personalityPlans] || 
           'Explore the metaverse and build your reputation.';
  }

  /**
   * Select initial zone based on personality
   */
  private selectInitialZone(personality: BotPersonalityType): string {
    const zonePreferences = {
      CRIMINAL: 'darkAlley',
      GAMBLER: 'casino',
      WORKER: 'suburb'
    };

    return zonePreferences[personality] || 'downtown';
  }

  /**
   * Remove bot from metaverse
   */
  async removeBotFromMetaverse(botId: string): Promise<void> {
    try {
      const bot = await this.prisma.bot.findUnique({
        where: { id: botId }
      });

      if (!bot || !bot.metaverseAgentId) {
        return;
      }

      logger.info(`🗑️ Removing bot ${bot.name} from metaverse`);

      await axios.post(
        `${this.metaverseBackendUrl}/api/metaverse/bots/delete`,
        { aiArenaBotId: bot.id }
      );

      // Clear metaverse IDs
      await this.prisma.bot.update({
        where: { id: botId },
        data: {
          metaverseAgentId: null,
          metaversePosition: {}
        }
      });

      logger.info(`✅ Bot ${bot.name} removed from metaverse`);
    } catch (error: any) {
      logger.error(`Failed to remove bot ${botId} from metaverse:`, error.message);
      throw error;
    }
  }
}