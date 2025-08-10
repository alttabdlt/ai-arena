/**
 * SCHEMA NOTE: Game types are now dynamic strings, not hardcoded enums.
 * 
 * NO DATABASE CHANGES NEEDED for new games!
 * Games store their state in Match.gameHistory JSONB field.
 * 
 * To add a new game:
 * 1. Create adapter: GameEngineAdapterFactory.create('your-game')
 * 2. Register below: this.adapters.set('your-game', adapter)
 * 3. Store state in JSONB: { gameType: 'your-game', state: {...} }
 * 
 * See /backend/SCHEMA.md for storage patterns.
 */

import { PubSub } from 'graphql-subscriptions';
import { prisma } from '../config/database';
import { aiService } from './aiService';
import Redis from 'ioredis';
import { GameEngineAdapter, GameEngineAdapterFactory } from './gameEngineAdapter';
import { fileLoggerService } from './fileLoggerService';
import { ExperienceService } from './experienceService';
import { getConnect4TournamentService } from './connect4TournamentService';
import { formatTimestamp } from '../utils/dateFormatter';

export interface GameInstance {
  id: string;
  type: string; // Dynamic game type - any game can be added without schema changes
  state: any;
  players: string[];
  spectators: Set<string>;
  status: 'waiting' | 'active' | 'paused' | 'completed';
  lastActivity: Date;
  loopInterval?: NodeJS.Timeout;
  frontendReady: boolean;
  frontendReadyTimeout?: NodeJS.Timeout;
  aiThinking: Set<string>; // Track which players have pending AI decisions
  processingTurn: boolean; // Lock to prevent concurrent turn processing
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

