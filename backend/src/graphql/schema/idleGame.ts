import { gql } from 'graphql-tag';

export const idleGameTypeDefs = gql`
  type BotActivityLog {
    id: ID!
    botId: String!
    activity: String!
    emoji: String!
    personality: BotPersonality!
    xpGained: Int!
    timestamp: String!
  }

  type IdleProgress {
    id: ID!
    botId: String!
    lastActiveAt: String!
    lastXPClaim: String!
    idleMultiplier: Float!
    totalIdleTime: Int!
    totalIdleXP: Int!
  }

  type IdleRewardResult {
    xpGained: Int!
    newLevel: Int!
    newCurrentXP: Int!
    newTotalXP: Int!
    activities: [BotActivityLog!]!
    timeAwaySeconds: Int!
  }

  type IdleProgressResult {
    pendingXP: Int!
    timeAwaySeconds: Int!
    currentLevel: Int!
    currentXP: Int!
    activities: [BotActivityLog!]!
  }

  extend type Bot {
    experience: BotExperience
    activityLogs: [BotActivityLog!]!
    idleProgress: IdleProgress
    character: String
  }

  extend type Query {
    getBotActivities(botId: ID!, limit: Int): [BotActivityLog!]!
    calculateIdleProgress(botId: ID!): IdleProgressResult!
    getBotWithExperience(botId: ID!): Bot
  }

  extend type Mutation {
    updateBotExperience(botId: ID!, xpGained: Int!): BotExperience!
    logBotActivity(
      botId: ID!
      activity: String!
      emoji: String!
      personality: BotPersonality!
      xpGained: Int
    ): BotActivityLog!
    claimIdleRewards(botId: ID!): IdleRewardResult!
    resetIdleProgress(botId: ID!): IdleProgress!
  }
`;