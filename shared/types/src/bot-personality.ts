// Bot personality types for the crime metaverse
// Note: BotPersonality enum is defined in Prisma schema
// and should be imported from @prisma/client when needed

// Type matching the Prisma enum values
export type BotPersonalityType = 'CRIMINAL' | 'GAMBLER' | 'WORKER';

export interface PersonalityTraits {
  aggression: number; // 0-1
  greed: number; // 0-1
  loyalty: number; // 0-1
  intelligence: number; // 0-1
  charisma: number; // 0-1
}

export interface ZonePreferences {
  casino: number; // 0-1 preference weight
  darkAlley: number;
  suburb: number;
  downtown: number;
  underground: number;
}

// Personality profiles
// Keys match the BotPersonality enum values from Prisma
export const personalityProfiles: Record<BotPersonalityType, {
  traits: PersonalityTraits;
  zonePreferences: ZonePreferences;
  preferredActivities: string[];
  riskTolerance: number;
}> = {
  CRIMINAL: {
    traits: {
      aggression: 0.8,
      greed: 0.9,
      loyalty: 0.3,
      intelligence: 0.6,
      charisma: 0.5
    },
    zonePreferences: {
      casino: 0.3,
      darkAlley: 0.9,
      suburb: 0.1,
      downtown: 0.4,
      underground: 0.8
    },
    preferredActivities: ['robbery', 'fighting', 'intimidation', 'drug-dealing'],
    riskTolerance: 0.9
  },
  GAMBLER: {
    traits: {
      aggression: 0.3,
      greed: 0.8,
      loyalty: 0.5,
      intelligence: 0.7,
      charisma: 0.8
    },
    zonePreferences: {
      casino: 0.95,
      darkAlley: 0.2,
      suburb: 0.3,
      downtown: 0.6,
      underground: 0.7
    },
    preferredActivities: ['gambling', 'dealing', 'schmoozing', 'betting'],
    riskTolerance: 0.8
  },
  WORKER: {
    traits: {
      aggression: 0.2,
      greed: 0.4,
      loyalty: 0.8,
      intelligence: 0.7,
      charisma: 0.6
    },
    zonePreferences: {
      casino: 0.1,
      darkAlley: 0.05,
      suburb: 0.9,
      downtown: 0.7,
      underground: 0.1
    },
    preferredActivities: ['building', 'trading', 'decorating', 'socializing'],
    riskTolerance: 0.2
  }
};

// Decision making based on personality
export function calculateZoneAttraction(
  personality: BotPersonalityType,
  targetZone: string,
  currentMoney: number,
  currentHealth: number
): number {
  const profile = personalityProfiles[personality];
  const basePreference = profile.zonePreferences[targetZone as keyof ZonePreferences] || 0;
  
  let attraction = basePreference;
  
  // Modify based on current state
  if (personality === 'GAMBLER' && targetZone === 'casino') {
    // Gamblers are more attracted to casinos when they have money
    attraction *= Math.min(2, 1 + currentMoney / 1000);
  }
  
  if (personality === 'CRIMINAL' && targetZone === 'darkAlley') {
    // Criminals avoid alleys when low on health
    attraction *= currentHealth / 100;
  }
  
  if (personality === 'WORKER' && targetZone === 'suburb') {
    // Workers prefer suburbs more when they have money to build
    attraction *= Math.min(1.5, 1 + currentMoney / 5000);
  }
  
  return Math.max(0, Math.min(1, attraction));
}