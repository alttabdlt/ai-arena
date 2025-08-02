import { gql } from '@apollo/client';

export const GET_BOT_DETAIL = gql`
  query GetBotDetail($id: String!) {
    bot(id: $id) {
      id
      name
      avatar
      prompt
      modelType
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