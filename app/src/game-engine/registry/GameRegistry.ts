import { GameDescriptor } from './GameDescriptor';
import { IGameState, IGameAction, IGameConfig } from '../core/interfaces';

export interface GameFilter {
  category?: string;
  minPlayers?: number;
  maxPlayers?: number;
  tags?: string[];
  complexity?: 'simple' | 'moderate' | 'complex';
}

export interface GameRegistryStats {
  totalGames: number;
  byCategory: Record<string, number>;
  byComplexity: Record<string, number>;
  averagePlayerCount: {
    min: number;
    max: number;
  };
}

export class GameRegistry {
  private static instance: GameRegistry;
  private games: Map<string, GameDescriptor<any, any, any>> = new Map();
  private changeListeners: ((event: GameRegistryEvent) => void)[] = [];

  private constructor() {}

  static getInstance(): GameRegistry {
    if (!GameRegistry.instance) {
      GameRegistry.instance = new GameRegistry();
    }
    return GameRegistry.instance;
  }

  register<
    TState extends IGameState,
    TAction extends IGameAction,
    TConfig extends IGameConfig
  >(descriptor: GameDescriptor<TState, TAction, TConfig>): void {
    if (this.games.has(descriptor.id)) {
      throw new Error(`Game with ID '${descriptor.id}' is already registered`);
    }

    this.validateDescriptor(descriptor);
    this.games.set(descriptor.id, descriptor);
    
    this.notifyListeners({
      type: 'game-registered',
      gameId: descriptor.id,
      descriptor
    });
  }

  unregister(gameId: string): boolean {
    const descriptor = this.games.get(gameId);
    if (!descriptor) {
      return false;
    }

    this.games.delete(gameId);
    
    this.notifyListeners({
      type: 'game-unregistered',
      gameId,
      descriptor
    });

    return true;
  }

  get<
    TState extends IGameState = IGameState,
    TAction extends IGameAction = IGameAction,
    TConfig extends IGameConfig = IGameConfig
  >(gameId: string): GameDescriptor<TState, TAction, TConfig> | undefined {
    return this.games.get(gameId) as GameDescriptor<TState, TAction, TConfig> | undefined;
  }

  getAll(): GameDescriptor<any, any, any>[] {
    return Array.from(this.games.values());
  }

  filter(filter: GameFilter): GameDescriptor<any, any, any>[] {
    return this.getAll().filter(game => {
      if (filter.category && game.category !== filter.category) {
        return false;
      }

      if (filter.minPlayers !== undefined && game.maxPlayers < filter.minPlayers) {
        return false;
      }

      if (filter.maxPlayers !== undefined && game.minPlayers > filter.maxPlayers) {
        return false;
      }

      if (filter.tags && filter.tags.length > 0) {
        const hasAllTags = filter.tags.every(tag => game.tags.includes(tag));
        if (!hasAllTags) {
          return false;
        }
      }

      if (filter.complexity && game.complexity !== filter.complexity) {
        return false;
      }

      return true;
    });
  }

  search(query: string): GameDescriptor<any, any, any>[] {
    const lowerQuery = query.toLowerCase();
    
    return this.getAll().filter(game => {
      return game.name.toLowerCase().includes(lowerQuery) ||
             game.description.toLowerCase().includes(lowerQuery) ||
             game.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
    });
  }

  getCategories(): string[] {
    const categories = new Set<string>();
    this.games.forEach(game => categories.add(game.category));
    return Array.from(categories);
  }

  getTags(): string[] {
    const tags = new Set<string>();
    this.games.forEach(game => {
      game.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }

  getStats(): GameRegistryStats {
    const byCategory: Record<string, number> = {};
    const byComplexity: Record<string, number> = {};
    let totalMinPlayers = 0;
    let totalMaxPlayers = 0;

    this.games.forEach(game => {
      byCategory[game.category] = (byCategory[game.category] || 0) + 1;
      byComplexity[game.complexity] = (byComplexity[game.complexity] || 0) + 1;
      totalMinPlayers += game.minPlayers;
      totalMaxPlayers += game.maxPlayers;
    });

    const gameCount = this.games.size;

    return {
      totalGames: gameCount,
      byCategory,
      byComplexity,
      averagePlayerCount: {
        min: gameCount > 0 ? totalMinPlayers / gameCount : 0,
        max: gameCount > 0 ? totalMaxPlayers / gameCount : 0
      }
    };
  }

  onChange(listener: (event: GameRegistryEvent) => void): () => void {
    this.changeListeners.push(listener);
    
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index >= 0) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  clear(): void {
    const games = this.getAll();
    this.games.clear();
    
    games.forEach(descriptor => {
      this.notifyListeners({
        type: 'game-unregistered',
        gameId: descriptor.id,
        descriptor
      });
    });
  }

  private validateDescriptor(descriptor: GameDescriptor<any, any, any>): void {
    if (!descriptor.id || descriptor.id.trim() === '') {
      throw new Error('Game ID is required');
    }

    if (!descriptor.name || descriptor.name.trim() === '') {
      throw new Error('Game name is required');
    }

    if (descriptor.minPlayers < 1) {
      throw new Error('Minimum players must be at least 1');
    }

    if (descriptor.maxPlayers < descriptor.minPlayers) {
      throw new Error('Maximum players must be greater than or equal to minimum players');
    }

    if (!descriptor.factory) {
      throw new Error('Game factory is required');
    }
  }

  private notifyListeners(event: GameRegistryEvent): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in game registry listener:', error);
      }
    });
  }
}

export interface GameRegistryEvent {
  type: 'game-registered' | 'game-unregistered';
  gameId: string;
  descriptor: GameDescriptor<any, any, any>;
}

export const gameRegistry = GameRegistry.getInstance();