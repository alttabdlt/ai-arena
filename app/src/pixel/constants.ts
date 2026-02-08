import type { PlotZone } from './types';

export const TILE_SIZE = 32;
export const PLOT_TILES = 3;          // Each plot = 3x3 tiles
export const PLOT_PX = TILE_SIZE * PLOT_TILES; // 96px per plot
export const ROAD_PX = TILE_SIZE;      // 1-tile road between plots
export const MAP_MARGIN = 2;           // tiles of margin around grid

export const API_BASE = '/api/v1';

// ── Zone palette (hex numbers for PixiJS) ──
export const ZONE_COLORS: Record<PlotZone, number> = {
  RESIDENTIAL: 0x34d399,
  COMMERCIAL: 0x60a5fa,
  CIVIC: 0xa78bfa,
  INDUSTRIAL: 0xf97316,
  ENTERTAINMENT: 0xfbbf24,
};

export const ZONE_COLORS_CSS: Record<PlotZone, string> = {
  RESIDENTIAL: '#34d399',
  COMMERCIAL: '#60a5fa',
  CIVIC: '#a78bfa',
  INDUSTRIAL: '#f97316',
  ENTERTAINMENT: '#fbbf24',
};

export const ARCHETYPE_COLORS: Record<string, number> = {
  SHARK: 0xef4444,
  ROCK: 0x94a3b8,
  CHAMELEON: 0x34d399,
  DEGEN: 0xfbbf24,
  GRINDER: 0x818cf8,
};

export const ARCHETYPE_COLORS_CSS: Record<string, string> = {
  SHARK: '#ef4444',
  ROCK: '#94a3b8',
  CHAMELEON: '#34d399',
  DEGEN: '#fbbf24',
  GRINDER: '#818cf8',
};

export const ARCHETYPE_GLYPH: Record<string, string> = {
  SHARK: '\u25B2',    // ▲
  ROCK: '\u25CF',     // ●
  CHAMELEON: '\u25C6', // ◆
  DEGEN: '\u2605',    // ★
  GRINDER: '\u25CE',  // ◎
};

/** Maps archetype → Modern Interiors character name */
export const ARCHETYPE_SPRITE: Record<string, string> = {
  SHARK: 'Edward',
  ROCK: 'Bob',
  CHAMELEON: 'Alex',
  DEGEN: 'Dan',
  GRINDER: 'Rob',
};

/** Speed multipliers per archetype */
export const ARCHETYPE_SPEED: Record<string, number> = {
  SHARK: 1.6,
  ROCK: 1.0,
  CHAMELEON: 1.3,
  DEGEN: 1.8,
  GRINDER: 1.2,
};

/** Chat duration range [min, max] seconds per archetype */
export const CHAT_DURATION: Record<string, [number, number]> = {
  SHARK: [2, 3],
  DEGEN: [2, 3],
  ROCK: [3, 4],
  GRINDER: [3, 4],
  CHAMELEON: [4, 6],
};

export const ACTIVITY_INDICATORS: Record<string, { emoji: string; color: string } | null> = {
  WALKING: null,
  IDLE: { emoji: '\uD83D\uDCA4', color: '#94a3b8' },     // 💤
  SHOPPING: { emoji: '\uD83D\uDED2', color: '#34d399' },  // 🛒
  CHATTING: { emoji: '\uD83D\uDCAC', color: '#60a5fa' },  // 💬
  BUILDING: { emoji: '\uD83D\uDD28', color: '#fbbf24' },  // 🔨
  MINING: { emoji: '\u26CF\uFE0F', color: '#f97316' },    // ⛏️
  PLAYING: { emoji: '\uD83C\uDFAE', color: '#a855f7' },   // 🎮
  BEGGING: { emoji: '\uD83D\uDE4F', color: '#9ca3af' },   // 🙏
  SCHEMING: { emoji: '\uD83E\uDD2B', color: '#6366f1' },  // 🤫
  DEAD: { emoji: '\uD83D\uDC80', color: '#ef4444' },      // 💀
};

export const ECONOMIC_INDICATORS: Record<string, { emoji: string; color: string }> = {
  THRIVING: { emoji: '\uD83D\uDC8E', color: '#22d3ee' },   // 💎
  COMFORTABLE: { emoji: '\uD83D\uDE0A', color: '#22c55e' }, // 😊
  STRUGGLING: { emoji: '\uD83D\uDE30', color: '#eab308' },  // 😰
  BROKE: { emoji: '\uD83D\uDE2B', color: '#f97316' },       // 😫
  HOMELESS: { emoji: '\uD83E\uDD7A', color: '#ef4444' },    // 🥺
  DEAD: { emoji: '\uD83D\uDC80', color: '#6b7280' },        // 💀
  RECOVERING: { emoji: '\uD83E\uDE79', color: '#a855f7' },  // 🩹
};

/** Zone → interior tileset filename mapping */
export const ZONE_TILESET: Record<PlotZone, string> = {
  RESIDENTIAL: '2_LivingRoom_32x32.png',
  COMMERCIAL: '16_Grocery_store_32x32.png',
  CIVIC: '13_Conference_Hall_32x32.png',
  INDUSTRIAL: '14_Basement_32x32.png',
  ENTERTAINMENT: '10_Birthday_party_32x32.png',
};
