import { gql } from 'graphql-tag';

export const metaverseSyncTypeDefs = gql`
  enum SyncStatus {
    PENDING
    SYNCING
    SYNCED
    FAILED
    DISABLED
  }

  type BotSync {
    id: ID!
    botId: ID!
    syncStatus: SyncStatus!
    convexAgentId: String
    convexWorldId: String
    convexPlayerId: String
    errorMessage: String
    lastSyncAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type SyncResult {
    success: Boolean!
    message: String!
    botSync: BotSync
  }

  type MetaverseStatus {
    isDeployed: Boolean!
    syncStatus: SyncStatus!
    lastSyncAt: DateTime
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
    lastSyncAt: DateTime
  }

  extend type Query {
    # Get bot metaverse status
    getBotMetaverseStatus(botId: ID!): MetaverseStatus!
    
    # Get all deployed bots
    getDeployedBotsInMetaverse: [DeployedBot!]!
  }

  extend type Mutation {
    # Register bot in metaverse
    registerBotInMetaverse(botId: ID!): SyncResult!
    
    # Sync bot stats with metaverse
    syncBotWithMetaverse(botId: ID!): SyncResult!
    
    # Update bot position in metaverse
    updateBotMetaversePosition(
      botId: ID!
      zone: String!
      position: PositionInput
    ): SyncResult!
  }
`;