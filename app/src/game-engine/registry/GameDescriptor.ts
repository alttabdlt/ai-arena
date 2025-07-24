import { 
  IGame, 
  IGameState, 
  IGameAction, 
  IGameConfig,
  IGameValidationResult,
  IGameEngine,
  IGameManager,
  IGameAIAgent,
  IGameScoringSystem
} from '../core/interfaces';

export interface GameDescriptor<
  TState extends IGameState = IGameState,
  TAction extends IGameAction = IGameAction,
  TConfig extends IGameConfig = IGameConfig
> {
  id: string;
  name: string;
  description: string;
  category: 'strategy' | 'card' | 'word' | 'puzzle' | 'other';
  minPlayers: number;
  maxPlayers: number;
  thumbnail?: string;
  version: string;
  author: string;
  tags: string[];
  rules?: string;
  averageGameDuration?: number;
  complexity: 'simple' | 'moderate' | 'complex';
  factory: GameFactory<TState, TAction, TConfig>;
}

export interface GameFactory<
  TState extends IGameState,
  TAction extends IGameAction,
  TConfig extends IGameConfig
> {
  createGame(): IGame<TState, TAction, TConfig>;
  createEngine(context: any): IGameEngine<TState, TAction>;
  createManager(config: TConfig, context: any): IGameManager<TState, TConfig>;
  createAIAgent(config: any, context: any): IGameAIAgent<TState, TAction>;
  createScoringSystem(context: any): IGameScoringSystem<TState>;
  getDefaultConfig(): TConfig;
  validateConfig(config: TConfig): IGameValidationResult;
}

export abstract class BaseGameFactory<
  TState extends IGameState,
  TAction extends IGameAction,
  TConfig extends IGameConfig
> implements GameFactory<TState, TAction, TConfig> {
  
  abstract createGame(): IGame<TState, TAction, TConfig>;
  abstract createEngine(context: any): IGameEngine<TState, TAction>;
  abstract createManager(config: TConfig, context: any): IGameManager<TState, TConfig>;
  abstract createAIAgent(config: any, context: any): IGameAIAgent<TState, TAction>;
  abstract createScoringSystem(context: any): IGameScoringSystem<TState>;
  abstract getDefaultConfig(): TConfig;
  
  validateConfig(config: TConfig): IGameValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config) {
      errors.push('Configuration is required');
    } else {
      const validation = this.validateGameSpecificConfig(config);
      errors.push(...(validation.errors || []));
      warnings.push(...(validation.warnings || []));
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  protected abstract validateGameSpecificConfig(config: TConfig): IGameValidationResult;
}

export class GameDescriptorBuilder<
  TState extends IGameState = IGameState,
  TAction extends IGameAction = IGameAction,
  TConfig extends IGameConfig = IGameConfig
> {
  private descriptor: Partial<GameDescriptor<TState, TAction, TConfig>> = {
    tags: [],
    version: '1.0.0',
    complexity: 'moderate'
  };

  setId(id: string): this {
    this.descriptor.id = id;
    return this;
  }

  setName(name: string): this {
    this.descriptor.name = name;
    return this;
  }

  setDescription(description: string): this {
    this.descriptor.description = description;
    return this;
  }

  setCategory(category: 'strategy' | 'card' | 'word' | 'puzzle' | 'other'): this {
    this.descriptor.category = category;
    return this;
  }

  setPlayerLimits(min: number, max: number): this {
    this.descriptor.minPlayers = min;
    this.descriptor.maxPlayers = max;
    return this;
  }

  setThumbnail(thumbnail: string): this {
    this.descriptor.thumbnail = thumbnail;
    return this;
  }

  setVersion(version: string): this {
    this.descriptor.version = version;
    return this;
  }

  setAuthor(author: string): this {
    this.descriptor.author = author;
    return this;
  }

  addTag(tag: string): this {
    this.descriptor.tags!.push(tag);
    return this;
  }

  setTags(tags: string[]): this {
    this.descriptor.tags = tags;
    return this;
  }

  setRules(rules: string): this {
    this.descriptor.rules = rules;
    return this;
  }

  setAverageGameDuration(minutes: number): this {
    this.descriptor.averageGameDuration = minutes;
    return this;
  }

  setComplexity(complexity: 'simple' | 'moderate' | 'complex'): this {
    this.descriptor.complexity = complexity;
    return this;
  }

  setFactory(factory: GameFactory<TState, TAction, TConfig>): this {
    this.descriptor.factory = factory;
    return this;
  }

  build(): GameDescriptor<TState, TAction, TConfig> {
    const required = ['id', 'name', 'description', 'category', 'minPlayers', 'maxPlayers', 'author', 'factory'];
    const missing = required.filter(field => !(field in this.descriptor));
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    return this.descriptor as GameDescriptor<TState, TAction, TConfig>;
  }
}