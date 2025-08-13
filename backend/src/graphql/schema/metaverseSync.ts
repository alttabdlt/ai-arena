import { gql } from 'graphql-tag';

export const metaverseSyncTypeDefs = gql`
  enum SyncStatus {
    PENDING
    IN_PROGRESS
    SYNCED
    FAILED
  }

  type BotSync {
    id: ID!
    botId: ID!
    syncStatus: SyncStatus!
    convexAgentId: String
    convexWorldId: String
    convexPlayerId: String
    errorMessage: String
    lastSyncedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type SyncResult {
    success: Boolean!
    message: String!
    botSync: BotSync
  }

  type BatchSyncResult {
    success: Boolean!
    message: String!
    totalProcessed: Int!
    successCount: Int!
    failedCount: Int!
    failedBotIds: [String!]!
    results: [BotSyncStatus!]!
  }

  type BotSyncStatus {
    botId: ID!
    success: Boolean!
    message: String
    syncStatus: SyncStatus
    errorMessage: String
  }

  type MetaverseStatus {
    hasMetaverseAgent: Boolean!
    syncStatus: SyncStatus!
    lastSyncedAt: DateTime
    agentId: String
    worldId: String
    playerId: String
  }

  type DeployedBot {
    id: ID!
    name: String!
    personality: BotPersonality!
    agentId: String
    worldId: String
    syncStatus: SyncStatus
    lastSyncedAt: DateTime
  }

  input PositionInput {
    x: Float!
    y: Float!
  }

  extend type Query {
    # Get bot metaverse status
    getBotMetaverseStatus(botId: ID!): MetaverseStatus!
    
    # Get all deployed bots
    getDeployedBots: [DeployedBot!]!
    
    # Check if bot needs sync (for optimization)
    isBotSyncNeeded(botId: ID!): Boolean!
    
    # Get count of bots needing sync
    getBotsNeedingSync(limit: Int = 100): [String!]!
  }

  extend type Mutation {
    # Register bot in metaverse
    registerBotInMetaverse(botId: ID!): SyncResult!
    
    # Batch register multiple bots in metaverse (for scale)
    batchRegisterBotsInMetaverse(
      botIds: [ID!]!
      batchSize: Int = 50
    ): BatchSyncResult!
    
    # Sync bot stats with metaverse
    syncBotWithMetaverse(botId: ID!): SyncResult!
    
    # Batch sync multiple bot stats (for scale)
    batchSyncBotsWithMetaverse(
      botIds: [ID!]!
      batchSize: Int = 50
    ): BatchSyncResult!
    
    # Update bot position in metaverse
    updateBotMetaversePosition(
      botId: ID!
      zone: String!
      position: PositionInput
    ): SyncResult!
    
    # Clean up inactive bot syncs (for scale management)
    cleanupInactiveBotSyncs(daysInactive: Int = 7): Int!
  }
`;