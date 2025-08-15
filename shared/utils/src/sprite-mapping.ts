/**
 * Maps sprite sheet positions from AI Arena to metaverse character names
 * This ensures consistency between the avatar selected in AI Arena
 * and the sprite displayed in the metaverse
 */

// Use string literal type instead of Prisma enum
export type BotPersonalityType = 'CRIMINAL' | 'GAMBLER' | 'WORKER';

// Map sprite sheet positions (row, col) to metaverse character names
// Based on the 32x32folk.png sprite sheet (8 rows x 12 columns)
// Using a simple mapping where each position gets a unique character assignment
const SPRITE_POSITION_TO_CHARACTER: Record<string, string> = {
  // Row 0 - Top row characters (12 sprites)
  '0,0': 'f1', '0,1': 'f2', '0,2': 'f3', '0,3': 'f4',
  '0,4': 'f5', '0,5': 'f6', '0,6': 'f7', '0,7': 'f8',
  '0,8': 'criminal1', '0,9': 'gambler1', '0,10': 'worker1', '0,11': 'f1',
  
  // Row 1 - Second row characters
  '1,0': 'f2', '1,1': 'f3', '1,2': 'f4', '1,3': 'f5',
  '1,4': 'f6', '1,5': 'f7', '1,6': 'f8', '1,7': 'criminal1',
  '1,8': 'gambler1', '1,9': 'worker1', '1,10': 'f1', '1,11': 'f2',
  
  // Row 2 - Third row characters
  '2,0': 'f3', '2,1': 'f4', '2,2': 'f5', '2,3': 'f6',
  '2,4': 'f7', '2,5': 'f8', '2,6': 'criminal1', '2,7': 'gambler1',
  '2,8': 'worker1', '2,9': 'f1', '2,10': 'f2', '2,11': 'f3',
  
  // Row 3 - Fourth row characters
  '3,0': 'f4', '3,1': 'f5', '3,2': 'f6', '3,3': 'f7',
  '3,4': 'f8', '3,5': 'criminal1', '3,6': 'gambler1', '3,7': 'worker1',
  '3,8': 'f1', '3,9': 'f2', '3,10': 'f3', '3,11': 'f4',
  
  // Row 4 - Fifth row characters
  '4,0': 'f5', '4,1': 'f6', '4,2': 'f7', '4,3': 'f8',
  '4,4': 'criminal1', '4,5': 'gambler1', '4,6': 'worker1', '4,7': 'f1',
  '4,8': 'f2', '4,9': 'f3', '4,10': 'f4', '4,11': 'f5',
  
  // Row 5 - Sixth row characters
  '5,0': 'f6', '5,1': 'f7', '5,2': 'f8', '5,3': 'criminal1',
  '5,4': 'gambler1', '5,5': 'worker1', '5,6': 'f1', '5,7': 'f2',
  '5,8': 'f3', '5,9': 'f4', '5,10': 'f5', '5,11': 'f6',
  
  // Row 6 - Seventh row characters
  '6,0': 'f7', '6,1': 'f8', '6,2': 'criminal1', '6,3': 'gambler1',
  '6,4': 'worker1', '6,5': 'f1', '6,6': 'f2', '6,7': 'f3',
  '6,8': 'f4', '6,9': 'f5', '6,10': 'f6', '6,11': 'f7',
  
  // Row 7 - Bottom row characters
  '7,0': 'f8', '7,1': 'criminal1', '7,2': 'gambler1', '7,3': 'worker1',
  '7,4': 'f1', '7,5': 'f2', '7,6': 'f3', '7,7': 'f4',
  '7,8': 'f5', '7,9': 'f6', '7,10': 'f7', '7,11': 'f8',
};

// Fallback character selections by personality
const PERSONALITY_DEFAULTS: Record<BotPersonalityType, string[]> = {
  CRIMINAL: ['f1', 'f4', 'f7', 'criminal1'],
  GAMBLER: ['f2', 'f5', 'f8', 'gambler1'],
  WORKER: ['f3', 'f6', 'worker1'],
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
  
  // Try to extract from JSON metadata if present
  // Format: {"dataUrl": "data:image/png;base64,...", "position": {"row": 1, "col": 3}}
  try {
    const parsed = JSON.parse(avatarData);
    if (parsed.position && typeof parsed.position.row === 'number' && typeof parsed.position.col === 'number') {
      return {
        row: parsed.position.row,
        col: parsed.position.col
      };
    }
  } catch {
    // Not JSON, continue with other checks
  }
  
  // If it's a data URL, we can't extract position
  if (avatarData.startsWith('data:image')) {
    return null;
  }
  
  return null;
}

/**
 * Encode sprite position with data URL for storage
 */
export function encodeSpriteWithPosition(dataUrl: string, row: number, col: number): string {
  return JSON.stringify({
    dataUrl,
    position: { row, col }
  });
}

/**
 * Decode sprite data to get URL and position
 */
export function decodeSpriteData(avatarData: string): { dataUrl: string; position?: { row: number; col: number } } {
  // Try to parse as JSON with position
  try {
    const parsed = JSON.parse(avatarData);
    if (parsed.dataUrl && parsed.position) {
      return parsed;
    }
  } catch {
    // Not JSON, treat as plain data URL
  }
  
  // If it's a plain data URL
  if (avatarData.startsWith('data:image')) {
    return { dataUrl: avatarData };
  }
  
  // Otherwise return as-is
  return { dataUrl: avatarData };
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
  personality: BotPersonalityType,
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