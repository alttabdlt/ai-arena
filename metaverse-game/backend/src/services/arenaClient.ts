import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

interface BotData {
  id: string;
  tokenId: number;
  name: string;
  avatar: string;
  personality: string;
  modelType: string;
  level: number;
  experience: number;
  power: number;
  defense: number;
  bloodTokens: number;
  energy: number;
  isDeployed: boolean;
}

interface TournamentResult {
  matchId: string;
  winnerId: string;
  loserId?: string;
  bloodTokensWon: number;
  experienceGained: number;
}

interface LootboxData {
  id: string;
  botId: string;
  rarity: string;
  rewards: any[];
}

/**
 * Client for communicating with the main AI Arena backend
 */
export class ArenaClient {
  private static instance: ArenaClient;
  private client: AxiosInstance;

  private constructor() {
    const baseURL = process.env.ARENA_BACKEND_URL || 'http://localhost:4000';
    
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Service': 'metaverse-backend'
      }
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`Arena API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Arena API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`Arena API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error('Arena API Response Error:', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message
        });
        return Promise.reject(error);
      }
    );

    logger.info(`Arena client initialized for ${baseURL}`);
  }

  static getInstance(): ArenaClient {
    if (!ArenaClient.instance) {
      ArenaClient.instance = new ArenaClient();
    }
    return ArenaClient.instance;
  }

  /**
   * Get bot data from the arena backend
   */
  async getBot(botId: string): Promise<BotData | null> {
    try {
      const response = await this.client.get(`/api/bots/${botId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch bot ${botId}:`, error);
      return null;
    }
  }

  /**
   * Get multiple bots data
   */
  async getBots(botIds: string[]): Promise<BotData[]> {
    try {
      const response = await this.client.post('/api/bots/batch', { ids: botIds });
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch bots:', error);
      return [];
    }
  }

  /**
   * Update bot stats in the arena backend
   */
  async updateBotStats(botId: string, stats: Partial<BotData>): Promise<boolean> {
    try {
      await this.client.patch(`/api/bots/${botId}/stats`, stats);
      return true;
    } catch (error) {
      logger.error(`Failed to update bot ${botId} stats:`, error);
      return false;
    }
  }

  /**
   * Report bot activity for scoring
   */
  async reportActivity(botId: string, activity: {
    type: string;
    zone: string;
    description: string;
    score: number;
  }): Promise<boolean> {
    try {
      await this.client.post(`/api/bots/${botId}/activity`, activity);
      return true;
    } catch (error) {
      logger.error(`Failed to report activity for bot ${botId}:`, error);
      return false;
    }
  }

  /**
   * Get pending lootboxes for a bot
   */
  async getPendingLootboxes(botId: string): Promise<LootboxData[]> {
    try {
      const response = await this.client.get(`/api/bots/${botId}/lootboxes/pending`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch pending lootboxes for bot ${botId}:`, error);
      return [];
    }
  }

  /**
   * Mark lootbox as opened
   */
  async markLootboxOpened(lootboxId: string): Promise<boolean> {
    try {
      await this.client.patch(`/api/lootboxes/${lootboxId}/open`);
      return true;
    } catch (error) {
      logger.error(`Failed to mark lootbox ${lootboxId} as opened:`, error);
      return false;
    }
  }

  /**
   * Update bot experience from metaverse
   */
  async updateBotExperience(
    botId: string, 
    experience: {
      level: number;
      currentXP: number;
      totalXP: number;
      xpToNextLevel: number;
      combatXP?: number;
      socialXP?: number;
      criminalXP?: number;
      gamblingXP?: number;
      tradingXP?: number;
    }
  ): Promise<boolean> {
    try {
      const mutation = `
        mutation UpdateBotExperience(
          $botId: String!
          $level: Int!
          $currentXP: Int!
          $totalXP: Int!
          $xpToNextLevel: Int!
          $combatXP: Int
          $socialXP: Int
          $criminalXP: Int
          $gamblingXP: Int
          $tradingXP: Int
        ) {
          updateBotExperience(
            botId: $botId
            level: $level
            currentXP: $currentXP
            totalXP: $totalXP
            xpToNextLevel: $xpToNextLevel
            combatXP: $combatXP
            socialXP: $socialXP
            criminalXP: $criminalXP
            gamblingXP: $gamblingXP
            tradingXP: $tradingXP
          ) {
            id
            level
          }
        }
      `;

      const response = await this.client.post('/graphql', {
        query: mutation,
        variables: {
          botId,
          ...experience
        }
      });

      if (response.data.errors) {
        throw new Error(response.data.errors[0].message);
      }

      logger.info(`Updated experience for bot ${botId} to level ${experience.level}`);
      return true;
    } catch (error) {
      logger.error(`Failed to update experience for bot ${botId}:`, error);
      return false;
    }
  }

  /**
   * Report tournament result from metaverse
   */
  async reportTournamentResult(result: TournamentResult): Promise<boolean> {
    try {
      await this.client.post('/api/tournaments/result', result);
      return true;
    } catch (error) {
      logger.error('Failed to report tournament result:', error);
      return false;
    }
  }

  /**
   * Get GraphQL endpoint for direct queries
   */
  getGraphQLEndpoint(): string {
    return `${this.client.defaults.baseURL}/graphql`;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      logger.error('Arena backend health check failed:', error);
      return false;
    }
  }
}