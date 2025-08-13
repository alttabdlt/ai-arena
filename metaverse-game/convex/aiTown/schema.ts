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
  
  // NOTE: zones table removed - not used in current implementation
  // Zone management is handled through worldInstances instead
  
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
      v.literal('message'),
      v.literal('relationship_milestone'),
      v.literal('marriage'),
      v.literal('friendship_formed'),
      v.literal('rivalry_formed'),
      // Idle game tracking
      v.literal('xp_gained'),
      v.literal('level_up')
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
      // Idle game fields
      newLevel: v.optional(v.number()),
      rarity: v.optional(v.string()),
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
      v.literal('SWORD'),     // Renamed from WEAPON
      v.literal('ARMOR'),
      v.literal('TOOL'),
      v.literal('ACCESSORY'),
      v.literal('POTION'),    // New: consumable items
      v.literal('BOOTS'),     // New: footwear
      v.literal('GUN'),       // New: ranged weapons
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
      v.literal('LEGENDARY'),
      v.literal('GOD_TIER')   // Added GOD_TIER rarity
    ),
    powerBonus: v.number(),
    defenseBonus: v.number(),
    scoreBonus: v.optional(v.number()), // For furniture
    
    // New consumable fields
    consumable: v.optional(v.boolean()),
    quantity: v.optional(v.number()),    // Stack count for consumables
    uses: v.optional(v.number()),        // Current uses remaining
    maxUses: v.optional(v.number()),     // Maximum uses
    
    // Additional bonuses for new equipment types
    speedBonus: v.optional(v.number()),     // Movement speed (boots)
    agilityBonus: v.optional(v.number()),   // Dodge/accuracy (boots, accessories)
    rangeBonus: v.optional(v.number()),     // Attack range (guns)
    healingPower: v.optional(v.number()),   // Healing amount (potions)
    duration: v.optional(v.number()),       // Effect duration in seconds (buff potions)
    
    equipped: v.boolean(),
    // houseId: v.optional(v.id('houses')), // TODO: Re-enable when houses are implemented
    // position: v.optional(v.object({      // TODO: Re-enable for house furniture placement
    //   x: v.number(),
    //   y: v.number(),
    //   rotation: v.number()
    // }))
    metadata: v.object({
      description: v.optional(v.string()),
      specialEffect: v.optional(v.string()),
      tradeable: v.optional(v.boolean()),
      condition: v.optional(v.number()), // 0-100 durability
    }),
    createdAt: v.number(),
  })
    .index('owner', ['worldId', 'ownerId'])
    .index('equipped', ['worldId', 'ownerId', 'equipped']),
    // .index('house', ['worldId', 'houseId']), // TODO: Re-enable when houses are implemented
  
  // NOTE: houses table removed - not implemented in current system
  // House functionality will be added in future phases
  
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
      v.literal('LEGENDARY'),
      v.literal('GOD_TIER')
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
  
  // Relationship scores between bots (sparse - only non-default stored)
  relationships: defineTable({
    worldId: v.id('worlds'),
    fromPlayer: playerId,
    toPlayer: playerId,
    
    // Relationship stage progression
    stage: v.union(
      v.literal('stranger'),
      v.literal('acquaintance'),
      v.literal('friend'),
      v.literal('best_friend'),
      v.literal('lover'),
      v.literal('married'),
      v.literal('rival'),
      v.literal('enemy'),
      v.literal('nemesis')
    ),
    
    // Core relationship metrics (-100 to 100, except fear 0-100)
    respect: v.number(),
    fear: v.number(),
    trust: v.number(),
    loyalty: v.number(),
    revenge: v.number(),
    
    // Friendship milestone tracking (0-100)
    friendshipScore: v.number(),
    
    // Economic tracking
    debt: v.number(), // Negative = they owe me, Positive = I owe them
    
    // Metadata
    lastInteraction: v.number(),
    interactionCount: v.number(),
    marriedAt: v.optional(v.number()), // Timestamp when married
  })
  .index('fromTo', ['worldId', 'fromPlayer', 'toPlayer'])
  .index('toFrom', ['worldId', 'toPlayer', 'fromPlayer'])
  .index('lastInteraction', ['worldId', 'lastInteraction'])
  .index('stage', ['worldId', 'stage']),
  
  // Global reputation scores
  reputations: defineTable({
    worldId: v.id('worlds'),
    playerId: playerId,
    
    // Global metrics affecting all relationships
    globalRespect: v.number(),    // Overall respect in the world
    dangerLevel: v.number(),      // How dangerous they are
    reliability: v.number(),       // Trade/deal reliability
    
    // Crime statistics
    robberyCount: v.number(),
    combatWins: v.number(),
    combatLosses: v.number(),
    successfulTrades: v.number(),
    
    lastUpdated: v.number(),
  })
  .index('player', ['worldId', 'playerId'])
  .index('respect', ['worldId', 'globalRespect']),
  
  // NOTE: factions table removed - not implemented yet
  // Faction system will be added when alliance/betrayal mechanics are built
  
  // Marriage registry for tracking married bot couples
  marriages: defineTable({
    worldId: v.id('worlds'),
    partner1: playerId,
    partner2: playerId,
    marriedAt: v.number(),
    
    // Marriage bonuses and perks
    combinedPowerBonus: v.number(), // Additional power when fighting together
    combinedDefenseBonus: v.number(), // Additional defense when protecting each other
    sharedInventory: v.boolean(), // Can share items
    
    // Marriage milestones
    anniversaryCount: v.number(),
    lastAnniversary: v.optional(v.number()),
    
    // Special rewards granted
    godTierEquipmentGranted: v.boolean(),
    
    // Status
    active: v.boolean(), // False if divorced/widowed
    endedAt: v.optional(v.number()),
    endReason: v.optional(v.union(v.literal('divorce'), v.literal('death'))),
  })
  .index('partners', ['worldId', 'partner1', 'partner2'])
  .index('active', ['worldId', 'active'])
  .index('marriedAt', ['worldId', 'marriedAt']),
  
  // Pending bot registrations queue for batch processing
  pendingBotRegistrations: defineTable({
    worldId: v.id('worlds'),
    name: v.string(),
    character: v.string(),
    identity: v.string(),
    plan: v.string(),
    aiArenaBotId: v.string(),
    initialZone: v.string(),
    avatar: v.optional(v.string()),
    status: v.union(
      v.literal('pending'),
      v.literal('processing'),
      v.literal('completed'),
      v.literal('failed')
    ),
    createdAt: v.number(),
    processedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    result: v.optional(v.object({
      agentId: v.string(),
      playerId: v.string(),
      inputId: v.optional(v.id('inputs')),
    })),
    error: v.optional(v.string()),
    retryCount: v.optional(v.number()),
  })
    .index('status', ['status', 'createdAt'])
    .index('worldId', ['worldId', 'status'])
    .index('aiArenaBotId', ['aiArenaBotId']),
  
  // Bot experience and leveling system
  botExperience: defineTable({
    worldId: v.id('worlds'),
    playerId: playerId,
    aiArenaBotId: v.string(),
    
    // Avatar rarity (affects stat growth and XP multipliers)
    avatarRarity: v.optional(v.union(
      v.literal('COMMON'),
      v.literal('UNCOMMON'),
      v.literal('RARE'),
      v.literal('EPIC'),
      v.literal('LEGENDARY')
    )),
    
    // Core XP/Level
    level: v.number(),
    currentXP: v.number(),
    totalXP: v.number(),
    xpToNextLevel: v.number(),
    
    // Category XP (for specialized progression)
    combatXP: v.number(),
    socialXP: v.number(),
    criminalXP: v.number(),
    gamblingXP: v.number(),
    tradingXP: v.number(),
    
    // Prestige system (for level 50+ bots)
    prestigeLevel: v.number(),
    prestigeTokens: v.number(),
    
    // Skill points
    skillPoints: v.number(),
    allocatedSkills: v.object({
      strength: v.optional(v.number()),
      agility: v.optional(v.number()),
      defense: v.optional(v.number()),
      charisma: v.optional(v.number()),
      luck: v.optional(v.number()),
      stealth: v.optional(v.number()),
      intelligence: v.optional(v.number()),
    }),
    
    // Tracking
    lastXPGain: v.number(),
    lastLevelUp: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('player', ['worldId', 'playerId'])
    .index('aiArenaBotId', ['worldId', 'aiArenaBotId'])
    .index('level', ['worldId', 'level']),
  
  // Track when players were last viewed (for idle gains calculations)
  playerLastViewed: defineTable({
    worldId: v.id('worlds'),
    playerId: v.string(),
    timestamp: v.number(),
  })
    .index('by_player', ['worldId', 'playerId']),
};
