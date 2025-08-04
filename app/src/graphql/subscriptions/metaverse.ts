import { gql } from '@apollo/client';

export const METAVERSE_BOT_UPDATE_SUBSCRIPTION = gql`
  subscription MetaverseBotUpdate($botIds: [ID!]) {
    metaverseBotUpdate(botIds: $botIds) {
      botId
      zone
      position {
        x
        y
        worldInstanceId
      }
      action {
        type
        target
        result
        timestamp
      }
      personality
      syncStatus
    }
  }
`;

export const ZONE_ACTIVITY_SUBSCRIPTION = gql`
  subscription ZoneActivity($zone: String!) {
    zoneActivity(zone: $zone) {
      zone
      activityType
      botId
      botName
      targetBotId
      targetBotName
      details
      timestamp
    }
  }
`;

export const METAVERSE_STATS_SUBSCRIPTION = gql`
  subscription MetaverseStats {
    metaverseStats {
      totalBots
      zoneDistribution {
        zone
        count
        percentage
      }
      recentActivity {
        type
        count
      }
      personalityDistribution {
        personality
        count
        percentage
      }
    }
  }
`;