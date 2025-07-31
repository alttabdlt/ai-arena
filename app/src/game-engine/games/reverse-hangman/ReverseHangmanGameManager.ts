import { BaseGameManager } from '../../base/BaseGameManager';
import { 
  ReverseHangmanGameState, 
  ReverseHangmanGameConfig, 
  ReverseHangmanAction, 
  ReverseHangmanPlayer,
  GuessAttempt
} from './ReverseHangmanTypes';
import { IGamePlayer, IGameAIAgent, IGameScoringSystem } from '../../core/interfaces';
import { IGameContext } from '../../core/context';
import { ReverseHangmanGameEngine } from './engine/ReverseHangmanGameEngine';
import { IPlayerConfig } from '../../core/interfaces';

export interface ReverseHangmanEvent {
  type: 'round-started' | 'round-complete' | 'guess-made' | 'animation-phase' | 
        'thinking' | 'decision-made' | 'game-complete';
  roundNumber?: number;
  phase?: string;
  playerId?: string;
  playerName?: string;
  guess?: string;
  matchResult?: any;
  animationPhase?: string;
  output?: string;
  timestamp: number;
}

export interface GuessHistoryEntry {
  roundNumber: number;
  playerId: string;
  playerName: string;
  guess: string;
  matchResult: any;
  attemptsRemaining: number;
  timestamp: number;
}

export class ReverseHangmanGameManager extends BaseGameManager<ReverseHangmanGameState, ReverseHangmanGameConfig> {
  private rhEngine: ReverseHangmanGameEngine;
  private currentRoundNumber: number = 0;
  private guessHistory: GuessHistoryEntry[] = [];
  private aiAgentFactory: any; // Will be injected

  constructor(
    engine: ReverseHangmanGameEngine,
    config: ReverseHangmanGameConfig,
    context: IGameContext,
    scoringSystem: IGameScoringSystem<ReverseHangmanGameState>,
    aiAgentFactory?: any
  ) {
    super(engine, config, context, scoringSystem);
    this.rhEngine = engine;
    this.aiAgentFactory = aiAgentFactory;
    this.setupGameEventHandlers();
  }

