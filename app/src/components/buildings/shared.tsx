import { useMemo } from 'react';
import * as THREE from 'three';

// ── Types ──────────────────────────────────────────────────────────

export type PlotZone = 'RESIDENTIAL' | 'COMMERCIAL' | 'CIVIC' | 'INDUSTRIAL' | 'ENTERTAINMENT';
export type PlotStatus = 'EMPTY' | 'CLAIMED' | 'UNDER_CONSTRUCTION' | 'BUILT';

export interface Plot {
  id: string;
  plotIndex: number;
  x: number;
  y: number;
  zone: PlotZone;
  status: PlotStatus;
  buildingType?: string | null;
  buildingName?: string | null;
  buildingDesc?: string | null;
  ownerId?: string | null;
  builderId?: string | null;
  apiCallsUsed: number;
  buildCostArena: number;
}

export interface BuildingVariantProps {
  plot: Plot;
  h: number;
  main: THREE.Color;
  accent: THREE.Color;
  selected: boolean;
  variant: number; // 0, 1, or 2
}

// ── Constants ──────────────────────────────────────────────────────

export const ZONE_COLORS: Record<PlotZone, string> = {
  RESIDENTIAL: '#3ee08f',
  COMMERCIAL: '#49a7ff',
  CIVIC: '#ffd166',
  INDUSTRIAL: '#ff8c42',
  ENTERTAINMENT: '#ff4fd8',
};

// ── Seeded random ──────────────────────────────────────────────────

export function hashToSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRandom(plotId: string, extra = '') {
  return mulberry32(hashToSeed(plotId + extra));
}

export function getVariant(plotId: string): number {
  const rng = seededRandom(plotId, ':variant');
  return Math.floor(rng() * 3); // 0, 1, or 2
}

// ── Helpers ────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/** Continuous 0.0–4.0 progress for smooth construction transitions */
export function getTargetProgress(plot: Plot): number {
  if (plot.status === 'BUILT') return 4.0;
  const calls = plot.apiCallsUsed || 0;
  return Math.min(4.0, calls * 0.4); // 0 calls=0.0, 5 calls=2.0, 10 calls=4.0
}

export function buildHeight(plot: Plot) {
  const api = clamp(plot.apiCallsUsed || 0, 0, 20);
  const arena = clamp(plot.buildCostArena || 0, 0, 500);
  return 1.2 + api * 0.08 + Math.log10(1 + arena) * 0.9;
}

export function getConstructionStage(plot: Plot): number {
  if (plot.status === 'BUILT') return 4;
  const calls = plot.apiCallsUsed || 0;
  if (calls <= 1) return 0;
  if (calls <= 3) return 1;
  if (calls <= 6) return 2;
  if (calls <= 9) return 3;
  return 4;
}

export function getColors(plot: Plot, selected: boolean) {
  const tint = new THREE.Color(ZONE_COLORS[plot.zone]);
  const main = tint.clone().multiplyScalar(0.55);
  const accent = tint.clone().multiplyScalar(0.9);
  const emissive = selected ? accent.clone().multiplyScalar(0.28) : undefined;
  return { tint, main, accent, emissive };
}

// ── BuildingWindows (flickering fix: seeded random per plot) ──────

export function BuildingWindows({
  height,
  zone,
  plotId,
}: {
  height: number;
  zone: PlotZone;
  plotId: string;
}) {
  const windowColor = ZONE_COLORS[zone];
  const rows = Math.max(1, Math.floor(height / 1.2));
  const cols = 2;

  const litPattern = useMemo(() => {
    const rng = seededRandom(plotId, ':windows');
    const pattern: boolean[][] = [];
    for (let row = 0; row < rows; row++) {
      pattern[row] = [];
      for (let col = 0; col < cols; col++) {
        pattern[row][col] = rng() > 0.3;
      }
    }
    return pattern;
  }, [plotId, rows, cols]);

  return (
    <group>
      {Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: cols }).map((_, col) => {
          const x = (col - 0.5) * 0.8;
          const y = 0.8 + row * 1.0;
          const z = 1.45;
          const isLit = litPattern[row]?.[col] ?? false;
          return (
            <mesh key={`${row}-${col}`} position={[x, y, z]}>
              <planeGeometry args={[0.4, 0.5]} />
              <meshStandardMaterial
                color={isLit ? windowColor : '#1e293b'}
                emissive={isLit ? windowColor : '#000'}
                emissiveIntensity={isLit ? 0.5 : 0}
                transparent
                opacity={0.9}
              />
            </mesh>
          );
        })
      ).flat()}
    </group>
  );
}
