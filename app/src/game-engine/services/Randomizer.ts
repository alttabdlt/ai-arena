import { IGameRandomizer } from '../core/context';

export class GameRandomizer implements IGameRandomizer {
  private seedValue: string;
  private rng: () => number;

  constructor(seed?: string) {
    this.seedValue = seed || Date.now().toString();
    this.rng = this.createSeededRandom(this.seedValue);
  }

  seed(value: string): void {
    this.seedValue = value;
    this.rng = this.createSeededRandom(value);
  }

  nextInt(min: number, max: number): number {
    if (min > max) {
      throw new Error('Min must be less than or equal to max');
    }
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  nextFloat(): number {
    return this.rng();
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    
    return result;
  }

  pick<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    const index = this.nextInt(0, array.length - 1);
    return array[index];
  }

  pickMultiple<T>(array: T[], count: number): T[] {
    if (count > array.length) {
      throw new Error('Count exceeds array length');
    }
    
    if (count === array.length) {
      return [...array];
    }
    
    const shuffled = this.shuffle(array);
    return shuffled.slice(0, count);
  }

  private createSeededRandom(seed: string): () => number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    let x = hash;
    
    return () => {
      x ^= x << 13;
      x ^= x >> 17;
      x ^= x << 5;
      const result = (x >>> 0) / 0xFFFFFFFF;
      return result;
    };
  }
}

export class CryptoRandomizer implements IGameRandomizer {
  seed(value: string): void {
    console.warn('CryptoRandomizer does not support seeding');
  }

  nextInt(min: number, max: number): number {
    if (min > max) {
      throw new Error('Min must be less than or equal to max');
    }
    
    const range = max - min + 1;
    const randomBytes = new Uint32Array(1);
    crypto.getRandomValues(randomBytes);
    
    return (randomBytes[0] % range) + min;
  }

  nextFloat(): number {
    const randomBytes = new Uint32Array(1);
    crypto.getRandomValues(randomBytes);
    return randomBytes[0] / 0xFFFFFFFF;
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    
    return result;
  }

  pick<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    const index = this.nextInt(0, array.length - 1);
    return array[index];
  }

  pickMultiple<T>(array: T[], count: number): T[] {
    if (count > array.length) {
      throw new Error('Count exceeds array length');
    }
    
    if (count === array.length) {
      return [...array];
    }
    
    const shuffled = this.shuffle(array);
    return shuffled.slice(0, count);
  }
}

export class WeightedRandomizer extends GameRandomizer {
  pickWeighted<T>(items: T[], weights: number[]): T {
    if (items.length !== weights.length) {
      throw new Error('Items and weights must have same length');
    }
    
    if (items.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    if (totalWeight <= 0) {
      throw new Error('Total weight must be positive');
    }
    
    const random = this.nextFloat() * totalWeight;
    let cumulative = 0;
    
    for (let i = 0; i < items.length; i++) {
      cumulative += weights[i];
      if (random < cumulative) {
        return items[i];
      }
    }
    
    return items[items.length - 1];
  }

  pickMultipleWeighted<T>(items: T[], weights: number[], count: number): T[] {
    if (count > items.length) {
      throw new Error('Count exceeds items length');
    }
    
    const results: T[] = [];
    const remainingItems = [...items];
    const remainingWeights = [...weights];
    
    for (let i = 0; i < count; i++) {
      const picked = this.pickWeighted(remainingItems, remainingWeights);
      results.push(picked);
      
      const index = remainingItems.indexOf(picked);
      remainingItems.splice(index, 1);
      remainingWeights.splice(index, 1);
    }
    
    return results;
  }
}