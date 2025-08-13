// Re-export from shared utils package
import { BotPersonality } from '@prisma/client';
export {
  extractSpritePosition,
  mapSpritePositionToCharacter,
  getMetaverseCharacter,
  isValidMetaverseCharacter
} from '@ai-arena/shared-utils';

// For backwards compatibility with BotPersonality type from Prisma
// (The shared utils uses string literals instead of Prisma enum)
export type { BotPersonalityType } from '@ai-arena/shared-utils';

// Helper function to convert Prisma enum to string type for shared utils
export function convertPersonalityForShared(personality: BotPersonality): string {
  return personality as string;
}