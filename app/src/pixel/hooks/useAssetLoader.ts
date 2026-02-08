/**
 * Load all pixel art textures with nearest-neighbor filtering.
 */
import { useState, useEffect, useRef } from 'react';
import { Assets, Texture, Rectangle } from 'pixi.js';
import { ARCHETYPE_SPRITE } from '../constants';
import { loadCharacterFrames, type CharacterFrames } from '../rendering/characterGenerator';

const TILESHEET_URL = '/pixel/tiny-swords/spritesheet.png';
const ROOM_BUILDER_URL = '/pixel/modern/room-builder/Room_Builder_32x32.png';

export interface AssetBundle {
  ready: boolean;
  /** Tiny Swords tile sheet cut into 64x64 tiles */
  tiles: Texture[];
  /** Character frames per archetype */
  characters: Map<string, CharacterFrames>;
  /** Get a tile by index */
  getTile: (id: number) => Texture | null;
  /** Room Builder base texture (2432x3616, 32x32 grid) */
  roomBuilderTexture: Texture | null;
  /** Get a 32x32 sub-texture from Room Builder by grid col/row */
  getRoomTile: (col: number, row: number) => Texture | null;
}

function setNearest(tex: Texture | null) {
  if (!tex) return;
  try { tex.source.style.scaleMode = 'nearest'; } catch {}
}

/** Cache for Room Builder sub-textures */
const roomTileCache = new Map<string, Texture>();

export function useAssetLoader(): AssetBundle {
  const [ready, setReady] = useState(false);
  const tilesRef = useRef<Texture[]>([]);
  const charsRef = useRef<Map<string, CharacterFrames>>(new Map());
  const roomTexRef = useRef<Texture | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // Load Tiny Swords tilesheet + Room Builder in parallel
        const [baseTex, roomTex] = await Promise.all([
          Assets.load(TILESHEET_URL) as Promise<Texture>,
          Assets.load(ROOM_BUILDER_URL) as Promise<Texture>,
        ]);
        setNearest(baseTex);
        setNearest(roomTex);

        // Tiny Swords tiles (64x64)
        const tileSize = 64;
        const cols = Math.max(1, Math.floor(baseTex.width / tileSize));
        const rows = Math.max(1, Math.floor(baseTex.height / tileSize));
        const out: Texture[] = [];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            out.push(new Texture({
              source: baseTex.source,
              frame: new Rectangle(c * tileSize, r * tileSize, tileSize, tileSize),
            }));
          }
        }
        tilesRef.current = out;

        // Room Builder texture
        roomTexRef.current = roomTex;

        // Load character sprites for all archetypes
        const archetypes = Object.keys(ARCHETYPE_SPRITE);
        const charEntries = await Promise.all(
          archetypes.map(async (arch) => {
            const frames = await loadCharacterFrames(arch);
            return [arch, frames] as [string, CharacterFrames];
          }),
        );
        const charMap = new Map(charEntries);
        charsRef.current = charMap;

        if (alive) setReady(true);
      } catch (err) {
        console.error('Failed to load pixel assets:', err);
      }
    })();

    return () => { alive = false; };
  }, []);

  const getTile = (id: number): Texture | null => tilesRef.current[id] ?? null;

  const getRoomTile = (col: number, row: number): Texture | null => {
    const tex = roomTexRef.current;
    if (!tex) return null;
    const key = `${col}:${row}`;
    if (roomTileCache.has(key)) return roomTileCache.get(key)!;
    const sub = new Texture({
      source: tex.source,
      frame: new Rectangle(col * 32, row * 32, 32, 32),
    });
    roomTileCache.set(key, sub);
    return sub;
  };

  return {
    ready,
    tiles: tilesRef.current,
    characters: charsRef.current,
    getTile,
    roomBuilderTexture: roomTexRef.current,
    getRoomTile,
  };
}
