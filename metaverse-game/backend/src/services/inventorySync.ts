import { PrismaClient } from '@prisma/client';
import { ConvexService } from './convexService';

const prisma = new PrismaClient();

export class InventorySyncService {
  private convexService: ConvexService;

  constructor() {
    this.convexService = ConvexService.getInstance();
  }

  /**
   * Sync a bot's equipment from AI Arena to the metaverse
   */
  async syncBotInventory(botId: string): Promise<{
    success: boolean;
    syncedItems: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let syncedItems = 0;

    try {
      // Get bot and ensure it has metaverse data
      const bot = await prisma.bot.findUnique({
        where: { id: botId },
        include: {
          equipment: true,
          botSync: true,
        }
      });

      if (!bot) {
        return { success: false, syncedItems: 0, errors: ['Bot not found'] };
      }

      if (!bot.botSync || !bot.botSync.convexWorldId || !bot.botSync.convexPlayerId) {
        return { success: false, syncedItems: 0, errors: ['Bot not registered in metaverse'] };
      }

      // Prepare equipment data for sync
      const equipmentData = bot.equipment.map(item => ({
        itemId: item.id,
        name: item.name,
        type: item.equipmentType,
        rarity: item.rarity,
        stats: {
          powerBonus: item.powerBonus,
          defenseBonus: item.defenseBonus,
          speedBonus: item.speedBonus || 0,
          agilityBonus: item.agilityBonus || 0,
          rangeBonus: item.rangeBonus || 0,
          healingPower: item.healingPower || 0,
          scoreBonus: 0, // Equipment doesn't have scoreBonus, that's for furniture
        },
        consumable: item.consumable,
        quantity: item.quantity,
        uses: item.uses,
        maxUses: item.maxUses,
        duration: item.duration,
        equipped: item.equipped,
      }));

      // Sync to metaverse via HTTP endpoint
      const syncResult = await this.syncItemsToMetaverse(
        bot.botSync.convexWorldId,
        bot.botSync.convexPlayerId,
        botId,
        equipmentData
      );

      if (syncResult.success) {
        syncedItems = equipmentData.length;
        
        // Update sync status
        await prisma.botSync.update({
          where: { botId },
          data: {
            statsSynced: true,
            lastSyncedAt: new Date(),
          }
        });
      } else {
        errors.push(syncResult.error || 'Failed to sync to metaverse');
      }

      return { success: syncResult.success, syncedItems, errors };
    } catch (error) {
      console.error('Error syncing bot inventory:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return { success: false, syncedItems: 0, errors };
    }
  }

  /**
   * Sync lootbox rewards from AI Arena to metaverse queue
   */
  async syncLootboxToMetaverse(lootboxId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const lootbox = await prisma.lootboxReward.findUnique({
        where: { id: lootboxId },
        include: { bot: { include: { botSync: true } } }
      });

      if (!lootbox) {
        return { success: false, message: 'Lootbox not found' };
      }

      if (lootbox.opened) {
        return { success: false, message: 'Lootbox already opened' };
      }

      const botSync = lootbox.bot.botSync;
      if (!botSync || !botSync.convexWorldId || !botSync.convexPlayerId) {
        return { success: false, message: 'Bot not registered in metaverse' };
      }

      // Prepare rewards data
      const rewards: any[] = [];
      
      // Process equipment rewards
      const equipmentRewards = lootbox.equipmentRewards as any[];
      for (const equipment of equipmentRewards) {
        rewards.push({
          itemId: `loot-${lootboxId}-eq-${rewards.length}`,
          name: equipment.name,
          type: equipment.equipmentType,
          rarity: equipment.rarity,
          stats: {
            powerBonus: equipment.powerBonus || 0,
            defenseBonus: equipment.defenseBonus || 0,
            speedBonus: equipment.speedBonus || 0,
            agilityBonus: equipment.agilityBonus || 0,
            rangeBonus: equipment.rangeBonus || 0,
            healingPower: equipment.healingPower || 0,
            scoreBonus: 0,
          },
          consumable: equipment.consumable || false,
          quantity: equipment.quantity || 1,
          duration: equipment.duration || null,
        });
      }

      // Process furniture rewards
      const furnitureRewards = lootbox.furnitureRewards as any[];
      for (const furniture of furnitureRewards) {
        rewards.push({
          itemId: `loot-${lootboxId}-fu-${rewards.length}`,
          name: furniture.name,
          type: 'FURNITURE',
          rarity: furniture.rarity,
          stats: {
            powerBonus: 0,
            defenseBonus: furniture.defenseBonus || 0,
            scoreBonus: furniture.scoreBonus || 0,
            speedBonus: 0,
            agilityBonus: 0,
            rangeBonus: 0,
            healingPower: 0,
          }
        });
      }

      // Queue lootbox in metaverse
      const queueResult = await this.queueLootboxInMetaverse(
        botSync.convexWorldId,
        botSync.convexPlayerId,
        lootbox.botId,
        lootboxId,
        lootbox.lootboxRarity,
        rewards
      );

      return queueResult;
    } catch (error) {
      console.error('Error syncing lootbox to metaverse:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Sync all pending lootboxes for a bot
   */
  async syncAllPendingLootboxes(botId: string): Promise<{
    success: boolean;
    syncedCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let syncedCount = 0;

    try {
      const pendingLootboxes = await prisma.lootboxReward.findMany({
        where: {
          botId,
          opened: false,
        }
      });

      for (const lootbox of pendingLootboxes) {
        const result = await this.syncLootboxToMetaverse(lootbox.id);
        if (result.success) {
          syncedCount++;
        } else {
          errors.push(`Lootbox ${lootbox.id}: ${result.message}`);
        }
      }

      return { success: errors.length === 0, syncedCount, errors };
    } catch (error) {
      console.error('Error syncing pending lootboxes:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return { success: false, syncedCount: 0, errors };
    }
  }

  /**
   * Helper: Send items to metaverse via HTTP endpoint
   */
  private async syncItemsToMetaverse(
    worldId: string,
    playerId: string,
    aiArenaBotId: string,
    items: any[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.convexService['httpUrl']}/syncInventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worldId,
          playerId,
          aiArenaBotId,
          items,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      const result = await response.json() as { success: boolean; error?: string };
      return { success: result.success, error: result.error };
    } catch (error) {
      console.error('Error calling metaverse sync endpoint:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }

  /**
   * Helper: Queue lootbox in metaverse
   */
  private async queueLootboxInMetaverse(
    worldId: string,
    playerId: string,
    aiArenaBotId: string,
    lootboxId: string,
    rarity: string,
    rewards: any[]
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.convexService['httpUrl']}/queueLootbox`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worldId,
          playerId,
          aiArenaBotId,
          lootboxId,
          rarity,
          rewards,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, message: `HTTP ${response.status}: ${errorText}` };
      }

      const result = await response.json() as { success: boolean; message?: string };
      return { success: result.success, message: result.message || 'Lootbox queued successfully' };
    } catch (error) {
      console.error('Error queueing lootbox in metaverse:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }

  /**
   * Periodic sync job - sync all active bots' inventories
   */
  async syncAllActiveBotsInventories(): Promise<{
    totalBots: number;
    successfulSyncs: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let successfulSyncs = 0;

    try {
      const activeBots = await prisma.bot.findMany({
        where: {
          isActive: true,
          botSync: {
            syncStatus: 'SYNCED',
            convexWorldId: { not: null },
            convexPlayerId: { not: null },
          }
        },
        select: { id: true, name: true }
      });

      const totalBots = activeBots.length;

      for (const bot of activeBots) {
        const result = await this.syncBotInventory(bot.id);
        if (result.success) {
          successfulSyncs++;
        } else {
          errors.push(`Bot ${bot.name}: ${result.errors.join(', ')}`);
        }

        // Add delay to avoid overwhelming the metaverse
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`Inventory sync completed: ${successfulSyncs}/${totalBots} successful`);
      return { totalBots, successfulSyncs, errors };
    } catch (error) {
      console.error('Error in bulk inventory sync:', error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');
      return { totalBots: 0, successfulSyncs: 0, errors };
    }
  }
}

export const inventorySyncService = new InventorySyncService();