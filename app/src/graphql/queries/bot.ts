import { gql } from '@apollo/client';

export const GET_BOT_DETAIL = gql`
  query GetBotDetail($id: String!) {
    bot(id: $id) {
      id
      tokenId
      name
      avatar
      prompt
      modelType
      personality
      isActive
      isDemo
      createdAt
      updatedAt
      creator {
        id
        address
        username
      }
      stats {
        wins
        losses
        earnings
        winRate
        avgFinishPosition
      }
      socialStats {
        likes
        comments
        followers
      }
      energy {
        currentEnergy
        maxEnergy
        isPaused
        consumptionRate
        regenerationRate
        netConsumption
      }
      queuePosition
      queueEntries {
        id
        queueType
        status
        enteredAt
        expiresAt
      }
      currentMatch {
        id
        type
        status
        startedAt
        participants {
          bot {
            id
            name
            avatar
          }
        }
      }
      metaverseAgentId
      currentZone
      metaversePosition
      lastZoneChange
    }
  }
`;

export const GET_BOT_MATCHES = gql`
  query GetBotMatches($botId: String!, $limit: Int, $offset: Int) {
    matches(filter: { botId: $botId }, limit: $limit, offset: $offset) {
      id
      type
      status
      createdAt
      completedAt
      participants {
        bot {
          id
          name
          avatar
        }
        finalRank
        points
      }
      winner {
        id
        name
      }
      gameHistory
    }
  }
`;

export const GET_BOTS = gql`
  query GetBots($filter: BotFilter, $sort: BotSort, $limit: Int, $offset: Int) {
    bots(filter: $filter, sort: $sort, limit: $limit, offset: $offset) {
      id
      name
      avatar
      modelType
      personality
      isActive
      isDemo
      channel
      createdAt
      creator {
        id
        address
        username
      }
      stats {
        wins
        losses
        earnings
        winRate
        avgFinishPosition
      }
      socialStats {
        likes
        comments
        followers
      }
      queuePosition
      currentMatch {
        id
        type
        status
        startedAt
      }
    }
  }
`;

export const GET_TOP_BOTS = gql`
  query GetTopBots($limit: Int) {
    topBots(limit: $limit) {
      id
      tokenId
      name
      avatar
      modelType
      personality
      isActive
      isDemo
      createdAt
      creator {
        id
        address
        username
      }
      stats {
        wins
        losses
        earnings
        winRate
        avgFinishPosition
      }
      socialStats {
        likes
        comments
        followers
      }
      energy {
        currentEnergy
        maxEnergy
        isPaused
        consumptionRate
        regenerationRate
        netConsumption
      }
      queuePosition
    }
  }
`;

export const GET_RECENT_BOTS = gql`
  query GetRecentBots($limit: Int) {
    recentBots(limit: $limit) {
      id
      name
      avatar
      modelType
      isActive
      isDemo
      createdAt
      creator {
        id
        address
        username
      }
      stats {
        wins
        losses
        earnings
        winRate
        avgFinishPosition
      }
      socialStats {
        likes
        comments
        followers
      }
      queuePosition
    }
  }
`;

export const GET_MATCH = gql`
  query GetMatch($id: String!) {
    match(id: $id) {
      id
      type
      status
      createdAt
      startedAt
      completedAt
      gameHistory
      tournament {
        id
        name
        type
      }
      participants {
        position
        finalRank
        points
        bot {
          id
          name
          avatar
          modelType
          prompt
          creator {
            id
            address
            username
          }
          stats {
            wins
            losses
            winRate
          }
        }
      }
    }
  }
`;

export const GET_METAVERSE_BOTS = gql`
  query GetMetaverseBots($limit: Int) {
    bots(limit: $limit) {
      id
      name
      avatar
      personality
      isActive
      stats {
        wins
        losses
      }
      metaverseAgentId
      currentZone
      metaversePosition {
        x
        y
        worldInstanceId
      }
      lastZoneChange
      botSync {
        syncStatus
        lastSyncedAt
        convexWorldId
      }
    }
  }
`;

export const GET_BOT_WITH_HOUSE = gql`
  query GetBotWithHouse($id: String!) {
    bot(id: $id) {
      id
      tokenId
      name
      house {
        id
        houseScore
        defenseLevel
        furniture {
          id
          name
          furnitureType
          rarity
          scoreBonus
          defenseBonus
          position
          size
          synergies
          description
        }
      }
    }
  }
`;