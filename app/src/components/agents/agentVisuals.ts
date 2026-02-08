export const ARCHETYPE_COLORS: Record<string, string> = {
  SHARK: '#ef4444',
  ROCK: '#94a3b8',
  CHAMELEON: '#34d399',
  DEGEN: '#fbbf24',
  GRINDER: '#818cf8',
};

export const ARCHETYPE_GLYPH: Record<string, string> = {
  SHARK: '▲',
  ROCK: '●',
  CHAMELEON: '◆',
  DEGEN: '★',
  GRINDER: '◎',
};

// Body proportion configs per archetype
export interface ArchetypeBodyConfig {
  bodyRadius: number;
  bodyHeight: number;
  legHeight: number;
  legWidth: number;
  armLength: number;
  armWidth: number;
  headRadius: number;
  walkFreq: number;     // Hz for walk animation
  walkAmplitude: number; // swing amplitude
  bobAmplitude: number;  // vertical bob
  roughness: number;
  metalness: number;
}

const DEFAULT_BODY: ArchetypeBodyConfig = {
  bodyRadius: 0.55,
  bodyHeight: 0.9,
  legHeight: 0.7,
  legWidth: 0.28,
  armLength: 0.65,
  armWidth: 0.22,
  headRadius: 0.38,
  walkFreq: 6,
  walkAmplitude: 0.55,
  bobAmplitude: 0.06,
  roughness: 0.35,
  metalness: 0.08,
};

export const ARCHETYPE_BODY: Record<string, ArchetypeBodyConfig> = {
  SHARK: {
    ...DEFAULT_BODY,
    bodyRadius: 0.58,
    walkFreq: 8,
    walkAmplitude: 0.65,
  },
  ROCK: {
    ...DEFAULT_BODY,
    bodyRadius: 0.6,
    legHeight: 0.6,
    walkFreq: 4,
    walkAmplitude: 0.35,
    bobAmplitude: 0.03,
  },
  CHAMELEON: {
    ...DEFAULT_BODY,
    roughness: 0.15,
    metalness: 0.3,
    walkAmplitude: 0.5,
  },
  DEGEN: {
    ...DEFAULT_BODY,
    walkFreq: 7,
    walkAmplitude: 0.7,
    bobAmplitude: 0.12,
  },
  GRINDER: {
    ...DEFAULT_BODY,
    armLength: 0.75,
    walkFreq: 5,
    walkAmplitude: 0.4,
    bobAmplitude: 0.03,
  },
};

export function getBodyConfig(archetype: string): ArchetypeBodyConfig {
  return ARCHETYPE_BODY[archetype] || DEFAULT_BODY;
}
