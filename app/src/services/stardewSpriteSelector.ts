// BotPersonality enum matching backend schema
export enum BotPersonality {
  CRIMINAL = 'CRIMINAL',
  GAMBLER = 'GAMBLER',
  WORKER = 'WORKER'
}

// Stardew Valley-style sprite configuration
// Using the actual 32x32folk.png sprite sheet
export interface SpriteConfig {
  id: string;
  name: string;
  personality: BotPersonality;
  characterColumn: number; // Which column in the sprite sheet (0-5)
  characterRow: number; // Which row in the sprite sheet (0-3)
}

export interface SelectedSprite {
  config: SpriteConfig;
  imageData: string; // Base64 image data for storage
  spriteSheetData: {
    frames: Record<string, any>;
    animations: Record<string, string[]>;
  };
}

export class StardewSpriteSelector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private loadedImages: Map<string, HTMLImageElement> = new Map();
  
  // Sprite sheet constants from 32x32folk.png
  private readonly SPRITE_SIZE = 32;
  private readonly FRAMES_PER_DIRECTION = 1; // Each character is a single frame, not animated
  private readonly DIRECTIONS = ['down']; // Only facing down in this sprite sheet
  private readonly SHEET_COLUMNS = 12; // 12 characters per row
  private readonly SHEET_ROWS = 8; // 8 rows of characters

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.ctx.imageSmoothingEnabled = false; // Keep pixels crisp
  }

  // Select a sprite based on personality and optional seed
  async selectSprite(personality: BotPersonality, seed?: string): Promise<SelectedSprite> {
    console.log('StardewSpriteSelector: selectSprite called', { personality, seed });
    
    // Get character position based on personality
    const { col, row } = this.getCharacterPosition(personality, seed || Math.random().toString());
    console.log('StardewSpriteSelector: character position', { col, row });
    
    const config: SpriteConfig = {
      id: `${personality.toLowerCase()}_${col}_${row}`,
      name: `${personality} Character`,
      personality,
      characterColumn: col,
      characterRow: row
    };
    
    // Generate the sprite from the actual sprite sheet
    const sprite = await this.extractCharacterSprite(config);
    
    return {
      config,
      imageData: sprite.imageData,
      spriteSheetData: sprite.spriteSheetData
    };
  }

  // Extract a specific character from the sprite sheet
  private async extractCharacterSprite(config: SpriteConfig): Promise<{
    imageData: string;
    spriteSheetData: any;
  }> {
    console.log('StardewSpriteSelector: extractCharacterSprite called', config);
    
    try {
      // Load the sprite sheet
      console.log('StardewSpriteSelector: Loading sprite sheet from /assets/32x32folk.png');
      const img = await this.loadSpriteSheet('/assets/32x32folk.png');
      console.log('StardewSpriteSelector: Sprite sheet loaded', { width: img.width, height: img.height });
      
      // Set canvas size for a single character sprite
      this.canvas.width = this.SPRITE_SIZE;
      this.canvas.height = this.SPRITE_SIZE;
      console.log('StardewSpriteSelector: Canvas size set', { width: this.canvas.width, height: this.canvas.height });
      
      // Clear canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Calculate source position in sprite sheet
      // Each character is a single 32x32 sprite
      const sourceX = config.characterColumn * this.SPRITE_SIZE;
      const sourceY = config.characterRow * this.SPRITE_SIZE;
      
      console.log('StardewSpriteSelector: Source coordinates', {
        sourceX,
        sourceY,
        sourceWidth: this.SPRITE_SIZE,
        sourceHeight: this.SPRITE_SIZE,
        characterColumn: config.characterColumn,
        characterRow: config.characterRow
      });
      
      // Extract the single character sprite
      this.ctx.drawImage(
        img,
        sourceX, sourceY, // Source position
        this.SPRITE_SIZE, // Source width
        this.SPRITE_SIZE, // Source height
        0, 0, // Destination position
        this.SPRITE_SIZE, // Destination width
        this.SPRITE_SIZE // Destination height
      );
      
      console.log('StardewSpriteSelector: Character extracted to canvas');
      
      // Check if canvas has any content
      const canvasData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      let hasContent = false;
      for (let i = 3; i < canvasData.data.length; i += 4) {
        if (canvasData.data[i] > 0) { // Check alpha channel
          hasContent = true;
          break;
        }
      }
      console.log('StardewSpriteSelector: Canvas has content:', hasContent);
      
      // Generate sprite sheet data for a single static sprite
      const frames: Record<string, any> = {
        'default': {
          frame: {
            x: 0,
            y: 0,
            w: this.SPRITE_SIZE,
            h: this.SPRITE_SIZE
          },
          sourceSize: { w: this.SPRITE_SIZE, h: this.SPRITE_SIZE },
          spriteSourceSize: { x: 0, y: 0 }
        }
      };
      
      const animations: Record<string, string[]> = {
        'default': ['default']
      };
      
      const imageData = this.canvas.toDataURL('image/png');
      console.log('StardewSpriteSelector: Canvas converted to data URL', { 
        dataUrlLength: imageData.length,
        dataUrlPrefix: imageData.substring(0, 50)
      });
      
      return {
        imageData,
        spriteSheetData: {
          frames,
          animations,
          meta: {
            scale: '1',
            format: 'RGBA8888',
            size: { w: this.canvas.width, h: this.canvas.height }
          }
        }
      };
    } catch (error) {
      console.error('StardewSpriteSelector: Failed to extract character sprite:', error);
      // Fallback to colored placeholder
      console.log('StardewSpriteSelector: Using colored placeholder fallback');
      return this.generateColoredPlaceholder(config);
    }
  }

  // Get character position based on personality
  private getCharacterPosition(personality: BotPersonality, seed: string): { col: number; row: number } {
    // Use seed to select specific character within personality group
    const hash = Math.abs(this.hashCode(seed));
    
    switch (personality) {
      case BotPersonality.CRIMINAL:
        // Dark/tough looking characters (rows 1-2)
        const criminalChars = [
          { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 }, { col: 3, row: 1 },
          { col: 4, row: 1 }, { col: 5, row: 1 }, { col: 6, row: 1 }, { col: 7, row: 1 },
          { col: 8, row: 1 }, { col: 9, row: 1 }, { col: 10, row: 1 }, { col: 11, row: 1 },
          { col: 0, row: 2 }, { col: 1, row: 2 }, { col: 2, row: 2 }, { col: 3, row: 2 },
          { col: 4, row: 2 }, { col: 5, row: 2 }, { col: 6, row: 2 }, { col: 7, row: 2 }
        ];
        return criminalChars[hash % criminalChars.length];
        
      case BotPersonality.GAMBLER:
        // Colorful/fancy characters (rows 0 and 4-5)
        const gamblerChars = [
          { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 }, { col: 3, row: 0 },
          { col: 4, row: 0 }, { col: 5, row: 0 }, { col: 6, row: 0 }, { col: 7, row: 0 },
          { col: 8, row: 0 }, { col: 9, row: 0 }, { col: 10, row: 0 }, { col: 11, row: 0 },
          { col: 0, row: 4 }, { col: 1, row: 4 }, { col: 2, row: 4 }, { col: 3, row: 4 },
          { col: 4, row: 4 }, { col: 5, row: 4 }, { col: 6, row: 4 }, { col: 7, row: 4 }
        ];
        return gamblerChars[hash % gamblerChars.length];
        
      case BotPersonality.WORKER:
        // Casual/simple characters (rows 6-7)
        const workerChars = [
          { col: 0, row: 6 }, { col: 1, row: 6 }, { col: 2, row: 6 }, { col: 3, row: 6 },
          { col: 4, row: 6 }, { col: 5, row: 6 }, { col: 6, row: 6 }, { col: 7, row: 6 },
          { col: 8, row: 6 }, { col: 9, row: 6 }, { col: 10, row: 6 }, { col: 11, row: 6 },
          { col: 0, row: 7 }, { col: 1, row: 7 }, { col: 2, row: 7 }, { col: 3, row: 7 },
          { col: 4, row: 7 }, { col: 5, row: 7 }, { col: 6, row: 7 }, { col: 7, row: 7 }
        ];
        return workerChars[hash % workerChars.length];
        
      default:
        return { col: 0, row: 0 };
    }
  }

  // Generate colored placeholder as fallback
  private generateColoredPlaceholder(config: SpriteConfig): {
    imageData: string;
    spriteSheetData: any;
  } {
    console.log('StardewSpriteSelector: Generating colored placeholder', config);
    
    // Set canvas size
    this.canvas.width = this.SPRITE_SIZE * this.FRAMES_PER_DIRECTION;
    this.canvas.height = this.SPRITE_SIZE * this.DIRECTIONS.length;
    
    // Clear canvas first
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    const color = this.getPersonalityColor(config.personality);
    console.log('StardewSpriteSelector: Placeholder color', color);
    
    // Generate sprite sheet data
    const frames: Record<string, any> = {};
    const animations: Record<string, string[]> = {};
    
    this.DIRECTIONS.forEach((direction, dirIndex) => {
      const animFrames: string[] = [];
      
      for (let frame = 0; frame < this.FRAMES_PER_DIRECTION; frame++) {
        const frameName = frame === 0 ? direction : `${direction}${frame + 1}`;
        const x = frame * this.SPRITE_SIZE;
        const y = dirIndex * this.SPRITE_SIZE;
        
        // Draw placeholder character
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x + 8, y + 8, 16, 20);
        
        // Draw head
        this.ctx.fillStyle = '#FFE0BD';
        this.ctx.fillRect(x + 10, y + 4, 12, 12);
        
        frames[frameName] = {
          frame: { x, y, w: this.SPRITE_SIZE, h: this.SPRITE_SIZE },
          sourceSize: { w: this.SPRITE_SIZE, h: this.SPRITE_SIZE },
          spriteSourceSize: { x: 0, y: 0 }
        };
        animFrames.push(frameName);
      }
      
      animations[direction] = animFrames;
    });
    
    const placeholderImageData = this.canvas.toDataURL('image/png');
    console.log('StardewSpriteSelector: Placeholder generated', {
      dataUrlLength: placeholderImageData.length,
      dataUrlPrefix: placeholderImageData.substring(0, 50)
    });
    
    return {
      imageData: placeholderImageData,
      spriteSheetData: {
        frames,
        animations,
        meta: {
          scale: '1',
          format: 'RGBA8888',
          size: { w: this.canvas.width, h: this.canvas.height }
        }
      }
    };
  }

  // Get color based on personality
  private getPersonalityColor(personality: BotPersonality): string {
    switch (personality) {
      case BotPersonality.CRIMINAL:
        return '#8B0000'; // Dark red
      case BotPersonality.GAMBLER:
        return '#FFD700'; // Gold
      case BotPersonality.WORKER:
        return '#228B22'; // Forest green
      default:
        return '#808080'; // Gray
    }
  }

  // Simple hash function for consistent selection
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  // Load sprite sheet image
  async loadSpriteSheet(url: string): Promise<HTMLImageElement> {
    console.log('StardewSpriteSelector: loadSpriteSheet called', { url });
    
    if (this.loadedImages.has(url)) {
      console.log('StardewSpriteSelector: Returning cached image');
      return this.loadedImages.get(url)!;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Allow canvas operations
      img.onload = () => {
        console.log('StardewSpriteSelector: Image loaded successfully', { 
          url, 
          width: img.width, 
          height: img.height 
        });
        this.loadedImages.set(url, img);
        resolve(img);
      };
      img.onerror = (error) => {
        console.error('StardewSpriteSelector: Failed to load image', { url, error });
        reject(new Error(`Failed to load sprite sheet from ${url}`));
      };
      img.src = url;
    });
  }
}