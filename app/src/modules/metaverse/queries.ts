import { gql } from '@apollo/client';

// Bot queries
export const GET_USER_BOTS = gql`
  query GetUserBots($address: String!) {
    user(address: $address) {
      id
      bots {
        id
        name
        avatar
        personality
        modelType
        level
        isActive
        experience {
          id
          level
          currentXP
          totalXP
          xpToNextLevel
        }
        idleProgress {
          id
          lastActiveAt
          lastXPClaim
          idleMultiplier
          totalIdleTime
          totalIdleXP
        }
        activityLogs {
          id
          activity
          emoji
          xpGained
          timestamp
        }
      }
    }
  }
`;

export const GET_BOT_WITH_EXPERIENCE = gql`
  query GetBotWithExperience($botId: ID!) {
    getBotWithExperience(botId: $botId) {
      id
      name
      avatar
      personality
      modelType
      experience {
        id
        level
        currentXP
        totalXP
        xpToNextLevel
        combatXP
        socialXP
        criminalXP
        gamblingXP
        tradingXP
        prestigeLevel
        prestigeTokens
        skillPoints
      }
      idleProgress {
        id
        lastActiveAt
        lastXPClaim
        idleMultiplier
        totalIdleTime
        totalIdleXP
      }
      activityLogs {
        id
        activity
        emoji
        personality
        xpGained
        timestamp
      }
    }
  }
`;

export const GET_BOT_ACTIVITIES = gql`
  query GetBotActivities($botId: ID!, $limit: Int) {
    getBotActivities(botId: $botId, limit: $limit) {
      id
      activity
      emoji
      personality
      xpGained
      timestamp
    }
  }
`;

export const CALCULATE_IDLE_PROGRESS = gql`
  query CalculateIdleProgress($botId: ID!) {
    calculateIdleProgress(botId: $botId) {
      pendingXP
      timeAwaySeconds
      currentLevel
      currentXP
      activities {
        id
        activity
        emoji
        xpGained
        timestamp
      }
    }
  }
`;

// Mutations
export const UPDATE_BOT_EXPERIENCE = gql`
  mutation UpdateBotExperience($botId: ID!, $xpGained: Int!) {
    updateBotExperience(botId: $botId, xpGained: $xpGained) {
      id
      level
      currentXP
      totalXP
      xpToNextLevel
    }
  }
`;

export const LOG_BOT_ACTIVITY = gql`
  mutation LogBotActivity(
    $botId: ID!
    $activity: String!
    $emoji: String!
    $personality: BotPersonality!
    $xpGained: Int
  ) {
    logBotActivity(
      botId: $botId
      activity: $activity
      emoji: $emoji
      personality: $personality
      xpGained: $xpGained
    ) {
      id
      activity
      emoji
      xpGained
      timestamp
    }
  }
`;

export const CLAIM_IDLE_REWARDS = gql`
  mutation ClaimIdleRewards($botId: ID!) {
    claimIdleRewards(botId: $botId) {
      xpGained
      newLevel
      newCurrentXP
      newTotalXP
      activities {
        id
        activity
        emoji
        xpGained
        timestamp
      }
      timeAwaySeconds
    }
  }
`;

export const RESET_IDLE_PROGRESS = gql`
  mutation ResetIdleProgress($botId: ID!) {
    resetIdleProgress(botId: $botId) {
      id
      lastActiveAt
      lastXPClaim
      idleMultiplier
      totalIdleTime
      totalIdleXP
    }
  }
`;

// Subscriptions
export const BOT_ACTIVITY_SUBSCRIPTION = gql`
  subscription OnBotActivity($botId: ID!) {
    botActivityUpdate(botId: $botId) {
      id
      activity
      emoji
      xpGained
      timestamp
    }
  }
`;

export const EXPERIENCE_UPDATE_SUBSCRIPTION = gql`
  subscription OnExperienceUpdate($botId: ID!) {
    experienceUpdate(botId: $botId) {
      id
      level
      currentXP
      totalXP
      xpToNextLevel
    }
  }
`;