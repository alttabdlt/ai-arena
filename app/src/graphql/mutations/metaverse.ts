import { gql } from '@apollo/client';

export const REGISTER_BOT_IN_METAVERSE = gql`
  mutation RegisterBotInMetaverse($botId: ID!) {
    registerBotInMetaverse(botId: $botId) {
      success
      message
      botSync {
        id
        botId
        syncStatus
        lastSyncedAt
        convexWorldId
        convexAgentId
        convexPlayerId
        personalityMapped
        positionSynced
        statsSynced
      }
      metaverseInfo {
        agentId
        playerId
        worldId
        zone
        position {
          x
          y
          worldInstanceId
        }
        lastZoneChange
        syncStatus
        lastSyncedAt
      }
    }
  }
`;

export const SYNC_BOT_STATS = gql`
  mutation SyncBotStats($botId: ID!) {
    syncBotStats(botId: $botId) {
      success
      message
      stats
    }
  }
`;

export const UPDATE_BOT_ZONE = gql`
  mutation UpdateBotZone($botId: ID!, $newZone: String!, $position: PositionInput!) {
    updateBotZone(botId: $botId, newZone: $newZone, position: $position) {
      success
      message
      zone
      position {
        x
        y
        worldInstanceId
      }
    }
  }
`;

export const BATCH_REGISTER_BOTS = gql`
  mutation BatchRegisterBots($botIds: [ID!]!) {
    batchRegisterBots(botIds: $botIds) {
      success
      message
      registeredCount
      failedCount
      results {
        botId
        success
        message
        syncStatus
      }
    }
  }
`;