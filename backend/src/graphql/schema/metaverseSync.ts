import { gql } from 'graphql-tag';

export const metaverseSyncTypeDefs = gql`
  type BotSync {
    id: ID!
    botId: String!
    bot: Bot!
    syncStatus: SyncStatus!
    lastSyncedAt: DateTime
    syncErrors: [String!]!
    convexWorldId: String
    convexAgentId: String
    convexPlayerId: String
    personalityMapped: Boolean!
    positionSynced: Boolean!
    statsSynced: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  enum SyncStatus {
    PENDING
    SYNCING
    SYNCED
    FAILED
    DISABLED
  }

  type MetaversePosition {
    x: Float!
    y: Float!
    worldInstanceId: String!
  }

  type MetaverseInfo {
    agentId: String
    playerId: String
    worldId: String
    zone: String
    position: MetaversePosition
    lastZoneChange: DateTime
    syncStatus: SyncStatus
    lastSyncedAt: DateTime
  }

  type BotMetaverseData {
    bot: Bot!
    metaverse: MetaverseInfo
  }

  type RegisterBotResponse {
    success: Boolean!
    message: String!
    botSync: BotSync
    metaverseInfo: MetaverseInfo
  }

  type SyncStatsResponse {
    success: Boolean!
    message: String!
    stats: JSON
  }

  type UpdateZoneResponse {
    success: Boolean!
    message: String!
    zone: String!
    position: MetaversePosition!
    worldInstanceId: String!
  }

  input PositionInput {
    x: Float!
    y: Float!
  }

  extend type Query {
    # Get bot sync status
    getBotSyncStatus(botId: ID!): BotSync
    
    # Get all bots in a specific zone
    getBotsInZone(zone: String!): [Bot!]!
    
    # Get bot metaverse info
    getBotMetaverseInfo(botId: ID!): BotMetaverseData
  }

  extend type Mutation {
    # Register an AI Arena bot in AI Town metaverse
    registerBotInMetaverse(botId: ID!): RegisterBotResponse!
    
    # Sync bot stats from AI Arena to AI Town
    syncBotStats(botId: ID!): SyncStatsResponse!
    
    # Update bot zone position
    updateBotZone(
      botId: ID!
      newZone: String!
      position: PositionInput!
    ): UpdateZoneResponse!
  }

  # Extend Bot type with metaverse fields
  extend type Bot {
    # Metaverse integration
    metaverseAgentId: String
    currentZone: String
    metaversePosition: MetaversePosition
    lastZoneChange: DateTime
    botSync: BotSync
  }
`;