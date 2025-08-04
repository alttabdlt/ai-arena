// BotPersonality enum matching backend schema
export enum BotPersonality {
  CRIMINAL = 'CRIMINAL',
  GAMBLER = 'GAMBLER',
  WORKER = 'WORKER'
}

// Color palettes for different personalities
const PERSONALITY_PALETTES = {
  CRIMINAL: [
    { primary: '#8B0000', secondary: '#2F4F4F', accent: '#FF6347' }, // Dark red, dark gray, tomato
    { primary: '#191970', secondary: '#000080', accent: '#DC143C' }, // Midnight blue, navy, crimson
    { primary: '#2F2F2F', secondary: '#696969', accent: '#B22222' }, // Dark gray, dim gray, firebrick
  ],
  GAMBLER: [
    { primary: '#FFD700', secondary: '#FF8C00', accent: '#FFA500' }, // Gold, dark orange, orange
    { primary: '#9370DB', secondary: '#8A2BE2', accent: '#DA70D6' }, // Medium purple, blue violet, orchid
    { primary: '#20B2AA', secondary: '#00CED1', accent: '#40E0D0' }, // Light sea green, dark turquoise, turquoise
  ],
  WORKER: [
    { primary: '#228B22', secondary: '#32CD32', accent: '#00FF00' }, // Forest green, lime green, lime
    { primary: '#4682B4', secondary: '#5F9EA0', accent: '#87CEEB' }, // Steel blue, cadet blue, sky blue
    { primary: '#8B4513', secondary: '#D2691E', accent: '#DEB887' }, // Saddle brown, chocolate, burlywood
  ],
};

// Accessory types for variation
const ACCESSORIES = {
  CRIMINAL: ['sunglasses', 'scar', 'bandana', 'chain', 'tattoo'],
  GAMBLER: ['hat', 'bowtie', 'cigar', 'dice', 'cards'],
  WORKER: ['hardhat', 'tool', 'vest', 'gloves', 'badge'],
};

export interface SpriteFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpriteAnimation {
  [key: string]: SpriteFrame[];
}

export interface SpritesheetData {
  frames: {
    [key: string]: {
      frame: SpriteFrame;
      rotated: boolean;
      trimmed: boolean;
      spriteSourceSize: SpriteFrame;
      sourceSize: { w: number; h: number };
    };
  };
  animations: SpriteAnimation;
  meta: {
    image: string;
    format: string;
    size: { w: number; h: number };
    scale: string;
  };
}

