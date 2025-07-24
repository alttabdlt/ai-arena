import { 
  IGame, 
  IGameEngine, 
  IGameManager, 
  IGameAIAgent, 
  IGameScoringSystem,
  IGameValidationResult,
  IPlayerConfig 
} from '../../core/interfaces';
import { BaseGameFactory, GameDescriptorBuilder } from '../../registry/GameDescriptor';
import { ReverseHangmanGameState, ReverseHangmanAction, ReverseHangmanGameConfig } from './ReverseHangmanTypes';
import { ReverseHangmanGameEngine } from './engine/ReverseHangmanGameEngine';
import { ReverseHangmanGameManager } from './ReverseHangmanGameManager';
import { ReverseHangmanAIAgentFactory } from './ai/ReverseHangmanAIAgentFactory';
import { ReverseHangmanScoringSystem } from './scoring/ReverseHangmanScoringSystem';
import { IGameContext } from '../../core/context';
import { AIModelConfig } from '../../ai/AIDecisionStructure';
import { GameAIService } from '../../services/AIService';

export class ReverseHangmanGame implements IGame<ReverseHangmanGameState, ReverseHangmanAction, ReverseHangmanGameConfig> {
  id = 'reverse-hangman';
  name = 'Reverse Hangman';
  description = 'Guess the prompt that generated the AI output';
  category: 'word' = 'word';
  minPlayers = 1;
  maxPlayers = 4;
  thumbnail = '/images/games/reverse-hangman.png';

  createEngine(): IGameEngine<ReverseHangmanGameState, ReverseHangmanAction> {
    throw new Error('Use factory method');
  }

  createManager(config: ReverseHangmanGameConfig): IGameManager<ReverseHangmanGameState, ReverseHangmanGameConfig> {
    throw new Error('Use factory method');
  }

  createAIAgent(config: IPlayerConfig): IGameAIAgent<ReverseHangmanGameState, ReverseHangmanAction> {
    throw new Error('Use factory method');
  }

  createScoringSystem(): IGameScoringSystem<ReverseHangmanGameState> {
    throw new Error('Use factory method');
  }

  getDefaultConfig(): ReverseHangmanGameConfig {
    return {
      thinkingTime: 60000,
      playerConfigs: [],
      maxAttempts: 7,
      maxRounds: 5,
      difficulty: 'mixed',
      categories: ['all'],
      animationDuration: 2000
    };
  }

  validateConfig(config: ReverseHangmanGameConfig): IGameValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.maxAttempts < 3) {
      errors.push('Maximum attempts must be at least 3');
    }

    if (config.maxAttempts > 10) {
      warnings.push('More than 10 attempts might make the game too easy');
    }

    if (config.maxRounds < 1) {
      errors.push('Must have at least 1 round');
    }

    if (config.maxRounds > 10) {
      warnings.push('More than 10 rounds might make the game too long');
    }

    if (config.playerConfigs.length < 1) {
      errors.push('At least 1 player required');
    }

    if (config.playerConfigs.length > 4) {
      errors.push('Maximum 4 players allowed');
    }

    const validDifficulties = ['easy', 'medium', 'hard', 'expert', 'mixed'];
    if (!validDifficulties.includes(config.difficulty)) {
      errors.push(`Difficulty must be one of: ${validDifficulties.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
}

export class ReverseHangmanGameFactory extends BaseGameFactory<ReverseHangmanGameState, ReverseHangmanAction, ReverseHangmanGameConfig> {
  private aiService: GameAIService;
  private aiModels: Map<string, AIModelConfig>;

  constructor(aiService: GameAIService, aiModels: Map<string, AIModelConfig>) {
    super();
    this.aiService = aiService;
    this.aiModels = aiModels;
  }

  createGame(): IGame<ReverseHangmanGameState, ReverseHangmanAction, ReverseHangmanGameConfig> {
    return new ReverseHangmanGame();
  }

  createEngine(context: IGameContext, config?: ReverseHangmanGameConfig): IGameEngine<ReverseHangmanGameState, ReverseHangmanAction> {
    const maxAttempts = config?.maxAttempts || 7;
    return new ReverseHangmanGameEngine(context, maxAttempts);
  }

  createManager(config: ReverseHangmanGameConfig, context: IGameContext): IGameManager<ReverseHangmanGameState, ReverseHangmanGameConfig> {
    const engine = this.createEngine(context, config);
    const scoringSystem = new ReverseHangmanScoringSystem(context);
    const aiAgentFactory = new ReverseHangmanAIAgentFactory(
      {
        models: this.aiModels,
        defaultModel: 'gpt-4o',
        aiService: this.aiService
      },
      context
    );

    return new ReverseHangmanGameManager(
      engine as ReverseHangmanGameEngine, 
      config, 
      context, 
      scoringSystem, 
      aiAgentFactory
    );
  }

  createAIAgent(config: IPlayerConfig, context: IGameContext): IGameAIAgent<ReverseHangmanGameState, ReverseHangmanAction> {
    const aiAgentFactory = new ReverseHangmanAIAgentFactory(
      {
        models: this.aiModels,
        defaultModel: config.aiModel || 'gpt-4o',
        aiService: this.aiService
      },
      context
    );

    return aiAgentFactory.createAgent(config);
  }

  createScoringSystem(context: IGameContext): IGameScoringSystem<ReverseHangmanGameState> {
    return new ReverseHangmanScoringSystem(context);
  }

  getDefaultConfig(): ReverseHangmanGameConfig {
    return new ReverseHangmanGame().getDefaultConfig();
  }

  protected validateGameSpecificConfig(config: ReverseHangmanGameConfig): IGameValidationResult {
    return new ReverseHangmanGame().validateConfig(config);
  }
}

export function createReverseHangmanGameDescriptor(aiService: GameAIService, aiModels: Map<string, AIModelConfig>) {
  const factory = new ReverseHangmanGameFactory(aiService, aiModels);
  
  return new GameDescriptorBuilder<ReverseHangmanGameState, ReverseHangmanAction, ReverseHangmanGameConfig>()
    .setId('reverse-hangman')
    .setName('Reverse Hangman')
    .setDescription('A unique twist on the classic game - you\'re given an AI\'s output and must guess the prompt that generated it!')
    .setCategory('word')
    .setPlayerLimits(1, 4)
    .setThumbnail('/images/games/reverse-hangman.png')
    .setVersion('2.0.0')
    .setAuthor('AI Arena Team')
    .setTags(['word', 'puzzle', 'deduction', 'ai', 'creative'])
    .setRules(`
      Reverse Hangman Rules:
      - You see the OUTPUT from an AI response
      - Your goal is to guess the PROMPT that created it
      - You have limited attempts (usually 7)
      - Each wrong guess reveals how close you were (match percentage)
      - Guess types: exact, near (90%+), partial (70%+), semantic (30%+), incorrect
      - Win by guessing the exact prompt
      - Lose if you run out of attempts
      
      Scoring:
      - Base points depend on difficulty (Easy: 500, Medium: 1000, Hard: 2000, Expert: 5000)
      - Fewer attempts = higher score multiplier
      - Style bonuses for first-try wins, pattern recognition, etc.
      - Time bonuses for quick solutions
    `)
    .setAverageGameDuration(10)
    .setComplexity('simple')
    .setFactory(factory)
    .build();
}