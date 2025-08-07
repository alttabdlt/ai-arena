import fetch from 'node-fetch';
import { ConvexHttpClient } from 'convex/browser';
import { prisma } from '../config/database';

interface WorldInfo {
  worldId: string;
  channel: string;
  status: 'active' | 'running' | 'stopped';
  currentBots: number;
  createdAt: number;
}

interface WorldCache {
  worldId: string;
  channel: string;
  cachedAt: number;
  expiresAt: number;
}

export class WorldDiscoveryService {
  private static instance: WorldDiscoveryService;
  private convexUrl: string;
  private httpUrl: string;
  private client: ConvexHttpClient;
  
  // Cache worlds with 5 minute TTL
  private worldCache: Map<string, WorldCache> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  // Track initialization state
  private isInitializing = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    this.convexUrl = process.env.CONVEX_URL || 'https://reliable-ocelot-928.convex.cloud';
    this.client = new ConvexHttpClient(this.convexUrl);
    
    // Extract deployment name for HTTP endpoints
    const deploymentMatch = this.convexUrl.match(/https:\/\/(.+)\.convex\.cloud/);
    if (!deploymentMatch) {
      throw new Error('Invalid CONVEX_URL format');
    }
    this.httpUrl = `https://${deploymentMatch[1]}.convex.site`;
    
