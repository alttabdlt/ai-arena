import { IGameState, IGameAction, IGameDecision } from '../core/interfaces';

export interface CacheKey {
  stateHash: string;
  playerId: string;
  modelId: string;
}

export interface CacheEntry<TDecision> {
  decision: TDecision;
  timestamp: number;
  hits: number;
}

export class AIDecisionCache<TState extends IGameState, TAction extends IGameAction> {
  private cache: Map<string, CacheEntry<IGameDecision>> = new Map();
  private maxSize: number;
  private ttlMs: number;
  private similarityThreshold: number;

  constructor(maxSize: number = 1000, ttlMs: number = 5 * 60 * 1000, similarityThreshold: number = 0.95) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.similarityThreshold = similarityThreshold;
  }

  get(state: TState, playerId: string, modelId: string): IGameDecision | null {
    const key = this.createKey(state, playerId, modelId);
    const entry = this.cache.get(key);

    if (!entry) {
      return this.findSimilar(state, playerId, modelId);
    }

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.decision;
  }

  set(state: TState, playerId: string, modelId: string, decision: IGameDecision): void {
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const key = this.createKey(state, playerId, modelId);
    this.cache.set(key, {
      decision,
      timestamp: Date.now(),
      hits: 0
    });
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    let totalHits = 0;
    let totalAccesses = 0;

    this.cache.forEach(entry => {
      totalHits += entry.hits;
      totalAccesses += entry.hits + 1;
    });

    return {
      size: this.cache.size,
      hits: totalHits,
      misses: totalAccesses - totalHits,
      hitRate: totalAccesses > 0 ? totalHits / totalAccesses : 0
    };
  }

  private createKey(state: TState, playerId: string, modelId: string): string {
    const stateHash = this.hashState(state);
    return `${stateHash}:${playerId}:${modelId}`;
  }

  private hashState(state: TState): string {
    const relevantData = {
      phase: state.phase,
      turnCount: state.turnCount,
      currentTurn: state.currentTurn,
      playerCount: state.players.length,
      activePlayerCount: state.players.filter(p => p.isActive).length,
      gameSpecific: this.extractGameSpecificData(state)
    };

    return this.simpleHash(JSON.stringify(relevantData));
  }

  private extractGameSpecificData(state: TState): any {
    const stateAny = state as any;
    const excludeKeys = ['gameId', 'startTime', 'endTime', 'metadata', 'players'];
    
    const extracted: any = {};
    for (const key in stateAny) {
      if (!excludeKeys.includes(key)) {
        extracted[key] = stateAny[key];
      }
    }
    
    return extracted;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private findSimilar(state: TState, playerId: string, modelId: string): IGameDecision | null {
    const currentHash = this.hashState(state);
    let bestMatch: { entry: CacheEntry<IGameDecision>; similarity: number } | null = null;

    this.cache.forEach((entry, key) => {
      const [hash, pid, mid] = key.split(':');
      if (pid === playerId && mid === modelId) {
        const similarity = this.calculateSimilarity(currentHash, hash);
        if (similarity >= this.similarityThreshold) {
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { entry, similarity };
          }
        }
      }
    });

    if (bestMatch) {
      bestMatch.entry.hits++;
      return bestMatch.entry.decision;
    }

    return null;
  }

  private calculateSimilarity(hash1: string, hash2: string): number {
    if (hash1 === hash2) return 1;
    
    const len = Math.max(hash1.length, hash2.length);
    let matches = 0;
    
    for (let i = 0; i < len; i++) {
      if (hash1[i] === hash2[i]) matches++;
    }
    
    return matches / len;
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    this.cache.forEach((entry, key) => {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}