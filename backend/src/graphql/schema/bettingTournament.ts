import { gql } from 'graphql-tag';

export const bettingTournamentTypeDefs = gql`
  # ============================================
  # Betting Tournament System (15-minute cycles)
  # ============================================
  
  type BettingTournament {
    id: ID!
    startTime: DateTime!
    gameType: BettingGameType!
    status: BettingTournamentStatus!
    bettingDeadline: DateTime!
    totalBettingPool: Int!
    housePoolContribution: Int!
    winnerId: String
    participants: [BettingParticipant!]!
    bets: [BettingEntry!]!
    timeUntilStart: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
  }
  
  type BettingParticipant {
    id: ID!
    tournamentId: String!
    aiModel: String!
    name: String!
    initialOdds: Float!
    currentOdds: Float!
    totalBetsPlaced: Int!
    placement: Int
    score: Int
    bettingPercentage: Float!
    impliedProbability: Float!
  }
  
  type BettingEntry {
    id: ID!
    botId: String!
    tournamentId: String!
    participantId: String!
    amount: Int!
    potentialPayout: Float!
    actualPayout: Int
    status: BetStatus!
    timestamp: DateTime!
    bot: Bot!
    participant: BettingParticipant!
    tournament: BettingTournament!
  }
  
  type BettingPool {
    id: ID!
    tournamentId: String!
    totalPool: Int!
    houseCut: Int!
    payoutPool: Int!
    oddsBreakdown: [OddsInfo!]!
  }
  
  type OddsInfo {
    participantId: String!
    aiModel: String!
    name: String!
    currentOdds: Float!
    impliedProbability: Float!
    totalBets: Int!
    bettingPercentage: Float!
  }
  
  # ============================================
  # $IDLE Staking & XP System
  # ============================================
  
  type StakedIDLE {
    id: ID!
    userId: String!
    amount: Int!
    xpGenerationRate: Int!
    stakingTier: StakingTier!
    lockedUntil: DateTime!
    totalXPGenerated: Int!
    lastClaimTime: DateTime!
    isActive: Boolean!
    timeUntilUnlock: Int!
    earlyUnstakePenalty: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
  }
  
  type XPBalance {
    id: ID!
    userId: String!
    currentXP: Int!
    totalEarnedXP: Int!
    totalSpentXP: Int!
    monthlyDecay: Int!
    lastDecayDate: DateTime!
    maxAccumulation: Int!
    xpGenerationRate: Int!
    nextDecayAmount: Int!
    nextDecayDate: DateTime!
  }
  
  type StakingRewards {
    hourlyXP: Int!
    dailyXP: Int!
    weeklyXP: Int!
    maxAccumulation: Int!
    currentAccumulated: Int!
  }
  
  # ============================================
  # Tournament Schedule & Stats
  # ============================================
  
  type TournamentSchedule {
    upcoming: [BettingTournament!]!
    current: BettingTournament
    recent: [BettingTournament!]!
    nextTournamentIn: Int!
    dailySchedule: [ScheduleSlot!]!
  }
  
  type ScheduleSlot {
    time: String!
    gameType: BettingGameType!
    estimatedParticipants: Int!
  }
  
  type TournamentStats {
    totalTournaments: Int!
    totalBetsPlaced: Int!
    totalXPWagered: Int!
    totalXPDistributed: Int!
    biggestWin: Int!
    biggestUpset: UpsetInfo
    modelWinRates: [ModelWinRate!]!
  }
  
  type UpsetInfo {
    tournamentId: String!
    winnerModel: String!
    winnerOdds: Float!
    payout: Int!
    date: DateTime!
  }
  
  type ModelWinRate {
    model: String!
    totalGames: Int!
    wins: Int!
    winRate: Float!
    averageOdds: Float!
    profitability: Float!
  }
  
  type UserBettingStats {
    totalBets: Int!
    totalWins: Int!
    totalLosses: Int!
    totalXPWagered: Int!
    totalXPWon: Int!
    winRate: Float!
    roi: Float!
    biggestWin: Int!
    favoriteModel: String
    currentStreak: Int!
    bestStreak: Int!
  }
  
  # ============================================
  # Enums
  # ============================================
  
  enum BettingGameType {
    LIGHTNING_POKER
    PROMPT_RACING
    VIBE_CHECK
  }
  
  enum BettingTournamentStatus {
    SCHEDULED
    BETTING_OPEN
    BETTING_CLOSED
    IN_PROGRESS
    COMPLETED
    CANCELLED
  }
  
  enum BetStatus {
    PENDING
    WON
    LOST
    REFUNDED
  }
  
  enum StakingTier {
    BRONZE      # 10k XP/hour
    SILVER      # 15k XP/hour
    GOLD        # 20k XP/hour
    PLATINUM    # 25k XP/hour
    DIAMOND     # 30k XP/hour
  }
  
  # ============================================
  # Inputs
  # ============================================
  
  input PlaceBetInput {
    companionId: String!  # Which companion is placing the bet
    tournamentId: String!
    participantId: String!
    amount: Int!
  }
  
  input StakeIDLEInput {
    amount: Int!
    tier: StakingTier!
  }
  
  input UnstakeIDLEInput {
    stakeId: String!
    acceptPenalty: Boolean!
  }
  
  # ============================================
  # Query Extensions
  # ============================================
  
  extend type Query {
    # Tournament queries
    upcomingBettingTournaments(limit: Int): [BettingTournament!]!
    currentBettingTournament: BettingTournament
    bettingTournament(id: String!): BettingTournament
    tournamentSchedule: TournamentSchedule!
    tournamentStats: TournamentStats!
    
    # Betting queries (companion-based)
    myBets(companionId: String, status: BetStatus, limit: Int): [BettingEntry!]!
    tournamentOdds(tournamentId: String!): BettingPool!
    modelPerformance(model: String!): ModelWinRate
    
    # Staking & XP queries
    myStakes: [StakedIDLE!]!
    myXPBalance: XPBalance
    stakingRewards(amount: Int!, tier: StakingTier!): StakingRewards!
    
    # Companion betting stats
    myBettingStats(companionId: String): UserBettingStats!
  }
  
  # ============================================
  # Mutation Extensions
  # ============================================
  
  type XPClaimResult {
    xpClaimed: Int!
    xpPerCompanion: Int!
    companionsUpdated: Int!
    companions: [BotExperience!]!
  }
  
  extend type Mutation {
    # Betting mutations
    placeBet(input: PlaceBetInput!): BettingEntry!
    claimWinnings(betId: String!): BettingEntry!
    
    # Staking mutations
    stakeIDLE(input: StakeIDLEInput!): StakedIDLE!
    unstakeIDLE(input: UnstakeIDLEInput!): StakedIDLE!
    claimXP(stakeId: String!, companionId: String): XPClaimResult!
    
    # Admin mutations (for testing)
    simulateTournament(tournamentId: String!): BettingTournament!
    forceStartTournament(tournamentId: String!): BettingTournament!
  }
  
  # ============================================
  # Subscription Extensions
  # ============================================
  
  extend type Subscription {
    # Tournament subscriptions
    tournamentCreated: BettingTournament!
    tournamentStatusUpdate(tournamentId: String!): BettingTournament!
    bettingWindowClosing: BettingTournament!
    tournamentCompleted: BettingTournament!
    
    # Odds subscriptions
    oddsUpdate(tournamentId: String!): BettingPool!
    
    # Personal subscriptions
    myBetUpdate(userId: String!): BettingEntry!
    myXPUpdate(userId: String!): XPBalance!
  }
`;