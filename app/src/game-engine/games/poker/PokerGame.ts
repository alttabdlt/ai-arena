import { 
  IGame, 
  IGameEngine, 
  IGameManager, 
  IGameAIAgent, 
  IGameScoringSystem,
  IGameValidationResult 
} from '../../core/interfaces';
import { BaseGameFactory, GameDescriptorBuilder } from '../../registry/GameDescriptor';
import { PokerGameState, PokerAction, PokerGameConfig } from './PokerTypes';
import { PokerGameEngine } from './engine/PokerGameEngine';
import { PokerGameManager } from './PokerGameManager';
import { PokerAIAgentFactory } from './ai/PokerAIAgentFactory';
import { PokerScoringSystem } from './scoring/PokerScoringSystem';
import { IGameContext } from '../../core/context';
import { AIModelConfig } from '../../ai/AIDecisionStructure';
import { GameAIService } from '../../services/AIService';

export class PokerGame implements IGame<PokerGameState, PokerAction, PokerGameConfig> {
  id = 'poker';
  name = 'Texas Hold\'em Poker';
  description = 'Classic Texas Hold\'em poker with AI opponents';
  category: 'card' = 'card';
  minPlayers = 2;
  maxPlayers = 8;
  thumbnail = '/images/games/poker.png';

  createEngine(): IGameEngine<PokerGameState, PokerAction> {
    throw new Error('Use factory method');
  }

  createManager(config: PokerGameConfig): IGameManager<PokerGameState, PokerGameConfig> {
    throw new Error('Use factory method');
  }

  createAIAgent(config: any): IGameAIAgent<PokerGameState, PokerAction> {
    throw new Error('Use factory method');
  }

  createScoringSystem(): IGameScoringSystem<PokerGameState> {
    throw new Error('Use factory method');
  }

  getDefaultConfig(): PokerGameConfig {
    return {
      thinkingTime: 60000,
      playerConfigs: [],
      startingChips: 10000,
      smallBlind: 50,
      bigBlind: 100,
      blindIncreaseInterval: 10,
      maxHands: 50,
      speed: 'normal',
      showAIThinking: true,
      showDecisionHistory: true
    };
  }

  validateConfig(config: PokerGameConfig): IGameValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.startingChips < 1000) {
      errors.push('Starting chips must be at least 1000');
    }

    if (config.smallBlind >= config.bigBlind) {
      errors.push('Small blind must be less than big blind');
    }

    if (config.bigBlind > config.startingChips / 20) {
      warnings.push('Big blind is very large relative to starting chips');
    }

    if (config.playerConfigs.length < 2) {
      errors.push('At least 2 players required');
    }

    if (config.playerConfigs.length > 8) {
      errors.push('Maximum 8 players allowed');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
}

export class PokerGameFactory extends BaseGameFactory<PokerGameState, PokerAction, PokerGameConfig> {
  private aiService: GameAIService;
  private aiModels: Map<string, AIModelConfig>;

  constructor(aiService: GameAIService, aiModels: Map<string, AIModelConfig>) {
    super();
    this.aiService = aiService;
    this.aiModels = aiModels;
  }

  createGame(): IGame<PokerGameState, PokerAction, PokerGameConfig> {
    return new PokerGame();
  }

  createEngine(context: IGameContext): IGameEngine<PokerGameState, PokerAction> {
    return new PokerGameEngine(context);
  }

  createManager(config: PokerGameConfig, context: IGameContext): IGameManager<PokerGameState, PokerGameConfig> {
    const engine = new PokerGameEngine(context, config.smallBlind, config.bigBlind);
    const scoringSystem = new PokerScoringSystem(context);
    const aiAgentFactory = new PokerAIAgentFactory(
      {
        models: this.aiModels,
        defaultModel: 'gpt-4o',
        aiService: this.aiService
      },
      context
    );

    return new PokerGameManager(engine, config, context, scoringSystem, aiAgentFactory);
  }

  createAIAgent(config: any, context: IGameContext): IGameAIAgent<PokerGameState, PokerAction> {
    const aiAgentFactory = new PokerAIAgentFactory(
      {
        models: this.aiModels,
        defaultModel: config.aiModel || 'gpt-4o',
        aiService: this.aiService
      },
      context
    );

    return aiAgentFactory.createAgent(config);
  }

  createScoringSystem(context: IGameContext): IGameScoringSystem<PokerGameState> {
    return new PokerScoringSystem(context);
  }

  getDefaultConfig(): PokerGameConfig {
    return new PokerGame().getDefaultConfig();
  }

  protected validateGameSpecificConfig(config: PokerGameConfig): IGameValidationResult {
    return new PokerGame().validateConfig(config);
  }
}

export function createPokerGameDescriptor(aiService: GameAIService, aiModels: Map<string, AIModelConfig>) {
  const factory = new PokerGameFactory(aiService, aiModels);
  
  return new GameDescriptorBuilder<PokerGameState, PokerAction, PokerGameConfig>()
    .setId('poker')
    .setName('Texas Hold\'em Poker')
    .setDescription('Classic Texas Hold\'em poker with AI opponents. Test your bluffing skills against various AI models.')
    .setCategory('card')
    .setPlayerLimits(2, 8)
    .setThumbnail('/images/games/poker.png')
    .setVersion('2.0.0')
    .setAuthor('AI Arena Team')
    .setTags(['card', 'strategy', 'bluffing', 'gambling', 'competitive'])
    .setRules(`
      Texas Hold'em Rules:
      - Each player receives 2 hole cards
      - 5 community cards are dealt (flop: 3, turn: 1, river: 1)
      - Make the best 5-card hand using any combination
      - Betting rounds: preflop, flop, turn, river
      - Winner takes the pot (or split if tied)
    `)
    .setAverageGameDuration(30)
    .setComplexity('moderate')
    .setFactory(factory)
    .build();
}