/**
 * Extracts character sprites from the 32x32folk.png sprite sheet
 */

export interface CharacterSprite {
  characterId: string;
  imageData: string;
}

export class CharacterSpriteExtractor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private spriteSheet: HTMLImageElement | null = null;
  
  // Sprite sheet dimensions
  private readonly SPRITE_SIZE = 32;
  private readonly SHEET_COLUMNS = 12;
  private readonly SHEET_ROWS = 8;
  
  // Character layout: 3 columns × 4 rows per character
  private readonly FRAMES_PER_ROW = 3; // 3 animation frames
  private readonly ROWS_PER_CHARACTER = 4; // 4 directions
  
  // Map character IDs to their position in the sprite sheet
  private readonly CHARACTER_POSITIONS: Record<string, { col: number; row: number }> = {
    'f1': { col: 0, row: 0 },  // Top-left character
    'f2': { col: 3, row: 0 },  // Top row, second character
    'f3': { col: 6, row: 0 },  // Top row, third character
    'f4': { col: 9, row: 0 },  // Top-right character
    'f5': { col: 0, row: 4 },  // Bottom-left character
    'f6': { col: 3, row: 4 },  // Bottom row, second character
    'f7': { col: 6, row: 4 },  // Bottom row, third character
    'f8': { col: 9, row: 4 },  // Bottom-right character
  };
  
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.SPRITE_SIZE;
    this.canvas.height = this.SPRITE_SIZE;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.ctx.imageSmoothingEnabled = false; // Keep pixels crisp
  }
  
  /**
   * Load the sprite sheet
   */
  async loadSpriteSheet(): Promise<void> {
    if (this.spriteSheet) {
      console.log('CharacterSpriteExtractor: Sprite sheet already loaded');
      return; // Already loaded
    }
    
    console.log('CharacterSpriteExtractor: Loading sprite sheet from /assets/32x32folk.png');
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        console.log('CharacterSpriteExtractor: Sprite sheet loaded successfully', {
          width: img.width,
          height: img.height,
          src: img.src
        });
        this.spriteSheet = img;
        resolve();
      };
      
      img.onerror = (error) => {
        console.error('CharacterSpriteExtractor: Failed to load sprite sheet:', error);
        console.error('CharacterSpriteExtractor: Attempted path:', '/assets/32x32folk.png');
        reject(new Error('Failed to load sprite sheet from /assets/32x32folk.png'));
      };
      
      // Load from public folder
      img.src = '/assets/32x32folk.png';
    });
  }
  
  /**
   * Extract a character sprite by ID
   * Returns the standing pose (middle frame, down direction)
   */
  async extractCharacterSprite(characterId: string): Promise<CharacterSprite> {
    console.log(`CharacterSpriteExtractor: Extracting sprite for ${characterId}`);
    
    try {
      // Ensure sprite sheet is loaded
      await this.loadSpriteSheet();
      
      if (!this.spriteSheet) {
        throw new Error('Sprite sheet not loaded after loadSpriteSheet()');
      }
      
      // Get character position
      const position = this.CHARACTER_POSITIONS[characterId.toLowerCase()];
      if (!position) {
        console.warn(`CharacterSpriteExtractor: Unknown character ID: ${characterId}, defaulting to f1`);
        if (characterId === 'f1') {
          throw new Error('Cannot default to f1 - would cause infinite loop');
        }
        return this.extractCharacterSprite('f1');
      }
      
      console.log(`CharacterSpriteExtractor: Character ${characterId} position:`, position);
      
      // Clear canvas
      this.ctx.clearRect(0, 0, this.SPRITE_SIZE, this.SPRITE_SIZE);
      
      // Extract the standing sprite (middle frame of down direction)
      // Down direction is the first row of the character
      // Middle frame is column + 1
      const sourceX = (position.col + 1) * this.SPRITE_SIZE; // Middle frame
      const sourceY = position.row * this.SPRITE_SIZE; // Down direction
      
      console.log(`CharacterSpriteExtractor: Extracting from (${sourceX}, ${sourceY})`);
      
      // Draw the sprite to canvas
      this.ctx.drawImage(
        this.spriteSheet,
        sourceX, sourceY, // Source position
        this.SPRITE_SIZE, this.SPRITE_SIZE, // Source size
        0, 0, // Destination position
        this.SPRITE_SIZE, this.SPRITE_SIZE // Destination size
      );
      
      // Convert to data URL
      const imageData = this.canvas.toDataURL('image/png');
      
      console.log(`CharacterSpriteExtractor: Successfully extracted sprite for ${characterId}`);
      
      return {
        characterId,
        imageData
      };
    } catch (error) {
      console.error(`CharacterSpriteExtractor: Failed to extract sprite for ${characterId}:`, error);
      throw error;
    }
  }
  
  /**
   * Extract all character sprites (for preloading)
   */
  async extractAllCharacters(): Promise<Map<string, CharacterSprite>> {
    const sprites = new Map<string, CharacterSprite>();
    
    for (const characterId of Object.keys(this.CHARACTER_POSITIONS)) {
      const sprite = await this.extractCharacterSprite(characterId);
      sprites.set(characterId, sprite);
    }
    
    return sprites;
  }
}

// Singleton instance
let extractorInstance: CharacterSpriteExtractor | null = null;

export function getCharacterSpriteExtractor(): CharacterSpriteExtractor {
  if (!extractorInstance) {
    extractorInstance = new CharacterSpriteExtractor();
  }
  return extractorInstance;
}