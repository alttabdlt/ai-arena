import type { Texture } from 'pixi.js';
import type { CharacterFrames } from './characterGenerator';
import { dirIndex } from './characterGenerator';

const WALK_FPS = 10;

/**
 * Given walk distance accumulator and direction, pick the correct texture frame.
 */
export function getWalkFrame(
  frames: CharacterFrames,
  direction: 'down' | 'up' | 'left' | 'right',
  walkAccum: number,
): Texture {
  const di = dirIndex(direction);
  const walkFrames = frames.walk[di];
  if (!walkFrames || walkFrames.length === 0) return frames.idle[di] || frames.idle[0];
  const idx = Math.floor(walkAccum * WALK_FPS) % walkFrames.length;
  return walkFrames[idx];
}

/**
 * Get idle texture for a direction.
 */
export function getIdleFrame(
  frames: CharacterFrames,
  direction: 'down' | 'up' | 'left' | 'right',
): Texture {
  const di = dirIndex(direction);
  return frames.idle[di] || frames.idle[0];
}
