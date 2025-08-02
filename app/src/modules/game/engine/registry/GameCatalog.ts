import { GameDescriptor } from './GameDescriptor';
import { gameRegistry, GameFilter } from './GameRegistry';

export interface GameCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail?: string;
  playerCount: {
    min: number;
    max: number;
  };
  tags: string[];
  complexity: string;
  author: string;
  version: string;
  averageDuration?: number;
  isNew?: boolean;
  isFeatured?: boolean;
  popularity?: number;
}

export interface GameCatalogOptions {
  sortBy?: 'name' | 'category' | 'players' | 'complexity' | 'popularity';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  includeStats?: boolean;
}

export class GameCatalog {
  private featuredGames: Set<string> = new Set();
  private newGames: Set<string> = new Set();
  private gamePopularity: Map<string, number> = new Map();

  getFeaturedGames(): GameCatalogEntry[] {
    return Array.from(this.featuredGames)
      .map(id => this.getGameEntry(id))
      .filter(entry => entry !== null) as GameCatalogEntry[];
  }

  getNewGames(limit: number = 10): GameCatalogEntry[] {
    return Array.from(this.newGames)
      .slice(0, limit)
      .map(id => this.getGameEntry(id))
      .filter(entry => entry !== null) as GameCatalogEntry[];
  }

  getPopularGames(limit: number = 10): GameCatalogEntry[] {
    const sorted = Array.from(this.gamePopularity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => this.getGameEntry(id))
      .filter(entry => entry !== null) as GameCatalogEntry[];
    
    return sorted;
  }

  searchGames(query: string, options?: GameCatalogOptions): {
    entries: GameCatalogEntry[];
    total: number;
  } {
    const games = gameRegistry.search(query);
    return this.processGames(games, options);
  }

  filterGames(filter: GameFilter, options?: GameCatalogOptions): {
    entries: GameCatalogEntry[];
    total: number;
  } {
    const games = gameRegistry.filter(filter);
    return this.processGames(games, options);
  }

  getAllGames(options?: GameCatalogOptions): {
    entries: GameCatalogEntry[];
    total: number;
  } {
    const games = gameRegistry.getAll();
    return this.processGames(games, options);
  }

  getGamesByCategory(category: string, options?: GameCatalogOptions): {
    entries: GameCatalogEntry[];
    total: number;
  } {
    return this.filterGames({ category }, options);
  }

  getGameEntry(gameId: string): GameCatalogEntry | null {
    const descriptor = gameRegistry.get(gameId);
    if (!descriptor) {
      return null;
    }

    return this.descriptorToEntry(descriptor);
  }

  markAsFeatured(gameId: string): boolean {
    const descriptor = gameRegistry.get(gameId);
    if (!descriptor) {
      return false;
    }
    
    this.featuredGames.add(gameId);
    return true;
  }

  unmarkAsFeatured(gameId: string): void {
    this.featuredGames.delete(gameId);
  }

  markAsNew(gameId: string): boolean {
    const descriptor = gameRegistry.get(gameId);
    if (!descriptor) {
      return false;
    }
    
    this.newGames.add(gameId);
    return true;
  }

  unmarkAsNew(gameId: string): void {
    this.newGames.delete(gameId);
  }

  recordPlay(gameId: string): void {
    const current = this.gamePopularity.get(gameId) || 0;
    this.gamePopularity.set(gameId, current + 1);
  }

  getCategories(): Array<{ name: string; count: number }> {
    const categories = gameRegistry.getCategories();
    const stats = gameRegistry.getStats();
    
    return categories.map(category => ({
      name: category,
      count: stats.byCategory[category] || 0
    }));
  }

  getTags(): Array<{ name: string; count: number }> {
    const tagCounts = new Map<string, number>();
    
    gameRegistry.getAll().forEach(game => {
      game.tags.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    return Array.from(tagCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  private processGames(
    games: GameDescriptor<any, any, any>[], 
    options?: GameCatalogOptions
  ): { entries: GameCatalogEntry[]; total: number } {
    let entries = games.map(descriptor => this.descriptorToEntry(descriptor));

    if (options?.sortBy) {
      entries = this.sortEntries(entries, options.sortBy, options.sortOrder || 'asc');
    }

    const total = entries.length;

    if (options?.offset !== undefined || options?.limit !== undefined) {
      const start = options.offset || 0;
      const end = options.limit ? start + options.limit : undefined;
      entries = entries.slice(start, end);
    }

    return { entries, total };
  }

  private descriptorToEntry(descriptor: GameDescriptor<any, any, any>): GameCatalogEntry {
    return {
      id: descriptor.id,
      name: descriptor.name,
      description: descriptor.description,
      category: descriptor.category,
      thumbnail: descriptor.thumbnail,
      playerCount: {
        min: descriptor.minPlayers,
        max: descriptor.maxPlayers
      },
      tags: descriptor.tags,
      complexity: descriptor.complexity,
      author: descriptor.author,
      version: descriptor.version,
      averageDuration: descriptor.averageGameDuration,
      isNew: this.newGames.has(descriptor.id),
      isFeatured: this.featuredGames.has(descriptor.id),
      popularity: this.gamePopularity.get(descriptor.id) || 0
    };
  }

  private sortEntries(
    entries: GameCatalogEntry[], 
    sortBy: string, 
    order: 'asc' | 'desc'
  ): GameCatalogEntry[] {
    const sorted = [...entries].sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'category':
          aVal = a.category;
          bVal = b.category;
          break;
        case 'players':
          aVal = a.playerCount.max;
          bVal = b.playerCount.max;
          break;
        case 'complexity':
          aVal = this.complexityToNumber(a.complexity);
          bVal = this.complexityToNumber(b.complexity);
          break;
        case 'popularity':
          aVal = a.popularity || 0;
          bVal = b.popularity || 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }

  private complexityToNumber(complexity: string): number {
    switch (complexity) {
      case 'simple': return 1;
      case 'moderate': return 2;
      case 'complex': return 3;
      default: return 2;
    }
  }
}

export const gameCatalog = new GameCatalog();