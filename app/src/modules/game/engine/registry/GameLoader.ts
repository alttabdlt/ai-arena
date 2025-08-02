import { GameDescriptor, GameFactory } from './GameDescriptor';
import { gameRegistry } from './GameRegistry';
import { IGameState, IGameAction, IGameConfig } from '../core/interfaces';
import { ContextFactory } from '../services/ContextFactory';

export interface GameModule<
  TState extends IGameState = IGameState,
  TAction extends IGameAction = IGameAction,
  TConfig extends IGameConfig = IGameConfig
> {
  descriptor: GameDescriptor<TState, TAction, TConfig>;
  factory: GameFactory<TState, TAction, TConfig>;
}

export interface GameLoadResult {
  success: boolean;
  gameId?: string;
  error?: string;
}

export class GameLoader {
  private loadedGames: Map<string, GameModule<any, any, any>> = new Map();

  async loadGame(module: GameModule<any, any, any>): Promise<GameLoadResult> {
    try {
      this.validateModule(module);
      
      if (this.loadedGames.has(module.descriptor.id)) {
        return {
          success: false,
          error: `Game '${module.descriptor.id}' is already loaded`
        };
      }

      gameRegistry.register(module.descriptor);
      this.loadedGames.set(module.descriptor.id, module);

      return {
        success: true,
        gameId: module.descriptor.id
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async loadGames(modules: GameModule<any, any, any>[]): Promise<GameLoadResult[]> {
    return Promise.all(modules.map(module => this.loadGame(module)));
  }

  async unloadGame(gameId: string): Promise<boolean> {
    const module = this.loadedGames.get(gameId);
    if (!module) {
      return false;
    }

    gameRegistry.unregister(gameId);
    this.loadedGames.delete(gameId);
    
    return true;
  }

  createGameInstance(gameId: string) {
    const descriptor = gameRegistry.get(gameId);
    if (!descriptor) {
      throw new Error(`Game '${gameId}' not found in registry`);
    }

    const context = ContextFactory.create({ gameId });
    const game = descriptor.factory.createGame();
    
    return {
      game,
      context,
      descriptor
    };
  }

  getLoadedGames(): string[] {
    return Array.from(this.loadedGames.keys());
  }

  isLoaded(gameId: string): boolean {
    return this.loadedGames.has(gameId);
  }

  private validateModule(module: GameModule<any, any, any>): void {
    if (!module.descriptor) {
      throw new Error('Game module must have a descriptor');
    }

    if (!module.factory) {
      throw new Error('Game module must have a factory');
    }

    if (module.descriptor.factory !== module.factory) {
      throw new Error('Descriptor factory must match module factory');
    }
  }
}

export class DynamicGameLoader extends GameLoader {
  async loadGameFromPath(path: string): Promise<GameLoadResult> {
    try {
      const module = await import(/* @vite-ignore */ path);
      
      if (!module.default || !module.default.descriptor || !module.default.factory) {
        throw new Error('Invalid game module format');
      }

      return this.loadGame(module.default);
    } catch (error) {
      return {
        success: false,
        error: `Failed to load game from ${path}: ${error}`
      };
    }
  }

  async loadGamesFromDirectory(directory: string): Promise<GameLoadResult[]> {
    console.warn('Directory loading not implemented in browser environment');
    return [];
  }
}

export const gameLoader = new GameLoader();