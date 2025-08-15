// BotPersonality enum matching backend schema
export enum BotPersonality {
  CRIMINAL = 'CRIMINAL',
  GAMBLER = 'GAMBLER',
  WORKER = 'WORKER'
}

// Character configuration for the metaverse
export interface SpriteConfig {
  id: string;
  name: string;
  personality: BotPersonality;
  characterId: string; // Character identifier (f1-f8)
}

export interface SelectedSprite {
  config: SpriteConfig;
  characterId: string; // Character identifier for metaverse (f1-f8)
}

export class StardewSpriteSelector {
  // Available characters in the metaverse
  private readonly AVAILABLE_CHARACTERS = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'];
  
  // Map personalities to preferred characters
  private readonly PERSONALITY_PREFERENCES = {
    [BotPersonality.CRIMINAL]: ['f1', 'f4', 'f7'], // Tougher looking characters
    [BotPersonality.GAMBLER]: ['f2', 'f5', 'f8'],  // Smoother characters
    [BotPersonality.WORKER]: ['f3', 'f6']          // Friendly characters
  };

  // Select a character based on personality and optional seed
  async selectSprite(personality: BotPersonality, seed?: string): Promise<SelectedSprite> {
    console.log('StardewSpriteSelector: selectSprite called', { personality, seed });
    
    // Get character ID based on personality
    const characterId = this.getCharacterId(personality, seed || Math.random().toString());
    
    const config: SpriteConfig = {
      id: characterId,
      name: `${personality} Character`,
      personality,
      characterId
    };
    
    console.log('StardewSpriteSelector: Character selected', { characterId });
    
    return {
      config,
      characterId
    };
  }

  // Get character ID based on personality and seed
  private getCharacterId(personality: BotPersonality, seed: string): string {
    // Get preferred characters for this personality
    const preferredCharacters = this.PERSONALITY_PREFERENCES[personality] || this.AVAILABLE_CHARACTERS;
    
    // Use seed to consistently select the same character
    const hash = this.hashCode(seed);
    const index = Math.abs(hash) % preferredCharacters.length;
    
    return preferredCharacters[index];
  }

  // Simple hash function for consistent character selection
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  // Get a specific character by ID (for manual selection)
  selectCharacterById(characterId: string, personality?: BotPersonality): SelectedSprite {
    // Validate character ID
    if (!this.AVAILABLE_CHARACTERS.includes(characterId)) {
      console.warn(`Invalid character ID: ${characterId}, defaulting to f1`);
      characterId = 'f1';
    }
    
    const config: SpriteConfig = {
      id: characterId,
      name: `Character ${characterId}`,
      personality: personality || BotPersonality.WORKER,
      characterId
    };
    
    return {
      config,
      characterId
    };
  }

  // Get all available characters (for UI selection)
  getAvailableCharacters(): string[] {
    return [...this.AVAILABLE_CHARACTERS];
  }
}