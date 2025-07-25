import { PubSub } from 'graphql-subscriptions';
import { prisma } from '../config/database';
import { aiService } from './aiService';
import Redis from 'ioredis';
import { GameEngineAdapter, GameEngineAdapterFactory } from './gameEngineAdapter';

export interface GameInstance {
  id: string;
  type: 'poker' | 'reverse-hangman' | 'chess' | 'go';
  state: any;
  players: string[];
  spectators: Set<string>;
  status: 'waiting' | 'active' | 'paused' | 'completed';
  lastActivity: Date;
  loopInterval?: NodeJS.Timeout;
}

interface GameUpdate {
  gameId: string;
  type: 'state' | 'event' | 'decision';
  data: any;
  timestamp: Date;
}

class GameManagerService {
  private games: Map<string, GameInstance> = new Map();
  private pubsub: PubSub;
  private redis: Redis;
  private cleanupInterval?: NodeJS.Timeout;
  private adapters: Map<string, GameEngineAdapter> = new Map();

  constructor() {
    this.pubsub = new PubSub();
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });

    // Initialize game adapters
    this.adapters.set('poker', GameEngineAdapterFactory.create('poker'));
    this.adapters.set('reverse-hangman', GameEngineAdapterFactory.create('reverse-hangman'));

    // Start cleanup interval
    this.startCleanupProcess();
  }

  async createGame(
    gameId: string,
    type: GameInstance['type'],
    players: string[],
    initialState: any
  ): Promise<GameInstance> {
    console.log(`Creating game: ${gameId} of type ${type} with ${players.length} players`);

    const game: GameInstance = {
      id: gameId,
      type,
      state: initialState,
      players,
      spectators: new Set(),
      status: 'waiting',
      lastActivity: new Date(),
    };

    this.games.set(gameId, game);

    // Store in Redis for persistence
    await this.saveGameState(gameId, game);

    // Store in database for history
    await prisma.tournament.update({
      where: { id: gameId },
      data: {
        status: 'LIVE'
      },
    });

    return game;
  }

  async startGame(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }

    if (game.status === 'active') {
      console.log(`Game ${gameId} is already active`);
      return;
    }

    console.log(`Starting game loop for ${gameId}`);
    game.status = 'active';
    game.lastActivity = new Date();

    // Start the game loop based on game type
    this.startGameLoop(game);

    // Notify subscribers
    this.publishUpdate({
      gameId,
      type: 'event',
      data: { event: 'game_started', status: 'active' },
      timestamp: new Date(),
    });
  }

  private startGameLoop(game: GameInstance): void {
    // Clear any existing interval
    if (game.loopInterval) {
      clearInterval(game.loopInterval);
    }

    // Set loop interval based on game type
    const loopDelay = this.getLoopDelay(game.type);

    game.loopInterval = setInterval(async () => {
      try {
        // Check if game should continue
        if (game.status !== 'active') {
          console.log(`Game ${game.id} is not active, pausing loop`);
          if (game.loopInterval) {
            clearInterval(game.loopInterval);
            game.loopInterval = undefined;
          }
          return;
        }

        // Update last activity
        game.lastActivity = new Date();

        // Process game turn based on type
        await this.processGameTurn(game);

      } catch (error) {
        console.error(`Error in game loop for ${game.id}:`, error);
        // Don't stop the loop on error, just log it
      }
    }, loopDelay);
  }

  private async processGameTurn(game: GameInstance): Promise<void> {
    console.log(`Processing turn for game ${game.id}`);

    switch (game.type) {
      case 'poker':
        await this.processPokerTurn(game);
        break;
      case 'reverse-hangman':
        await this.processReverseHangmanTurn(game);
        break;
      case 'chess':
      case 'go':
        // TODO: Implement other game types
        console.log(`Game type ${game.type} not yet implemented`);
        break;
    }

    // Save updated state
    await this.saveGameState(game.id, game);

    // Publish state update
    this.publishUpdate({
      gameId: game.id,
      type: 'state',
      data: { state: game.state },
      timestamp: new Date(),
    });
  }

  private async processPokerTurn(game: GameInstance): Promise<void> {
    const adapter = this.adapters.get('poker');
    if (!adapter) {
      console.error('Poker adapter not found');
      return;
    }

    const currentTurn = adapter.getCurrentTurn(game.state);
    
    if (!currentTurn || adapter.isGameComplete(game.state)) {
      // Check if game is complete
      if (adapter.isGameComplete(game.state)) {
        game.status = 'completed';
        const winner = adapter.getWinner(game.state);
        if (winner) {
          console.log(`Game ${game.id} completed. Winner: ${winner}`);
        }
      }
      return;
    }

    const currentPlayer = game.state.players.find((p: any) => p.id === currentTurn);
    if (!currentPlayer || !currentPlayer.isAI) {
      return;
    }

    // Get valid actions
    const validActions = adapter.getValidActions(game.state, currentTurn);
    
    // Get AI decision
    try {
      const decision = await this.getAIDecision(game, currentTurn, validActions);
      
      // Apply decision to game state using adapter
      game.state = adapter.processAction(game.state, decision);

      // Publish decision event
      this.publishUpdate({
        gameId: game.id,
        type: 'decision',
        data: { playerId: currentTurn, decision },
        timestamp: new Date(),
      });
    } catch (error) {
      console.error(`AI decision failed for player ${currentTurn}:`, error);
      // Apply default fold action
      game.state = adapter.processAction(game.state, { 
        action: 'fold', 
        playerId: currentTurn,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async processReverseHangmanTurn(game: GameInstance): Promise<void> {
    const adapter = this.adapters.get('reverse-hangman');
    if (!adapter) {
      console.error('Reverse Hangman adapter not found');
      return;
    }

    const currentTurn = adapter.getCurrentTurn(game.state);
    
    if (!currentTurn || game.state.phase !== 'playing' || adapter.isGameComplete(game.state)) {
      // Check if game is complete
      if (adapter.isGameComplete(game.state)) {
        game.status = 'completed';
        const winner = adapter.getWinner(game.state);
        if (winner) {
          console.log(`Game ${game.id} completed. Winner: ${winner}`);
        }
      }
      return;
    }

    const currentPlayer = game.state.players.find((p: any) => p.id === currentTurn);
    if (!currentPlayer || !currentPlayer.isAI) {
      return;
    }

    // Get valid actions
    const validActions = adapter.getValidActions(game.state, currentTurn);
    
    // Get AI decision
    try {
      const decision = await this.getAIDecision(game, currentTurn, validActions);
      
      // Apply decision to game state using adapter
      game.state = adapter.processAction(game.state, decision);

      // Publish decision event
      this.publishUpdate({
        gameId: game.id,
        type: 'decision',
        data: { playerId: currentTurn, decision },
        timestamp: new Date(),
      });
    } catch (error) {
      console.error(`AI decision failed for player ${currentTurn}:`, error);
      // Apply skip action
      game.state = adapter.processAction(game.state, { 
        type: 'skip', 
        playerId: currentTurn,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async getAIDecision(game: GameInstance, playerId: string, validActions: any[]): Promise<any> {
    console.log(`Getting AI decision for player ${playerId} in game ${game.id}`);
    
    const player = game.state.players.find((p: any) => p.id === playerId);
    if (!player || !player.aiModel) {
      throw new Error(`Player ${playerId} not found or not an AI`);
    }

    try {
      switch (game.type) {
        case 'poker': {
          // Prepare game state for poker AI
          const gameState = this.preparePokerGameState(game.state, playerId);
          const playerState = this.preparePokerPlayerState(game.state, playerId);
          
          const decision = await aiService.getPokerDecision(
            playerId,
            gameState,
            playerState,
            game.state.players.length - 1, // opponents count
            player.aiModel,
            player.aiStrategy || 'Play optimal poker strategy'
          );

          return {
            action: decision.action,
            amount: decision.amount,
            playerId,
            timestamp: new Date().toISOString()
          };
        }

        case 'reverse-hangman': {
          // Prepare game state for reverse hangman AI
          const gameState = this.prepareReverseHangmanGameState(game.state);
          const playerState = this.prepareReverseHangmanPlayerState(game.state, playerId);
          
          const decision = await aiService.getReverseHangmanDecision(
            playerId,
            gameState,
            playerState,
            player.aiModel,
            player.aiStrategy || 'Analyze the output and guess the original prompt'
          );

          return {
            type: 'guess',
            guess: decision.prompt_guess,
            playerId,
            timestamp: new Date().toISOString()
          };
        }

        default:
          throw new Error(`Game type ${game.type} not supported`);
      }
    } catch (error) {
      console.error(`AI decision error for ${playerId}:`, error);
      // Return a default safe action from validActions
      if (validActions.length > 0) {
        return validActions[0];
      }
      throw error;
    }
  }

  private preparePokerGameState(state: any, playerId: string): any {
    // Transform game state to match AI service expectations
    return {
      gameType: 'tournament',
      bettingStructure: 'no-limit',
      maxPlayers: state.maxPlayers || 8,
      currentPlayers: state.players.length,
      activePlayers: state.players.filter((p: any) => !p.folded && p.chips > 0).length,
      smallBlind: state.smallBlind || 50,
      bigBlind: state.bigBlind || 100,
      ante: state.ante || 0,
      level: state.blindLevel || 1,
      handNumber: state.handNumber || 1,
      dealerPosition: state.dealerPosition || 0,
      smallBlindPosition: state.smallBlindPosition || 1,
      bigBlindPosition: state.bigBlindPosition || 2,
      bettingRound: state.phase || 'preflop',
      communityCards: state.communityCards || [],
      potSize: state.pot || 0,
      sidePots: state.sidePots || [],
      currentBet: state.currentBet || 0,
      minRaise: state.minRaise || state.bigBlind * 2,
      opponents: state.players
        .filter((p: any) => p.id !== playerId)
        .map((p: any, index: number) => ({
          seat: p.seat || index,
          id: p.id,
          name: p.name || p.id,
          stackSize: p.chips || 0,
          position: p.position || 'unknown',
          positionType: p.positionType || 'middle',
          status: p.folded ? 'folded' : 'active',
          amountInPot: p.totalBet || 0,
          amountInRound: p.currentBet || 0,
          isAllIn: p.isAllIn || false,
          holeCardsKnown: false,
          holeCards: [],
          lastAction: p.lastAction
        })),
      actionHistory: state.actionHistory || { preflop: [], flop: [], turn: [], river: [] },
      mainPot: state.mainPot || state.pot || 0,
      totalPot: state.pot || 0,
      effectiveStackSize: state.effectiveStackSize || 0,
      potOdds: state.potOdds || {
        toCall: 0,
        potSize: state.pot || 0,
        oddsRatio: '0:1',
        percentage: 0,
        breakEvenPercentage: 0
      }
    };
  }

  private preparePokerPlayerState(state: any, playerId: string): any {
    const player = state.players.find((p: any) => p.id === playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    const toCall = state.currentBet - (player.currentBet || 0);
    const canCheck = toCall === 0;
    const canCall = toCall > 0 && player.chips > toCall;
    const canRaise = player.chips > toCall + (state.minRaise || state.bigBlind * 2);

    return {
      holeCards: player.holeCards || [],
      stackSize: player.chips || 0,
      position: player.position || 'unknown',
      positionType: player.positionType || 'middle',
      seatNumber: player.seat || 0,
      isAllIn: player.isAllIn || false,
      amountInvestedThisHand: player.totalBet || 0,
      amountInvestedThisRound: player.currentBet || 0,
      amountToCall: toCall,
      canCheck,
      canFold: true,
      canCall,
      canRaise,
      minRaiseAmount: state.minRaise || state.bigBlind * 2,
      maxRaiseAmount: player.chips || 0,
      seatsToActAfter: 0, // Simplified
      relativePosition: player.positionType || 'middle',
      playersLeftToAct: [],
      isClosingAction: false,
      isOpenAction: state.currentBet === 0,
      effectiveStacks: JSON.stringify({}),
      stackToPoRatio: player.chips / (state.pot || 1),
      commitmentLevel: (player.totalBet || 0) / (player.chips + (player.totalBet || 0)),
      handEvaluation: player.handEvaluation || null
    };
  }

  private prepareReverseHangmanGameState(state: any): any {
    return {
      game_type: 'reverse_hangman',
      output_shown: state.currentOutput || state.currentPromptPair?.output || '',
      constraints: {
        max_word_count: state.maxWordCount || 10,
        exact_word_count: state.exactWordCount || 0,
        difficulty: state.difficulty || 'medium',
        category: state.category || 'general',
        max_attempts: state.maxAttempts || 10
      },
      previous_guesses: (state.attempts || []).map((attempt: any, index: number) => ({
        attempt_number: index + 1,
        prompt_guess: attempt.guess || '',
        similarity_score: attempt.matchPercentage || 0,
        feedback: attempt.feedback || '',
        match_details: attempt.matchDetails || null
      })),
      game_phase: state.phase || 'playing',
      time_elapsed_seconds: Math.floor((Date.now() - (state.startTime || Date.now())) / 1000)
    };
  }

  private prepareReverseHangmanPlayerState(state: any, playerId: string): any {
    const player = state.players.find((p: any) => p.id === playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    return {
      player_id: playerId,
      current_round: state.roundNumber || 1,
      total_rounds: state.totalRounds || 3,
      current_score: player.totalScore || 0,
      rounds_won: player.roundsWon || 0,
      rounds_lost: player.roundsLost || 0
    };
  }

  async pauseGame(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }

    console.log(`Pausing game ${gameId}`);
    game.status = 'paused';
    
    // Clear the game loop interval
    if (game.loopInterval) {
      clearInterval(game.loopInterval);
      game.loopInterval = undefined;
    }

    await this.saveGameState(gameId, game);

    this.publishUpdate({
      gameId,
      type: 'event',
      data: { event: 'game_paused', status: 'paused' },
      timestamp: new Date(),
    });
  }

  async resumeGame(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }

    if (game.status === 'active') {
      return;
    }

    console.log(`Resuming game ${gameId}`);
    game.status = 'active';
    game.lastActivity = new Date();

    // Restart the game loop
    this.startGameLoop(game);

    this.publishUpdate({
      gameId,
      type: 'event',
      data: { event: 'game_resumed', status: 'active' },
      timestamp: new Date(),
    });
  }

  async addSpectator(gameId: string, userId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }

    game.spectators.add(userId);
    game.lastActivity = new Date();

    // Resume game if it was paused and has spectators
    if (game.status === 'paused' && game.spectators.size > 0) {
      await this.resumeGame(gameId);
    }

    console.log(`Added spectator ${userId} to game ${gameId}. Total spectators: ${game.spectators.size}`);
  }

  async removeSpectator(gameId: string, userId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) {
      return;
    }

    game.spectators.delete(userId);
    console.log(`Removed spectator ${userId} from game ${gameId}. Remaining spectators: ${game.spectators.size}`);

    // Pause game if no spectators after 30 seconds
    if (game.spectators.size === 0) {
      setTimeout(() => {
        if (game.spectators.size === 0 && game.status === 'active') {
          this.pauseGame(gameId);
        }
      }, 30000);
    }
  }

  private async saveGameState(gameId: string, game: GameInstance): Promise<void> {
    const gameData = {
      ...game,
      spectators: Array.from(game.spectators),
      loopInterval: undefined, // Don't serialize the interval
    };

    await this.redis.set(
      `game:${gameId}`,
      JSON.stringify(gameData),
      'EX',
      3600 // Expire after 1 hour
    );
  }

  // loadGameState method removed - not used

  private publishUpdate(update: GameUpdate): void {
    // Publish to GraphQL subscription
    this.pubsub.publish('GAME_UPDATE', update);
    
    // Also publish to specific game channel
    this.pubsub.publish(`GAME_UPDATE_${update.gameId}`, update);
  }

  private getLoopDelay(gameType: GameInstance['type']): number {
    switch (gameType) {
      case 'poker':
        return 2000; // 2 seconds per turn
      case 'reverse-hangman':
        return 3000; // 3 seconds per turn
      case 'chess':
      case 'go':
        return 5000; // 5 seconds per turn
      default:
        return 2000;
    }
  }

  private startCleanupProcess(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveGames();
    }, 5 * 60 * 1000);
  }

  private async cleanupInactiveGames(): Promise<void> {
    const now = new Date();
    const inactiveThreshold = 60 * 60 * 1000; // 1 hour

    for (const [gameId, game] of this.games) {
      const inactiveTime = now.getTime() - game.lastActivity.getTime();
      
      if (game.status === 'completed' && inactiveTime > inactiveThreshold) {
        console.log(`Cleaning up completed game ${gameId}`);
        
        // Clear interval if exists
        if (game.loopInterval) {
          clearInterval(game.loopInterval);
        }
        
        // Remove from memory
        this.games.delete(gameId);
        
        // Remove from Redis
        await this.redis.del(`game:${gameId}`);
      }
    }
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down GameManagerService');
    
    // Clear all intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const game of this.games.values()) {
      if (game.loopInterval) {
        clearInterval(game.loopInterval);
      }
    }

    // Close Redis connection
    await this.redis.quit();
  }

  // Getters for monitoring
  getActiveGames(): GameInstance[] {
    return Array.from(this.games.values()).filter(g => g.status === 'active');
  }

  getGameById(gameId: string): GameInstance | undefined {
    return this.games.get(gameId);
  }

  getTotalGames(): number {
    return this.games.size;
  }

  getGameStats(): any {
    const stats = {
      total: this.games.size,
      active: 0,
      paused: 0,
      waiting: 0,
      completed: 0,
      totalSpectators: 0,
    };

    for (const game of this.games.values()) {
      stats[game.status]++;
      stats.totalSpectators += game.spectators.size;
    }

    return stats;
  }

  // Export pubsub for GraphQL subscriptions
  getPubSub(): PubSub {
    return this.pubsub;
  }
}

// Singleton instance
export const gameManagerService = new GameManagerService();