/**
 * worldLayout.ts — Constants & town positioning for the open world.
 *
 * Towns are arranged along a Z-axis highway with slight X jitter.
 * Each town is separated by TOWN_GAP units to feel like distinct settlements.
 */

/** Distance between town centers along the highway (Z axis). */
export const TOWN_GAP = 200;

/** Highway visual constants. */
export const HIGHWAY_WIDTH = 8;
export const HIGHWAY_LANE_WIDTH = 3.5;
export const HIGHWAY_SHOULDER = 0.5;

/** Grid spacing within a single town (kept from Town3D). */
export const TOWN_SPACING = 8;

/** LOD distance thresholds (from camera). */
export const LOD_FULL = 150;
export const LOD_MEDIUM = 300;

export type LODTier = 'full' | 'medium' | 'low';

export interface WorldTown {
  id: string;
  name: string;
  level: number;
  status: string;
  plotCount?: number;
  /** World-space position of the town center. */
  worldX: number;
  worldZ: number;
}

/** Seeded jitter for deterministic X offset per town index. */
function townXJitter(index: number): number {
  // Simple hash-based jitter: ±15 units so the highway isn't perfectly straight.
  let h = 2166136261;
  const s = `town-jitter-${index}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 4294967296 - 0.5) * 30;
}

/**
 * Compute world-space positions for an ordered list of towns.
 * Town 0 is centered at origin; subsequent towns are spaced along +Z.
 */
export function layoutTowns(
  towns: Array<{ id: string; name: string; level: number; status: string; plotCount?: number }>,
): WorldTown[] {
  return towns.map((t, i) => ({
    ...t,
    worldX: townXJitter(i),
    worldZ: i * TOWN_GAP,
  }));
}

/**
 * Get the highway entry/exit points for a town (north and south gates).
 * These are where the highway meets the town perimeter.
 */
export function townGatePositions(town: WorldTown): {
  north: [number, number, number];
  south: [number, number, number];
} {
  const halfGap = TOWN_GAP * 0.45;
  return {
    south: [town.worldX, 0, town.worldZ - halfGap],
    north: [town.worldX, 0, town.worldZ + halfGap],
  };
}

/**
 * Determine LOD tier based on distance from camera to town center.
 */
export function getLODTier(distance: number): LODTier {
  if (distance < LOD_FULL) return 'full';
  if (distance < LOD_MEDIUM) return 'medium';
  return 'low';
}
