import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { 
  BaseEvent, 
  BotEvent, 
  TournamentEvent, 
  MetaverseEvent 
} from '@ai-arena/shared-events';

interface EventBusConfig {
  redisUrl: string;
  channelPrefix: string;
  serviceName: string;
}

/**
 * Event Bus for inter-service communication
 * Uses Redis Pub/Sub for real-time events and Redis Streams for guaranteed delivery
 */
export class EventBus extends EventEmitter {
  private static instance: EventBus;
  private publisher: Redis;
  private subscriber: Redis;
  private streamClient: Redis;
  private config: EventBusConfig;
  private subscriptions: Set<string> = new Set();
  private consumerGroup: string;

  private constructor() {
    super();
    
    this.config = {
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      channelPrefix: process.env.EVENT_BUS_CHANNEL_PREFIX || 'ai-arena:',
      serviceName: 'metaverse-backend'
    };

    // Create Redis clients
    this.publisher = new Redis(this.config.redisUrl);
    this.subscriber = new Redis(this.config.redisUrl);
    this.streamClient = new Redis(this.config.redisUrl);
    this.consumerGroup = `${this.config.serviceName}-group`;

    // Setup error handlers
    this.setupErrorHandlers();

    // Setup subscriber
    this.setupSubscriber();

    logger.info('Event bus initialized', {
      serviceName: this.config.serviceName,
      channelPrefix: this.config.channelPrefix
    });
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  private setupErrorHandlers() {
    const handleError = (client: string) => (error: Error) => {
      logger.error(`Redis ${client} error:`, error);
      this.emit('error', { client, error });
    };

    this.publisher.on('error', handleError('publisher'));
    this.subscriber.on('error', handleError('subscriber'));
    this.streamClient.on('error', handleError('stream'));
  }

  private setupSubscriber() {
    this.subscriber.on('message', (channel: string, message: string) => {
      try {
        const event = JSON.parse(message);
        const eventType = channel.replace(this.config.channelPrefix, '');
        
        logger.debug(`Received event on ${eventType}:`, event);
        this.emit(eventType, event);
      } catch (error) {
        logger.error('Failed to process event:', error);
      }
    });
  }

  /**
   * Publish an event to the bus
   */
  async publish<T extends BaseEvent>(event: T): Promise<void> {
    const channel = `${this.config.channelPrefix}${event.eventType}`;
    const message = JSON.stringify({
      ...event,
      source: 'metaverse',
      timestamp: event.timestamp || new Date(),
      eventId: event.eventId || this.generateEventId()
    });

    try {
      // Publish to Redis Pub/Sub for real-time
      await this.publisher.publish(channel, message);
      
      // Also write to stream for durability
      await this.streamClient.xadd(
        `${this.config.channelPrefix}stream:${event.eventType}`,
        '*',
        'event', message
      );

      logger.debug(`Published event ${event.eventType}`, { eventId: event.eventId });
    } catch (error) {
      logger.error(`Failed to publish event ${event.eventType}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to specific event types
   */
  async subscribe(eventTypes: string[]): Promise<void> {
    const channels = eventTypes.map(type => `${this.config.channelPrefix}${type}`);
    
    try {
      await this.subscriber.subscribe(...channels);
      channels.forEach(channel => this.subscriptions.add(channel));
      
      logger.info(`Subscribed to events:`, eventTypes);
    } catch (error) {
      logger.error('Failed to subscribe to events:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from event types
   */
  async unsubscribe(eventTypes: string[]): Promise<void> {
    const channels = eventTypes.map(type => `${this.config.channelPrefix}${type}`);
    
    try {
      await this.subscriber.unsubscribe(...channels);
      channels.forEach(channel => this.subscriptions.delete(channel));
      
      logger.info(`Unsubscribed from events:`, eventTypes);
    } catch (error) {
      logger.error('Failed to unsubscribe from events:', error);
      throw error;
    }
  }

  /**
   * Process events from stream (for guaranteed delivery)
   */
  async processStream(eventType: string, handler: (event: any) => Promise<void>): Promise<void> {
    const streamKey = `${this.config.channelPrefix}stream:${eventType}`;
    
    // Create consumer group if it doesn't exist
    try {
      await this.streamClient.xgroup('CREATE', streamKey, this.consumerGroup, '0', 'MKSTREAM');
    } catch (error: any) {
      if (!error.message.includes('BUSYGROUP')) {
        throw error;
      }
    }

    // Process messages
    setInterval(async () => {
      try {
        const messages = await this.streamClient.xreadgroup(
          'GROUP', this.consumerGroup,
          this.config.serviceName,
          'COUNT', '10',
          'BLOCK', '1000',
          'STREAMS', streamKey, '>'
        );

        if (messages && messages.length > 0) {
          for (const [stream, streamMessages] of messages as any) {
            for (const [id, fields] of streamMessages) {
              try {
                const event = JSON.parse(fields[1]);
                await handler(event);
                
                // Acknowledge message
                await this.streamClient.xack(streamKey, this.consumerGroup, id);
              } catch (error) {
                logger.error(`Failed to process stream message ${id}:`, error);
              }
            }
          }
        }
      } catch (error) {
        logger.error('Failed to read from stream:', error);
      }
    }, 1000);
  }

  /**
   * Emit bot events
   */
  async emitBotEvent(event: BotEvent): Promise<void> {
    await this.publish(event);
  }

  /**
   * Emit tournament events
   */
  async emitTournamentEvent(event: TournamentEvent): Promise<void> {
    await this.publish(event);
  }

  /**
   * Emit metaverse events
   */
  async emitMetaverseEvent(event: MetaverseEvent): Promise<void> {
    await this.publish(event);
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `${this.config.serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.subscriber.unsubscribe();
    this.publisher.disconnect();
    this.subscriber.disconnect();
    this.streamClient.disconnect();
    
    logger.info('Event bus cleaned up');
  }
}