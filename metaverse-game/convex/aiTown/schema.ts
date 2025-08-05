import { v } from 'convex/values';
import { defineTable } from 'convex/server';
import { serializedPlayer } from './player';
import { serializedPlayerDescription } from './playerDescription';
import { serializedAgent } from './agent';
import { serializedAgentDescription } from './agentDescription';
import { serializedWorld } from './world';
import { serializedWorldMap } from './worldMap';
import { serializedConversation } from './conversation';
import { conversationId, playerId } from './ids';
import { ZoneType, zonePortals, instanceConfig } from './zoneConfig';

export const aiTownTables = {
  // This table has a single document that stores all players, conversations, and agents. This
  // data is small and changes regularly over time.
  worlds: defineTable({ ...serializedWorld }),

  // Worlds can be started or stopped by the developer or paused for inactivity, and this
  // infrequently changing document tracks this world state.
  worldStatus: defineTable({
    worldId: v.id('worlds'),
    isDefault: v.boolean(),
    engineId: v.id('engines'),
    lastViewed: v.number(),
    status: v.union(v.literal('running'), v.literal('stoppedByDeveloper'), v.literal('inactive')),
  }).index('worldId', ['worldId']),

  // This table contains the map data for a given world. Since it's a bit larger than the player
  // state and infrequently changes, we store it in a separate table.
  maps: defineTable({
    worldId: v.id('worlds'),
    ...serializedWorldMap,
  }).index('worldId', ['worldId']),

  // Human readable text describing players and agents that's stored in separate tables, just like `maps`.
  playerDescriptions: defineTable({
    worldId: v.id('worlds'),
    ...serializedPlayerDescription,
  }).index('worldId', ['worldId', 'playerId']),
  agentDescriptions: defineTable({
    worldId: v.id('worlds'),
    ...serializedAgentDescription,
  }).index('worldId', ['worldId', 'agentId']),

  //The game engine doesn't want to track players that have left or conversations that are over, since
  // it wants to keep its managed state small. However, we may want to look at old conversations in the
  // UI or from the agent code. So, whenever we delete an entry from within the world's document, we
  // "archive" it within these tables.
  archivedPlayers: defineTable({ worldId: v.id('worlds'), ...serializedPlayer }).index('worldId', [
    'worldId',
    'id',
  ]),
  archivedConversations: defineTable({
    worldId: v.id('worlds'),
    id: conversationId,
    creator: playerId,
    created: v.number(),
    ended: v.number(),
    lastMessage: serializedConversation.lastMessage,
    numMessages: serializedConversation.numMessages,
    participants: v.array(playerId),
  }).index('worldId', ['worldId', 'id']),
  archivedAgents: defineTable({ worldId: v.id('worlds'), ...serializedAgent }).index('worldId', [
    'worldId',
    'id',
  ]),

  // The agent layer wants to know what the last (completed) conversation was between two players,
  // so this table represents a labelled graph indicating which players have talked to each other.
  participatedTogether: defineTable({
    worldId: v.id('worlds'),
    conversationId,
    player1: playerId,
    player2: playerId,
    ended: v.number(),
  })
    .index('edge', ['worldId', 'player1', 'player2', 'ended'])
    .index('conversation', ['worldId', 'player1', 'conversationId'])
    .index('playerHistory', ['worldId', 'player1', 'ended']),
  
  // Zone management tables for the crime metaverse
  zones: defineTable({
    zoneType: ZoneType,
    name: v.string(),
    mapId: v.id('maps'),
    maxPlayers: v.number(),
    maxBots: v.number(),
    currentPlayers: v.number(),
    currentBots: v.number(),
  }).index('zoneType', ['zoneType']),
  
  // World instances per zone for scaling
  worldInstances: defineTable({
    zoneType: ZoneType,
    worldId: v.id('worlds'),
    instanceNumber: v.number(),
    status: v.union(v.literal('active'), v.literal('full'), v.literal('maintenance')),
    currentPlayers: v.number(),
    currentBots: v.number(),
    serverRegion: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('zoneWorld', ['zoneType', 'worldId'])
    .index('status', ['status', 'zoneType']),
  
  // Portal connections between zones
  zonePortals: defineTable(zonePortals)
    .index('fromZone', ['fromZone'])
    .index('toZone', ['toZone']),
  
  // Track player zone transitions
  playerZoneHistory: defineTable({
    playerId: playerId,
    fromZone: v.optional(ZoneType),
    toZone: ZoneType,
    timestamp: v.number(),
    worldInstanceId: v.id('worldInstances'),
  }).index('player', ['playerId', 'timestamp']),
  
  // Activity logs for bots
  activityLogs: defineTable({
    worldId: v.id('worlds'),
    playerId: playerId,
    agentId: v.optional(v.string()),
    aiArenaBotId: v.optional(v.string()),
    timestamp: v.number(),
    type: v.union(
      v.literal('zone_change'),
      v.literal('conversation_start'),
      v.literal('conversation_end'),
      v.literal('robbery_attempt'),
      v.literal('combat'),
      v.literal('knocked_out'),
      v.literal('hospital_recovery'),
      v.literal('activity_start'),
      v.literal('activity_end'),
      v.literal('item_collected'),
      v.literal('trade'),
      v.literal('message')
    ),
    description: v.string(),
    emoji: v.optional(v.string()),
    details: v.optional(v.object({
      zone: v.optional(v.string()),
      targetPlayer: v.optional(playerId),
      success: v.optional(v.boolean()),
      amount: v.optional(v.number()),
      item: v.optional(v.string()),
      message: v.optional(v.string()),
    })),
  })
    .index('player', ['worldId', 'playerId', 'timestamp'])
    .index('agent', ['worldId', 'agentId', 'timestamp'])
    .index('aiArenaBotId', ['worldId', 'aiArenaBotId', 'timestamp']),
  
  // Item system for bot inventories
  items: defineTable({
    worldId: v.id('worlds'),
    ownerId: playerId, // Bot/player who owns this item
    itemId: v.string(), // Unique item ID from AI Arena
    name: v.string(),
    type: v.union(
      v.literal('WEAPON'),
      v.literal('ARMOR'),
      v.literal('TOOL'),
      v.literal('ACCESSORY'),
      v.literal('FURNITURE')
    ),
    category: v.optional(v.union(
      v.literal('DECORATION'),
      v.literal('FUNCTIONAL'),
      v.literal('DEFENSIVE'),
      v.literal('TROPHY')
    )), // For furniture items
    rarity: v.union(
      v.literal('COMMON'),
      v.literal('UNCOMMON'),
      v.literal('RARE'),
      v.literal('EPIC'),
      v.literal('LEGENDARY')
    ),
    powerBonus: v.number(),
    defenseBonus: v.number(),
    scoreBonus: v.optional(v.number()), // For furniture
    equipped: v.boolean(),
    houseId: v.optional(v.id('houses')), // If placed in a house
    position: v.optional(v.object({
      x: v.number(),
      y: v.number(),
      rotation: v.number()
    })), // Position if placed in house
    metadata: v.object({
      description: v.optional(v.string()),
      specialEffect: v.optional(v.string()),
      tradeable: v.optional(v.boolean()),
      condition: v.optional(v.number()), // 0-100 durability
    }),
    createdAt: v.number(),
  })
    .index('owner', ['worldId', 'ownerId'])
    .index('equipped', ['worldId', 'ownerId', 'equipped'])
    .index('house', ['worldId', 'houseId']),
  
  // Houses for bots
  houses: defineTable({
    worldId: v.id('worlds'),
    ownerId: playerId, // Bot who owns this house
    houseScore: v.number(),
    defenseLevel: v.number(),
    gridSize: v.object({
      width: v.number(),
      height: v.number(),
    }),
    worldPosition: v.object({
      x: v.number(),
      y: v.number(),
      zone: v.string(), // Which zone the house is in
    }),
    lastRobbed: v.optional(v.number()),
    robberyCooldown: v.optional(v.number()),
    visitors: v.array(playerId), // Recent visitors
    partyActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('owner', ['worldId', 'ownerId'])
    .index('zone', ['worldId', 'worldPosition.zone']),
  
  // Bot inventories tracking
  inventories: defineTable({
    worldId: v.id('worlds'),
    playerId: playerId,
    maxSlots: v.number(), // Inventory capacity
    usedSlots: v.number(),
    lastUpdated: v.number(),
    totalValue: v.number(), // Calculated total value for robbery assessment
  })
    .index('player', ['worldId', 'playerId']),
  
  // Lootbox queue for processing
  lootboxQueue: defineTable({
    worldId: v.id('worlds'),
    playerId: playerId,
    aiArenaBotId: v.string(),
    lootboxId: v.string(),
    rarity: v.union(
      v.literal('COMMON'),
      v.literal('UNCOMMON'),
      v.literal('RARE'),
      v.literal('EPIC'),
      v.literal('LEGENDARY')
    ),
    rewards: v.array(v.object({
      itemId: v.string(),
      name: v.string(),
      type: v.string(),
      rarity: v.string(),
      stats: v.object({
        powerBonus: v.number(),
        defenseBonus: v.number(),
        scoreBonus: v.optional(v.number()),
      }),
    })),
    processed: v.boolean(),
    openedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('player', ['worldId', 'playerId', 'processed'])
    .index('aiArenaBotId', ['worldId', 'aiArenaBotId']),
};
