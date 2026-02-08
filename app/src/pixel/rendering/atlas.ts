import { Rectangle, Texture } from 'pixi.js';

/**
 * Cut a spritesheet into a grid of sub-textures.
 * Works for both tile sheets and character sprite sheets.
 */
export function sliceSpritesheet(
  baseTexture: Texture,
  tileW: number,
  tileH: number = tileW,
): Texture[] {
  const cols = Math.max(1, Math.floor(baseTexture.width / tileW));
  const rows = Math.max(1, Math.floor(baseTexture.height / tileH));
  const out: Texture[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push(
        new Texture({
          source: baseTexture.source,
          frame: new Rectangle(c * tileW, r * tileH, tileW, tileH),
        }),
      );
    }
  }
  return out;
}

/**
 * Extract a single frame from a spritesheet by column and row.
 */
export function getFrame(
  baseTexture: Texture,
  col: number,
  row: number,
  tileW: number,
  tileH: number = tileW,
): Texture {
  return new Texture({
    source: baseTexture.source,
    frame: new Rectangle(col * tileW, row * tileH, tileW, tileH),
  });
}

/** FNV-1a hash → unsigned 32-bit seed */
export function hashToSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 seeded PRNG */
export function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
