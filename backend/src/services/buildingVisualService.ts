/**
 * Building Visual Skills — Agents browse a sprite library to pick visuals.
 * 
 * Primary skill: BROWSE_LIBRARY
 *   - Agents search the pre-made sprite library
 *   - Pick the best match for their building
 *   - Zero cost, instant, guaranteed quality
 * 
 * Fallback: MINIMAL (emoji only)
 */

import * as spriteLibrary from './spriteLibraryService';

// ============================================================================
// TYPES
// ============================================================================

export type VisualSkill = 'BROWSE_LIBRARY' | 'MINIMAL';

export interface VisualSkillConfig {
  cost: number;
  quality: string;
  speed: 'instant';
  description: string;
}

export interface VisualResult {
  skill: VisualSkill;
  spriteUrl: string | null;
  spriteId: string | null;
  emoji: string;
  cost: number;
  metadata?: {
    spriteName?: string;
    category?: string;
    matchScore?: number;
  };
}

// ============================================================================
// SKILL CONFIGS
// ============================================================================

export const VISUAL_SKILLS: Record<VisualSkill, VisualSkillConfig> = {
  BROWSE_LIBRARY: {
    cost: 0,
    quality: 'curated pixel art from library',
    speed: 'instant',
    description: 'Browse pre-made sprite library and pick best match'
  },
  MINIMAL: {
    cost: 0,
    quality: 'emoji icon only',
    speed: 'instant',
    description: 'Simple emoji, full art in detail panel'
  }
};

// ============================================================================
// EMOJI MAPPING
// ============================================================================

const BUILDING_EMOJIS: Record<string, string> = {
  // Residential
  house: '🏠', cottage: '🏡', mansion: '🏰', home: '🏠', cabin: '🛖',
  
  // Commercial
  shop: '🏪', store: '🏪', tavern: '🍺', inn: '🛏️', market: '🏬',
  bakery: '🥖', butcher: '🥩', blacksmith: '⚒️', merchant: '🏪',
  
  // Industrial
  mine: '⛏️', quarry: '🪨', workshop: '🔧', forge: '🔥',
  factory: '🏭', mill: '🌾', warehouse: '📦',
  
  // Civic
  'town hall': '🏛️', townhall: '🏛️', library: '📚', temple: '⛪',
  church: '⛪', bank: '🏦', school: '🏫', hospital: '🏥', guild: '🛡️',
  
  // Entertainment
  arena: '⚔️', colosseum: '🏟️', theater: '🎭', theatre: '🎭',
  casino: '🎰', circus: '🎪',
  
  // Nature
  farm: '🌾', garden: '🌷', park: '🌳', orchard: '🍎', stable: '🐴',
  
  // Default
  default: '🏗️'
};

function getEmoji(buildingType: string): string {
  const type = buildingType.toLowerCase();
  
  // Direct match
  if (BUILDING_EMOJIS[type]) return BUILDING_EMOJIS[type];
  
  // Partial match
  for (const [key, emoji] of Object.entries(BUILDING_EMOJIS)) {
    if (type.includes(key) || key.includes(type)) {
      return emoji;
    }
  }
  
  return BUILDING_EMOJIS.default;
}

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Execute visual skill for a building
 */
export async function executeVisualSkill(
  skill: VisualSkill,
  buildingType: string,
  buildingName: string,
  _description?: string
): Promise<VisualResult> {
  const emoji = getEmoji(buildingType);
  
  if (skill === 'BROWSE_LIBRARY') {
    // Search sprite library for best match
    const sprite = spriteLibrary.findSpriteForBuilding(buildingType, buildingName);
    
    if (sprite) {
      return {
        skill: 'BROWSE_LIBRARY',
        spriteUrl: sprite.url,
        spriteId: sprite.id,
        emoji,
        cost: 0,
        metadata: {
          spriteName: sprite.name,
          category: sprite.category,
        }
      };
    }
    
    // No sprite found, fall back to minimal
    console.log(`[VisualSkill] No sprite found for ${buildingType}, using emoji`);
  }
  
  // MINIMAL fallback
  return {
    skill: 'MINIMAL',
    spriteUrl: null,
    spriteId: null,
    emoji,
    cost: 0
  };
}

/**
 * Choose visual skill (simplified — always try library first)
 */
export function chooseVisualSkill(): VisualSkill {
  // Check if library has sprites
  const stats = spriteLibrary.getCatalogStats();
  return stats.total > 0 ? 'BROWSE_LIBRARY' : 'MINIMAL';
}

/**
 * Get available skills
 */
export function getAvailableSkills(): Record<VisualSkill, VisualSkillConfig> {
  return VISUAL_SKILLS;
}

/**
 * Browse library directly (for agent reasoning)
 */
export function browseLibrary(options?: {
  category?: string;
  tags?: string[];
  searchText?: string;
}) {
  return spriteLibrary.browseSprites(options as any);
}

/**
 * Get library stats
 */
export function getLibraryStats() {
  return spriteLibrary.getCatalogStats();
}
