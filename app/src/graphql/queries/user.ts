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
        winner {
          id
          name
        }
        completedAt
      }
    }
  }
`;

export const GET_USER_BOTS = gql`
  query GetUserBots($address: String!) {
    bots(filter: { creatorAddress: $address }) {
      id
      tokenId
      name
      avatar
      modelType
      isActive
      isDemo
      createdAt
      personality
      stats {
        wins
        losses
        earnings
        winRate
        avgFinishPosition
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
      equipment {
        id
        name
        equipmentType
        rarity
        powerBonus
        defenseBonus
        equipped
      }
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
        }
      }
      lootboxRewards {
        id
        lootboxRarity
        opened
        openedAt
        createdAt
        equipmentRewards
        furnitureRewards
        currencyReward
      }
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