  async startNewRound(difficulty?: 'easy' | 'medium' | 'hard' | 'expert' | 'mixed'): Promise<void> {
    if (this.config.maxRounds && this.currentRoundNumber >= this.config.maxRounds) {
      await this.endGame();
      return;
    }

    this.currentRoundNumber++;
    // Use provided difficulty or default from config
    let roundDifficulty: 'easy' | 'medium' | 'hard' | 'expert' = 'medium';
    
    if (difficulty && difficulty !== 'mixed') {
      roundDifficulty = difficulty;
    } else if (this.config.difficulty === 'mixed') {
      // For mixed difficulty, randomly select a difficulty for each round
      const difficulties: ('easy' | 'medium' | 'hard' | 'expert')[] = ['easy', 'medium', 'hard', 'expert'];
      roundDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
    } else if (this.config.difficulty) {
      // If we reach here, difficulty is one of the non-mixed values
      roundDifficulty = this.config.difficulty as 'easy' | 'medium' | 'hard' | 'expert';
    }
    
    console.log('Starting new round:', {
      roundNumber: this.currentRoundNumber,
      difficulty: roundDifficulty,
      aiAgentCount: this.aiAgents.size
    });
    
    await this.rhEngine.startNewRound(roundDifficulty);

    const state = this.rhEngine.getState();
    
    console.log('Round started, current state:', {
      phase: state.phase,
      currentTurn: state.currentTurn,
      players: state.players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI }))
    });
    
    this.emit('round-started', {
      type: 'round-started',
      roundNumber: this.currentRoundNumber,
      phase: state.phase,
      timestamp: Date.now()
    });

    // Wait for animation phase
    await this.waitForAnimationPhase();
    
    console.log('Animation phase complete, starting game loop');
    
    // Ensure we're still in the playing state before starting the loop
    if (this.managerState === 'playing') {
      // Start the game loop which will handle AI turns
      await this.runGameLoop();
    }
  }

  protected async initializePlayers(): Promise<IGamePlayer[]> {
    const players: ReverseHangmanPlayer[] = this.config.playerConfigs.map((config, index) => ({
      id: config.id,
      name: config.name,
      avatar: config.avatar,
      isAI: config.aiModel !== undefined,
      isActive: true,
      guessHistory: [],
      roundsWon: 0,
      totalScore: 0
    }));

    return players;
  }

  protected async createAIAgent(config: IPlayerConfig): Promise<IGameAIAgent<ReverseHangmanGameState, ReverseHangmanAction>> {
    if (!this.aiAgentFactory) {
      throw new Error('AI agent factory not provided');
    }
    return this.aiAgentFactory.createAgent(config);
  }

  protected async processGameTick(): Promise<void> {
    const state = this.rhEngine.getState();
    
    console.log('ReverseHangman processGameTick:', {
      phase: state.phase,
      roundNumber: state.roundNumber,
      currentTurn: state.currentTurn
    });
    
    // Check if round is complete
    if (state.phase === 'round-complete') {
      // Stop the current game loop before starting a new round
      this.gameLoopRunning = false;
      
      this.emit('round-complete', {
        type: 'round-complete',
        roundNumber: state.roundNumber,
        timestamp: Date.now()
      });

      // Delay before starting next round
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Start next round if not at max
      if (state.roundNumber < state.maxRounds) {
        await this.startNewRound();
      } else {
        await this.endGame();
      }
    }
  }

  protected getFallbackAction(playerId: string): ReverseHangmanAction | null {
    // Default fallback is to skip
    return {
      playerId,
      type: 'skip',
      timestamp: new Date()
    };
  }

  protected async cleanup(): Promise<void> {
    this.guessHistory = [];
  }

  protected async handleAITurn(playerId: string): Promise<void> {
    const state = this.rhEngine.getState();
    const player = state.players.find(p => p.id === playerId);
    
    if (!player) return;

    this.emit('thinking', {
      type: 'thinking',
      playerId,
      playerName: player.name,
      timestamp: Date.now()
    });

    // Add thinking delay based on speed
    const speedDelay = this.getSpeedDelay();
    await new Promise(resolve => setTimeout(resolve, speedDelay));

    await super.handleAITurn(playerId);
  }

  private getSpeedDelay(): number {
    switch (this.config.speed) {
      case 'slow': return 5000;
      case 'normal': return 2000;
      case 'fast': return 500;
      default: return 2000;
    }
  }

  private async waitForAnimationPhase(): Promise<void> {
    const animationDuration = this.config.animationDuration || 2000;
    await new Promise(resolve => setTimeout(resolve, animationDuration));
  }

  private setupGameEventHandlers(): void {
    // Listen to engine events
    this.context.eventBus.on('guess:made', (event) => {
      this.handleGuessMade(event.playerId!, event.data);
    });

    this.context.eventBus.on('animation:phase', (event) => {
      this.emit('animation-phase', {
        type: 'animation-phase',
        animationPhase: event.data.phase,
        output: event.data.output,
        timestamp: Date.now()
      });
    });

    // Listen to manager events
    this.on('ai:decision', (data) => {
      this.handleAIDecision(data);
    });
  }

  private handleGuessMade(playerId: string, data: any): void {
    const state = this.rhEngine.getState();
    const player = state.players.find(p => p.id === playerId);
    
    if (!player) return;

    const entry: GuessHistoryEntry = {
      roundNumber: this.currentRoundNumber,
      playerId: playerId,
      playerName: player.name,
      guess: data.attempt.guess,
      matchResult: data.attempt,
      attemptsRemaining: data.attemptsRemaining,
      timestamp: Date.now()
    };

    this.guessHistory.push(entry);

    this.emit('guess-made', {
      type: 'guess-made',
      playerId,
      playerName: player.name,
      guess: data.attempt.guess,
      matchResult: data.attempt,
      timestamp: Date.now()
    });
  }

  private handleAIDecision(data: any): void {
    this.emit('decision-made', {
      type: 'decision-made',
      playerId: data.playerId,
      playerName: data.decision.playerName,
      guess: data.decision.action.guess,
      timestamp: Date.now()
    });
  }

  // Additional game-specific methods
  getGuessHistory(): GuessHistoryEntry[] {
    return [...this.guessHistory];
  }

  getCurrentPromptOutput(): string | null {
    return this.rhEngine.getOutput();
  }

  getRevealedPrompt(): string | null {
    return this.rhEngine.getRevealedPrompt();
  }

  getAttemptsRemaining(): number {
    return this.rhEngine.getAttemptsRemaining();
  }

  // Override startGame to initialize without starting first round
  // The first round will be started when user selects difficulty
  async startGame(): Promise<void> {
    if (this.managerState !== 'setup') {
      throw new Error('Game already started');
    }

    try {
      const players = await this.initializePlayers();
      this.engine.initialize(players);
      
      // Create AI agents for all AI players
      console.log('Player configs:', this.config.playerConfigs);
      
      for (const playerConfig of this.config.playerConfigs) {
        console.log('Checking player config:', {
          id: playerConfig.id,
          name: playerConfig.name,
          aiModel: playerConfig.aiModel,
          hasAiModel: !!playerConfig.aiModel
        });
        
        if (playerConfig.aiModel) {
          console.log('Creating AI agent for player:', playerConfig.id, playerConfig.name);
          const aiAgent = await this.createAIAgent(playerConfig);
          this.aiAgents.set(playerConfig.id, aiAgent);
          console.log('AI agent created and stored');
        }
      }
      
      console.log('AI agents created:', {
        count: this.aiAgents.size,
        playerIds: Array.from(this.aiAgents.keys())
      });

      this.managerState = 'playing';
      
      this.emit('game:started', {
        config: this.config,
        players,
        state: this.engine.getState()
      });

      console.log('ReverseHangmanGameManager.startGame() complete - waiting for difficulty selection');
      // Don't call runGameLoop() here - wait for startNewRound to be called
    } catch (error) {
      console.error('Failed to start game:', error);
      throw error;
    }
  }
}