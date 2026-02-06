import { PrismaClient } from '@prisma/client';
import { economyService } from '../../services/economyService';
// inventorySyncService moved to metaverse backend
// import { inventorySyncService } from '../../services/inventorySync';
import { pubsub, initializePubSub } from '../../config/context';
import axios from 'axios';

const METAVERSE_BACKEND_URL = process.env.METAVERSE_BACKEND_URL || 'http://localhost:5001';

// Initialize pubsub if not already done
initializePubSub();

const prisma = new PrismaClient();

export const economyResolvers = {
  Query: {
    // Get bot's equipment
    getBotEquipment: async (_: any, { botId }: { botId: string }) => {
      return await prisma.botEquipment.findMany({
        where: { botId },
        include: { bot: true }
      });
    },

    // Get bot's house
    getBotHouse: async (_: any, { botId }: { botId: string }) => {
      return await prisma.botHouse.findUnique({
        where: { botId },
        include: { 
          bot: true,
          furniture: true 
        }
      });
    },

    // Get bot's activity score
    getBotActivityScore: async (_: any, { botId }: { botId: string }) => {
      return await prisma.botActivityScore.findUnique({
        where: { botId },
        include: { bot: true }
      });
    },

    // Get pending lootbox rewards
    getPendingLootboxes: async (_: any, { botId }: { botId: string }) => {
      return await prisma.lootboxReward.findMany({
        where: { 
          botId,
          opened: false 
        },
        include: { 
          bot: true,
          match: true 
        },
        orderBy: { createdAt: 'desc' }
      });
    },

    // Get robbery logs - REMOVED: RobberyLog model no longer exists
    getRobberyLogs: async (_: any, { botId: _botId }: { botId: string; role?: string }) => {
      // RobberyLog model removed from schema
      return [];
    },

    // Get trades - REMOVED: Trade model no longer exists
    getBotTrades: async (_: any, { botId: _botId }: { botId: string; status?: string }) => {
      // Trade model removed from schema
      return [];
    },
    
    // Rest of trade query removed - commented out
    /*
    getBotTradesOld: async () => {
      return await prisma.trade.findMany({
        where,
        include: { 
          initiatorBot: true,
          receiverBot: true 
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });
    },
    */

    // Calculate robbing power
    calculateRobbingPower: async (_: any, { botId }: { botId: string }) => {
      return await economyService.calculateRobbingPower(botId);
    },

    // Calculate defense level
    calculateDefenseLevel: async (_: any, { botId }: { botId: string }) => {
      return await economyService.calculateDefenseLevel(botId);
    },

    // Get house leaderboard
    getHouseLeaderboard: async (_: any, { limit = 10 }: { limit?: number }) => {
      return await prisma.botHouse.findMany({
        include: { 
          bot: {
            include: {
              creator: true
            }
          },
          furniture: true 
        },
        orderBy: { houseScore: 'desc' },
        take: limit
      });
    },

    // Get inventory sync status - REMOVED: BotSync model no longer exists
    getInventorySyncStatus: async (_: any, { botId }: { botId: string }) => {
      const pendingLootboxes = await prisma.lootboxReward.count({
        where: { botId, opened: false }
      });

      const totalItems = await prisma.botEquipment.count({
        where: { botId }
      });

      return {
        botId,
        lastSyncedAt: null,
        syncStatus: 'NOT_SYNCED',
        pendingLootboxes,
        totalItems,
        errors: [],
      };
    }
  },

  Mutation: {
    // Open lootbox
    openLootbox: async (_: any, { lootboxId }: { lootboxId: string }) => {
      const result = await economyService.openLootbox(lootboxId);
      
      // Get the updated house score
      const lootbox = await prisma.lootboxReward.findUnique({
        where: { id: lootboxId }
      });
      
      if (lootbox) {
        const houseUpdate = await economyService.updateHouseScore(lootbox.botId);
        
        // Publish house score update
        pubsub.publish(`HOUSE_SCORE_UPDATED_${lootbox.botId}`, {
          houseScoreUpdated: houseUpdate
        });
      }
      
      return result;
    },

    // Equip/unequip item
    toggleEquipment: async (_: any, { equipmentId, equipped }: { equipmentId: string; equipped: boolean }) => {
      const equipment = await prisma.botEquipment.update({
        where: { id: equipmentId },
        data: { equipped },
        include: { 
          bot: {
            include: {
              equipment: true
            }
          }
        }
      });
      
      return equipment;
    },

    // Use consumable item
    useConsumableItem: async (_: any, { itemId }: { itemId: string }) => {
      const result = await economyService.useConsumableItem(itemId);
      return result;
    },

    // Place furniture
    placeFurniture: async (_: any, { furnitureId, position }: { furnitureId: string; position: any }) => {
      const furniture = await prisma.furniture.update({
        where: { id: furnitureId },
        data: { position },
        include: { 
          house: {
            include: {
              furniture: true
            }
          }
        }
      });
      
      // Update house score
      const houseUpdate = await economyService.updateHouseScore(furniture.house.botId);
      
      // Publish house score update
      pubsub.publish(`HOUSE_SCORE_UPDATED_${furniture.house.botId}`, {
        houseScoreUpdated: houseUpdate
      });
      
      return furniture;
    },

    // Attempt robbery - REMOVED: Robbery functionality removed
    attemptRobbery: async (_: any, _args: { robberId: string; victimId: string }) => {
      // Robbery functionality removed from schema
      return {
        success: false,
        message: 'Robbery functionality has been removed',
        amountStolen: 0
      };
    },

    // Create trade - REMOVED: Trade model no longer exists
    createTrade: async (_: any, _args: {
      initiatorBotId: string;
      receiverBotId: string;
      offeredItems: any;
      requestedItems: any;
    }) => {
      // Trade model removed from schema
      return null;
    },

    // Respond to trade - REMOVED: Trade model no longer exists
    respondToTrade: async (_: any, _args: { tradeId: string; accept: boolean }) => {
      // Trade model removed from schema
      return null;
    },

    // Update house score
    updateHouseScore: async (_: any, { botId }: { botId: string }) => {
      const result = await economyService.updateHouseScore(botId);
      
      // Publish house score update
      pubsub.publish(`HOUSE_SCORE_UPDATED_${botId}`, {
        houseScoreUpdated: result
      });
      
      return result;
    },

    // Initialize bot house
    initializeBotHouse: async (_: any, { botId }: { botId: string }) => {
      const existing = await prisma.botHouse.findUnique({
        where: { botId }
      });
      
      if (existing) {
        return existing;
      }
      
	      return await prisma.botHouse.create({
	        data: {
	          botId,
	          // Stored as a JSON string in the DB schema.
	          worldPosition: JSON.stringify({
	            x: Math.floor(Math.random() * 100),
	            y: Math.floor(Math.random() * 100),
	          })
	        }
	      });
	    },

    // Sync bot inventory to metaverse
    syncBotInventory: async (_: any, { botId }: { botId: string }) => {
      try {
        const response = await axios.post(`${METAVERSE_BACKEND_URL}/api/metaverse/inventory/sync`, { botId });
        return response.data;
      } catch (error: any) {
        console.error('Failed to sync bot inventory:', error.message);
        return {
          success: false,
          syncedItems: 0,
          errors: [error.message || 'Failed to sync inventory'],
        };
      }
    },

    // Sync lootbox to metaverse
    syncLootboxToMetaverse: async (_: any, { lootboxId }: { lootboxId: string }) => {
      try {
        const response = await axios.post(`${METAVERSE_BACKEND_URL}/api/metaverse/lootbox/sync`, { lootboxId });
        return {
          success: response.data.success,
          syncedItems: response.data.success ? 1 : 0,
          errors: response.data.success ? [] : [response.data.message],
        };
      } catch (error: any) {
        console.error('Failed to sync lootbox:', error.message);
        return {
          success: false,
          syncedItems: 0,
          errors: [error.message || 'Failed to sync lootbox'],
        };
      }
    },

    // Sync all pending lootboxes for a bot
    syncAllPendingLootboxes: async (_: any, { botId }: { botId: string }) => {
      try {
        const response = await axios.post(`${METAVERSE_BACKEND_URL}/api/metaverse/lootbox/sync-pending`, { botId });
        return response.data;
      } catch (error: any) {
        console.error('Failed to sync pending lootboxes:', error.message);
        return {
          success: false,
          syncedLootboxes: 0,
          errors: [error.message || 'Failed to sync pending lootboxes'],
        };
      }
    }
  },

  Subscription: {
    // Listen for robbery attempts
    robberyAttempted: {
      subscribe: (_: any, { botId }: { botId: string }) => {
        return (pubsub as any).asyncIterator(`ROBBERY_ATTEMPTED_${botId}`);
      }
    },

    // Listen for trade offers
    tradeReceived: {
      subscribe: (_: any, { botId }: { botId: string }) => {
        return (pubsub as any).asyncIterator(`TRADE_RECEIVED_${botId}`);
      }
    },

    // Listen for house score updates
    houseScoreUpdated: {
      subscribe: (_: any, { botId }: { botId: string }) => {
        return (pubsub as any).asyncIterator(`HOUSE_SCORE_UPDATED_${botId}`);
      }
    }
  },

  // Type resolvers
  BotEquipment: {
    bot: async (parent: any) => {
      if (parent.bot) return parent.bot;
      return await prisma.bot.findUnique({
        where: { id: parent.botId }
      });
    }
  },

  BotHouse: {
    bot: async (parent: any) => {
      if (parent.bot) return parent.bot;
      return await prisma.bot.findUnique({
        where: { id: parent.botId }
      });
    },
    furniture: async (parent: any) => {
      if (parent.furniture) return parent.furniture;
      return await prisma.furniture.findMany({
        where: { houseId: parent.id }
      });
    }
  },

  Furniture: {
    house: async (parent: any) => {
      if (parent.house) return parent.house;
      return await prisma.botHouse.findUnique({
        where: { id: parent.houseId }
      });
    }
  },

  RobberyLog: {
    robberBot: async (parent: any) => {
      if (parent.robberBot) return parent.robberBot;
      return await prisma.bot.findUnique({
        where: { id: parent.robberBotId }
      });
    },
    victimBot: async (parent: any) => {
      if (parent.victimBot) return parent.victimBot;
      return await prisma.bot.findUnique({
        where: { id: parent.victimBotId }
      });
    }
  },

  BotActivityScore: {
    bot: async (parent: any) => {
      if (parent.bot) return parent.bot;
      return await prisma.bot.findUnique({
        where: { id: parent.botId }
      });
    }
  },

  LootboxReward: {
    bot: async (parent: any) => {
      if (parent.bot) return parent.bot;
      return await prisma.bot.findUnique({
        where: { id: parent.botId }
      });
    },
    match: async (parent: any) => {
      if (parent.match) return parent.match;
      return await prisma.match.findUnique({
        where: { id: parent.matchId }
      });
    }
  },

  Trade: {
    initiatorBot: async (parent: any) => {
      if (parent.initiatorBot) return parent.initiatorBot;
      return await prisma.bot.findUnique({
        where: { id: parent.initiatorBotId }
      });
    },
    receiverBot: async (parent: any) => {
      if (parent.receiverBot) return parent.receiverBot;
      return await prisma.bot.findUnique({
        where: { id: parent.receiverBotId }
      });
    }
  }
};
