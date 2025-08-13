import { gql } from '@apollo/client';

export const GET_BOT_METAVERSE_STATUS = gql`
  query GetBotMetaverseStatus($botId: ID!) {
    getBotMetaverseStatus(botId: $botId) {
      isDeployed
      syncStatus
      lastSyncedAt
      agentId
      worldId
      playerId
    }
  }
`;

export const GET_DEPLOYED_BOTS = gql`
  query GetDeployedBots {
    getDeployedBots {
      id
      name
      personality
      agentId
      worldId
      syncStatus
      lastSyncedAt
    }
  }
`;

export const IS_BOT_SYNC_NEEDED = gql`
  query IsBotSyncNeeded($botId: ID!) {
    isBotSyncNeeded(botId: $botId)
  }
`;

export const GET_BOTS_NEEDING_SYNC = gql`
  query GetBotsNeedingSync($limit: Int) {
    getBotsNeedingSync(limit: $limit)
  }
`;