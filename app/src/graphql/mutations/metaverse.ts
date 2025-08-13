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
        errorMessage
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

export const BATCH_REGISTER_BOTS_IN_METAVERSE = gql`
  mutation BatchRegisterBotsInMetaverse($botIds: [ID!]!, $batchSize: Int) {
    batchRegisterBotsInMetaverse(botIds: $botIds, batchSize: $batchSize) {
      success
      message
      totalProcessed
      successCount
      failedCount
      failedBotIds
      results {
        botId
        success
        message
        syncStatus
        errorMessage
      }
    }
  }
`;

export const BATCH_SYNC_BOTS_WITH_METAVERSE = gql`
  mutation BatchSyncBotsWithMetaverse($botIds: [ID!]!, $batchSize: Int) {
    batchSyncBotsWithMetaverse(botIds: $botIds, batchSize: $batchSize) {
      success
      message
      totalProcessed
      successCount
      failedCount
      failedBotIds
      results {
        botId
        success
        message
        syncStatus
        errorMessage
      }
    }
  }
`;

export const CLEANUP_INACTIVE_BOT_SYNCS = gql`
  mutation CleanupInactiveBotSyncs($daysInactive: Int) {
    cleanupInactiveBotSyncs(daysInactive: $daysInactive)
  }
`;