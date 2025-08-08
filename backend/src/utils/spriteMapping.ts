import { BotPersonality } from '@prisma/client';

/**
 * Maps sprite sheet positions from AI Arena to metaverse character names
 * This ensures consistency between the avatar selected in AI Arena
 * and the sprite displayed in the metaverse
 */

// Map sprite sheet positions (row, col) to metaverse character names
// Based on the 32x32folk.png sprite sheet used in StardewSpriteSelector
const SPRITE_POSITION_TO_CHARACTER: Record<string, string> = {
  // Row 0 - Gambler characters (colorful/fancy)
  '0,0': 'f2', '0,1': 'f2', '0,2': 'f2', '0,3': 'f5',
  '0,4': 'f5', '0,5': 'f5', '0,6': 'f8', '0,7': 'f8',
  '0,8': 'f8', '0,9': 'gambler1', '0,10': 'gambler1', '0,11': 'gambler1',
  
  // Row 1 - Criminal characters (dark/tough)
  '1,0': 'f1', '1,1': 'f1', '1,2': 'f1', '1,3': 'f4',
  '1,4': 'f4', '1,5': 'f4', '1,6': 'f7', '1,7': 'f7',
  '1,8': 'f7', '1,9': 'criminal1', '1,10': 'criminal1', '1,11': 'criminal1',
  
  // Row 2 - Criminal characters (continued)
  '2,0': 'f1', '2,1': 'f1', '2,2': 'f4', '2,3': 'f4',
  '2,4': 'f7', '2,5': 'f7', '2,6': 'criminal1', '2,7': 'criminal1',
  '2,8': 'f1', '2,9': 'f4', '2,10': 'f7', '2,11': 'criminal1',
  
  // Row 3 - Mixed characters
  '3,0': 'f3', '3,1': 'f3', '3,2': 'f6', '3,3': 'f6',
  '3,4': 'f3', '3,5': 'f6', '3,6': 'f3', '3,7': 'f6',
  '3,8': 'f3', '3,9': 'f6', '3,10': 'f3', '3,11': 'f6',
  
  // Row 4 - Gambler characters
  '4,0': 'f2', '4,1': 'f2', '4,2': 'f5', '4,3': 'f5',
  '4,4': 'f8', '4,5': 'f8', '4,6': 'gambler1', '4,7': 'gambler1',
  '4,8': 'f2', '4,9': 'f5', '4,10': 'f8', '4,11': 'gambler1',
  
  // Row 5 - Mixed characters
  '5,0': 'f2', '5,1': 'f5', '5,2': 'f8', '5,3': 'f1',
  '5,4': 'f4', '5,5': 'f7', '5,6': 'f3', '5,7': 'f6',
  '5,8': 'f2', '5,9': 'f5', '5,10': 'f8', '5,11': 'f1',
  
  // Row 6 - Worker characters (casual/simple)
  '6,0': 'f3', '6,1': 'f3', '6,2': 'f3', '6,3': 'f6',
  '6,4': 'f6', '6,5': 'f6', '6,6': 'worker1', '6,7': 'worker1',
  '6,8': 'worker1', '6,9': 'f3', '6,10': 'f6', '6,11': 'worker1',
  
  // Row 7 - Worker characters (continued)
  '7,0': 'f3', '7,1': 'f3', '7,2': 'f6', '7,3': 'f6',
  '7,4': 'worker1', '7,5': 'worker1', '7,6': 'f3', '7,7': 'f6',
  '7,8': 'worker1', '7,9': 'f3', '7,10': 'f6', '7,11': 'worker1',
};

// Fallback character selections by personality
const PERSONALITY_DEFAULTS: Record<BotPersonality, string[]> = {
  [BotPersonality.CRIMINAL]: ['f1', 'f4', 'f7', 'criminal1'],
  [BotPersonality.GAMBLER]: ['f2', 'f5', 'f8', 'gambler1'],
  [BotPersonality.WORKER]: ['f3', 'f6', 'worker1'],
};

/**
 * Extract sprite position from avatar data URL or sprite ID
 * The StardewSpriteSelector generates IDs like "criminal_3_1" (personality_col_row)
 */
export function extractSpritePosition(avatarData: string): { row: number; col: number } | null {
  // Check if it's a sprite ID (e.g., "criminal_3_1", "gambler_5_0")
  const spriteIdMatch = avatarData.match(/^[a-z]+_(\d+)_(\d+)$/);
  if (spriteIdMatch) {
    return {
      col: parseInt(spriteIdMatch[1], 10),
      row: parseInt(spriteIdMatch[2], 10),
    };
  }
  
  // If it's a data URL, we need to extract metadata
  // The StardewSpriteSelector doesn't embed position in the data URL,
  // so we'll need to handle this differently
  if (avatarData.startsWith('data:image')) {
    // Can't extract position from data URL directly
    // This will be handled by storing the position separately
    return null;
  }
  
  return null;
}

/**
 * Map sprite sheet position to metaverse character name
 */
export function mapSpritePositionToCharacter(row: number, col: number): string | null {
  const key = `${row},${col}`;
  return SPRITE_POSITION_TO_CHARACTER[key] || null;
}

/**
 * Get appropriate metaverse character for a bot based on avatar and personality
 */
export function getMetaverseCharacter(
  avatarData: string | null,
  personality: BotPersonality,
  seed?: string
): string {
  // Try to extract position from avatar data
  if (avatarData) {
    const position = extractSpritePosition(avatarData);
    if (position) {
      const character = mapSpritePositionToCharacter(position.row, position.col);
      if (character) {
        return character;
      }
    }
  }
  
  // Fallback to personality-based selection
  const defaults = PERSONALITY_DEFAULTS[personality];
  if (seed) {
    // Use seed for consistent selection
    const hash = Math.abs(hashCode(seed));
    return defaults[hash % defaults.length];
  }
  
  // Random selection from personality defaults
  return defaults[Math.floor(Math.random() * defaults.length)];
}

/**
 * Simple hash function for consistent selection
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

/**
 * Validate if a character name is valid for the metaverse
 */
export function isValidMetaverseCharacter(character: string): boolean {
  const validCharacters = [
    'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8',
    'criminal1', 'gambler1', 'worker1'
  ];
  return validCharacters.includes(character);
}