import { gql } from 'graphql-tag';

export const jackpotTypeDefs = gql`
  type GlobalJackpot {
    id: ID!
    currentAmount: Int!
    contributions: Int!
    lastContribution: DateTime!
    contributionRate: Float!
    winChance: Float!
    minAmount: Int!
    totalWon: Int!
    totalWinners: Int!
    biggestWin: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type JackpotHistory {
    id: ID!
    botId: String!
    botName: String!
    personality: BotPersonality!
    amount: Int!
    winChance: Float!
    contributions: Int!
    wonAt: DateTime!
  }

  type JackpotWinEvent {
    botId: String!
    botName: String!
    personality: BotPersonality!
    amount: Int!
    timestamp: DateTime!
  }

  type JackpotUpdateEvent {
    currentAmount: Int!
    contributions: Int!
    lastContribution: DateTime!
  }

  type JackpotStats {
    currentJackpot: GlobalJackpot!
    recentWinners: [JackpotHistory!]!
    topWinners: [JackpotHistory!]!
    totalPaidOut: Int!
    averageWin: Int!
  }

  extend type Query {
    # Get current jackpot info
    currentJackpot: GlobalJackpot!
    
    # Get jackpot history
    jackpotHistory(limit: Int): [JackpotHistory!]!
    
    # Get top jackpot winners
    topJackpotWinners(limit: Int): [JackpotHistory!]!
    
    # Get comprehensive jackpot stats
    jackpotStats: JackpotStats!
  }

  extend type Mutation {
    # Admin: manually trigger jackpot for testing
    triggerJackpotWin(botId: ID!): JackpotWinEvent
    
    # Admin: reset jackpot
    resetJackpot(amount: Int): GlobalJackpot
  }

  extend type Subscription {
    # Subscribe to jackpot amount updates
    jackpotUpdate: JackpotUpdateEvent!
    
    # Subscribe to jackpot wins
    jackpotWon: JackpotWinEvent!
  }
`;