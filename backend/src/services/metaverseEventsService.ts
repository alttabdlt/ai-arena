import { Redis } from 'ioredis';

export class MetaverseEventsService {
  private publisher: Redis;
  private static instance: MetaverseEventsService;

  private constructor() {
    this.publisher = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    console.log('🌐 Metaverse events service initialized');
  }

  static getInstance(): MetaverseEventsService {
    if (!MetaverseEventsService.instance) {
      MetaverseEventsService.instance = new MetaverseEventsService();
    }
    return MetaverseEventsService.instance;
  }

  // Publish bot position update
  async publishBotPositionUpdate(botId: string, position: { x: number; y: number }, zone: string, worldInstanceId: string) {
    const event = {
      botId,
      position,
      zone,
      worldInstanceId,
      timestamp: new Date().toISOString(),
    };

    await this.publisher.publish(`metaverse:bot:${botId}`, JSON.stringify(event));
    console.log(`📍 Published bot position update for ${botId}`);
  }

  // Publish zone transition
  async publishZoneTransition(botId: string, fromZone: string, toZone: string) {
    const event = {
      botId,
      fromZone,
      toZone,
      timestamp: new Date().toISOString(),
    };

    await this.publisher.publish(`metaverse:zone:${toZone}`, JSON.stringify(event));
    await this.publisher.publish(`metaverse:zone:${fromZone}`, JSON.stringify(event));
    console.log(`🚪 Published zone transition for ${botId}: ${fromZone} → ${toZone}`);
  }

  // Publish bot activity (crimes, trades, etc.)
  async publishBotActivity(activityType: string, data: any) {
    const event = {
      type: activityType,
      data,
      timestamp: new Date().toISOString(),
    };

    await this.publisher.publish(`metaverse:activity:${activityType}`, JSON.stringify(event));
    console.log(`🎭 Published ${activityType} activity`);
  }

  // Publish bot registration in metaverse
  async publishBotRegistration(botId: string, agentId: string, zone: string) {
    const event = {
      botId,
      agentId,
      zone,
      timestamp: new Date().toISOString(),
    };

    await this.publisher.publish(`metaverse:bot:${botId}`, JSON.stringify({
      type: 'REGISTERED',
      ...event,
    }));
    console.log(`🤖 Published bot registration for ${botId}`);
  }

  // Publish bot stats sync
  async publishBotStatsSync(botId: string, stats: any) {
    const event = {
      botId,
      stats,
      timestamp: new Date().toISOString(),
    };

    await this.publisher.publish(`metaverse:bot:${botId}`, JSON.stringify({
      type: 'STATS_UPDATED',
      ...event,
    }));
    console.log(`📊 Published bot stats sync for ${botId}`);
  }

  // Subscribe to metaverse events from Convex (for bi-directional sync)
  async subscribeToConvexEvents() {
    // This would be implemented when we have a WebSocket connection to Convex
    // or when Convex provides webhooks for real-time events
    console.log('📡 Ready to subscribe to Convex events (implementation pending)');
  }

  // Cleanup
  async disconnect() {
    await this.publisher.disconnect();
  }
}

// Export singleton instance
export const metaverseEventsService = MetaverseEventsService.getInstance();