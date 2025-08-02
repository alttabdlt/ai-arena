import { BaseGameManager } from '../../base/BaseGameManager';
import { PokerGameState, PokerGameConfig, PokerAction, PokerPlayer } from './PokerTypes';
import { IGameEngine, IGameAction, IGamePlayer, IGameAIAgent, IGameScoringSystem, IGameEvent } from '../../core/interfaces';
import { IGameContext } from '../../core/context';
import { PokerGameEngine } from './engine/PokerGameEngine';
import { PokerAIAgentFactory } from './ai/PokerAIAgentFactory';
import { PokerScoringSystem } from './scoring/PokerScoringSystem';

export interface PokerGameEvent {
  type: 'hand-started' | 'hand-completed' | 'phase-changed' | 'thinking' | 
        'decision-made' | 'style-bonus' | 'hand-misread' | 'achievement' | 'game-finished';
  handNumber?: number;
  phase?: string;
  playerId?: string;
  playerName?: string;
  decision?: any;
  styleBonuses?: any[];
  misread?: any;
  achievement?: any;
  timestamp: number;
}

export interface DecisionHistoryEntry {
  handNumber: number;
  playerId: string;
  playerName: string;
  playerCards: string[];
  decision: any;
  gamePhase: string;
  communityCards: string[];
  timestamp: number;
}

export class PokerGameManager extends BaseGameManager<PokerGameState, PokerGameConfig> {
  private pokerEngine: PokerGameEngine;
  private aiAgentFactory: PokerAIAgentFactory;
  private currentHandNumber: number = 0;
  private decisionHistory: DecisionHistoryEntry[] = [];
  private currentHandActionHistory: any[] = [];
  private handParticipants: Set<string> = new Set();
  private lastAggressivePlayer: string | null = null;
  private playerChipHistory: Map<string, number[]> = new Map();
  private isStartingNewHand: boolean = false;

  constructor(
    engine: PokerGameEngine,
    config: PokerGameConfig,
    context: IGameContext,
    scoringSystem: PokerScoringSystem,
    aiAgentFactory: PokerAIAgentFactory
  ) {
    super(engine, config, context, scoringSystem);
    this.pokerEngine = engine;
    this.aiAgentFactory = aiAgentFactory;
    this.setupEventHandlers();
  }

  async startGame(): Promise<void> {
    // Override base startGame to prevent duplicate game loop
    if (this.managerState !== 'setup') {
      throw new Error('Game already started');
    }

    try {
      const players = await this.initializePlayers();
      this.engine.initialize(players);
      
      for (const playerConfig of this.config.playerConfigs) {
        if (playerConfig.aiModel) {
          const aiAgent = await this.createAIAgent(playerConfig);
          this.aiAgents.set(playerConfig.id, aiAgent);
        }
      }

      this.managerState = 'playing';
      
      this.emit('game:started', {
        config: this.config,
        players,
        state: this.engine.getState()
      });
      
      // DO NOT start game loop here - poker manages its own loop through startNewHand
    } catch (error) {
      this.context.logger.error('Failed to start game', error);
      throw error;
    }
  }

  async startNewHand(): Promise<void> {
    // Prevent concurrent startNewHand calls
    if (this.isStartingNewHand) {
      console.log('Already starting new hand, skipping duplicate call');
      return;
    }
    
    if (this.config.maxHands && this.currentHandNumber >= this.config.maxHands) {
      await this.endGame();
      return;
    }

    this.isStartingNewHand = true;
    
    try {
      const previousHandNumber = this.currentHandNumber;
      this.currentHandNumber++;
      
      // Log warning if hand numbers are not sequential
      if (previousHandNumber > 0 && this.currentHandNumber !== previousHandNumber + 1) {
        console.warn('Hand number skip detected!', {
          previousHand: previousHandNumber,
          currentHand: this.currentHandNumber,
          expected: previousHandNumber + 1
        });
      }
      
      console.log('Starting hand', this.currentHandNumber, 'at', Date.now());
      
      this.currentHandActionHistory = [];
      this.handParticipants.clear();
      this.lastAggressivePlayer = null;

      const startingChips = this.currentHandNumber === 1 ? this.config.startingChips : undefined;
      this.pokerEngine.startNewHand(startingChips);

      const state = this.pokerEngine.getState();
      state.players.forEach(player => {
        if (!player.folded) {
          this.handParticipants.add(player.id);
        }
      });

      this.emit('hand-started', {
        type: 'hand-started',
        handNumber: this.currentHandNumber,
        phase: state.phase,
        timestamp: Date.now()
      });

      console.log('Starting poker game loop for hand', this.currentHandNumber, 'at', Date.now());
      await this.runGameLoop();
    } finally {
      this.isStartingNewHand = false;
    }
  }

