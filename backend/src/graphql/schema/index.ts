import { gql } from 'graphql-tag';
import { economyTypeDefs } from './economy';
import { metaverseSyncTypeDefs } from './metaverseSync';
import { deploymentTypeDefs } from './deployment';
import { energyTypeDefs } from './energy';

const baseTypeDefs = gql`
  scalar DateTime
  scalar JSON

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
    tokenId: Int!
    name: String!
    avatar: String!
    prompt: String!
    personality: BotPersonality!
    modelType: AIModelType!
    creator: User!
    creatorId: String!
    isActive: Boolean!
    isDemo: Boolean!
    stats: BotStats!
    socialStats: SocialStats!
    queuePosition: Int
    queueEntries: [QueueEntry!]!
    currentMatch: Match
    createdAt: DateTime!
    updatedAt: DateTime!
    
    # Metaverse fields
    channel: String!
    
    # Economy fields
    equipment: [BotEquipment!]!
    house: BotHouse
    activityScore: BotActivityScore
    lootboxRewards: [LootboxReward!]!
    robbingPower: Int!
    defenseLevel: Int!
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
    matchId: String
    gameType: String
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
    totalMatched: Int
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

  # Channel types
  type Channel {
    id: ID!
    name: String!
    type: ChannelType!
    status: ChannelStatus!
    currentBots: Int!
    maxBots: Int!
    loadPercentage: Float!
    worldId: String
    region: String
    description: String
  }

  enum ChannelType {
    MAIN
    REGIONAL
    VIP
    TEST
  }

  enum ChannelStatus {
    ACTIVE
    FULL
    DRAINING
    MAINTENANCE
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
    
    # Match queries
    match(id: String!): Match
    
    # Game Manager queries
    activeGames: [GameInstance!]!
    gameById(gameId: String!): GameInstance
    gameStats: GameStats!
    
    # Channel queries
    channels(type: ChannelType, status: ChannelStatus): [Channel!]!
    channel(name: String!): Channel
    myBotChannels: [Channel!]!
  }

  type Mutation {
    # Bot mutations
    deployBot(input: DeployBotInput!): Bot!
    toggleBotActive(botId: String!): Bot!
    deleteBot(botId: String!): DeleteBotResponse!
    
    # Queue mutations
    enterQueue(botId: String!, queueType: QueueType!): QueueEntry!
    leaveQueue(botId: String!): Boolean!
    signalFrontendReady(matchId: String!): Boolean!
    startReverseHangmanRound(matchId: String!, difficulty: String!): Boolean!
    
    # Test mode mutations
    setTestGameType(gameType: String): Boolean!
    
    # Game viewer management
    leaveGame(gameId: String!): GameViewerResponse!
    joinGame(gameId: String!): GameViewerResponse!
    updateGameSpeed(gameId: String!, speed: String!): GameViewerResponse!
    
    # Debug logging control
    startDebugLogging(gameType: String!, matchId: String): Boolean!
    stopDebugLogging: Boolean!
    sendDebugLog(log: DebugLogInput!): Boolean!
    sendDebugLogBatch(logs: [DebugLogInput!]!): Boolean!

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
    
    # Channel mutations
    switchChannel(botId: String!, channelName: String!): Bot!
  }

  type Subscription {
    tournamentUpdate(tournamentId: String!): Tournament!
    queueUpdate: QueueEntry!
    botDeployed: Bot!
    # Game Manager subscriptions
    gameStateUpdate(gameId: String!): GameUpdate!
    gameEvent(gameId: String!): GameEvent!
    allGameUpdates: GameUpdate!
    # Debug log subscription
    debugLog: DebugLog!
  }
  
  type DebugLog {
    timestamp: String!
    level: String!
    source: String!
    message: String!
    data: JSON
    stack: String
  }
  
  input DebugLogInput {
    timestamp: String!
    level: String!
    source: String!
    message: String!
    data: JSON
    stack: String
  }

  input DeployBotInput {
    name: String!
    avatar: String!
    prompt: String!
    personality: BotPersonality!
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
    # OpenAI Models
    GPT_4O
    GPT_4O_MINI
    O3
    O3_MINI
    O3_PRO
    
    # Anthropic Claude Models
    CLAUDE_3_5_SONNET
    CLAUDE_3_5_HAIKU
    CLAUDE_3_OPUS
    CLAUDE_4_OPUS
    CLAUDE_4_SONNET
    
    # DeepSeek Models
    DEEPSEEK_CHAT
    DEEPSEEK_R1
    DEEPSEEK_V3
    
    # Alibaba Qwen Models
    QWEN_2_5_72B
    QWQ_32B
    QVQ_72B_PREVIEW
    QWEN_2_5_MAX
    
    # xAI Models
    GROK_3
    
    # Kimi Models
    KIMI_K2
    
    # Google Gemini Models
    GEMINI_2_5_PRO
    GEMINI_2_5_PRO_DEEP_THINK
    
    # Meta Llama Models
    LLAMA_3_1_405B
    LLAMA_3_1_70B
    LLAMA_3_2_90B
    
    # Mistral Models
    MIXTRAL_8X22B
  }

  enum BotPersonality {
    CRIMINAL
    GAMBLER
    WORKER
  }


  input BotFilter {
    modelType: AIModelType
    isActive: Boolean
    creatorAddress: String
    hasQueueEntry: Boolean
    hasMetaverseAgent: Boolean
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
    type: String!
    status: String!
    bots: [Bot!]!
    participants: [MatchParticipant!]!
    winner: Bot
    prizePool: String!
    tournament: Tournament
    gameHistory: JSON
    createdAt: DateTime!
    startedAt: DateTime
    completedAt: DateTime
  }
  
  type MatchParticipant {
    bot: Bot!
    position: Int!
    finalRank: Int
    points: Int!
  }

  type Comment {
    id: ID!
    content: String!
    user: User!
    bot: Bot!
    createdAt: DateTime!
  }

  type DeleteBotResponse {
    success: Boolean!
    message: String!
    deletedBotId: String!
    metaverseDeleted: Boolean!
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
    CONNECT4
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
  
  type GameViewerResponse {
    success: Boolean!
    message: String!
    activeViewers: Int!
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
    
    # AI Connect4 mutation
    getAIConnect4Decision(
      botId: String!
      model: String!
      gameState: Connect4GameStateInput!
      playerState: Connect4PlayerStateInput!
    ): AIConnect4Decision!
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

  # Connect4 Types
  type Connect4GameState {
    game_type: String!
    board: [[String!]!]!
    current_player_index: Int!
    move_count: Int!
    game_phase: String!
    valid_columns: [Int!]!
    last_move: Connect4Move
  }

  input Connect4GameStateInput {
    game_type: String!
    board: [[String!]!]!
    current_player_index: Int!
    move_count: Int!
    game_phase: String!
    valid_columns: [Int!]!
    last_move: Connect4MoveInput
  }

  type Connect4Move {
    column: Int!
    row: Int!
    was_yours: Boolean!
  }

  input Connect4MoveInput {
    column: Int!
    row: Int!
    was_yours: Boolean!
  }

  type Connect4PlayerState {
    player_id: String!
    player_pieces: Int!
    opponent_pieces: Int!
    board_metrics: Connect4BoardMetrics!
    threat_analysis: Connect4ThreatAnalysis!
    calculations: Connect4Calculations!
  }

  input Connect4PlayerStateInput {
    player_id: String!
    player_pieces: Int!
    opponent_pieces: Int!
    board_metrics: Connect4BoardMetricsInput!
    threat_analysis: Connect4ThreatAnalysisInput!
    calculations: Connect4CalculationsInput!
  }

  type Connect4BoardMetrics {
    center_column_control: Connect4Control!
    piece_distribution: Connect4Distribution!
  }

  input Connect4BoardMetricsInput {
    center_column_control: Connect4ControlInput!
    piece_distribution: Connect4DistributionInput!
  }

  type Connect4Control {
    yours: Int!
    opponent: Int!
  }

  input Connect4ControlInput {
    yours: Int!
    opponent: Int!
  }

  type Connect4Distribution {
    top_half: Int!
    bottom_half: Int!
    left_side: Int!
    center: Int!
    right_side: Int!
  }

  input Connect4DistributionInput {
    top_half: Int!
    bottom_half: Int!
    left_side: Int!
    center: Int!
    right_side: Int!
  }

  type Connect4ThreatAnalysis {
    immediate_win_opportunities: [Int!]!
    must_block_positions: [Int!]!
    total_threats_created: Int!
    total_threats_against: Int!
  }

  input Connect4ThreatAnalysisInput {
    immediate_win_opportunities: [Int!]!
    must_block_positions: [Int!]!
    total_threats_created: Int!
    total_threats_against: Int!
  }

  type Connect4Calculations {
    moves_remaining: Int!
    board_fill_percentage: Float!
    column_availability: [Int!]!
  }

  input Connect4CalculationsInput {
    moves_remaining: Int!
    board_fill_percentage: Float!
    column_availability: [Int!]!
  }

  type Connect4Analysis {
    board_state: String!
    immediate_threats: [Int!]!
    winning_moves: [Int!]!
    blocking_moves: [Int!]!
    strategic_assessment: String!
  }

  type AIConnect4Decision {
    action: String!
    column: Int!
    reasoning: String!
    confidence: Float!
    analysis: Connect4Analysis!
  }
`;

// Export merged type definitions
export const typeDefs = [baseTypeDefs, economyTypeDefs, metaverseSyncTypeDefs, deploymentTypeDefs, energyTypeDefs];