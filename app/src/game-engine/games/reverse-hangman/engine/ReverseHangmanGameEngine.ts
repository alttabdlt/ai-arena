import { BaseGameEngine } from '../../../base/BaseGameEngine';
import { IGamePlayer, IGameValidationResult, IGameError } from '../../../core/interfaces';
import { IGameContext } from '../../../core/context';
import { 
  ReverseHangmanGameState, 
  ReverseHangmanAction, 
  ReverseHangmanPlayer,
  PromptPair,
  GuessAttempt
} from '../ReverseHangmanTypes';
import { PromptMatcher } from './PromptMatcher';
import { getRandomFallbackPrompt, getRandomPrompt } from './PromptDatabase';

export class ReverseHangmanGameEngine extends BaseGameEngine<ReverseHangmanGameState, ReverseHangmanAction> {
  private promptMatcher: PromptMatcher;
  private maxAttempts: number;

  constructor(context: IGameContext, maxAttempts: number = 7) {
    super(context);
    this.promptMatcher = new PromptMatcher();
    this.maxAttempts = maxAttempts;
    
    // Verify imports are available
    if (!getRandomFallbackPrompt && !getRandomPrompt) {
      throw new Error('Prompt generation functions not available - check imports');
    }
  }

  // Override executeAction to prevent turn advancement during a round
  executeAction(action: ReverseHangmanAction): void {
    const validation = this.validateAction(action);
    if (!validation.isValid) {
      this.context.logger.warn('Invalid action', { action, errors: validation.errors });
      // Emit invalid action event
      this.context.eventBus.emit({
        type: 'action:invalid',
        timestamp: new Date(),
        playerId: action.playerId,
        data: { action, errors: validation.errors }
      });
      return;
    }

    const previousState = this.cloneState(this.state);

    try {
      // Record action in history
      this.context.eventBus.emit({
        type: 'action:executed',
        timestamp: new Date(),
        playerId: action.playerId,
        data: { action }
      });

      // Execute the game-specific action based on type
      if (action.type === 'skip') {
        this.handleSkip(action.playerId);
      } else if (action.type === 'timeout') {
        this.handleTimeout(action.playerId);
      } else if (action.type === 'guess' && action.guess) {
        this.handleGuess(action.playerId, action.guess);
      }

      // Emit state change
      this.context.eventBus.emit({
        type: 'state:changed',
        timestamp: new Date(),
        data: {
          previousState,
          currentState: this.state
        }
      });

      // Update turn count
      this.state.turnCount++;

      // Check if game is over
      if (this.isGameOver()) {
        this.handleGameEnd();
      }
      // IMPORTANT: Don't advance turn here - let the round complete first
      // The turn will advance when moving to the next round
    } catch (error) {
      this.state = previousState;
      const gameError: IGameError = Object.assign(
        new Error('Failed to execute action'),
        {
          name: 'ActionExecutionError',
          code: 'ACTION_EXECUTION_FAILED',
          severity: 'high' as const,
          recoverable: false,
          context: { action, error: (error as Error).message }
        }
      );
      
      this.context.logger.error('Action execution failed', gameError);
      this.context.eventBus.emit({
        type: 'error:occurred',
        timestamp: new Date(),
        data: { error: gameError }
      });
      
      throw gameError;
    }
  }

  protected createInitialState(players: IGamePlayer[]): ReverseHangmanGameState {
    const rhPlayers: ReverseHangmanPlayer[] = players.map(player => ({
      ...player,
      guessHistory: [],
      roundsWon: 0,
      totalScore: 0
    }));

    return {
      gameId: this.context.gameId,
      phase: 'waiting',
      startTime: new Date(),
      turnCount: 0,
      players: rhPlayers,
      currentTurn: undefined,
      currentPromptPair: undefined,
      attempts: [],
      maxAttempts: this.maxAttempts,
      roundNumber: 0,
      maxRounds: 5,
      animationPhase: 'idle'
    };
  }

