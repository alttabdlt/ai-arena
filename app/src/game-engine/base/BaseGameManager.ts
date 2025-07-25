import { 
  IGameManager, 
  IGameState, 
  IGameConfig, 
  IGameEngine, 
  IGameAction,
  IGameAIAgent,
  IGameScoringSystem,
  IGameEvent,
  IGamePlayer,
  IPlayerConfig,
  IGameError
} from '../core/interfaces';
import { IGameContext, IGameEventBus } from '../core/context';

export type GameManagerState = 'setup' | 'playing' | 'paused' | 'finished';

export abstract class BaseGameManager<TState extends IGameState, TConfig extends IGameConfig> 
  implements IGameManager<TState, TConfig> {
  
  protected engine: IGameEngine<TState, IGameAction>;
  protected config: TConfig;
  protected context: IGameContext;
  protected aiAgents: Map<string, IGameAIAgent<TState, IGameAction>> = new Map();
  protected scoringSystem: IGameScoringSystem<TState>;
  protected managerState: GameManagerState = 'setup';
  protected eventHandlers: Map<string, Set<(data: any) => void>> = new Map();
  protected thinkingTimer?: NodeJS.Timeout;
  protected aiRetryCount: Map<string, number> = new Map();
  protected readonly MAX_AI_RETRIES = 3;
  protected gameLoopRunning: boolean = false;
  protected processGameTickCount: number = 0;
  protected lastProcessGameTickPhase: string = '';
  protected isProcessingGameTick: boolean = false;

  constructor(
    engine: IGameEngine<TState, IGameAction>,
    config: TConfig,
    context: IGameContext,
    scoringSystem: IGameScoringSystem<TState>
  ) {
    this.engine = engine;
    this.config = config;
    this.context = context;
    this.scoringSystem = scoringSystem;
    
    this.setupInternalEventHandlers();
  }

  async startGame(): Promise<void> {
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

      await this.runGameLoop();
    } catch (error) {
      const gameError: IGameError = Object.assign(
        new Error('Failed to start game'),
        {
          name: 'GameStartError',
          code: 'GAME_START_FAILED',
          severity: 'critical' as const,
          recoverable: false,
          context: error
        }
      );
      this.context.logger.error('Failed to start game', gameError);
      throw error;
    }
  }

  pauseGame(): void {
    if (this.managerState !== 'playing') {
      throw new Error('Game is not playing');
    }

    this.managerState = 'paused';
    if (this.thinkingTimer) {
      clearTimeout(this.thinkingTimer);
    }

    this.emit('game:paused', {
      state: this.engine.getState()
    });
  }

  resumeGame(): void {
    if (this.managerState !== 'paused') {
      throw new Error('Game is not paused');
    }

    this.managerState = 'playing';
    
    this.emit('game:resumed', {
      state: this.engine.getState()
    });

    this.runGameLoop().catch(error => {
      this.context.logger.error('Error resuming game', error);
    });
  }

  async endGame(): Promise<void> {
    if (this.managerState === 'finished') {
      return;
    }

    this.managerState = 'finished';
    this.gameLoopRunning = false;
    
    if (this.thinkingTimer) {
      clearTimeout(this.thinkingTimer);
    }

    // Clear retry counts
    this.aiRetryCount.clear();

    const finalState = this.engine.getState();
    const finalScores = this.scoringSystem.getLeaderboard();

    this.emit('game:ended', {
      state: finalState,
      scores: finalScores,
      winners: this.engine.getWinners()
    });

    await this.cleanup();
  }

  getState(): TState {
    return this.engine.getState();
  }

  getConfig(): TConfig {
    return { ...this.config };
  }

  on(event: string, handler: (data: any) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: (data: any) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  protected emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.context.logger.error(`Error in event handler for ${event}`, error);
        }
      });
    }
  }

  protected async runGameLoop(): Promise<void> {
    if (this.gameLoopRunning) {
      console.warn('Game loop already running, skipping duplicate call', {
        managerState: this.managerState,
        gameOver: this.engine.isGameOver(),
        timestamp: Date.now()
      });
      return;
    }
    
    this.gameLoopRunning = true;
    console.log('Game loop started', {
      managerState: this.managerState,
      timestamp: Date.now()
    });
    
    const processNextTurn = async () => {
      if (this.managerState !== 'playing' || this.engine.isGameOver()) {
        if (this.engine.isGameOver() && this.managerState === 'playing') {
          await this.endGame();
        }
        this.gameLoopRunning = false;
        console.log('Game loop ended', {
          managerState: this.managerState,
          gameOver: this.engine.isGameOver(),
          timestamp: Date.now()
        });
        return;
      }

      const state = this.engine.getState();
      
      console.log('=== Game Loop Iteration ===', {
        currentTurn: state.currentTurn,
        phase: (state as any).phase,
        turnCount: state.turnCount,
        timestamp: Date.now()
      });
      
      if (state.currentTurn) {
        const currentPlayer = state.players.find(p => p.id === state.currentTurn);
        
        // Safety check: ensure the current player exists and is active
        if (!currentPlayer || !currentPlayer.isActive) {
          this.context.logger.warn('Invalid current turn - player not found or inactive', {
            currentTurn: state.currentTurn,
            playerFound: !!currentPlayer,
            isActive: currentPlayer?.isActive
          });
          // Force advance to next phase/player
          await this.processGameTick();
          return;
        }
        
        // Additional safety check for poker: don't give turns to folded players
        if ('folded' in currentPlayer && (currentPlayer as any).folded) {
          this.context.logger.warn('Current turn assigned to folded player, advancing', {
            playerId: state.currentTurn
          });
          // Force advance to next phase/player
          await this.processGameTick();
          return;
        }
        
        if (currentPlayer.isAI) {
          const retryCount = this.aiRetryCount.get(state.currentTurn) || 0;
          
          // Check if we've exceeded max retries before attempting
          if (retryCount >= this.MAX_AI_RETRIES) {
            this.context.logger.warn('Skipping AI turn due to max retries', {
              playerId: state.currentTurn,
              retryCount
            });
            // Reset retry count
            this.aiRetryCount.set(state.currentTurn, 0);
            // Force advance turn by calling processGameTick
            await this.processGameTick();
          } else {
            await this.handleAITurn(state.currentTurn);
          }
        } else {
          await this.handleHumanTurn(state.currentTurn);
        }
      } else {
        // Prevent concurrent processGameTick calls
        if (this.isProcessingGameTick) {
          console.log('Already processing game tick, skipping duplicate call');
          // Continue the game loop
          setTimeout(() => {
            processNextTurn().catch(error => {
              this.context.logger.error('Error in game loop', error);
            });
          }, 100);
          return;
        }

        // Safety check for infinite loops
        const currentPhase = (state as any).phase || 'unknown';
        if (currentPhase === this.lastProcessGameTickPhase) {
          this.processGameTickCount++;
          if (this.processGameTickCount > 10) {
            console.error('Detected potential infinite loop in processGameTick', {
              phase: currentPhase,
              count: this.processGameTickCount
            });
            this.gameLoopRunning = false;
            return;
          }
        } else {
          this.processGameTickCount = 0;
          this.lastProcessGameTickPhase = currentPhase;
        }
        
        this.isProcessingGameTick = true;
        try {
          await this.processGameTick();
        } finally {
          this.isProcessingGameTick = false;
        }
      }

      // Check if game was paused during AI/human turn handling
      if (this.managerState === 'playing' && this.gameLoopRunning) {
        // Yield control back to the browser to prevent UI blocking
        setTimeout(() => {
          // Double-check that the game loop is still running before continuing
          if (this.gameLoopRunning) {
            processNextTurn().catch(error => {
              this.context.logger.error('Error in game loop', error);
              // Stop the game loop on error to prevent infinite loops
              this.gameLoopRunning = false;
            });
          }
        }, 0);
      } else {
        // Game loop has been stopped
        this.gameLoopRunning = false;
        console.log('Game loop stopped');
      }
    };

    await processNextTurn();
  }

  protected async handleAITurn(playerId: string): Promise<void> {
    console.log('handleAITurn called for:', {
      playerId,
      aiAgentsSize: this.aiAgents.size,
      aiAgentKeys: Array.from(this.aiAgents.keys()),
      hasAgent: this.aiAgents.has(playerId)
    });
    
    const aiAgent = this.aiAgents.get(playerId);
    if (!aiAgent) {
      throw new Error(`AI agent not found for player ${playerId}`);
    }

    this.emit('ai:thinking:start', { playerId });

    const thinkingStartTime = Date.now();
    
    try {
      const state = this.engine.getState();
      const validActions = this.engine.getValidActions(playerId);
      
      console.log('Setting AI thinking timeout:', {
        thinkingTime: this.config.thinkingTime,
        speed: (this.config as any).speed,
        configKeys: Object.keys(this.config)
      });
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        this.thinkingTimer = setTimeout(() => {
          console.error('AI thinking timeout reached after', this.config.thinkingTime, 'ms');
          reject(new Error('AI thinking timeout'));
        }, this.config.thinkingTime);
      });

      const decision = await Promise.race([
        aiAgent.makeDecision(state, validActions),
        timeoutPromise
      ]);

      if (this.thinkingTimer) {
        clearTimeout(this.thinkingTimer);
      }

      const thinkingTime = Date.now() - thinkingStartTime;

      this.emit('ai:thinking:end', {
        playerId,
        decision,
        thinkingTime
      });

      // Emit AI decision BEFORE executing action to capture state before changes
      this.emit('ai:decision', {
        playerId,
        decision,
        state: this.engine.getState()
      });

      this.engine.executeAction(decision.action);

      console.log('AI made decision, executing action:', {
        playerId,
        action: decision.action,
        currentTurn: this.engine.getState().currentTurn,
        timestamp: Date.now()
      });

    } catch (error: any) {
      // Log comprehensive error details
      console.error('AI turn failed - Full error details:', {
        error,
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        playerId,
        networkError: error?.networkError,
        graphQLErrors: error?.graphQLErrors,
        fullErrorString: JSON.stringify(error, null, 2)
      });
      
      const gameError: IGameError = Object.assign(
        new Error('AI turn failed'),
        {
          name: 'AITurnError',
          code: 'AI_TURN_FAILED',
          severity: 'high' as const,
          recoverable: true,
          context: { playerId, error }
        }
      );
      this.context.logger.error('AI turn failed', gameError);

      // Track retry count
      const retryCount = (this.aiRetryCount.get(playerId) || 0) + 1;
      this.aiRetryCount.set(playerId, retryCount);

      if (retryCount < this.MAX_AI_RETRIES) {
        // Retry the AI turn
        this.context.logger.warn(`Retrying AI turn for ${playerId}, attempt ${retryCount}/${this.MAX_AI_RETRIES}`);
        return; // Let the game loop retry
      }

      // Max retries reached, try fallback
      this.context.logger.warn(`Max AI retries reached for ${playerId}, using fallback action`);
      
      const fallbackAction = this.getFallbackAction(playerId);
      if (fallbackAction) {
        try {
          this.engine.executeAction(fallbackAction);
          // Reset retry count on successful fallback
          this.aiRetryCount.set(playerId, 0);
          
          this.emit('ai:fallback', {
            playerId,
            action: fallbackAction,
            reason: 'max_retries_exceeded'
          });
        } catch (fallbackError) {
          this.context.logger.warn('Fallback action also failed', {
            playerId,
            fallbackError,
            originalError: error
          });
          
          // Force the game to continue by emitting a special event
          this.emit('ai:turn:failed', {
            playerId,
            error: gameError,
            fallbackError
          });
        }
      } else {
        // No fallback available, force game continuation
        this.context.logger.warn('No fallback action available', { playerId });
        this.emit('ai:turn:failed', {
          playerId,
          error: gameError,
          noFallback: true
        });
      }

      // Always reset retry count after handling
      this.aiRetryCount.set(playerId, 0);
    }
  }

  protected async handleHumanTurn(playerId: string): Promise<void> {
    this.emit('human:turn:start', { playerId });
    
    return new Promise((resolve) => {
      const turnHandler = (data: { action: IGameAction }) => {
        if (data.action.playerId === playerId) {
          this.off('human:action', turnHandler);
          
          try {
            this.engine.executeAction(data.action);
            this.emit('human:turn:end', { playerId, action: data.action });
            resolve();
          } catch (error) {
            this.emit('human:action:invalid', { playerId, error });
          }
        }
      };
      
      this.on('human:action', turnHandler);
    });
  }

  protected setupInternalEventHandlers(): void {
    this.context.eventBus.on('action:executed', (event: IGameEvent) => {
      this.scoringSystem.trackEvent(event);
      this.emit('action:executed', event.data);
    });

    this.context.eventBus.on('game:ended', (event: IGameEvent) => {
      const scores = this.scoringSystem.calculateScore(this.engine.getState());
      this.emit('scores:calculated', scores);
    });
  }

  protected abstract initializePlayers(): Promise<IGamePlayer[]>;
  protected abstract createAIAgent(config: IPlayerConfig): Promise<IGameAIAgent<TState, IGameAction>>;
  protected abstract processGameTick(): Promise<void>;
  protected abstract getFallbackAction(playerId: string): IGameAction | null;
  protected abstract cleanup(): Promise<void>;
}