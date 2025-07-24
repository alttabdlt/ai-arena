import { IGameEngine, IGameState, IGameAction, IGamePlayer, IGameValidationResult, IGameError } from '../core/interfaces';
import { IGameContext } from '../core/context';

export abstract class BaseGameEngine<TState extends IGameState, TAction extends IGameAction> 
  implements IGameEngine<TState, TAction> {
  
  protected state!: TState;
  protected context: IGameContext;
  protected initialized: boolean = false;

  constructor(context: IGameContext) {
    this.context = context;
  }

  initialize(players: IGamePlayer[]): void {
    if (this.initialized) {
      throw new Error('Game engine already initialized');
    }

    this.validatePlayerCount(players.length);
    this.state = this.createInitialState(players);
    this.initialized = true;

    this.context.logger.info('Game engine initialized', {
      gameId: this.context.gameId,
      playerCount: players.length
    });

    this.context.eventBus.emit({
      type: 'game:initialized',
      timestamp: new Date(),
      data: { players }
    });
  }

  getState(): TState {
    if (!this.initialized) {
      throw new Error('Game engine not initialized');
    }
    return this.cloneState(this.state);
  }

  executeAction(action: TAction): void {
    console.log('ExecuteAction called:', {
      playerId: action.playerId,
      type: action.type,
      currentTurn: this.state.currentTurn,
      timestamp: Date.now()
    });
    
    if (!this.initialized) {
      throw new Error('Game engine not initialized');
    }

    if (this.isGameOver()) {
      throw new Error('Cannot execute action: game is over');
    }

    const validation = this.validateAction(action);
    if (!validation.isValid) {
      console.error('Action validation failed:', {
        errors: validation.errors,
        currentTurn: this.state.currentTurn,
        actionPlayerId: action.playerId
      });
      throw new Error(`Invalid action: ${validation.errors?.join(', ')}`);
    }

    const previousState = this.cloneState(this.state);
    
    try {
      this.applyAction(action);
      this.state.turnCount++;
      
      this.context.eventBus.emit({
        type: 'action:executed',
        timestamp: new Date(),
        playerId: action.playerId,
        data: { action, previousState, newState: this.state }
      });

      if (this.isGameOver()) {
        this.handleGameEnd();
      } else {
        console.log('Advancing turn from', this.state.currentTurn);
        this.advanceTurn();
        console.log('Turn advanced to', this.state.currentTurn);
      }
    } catch (error) {
      this.state = previousState;
      const gameError: IGameError = Object.assign(
        new Error('Failed to execute action'),
        {
          name: 'ActionExecutionError',
          code: 'ACTION_EXECUTION_FAILED',
          severity: 'high' as const,
          recoverable: true,
          context: { action, error }
        }
      );
      this.context.logger.error('Failed to execute action', gameError);
      throw error;
    }
  }

  validateAction(action: TAction): IGameValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!action.playerId) {
      errors.push('Player ID is required');
    }

    if (!action.type) {
      errors.push('Action type is required');
    }

    const player = this.state.players.find(p => p.id === action.playerId);
    if (!player) {
      errors.push('Player not found');
    } else if (!player.isActive) {
      errors.push('Player is not active');
    }

    if (this.state.currentTurn && this.state.currentTurn !== action.playerId) {
      errors.push('Not player\'s turn');
    }

    const gameSpecificValidation = this.validateGameSpecificAction(action);
    errors.push(...(gameSpecificValidation.errors || []));
    warnings.push(...(gameSpecificValidation.warnings || []));

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  protected handleGameEnd(): void {
    this.state.endTime = new Date();
    const winners = this.getWinners();
    
    this.context.eventBus.emit({
      type: 'game:ended',
      timestamp: new Date(),
      data: {
        winners,
        finalState: this.state,
        duration: this.state.endTime.getTime() - this.state.startTime.getTime()
      }
    });
  }

  protected advanceTurn(): void {
    if (this.state.currentTurn) {
      const currentPlayerIndex = this.state.players.findIndex(p => p.id === this.state.currentTurn);
      let nextPlayerIndex = (currentPlayerIndex + 1) % this.state.players.length;
      
      while (!this.state.players[nextPlayerIndex].isActive) {
        nextPlayerIndex = (nextPlayerIndex + 1) % this.state.players.length;
        if (nextPlayerIndex === currentPlayerIndex) {
          break;
        }
      }
      
      this.state.currentTurn = this.state.players[nextPlayerIndex].id;
      
      this.context.eventBus.emit({
        type: 'turn:changed',
        timestamp: new Date(),
        playerId: this.state.currentTurn,
        data: { turnCount: this.state.turnCount }
      });
    }
  }

  protected validatePlayerCount(count: number): void {
    const game = this.getGameDefinition();
    if (count < game.minPlayers || count > game.maxPlayers) {
      throw new Error(
        `Invalid player count: ${count}. Game requires ${game.minPlayers}-${game.maxPlayers} players`
      );
    }
  }

  protected abstract createInitialState(players: IGamePlayer[]): TState;
  protected abstract applyAction(action: TAction): void;
  protected abstract validateGameSpecificAction(action: TAction): IGameValidationResult;
  protected abstract cloneState(state: TState): TState;
  protected abstract getGameDefinition(): { minPlayers: number; maxPlayers: number };
  
  abstract getValidActions(playerId: string): TAction[];
  abstract isGameOver(): boolean;
  abstract getWinners(): string[];
}