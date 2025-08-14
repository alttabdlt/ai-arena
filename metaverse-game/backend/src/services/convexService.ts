import { ConvexHttpClient } from 'convex/browser';

export class ConvexService {
  private client: ConvexHttpClient;
  private static instance: ConvexService;
  private httpUrl: string;
  
  // Public getter for Convex client
  get convexClient(): ConvexHttpClient {
    return this.client;
  }

  private constructor() {
    // Use environment variable for deployment URL - reliable-ocelot for development
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error('CONVEX_URL environment variable is required');
    }
    this.client = new ConvexHttpClient(convexUrl);
    
    // Extract deployment name and construct HTTP endpoint URL
    const deploymentMatch = convexUrl.match(/https:\/\/(.+)\.convex\.cloud/);
    if (!deploymentMatch) {
      throw new Error('Invalid CONVEX_URL format');
    }
    this.httpUrl = `https://${deploymentMatch[1]}.convex.site`;
    
    console.log(`🌐 Convex client initialized for ${convexUrl}`);
    console.log(`🌐 HTTP endpoints available at ${this.httpUrl}`);
  }

  static getInstance(): ConvexService {
    if (!ConvexService.instance) {
      ConvexService.instance = new ConvexService();
    }
    return ConvexService.instance;
  }

  // Find available instance for a bot to join a zone
  async findAvailableInstance(zoneType: string, playerId?: string): Promise<{
    instanceId: string;
    worldId: string;
    currentPlayers: number;
    currentBots: number;
  } | null> {
    try {
      console.log('ConvexService.findAvailableInstance called with:', { zoneType, playerId });
      // Use Convex mutation instead of query to auto-create if needed
      const result = await this.client.mutation('aiTown/instanceManager:findAvailableInstance' as any, {
        zoneType,
        playerId,
      });
      console.log('ConvexService.findAvailableInstance result:', result);
      
      return result;
    } catch (error) {
      console.error('Error finding available instance:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
  }

  // Create a bot agent in the metaverse
  async createBotAgent(args: {
    worldId: string;
    name: string;
    character: string;
    identity: string;
    plan: string;
    aiArenaBotId: string;
    initialZone: string;
    avatar?: string;
  }): Promise<{ agentId: string; playerId: string }> {
    try {
      // First check if world exists and is running
      try {
        const worldStatus = await this.convexClient.query('debugging:checkEngineStatus' as any, {
          worldId: args.worldId as any
        });
        
        if (worldStatus.error) {
          console.error(`❌ World validation failed: ${worldStatus.error}`);
          
          // Try to recover the world
          console.log('🔄 Attempting to recover world...');
          await this.convexClient.mutation('testing:resume' as any);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else if (worldStatus.worldStatus !== 'running') {
          console.log(`⚠️ World ${args.worldId} is ${worldStatus.worldStatus}, attempting to start...`);
          await this.convexClient.mutation('testing:resume' as any);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (statusError) {
        console.warn('⚠️ Could not check world status, proceeding anyway:', statusError);
      }
      
      // Ensure the world is active before creating the bot
      try {
        await this.convexClient.mutation('world:heartbeatWorld' as any, { 
          worldId: args.worldId as any 
        });
        console.log('💓 World heartbeat sent for', args.worldId);
      } catch (heartbeatError) {
        console.warn('⚠️ Could not send world heartbeat:', heartbeatError);
        // Continue anyway - the world might still be active
      }
      
      // This will use the HTTP API endpoint we'll create
      const response = await fetch(`${this.httpUrl}/api/bots/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Check for world not found error and clear cache
        if (errorText.includes('World not found') || errorText.includes('Invalid world')) {
          console.log(`🔄 World ${args.worldId} not found during bot creation, clearing cache...`);
          const { worldDiscoveryService } = await import('./worldDiscoveryService');
          worldDiscoveryService.clearCache('main');
        }
        
        throw new Error(`Failed to create bot agent: ${errorText || response.statusText}`);
      }

      const result = await response.json() as any;
      
      // Check if we got a pending response (could be registrationId or inputId for backward compatibility)
      if (result.status === 'pending' && (result.registrationId || result.inputId)) {
        const trackingId = result.registrationId || result.inputId;
        const isRegistration = !!result.registrationId;
        console.log(`Agent creation pending, ${isRegistration ? 'registrationId' : 'inputId'}: ${trackingId}. Polling for completion...`);
        
        // Poll for completion (max 90 seconds with exponential backoff and recovery)
        const maxAttempts = 30; // Increased from 20
        let pollInterval = 1000; // Start with 1 second
        let lastHeartbeatAttempt = 0;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          
          // Send world heartbeat every 10 attempts to keep world active
          if (attempt - lastHeartbeatAttempt >= 10) {
            try {
              await this.client.mutation('world:heartbeatWorld' as any, { 
                worldId: args.worldId as any 
              });
              console.log('💓 Sent world heartbeat during bot creation');
              lastHeartbeatAttempt = attempt;
            } catch (hbError) {
              console.warn('⚠️ Heartbeat failed during bot creation:', hbError);
            }
          }
          
          // Check status via Convex query
          try {
            let pollResult;
            
            if (isRegistration) {
              // New registration queue system
              pollResult = await this.client.query('aiTown/botHttp:getRegistrationStatus' as any, {
                registrationId: trackingId,
              });
              
              if (pollResult && pollResult.status === 'completed') {
                if (pollResult.result) {
                  const { agentId, playerId } = pollResult.result;
                  console.log(`✅ Agent creation completed: agentId=${agentId}, playerId=${playerId}`);
                  return { agentId, playerId };
                }
              } else if (pollResult && pollResult.status === 'failed') {
                throw new Error(`Agent creation failed: ${pollResult.error || 'Unknown error'}`);
              }
            } else {
              // Legacy input system
              pollResult = await this.client.query('aiTown/botHttp:getInputStatus' as any, {
                inputId: trackingId,
              });
              
              if (pollResult && pollResult.status === 'completed') {
                if (pollResult.returnValue && pollResult.returnValue.kind === 'ok') {
                  const { agentId, playerId } = pollResult.returnValue.value;
                  console.log(`✅ Agent creation completed: agentId=${agentId}, playerId=${playerId}`);
                  return { agentId, playerId };
                } else if (pollResult.returnValue && pollResult.returnValue.kind === 'error') {
                  // Check if it's a generation number error - if so, retry
                  if (pollResult.returnValue.message && pollResult.returnValue.message.includes('generation')) {
                    console.log('⚠️ Generation number mismatch during bot creation, will retry...');
                    continue;
                  }
                  throw new Error(`Agent creation failed: ${pollResult.returnValue.message}`);
                }
              }
            }
            
            // Log progress every 5 attempts
            if (attempt % 5 === 0) {
              console.log(`⏳ Still waiting for agent creation... (attempt ${attempt + 1}/${maxAttempts})`);
            }
          } catch (pollError: any) {
            console.log(`⚠️ Polling attempt ${attempt + 1}/${maxAttempts} - error checking status:`, pollError?.message || pollError);
            
            // If we get engine not running error, try to resume
            if (pollError?.message && pollError.message.includes('engine')) {
              try {
                console.log('🔄 Engine issue detected, attempting to resume world...');
                await this.client.mutation('testing:resume' as any);
                await new Promise(resolve => setTimeout(resolve, 2000));
              } catch (resumeErr) {
                console.warn('⚠️ Could not resume world:', resumeErr);
              }
            }
          }
          
          // Exponential backoff up to 3 seconds
          pollInterval = Math.min(pollInterval * 1.2, 3000);
        }
        
        throw new Error(`Agent creation timed out after ${maxAttempts * 3} seconds. The world engine might be experiencing issues. Try manually resuming the world.`);
      }
      
      // Otherwise we should have the agent data
      if (!result.agentId || !result.playerId) {
        throw new Error('Invalid response from bot registration');
      }
      
      return { agentId: result.agentId, playerId: result.playerId };
    } catch (error) {
      console.error('Error creating bot agent:', error);
      throw error;
    }
  }

  // Update bot position in the metaverse
  async updateBotPosition(args: {
    agentId: string;
    worldId: string;
    position: { x: number; y: number };
    zone: string;
  }): Promise<void> {
    try {
      const response = await fetch(`${this.httpUrl}/api/bots/update-position`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
      });

      if (!response.ok) {
        throw new Error(`Failed to update bot position: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error updating bot position:', error);
      throw error;
    }
  }

  // Sync bot stats from AI Arena to metaverse
  async syncBotStats(args: {
    agentId: string;
    worldId: string;
    stats: {
      power: number;
      defense: number;
      houseScore: number;
      wins: number;
      losses: number;
      earnings: number;
      activityLevel: number;
    };
  }): Promise<void> {
    try {
      const response = await fetch(`${this.httpUrl}/api/bots/sync-stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
      });

      if (!response.ok) {
        throw new Error(`Failed to sync bot stats: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error syncing bot stats:', error);
      throw error;
    }
  }

  // Get bot experience from metaverse
  async getBotExperience(worldId: string, aiArenaBotId: string): Promise<any> {
    try {
      const response = await fetch(`${this.httpUrl}/api/bots/experience`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ worldId, aiArenaBotId }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // No experience record yet
        }
        throw new Error(`Failed to get bot experience: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting bot experience:', error);
      return null;
    }
  }

  // Get agent position from metaverse
  async getAgentPosition(worldId: string, agentId: string): Promise<{
    position: { x: number; y: number };
    zone: string;
  } | null> {
    try {
      // Validate worldId format before making request
      if (!worldId || !worldId.match(/^[a-z0-9]{32}$/)) {
        throw new Error(`Invalid worldId format: ${worldId}`);
      }
      
      const response = await fetch(`${this.httpUrl}/api/bots/get-position`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ worldId, agentId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Check for world not found error and clear cache
        if (errorText.includes('World not found') || errorText.includes('Invalid world')) {
          console.log(`🔄 World ${worldId} not found, clearing cache...`);
          // Import worldDiscoveryService to clear cache
          const { worldDiscoveryService } = await import('./worldDiscoveryService');
          worldDiscoveryService.clearCache('main');
        }
        
        // Distinguish between different error types
        if (response.status === 404) {
          // Check if it's an agent not found vs other 404s
          if (errorText.includes('Agent not found') || errorText.includes('Player not found')) {
            console.log(`🔍 Agent ${agentId} not found in world ${worldId}`);
            return null; // Agent definitively doesn't exist
          }
          return null; // Other 404 errors
        }
        
        // For temporary errors (500, 502, 503, 504), we should retry at a higher level
        if (response.status >= 500) {
          console.warn(`⚠️ Temporary server error getting agent position: ${response.status} ${response.statusText}`);
          throw new Error(`Temporary server error: ${response.statusText}`);
        }
        
        throw new Error(`Failed to get agent position: ${response.statusText}`);
      }

      const result = await response.json() as any;
      
      // Handle wrapped response from Convex HTTP endpoint
      if (result.success && result.position) {
        return result.position;
      }
      
      return result;
    } catch (error) {
      console.error('Error getting agent position:', error);
      return null;
    }
  }

  // Get instance statistics for monitoring
  async getInstanceStats(): Promise<Record<string, {
    totalInstances: number;
    activeInstances: number;
    totalPlayers: number;
    totalBots: number;
    averageLoad: number;
  }>> {
    try {
      const result = await this.client.query('aiTown/instanceManager:getInstanceStats' as any, {});
      return result;
    } catch (error) {
      console.error('Error getting instance stats:', error);
      throw error;
    }
  }

  // Sync bot lootboxes with metaverse
  async syncBotLootboxes(args: {
    worldId: string;
    aiArenaBotId: string;
    lootboxes: Array<{
      id: string;
      matchId: string;
      rarity: string;
      itemName: string;
      itemType: string;
      value: number;
      opened: boolean;
      openedAt: Date | null;
    }>;
  }): Promise<void> {
    try {
      // Transform individual rewards into grouped lootboxes with items array
      const lootboxMap = new Map<string, any>();
      
      for (const reward of args.lootboxes) {
        const lootboxKey = `${reward.matchId}_${reward.rarity}`;
        
        if (!lootboxMap.has(lootboxKey)) {
          lootboxMap.set(lootboxKey, {
            id: lootboxKey,
            rarity: reward.rarity,
            items: [],
            openedAt: reward.opened && reward.openedAt ? reward.openedAt.toISOString() : undefined,
          });
        }
        
        const lootbox = lootboxMap.get(lootboxKey);
        lootbox.items.push({
          type: reward.itemType,
          name: reward.itemName,
          quantity: 1,
          value: reward.value,
        });
      }
      
      const transformedLootboxes = Array.from(lootboxMap.values());
      
      const response = await fetch(`${this.httpUrl}/api/lootbox/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aiArenaBotId: args.aiArenaBotId,
          lootboxes: transformedLootboxes
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        throw new Error(errorData.error || `Failed to sync lootboxes: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ Lootboxes synced to metaverse:`, result);
    } catch (error) {
      console.error('Error syncing lootboxes to metaverse:', error);
      throw error;
    }
  }

  // Get all Arena-managed agents from the metaverse
  async getAllArenaAgents(): Promise<{
    agents: Array<{
      agentId: string;
      playerId: string;
      name: string;
      identity: string;
      aiArenaBotId: string | null;
      worldId: string;
    }>;
    worldId: string | null;
    totalAgents: number;
    arenaAgents: number;
  }> {
    try {
      const result = await this.client.query('cleanup/orphanCleanup:getAllArenaAgents' as any, {});
      return result;
    } catch (error) {
      console.error('Error getting all Arena agents:', error);
      return {
        agents: [],
        worldId: null,
        totalAgents: 0,
        arenaAgents: 0,
      };
    }
  }

  // Delete orphaned agents from the metaverse
  async deleteOrphanedAgents(agents: Array<{
    agentId: string;
    playerId: string;
    aiArenaBotId?: string;
  }>, worldId: string, reason?: string): Promise<any> {
    try {
      const result = await this.client.mutation('cleanup/orphanCleanup:batchDeleteOrphanedAgents' as any, {
        worldId,
        agents,
        reason,
      });
      return result;
    } catch (error) {
      console.error('Error deleting orphaned agents:', error);
      throw error;
    }
  }

  // Delete a bot agent from the metaverse
  async deleteBotAgent(args: {
    worldId: string;
    agentId: string;
    aiArenaBotId: string;
  }): Promise<void> {
    try {
      const response = await fetch(`${this.httpUrl}/api/bots/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        throw new Error(errorData.error || `Failed to delete bot agent: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ Bot agent deleted from metaverse:`, result);
    } catch (error) {
      console.error('Error deleting bot agent from metaverse:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const convexService = ConvexService.getInstance();