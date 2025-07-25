import { gql } from 'graphql-tag';

export const typeDefs = gql`
  scalar DateTime

  type User {
    id: ID!
    address: String!
    username: String
    role: UserRole!
    kycTier: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
    bots: [Bot!]!
    deployments: [DeploymentTransaction!]!
    achievements: [Achievement!]!
  }
  
  enum UserRole {
    USER
    DEVELOPER
    ADMIN
  }

  type Bot {
    id: ID!
    name: String!
    avatar: String!
    prompt: String!
    modelType: AIModelType!
    creator: User!
    creatorId: String!
    isActive: Boolean!
    stats: BotStats!
    socialStats: SocialStats!
    queuePosition: Int
    createdAt: DateTime!
    updatedAt: DateTime!
  }
  
  type BotStats {
    wins: Int!
    losses: Int!
    earnings: String!
    winRate: Float!
    avgFinishPosition: Float!
  }
  
  type DeploymentTransaction {
    id: ID!
    bot: Bot!
    user: User!
    txHash: String!
    amount: String!
    status: TxStatus!
    createdAt: DateTime!
  }
  
  enum TxStatus {
    PENDING
    CONFIRMED
    FAILED
    REFUNDED
  }
  
  type QueueEntry {
    id: ID!
    bot: Bot!
    queueType: QueueType!
    priority: Int!
    status: QueueStatus!
    enteredAt: DateTime!
    expiresAt: DateTime!
    position: Int!
  }
  
  enum QueueType {
    STANDARD
    PRIORITY
    PREMIUM
  }
  
  enum QueueStatus {
    WAITING
    MATCHED
    EXPIRED
    CANCELLED
  }

  type QueueStatusInfo {
    totalInQueue: Int!
    averageWaitTime: Int!
    nextMatchTime: DateTime
    queueTypes: [QueueTypeInfo!]!
  }

  type QueueTypeInfo {
    type: QueueType!
    count: Int!
    estimatedWaitTime: Int!
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
    topBots(limit: Int): [Bot!]!
    recentBots(limit: Int): [Bot!]!
    queuedBots(limit: Int): [Bot!]!

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
    userStats(address: String!): UserStats!
    queueStatus: QueueStatusInfo!
    
    # Game Manager queries
    activeGames: [GameInstance!]!
    gameById(gameId: String!): GameInstance
    gameStats: GameStats!
  }

  type Mutation {
    # Bot mutations
    deployBot(input: DeployBotInput!): Bot!
    toggleBotActive(botId: String!): Bot!
    
    # Queue mutations
    enterQueue(botId: String!, queueType: QueueType!): QueueEntry!
    leaveQueue(botId: String!): Boolean!

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

    # Auth mutations
    requestNonce(address: String!): NonceResponse!
    connectWallet(input: ConnectWalletInput!): AuthResponse!
    refreshToken(refreshToken: String!): AuthResponse!
    logout: Boolean!
    
    # Game Manager mutations
    createGame(gameId: String!, type: GameType!, players: [String!]!): GameInstance!
    startGame(gameId: String!): GameInstance!
    pauseGame(gameId: String!): GameInstance!
    resumeGame(gameId: String!): GameInstance!
    addSpectator(gameId: String!, userId: String!): Boolean!
    removeSpectator(gameId: String!, userId: String!): Boolean!
  }

  type Subscription {
    tournamentUpdate(tournamentId: String!): Tournament!
    queueUpdate: QueueEntry!
    botDeployed: Bot!
    # Game Manager subscriptions
    gameStateUpdate(gameId: String!): GameUpdate!
    gameEvent(gameId: String!): GameEvent!
    allGameUpdates: GameUpdate!
  }

  input DeployBotInput {
    name: String!
    avatar: String!
    prompt: String!
    modelType: AIModelType!
    txHash: String!
  }

  # Auth types
  type NonceResponse {
    nonce: String!
    message: String!
  }

  input ConnectWalletInput {
    address: String!
    signature: String!
    nonce: String!
  }

  type AuthResponse {
    user: User!
    accessToken: String!
    refreshToken: String!
  }
  
  enum AIModelType {
    GPT_4O
    CLAUDE_3_5_SONNET
    CLAUDE_3_OPUS
    DEEPSEEK_CHAT
  }


  input BotFilter {
    modelType: AIModelType
    isActive: Boolean
    creatorAddress: String
    hasQueueEntry: Boolean
  }

  enum BotSort {
    CREATED_DESC
    CREATED_ASC
    WINS_DESC
    WINS_ASC
    WIN_RATE_DESC
    WIN_RATE_ASC
    EARNINGS_DESC
    EARNINGS_ASC
  }

  type PlatformStats {
    totalBots: Int!
    activeBots: Int!
    totalUsers: Int!
    activeUsers24h: Int!
    totalMatches: Int!
    queuedBots: Int!
    totalEarnings: String!
  }

  type UserStats {
    totalBots: Int!
    activeBots: Int!
    totalWins: Int!
    totalEarnings: String!
    bestBot: Bot
    recentMatches: [Match!]!
  }

  type Match {
    id: ID!
    bots: [Bot!]!
    winner: Bot
    prizePool: String!
    createdAt: DateTime!
    completedAt: DateTime
  }

  type Comment {
    id: ID!
    content: String!
    user: User!
    bot: Bot!
    createdAt: DateTime!
  }

  # Game Manager Types
  type GameInstance {
    id: ID!
    type: GameType!
    status: GameStatus!
    players: [GamePlayer!]!
    spectatorCount: Int!
    createdAt: DateTime!
    lastActivity: DateTime!
    gameState: String! # JSON string of game-specific state
  }

  type GamePlayer {
    id: ID!
    name: String!
    isAI: Boolean!
    model: String
    status: PlayerStatus!
  }

  enum GameType {
    POKER
    REVERSE_HANGMAN
    CHESS
    GO
  }

  enum GameStatus {
    WAITING
    ACTIVE
    PAUSED
    COMPLETED
  }

  enum PlayerStatus {
    ACTIVE
    FOLDED
    ELIMINATED
    WINNER
  }

  type GameStats {
    totalGames: Int!
    activeGames: Int!
    pausedGames: Int!
    completedGames: Int!
    totalSpectators: Int!
    gamesByType: [GameTypeStats!]!
  }

  type GameTypeStats {
    type: GameType!
    count: Int!
    active: Int!
  }

  type GameUpdate {
    gameId: ID!
    type: GameUpdateType!
    timestamp: DateTime!
    data: String! # JSON string of update data
  }

  type GameEvent {
    gameId: ID!
    event: String!
    playerId: String
    data: String! # JSON string of event data
    timestamp: DateTime!
  }

  enum GameUpdateType {
    STATE_CHANGE
    PLAYER_ACTION
    GAME_EVENT
    SPECTATOR_CHANGE
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
    
    # AI Reverse Hangman mutation
    getAIReverseHangmanDecision(
      botId: String!
      model: String!
      gameState: ReverseHangmanGameStateInput!
      playerState: ReverseHangmanPlayerStateInput!
    ): AIReverseHangmanDecision!
  }

  # Reverse Hangman Types
  type ReverseHangmanGameState {
    game_type: String!
    output_shown: String!
    constraints: ReverseHangmanConstraints!
    previous_guesses: [ReverseHangmanGuess!]!
    game_phase: String!
    time_elapsed_seconds: Int!
  }

  input ReverseHangmanGameStateInput {
    game_type: String!
    output_shown: String!
    constraints: ReverseHangmanConstraintsInput!
    previous_guesses: [ReverseHangmanGuessInput!]!
    game_phase: String!
    time_elapsed_seconds: Int!
  }

  type ReverseHangmanConstraints {
    max_word_count: Int!
    exact_word_count: Int!
    difficulty: String!
    category: String!
    max_attempts: Int!
  }

  input ReverseHangmanConstraintsInput {
    max_word_count: Int!
    exact_word_count: Int!
    difficulty: String!
    category: String!
    max_attempts: Int!
  }

  type ReverseHangmanGuess {
    attempt_number: Int!
    prompt_guess: String!
    similarity_score: Float!
    feedback: String!
    match_details: ReverseHangmanMatchDetails
  }
  
  type ReverseHangmanMatchDetails {
    word_matches: Int!
    total_words: Int!
    matched_words: [String!]!
    missing_count: Int!
    extra_count: Int!
    semantic_matches: [ReverseHangmanSemanticMatch!]!
  }
  
  type ReverseHangmanSemanticMatch {
    original: String!
    matched: String!
  }

  input ReverseHangmanGuessInput {
    attempt_number: Int!
    prompt_guess: String!
    similarity_score: Float!
    feedback: String!
    match_details: ReverseHangmanMatchDetailsInput
  }
  
  input ReverseHangmanMatchDetailsInput {
    word_matches: Int!
    total_words: Int!
    matched_words: [String!]!
    missing_count: Int!
    extra_count: Int!
    semantic_matches: [ReverseHangmanSemanticMatchInput!]!
  }
  
  input ReverseHangmanSemanticMatchInput {
    original: String!
    matched: String!
  }

  type ReverseHangmanPlayerState {
    player_id: String!
    current_round: Int!
    total_rounds: Int!
    current_score: Int!
    rounds_won: Int!
    rounds_lost: Int!
  }

  input ReverseHangmanPlayerStateInput {
    player_id: String!
    current_round: Int!
    total_rounds: Int!
    current_score: Int!
    rounds_won: Int!
    rounds_lost: Int!
  }

  type ReverseHangmanAnalysis {
    output_type: String!
    key_indicators: [String!]!
    word_count_estimate: Int!
    difficulty_assessment: String!
    pattern_observations: [String!]!
  }

  type AIReverseHangmanDecision {
    action: String!
    prompt_guess: String!
    reasoning: String!
    confidence: Float!
    analysis: ReverseHangmanAnalysis!
  }
`;