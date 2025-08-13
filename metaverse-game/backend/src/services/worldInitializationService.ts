import fetch from 'node-fetch';

export class WorldInitializationService {
  private convexUrl: string;
  private initialized: boolean = false;

  constructor() {
    this.convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || 'https://polished-otter-734.convex.cloud';
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('🌍 World initialization already completed');
      return;
    }

    try {
      console.log('🌍 Checking metaverse world instances...');
      
      // Check if Convex is accessible
      const testResponse = await fetch(`${this.convexUrl}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'aiTown/botHttp:getWorlds',
          args: {}
        })
      });

      if (!testResponse.ok) {
        console.warn('⚠️  Metaverse server not accessible - will retry on bot deployment');
        return;
      }

      const worldsResponse = await testResponse.json();
      
      if (worldsResponse.data && worldsResponse.data.length > 0) {
        console.log(`✅ Found ${worldsResponse.data.length} existing world instances`);
        this.initialized = true;
        return;
      }

      // Create default world instances for each zone
      const zones = ['casino', 'darkAlley', 'suburb'];
      let createdCount = 0;

      for (const zone of zones) {
        try {
          const createResponse = await fetch(`${this.convexUrl}/api/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: 'aiTown/botHttp:createWorld',
              args: { zone }
            })
          });

          if (createResponse.ok) {
            const result = await createResponse.json();
            createdCount++;
            console.log(`✅ Created world instance for zone: ${zone}`);
            
            // Log world ID for debugging
            if (result.data?.worldId) {
              console.log(`   World ID: ${result.data.worldId}`);
            }
          } else {
            const error = await createResponse.text();
            console.warn(`⚠️  Failed to create world for zone ${zone}: ${error}`);
          }
        } catch (error) {
          console.warn(`⚠️  Error creating world for zone ${zone}:`, error);
        }
      }

      if (createdCount > 0) {
        console.log(`🌍 Successfully created ${createdCount} world instances`);
        this.initialized = true;
      } else {
        console.warn('⚠️  No world instances created - will retry on bot deployment');
      }

    } catch (error) {
      console.warn('⚠️  World initialization error:', error);
      console.log('   Will attempt to create worlds on first bot deployment');
    }
  }

  async ensureWorldsExist(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    // Re-attempt initialization
    await this.initialize();
    return this.initialized;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async getAvailableWorlds(): Promise<any[]> {
    try {
      const response = await fetch(`${this.convexUrl}/api/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'aiTown/botHttp:getWorlds',
          args: {}
        })
      });

      if (response.ok) {
        const result = await response.json();
        return result.data || [];
      }
    } catch (error) {
      console.error('Error fetching worlds:', error);
    }
    return [];
  }
}

export const worldInitializationService = new WorldInitializationService();