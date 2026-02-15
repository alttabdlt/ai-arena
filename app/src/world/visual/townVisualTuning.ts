export type ResolvedVisualQuality = 'low' | 'medium' | 'high';
export type VisualQuality = ResolvedVisualQuality | 'auto';

export interface VisualSettings {
  quality: VisualQuality;
  postFx: boolean;
  cameraShake: boolean;
}

export interface VisualProfile {
  key: ResolvedVisualQuality;
  dpr: number | [number, number];
  antialias: boolean;
  powerPreference: 'low-power' | 'high-performance';
  ambientParticleCount: number;
  rainScale: number;
  destinationLineAgentLimit: number;
  trailAgentLimit: number;
  maxTransientEffects: number;
  bloomIntensity: number;
  noiseOpacity: number;
  vignetteOffset: number;
}

export const DEFAULT_VISUAL_SETTINGS: VisualSettings = {
  quality: 'auto',
  postFx: true,
  cameraShake: true,
};

export const QUALITY_ORDER: VisualQuality[] = ['auto', 'high', 'medium', 'low'];

const VISUAL_SETTINGS_KEY = 'town.visualSettings.v1';

export const VISUAL_PROFILES: Record<ResolvedVisualQuality, VisualProfile> = {
  low: {
    key: 'low',
    dpr: 1,
    antialias: false,
    powerPreference: 'low-power',
    ambientParticleCount: 10,
    rainScale: 0.45,
    destinationLineAgentLimit: 10,
    trailAgentLimit: 0,
    maxTransientEffects: 8,
    bloomIntensity: 0.2,
    noiseOpacity: 0.04,
    vignetteOffset: 0.35,
  },
  medium: {
    key: 'medium',
    dpr: [1, 1.25],
    antialias: true,
    powerPreference: 'high-performance',
    ambientParticleCount: 20,
    rainScale: 0.72,
    destinationLineAgentLimit: 20,
    trailAgentLimit: 12,
    maxTransientEffects: 14,
    bloomIntensity: 0.42,
    noiseOpacity: 0.05,
    vignetteOffset: 0.33,
  },
  high: {
    key: 'high',
    dpr: [1, 1.5],
    antialias: true,
    powerPreference: 'high-performance',
    ambientParticleCount: 28,
    rainScale: 1,
    destinationLineAgentLimit: 32,
    trailAgentLimit: 24,
    maxTransientEffects: 20,
    bloomIntensity: 0.6,
    noiseOpacity: 0.06,
    vignetteOffset: 0.3,
  },
};

function parseVisualSettings(value: string | null): VisualSettings {
  if (!value) return DEFAULT_VISUAL_SETTINGS;
  try {
    const parsed = JSON.parse(value) as Partial<VisualSettings>;
    const quality = parsed.quality;
    const safeQuality: VisualQuality =
      quality === 'auto' || quality === 'low' || quality === 'medium' || quality === 'high'
        ? quality
        : DEFAULT_VISUAL_SETTINGS.quality;
    return {
      quality: safeQuality,
      postFx: typeof parsed.postFx === 'boolean' ? parsed.postFx : DEFAULT_VISUAL_SETTINGS.postFx,
      cameraShake:
        typeof parsed.cameraShake === 'boolean' ? parsed.cameraShake : DEFAULT_VISUAL_SETTINGS.cameraShake,
    };
  } catch {
    return DEFAULT_VISUAL_SETTINGS;
  }
}

export function loadVisualSettings(): VisualSettings {
  if (typeof window === 'undefined') return DEFAULT_VISUAL_SETTINGS;
  return parseVisualSettings(window.localStorage.getItem(VISUAL_SETTINGS_KEY));
}

export function saveVisualSettings(settings: VisualSettings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(VISUAL_SETTINGS_KEY, JSON.stringify(settings));
}

export function resolveVisualQuality(
  quality: VisualQuality,
  autoDetected: ResolvedVisualQuality,
): ResolvedVisualQuality {
  if (quality === 'auto') return autoDetected;
  return quality;
}

export function nextVisualQuality(quality: VisualQuality): VisualQuality {
  const idx = QUALITY_ORDER.indexOf(quality);
  if (idx === -1) return QUALITY_ORDER[0];
  return QUALITY_ORDER[(idx + 1) % QUALITY_ORDER.length];
}

export function detectQualityFromFps(fps: number): ResolvedVisualQuality {
  if (fps >= 55) return 'high';
  if (fps >= 40) return 'medium';
  return 'low';
}
