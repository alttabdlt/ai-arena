import { Router } from 'express';
import { api } from '../../../convex/_generated/api';
import { ConvexService } from '../services/convexService';
import { logger } from '@ai-arena/shared-logger';

const router: Router = Router();

// Get available world endpoint
router.get('/world/available', async (req, res) => {
  try {
    // Get world discovery service
    const worldDiscoveryService = (await import('../services/worldDiscoveryService')).WorldDiscoveryService.getInstance();
    
    // Find or create world for main channel
    const worldId = await worldDiscoveryService.discoverWorld('main');
    
    if (!worldId) {
      return res.status(500).json({ 
        success: false, 
        error: 'No available world instance found' 
      });
    }
    
    return res.json({
      success: true,
      worldId
    });
  } catch (error: any) {
    console.error('Error getting available world:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get available world' 
    });
  }
});

// Bot registration endpoint
router.post('/bots/register', async (req, res) => {
  try {
    const {
      aiArenaBotId,
      name,
      personality,
      modelType,
      character: characterFromBody,
      identity: identityFromBody,
      plan: planFromBody,
      initialZone: initialZoneFromBody,
      avatar,
    } = req.body || {};

    if (!aiArenaBotId) {
      return res.status(400).json({ success: false, error: 'Missing aiArenaBotId' });
    }
    if (!name) {
      return res.status(400).json({ success: false, error: 'Missing name' });
    }
    
    // Get world discovery service
    const worldDiscoveryService = (await import('../services/worldDiscoveryService')).WorldDiscoveryService.getInstance();
    
    // Find or create world for main channel
    const worldId = await worldDiscoveryService.discoverWorld('main');
    
    if (!worldId) {
      return res.status(500).json({ 
        success: false, 
        error: 'Could not find or create world for bot' 
      });
    }
    
    // Get Convex service
    const convexService = ConvexService.getInstance();
    
    // Resolve pass-through values, falling back to personality-based defaults
    const personalityUpper = (personality || 'WORKER').toUpperCase();
    let character = characterFromBody as string | undefined;
    let identity = identityFromBody as string | undefined;
    let plan = planFromBody as string | undefined;
    let initialZone = initialZoneFromBody as string | undefined;

    // IMPORTANT: If avatar is provided and is a valid character ID, use it as the character
    const validCharacters = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'];
    if (!character && avatar && validCharacters.includes(avatar)) {
      character = avatar;
      console.log(`Using avatar as character: ${character} for bot ${name}`);
    }

    if (!character || !identity || !plan || !initialZone) {
      const characterMap: Record<string, string[]> = {
        CRIMINAL: ['f1', 'f2', 'f3', 'f4'],
        GAMBLER: ['f5', 'f6', 'f7', 'f8'],
        WORKER: ['f1', 'f2', 'f3', 'f4'],
      };
      const identityMap: Record<string, string> = {
        CRIMINAL: `${name} is a ruthless criminal mastermind who thrives in the shadows. They've spent years perfecting the art of intimidation and have connections throughout the underground.`,
        GAMBLER: `${name} is a card shark who uses charm and wit to separate fools from their money. They know every game, every angle, and every tell.`,
        WORKER: `${name} is a skilled craftsperson who takes pride in their work. They can build anything, fix anything, and believe that creation is more powerful than destruction.`,
      };
      const planMap: Record<string, string> = {
        CRIMINAL: 'You want to control the dark alleys and build a criminal empire through fear and violence.',
        GAMBLER: "You want to establish yourself as the casino's most legendary player and run your own high-stakes games.",
        WORKER: 'You want to create the most impressive structures in the city and be known for your craftsmanship.',
      };
      const zoneMap: Record<string, string> = {
        CRIMINAL: 'darkAlley',
        GAMBLER: 'casino',
        WORKER: 'suburb',
      };
      if (!character) {
        // Only randomly select if avatar wasn't provided or invalid
        const characters = characterMap[personalityUpper] || ['f1'];
        character = characters[Math.floor(Math.random() * characters.length)];
        console.log(`No avatar provided, randomly selected character: ${character} for bot ${name}`);
      }
      if (!identity) {
        identity = identityMap[personalityUpper] || identityMap['WORKER'];
      }
      if (!plan) {
        plan = planMap[personalityUpper] || planMap['WORKER'];
      }
      if (!initialZone) {
        initialZone = zoneMap[personalityUpper] || 'suburb';
      }
    }
    
    // Log what we're sending to Convex
    console.log(`Registering bot ${name} with character=${character}, avatar=${avatar}`);
    
    // Create bot agent using Convex mutation directly
    const client = convexService.convexClient;
    const regResult: any = await client.mutation(api.aiTown.botHttp.registerBot, {
      worldId,
      name,
      character: character!,
      identity: identity!,
      plan: plan!,
      aiArenaBotId,
      initialZone: initialZone!,
      avatar,
    });
    
    // Handle different registration results
    if (regResult?.agentId && regResult?.playerId) {
      console.log(`✅ Bot ${name} already had agent: ${regResult.agentId}`);
      return res.json({
        success: true,
        message: 'Bot already registered',
        aiArenaBotId,
        worldId,
        agentId: regResult.agentId,
        playerId: regResult.playerId,
      });
    } else if (regResult?.registrationId) {
      console.log(`✅ Bot ${name} queued with registrationId: ${regResult.registrationId}`);
      
      // Trigger batch processing after a short delay
      setTimeout(async () => {
        try {
          await client.mutation(api.migrations.batchRegistration.triggerBatchProcessing, {
            worldId: worldId as any // Type assertion for Convex Id type
          });
          console.log('📦 Triggered batch processing for registrations');
        } catch (err) {
          console.error('Failed to trigger batch processing:', err);
        }
      }, 2000);
      
      // Wait for batch processing to complete (up to 10 seconds)
      let attempts = 0;
      const maxAttempts = 10;
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        
        try {
          const status = await client.query(api.aiTown.botHttp.getRegistrationStatus, {
            registrationId: regResult.registrationId as any
          });
          
          if (status?.status === 'completed' && status?.result?.agentId) {
            console.log(`✅ Bot ${name} registration completed: ${status.result.agentId}`);
            return res.json({
              success: true,
              message: 'Bot registered successfully',
              aiArenaBotId,
              worldId,
              agentId: status.result.agentId,
              playerId: status.result.playerId,
            });
          } else if (status?.status === 'failed') {
            throw new Error(status.error || 'Registration failed');
          }
        } catch (err) {
          console.log(`Attempt ${attempts}/${maxAttempts} - Still processing...`);
        }
      }
      
      // If we're here, registration is still pending after timeout
      // But we should still try to get the latest status
      try {
        const finalStatus = await client.query(api.aiTown.botHttp.getRegistrationStatus, {
          registrationId: regResult.registrationId as any
        });
        
        if (finalStatus?.status === 'completed' && finalStatus?.result?.agentId) {
          return res.json({
            success: true,
            message: 'Bot registered successfully (after timeout)',
            aiArenaBotId,
            worldId,
            agentId: finalStatus.result.agentId,
            playerId: finalStatus.result.playerId,
          });
        }
      } catch (err) {
        console.log('Could not get final status after timeout');
      }
      
      return res.json({ 
        success: true, 
        message: 'Bot registration queued, will complete soon',
        aiArenaBotId,
        worldId,
        registrationId: regResult.registrationId,
        status: 'pending',
      });
    } else {
      console.log(`✅ Bot ${name} registration result:`, regResult);
      // For immediate success without agentId (shouldn't normally happen)
      return res.json({ 
        success: true, 
        message: 'Bot registered to metaverse',
        aiArenaBotId,
        worldId,
        agentId: regResult?.agentId,
        playerId: regResult?.playerId,
      });
    }
  } catch (error) {
    console.error('Bot registration error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Registration status endpoint
router.get('/bots/registration-status/:registrationId', async (req, res) => {
  try {
    const { registrationId } = req.params;
    
    if (!registrationId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Registration ID is required' 
      });
    }
    
    // Get Convex service
    const convexService = ConvexService.getInstance();
    
    // Query the registration status
    const status = await convexService.convexClient.query(api.aiTown.botHttp.getRegistrationStatus, {
      registrationId: registrationId as any
    });
    
    if (!status) {
      return res.status(404).json({ 
        success: false, 
        error: 'Registration not found' 
      });
    }
    
    // Format the response with the expected fields
    return res.json({
      success: true,
      status: status.status,
      agentId: status.result?.agentId,
      playerId: status.result?.playerId,
      error: status.error,
      registrationId: registrationId
    });
  } catch (error) {
    console.error('Registration status error:', error);
    
    // Check if it's a "not found" error
    if (error instanceof Error && error.message.includes('Registration not found')) {
      return res.status(404).json({ 
        success: false, 
        error: 'Registration not found' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Bot position update endpoint
router.post('/bots/update-position', async (req, res) => {
  try {
    const { botId, position, zone } = req.body;
    
    // TODO: Implement position update logic
    res.json({ 
      success: true, 
      message: 'Position updated',
      botId,
      position,
      zone 
    });
  } catch (error) {
    console.error('Position update error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Bot stats sync endpoint
router.post('/bots/sync-stats', async (req, res) => {
  try {
    const { botId, stats } = req.body;
    
    // TODO: Implement stats sync logic
    res.json({ 
      success: true, 
      message: 'Stats synchronized',
      botId,
      stats 
    });
  } catch (error) {
    console.error('Stats sync error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Lootbox sync endpoint
router.post('/lootbox/sync', async (req, res) => {
  try {
    const { lootboxId } = req.body;
    
    if (!lootboxId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing lootboxId' 
      });
    }
    
    // Import inventory sync service
    const { inventorySyncService } = await import('../services/inventorySync');
    
    // Sync the lootbox to metaverse
    const result = await inventorySyncService.syncLootboxToMetaverse(lootboxId);
    
    if (result.success) {
      logger.info(`✅ Lootbox ${lootboxId} synced to metaverse`);
      res.json({ 
        success: true, 
        message: result.message || 'Lootbox synchronized successfully',
        lootboxId
      });
    } else {
      logger.error(`⚠️ Failed to sync lootbox ${lootboxId}: ${result.message}`);
      res.status(400).json({ 
        success: false, 
        error: result.message || 'Failed to sync lootbox' 
      });
    }
  } catch (error) {
    console.error('Lootbox sync error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// World heartbeat endpoint
router.post('/world/heartbeat', async (req, res) => {
  try {
    const { worldId } = req.body;
    
    // TODO: Implement world heartbeat logic
    res.json({ 
      success: true, 
      message: 'Heartbeat received',
      worldId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('World heartbeat error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Verify if an agent exists in Convex
router.post('/agent/verify', async (req, res) => {
  try {
    const { worldId, agentId } = req.body;
    
    if (!worldId || !agentId) {
      return res.status(400).json({ 
        error: 'Missing required fields: worldId and agentId' 
      });
    }
    
    // Get Convex service
    const convexService = ConvexService.getInstance();
    
    // Check if the agent exists by getting its position
    const agentData = await convexService.getAgentPosition(worldId, agentId);
    
    res.json({ 
      exists: agentData !== null,
      agentId,
      worldId
    });
  } catch (error) {
    logger.error('Error verifying agent:', error);
    res.status(500).json({ 
      error: 'Failed to verify agent',
      exists: false 
    });
  }
});

export default router;