    console.log('🔍 World Discovery Service initialized');
  }

  static getInstance(): WorldDiscoveryService {
    if (!WorldDiscoveryService.instance) {
      WorldDiscoveryService.instance = new WorldDiscoveryService();
    }
    return WorldDiscoveryService.instance;
  }

  /**
   * Discover or create a world for a given channel
   */
  async discoverWorld(channel: string = 'main'): Promise<string | null> {
    // Check cache first
    const cached = this.worldCache.get(channel);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`📍 Using cached world for channel "${channel}": ${cached.worldId}`);
      return cached.worldId;
    }

    try {
      console.log(`🔍 Discovering world for channel "${channel}"...`);
      
      // Check if channel has an assigned world in database
      const channelMeta = await prisma.channelMetadata.findFirst({
        where: { channel },
      });

      if (channelMeta?.worldId) {
        // Validate the world still exists
        const isValid = await this.validateWorldId(channelMeta.worldId);
        if (isValid) {
          this.cacheWorld(channel, channelMeta.worldId);
          console.log(`✅ Found existing world for channel "${channel}": ${channelMeta.worldId}`);
          return channelMeta.worldId;
        } else {
          console.log(`⚠️  Channel's world ${channelMeta.worldId} is invalid, creating new one...`);
          // Clear invalid world reference
          await prisma.channelMetadata.update({
            where: { id: channelMeta.id },
            data: { worldId: null },
          });
        }
      }
      
      // For main channel or if no specific world, query default world
      if (channel === 'main' || !channelMeta) {
        const worldStatus = await this.queryDefaultWorld();
        
        if (worldStatus) {
          // Cache the discovered world
          this.cacheWorld(channel, worldStatus.worldId);
          
          // Update channel metadata if it exists
          if (channelMeta) {
            await prisma.channelMetadata.update({
              where: { id: channelMeta.id },
              data: { worldId: worldStatus.worldId },
            });
          }
          
          console.log(`✅ Discovered world for channel "${channel}": ${worldStatus.worldId}`);
          return worldStatus.worldId;
        }
      }

      // No world found, try to create one
      console.log(`⚠️  No world found for channel "${channel}", attempting to create...`);
      const newWorldId = await this.createWorldForChannel(channel);
      
      if (newWorldId) {
        this.cacheWorld(channel, newWorldId);
        
        // Update channel metadata with new world
        if (channelMeta) {
          await prisma.channelMetadata.update({
            where: { id: channelMeta.id },
            data: { worldId: newWorldId },
          });
        }
        
        console.log(`✅ Created new world for channel "${channel}": ${newWorldId}`);
        return newWorldId;
      }

      console.error(`❌ Failed to discover or create world for channel "${channel}"`);
      return null;

    } catch (error: any) {
      // Handle specific error cases
      if (error.message?.includes('No default world found')) {
        console.log(`📝 No default world exists, triggering initialization...`);
        await this.initializeDefaultWorld();
        // Retry discovery after initialization
        return this.discoverWorld(channel);
      }
      
      console.error(`Error discovering world for channel "${channel}":`, error);
      // Clear cache on error to force re-discovery next time
      this.worldCache.delete(channel);
      return null;
    }
  }

  /**
   * Query for the default world in Convex
   */
  private async queryDefaultWorld(): Promise<{ worldId: string; status: string } | null> {
    try {
      // Use Convex query to get default world
      const result = await this.client.query('queries:getDefaultWorld' as any, {});
      
      if (result && result.worldId) {
        return {
          worldId: result.worldId,
          status: result.status || 'active'
        };
      }
      
      return null;
    } catch (error: any) {
      // If the query doesn't exist or fails, return null
      console.log('Default world query failed:', error.message);
      return null;
    }
  }

  /**
   * Initialize default world if none exists
   */
  private async initializeDefaultWorld(): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.isInitializing) {
      console.log('⏳ World initialization already in progress, waiting...');
      if (this.initializationPromise) {
        await this.initializationPromise;
      }
      return;
    }

    this.isInitializing = true;
    this.initializationPromise = this.doInitializeWorld();
    
    try {
      await this.initializationPromise;
    } finally {
      this.isInitializing = false;
      this.initializationPromise = null;
    }
  }

  private async doInitializeWorld(): Promise<void> {
    try {
      console.log('🌍 Initializing default world...');
      
      // Call the init mutation to create default world
      await this.client.mutation('init:default' as any, {
        numAgents: 0 // Don't create agents, just the world
      });
      
      console.log('✅ Default world initialized');
      
      // Wait a moment for the world to be fully created
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error('Failed to initialize default world:', error);
      throw error;
    }
  }

  /**
   * Create a new world for a specific channel
   */
  private async createWorldForChannel(channel: string): Promise<string | null> {
    try {
      // For now, we use the default world creation
      // In future, this will create channel-specific worlds
      await this.initializeDefaultWorld();
      
      // Query for the newly created world
      const worldStatus = await this.queryDefaultWorld();
      return worldStatus?.worldId || null;
      
    } catch (error) {
      console.error(`Failed to create world for channel "${channel}":`, error);
      return null;
    }
  }

  /**
   * Cache a world ID for a channel
   */
  private cacheWorld(channel: string, worldId: string): void {
    const now = Date.now();
    this.worldCache.set(channel, {
      worldId,
      channel,
      cachedAt: now,
      expiresAt: now + this.CACHE_TTL
    });
  }

  /**
   * Clear cache for a specific channel or all channels
   */
  clearCache(channel?: string): void {
    if (channel) {
      this.worldCache.delete(channel);
      console.log(`🧹 Cleared cache for channel "${channel}"`);
    } else {
      this.worldCache.clear();
      console.log('🧹 Cleared all world cache');
    }
  }

  /**
   * Check if a world ID is still valid
   */
  async validateWorldId(worldId: string): Promise<boolean> {
    try {
      // Attempt to query the world
      const response = await fetch(`${this.httpUrl}/api/bots/get-position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worldId,
          agentId: 'test' // Dummy agent ID for validation
        })
      });

      // If we get a 400 (missing agent) that's fine, world exists
      // If we get 400 with "World not found", world doesn't exist
      if (!response.ok) {
        const error = await response.json();
        if (error.error?.includes('World not found')) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.log(`World validation failed for ${worldId}:`, error);
      return false;
    }
  }

  /**
   * Get all available worlds (for monitoring)
   */
  async getAllWorlds(): Promise<WorldInfo[]> {
    try {
      // This would query all worlds in the system
      // For now, return the default world if it exists
      const defaultWorld = await this.queryDefaultWorld();
      
      if (defaultWorld) {
        return [{
          worldId: defaultWorld.worldId,
          channel: 'main',
          status: defaultWorld.status as any,
          currentBots: 0, // Would need to query this
          createdAt: Date.now()
        }];
      }
      
      return [];
    } catch (error) {
      console.error('Failed to get all worlds:', error);
      return [];
    }
  }

  /**
   * Handle world not found errors by clearing cache and returning null
   */
  handleWorldNotFound(channel: string, worldId: string): void {
    console.log(`🔄 World ${worldId} not found for channel "${channel}", clearing cache`);
    this.worldCache.delete(channel);
  }
}

// Export singleton instance
export const worldDiscoveryService = WorldDiscoveryService.getInstance();