export class PixelArtGenerator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private spriteSize = 32;
  private frameCount = 4; // 4 frames per direction
  private directions = ['down', 'left', 'right', 'up'];

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.spriteSize * this.frameCount;
    this.canvas.height = this.spriteSize * this.directions.length;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.ctx.imageSmoothingEnabled = false; // Keep pixels crisp
  }

  generateBotSprite(personality: BotPersonality, seed?: string): {
    imageData: string;
    spritesheetData: SpritesheetData;
  } {
    // Use seed for consistent generation if provided
    const random = this.seedRandom(seed || Math.random().toString());
    
    // Select color palette
    const palettes = PERSONALITY_PALETTES[personality];
    const palette = palettes[Math.floor(random() * palettes.length)];
    
    // Select accessories
    const accessories = ACCESSORIES[personality];
    const selectedAccessories = accessories
      .filter(() => random() > 0.5)
      .slice(0, 2); // Max 2 accessories

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Generate sprite for each direction and frame
    for (let dirIndex = 0; dirIndex < this.directions.length; dirIndex++) {
      for (let frame = 0; frame < this.frameCount; frame++) {
        const x = frame * this.spriteSize;
        const y = dirIndex * this.spriteSize;
        
        this.drawCharacter(
          x,
          y,
          palette,
          selectedAccessories,
          this.directions[dirIndex],
          frame,
          random
        );
      }
    }

    // Generate spritesheet data
    const spritesheetData = this.generateSpritesheetData();
    
    // Convert canvas to base64
    const imageData = this.canvas.toDataURL('image/png');

    return {
      imageData,
      spritesheetData,
    };
  }

  private drawCharacter(
    x: number,
    y: number,
    palette: { primary: string; secondary: string; accent: string },
    accessories: string[],
    direction: string,
    frame: number,
    random: () => number
  ) {
    const centerX = x + this.spriteSize / 2;
    const centerY = y + this.spriteSize / 2;

    // Body (simple rectangle for now)
    this.ctx.fillStyle = palette.primary;
    this.ctx.fillRect(centerX - 6, centerY - 4, 12, 12);

    // Head
    this.ctx.fillStyle = '#FDBCB4'; // Skin color
    const headY = centerY - 10;
    this.ctx.fillRect(centerX - 4, headY, 8, 8);

    // Direction-specific features
    if (direction === 'down') {
      // Eyes
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(centerX - 3, headY + 2, 2, 2);
      this.ctx.fillRect(centerX + 1, headY + 2, 2, 2);
    } else if (direction === 'up') {
      // Back of head (hair)
      this.ctx.fillStyle = palette.secondary;
      this.ctx.fillRect(centerX - 4, headY, 8, 4);
    } else {
      // Side view
      const eyeX = direction === 'right' ? centerX + 1 : centerX - 3;
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(eyeX, headY + 2, 2, 2);
    }

    // Arms (with walking animation)
    this.ctx.fillStyle = palette.secondary;
    const armOffset = Math.sin((frame / this.frameCount) * Math.PI * 2) * 2;
    this.ctx.fillRect(centerX - 8, centerY - 2 + armOffset, 3, 6);
    this.ctx.fillRect(centerX + 5, centerY - 2 - armOffset, 3, 6);

    // Legs (with walking animation)
    this.ctx.fillStyle = palette.secondary;
    const legOffset = Math.sin((frame / this.frameCount) * Math.PI * 2) * 3;
    this.ctx.fillRect(centerX - 4, centerY + 8, 3, 4 + legOffset);
    this.ctx.fillRect(centerX + 1, centerY + 8, 3, 4 - legOffset);

    // Draw accessories
    accessories.forEach((accessory) => {
      this.drawAccessory(centerX, centerY, headY, accessory, palette.accent);
    });
  }

  private drawAccessory(
    centerX: number,
    centerY: number,
    headY: number,
    accessory: string,
    color: string
  ) {
    this.ctx.fillStyle = color;

    switch (accessory) {
      case 'sunglasses':
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(centerX - 4, headY + 2, 8, 2);
        break;
      case 'hat':
        this.ctx.fillRect(centerX - 5, headY - 2, 10, 2);
        this.ctx.fillRect(centerX - 3, headY - 4, 6, 2);
        break;
      case 'hardhat':
        this.ctx.fillStyle = '#FFD700';
        this.ctx.fillRect(centerX - 5, headY - 2, 10, 3);
        break;
      case 'chain':
        this.ctx.fillStyle = '#C0C0C0';
        this.ctx.fillRect(centerX - 4, centerY - 4, 8, 1);
        break;
      case 'vest':
        this.ctx.fillRect(centerX - 6, centerY - 4, 12, 8);
        break;
      case 'bandana':
        this.ctx.fillRect(centerX - 4, headY - 1, 8, 2);
        break;
      // Add more accessories as needed
    }
  }

  private generateSpritesheetData(): SpritesheetData {
    const frames: SpritesheetData['frames'] = {};
    const animations: SpriteAnimation = {};

    this.directions.forEach((direction, dirIndex) => {
      animations[direction] = [];
      
      for (let frame = 0; frame < this.frameCount; frame++) {
        const frameName = `${direction}_${frame}`;
        const frameData = {
          x: frame * this.spriteSize,
          y: dirIndex * this.spriteSize,
          w: this.spriteSize,
          h: this.spriteSize,
        };

        frames[frameName] = {
          frame: frameData,
          rotated: false,
          trimmed: false,
          spriteSourceSize: frameData,
          sourceSize: { w: this.spriteSize, h: this.spriteSize },
        };

        animations[direction].push(frameData);
      }
    });

    return {
      frames,
      animations,
      meta: {
        image: 'sprite.png',
        format: 'RGBA8888',
        size: { w: this.canvas.width, h: this.canvas.height },
        scale: '1',
      },
    };
  }

  private seedRandom(seed: string): () => number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return () => {
      hash = (hash * 1103515245 + 12345) & 0x7fffffff;
      return hash / 0x7fffffff;
    };
  }
}

// Helper function to save sprite to file (for server-side generation)
export async function saveSpriteToFile(
  imageData: string,
  filename: string
): Promise<string> {
  // This would be implemented on the server side
  // For now, return the base64 data
  return imageData;
}

// Helper function to generate sprite for a bot
export function generateBotAvatar(
  personality: BotPersonality,
  botId: string
): {
  imageData: string;
  spritesheetData: SpritesheetData;
} {
  const generator = new PixelArtGenerator();
  return generator.generateBotSprite(personality, botId);
}