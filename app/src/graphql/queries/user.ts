import { gql } from '@apollo/client';

export const GET_ME = gql`
  query GetMe {
    me {
      id
      address
      username
      kycTier
      createdAt
    }
  }
`;

export const GET_USER_STATS = gql`
  query GetUserStats($address: String!) {
    userStats(address: $address) {
      totalBots
      activeBots
      totalWins
      totalEarnings
      bestBot {
        id
        name
        avatar
        modelType
        stats {
          wins
          losses
          winRate
          earnings
        }
      }
      recentMatches {
        id
        type
        status
        createdAt
        result {
          winner {
            id
            name
          }
          duration
        }
      }
    }
  }
`;

export const GET_USER_BOTS = gql`
  query GetUserBots($address: String!) {
    bots(filter: { creatorAddress: $address }) {
      id
      name
      avatar
      modelType
      isActive
      isDemo
      createdAt
      stats {
        wins
        losses
        earnings
        winRate
        avgFinishPosition
      }
      queuePosition
    }
  }
`;

export const GET_PLATFORM_STATS = gql`
  query GetPlatformStats {
    platformStats {
      totalBots
      activeBots
      totalUsers
      activeUsers24h
      totalMatches
      queuedBots
      totalEarnings
    }
  }
`;

export const GET_USER_ACHIEVEMENTS = gql`
  query GetUserAchievements($userId: String!) {
    user(address: $userId) {
      achievements {
        id
        type
        name
        description
        unlockedAt
      }
    }
  }
`;

export const GET_RECENT_ACTIVITY = gql`
  query GetRecentActivity($userId: String!, $limit: Int) {
    recentActivity(userId: $userId, limit: $limit) {
      id
      type
      description
      timestamp
      metadata {
        tournamentId
        botId
        earnings
        rank
      }
    }
  }
`;