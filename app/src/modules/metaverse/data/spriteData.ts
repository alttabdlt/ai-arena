// Sprite sheet data for character animations
// Each character has walking animations in 4 directions

export interface SpriteFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CharacterSprites {
  walkDown: SpriteFrame[];
  walkLeft: SpriteFrame[];
  walkRight: SpriteFrame[];
  walkUp: SpriteFrame[];
}

// Character sprite mappings on the 32x32folk.png sprite sheet
// Each row is a different character, each column is a frame
export const SPRITE_DATA: Record<string, CharacterSprites> = {
  // Criminal character (row 0-3)
  f1: {
    walkDown: [
      { x: 0, y: 0, w: 32, h: 32 },
      { x: 32, y: 0, w: 32, h: 32 },
      { x: 64, y: 0, w: 32, h: 32 }
    ],
    walkLeft: [
      { x: 0, y: 32, w: 32, h: 32 },
      { x: 32, y: 32, w: 32, h: 32 },
      { x: 64, y: 32, w: 32, h: 32 }
    ],
    walkRight: [
      { x: 0, y: 64, w: 32, h: 32 },
      { x: 32, y: 64, w: 32, h: 32 },
      { x: 64, y: 64, w: 32, h: 32 }
    ],
    walkUp: [
      { x: 0, y: 96, w: 32, h: 32 },
      { x: 32, y: 96, w: 32, h: 32 },
      { x: 64, y: 96, w: 32, h: 32 }
    ]
  },
  
  // Gambler character (row 4-7)
  f5: {
    walkDown: [
      { x: 0, y: 128, w: 32, h: 32 },
      { x: 32, y: 128, w: 32, h: 32 },
      { x: 64, y: 128, w: 32, h: 32 }
    ],
    walkLeft: [
      { x: 0, y: 160, w: 32, h: 32 },
      { x: 32, y: 160, w: 32, h: 32 },
      { x: 64, y: 160, w: 32, h: 32 }
    ],
    walkRight: [
      { x: 0, y: 192, w: 32, h: 32 },
      { x: 32, y: 192, w: 32, h: 32 },
      { x: 64, y: 192, w: 32, h: 32 }
    ],
    walkUp: [
      { x: 0, y: 224, w: 32, h: 32 },
      { x: 32, y: 224, w: 32, h: 32 },
      { x: 64, y: 224, w: 32, h: 32 }
    ]
  },
  
  // Worker character (last valid character on sprite sheet)
  // Note: Sprite sheet is 384x256, so max y is 224 (256-32)
  f7: {
    walkDown: [
      { x: 96, y: 0, w: 32, h: 32 },
      { x: 128, y: 0, w: 32, h: 32 },
      { x: 160, y: 0, w: 32, h: 32 }
    ],
    walkLeft: [
      { x: 96, y: 32, w: 32, h: 32 },
      { x: 128, y: 32, w: 32, h: 32 },
      { x: 160, y: 32, w: 32, h: 32 }
    ],
    walkRight: [
      { x: 96, y: 64, w: 32, h: 32 },
      { x: 128, y: 64, w: 32, h: 32 },
      { x: 160, y: 64, w: 32, h: 32 }
    ],
    walkUp: [
      { x: 96, y: 96, w: 32, h: 32 },
      { x: 128, y: 96, w: 32, h: 32 },
      { x: 160, y: 96, w: 32, h: 32 }
    ]
  }
};

// Helper to get random walking direction for idle animation
export function getRandomWalkDirection(): 'walkDown' | 'walkLeft' | 'walkRight' | 'walkUp' {
  const directions = ['walkDown', 'walkLeft', 'walkRight', 'walkUp'] as const;
  return directions[Math.floor(Math.random() * directions.length)];
}