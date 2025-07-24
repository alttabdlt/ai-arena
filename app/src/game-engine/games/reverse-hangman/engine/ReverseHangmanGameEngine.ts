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
    
    // Reset current player
    if (this.state.players.length > 0) {
      this.state.currentTurn = this.state.players[0].id;
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
      this.state.phase = 'playing';
      this.state.animationPhase = 'idle';
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