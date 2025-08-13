import { gql } from 'graphql-tag';
import { deploymentTypeDefs } from './deployment';
import { metaverseSyncTypeDefs } from './metaverseSync';

// Base type definitions
const baseTypeDefs = gql`
  scalar JSON
  scalar DateTime

  enum BotPersonality {
    CRIMINAL
    GAMBLER
    WORKER
  }

  enum ZoneType {
    casino
    darkAlley
    suburb
    downtown
    underground
  }

  enum ChannelType {
    MAIN
    PRODUCTION
    STAGING
    DEVELOPMENT
    BETA
  }

  enum ChannelStatus {
    ACTIVE
    INACTIVE
    MAINTENANCE
    FULL
  }

  type Bot {
    id: ID!
    tokenId: Int!
    name: String!
    avatar: String
    personality: BotPersonality!
    modelType: String!
    isDeployed: Boolean!
    metaverseAgentId: String
    metaversePlayerId: String
    currentZone: ZoneType
    position: Position
    stats: BotStats!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Position {
    x: Float!
    y: Float!
  }

  type BotStats {
    level: Int!
    experience: Int!
    power: Int!
    defense: Int!
    speed: Int!
    bloodTokens: Int!
    energy: Int!
  }

  type World {
    id: ID!
    name: String!
    status: String!
    maxPlayers: Int!
    currentPlayers: Int!
    zones: [Zone!]!
  }

  type Zone {
    id: ID!
    type: ZoneType!
    worldId: ID!
    playerCount: Int!
    maxPlayers: Int!
    activities: [String!]!
  }

  type ActivityLog {
    id: ID!
    botId: ID!
    playerId: String!
    action: String!
    description: String!
    zone: ZoneType
    timestamp: DateTime!
    metadata: JSON
  }

  type Channel {
    id: ID!
    name: String!
    type: ChannelType!
    status: ChannelStatus!
    currentBots: Int!
    maxBots: Int!
    loadPercentage: Float!
    worldId: String
    region: String
    metadata: JSON
  }

  type ChannelStats {
    total: Int!
    active: Int!
    inactive: Int!
    full: Int!
    byType: [TypeStats!]!
  }

  type TypeStats {
    type: ChannelType!
    count: Int!
    activeCount: Int!
  }

  type Query {
    # Bot queries
    getBot(id: ID!): Bot
    getBotByTokenId(tokenId: Int!): Bot
    getDeployedBots: [Bot!]!
    
    # World queries
    getWorlds: [World!]!
    getWorld(id: ID!): World
    getAvailableWorlds: [World!]!
    
    # Activity queries
    getActivityLogs(botId: ID, limit: Int): [ActivityLog!]!
    getBotActivities(botId: ID!, limit: Int): [ActivityLog!]!

    # Channel queries
    channels(type: String, status: String): [Channel!]!
    channel(id: ID!): Channel
    channelByName(name: String!): Channel
    channelStats: ChannelStats!
    channelHealth(name: String!): ChannelHealth!
    myBotChannels: [Channel!]!
  }

  type ChannelHealth {
    healthy: Boolean!
    channel: String!
    status: ChannelStatus!
    worldId: String
    worldActive: Boolean!
    currentLoad: Float!
    errors: [String!]!
  }

  type ChannelOperationResult {
    success: Boolean!
    message: String!
    channel: Channel
  }

  type Mutation {
    # Bot operations
    deployBot(
      botId: ID!
      worldId: ID!
      personality: BotPersonality!
      modelType: String!
    ): Bot
    
    updateBotPosition(
      botId: ID!
      position: PositionInput!
      zone: ZoneType!
    ): Bot
    
    syncBotStats(
      botId: ID!
      stats: BotStatsInput!
    ): Bot
    
    # World operations
    createWorld(name: String!): World
    heartbeatWorld(worldId: ID!): World

    # Channel operations
    createChannel(
      name: String!
      type: ChannelType!
      maxBots: Int!
      region: String
    ): ChannelOperationResult!
    
    updateChannelStatus(
      channelId: ID!
      status: ChannelStatus!
    ): ChannelOperationResult!
    
    initializeChannel(
      name: String!
      worldId: String!
    ): ChannelOperationResult!
    
    cleanupChannel(name: String!): ChannelOperationResult!
    
    switchChannel(
      botId: ID!
      targetChannel: String!
    ): ChannelOperationResult!
  }

  type Subscription {
    # Real-time bot updates
    botPositionUpdated(botId: ID): Bot
    botDeployed: Bot
    
    # Activity stream
    activityLogAdded(botId: ID): ActivityLog
    
    # World updates
    worldStatusChanged: World
  }

  input PositionInput {
    x: Float!
    y: Float!
  }

  input BotStatsInput {
    level: Int
    experience: Int
    power: Int
    defense: Int
    speed: Int
    bloodTokens: Int
    energy: Int
  }
`;

// Combine all type definitions
export const typeDefs = [
  baseTypeDefs,
  deploymentTypeDefs,
  metaverseSyncTypeDefs
];

export default typeDefs;