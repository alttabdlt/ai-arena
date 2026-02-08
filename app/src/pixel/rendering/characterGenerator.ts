import { Assets, Texture } from 'pixi.js';
import { ARCHETYPE_SPRITE } from '../constants';
import { getFrame } from './atlas';

const BASE = '/pixel/modern/characters';

export interface CharacterFrames {
  /** 4 directions x N frames for walk cycle. [dir][frame] */
  walk: Texture[][];
  /** idle frame per direction */
  idle: Texture[];
}

const cache = new Map<string, CharacterFrames>();

/**
 * Modern Interiors character layout (32x32 grid):
 *
 * Run/Idle-anim sheets ({Name}_run_32x32.png, {Name}_idle_anim_32x32.png):
 *   768x64 — single horizontal strip of 24 frames (32x32 cells, 2 rows high but
 *   all frames are in 1 visual row). 4 directions x 6 frames each:
 *   frames 0-5 = down, 6-11 = left, 12-17 = right, 18-23 = up
 *
 * Main sheet ({Name}_32x32.png) — large multi-row spritesheet (row-per-direction).
 */
export async function loadCharacterFrames(archetype: string): Promise<CharacterFrames> {
  const name = ARCHETYPE_SPRITE[archetype] || 'Bob';
  const cacheKey = name;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const runUrl = `${BASE}/${name}_run_32x32.png`;
  const idleUrl = `${BASE}/${name}_idle_anim_32x32.png`;

  const [runTex, idleTex] = await Promise.all([
    Assets.load(runUrl) as Promise<Texture>,
    Assets.load(idleUrl) as Promise<Texture>,
  ]);

  // Force nearest-neighbor
  try { runTex.source.style.scaleMode = 'nearest'; } catch {}
  try { idleTex.source.style.scaleMode = 'nearest'; } catch {}

  const walk: Texture[][] = [];
  const runCols = Math.max(1, Math.floor(runTex.width / 32));
  const runRows = Math.max(1, Math.floor(runTex.height / 32));

  if (runRows < 4) {
    // Horizontal strip layout: all directions packed into columns.
    // 24 frames total → 6 per direction: down(0-5), left(6-11), right(12-17), up(18-23)
    const framesPerDir = Math.max(1, Math.floor(runCols / 4));
    const colOffsets = [0, framesPerDir * 3, framesPerDir, framesPerDir * 2]; // down=0, up=18, left=6, right=12
    for (let di = 0; di < 4; di++) {
      const frames: Texture[] = [];
      const startCol = colOffsets[di];
      for (let f = 0; f < framesPerDir; f++) {
        frames.push(getFrame(runTex, startCol + f, 0, 32, runTex.height));
      }
      walk.push(frames);
    }
  } else {
    // Standard row-per-direction layout: row 0=down, 1=up, 2=left, 3=right
    for (let dir = 0; dir < Math.min(4, runRows); dir++) {
      const frames: Texture[] = [];
      for (let f = 0; f < runCols; f++) {
        frames.push(getFrame(runTex, f, dir, 32, 32));
      }
      walk.push(frames);
    }
    while (walk.length < 4) walk.push(walk[0] || []);
  }

  // Idle anim: same strip layout detection
  const idleCols = Math.max(1, Math.floor(idleTex.width / 32));
  const idleRows = Math.max(1, Math.floor(idleTex.height / 32));
  const idle: Texture[] = [];

  if (idleRows < 4) {
    // Horizontal strip: split into 4 direction groups
    const framesPerDir = Math.max(1, Math.floor(idleCols / 4));
    // Pick first frame of each direction group: down=0, up=3*fpd, left=1*fpd, right=2*fpd
    const colOffsets = [0, framesPerDir * 3, framesPerDir, framesPerDir * 2];
    for (let di = 0; di < 4; di++) {
      idle.push(getFrame(idleTex, colOffsets[di], 0, 32, idleTex.height));
    }
  } else {
    // Standard row layout
    for (let dir = 0; dir < 4; dir++) {
      idle.push(getFrame(idleTex, 0, Math.min(dir, idleRows - 1), 32, 32));
    }
  }

  const result: CharacterFrames = { walk, idle };
  cache.set(cacheKey, result);
  return result;
}

/** Direction index mapping: down=0, up=1, left=2, right=3 */
export function dirIndex(dir: 'down' | 'up' | 'left' | 'right'): number {
  switch (dir) {
    case 'down': return 0;
    case 'up': return 1;
    case 'left': return 2;
    case 'right': return 3;
  }
}

/** Choose direction from a heading vector */
export function headingToDir(hx: number, hy: number): 'down' | 'up' | 'left' | 'right' {
  if (Math.abs(hx) > Math.abs(hy)) {
    return hx > 0 ? 'right' : 'left';
  }
  return hy > 0 ? 'down' : 'up';
}
