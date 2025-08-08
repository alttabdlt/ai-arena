/**
 * Production Channel Orchestrator Service
 * Manages auto-scaling, geographic distribution, and world lifecycle
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

interface ChannelConfig {
  region: string;
  maxBotsPerWorld: number;
  targetUtilization: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownMinutes: number;
}

interface WorldPool {
  deploymentId: string;
  region: string;
  totalWorlds: number;
  usedWorlds: number;
  status: 'ACTIVE' | 'SCALING' | 'DRAINING';
  convexUrl: string;
}

export class ChannelOrchestratorService extends EventEmitter {
  private prisma: PrismaClient;
  private redis: Redis;
  private worldPools: Map<string, WorldPool[]> = new Map();
  private scalingLock: Map<string, Date> = new Map();
  
  private readonly config: ChannelConfig = {
    region: process.env.AWS_REGION || 'us-west-2',
    maxBotsPerWorld: 30,
    targetUtilization: 0.7, // 70% target
    scaleUpThreshold: 0.8,  // Scale up at 80%
    scaleDownThreshold: 0.2, // Scale down at 20%
    cooldownMinutes: 5
  };

  constructor() {
    super();
    this.prisma = new PrismaClient();
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });
    
    this.initializeMonitoring();
  }

  /**
   * Initialize monitoring and auto-scaling
   */
  private initializeMonitoring() {
    // Check scaling needs every minute
    setInterval(() => this.checkScalingNeeds(), 60000);
    
    // Health check every 30 seconds
    setInterval(() => this.healthCheck(), 30000);
    
    // Emit metrics every 10 seconds
    setInterval(() => this.emitMetrics(), 10000);
  }

  /**
   * Find optimal channel for a bot based on region and load
   */
  async findOptimalChannel(
    userRegion?: string,
    personality?: string,
    preferredType?: 'MAIN' | 'VIP' | 'TOURNAMENT'
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      // Try to get from cache first
      const cacheKey = `channel:optimal:${userRegion}:${personality}:${preferredType}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        logger.info('Channel cache hit', { cacheKey, latency: Date.now() - startTime });
        return cached;
      }

      // Find best channel based on criteria
      // First get all active channels, then filter by capacity in JavaScript
      const allChannels = await this.prisma.channelMetadata.findMany({
        where: {
          status: 'ACTIVE',
          channelType: preferredType === 'TOURNAMENT' ? 'VIP' : (preferredType || 'MAIN'),
          ...(userRegion && { region: userRegion })
        }
      });
      
      // Filter channels under 80% capacity
      const channels = allChannels
        .filter(ch => ch.currentBots < ch.maxBots * 0.8)
        .sort((a, b) => {
          // Sort by currentBots ascending, then by createdAt descending
          if (a.currentBots !== b.currentBots) {
            return a.currentBots - b.currentBots;
          }
          return b.createdAt.getTime() - a.createdAt.getTime();
        })
        .slice(0, 1);

      let channelId: string;

      if (channels.length === 0) {
        // No available channels, create new one
        logger.info('No available channels, creating new one', { region: userRegion });
        channelId = await this.createNewChannel(userRegion, preferredType);
      } else {
        channelId = channels[0].channel;
      }

      // Cache for 30 seconds
      await this.redis.setex(cacheKey, 30, channelId);
      
      logger.info('Channel assigned', {
        channelId,
        region: userRegion,
        latency: Date.now() - startTime
      });
      
      return channelId;
      
    } catch (error) {
      logger.error('Failed to find optimal channel', error);
      
      // Fallback to main channel
      const fallback = await this.prisma.channelMetadata.findFirst({
        where: { channel: 'main' }
      });
      
      return fallback?.channel || 'main';
    }
  }

  /**
   * Create new channel with automatic world provisioning
   */
  private async createNewChannel(
    region?: string,
    type: 'MAIN' | 'VIP' | 'TOURNAMENT' = 'MAIN'
  ): Promise<string> {
    const channelName = this.generateChannelName(region, type);
    
    // Check if we need to provision new Convex deployment
    const pool = await this.getOrCreateWorldPool(region || this.config.region);
    
    // Find available world in pool
    const worldId = await this.allocateWorldFromPool(pool);
    
    // Map TOURNAMENT to VIP for database storage
    const dbChannelType = type === 'TOURNAMENT' ? 'VIP' : type;
    
    // Create channel metadata
    const channel = await this.prisma.channelMetadata.create({
      data: {
        channel: channelName,
        channelType: dbChannelType,
        status: 'ACTIVE',
        region: region || this.config.region,
        maxBots: this.config.maxBotsPerWorld,
        currentBots: 0,
        worldId,
        metadata: {
          poolId: pool.deploymentId,
          createdBy: 'auto-scaler',
          createdAt: new Date().toISOString()
        }
      }
    });

    // Emit event for monitoring
    this.emit('channel:created', {
      channelId: channel.channel,
      region: channel.region,
      type: channel.channelType,
      worldId
    });

    logger.info('Created new channel', {
      channel: channel.channel,
      worldId,
      pool: pool.deploymentId
    });

    return channel.channel;
  }

  /**
   * Get or create world pool for region
   */
  private async getOrCreateWorldPool(region: string): Promise<WorldPool> {
    let pools = this.worldPools.get(region);
    
    if (!pools || pools.length === 0) {
      // Provision new Convex deployment
      const newPool = await this.provisionConvexDeployment(region);
      
      if (!this.worldPools.has(region)) {
        this.worldPools.set(region, []);
      }
      
      this.worldPools.get(region)!.push(newPool);
      pools = [newPool];
    }

    // Find pool with available capacity
    const availablePool = pools.find(p => 
      p.status === 'ACTIVE' && 
      p.usedWorlds < p.totalWorlds * 0.9 // Under 90% capacity
    );

    if (!availablePool) {
      // All pools near capacity, provision new one
      const newPool = await this.provisionConvexDeployment(region);
      this.worldPools.get(region)!.push(newPool);
      return newPool;
    }

    return availablePool;
  }

  /**
   * Provision new Convex deployment
   */
  private async provisionConvexDeployment(region: string): Promise<WorldPool> {
    logger.info('Provisioning new Convex deployment', { region });
    
    // In production, this would call Convex API or Terraform
    // For now, simulate the provisioning
    const deploymentId = `convex-${region}-${Date.now()}`;
    
    const pool: WorldPool = {
      deploymentId,
      region,
      totalWorlds: 334, // Convex deployment capacity
      usedWorlds: 0,
      status: 'ACTIVE',
      convexUrl: `https://${deploymentId}.convex.cloud`
    };

    // Store in database for persistence
    await this.prisma.$executeRaw`
      INSERT INTO world_pools (deployment_id, region, total_worlds, used_worlds, status, convex_url)
      VALUES (${deploymentId}, ${region}, 334, 0, 'ACTIVE', ${pool.convexUrl})
      ON CONFLICT (deployment_id) DO NOTHING
    `;

    return pool;
  }

  /**
   * Allocate world from pool
   */
  private async allocateWorldFromPool(pool: WorldPool): Promise<string> {
    // Generate world ID (would come from Convex in production)
    const worldId = this.generateWorldId();
    
    // Update pool usage
    pool.usedWorlds++;
    
    // Update in database
    await this.prisma.$executeRaw`
      UPDATE world_pools 
      SET used_worlds = used_worlds + 1 
      WHERE deployment_id = ${pool.deploymentId}
    `;

    return worldId;
  }

  /**
   * Check if scaling is needed
   */
  private async checkScalingNeeds() {
    try {
      // Check each region
      for (const [region] of this.worldPools.entries()) {
        const utilization = await this.calculateRegionUtilization(region);
        
        // Check if we're in cooldown
        const lastScaling = this.scalingLock.get(region);
        if (lastScaling && 
            Date.now() - lastScaling.getTime() < this.config.cooldownMinutes * 60000) {
          continue;
        }

        if (utilization > this.config.scaleUpThreshold) {
          await this.scaleUp(region);
        } else if (utilization < this.config.scaleDownThreshold) {
          await this.scaleDown(region);
        }
      }
    } catch (error) {
      logger.error('Scaling check failed', error);
    }
  }

  /**
   * Calculate region utilization
   */
  private async calculateRegionUtilization(region: string): Promise<number> {
    const result = await this.prisma.channelMetadata.aggregate({
      where: { region, status: 'ACTIVE' },
      _sum: { currentBots: true, maxBots: true }
    });

    if (!result._sum.maxBots || result._sum.maxBots === 0) {
      return 0;
    }

    return (result._sum.currentBots || 0) / result._sum.maxBots;
  }

  /**
   * Scale up region capacity
   */
  private async scaleUp(region: string) {
    logger.info('Scaling up region', { region });
    
    // Create new channels preemptively
    const newChannels = 10; // Create 10 new channels
    
    for (let i = 0; i < newChannels; i++) {
      await this.createNewChannel(region, 'MAIN');
    }

    this.scalingLock.set(region, new Date());
    
    this.emit('scaling:up', { region, channels: newChannels });
  }

  /**
   * Scale down region capacity
   */
  private async scaleDown(region: string) {
    logger.info('Scaling down region', { region });
    
    // Mark empty channels for drainage
    await this.prisma.channelMetadata.updateMany({
      where: {
        region,
        currentBots: 0,
        status: 'ACTIVE',
        channelType: { not: 'MAIN' } // Don't drain main channel
      },
      data: {
        status: 'DRAINING'
      }
    });

    this.scalingLock.set(region, new Date());
    
    this.emit('scaling:down', { region });
  }

  /**
   * Health check for all pools
   */
  private async healthCheck() {
    for (const [region, pools] of this.worldPools.entries()) {
      for (const pool of pools) {
        try {
          // Check Convex deployment health
          // In production, would ping actual Convex API
          const isHealthy = await this.checkConvexHealth(pool.convexUrl);
          
          if (!isHealthy && pool.status === 'ACTIVE') {
            pool.status = 'DRAINING';
            logger.error('Convex deployment unhealthy', { 
              pool: pool.deploymentId,
              region 
            });
            
            this.emit('pool:unhealthy', { pool: pool.deploymentId, region });
          }
        } catch (error) {
          logger.error('Health check failed', { pool: pool.deploymentId, error });
        }
      }
    }
  }

  /**
   * Check Convex deployment health
   */
  private async checkConvexHealth(_convexUrl: string): Promise<boolean> {
    // In production, would make actual health check request using convexUrl
    // For now, simulate random health
    return Math.random() > 0.05; // 95% healthy
  }

  /**
   * Emit metrics for monitoring
   */
  private async emitMetrics() {
    const metrics = await this.gatherMetrics();
    this.emit('metrics', metrics);
    
    // Also push to Redis for Grafana
    await this.redis.setex('metrics:channels', 60, JSON.stringify(metrics));
  }

  /**
   * Gather system metrics
   */
  private async gatherMetrics() {
    const channels = await this.prisma.channelMetadata.findMany({
      where: { status: 'ACTIVE' }
    });

    const totalCapacity = channels.reduce((sum, c) => sum + c.maxBots, 0);
    const currentLoad = channels.reduce((sum, c) => sum + c.currentBots, 0);
    
    const poolStats = Array.from(this.worldPools.entries()).map(([region, pools]) => ({
      region,
      pools: pools.length,
      totalWorlds: pools.reduce((sum, p) => sum + p.totalWorlds, 0),
      usedWorlds: pools.reduce((sum, p) => sum + p.usedWorlds, 0)
    }));

    return {
      timestamp: new Date(),
      channels: {
        total: channels.length,
        active: channels.filter(c => c.currentBots > 0).length,
        capacity: totalCapacity,
        load: currentLoad,
        utilization: totalCapacity > 0 ? currentLoad / totalCapacity : 0
      },
      pools: poolStats,
      regions: Array.from(this.worldPools.keys())
    };
  }

  /**
   * Generate channel name
   */
  private generateChannelName(region?: string, type?: string): string {
    const prefix = region ? region.split('-')[0] : 'global';
    const typePrefix = type === 'VIP' ? 'vip' : type === 'TOURNAMENT' ? 'tour' : 'main';
    const timestamp = Date.now().toString(36);
    return `${prefix}-${typePrefix}-${timestamp}`;
  }

  /**
   * Generate world ID (simulated)
   */
  private generateWorldId(): string {
    // In production, would get from Convex
    return 'm' + Array.from({ length: 31 }, () => 
      Math.floor(Math.random() * 36).toString(36)
    ).join('');
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('Shutting down Channel Orchestrator');
    
    // Clear intervals
    this.removeAllListeners();
    
    // Close connections
    await this.redis.quit();
    await this.prisma.$disconnect();
  }
}

// Export singleton instance
export const channelOrchestrator = new ChannelOrchestratorService();