  async startNewRound(difficulty: 'easy' | 'medium' | 'hard' | 'expert' = 'medium', promptPair?: PromptPair): Promise<void> {
    if (!this.state) {
      throw new Error('Game engine not initialized - call initialize() first');
    }
    
    if (this.state.phase !== 'waiting' && this.state.phase !== 'round-complete') {
      throw new Error('Cannot start new round while game is in progress');
    }

    this.state.roundNumber++;
    
    // Use provided prompt pair or get a random one from the static database
    if (!promptPair) {
      // Use defensive check for function availability
      const fallbackFn = getRandomFallbackPrompt || getRandomPrompt;
      if (!fallbackFn) {
        const error = new Error('No prompt generation function available') as IGameError;
        error.code = 'PROMPT_GENERATION_UNAVAILABLE';
        error.severity = 'critical';
        error.recoverable = false;
        error.context = {
          hasGetRandomFallbackPrompt: !!getRandomFallbackPrompt,
          hasGetRandomPrompt: !!getRandomPrompt
        };
        this.context.logger.error('No prompt generation function available', error);
        throw error;
      }
      this.state.currentPromptPair = fallbackFn(difficulty);
      this.context.logger.info('Using static prompt for round', {
        roundNumber: this.state.roundNumber,
        difficulty,
        category: this.state.currentPromptPair.category
      });
    } else {
      this.state.currentPromptPair = promptPair;
    }
    
    this.state.attempts = [];
    this.state.phase = 'selecting';
    this.state.animationPhase = 'selecting';
    
    // Emit animation phase event with output
    this.context.eventBus.emit({
      type: 'animation:phase',
      timestamp: new Date(),
      data: {
        phase: 'selecting',
        output: this.state.currentPromptPair?.output || ''
      }
    });
    
    // Rotate starting player each round for fairness
    if (this.state.players.length > 0) {
      // For multiplayer: start with player at index (roundNumber - 1) % playerCount
      // This ensures each player gets to go first in different rounds
      const startingPlayerIndex = (this.state.roundNumber - 1) % this.state.players.length;
      this.state.currentTurn = this.state.players[startingPlayerIndex].id;
    }

    // Emit round start event
    this.context.eventBus.emit({
      type: 'round:started',
      timestamp: new Date(),
      data: {
        roundNumber: this.state.roundNumber,
        difficulty: this.state.currentPromptPair.difficulty,
        category: this.state.currentPromptPair.category
      }
    });

    // Transition to playing after animation
    setTimeout(() => {
      if (this.state) {
        this.state.phase = 'playing';
        this.state.animationPhase = 'idle';
        
        // Ensure currentTurn is still set
        if (!this.state.currentTurn && this.state.players.length > 0) {
          this.state.currentTurn = this.state.players[0].id;
        }
        
        this.context.logger.info('Transitioned to playing phase', {
          roundNumber: this.state.roundNumber,
          phase: this.state.phase,
          currentTurn: this.state.currentTurn,
          players: this.state.players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI }))
        });
        
        // Emit phase change event
        this.context.eventBus.emit({
          type: 'phase:changed',
          timestamp: new Date(),
          data: {
            phase: 'playing',
            roundNumber: this.state.roundNumber,
            currentTurn: this.state.currentTurn
          }
        });
        
        // Emit animation phase event
        this.context.eventBus.emit({
          type: 'animation:phase',
          timestamp: new Date(),
          data: {
            phase: 'idle'
          }
        });
      }
    }, 2000);
  }

  protected applyAction(action: ReverseHangmanAction): void {
    if (action.type === 'skip') {
      this.handleSkip(action.playerId);
    } else if (action.type === 'timeout') {
      this.handleTimeout(action.playerId);
    } else if (action.type === 'guess' && action.guess) {
      this.handleGuess(action.playerId, action.guess);
    }
  }

  private handleGuess(playerId: string, guess: string): void {
    if (!this.state.currentPromptPair) {
      throw new Error('No prompt pair available');
    }

    const matchResult = this.promptMatcher.match(guess, this.state.currentPromptPair.prompt);
    
    const attempt: GuessAttempt = {
      guess,
      timestamp: new Date(),
      isCorrect: matchResult.type === 'exact',
      matchPercentage: matchResult.percentage,
      matchType: matchResult.type,
      matchDetails: matchResult.details
    };

    this.state.attempts.push(attempt);
    
    const player = this.state.players.find(p => p.id === playerId) as ReverseHangmanPlayer;
    if (player) {
      player.guessHistory.push(attempt);
      player.currentGuess = guess;
    }

    // Emit guess event
    this.context.eventBus.emit({
      type: 'guess:made',
      timestamp: new Date(),
      playerId,
      data: {
        attempt,
        attemptsRemaining: this.maxAttempts - this.state.attempts.length
      }
    });

    if (attempt.isCorrect) {
      this.handleRoundWin(playerId);
    } else if (this.state.attempts.length >= this.maxAttempts) {
      this.handleRoundLoss();
    } else {
      // Game continues - in single player, keep the same player's turn
      // The turn stays with the same player for the entire round
      console.log('Guess made, continuing with same player:', {
        playerId,
        attemptsRemaining: this.maxAttempts - this.state.attempts.length,
        currentTurn: this.state.currentTurn
      });
    }
  }

  private handleSkip(playerId: string): void {
    const attempt: GuessAttempt = {
      guess: '[SKIPPED]',
      timestamp: new Date(),
      isCorrect: false,
      matchPercentage: 0,
      matchType: 'incorrect'
    };

    this.state.attempts.push(attempt);
    
    if (this.state.attempts.length >= this.maxAttempts) {
      this.handleRoundLoss();
    }
  }

  private handleTimeout(playerId: string): void {
    this.handleSkip(playerId);
  }

  private handleRoundWin(winnerId: string): void {
    this.state.phase = 'won';
    this.state.endTime = new Date();
    
    const winner = this.state.players.find(p => p.id === winnerId) as ReverseHangmanPlayer;
    if (winner) {
      winner.roundsWon++;
    }

    this.context.eventBus.emit({
      type: 'round:won',
      timestamp: new Date(),
      playerId: winnerId,
      data: {
        roundNumber: this.state.roundNumber,
        attempts: this.state.attempts.length,
        duration: this.state.endTime.getTime() - this.state.startTime.getTime()
      }
    });

    this.completeRound();
  }

  private handleRoundLoss(): void {
    this.state.phase = 'lost';
    this.state.endTime = new Date();

    this.context.eventBus.emit({
      type: 'round:lost',
      timestamp: new Date(),
      data: {
        roundNumber: this.state.roundNumber,
        correctPrompt: this.state.currentPromptPair?.prompt
      }
    });

    this.completeRound();
  }

  private completeRound(): void {
    this.state.phase = 'round-complete';
    this.state.currentTurn = undefined;
    
    if (this.state.roundNumber >= this.state.maxRounds) {
      this.handleGameEnd();
    }
  }

  protected validateGameSpecificAction(action: ReverseHangmanAction): IGameValidationResult {
    const errors: string[] = [];

    if (this.state.phase !== 'playing') {
      errors.push('Game is not in playing phase');
    }

    if (action.type === 'guess' && !action.guess) {
      errors.push('Guess text is required');
    }

    if (action.type === 'guess' && action.guess && action.guess.length > 500) {
      errors.push('Guess is too long (max 500 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  getValidActions(playerId: string): ReverseHangmanAction[] {
    if (this.state.phase !== 'playing' || this.state.currentTurn !== playerId) {
      return [];
    }

    return [
      { playerId, type: 'guess', timestamp: new Date() },
      { playerId, type: 'skip', timestamp: new Date() }
    ];
  }

  isGameOver(): boolean {
    return this.state.phase === 'round-complete' && 
           this.state.roundNumber >= this.state.maxRounds;
  }

  getWinners(): string[] {
    const playerScores = this.state.players.map(p => ({
      id: p.id,
      score: (p as ReverseHangmanPlayer).totalScore
    }));

    const maxScore = Math.max(...playerScores.map(p => p.score));
    return playerScores
      .filter(p => p.score === maxScore)
      .map(p => p.id);
  }

  protected cloneState(state: ReverseHangmanGameState): ReverseHangmanGameState {
    return {
      ...state,
      players: state.players.map(p => ({
        ...p,
        guessHistory: [...(p as ReverseHangmanPlayer).guessHistory]
      })),
      attempts: state.attempts.map(a => ({ ...a }))
    };
  }

  protected getGameDefinition() {
    return { minPlayers: 1, maxPlayers: 4 };
  }

  getOutput(): string | null {
    return this.state.currentPromptPair?.output || null;
  }

  getRevealedPrompt(): string | null {
    if (this.state.phase === 'won' || this.state.phase === 'lost' || this.state.phase === 'round-complete') {
      return this.state.currentPromptPair?.prompt || null;
    }
    return null;
  }

  getAttemptsRemaining(): number {
    return Math.max(0, this.maxAttempts - this.state.attempts.length);
  }

  getCurrentPromptPair(): PromptPair | null {
    return this.state.currentPromptPair || null;
  }

  setAnimationPhase(phase: ReverseHangmanGameState['animationPhase']): void {
    this.state.animationPhase = phase;
    
    this.context.eventBus.emit({
      type: 'animation:phase',
      timestamp: new Date(),
      data: { phase }
    });
  }
}