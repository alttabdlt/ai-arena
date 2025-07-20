import { gql } from 'graphql-tag';

export const typeDefs = gql`
  scalar DateTime

  type User {
    id: ID!
    address: String!
    kycTier: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
    bots: [Bot!]!
    transactions: [Transaction!]!
    achievements: [Achievement!]!
  }

  type Bot {
    id: ID!
    address: String!
    name: String!
    description: String!
    creator: User!
    creatorAddress: String!
    bondingCurve: BondingCurve!
    imageUrl: String
    tags: [String!]!
    socialStats: SocialStats!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type BondingCurve {
    id: ID!
    botId: String!
    bot: Bot!
    currentSupply: String!
    currentPrice: String!
    marketCap: String!
    volume24h: String!
    holders: Int!
    graduated: Boolean!
    graduatedAt: DateTime
    transactions: [Transaction!]!
  }

  type Transaction {
    id: ID!
    type: TransactionType!
    user: User!
    userAddress: String!
    bondingCurve: BondingCurve!
    bondingCurveId: String!
    amount: String!
    price: String!
    totalCost: String!
    txHash: String!
    createdAt: DateTime!
  }

  type SocialStats {
    likes: Int!
    comments: Int!
    followers: Int!
  }

  type Tournament {
    id: ID!
    name: String!
    type: TournamentType!
    status: TournamentStatus!
    entryFee: String!
    prizePool: String!
    startTime: DateTime!
    endTime: DateTime!
    participants: [TournamentParticipant!]!
    createdAt: DateTime!
  }

  type TournamentParticipant {
    id: ID!
    tournament: Tournament!
    bot: Bot!
    score: Float!
    rank: Int
    createdAt: DateTime!
  }

  type Achievement {
    id: ID!
    name: String!
    description: String!
    imageUrl: String!
    rarity: AchievementRarity!
    users: [User!]!
  }

  type PriceUpdate {
    botId: String!
    price: String!
    marketCap: String!
    volume24h: String!
    holders: Int!
    timestamp: DateTime!
  }

  type GraduationEvent {
    botId: String!
    botName: String!
    finalPrice: String!
    totalRaised: String!
    holders: Int!
    timestamp: DateTime!
  }

  enum TransactionType {
    BUY
    SELL
  }

  enum TournamentType {
    ROOKIE
    PRO
    CHAMPIONSHIP
  }

  enum TournamentStatus {
    UPCOMING
    LIVE
    COMPLETED
  }

  enum AchievementRarity {
    COMMON
    RARE
    EPIC
    LEGENDARY
  }

  type Query {
    # User queries
    user(address: String!): User
    me: User

    # Bot queries
    bot(id: String!): Bot
    bots(
      filter: BotFilter
      sort: BotSort
      limit: Int
      offset: Int
    ): [Bot!]!
    trendingBots(limit: Int): [Bot!]!
    recentLaunches(limit: Int): [Bot!]!

    # Tournament queries
    tournament(id: String!): Tournament
    tournaments(
      type: TournamentType
      status: TournamentStatus
      limit: Int
      offset: Int
    ): [Tournament!]!
    upcomingTournaments(limit: Int): [Tournament!]!

    # Analytics queries
    platformStats: PlatformStats!
    userPortfolio(address: String!): Portfolio!
  }

  type Mutation {
    # Bot mutations
    createBot(input: CreateBotInput!): Bot!
    buyBot(input: BuyBotInput!): Transaction!
    sellBot(input: SellBotInput!): Transaction!

    # Tournament mutations
    enterTournament(tournamentId: String!, botId: String!): TournamentParticipant!

    # Social mutations
    likeBot(botId: String!): Bot!
    unlikeBot(botId: String!): Bot!
    commentOnBot(botId: String!, content: String!): Comment!
    followUser(address: String!): User!
    unfollowUser(address: String!): User!

    # KYC mutations
    completeKYCTier(tier: Int!): User!
  }

  type Subscription {
    priceUpdate(botId: String!): PriceUpdate!
    allPriceUpdates: PriceUpdate!
    graduationEvent: GraduationEvent!
    tournamentUpdate(tournamentId: String!): Tournament!
  }

  input CreateBotInput {
    name: String!
    description: String!
    imageUrl: String
    tags: [String!]
    strategy: String
  }

  input BuyBotInput {
    botId: String!
    amount: String!
    maxSlippage: Float!
  }

  input SellBotInput {
    botId: String!
    amount: String!
    minReceived: String!
  }

  input BotFilter {
    minPrice: String
    maxPrice: String
    minMarketCap: String
    maxMarketCap: String
    tags: [String!]
    graduated: Boolean
    creatorAddress: String
  }

  enum BotSort {
    CREATED_DESC
    CREATED_ASC
    PRICE_DESC
    PRICE_ASC
    MARKET_CAP_DESC
    MARKET_CAP_ASC
    VOLUME_DESC
    VOLUME_ASC
    HOLDERS_DESC
    HOLDERS_ASC
  }

  type PlatformStats {
    totalBots: Int!
    totalVolume: String!
    totalUsers: Int!
    activeUsers24h: Int!
    graduatedBots: Int!
    avgGraduationTime: Float
  }

  type Portfolio {
    totalValue: String!
    totalPnL: String!
    totalPnLPercent: Float!
    holdings: [Holding!]!
  }

  type Holding {
    bot: Bot!
    amount: String!
    avgPrice: String!
    currentValue: String!
    pnl: String!
    pnlPercent: Float!
  }

  type Comment {
    id: ID!
    content: String!
    user: User!
    bot: Bot!
    createdAt: DateTime!
  }

  # AI Poker Types - Comprehensive Tournament-Level Data
  
  # Side pot information
  type SidePot {
    amount: Int!
    eligiblePlayers: [String!]!
    createdByPlayer: String
  }

  input SidePotInput {
    amount: Int!
    eligiblePlayers: [String!]!
    createdByPlayer: String
  }

  # Last action details
  type LastAction {
    action: String!
    amount: Int
    timestamp: Float!
  }

  input LastActionInput {
    action: String!
    amount: Int
    timestamp: Float!
  }

  # Opponent information with detailed position data
  type OpponentInfo {
    seat: Int!
    id: String!
    name: String!
    stackSize: Int!
    position: String!
    positionType: String!
    status: String!
    amountInPot: Int!
    amountInRound: Int!
    isAllIn: Boolean!
    holeCardsKnown: Boolean!
    holeCards: [String!]
    lastAction: LastAction
  }

  input OpponentInfoInput {
    seat: Int!
    id: String!
    name: String!
    stackSize: Int!
    position: String!
    positionType: String!
    status: String!
    amountInPot: Int!
    amountInRound: Int!
    isAllIn: Boolean!
    holeCardsKnown: Boolean!
    holeCards: [String!]
    lastAction: LastActionInput
  }

  # Hand action with stack tracking
  type HandAction {
    player: String!
    playerId: String!
    seat: Int!
    action: String!
    amount: Int
    stackBefore: Int!
    stackAfter: Int!
    potAfter: Int!
  }

  input HandActionInput {
    player: String!
    playerId: String!
    seat: Int!
    action: String!
    amount: Int
    stackBefore: Int!
    stackAfter: Int!
    potAfter: Int!
  }

  # Complete action history by round
  type ActionHistory {
    preflop: [HandAction!]!
    flop: [HandAction!]!
    turn: [HandAction!]!
    river: [HandAction!]!
  }

  input ActionHistoryInput {
    preflop: [HandActionInput!]!
    flop: [HandActionInput!]!
    turn: [HandActionInput!]!
    river: [HandActionInput!]!
  }

  # Pot odds calculations
  type PotOdds {
    toCall: Int!
    potSize: Int!
    oddsRatio: String!
    percentage: Float!
    breakEvenPercentage: Float!
  }

  input PotOddsInput {
    toCall: Int!
    potSize: Int!
    oddsRatio: String!
    percentage: Float!
    breakEvenPercentage: Float!
  }

  # Comprehensive game state
  type PokerGameState {
    # Table info
    gameType: String!
    bettingStructure: String!
    maxPlayers: Int!
    currentPlayers: Int!
    activePlayers: Int!
    
    # Blinds
    smallBlind: Int!
    bigBlind: Int!
    ante: Int!
    level: Int!
    
    # Current hand
    handNumber: Int!
    dealerPosition: Int!
    smallBlindPosition: Int!
    bigBlindPosition: Int!
    bettingRound: String!
    communityCards: [String!]!
    potSize: Int!
    sidePots: [SidePot!]!
    currentBet: Int!
    minRaise: Int!
    
    # Players
    opponents: [OpponentInfo!]!
    
    # Action history
    actionHistory: ActionHistory!
    
    # Pot breakdown
    mainPot: Int!
    totalPot: Int!
    effectiveStackSize: Int!
    potOdds: PotOdds!
  }

  input PokerGameStateInput {
    # Table info
    gameType: String!
    bettingStructure: String!
    maxPlayers: Int!
    currentPlayers: Int!
    activePlayers: Int!
    
    # Blinds
    smallBlind: Int!
    bigBlind: Int!
    ante: Int!
    level: Int!
    
    # Current hand
    handNumber: Int!
    dealerPosition: Int!
    smallBlindPosition: Int!
    bigBlindPosition: Int!
    bettingRound: String!
    communityCards: [String!]!
    potSize: Int!
    sidePots: [SidePotInput!]!
    currentBet: Int!
    minRaise: Int!
    
    # Players
    opponents: [OpponentInfoInput!]!
    
    # Action history
    actionHistory: ActionHistoryInput!
    
    # Pot breakdown
    mainPot: Int!
    totalPot: Int!
    effectiveStackSize: Int!
    potOdds: PotOddsInput!
  }

  # Comprehensive player state
  type PlayerState {
    # Personal data
    holeCards: [String!]!
    stackSize: Int!
    position: String!
    positionType: String!
    seatNumber: Int!
    isAllIn: Boolean!
    amountInvestedThisHand: Int!
    amountInvestedThisRound: Int!
    amountToCall: Int!
    
    # Available actions
    canCheck: Boolean!
    canFold: Boolean!
    canCall: Boolean!
    canRaise: Boolean!
    minRaiseAmount: Int!
    maxRaiseAmount: Int!
    
    # Position data
    seatsToActAfter: Int!
    relativePosition: String!
    playersLeftToAct: [String!]!
    isClosingAction: Boolean!
    isOpenAction: Boolean!
    
    # Stack dynamics
    effectiveStacks: String! # JSON string map
    stackToPoRatio: Float!
    commitmentLevel: Float!
    
    # Hand evaluation
    handEvaluation: String # Current hand strength (e.g., "Straight (9 high)")
  }

  input PlayerStateInput {
    # Personal data
    holeCards: [String!]!
    stackSize: Int!
    position: String!
    positionType: String!
    seatNumber: Int!
    isAllIn: Boolean!
    amountInvestedThisHand: Int!
    amountInvestedThisRound: Int!
    amountToCall: Int!
    
    # Available actions
    canCheck: Boolean!
    canFold: Boolean!
    canCall: Boolean!
    canRaise: Boolean!
    minRaiseAmount: Int!
    maxRaiseAmount: Int!
    
    # Position data
    seatsToActAfter: Int!
    relativePosition: String!
    playersLeftToAct: [String!]!
    isClosingAction: Boolean!
    isOpenAction: Boolean!
    
    # Stack dynamics
    effectiveStacks: String! # JSON string map
    stackToPoRatio: Float!
    commitmentLevel: Float!
    
    # Hand evaluation
    handEvaluation: String # Current hand strength (e.g., "Straight (9 high)")
  }

  type AIPokerDecisionDetails {
    handEvaluation: String!
    potOdds: String!
    expectedValue: String!
    bluffProbability: Float!
    modelUsed: String!
  }

  # AI Evaluation Metrics
  type HandMisread {
    handNumber: Int!
    actual: String!
    aiThought: String!
    holeCards: [String!]!
    boardCards: [String!]!
    phase: String!
    severity: String! # CRITICAL, MAJOR, MINOR
  }

  type IllogicalDecision {
    handNumber: Int!
    decision: String!
    reason: String!
    gameState: IllogicalGameState!
  }

  type IllogicalGameState {
    pot: Int!
    toCall: Int!
    canCheck: Boolean!
  }

  type ModelEvaluation {
    modelName: String!
    handsPlayed: Int!
    handMisreads: [HandMisread!]!
    illogicalDecisions: [IllogicalDecision!]!
    misreadRate: Float!
    illogicalRate: Float!
  }

  type AIPokerDecision {
    action: String!
    amount: Int
    reasoning: String!
    confidence: Float!
    details: AIPokerDecisionDetails!
    # Include evaluation data when available
    handMisread: Boolean
    illogicalPlay: Boolean
  }

  extend type Query {
    # Get evaluation metrics for all models
    getModelEvaluations: [ModelEvaluation!]!
    # Get evaluation for specific model
    getModelEvaluation(model: String!): ModelEvaluation
  }

  extend type Mutation {
    # AI Poker mutation
    getAIPokerDecision(
      botId: String!
      model: String!
      gameState: PokerGameStateInput!
      playerState: PlayerStateInput!
      opponents: Int!
    ): AIPokerDecision!
  }
`;