  protected async initializePlayers(): Promise<IGamePlayer[]> {
    const players: PokerPlayer[] = this.config.playerConfigs.map((config, index) => ({
      id: config.id,
      name: config.name,
      avatar: config.avatar,
      isAI: true,
      isActive: true,
      chips: this.config.startingChips,
      cards: [],
      bet: 0,
      folded: false,
      allIn: false,
      position: index,
      hasActed: false,
      seatPosition: index
    }));

    players.forEach(player => {
      this.playerChipHistory.set(player.id, [player.chips]);
    });

    return players;
  }

  protected async createAIAgent(config: any): Promise<IGameAIAgent<PokerGameState, PokerAction>> {
    return this.aiAgentFactory.createAgent(config);
  }

  protected async processGameTick(): Promise<void> {
    const state = this.pokerEngine.getState();
    console.log('ProcessGameTick called:', {
      phase: state.phase,
      isHandComplete: state.isHandComplete,
      currentTurn: state.currentTurn,
      handNumber: this.currentHandNumber
    });
    
    // Handle showdown phase
    if (state.phase === 'showdown' && state.isHandComplete) {
      console.log('Hand complete in showdown, handling...', {
        handNumber: this.currentHandNumber,
        timestamp: Date.now()
      });
      
      // Let the UI show the results for a moment
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if we should continue or end the game
      const activePlayers = state.players.filter(p => p.chips > 0);
      if (activePlayers.length > 1 && (!this.config.maxHands || this.currentHandNumber < this.config.maxHands)) {
        console.log('Preparing to start new hand after showdown', {
          currentHand: this.currentHandNumber,
          nextHand: this.currentHandNumber + 1,
          timestamp: Date.now()
        });
        // Stop the current loop - startNewHand will start its own
        this.gameLoopRunning = false;
        
        setTimeout(() => {
          console.log('Calling startNewHand from processGameTick', {
            currentHand: this.currentHandNumber,
            timestamp: Date.now()
          });
          this.startNewHand().catch(error => {
            this.context.logger.error('Error starting new hand', error);
          });
        }, 1000);
      } else {
        console.log('Ending game after showdown');
        await this.endGame();
      }
    } else {
      // Default behavior - just wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  protected getFallbackAction(playerId: string): PokerAction | null {
    const validActions = this.pokerEngine.getValidActions(playerId);
    if (validActions.length === 0) return null;

    const checkAction = validActions.find(a => a.type === 'check');
    if (checkAction) return checkAction;

    const callAction = validActions.find(a => a.type === 'call');
    if (callAction) return callAction;

    return validActions[0];
  }

  protected async cleanup(): Promise<void> {
    this.decisionHistory = [];
    this.currentHandActionHistory = [];
    this.handParticipants.clear();
    this.playerChipHistory.clear();
  }

  protected async handleAITurn(playerId: string): Promise<void> {
    this.emit('thinking', {
      type: 'thinking',
      playerId,
      timestamp: Date.now()
    });

    const speedDelay = this.getSpeedDelay();
    await new Promise(resolve => setTimeout(resolve, speedDelay));

    await super.handleAITurn(playerId);
  }

  private getSpeedDelay(): number {
    switch (this.config.speed) {
      case 'thinking': return 2000;
      case 'normal': return 1000;
      case 'fast': return 500; // Increased from 200ms for better UX
      default: return 1000;
    }
  }

  protected setupInternalEventHandlers(): void {
    super.setupInternalEventHandlers();
    
    // Bridge hand:completed event from eventBus to local event system
    this.context.eventBus.on('hand:completed', (event: IGameEvent) => {
      console.log('Hand completed event received from engine');
      this.emit('hand:completed', event.data);
    });
  }
  
  private setupEventHandlers(): void {
    this.on('ai:decision', (data: any) => {
      this.handleAIDecision(data);
    });

    this.on('hand:completed', (data: any) => {
      this.handleHandComplete(data);
    });

    this.on('action:executed', (data: any) => {
      this.recordAction(data);
    });

    this.on('phase:changed', (data: any) => {
      this.emit('phase-changed', {
        type: 'phase-changed',
        phase: data.phase,
        timestamp: Date.now()
      });
    });

    // Handle AI turn failures by forcing a fold
    this.on('ai:turn:failed', (data: any) => {
      this.context.logger.warn('AI turn failed completely, handling failure', data);
      
      const state = this.pokerEngine.getState();
      const player = state.players.find(p => p.id === data.playerId);
      
      // Only try to fold if it's actually this player's turn and they haven't folded
      if (state.currentTurn === data.playerId && player && !player.folded) {
        const fallbackFold: PokerAction = {
          playerId: data.playerId,
          type: 'fold',
          timestamp: new Date()
        };
        
        try {
          this.pokerEngine.executeAction(fallbackFold);
          
          this.emit('ai:forced:fold', {
            playerId: data.playerId,
            reason: 'ai_failure',
            timestamp: Date.now()
          });
        } catch (foldError) {
          this.context.logger.warn('Failed to force fold, advancing turn anyway', {
            playerId: data.playerId,
            error: foldError
          });
          
          // Last resort: manually advance the turn
          try {
            (this.pokerEngine as any).moveToNextPlayer();
          } catch (advanceError) {
            this.context.logger.error('Failed to advance turn', advanceError);
          }
        }
      } else {
        // Player already folded or it's not their turn, just log and continue
        this.context.logger.warn('Cannot force fold - not player turn or already folded', {
          playerId: data.playerId,
          currentTurn: state.currentTurn,
          playerFolded: player?.folded
        });
      }
    });
  }

  private handleAIDecision(data: any): void {
    const state = this.pokerEngine.getState();
    const player = state.players.find(p => p.id === data.playerId);
    if (!player) return;

    // Capture cards BEFORE the action is executed (important for fold actions)
    const playerCards = [...player.cards];
    
    const entry: DecisionHistoryEntry = {
      handNumber: this.currentHandNumber,
      playerId: data.playerId,
      playerName: player.name,
      playerCards: playerCards,  // Use the captured cards
      decision: data.decision,
      gamePhase: state.phase,
      communityCards: [...state.communityCards],
      timestamp: Date.now()
    };

    this.decisionHistory.push(entry);

    this.emit('decision-made', {
      type: 'decision-made',
      playerId: data.playerId,
      playerName: player.name,
      decision: data.decision,
      timestamp: Date.now()
    });

    const isAggressive = ['bet', 'raise', 'all-in'].includes(data.decision.action.type);
    if (isAggressive) {
      this.lastAggressivePlayer = data.playerId;
    }
  }

  private handleHandComplete(data: any): void {
    const state = this.pokerEngine.getState();
    
    state.players.forEach(player => {
      const history = this.playerChipHistory.get(player.id) || [];
      history.push(player.chips);
      this.playerChipHistory.set(player.id, history);
    });

    this.emit('hand-completed', {
      type: 'hand-completed',
      handNumber: this.currentHandNumber,
      winners: data.winners,
      timestamp: Date.now()
    });

    // Note: startNewHand is handled by processGameTick, not here
    // This prevents duplicate hand starts
  }

  private recordAction(data: any): void {
    const action = data.action;
    const state = this.pokerEngine.getState();
    
    this.currentHandActionHistory.push({
      player: action.playerId,
      action: action.type,
      amount: action.amount,
      round: state.phase
    });
  }

  getDecisionHistory(): DecisionHistoryEntry[] {
    return [...this.decisionHistory];
  }

  getCurrentHandNumber(): number {
    return this.currentHandNumber;
  }

  getPlayerStats(playerId: string): {
    handsPlayed: number;
    handsWon: number;
    chipHistory: number[];
    averageChips: number;
  } {
    const chipHistory = this.playerChipHistory.get(playerId) || [];
    const handsPlayed = chipHistory.length - 1;
    const handsWon = this.decisionHistory.filter(
      entry => entry.playerId === playerId && entry.decision.action.type === 'win'
    ).length;

    return {
      handsPlayed,
      handsWon,
      chipHistory,
      averageChips: chipHistory.reduce((a, b) => a + b, 0) / (chipHistory.length || 1)
    };
  }
}