/**
 * agentAssignment.ts — Multi-town agent distribution and travel logic.
 *
 * Assigns agents to towns and manages inter-town travel state.
 */
import type { WorldTown } from './worldLayout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentTownAssignment {
  agentId: string;
  townId: string;
  /** 'RESIDENT' = currently in a town, 'TRAVELING' = walking the highway between towns. */
  state: 'RESIDENT' | 'TRAVELING';
  /** If TRAVELING, the destination town. */
  travelToTownId?: string;
  /** Travel progress 0..1 */
  travelProgress: number;
  /** World-space position while traveling (interpolated along highway). */
  travelX: number;
  travelZ: number;
}

// ---------------------------------------------------------------------------
// Seeded RNG (matches Town3D's mulberry32)
// ---------------------------------------------------------------------------

function hashToSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Agent assignment
// ---------------------------------------------------------------------------

/**
 * Assign agents to towns using deterministic seeded distribution.
 * Each agent is assigned to one town based on a hash of their ID.
 * Active (non-COMPLETE) towns get more agents.
 */
export function assignAgentsToTowns(
  agentIds: string[],
  worldTowns: WorldTown[],
): Map<string, AgentTownAssignment> {
  const assignments = new Map<string, AgentTownAssignment>();
  if (worldTowns.length === 0) return assignments;

  for (const agentId of agentIds) {
    const rng = mulberry32(hashToSeed(`assign:${agentId}`));
    // Weight active towns higher
    const weights = worldTowns.map((t) =>
      t.status === 'ACTIVE' || t.status === 'BUILDING' ? 3 : 1,
    );
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let roll = rng() * totalWeight;
    let townIdx = 0;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        townIdx = i;
        break;
      }
    }
    const town = worldTowns[townIdx];
    assignments.set(agentId, {
      agentId,
      townId: town.id,
      state: 'RESIDENT',
      travelProgress: 0,
      travelX: town.worldX,
      travelZ: town.worldZ,
    });
  }

  return assignments;
}

/**
 * Tick travel logic: ~3% chance per minute that an idle agent decides to visit another town.
 * Called each frame with dt in seconds.
 */
export function tickTravel(
  assignments: Map<string, AgentTownAssignment>,
  worldTowns: WorldTown[],
  dt: number,
): void {
  if (worldTowns.length < 2) return;

  const townById = new Map(worldTowns.map((t) => [t.id, t]));

  for (const [agentId, a] of assignments) {
    if (a.state === 'TRAVELING') {
      // Advance travel: highway speed ~15 units/sec
      const dest = townById.get(a.travelToTownId!);
      const src = townById.get(a.townId);
      if (!dest || !src) {
        a.state = 'RESIDENT';
        continue;
      }

      const dx = dest.worldX - src.worldX;
      const dz = dest.worldZ - src.worldZ;
      const totalDist = Math.sqrt(dx * dx + dz * dz);
      const speed = 15 / Math.max(1, totalDist);
      a.travelProgress += speed * dt;

      // Interpolate position
      const t = Math.min(1, a.travelProgress);
      a.travelX = src.worldX + dx * t;
      a.travelZ = src.worldZ + dz * t;

      if (t >= 1) {
        // Arrived
        a.townId = dest.id;
        a.state = 'RESIDENT';
        a.travelProgress = 0;
        a.travelX = dest.worldX;
        a.travelZ = dest.worldZ;
        a.travelToTownId = undefined;
      }
    } else {
      // RESIDENT: small chance to start traveling
      // ~3% per minute = 0.03/60 per second = 0.0005 per second
      const chancePerSec = 0.0005;
      if (Math.random() < chancePerSec * dt) {
        const rng = mulberry32(hashToSeed(`travel:${agentId}:${Date.now()}`));
        const otherTowns = worldTowns.filter((t) => t.id !== a.townId);
        if (otherTowns.length > 0) {
          const dest = otherTowns[Math.floor(rng() * otherTowns.length)];
          a.state = 'TRAVELING';
          a.travelToTownId = dest.id;
          a.travelProgress = 0;
          const src = townById.get(a.townId);
          if (src) {
            a.travelX = src.worldX;
            a.travelZ = src.worldZ;
          }
        }
      }
    }
  }
}
