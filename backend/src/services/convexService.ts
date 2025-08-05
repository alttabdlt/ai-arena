import { ConvexHttpClient } from 'convex/browser';

export class ConvexService {
  private client: ConvexHttpClient;
  private static instance: ConvexService;
  private httpUrl: string;

  private constructor() {
    const convexUrl = process.env.CONVEX_URL || 'https://reliable-ocelot-928.convex.cloud';
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
      // Use Convex client to query
      const result = await this.client.query('aiTown/instanceManager:findAvailableInstance' as any, {
        zoneType,
        playerId,
      });
      
      return result;
    } catch (error) {
      console.error('Error finding available instance:', error);
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
  }): Promise<{ agentId: string; playerId: string }> {
    try {
      // This will use the HTTP API endpoint we'll create
      const response = await fetch(`${this.httpUrl}/api/bots/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
      });

      if (!response.ok) {
        throw new Error(`Failed to create bot agent: ${response.statusText}`);
      }

      const result = await response.json() as any;
      
      // Check if we got a pending response
      if (result.status === 'pending' && result.inputId) {
        console.log(`Agent creation pending, inputId: ${result.inputId}. Polling for completion...`);
        
        // Poll for completion (max 60 seconds with exponential backoff)
        const maxAttempts = 20;
        let pollInterval = 1000; // Start with 1 second
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          
          // Check input status via Convex query
          try {
            const pollResult = await this.client.query('aiTown/botHttp:getInputStatus' as any, {
              inputId: result.inputId,
            });
            
            if (pollResult && pollResult.status === 'completed') {
              if (pollResult.returnValue && pollResult.returnValue.kind === 'ok') {
                const { agentId, playerId } = pollResult.returnValue.value;
                console.log(`✅ Agent creation completed: agentId=${agentId}, playerId=${playerId}`);
                return { agentId, playerId };
              } else if (pollResult.returnValue && pollResult.returnValue.kind === 'error') {
                throw new Error(`Agent creation failed: ${pollResult.returnValue.message}`);
              }
            }
            
            // Log progress every 5 attempts
            if (attempt % 5 === 0) {
              console.log(`⏳ Still waiting for agent creation... (attempt ${attempt + 1}/${maxAttempts})`);
            }
          } catch (pollError: any) {
            console.log(`⚠️ Polling attempt ${attempt + 1}/${maxAttempts} - error checking status:`, pollError?.message || pollError);
          }
          
          // Exponential backoff up to 3 seconds
          pollInterval = Math.min(pollInterval * 1.2, 3000);
        }
        
        throw new Error(`Agent creation timed out after ${maxAttempts * 2} seconds. The world engine might be paused. Run 'npx convex run testing:resume' in the metaverse-game directory.`);
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
        if (response.status === 404) {
          return null; // Agent not found
        }
        throw new Error(`Failed to get agent position: ${response.statusText}`);
      }

      const result = await response.json() as any;
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