  constructor(pubsub?: PubSub) {
    this.pubsub = pubsub || new PubSub();
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });

    // Initialize game adapters
    this.adapters.set('poker', GameEngineAdapterFactory.create('poker'));
    this.adapters.set('reverse-hangman', GameEngineAdapterFactory.create('reverse-hangman'));
    this.adapters.set('connect4', GameEngineAdapterFactory.create('connect4'));
    this.adapters.set('battleship', GameEngineAdapterFactory.create('battleship'));

    // Start cleanup interval
    this.startCleanupProcess();
  }

  async createGame(
    gameId: string,
    type: string, // Accept any game type string
    players: string[],
    initialState: any
  ): Promise<GameInstance> {
    console.log(`Creating game: ${gameId} of type ${type} with ${players.length} players`);
    
    // Start file logging for this game
    fileLoggerService.startGameLogging(type, gameId);
    
    // Log to file
    fileLoggerService.addLog({
      timestamp: formatTimestamp(),
      level: 'info',
      source: 'backend',
      message: `Creating game: ${gameId} of type ${type} with ${players.length} players`,
      data: { gameId, type, players, initialState }
    });

    const game: GameInstance = {
      id: gameId,
      type,
      state: initialState,
      players,
      spectators: new Set(),
      status: 'waiting',
      lastActivity: new Date(),
      frontendReady: false,
      aiThinking: new Set(),
      processingTurn: false,
    };

    this.games.set(gameId, game);

    // Store in Redis for persistence
    await this.saveGameState(gameId, game);

    // Update match status in database
    await prisma.match.update({
      where: { id: gameId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
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

    console.log(`Starting game ${gameId}, waiting for frontend...`);
    game.status = 'active';
    game.lastActivity = new Date();

    // Set a timeout for frontend readiness
    game.frontendReadyTimeout = setTimeout(() => {
      console.warn(`Frontend ready timeout for game ${gameId}, starting anyway`);
      game.frontendReady = true;
      this.startGameLoop(game);
    }, 30000); // 30 second timeout

    // If frontend is already ready, start immediately
    if (game.frontendReady) {
      clearTimeout(game.frontendReadyTimeout);
      this.startGameLoop(game);
    }

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

        // Check if a turn is already being processed
        if (game.processingTurn) {
          console.log(`Game ${game.id} is already processing a turn, skipping this iteration`);
          return;
        }

        // Lock turn processing
        game.processingTurn = true;

        // Update last activity
        game.lastActivity = new Date();

        // Process game turn based on type
        await this.processGameTurn(game);

      } catch (error) {
        console.error(`Error in game loop for ${game.id}:`, error);
        // Don't stop the loop on error, just log it
      } finally {
        // Always unlock turn processing
        game.processingTurn = false;
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
      case 'connect4':
        await this.processConnect4Turn(game);
        break;
      case 'battleship':
        await this.processBattleshipTurn(game);
        break;
      case 'chess':
      case 'go':
        // TODO: Implement other game types
        console.log(`Game type ${game.type} not yet implemented`);
        break;
    }

    // Save updated state
    await this.saveGameState(game.id, game);

    // Publish state update with proper structure
    const stateData = game.type === 'poker' ? {
      state: {
        ...game.state,
        gameSpecific: {
          bettingRound: game.state.phase,
          communityCards: game.state.communityCards,
          pot: game.state.pot,
          currentBet: game.state.currentBet,
          handComplete: game.state.phase === 'complete' || game.state.phase === 'showdown',
          winners: game.state.winners || [],
          handNumber: game.state.handNumber || 1
        }
      }
    } : { state: game.state };
    
    this.publishUpdate({
      gameId: game.id,
      type: 'state',
      data: stateData,
      timestamp: new Date(),
    });
  }

  private async processPokerTurn(game: GameInstance): Promise<void> {
    const adapter = this.adapters.get('poker');
    if (!adapter) {
      console.error('Poker adapter not found');
      return;
    }

    // Check if current hand is complete but game should continue
    if (game.state.phase === 'handComplete' && game.state.handComplete) {
      // Check if game should truly end
      if (adapter.isGameComplete(game.state)) {
        game.status = 'completed';
        const winner = adapter.getWinner(game.state);
        if (winner) {
          console.log(`Game ${game.id} completed. Winner: ${winner}`);
        }
        // Handle game completion (including auto-requeue for demo bots)
        await this.handleGameComplete(game);
        return;
      }
      
      // Otherwise, start a new hand
      await this.startNewPokerHand(game);
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
        // Handle game completion (including auto-requeue for demo bots)
        await this.handleGameComplete(game);
      }
      return;
    }

    const currentPlayer = game.state.players.find((p: any) => p.id === currentTurn);
    if (!currentPlayer || !currentPlayer.isAI) {
      return;
    }

    // Get valid actions
    const validActions = adapter.getValidActions(game.state, currentTurn);
    
    // Publish thinking start event
    this.publishUpdate({
      gameId: game.id,
      type: 'event',
      data: { event: 'thinking_start', playerId: currentTurn },
      timestamp: new Date(),
    });
    
    // Get speed setting from game state (default to 'normal' if not set)
    const gameSpeed = game.state.speed || 'normal';
    
    // Add delay based on game speed for better visualization
    const speedDelays: Record<string, number> = {
      'fast': 500,      // 0.5 seconds
      'normal': 1000,   // 1 second
      'thinking': 2000  // 2 seconds
    };
    const visualizationDelay = speedDelays[gameSpeed] || 1000;
    
    // Wait before getting AI decision for better pacing
    await new Promise(resolve => setTimeout(resolve, visualizationDelay));
    
    // Get AI decision
    try {
      const decision = await this.getAIDecision(game, currentTurn, validActions);
      
      // Debug: Log state before processing action
      const oldPhase = game.state.phase;
      const oldCommunityCards = game.state.communityCards?.length || 0;
      const oldCurrentTurn = game.state.currentTurn;
      const oldHasActed = currentPlayer.hasActed;
      
      // Apply decision to game state using adapter
      game.state = adapter.processAction(game.state, decision);
      
      // Debug: Log state changes after action
      const newPhase = game.state.phase;
      const newCommunityCards = game.state.communityCards?.length || 0;
      const newCurrentTurn = game.state.currentTurn;
      const activePlayers = game.state.players.filter((p: any) => !p.folded);
      
      console.log(`🎯 [Poker] Action processed:`, {
        playerId: currentTurn,
        playerName: currentPlayer.name,
        action: decision.action,
        handNumber: game.state.handNumber,
        phaseTransition: oldPhase !== newPhase ? `${oldPhase} → ${newPhase}` : oldPhase,
        turnChanged: oldCurrentTurn !== newCurrentTurn,
        hasActedChanged: `${oldHasActed} → ${currentPlayer.hasActed}`,
        communityCardsDealt: newCommunityCards - oldCommunityCards,
        totalCommunityCards: newCommunityCards,
        currentBet: game.state.currentBet,
        pot: game.state.pot,
        activePlayers: activePlayers.length,
        activePlayerNames: activePlayers.map((p: any) => p.name)
      });

      // Publish decision event with hand number for poker games
      const decisionData: any = { playerId: currentTurn, decision };
      if (game.type === 'poker' && game.state.handNumber) {
        decisionData.handNumber = game.state.handNumber;
      }
      
      this.publishUpdate({
        gameId: game.id,
        type: 'decision',
        data: decisionData,
        timestamp: new Date(),
      });
      
      // Publish thinking complete event
      this.publishUpdate({
        gameId: game.id,
        type: 'event',
        data: { event: 'thinking_complete', playerId: currentTurn },
        timestamp: new Date(),
      });
      
      // CRITICAL: Publish updated state after AI action
      // This was missing and causing community cards not to show!
      const stateData = game.type === 'poker' ? {
        state: {
          ...game.state,
          gameSpecific: {
            bettingRound: game.state.phase,
            communityCards: game.state.communityCards,
            pot: game.state.pot,
            currentBet: game.state.currentBet,
            handComplete: game.state.phase === 'complete' || game.state.phase === 'showdown' || game.state.handComplete,
            winners: game.state.winners || [],
            handNumber: game.state.handNumber || 1
          }
        }
      } : { state: game.state };
      
      this.publishUpdate({
        gameId: game.id,
        type: 'state',
        data: stateData,
        timestamp: new Date(),
      });
      
      // Add delay after AI decision to prevent API rate limiting
      // This gives time for the AI service to process and prevents overwhelming the API
      const postDecisionDelay = gameSpeed === 'fast' ? 1000 : 2000; // 1s for fast, 2s for normal/thinking
      console.log(`⏱️ [Poker] Waiting ${postDecisionDelay}ms after AI decision before next turn`);
      await new Promise(resolve => setTimeout(resolve, postDecisionDelay));
      
      // Clear AI thinking status
      game.aiThinking.delete(currentTurn);
      console.log(`✅ [Poker] AI ${currentPlayer.name} finished thinking. Still thinking: ${game.aiThinking.size} players`);
    } catch (error) {
      console.error(`AI decision failed for player ${currentTurn}:`, error);
      
      // Clear AI thinking status even on error
      game.aiThinking.delete(currentTurn);
      console.log(`❌ [Poker] AI ${currentPlayer.name} failed, cleared thinking status. Still thinking: ${game.aiThinking.size} players`);
      // Apply default fold action
      game.state = adapter.processAction(game.state, { 
        action: 'fold', 
        playerId: currentTurn,
        timestamp: new Date().toISOString()
      });
      
      // Also publish state after error/fold
      const errorStateData = game.type === 'poker' ? {
        state: {
          ...game.state,
          gameSpecific: {
            bettingRound: game.state.phase,
            communityCards: game.state.communityCards,
            pot: game.state.pot,
            currentBet: game.state.currentBet,
            handComplete: game.state.phase === 'complete' || game.state.phase === 'showdown' || game.state.handComplete,
            winners: game.state.winners || [],
            handNumber: game.state.handNumber || 1
          }
        }
      } : { state: game.state };
      
      this.publishUpdate({
        gameId: game.id,
        type: 'state',
        data: errorStateData,
        timestamp: new Date(),
      });
    }
  }

  private async startNewPokerHand(game: GameInstance): Promise<void> {
    console.log(`Starting new poker hand for game ${game.id}`);
    
    // Add delay between hands for better pacing
    const betweenHandDelay = 3000; // 3 seconds between hands
    console.log(`⏱️ [Poker] Waiting ${betweenHandDelay}ms before starting hand ${(game.state.handNumber || 1) + 1}`);
    await new Promise(resolve => setTimeout(resolve, betweenHandDelay));
    
    // Increment hand number
    const newHandNumber = (game.state.handNumber || 1) + 1;
    
    // Reset players for new hand
    const playersWithChips = game.state.players.filter((p: any) => p.chips > 0);
    
    // Rotate dealer position
    const currentDealerPos = game.state.dealerPosition || 0;
    const newDealerPos = (currentDealerPos + 1) % playersWithChips.length;
    
    // Calculate blind positions
    const smallBlindPos = (newDealerPos + 1) % playersWithChips.length;
    const bigBlindPos = (newDealerPos + 2) % playersWithChips.length;
    
    // Create and shuffle new deck
    const deck = this.createShuffledDeck();
    
    // Deal hole cards to each player
    playersWithChips.forEach((player: any, index: number) => {
      player.holeCards = [deck.pop(), deck.pop()];
      player.folded = false;
      player.bet = 0;
      player.totalBet = 0;
      player.isAllIn = false;
      player.hasActed = false;
      
      // Post blinds
      if (index === smallBlindPos) {
        const smallBlind = Math.min(game.state.smallBlind, player.chips);
        player.bet = smallBlind;
        player.totalBet = smallBlind;
        player.chips -= smallBlind;
      } else if (index === bigBlindPos) {
        const bigBlind = Math.min(game.state.bigBlind, player.chips);
        player.bet = bigBlind;
        player.totalBet = bigBlind;
        player.chips -= bigBlind;
      }
    });
    
    // Update game state for new hand
    game.state.handNumber = newHandNumber;
    game.state.dealerPosition = newDealerPos;
    game.state.smallBlindPosition = smallBlindPos;
    game.state.bigBlindPosition = bigBlindPos;
    game.state.currentTurn = playersWithChips[(bigBlindPos + 1) % playersWithChips.length].id;
    game.state.communityCards = [];
    game.state.pot = game.state.smallBlind + game.state.bigBlind;
    game.state.currentBet = game.state.bigBlind;
    game.state.minRaise = game.state.bigBlind * 2;
    game.state.phase = 'preflop';
    game.state.deck = deck;
    game.state.burnt = [];
    game.state.actionHistory = { preflop: [], flop: [], turn: [], river: [] };
    game.state.lastAction = null;
    game.state.handComplete = false;
    game.state.winners = [];
    
    console.log(`Started hand ${newHandNumber} with ${playersWithChips.length} players`);
    
    // Publish hand start event
    this.publishUpdate({
      gameId: game.id,
      type: 'event',
      data: { 
        event: 'hand_started',
        handNumber: newHandNumber,
        playersCount: playersWithChips.length
      },
      timestamp: new Date(),
    });
    
    // Update state
    // Publishing state will be handled by processGameTurn after this returns
  }
  
  private createShuffledDeck(): string[] {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
    const deck: string[] = [];
    
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push(rank + suit);
      }
    }
    
    // Shuffle using Fisher-Yates algorithm
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    return deck;
  }

  private async processConnect4Turn(game: GameInstance): Promise<void> {
    const adapter = this.adapters.get('connect4');
    if (!adapter) {
      console.error('Connect4 adapter not found');
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
        // Handle game completion (including auto-requeue for demo bots)
        await this.handleGameComplete(game);
      }
      return;
    }

    const currentPlayer = game.state.players.find((p: any) => p.id === currentTurn);
    if (!currentPlayer || !currentPlayer.isAI) {
      return;
    }

    // Check if this AI is already thinking
    if (game.aiThinking.has(currentTurn)) {
      console.log(`AI ${currentTurn} is already thinking, skipping turn processing`);
      return;
    }

    // Get valid actions
    const validActions = adapter.getValidActions(game.state, currentTurn);
    
    // Mark AI as thinking
    game.aiThinking.add(currentTurn);
    console.log(`🤖 [Poker] AI ${currentPlayer.name} (${currentTurn}) marked as thinking. Currently thinking: ${game.aiThinking.size} players`);
    
    // Publish thinking start event
    this.publishUpdate({
      gameId: game.id,
      type: 'event',
      data: { event: 'thinking_start', playerId: currentTurn },
      timestamp: new Date(),
    });
    
    // Get AI decision
    try {
      const decision = await this.getAIDecision(game, currentTurn, validActions);
      
      // Log Connect4 decision details
      console.log('Connect4 AI decision received:', {
        playerId: currentTurn,
        column: decision.column,
        reasoning: decision.reasoning,
        confidence: decision.confidence,
        hasReasoning: !!decision.reasoning,
        reasoningLength: decision.reasoning?.length
      });
      
      // Apply decision to game state using adapter
      game.state = adapter.processAction(game.state, decision);

      // Publish decision event with hand number for poker games
      const decisionData: any = { playerId: currentTurn, decision };
      if (game.type === 'poker' && game.state.handNumber) {
        decisionData.handNumber = game.state.handNumber;
      }
      
      this.publishUpdate({
        gameId: game.id,
        type: 'decision',
        data: decisionData,
        timestamp: new Date(),
      });
      
      // Publish thinking complete event
      this.publishUpdate({
        gameId: game.id,
        type: 'event',
        data: { event: 'thinking_complete', playerId: currentTurn },
        timestamp: new Date(),
      });
    } catch (error) {
      console.error(`AI decision failed for player ${currentTurn}:`, error);
      // Apply timeout action
      game.state = adapter.processAction(game.state, { 
        type: 'timeout', 
        playerId: currentTurn,
        timestamp: new Date().toISOString()
      });
    } finally {
      // Always clear thinking state
      game.aiThinking.delete(currentTurn);
    }
  }

  private async processBattleshipTurn(game: GameInstance): Promise<void> {
    const adapter = this.adapters.get('battleship');
    if (!adapter) {
      console.error('Battleship adapter not found');
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
        // Handle game completion (including auto-requeue for demo bots)
        await this.handleGameComplete(game);
      }
      return;
    }

    const currentPlayer = game.state.players.find((p: any) => p.id === currentTurn);
    if (!currentPlayer || !currentPlayer.isAI) {
      return;
    }

    // Check if this AI is already thinking
    if (game.aiThinking.has(currentTurn)) {
      console.log(`AI ${currentTurn} is already thinking, skipping turn processing`);
      return;
    }

    // Get valid actions
    const validActions = adapter.getValidActions(game.state, currentTurn);
    
    // Mark AI as thinking
    game.aiThinking.add(currentTurn);
    console.log(`🚢 [Battleship] AI ${currentPlayer.name} (${currentTurn}) marked as thinking. Currently thinking: ${game.aiThinking.size} players`);
    
    // Publish thinking start event
    this.publishUpdate({
      gameId: game.id,
      type: 'event',
      data: { event: 'thinking_start', playerId: currentTurn },
      timestamp: new Date(),
    });
    
    // Get AI decision
    try {
      const decision = await this.getAIDecision(game, currentTurn, validActions);
      
      // Log Battleship decision details
      console.log('Battleship AI decision received:', {
        playerId: currentTurn,
        actionType: decision.type,
        coordinate: decision.coordinate,
        shipId: decision.shipId,
        reasoning: decision.reasoning,
        confidence: decision.confidence
      });
      
      // Apply decision to game state using adapter
      game.state = adapter.processAction(game.state, decision);

      // Publish decision event
      const decisionData: any = { playerId: currentTurn, decision };
      
      this.publishUpdate({
        gameId: game.id,
        type: 'decision',
        data: decisionData,
        timestamp: new Date(),
      });
      
      // Publish thinking complete event
      this.publishUpdate({
        gameId: game.id,
        type: 'event',
        data: { event: 'thinking_complete', playerId: currentTurn },
        timestamp: new Date(),
      });
    } catch (error) {
      console.error(`AI decision failed for player ${currentTurn}:`, error);
      // Apply timeout action
      game.state = adapter.processAction(game.state, { 
        type: 'timeout', 
        playerId: currentTurn,
        timestamp: new Date().toISOString()
      });
    } finally {
      // Always clear thinking state
      game.aiThinking.delete(currentTurn);
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
        // Handle game completion (including auto-requeue for demo bots)
        await this.handleGameComplete(game);
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

      // Publish decision event with hand number for poker games
      const decisionData: any = { playerId: currentTurn, decision };
      if (game.type === 'poker' && game.state.handNumber) {
        decisionData.handNumber = game.state.handNumber;
      }
      
      this.publishUpdate({
        gameId: game.id,
        type: 'decision',
        data: decisionData,
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

  private normalizeModelName(model: string): string {
    // Convert database format (UPPERCASE_UNDERSCORE) to aiService format (lowercase-hyphen)
    const modelMap: { [key: string]: string } = {
      'DEEPSEEK_CHAT': 'deepseek-chat',
      'CLAUDE_3_5_SONNET': 'claude-3-5-sonnet',
      'CLAUDE_3_OPUS': 'claude-3-opus',
      'GPT_4O': 'gpt-4o',
      // Also support already normalized names
      'deepseek-chat': 'deepseek-chat',
      'claude-3-5-sonnet': 'claude-3-5-sonnet',
      'claude-3-opus': 'claude-3-opus',
      'gpt-4o': 'gpt-4o',
    };
    
    return modelMap[model] || model;
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
            this.normalizeModelName(player.aiModel) as 'gpt-4o' | 'deepseek-chat' | 'claude-3-5-sonnet' | 'claude-3-opus',
            player.aiStrategy || 'Play optimal poker strategy'
          );

          return {
            action: decision.action,
            amount: decision.amount,
            playerId,
            timestamp: new Date().toISOString(),
            reasoning: decision.reasoning,
            confidence: decision.confidence
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
            this.normalizeModelName(player.aiModel) as 'gpt-4o' | 'deepseek-chat' | 'claude-3-5-sonnet' | 'claude-3-opus',
            player.aiStrategy || 'Analyze the output and guess the original prompt'
          );

          return {
            type: 'guess',
            guess: decision.prompt_guess,
            playerId,
            timestamp: new Date().toISOString()
          };
        }

        case 'connect4': {
          // Prepare game state for Connect4 AI
          const gameState = this.prepareConnect4GameState(game.state);
          const playerState = this.prepareConnect4PlayerState(game.state, playerId);
          
          const decision = await aiService.getConnect4Decision(
            playerId,
            gameState,
            playerState,
            this.normalizeModelName(player.aiModel) as 'gpt-4o' | 'deepseek-chat' | 'claude-3-5-sonnet' | 'claude-3-opus',
            player.aiStrategy || 'Play optimal Connect4 strategy'
          );

          return {
            type: 'place',
            column: decision.column,
            playerId,
            timestamp: new Date().toISOString(),
            reasoning: decision.reasoning,
            confidence: decision.confidence
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
    // Extract the actual output from currentPromptPair
    const output = state.currentPromptPair?.output || state.generatedOutput || state.currentOutput || '';
    const targetWordCount = state.currentPromptPair?.prompt ? 
      state.currentPromptPair.prompt.split(' ').length : 10;
    
    console.log('prepareReverseHangmanGameState:', {
      hasPromptPair: !!state.currentPromptPair,
      output: output.substring(0, 100) + '...',
      targetWordCount,
      attempts: state.attempts?.length || 0
    });
    
    return {
      game_type: 'reverse_hangman',
      output_shown: output,
      constraints: {
        max_word_count: targetWordCount + 5,
        exact_word_count: targetWordCount,
        difficulty: state.currentPromptPair?.difficulty || state.difficulty || 'medium',
        category: state.currentPromptPair?.category || state.category || 'general',
        max_attempts: state.maxAttempts || 6
      },
      previous_guesses: (state.attempts || []).map((attempt: any, index: number) => ({
        attempt_number: index + 1,
        prompt_guess: attempt.guess || '',
        similarity_score: attempt.matchPercentage || 0,
        feedback: attempt.feedback || '',
        match_details: attempt.matchDetails || null,
        matched_words: attempt.matchDetails?.matchedWords || [],
        missing_words: attempt.matchDetails?.missingWords || [],
        extra_words: attempt.matchDetails?.extraWords || [],
        semantic_matches: attempt.matchDetails?.semanticMatches || []
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

  private prepareConnect4GameState(state: any): any {
    // Log the board state being sent to AI
    console.log('Preparing Connect4 game state for AI:');
    console.log('Board dimensions:', state.board.length, 'x', state.board[0]?.length);
    console.log('Board state:');
    state.board.forEach((row: any[], index: number) => {
      console.log(`Row ${index}:`, row.map(cell => cell === 0 ? '_' : cell === 1 ? 'X' : cell === 2 ? 'O' : '?').join(' '));
    });
    
    // Get valid columns by checking which columns have space
    const validColumns: number[] = [];
    for (let col = 0; col < state.board[0].length; col++) {
      let hasSpace = false;
      for (let row = 0; row < state.board.length; row++) {
        if (state.board[row][col] === null || state.board[row][col] === 0) {
          hasSpace = true;
          break;
        }
      }
      if (hasSpace) {
        validColumns.push(col);
      }
    }

    // Convert board to X/O format for AI
    const convertedBoard = state.board.map((row: any[]) => 
      row.map(cell => {
        if (cell === 0 || cell === null) return '_';
        if (cell === 1) return 'X';
        if (cell === 2) return 'O';
        return '?';
      })
    );

    return {
      board: convertedBoard,
      move_count: state.moveCount || 0,
      last_move: state.lastMove || null,
      valid_columns: validColumns,
      phase: state.phase || 'playing'
    };
  }

  private prepareConnect4PlayerState(state: any, playerId: string): any {
    const playerIndex = state.players.findIndex((p: any) => p.id === playerId);
    const player = state.players[playerIndex];
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    const playerNumber = playerIndex + 1; // Convert to 1-based
    const opponentNumber = playerNumber === 1 ? 2 : 1;

    // Count pieces for each player
    let playerPieces = 0;
    let opponentPieces = 0;
    let centerControl = 0;
    let edgePieces = 0;
    
    for (let row = 0; row < state.board.length; row++) {
      for (let col = 0; col < state.board[0].length; col++) {
        if (state.board[row][col] === playerNumber) {
          playerPieces++;
          // Check center columns (3 and 4 for 8x8 board)
          if (col === 3 || col === 4) {
            centerControl++;
          }
          // Check edge columns
          if (col === 0 || col === 7) {
            edgePieces++;
          }
        } else if (state.board[row][col] === opponentNumber) {
          opponentPieces++;
        }
      }
    }

    // Check for threats - where can win or must block
    const canWinNext = this.checkWinningMoves(state.board, playerNumber);
    const mustBlock = this.checkWinningMoves(state.board, opponentNumber);

    return {
      player_number: playerNumber,
      pieces_on_board: playerPieces,
      opponent_pieces: opponentPieces,
      board_metrics: {
        center_control: centerControl,
        edge_pieces: edgePieces,
        connected_sequences: this.countConnectedSequences(state.board, playerNumber)
      },
      threat_analysis: {
        can_win_next: canWinNext,
        must_block: mustBlock
      },
      calculations: {
        board_fullness: ((playerPieces + opponentPieces) / (state.board.length * state.board[0].length)) * 100,
        has_immediate_win: canWinNext.length > 0,
        has_immediate_threat: mustBlock.length > 0
      }
    };
  }

  private checkWinningMoves(board: any[][], playerNumber: number): number[] {
    const winningColumns: number[] = [];
    
    // Check each column
    for (let col = 0; col < board[0].length; col++) {
      // Find the row where a piece would land
      let row = -1;
      for (let r = board.length - 1; r >= 0; r--) {
        if (board[r][col] === 0 || board[r][col] === null) {
          row = r;
          break;
        }
      }
      
      // If column is full, skip
      if (row === -1) continue;
      
      // Temporarily place the piece
      board[row][col] = playerNumber;
      
      // Check if this creates a win
      if (this.checkWinAt(board, row, col, playerNumber)) {
        winningColumns.push(col);
      }
      
      // Remove the temporary piece
      board[row][col] = 0;
    }
    
    return winningColumns;
  }

  private checkWinAt(board: any[][], row: number, col: number, playerNumber: number): boolean {
    // Check all four directions
    const directions = [
      { dr: 0, dc: 1 },  // Horizontal
      { dr: 1, dc: 0 },  // Vertical
      { dr: 1, dc: 1 },  // Diagonal down-right
      { dr: 1, dc: -1 }  // Diagonal down-left
    ];
    
    for (const { dr, dc } of directions) {
      let count = 1;
      
      // Check positive direction
      let r = row + dr;
      let c = col + dc;
      while (r >= 0 && r < board.length && c >= 0 && c < board[0].length && board[r][c] === playerNumber) {
        count++;
        r += dr;
        c += dc;
      }
      
      // Check negative direction
      r = row - dr;
      c = col - dc;
      while (r >= 0 && r < board.length && c >= 0 && c < board[0].length && board[r][c] === playerNumber) {
        count++;
        r -= dr;
        c -= dc;
      }
      
      if (count >= 4) {
        return true;
      }
    }
    
    return false;
  }

  private countConnectedSequences(board: any[][], playerNumber: number): Record<string, number> {
    const sequences = { two: 0, three: 0 };
    const visited = new Set<string>();
    
    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[0].length; col++) {
        if (board[row][col] === playerNumber) {
          // Check all directions
          const directions = [
            { dr: 0, dc: 1 },  // Horizontal
            { dr: 1, dc: 0 },  // Vertical
            { dr: 1, dc: 1 },  // Diagonal down-right
            { dr: 1, dc: -1 }  // Diagonal down-left
          ];
          
          for (const { dr, dc } of directions) {
            const key = `${row},${col},${dr},${dc}`;
            if (visited.has(key)) continue;
            
            let count = 1;
            let r = row + dr;
            let c = col + dc;
            
            while (r >= 0 && r < board.length && c >= 0 && c < board[0].length && board[r][c] === playerNumber) {
              visited.add(`${r},${c},${dr},${dc}`);
              count++;
              r += dr;
              c += dc;
            }
            
            if (count === 2) sequences.two++;
            else if (count === 3) sequences.three++;
          }
        }
      }
    }
    
    return sequences;
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

  async updateGameSpeed(gameId: string, speed: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }

    // Update the game state with new speed
    game.state.speed = speed;
    console.log(`Updated game ${gameId} speed to: ${speed}`);

    // Save updated state
    await this.saveGameState(gameId, game);

    // Publish speed update event
    this.publishUpdate({
      gameId,
      type: 'event',
      data: { event: 'speed_changed', speed },
      timestamp: new Date(),
    });
  }

  private async saveGameState(gameId: string, game: GameInstance): Promise<void> {
    const gameData = {
      ...game,
      spectators: Array.from(game.spectators),
      aiThinking: Array.from(game.aiThinking), // Serialize the Set
      loopInterval: undefined, // Don't serialize the interval
      frontendReadyTimeout: undefined, // Don't serialize the timeout
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
        return 3000; // 3 seconds per turn - increased to better handle AI response times
      case 'reverse-hangman':
        return 3000; // 3 seconds per turn
      case 'connect4':
        return 5000; // 5 seconds per turn - increased to prevent race conditions
      case 'chess':
      case 'go':
        return 5000; // 5 seconds per turn
      default:
        return 3000; // Default to 3 seconds
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

  private async handleGameComplete(game: GameInstance): Promise<void> {
    console.log(`Handling game completion for ${game.id}`);
    
    try {
      // Handle Connect4 tournament progression
      if (game.type === 'connect4') {
        const adapter = this.adapters.get('connect4');
        const winner = adapter?.getWinner(game.state);
        
        if (winner) {
          const connect4TournamentService = getConnect4TournamentService(prisma, this.pubsub);
          const nextMatch = await connect4TournamentService.handleMatchComplete(game.id, winner);
          
          // If there's a next match (finals), start it
          if (nextMatch) {
            await this.createGame(
              nextMatch.id,
              'connect4',
              [nextMatch.player1Id, nextMatch.player2Id],
              nextMatch.gameState
            );
            await this.startGame(nextMatch.id);
            console.log(`Started Connect4 finals match ${nextMatch.id}`);
          }
        }
      }
      
      // Get final rankings from the game adapter
      const adapter = this.adapters.get(game.type);
      const finalRankings = adapter?.getFinalRankings ? adapter.getFinalRankings(game.state) : [];
      
      // Update match status in database
      await prisma.match.update({
        where: { id: game.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
      
      // Update participant rankings
      if (finalRankings.length > 0) {
        for (const ranking of finalRankings) {
          await prisma.matchParticipant.updateMany({
            where: {
              matchId: game.id,
              botId: ranking.playerId,
            },
            data: {
              finalRank: ranking.rank,
              points: ranking.points || 0,
            },
          });
        }
      }

      // Get all bots that participated in this tournament
      const participants = await prisma.matchParticipant.findMany({
        where: { matchId: game.id },
        include: { bot: true },
        orderBy: { finalRank: 'asc' },
      });
      
      // Generate lootbox rewards and grant XP for all participants
      try {
        const { economyService } = await import('./economyService');
        const totalParticipants = participants.length;
        
        for (const participant of participants) {
          // Skip demo bots from getting lootboxes and XP
          if (participant.bot.isDemo) {
            continue;
          }
          
          // Calculate performance based on final rank (1st place = 1.0, last place = 0.0)
          const performance = participant.finalRank 
            ? 1 - ((participant.finalRank - 1) / (totalParticipants - 1))
            : 0.5; // Default to 0.5 if no rank
          
          // Generate lootbox
          await economyService.generateMatchLootbox(game.id, participant.botId, performance);
          console.log(`Generated lootbox for ${participant.bot.name} with performance ${performance.toFixed(2)}`);
          
          // Grant XP based on performance
          try {
            const isWinner = participant.finalRank === 1;
            const xpGain = isWinner 
              ? ExperienceService.getXPForActivity('match_win')
              : ExperienceService.getXPForActivity('match_loss');
            
            if (xpGain) {
              const levelUpResult = await ExperienceService.grantXP(participant.botId, xpGain);
              
              if (levelUpResult) {
                console.log(`🎉 ${participant.bot.name} leveled up to ${levelUpResult.newLevel}!`);
                // Publish level up event
                this.publishUpdate({
                  gameId: game.id,
                  type: 'event',
                  data: { 
                    event: 'level_up', 
                    botId: participant.botId,
                    newLevel: levelUpResult.newLevel,
                    unlocked: levelUpResult.unlocked,
                  },
                  timestamp: new Date(),
                });
              }
            }
            
            // Grant additional XP for tournament participation if this is part of a tournament
            const match = await prisma.match.findUnique({
              where: { id: game.id },
              include: { tournament: true }
            });
            
            if (match?.tournament) {
              const tournamentXP = isWinner
                ? ExperienceService.getXPForActivity('tournament_win')
                : ExperienceService.getXPForActivity('tournament_participation');
              
              if (tournamentXP) {
                await ExperienceService.grantXP(participant.botId, tournamentXP);
              }
            }
          } catch (xpError) {
            console.error(`Error granting XP to ${participant.bot.name}:`, xpError);
          }
        }
      } catch (error) {
        console.error('Error generating lootbox rewards:', error);
      }

      // Auto-requeue demo bots
      for (const participant of participants) {
        if (participant.bot.isDemo) {
          console.log(`Auto re-queueing demo bot: ${participant.bot.name}`);
          
          // Check if bot is already in queue
          const existingEntry = await prisma.queueEntry.findFirst({
            where: {
              botId: participant.botId,
              status: 'WAITING',
            },
          });

          if (!existingEntry) {
            // Add demo bot back to queue
            await prisma.queueEntry.create({
              data: {
                botId: participant.botId,
                queueType: 'STANDARD',
                priority: 0,
                status: 'WAITING',
                enteredAt: new Date(),
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
              },
            });
            console.log(`Demo bot ${participant.bot.name} re-queued successfully`);
          }
        }
      }

      // Clear game loop interval
      if (game.loopInterval) {
        clearInterval(game.loopInterval);
        game.loopInterval = undefined;
      }

      // Publish completion event
      this.publishUpdate({
        gameId: game.id,
        type: 'event',
        data: { 
          event: 'game_completed',
          status: 'completed',
          winner: this.adapters.get(game.type)?.getWinner(game.state) || null,
        },
        timestamp: new Date(),
      });
    } catch (error) {
      console.error(`Error handling game completion for ${game.id}:`, error);
    }
  }

  async signalFrontendReady(matchId: string): Promise<boolean> {
    const game = this.games.get(matchId);
    if (!game) {
      console.error(`Game ${matchId} not found for frontend ready signal`);
      return false;
    }

    if (game.frontendReady) {
      console.log(`Frontend already marked as ready for game ${matchId}`);
      return true;
    }

    console.log(`Frontend ready signal received for game ${matchId}`);
    game.frontendReady = true;

    // Clear the timeout if it exists
    if (game.frontendReadyTimeout) {
      clearTimeout(game.frontendReadyTimeout);
      game.frontendReadyTimeout = undefined;
    }

    // If game is active but not yet started, start the game loop now
    if (game.status === 'active' && !game.loopInterval) {
      console.log(`Starting game loop for ${matchId} now that frontend is ready`);
      this.startGameLoop(game);
    }

    return true;
  }
  
  async startReverseHangmanRound(matchId: string, difficulty: string): Promise<boolean> {
    const game = this.games.get(matchId);
    if (!game) {
      console.error(`Game ${matchId} not found for starting reverse hangman round`);
      return false;
    }

    if (game.type !== 'reverse-hangman') {
      console.error(`Game ${matchId} is not a reverse hangman game`);
      return false;
    }

    console.log(`Starting reverse hangman round for game ${matchId} with difficulty: ${difficulty}`);
    
    // Generate prompt/output pair based on difficulty
    const promptPair = this.generatePromptPair(difficulty);
    
    // Update game state with selected difficulty and prompt pair
    game.state.selectedDifficulty = difficulty;
    game.state.phase = 'playing';
    game.state.currentPromptPair = promptPair;
    game.state.targetPrompt = promptPair.prompt;
    game.state.generatedOutput = promptPair.output;
    game.state.attempts = []; // Reset attempts for new round
    
    // Save state
    await this.saveGameState(matchId, game);
    
    // Publish full state update first
    this.publishUpdate({
      gameId: matchId,
      type: 'state',
      data: { state: game.state },
      timestamp: new Date(),
    });
    
    // Then publish event to notify frontend
    this.publishUpdate({
      gameId: matchId,
      type: 'event',
      data: { 
        event: 'round_started',
        difficulty,
        phase: 'playing',
        output: promptPair.output
      },
      timestamp: new Date(),
    });

    // If game loop isn't running, start it now
    if (!game.loopInterval) {
      this.startGameLoop(game);
    }

    return true;
  }

  private generatePromptPair(difficulty: string): { prompt: string; output: string; category: string } {
    // Sample prompt/output pairs for different difficulties
    const promptPairs = {
      easy: [
        {
          prompt: "What is the capital of France?",
          output: "The capital of France is Paris.",
          category: "geography"
        },
        {
          prompt: "List three primary colors.",
          output: "The three primary colors are:\n1. Red\n2. Blue\n3. Yellow",
          category: "art"
        },
        {
          prompt: "What is 2 plus 2?",
          output: "2 + 2 = 4",
          category: "math"
        }
      ],
      medium: [
        {
          prompt: "Write a haiku about cherry blossoms.",
          output: "Cherry blossoms bloom\nPetals dance on gentle breeze\nSpring's beauty unfolds",
          category: "poetry"
        },
        {
          prompt: "Explain the water cycle in simple terms.",
          output: "The water cycle is the continuous movement of water on Earth. Water evaporates from oceans and lakes into the air, forms clouds through condensation, falls back as precipitation (rain or snow), and flows back to the oceans through rivers and groundwater.",
          category: "science"
        },
        {
          prompt: "Create a simple recipe for chocolate chip cookies.",
          output: "Mix 2 cups flour, 1 cup butter, 3/4 cup sugar, 3/4 cup brown sugar, 2 eggs, 1 tsp vanilla, 1 tsp baking soda, and 2 cups chocolate chips. Drop spoonfuls on a baking sheet and bake at 375°F for 10 minutes until golden brown.",
          category: "cooking"
        }
      ],
      hard: [
        {
          prompt: "Analyze the themes in Shakespeare's Hamlet and their relevance today.",
          output: "Hamlet explores timeless themes that remain deeply relevant: the paralysis of overthinking in decision-making, the corrupting nature of power and revenge, the complexity of familial relationships, and the universal struggle with mortality and purpose. In our modern context, Hamlet's indecision mirrors contemporary anxiety and analysis paralysis, while the play's examination of truth versus appearance resonates in our era of misinformation and social media facades.",
          category: "literature"
        },
        {
          prompt: "Design a sustainable urban transportation system for a city of 500000 people.",
          output: "A comprehensive sustainable transportation system would integrate: 1) An electric light rail network connecting major districts with 15-minute frequencies, 2) Protected bicycle lanes forming a 200km network with bike-sharing stations every 500m, 3) Electric bus rapid transit on dedicated lanes for cross-city routes, 4) Pedestrian-priority zones in commercial centers with car-free streets, 5) Park-and-ride facilities at city edges connected to rail stations, and 6) A unified digital payment system across all modes. This multi-modal approach would reduce car dependency by 60% and cut transport emissions by 70% within 10 years.",
          category: "urban planning"
        }
      ],
      expert: [
        {
          prompt: "Derive the Black-Scholes equation and explain its assumptions and limitations in modern financial markets.",
          output: "The Black-Scholes equation derives from Ito's lemma applied to a geometric Brownian motion model of stock prices. Starting with dS = μSdt + σSdW, we construct a risk-free portfolio combining the option and underlying stock. Through dynamic hedging and no-arbitrage arguments, we arrive at: ∂V/∂t + ½σ²S²∂²V/∂S² + rS∂V/∂S - rV = 0. Key assumptions include: constant volatility and risk-free rate, log-normal price distribution, no transaction costs or taxes, perfect liquidity, and no dividends. Modern limitations include: volatility smile contradicting constant volatility, jump risk during crises, liquidity constraints during stress periods, and behavioral factors affecting rationality. Post-2008 modifications incorporate stochastic volatility, jump diffusion processes, and counterparty risk adjustments.",
          category: "finance"
        }
      ]
    };
    
    const pairs = promptPairs[difficulty as keyof typeof promptPairs] || promptPairs.medium;
    const selected = pairs[Math.floor(Math.random() * pairs.length)];
    
    return {
      prompt: selected.prompt,
      output: selected.output,
      category: selected.category
    };
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
      if (game.frontendReadyTimeout) {
        clearTimeout(game.frontendReadyTimeout);
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
  
  // Load game from Redis if not in memory
  private async loadGameFromRedis(gameId: string): Promise<GameInstance | null> {
    try {
      const redisKey = `game:${gameId}`;
      const gameData = await this.redis.get(redisKey);
      
      if (!gameData) {
        console.log(`No game data found in Redis for ${gameId}`);
        return null;
      }
      
      const parsedData = JSON.parse(gameData);
      console.log(`Restored game ${gameId} from Redis with status: ${parsedData.status}`);
      
      // Reconstruct the game instance
      const game: GameInstance = {
        id: parsedData.id,
        type: parsedData.type,
        state: parsedData.state,
        players: parsedData.players,
        spectators: new Set(parsedData.spectators || []),
        status: parsedData.status,
        lastActivity: new Date(parsedData.lastActivity),
        frontendReady: true, // Set to true since we're rejoining
        aiThinking: new Set(parsedData.aiThinking || []),
        processingTurn: false,
      };
      
      // Add to memory cache
      this.games.set(gameId, game);
      
      // Restart game loop if game is active
      if (game.status === 'active') {
        console.log(`Restarting game loop for active game ${gameId}`);
        this.startGameLoop(game);
      }
      
      return game;
    } catch (error) {
      console.error(`Error loading game ${gameId} from Redis:`, error);
      return null;
    }
  }
  
  // Viewer management methods
  async addViewer(gameId: string, userId: string): Promise<number> {
    let game = this.games.get(gameId);
    
    // If game not in memory, try to load from Redis
    if (!game) {
      console.log(`Game ${gameId} not in memory, attempting to load from Redis...`);
      const loadedGame = await this.loadGameFromRedis(gameId);
      
      if (!loadedGame) {
        throw new Error(`Game ${gameId} not found in memory or Redis`);
      }
      game = loadedGame;
    }
    
    game.spectators.add(userId);
    game.lastActivity = new Date();
    
    // Send current game state immediately to the joining viewer
    const stateData = game.type === 'poker' ? {
      state: {
        ...game.state,
        gameSpecific: {
          bettingRound: game.state.phase,
          communityCards: game.state.communityCards,
          pot: game.state.pot,
          currentBet: game.state.currentBet,
          handComplete: game.state.phase === 'complete' || game.state.phase === 'showdown',
          winners: game.state.winners || [],
          handNumber: game.state.handNumber || 1
        }
      }
    } : { state: game.state };
    
    // Send immediate state update to sync the joining viewer
    this.publishUpdate({
      gameId,
      type: 'state',
      data: stateData,
      timestamp: new Date(),
    });
    
    // Notify other viewers
    this.publishUpdate({
      gameId,
      type: 'event',
      timestamp: new Date(),
      data: JSON.stringify({
        event: 'viewer-joined',
        userId,
        activeViewers: game.spectators.size
      })
    });
    
    fileLoggerService.addLog({
      timestamp: formatTimestamp(),
      level: 'info',
      source: 'backend',
      message: `User ${userId} joined game ${gameId}. Active viewers: ${game.spectators.size}. State synced.`
    });
    
    await this.saveGameState(gameId, game);
    return game.spectators.size;
  }
  
  async removeViewer(gameId: string, userId: string): Promise<number> {
    const game = this.games.get(gameId);
    if (!game) {
      return 0; // Game might have been cleaned up
    }
    
    game.spectators.delete(userId);
    game.lastActivity = new Date();
    
    // Notify other viewers
    this.publishUpdate({
      gameId,
      type: 'event',
      timestamp: new Date(),
      data: JSON.stringify({
        event: 'viewer-left',
        userId,
        activeViewers: game.spectators.size
      })
    });
    
    fileLoggerService.addLog({
      timestamp: formatTimestamp(),
      level: 'info',
      source: 'backend',
      message: `User ${userId} left game ${gameId}. Active viewers: ${game.spectators.size}`
    });
    
    await this.saveGameState(gameId, game);
    return game.spectators.size;
  }
  
  async getUserActiveGames(userId: string): Promise<GameInstance[]> {
    const activeGames = [];
    
    // Check in-memory games
    for (const [_, game] of this.games) {
      if (game.status !== 'completed' && 
          (game.players.includes(userId) || game.spectators.has(userId))) {
        activeGames.push(game);
      }
    }
    
    // Could also check Redis for games not in memory
    // This would require maintaining a user->games index
    
    return activeGames;
  }
}

// Singleton instance - will be initialized with pubsub from index.ts
let gameManagerService: GameManagerService;

export function initializeGameManagerService(pubsub: PubSub) {
  gameManagerService = new GameManagerService(pubsub);
  return gameManagerService;
}

export function getGameManagerService(): GameManagerService {
  if (!gameManagerService) {
    throw new Error('GameManagerService not initialized. Call initializeGameManagerService first.');
  }
  return gameManagerService;
}