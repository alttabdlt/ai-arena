import { IGame, IGameEngine, IGameManager, IGameScoringSystem, IGameAIAgent, IPlayerConfig, IGameValidationResult } from '../../core/interfaces';
import { IGameContext } from '../../core/context';
import { GameAIService } from '../../services/AIService';
import { Connect4GameState, Connect4GameAction, Connect4GameConfig } from './Connect4Types';
import { Connect4GameEngine } from './engine/Connect4GameEngine';
import { Connect4GameManager } from './Connect4GameManager';
import { Connect4ScoringSystem } from './scoring/Connect4ScoringSystem';
import { Connect4AIAgentFactory } from './ai/Connect4AIAgentFactory';
import { GameDescriptorBuilder, BaseGameFactory } from '../../registry/GameDescriptor';
import { AIModelConfig } from '../../ai/AIDecisionStructure';

export class Connect4Game implements IGame<Connect4GameState, Connect4GameAction, Connect4GameConfig> {
  id = 'connect4';
  name = 'Connect 4';
  description = 'Classic two-player connection game where players take turns dropping colored discs into a grid';
  minPlayers = 2;
  maxPlayers = 2;
  category: 'strategy' | 'card' | 'word' | 'puzzle' | 'other' = 'strategy';
  tags = ['classic', 'strategy', 'quick'];
  
  createEngine(): IGameEngine<Connect4GameState, Connect4GameAction> {
    throw new Error('Use factory method');
  }
  
  createManager(config: Connect4GameConfig): IGameManager<Connect4GameState, Connect4GameConfig> {
    throw new Error('Use factory method');
  }
  
  createAIAgent(config: IPlayerConfig): IGameAIAgent<Connect4GameState, Connect4GameAction> {
    throw new Error('Use factory method');
  }
  
  createScoringSystem(): IGameScoringSystem<Connect4GameState> {
    throw new Error('Use factory method');
  }
  
  getDefaultConfig(): Connect4GameConfig {
    return {
      thinkingTime: 30000, // 30 seconds
      playerConfigs: [],
      timeLimit: 60000, // 60 seconds per move
      enableGravity: true
    };
  }
  
  validateConfig(config: Connect4GameConfig): IGameValidationResult {
    const errors: string[] = [];
    
    if (config.playerConfigs.length !== 2) {
      errors.push('Connect4 requires exactly 2 players');
    }
    
    if (config.timeLimit < 1000) {
      errors.push('Time limit must be at least 1 second');
    }
    
    if (!config.enableGravity) {
      errors.push('Gravity must be enabled for Connect4');
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

export class Connect4GameFactory extends BaseGameFactory<Connect4GameState, Connect4GameAction, Connect4GameConfig> {
  constructor(
    private aiService: GameAIService,
    private aiModels: Map<string, AIModelConfig>
  ) {
    super();
  }

  createGame(): IGame<Connect4GameState, Connect4GameAction, Connect4GameConfig> {
    return new Connect4Game();
  }

  createEngine(context: IGameContext): IGameEngine<Connect4GameState, Connect4GameAction> {
    return new Connect4GameEngine(context);
  }

  createManager(config: Connect4GameConfig, context: IGameContext): IGameManager<Connect4GameState, Connect4GameConfig> {
    return new Connect4GameManager(config, context, this.aiService);
  }

  createAIAgent(config: IPlayerConfig, context: IGameContext): IGameAIAgent<Connect4GameState, Connect4GameAction> {
    console.log('Connect4GameFactory.createAIAgent called for:', config.id);
    const factory = new Connect4AIAgentFactory(
      {
        aiService: this.aiService,
        models: this.aiModels,
        defaultModel: config.aiModel || 'gpt-4o'
      },
      context
    );
    
    const agent = factory.createAgent(config);
    console.log('Connect4GameFactory created agent:', agent.constructor.name);
    return agent;
  }

  createScoringSystem(context: IGameContext): IGameScoringSystem<Connect4GameState> {
    return new Connect4ScoringSystem(context);
  }

  getDefaultConfig(): Connect4GameConfig {
    return new Connect4Game().getDefaultConfig();
  }

  protected validateGameSpecificConfig(config: Connect4GameConfig): IGameValidationResult {
    return new Connect4Game().validateConfig(config);
  }
}

export function createConnect4GameDescriptor(aiService: GameAIService, aiModels: Map<string, AIModelConfig>) {
  const factory = new Connect4GameFactory(aiService, aiModels);
  
  return new GameDescriptorBuilder<Connect4GameState, Connect4GameAction, Connect4GameConfig>()
    .setId('connect4')
    .setName('Connect 4')
    .setDescription('Classic two-player connection game. Be the first to connect four of your colored discs in a row!')
    .setCategory('strategy')
    .setPlayerLimits(2, 2)
    .setThumbnail('/images/games/connect4.png')
    .setVersion('1.0.0')
    .setAuthor('AI Arena Team')
    .setTags(['classic', 'strategy', 'quick', 'family', 'competitive'])
    .setRules(`
      Connect 4 Rules:
      - Players take turns dropping colored discs into an 8x8 grid
      - Discs fall to the lowest available position in the column
      - First player to form a horizontal, vertical, or diagonal line of 4 discs wins
      - If the board fills up with no winner, the game is a draw
      - Simple to learn, challenging to master!
    `)
    .setAverageGameDuration(10)
    .setComplexity('simple')
    .setFactory(factory)
    .build();
}