/**
 * PixiJS Application wrapper for the pixel town.
 * Renders the world container with camera transforms.
 *
 * Performance strategy:
 * - Static world (terrain, roads, buildings, decorations) rendered via JSX
 * - Agent positions + sprites updated IMPERATIVELY in useTick for 60fps smoothness
 * - Shadows batched into single Graphics layers
 * - Decorations kept sparse (only along plot edges)
 */
import { useEffect, useRef, useCallback } from 'react';
import { Application, extend, useApplication, useTick } from '@pixi/react';
import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { CameraState } from '../hooks/usePixelCamera';
import type { AgentSim2D, Plot, Agent, PlotZone } from '../types';
import type { AssetBundle } from '../hooks/useAssetLoader';
import { getEconomicState } from '../types';
import {
  TILE_SIZE, PLOT_PX, ROAD_PX, ZONE_COLORS, ARCHETYPE_COLORS, ARCHETYPE_GLYPH,
  ACTIVITY_INDICATORS, ECONOMIC_INDICATORS,
} from '../constants';
import { hashToSeed, mulberry32 } from '../rendering/atlas';
import { getWalkFrame, getIdleFrame } from '../rendering/spriteAnimator';
import { playSound } from '../../utils/sounds';

extend({ Container, Graphics, Sprite, Text });

// Tile IDs from Tiny Swords
const GRASS_TILES = [156, 157, 158, 159, 160, 161, 162, 163, 164];
const SAND_TILES = [177, 178, 179, 180, 181, 182, 183, 184, 185, 186];
const ROCK_TILES = [165, 166, 167, 168, 169, 170, 171, 172, 173];

// Tree/bush tile IDs from Tiny Swords (64x64)
const TREE_TILES = [16, 17, 18, 19, 24, 25, 26, 27];

function zoneToTileIds(zone: PlotZone): number[] {
  switch (zone) {
    case 'COMMERCIAL': case 'ENTERTAINMENT': return SAND_TILES;
    case 'INDUSTRIAL': return ROCK_TILES;
    default: return GRASS_TILES;
  }
}

interface WorldSceneProps {
  plots: Plot[];
  agents: Agent[];
  simsRef: React.MutableRefObject<Map<string, AgentSim2D>>;
  assets: AssetBundle;
  camera: CameraState;
  selectedPlotId: string | null;
  selectedAgentId: string | null;
  onSelectPlot: (id: string | null) => void;
  onSelectAgent: (id: string | null) => void;
  tradeByAgentId: Record<string, { text: string; until: number; isBuy: boolean }>;
  weather: 'clear' | 'rain' | 'storm';
  economicState: { pollution: number; prosperity: number; sentiment: 'bull' | 'bear' | 'neutral' };
  tickSim: (dt: number) => void;
  dayNightTint: number;
  dayNightAlpha: number;
  updateFollow: (positions: Map<string, { x: number; y: number }>) => void;
}

export function WorldScene({
  plots, agents, simsRef, assets, camera,
  selectedPlotId, selectedAgentId, onSelectPlot, onSelectAgent,
  tradeByAgentId, weather, economicState,
  tickSim, dayNightTint, dayNightAlpha, updateFollow,
}: WorldSceneProps) {
  const { app } = useApplication();
  const worldRef = useRef<Container>(null);
  const rainRef = useRef<{ x: number; y: number; speed: number }[]>([]);

  // Refs for imperative agent updates
  const agentContainersRef = useRef<Map<string, Container>>(new Map());
  const agentSpritesRef = useRef<Map<string, Sprite>>(new Map());

  // Compute world bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of plots) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX)) { minX = 0; maxX = 0; minY = 0; maxY = 0; }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Initialize rain particles
  useEffect(() => {
    rainRef.current = Array.from({ length: 200 }, () => ({
      x: Math.random() * 2000 - 1000,
      y: Math.random() * 1200 - 600,
      speed: 4 + Math.random() * 6,
    }));
  }, []);

  // Main tick: sim + camera + imperative agent updates
  useTick(({ deltaTime }) => {
    const dt = deltaTime / 60;
    tickSim(dt);

    // Camera follow
    const positions = new Map<string, { x: number; y: number }>();
    for (const [id, sim] of simsRef.current) positions.set(id, { x: sim.x, y: sim.y });
    updateFollow(positions);

    // Apply camera transform
    if (worldRef.current) {
      const w = app.renderer.width;
      const h = app.renderer.height;
      worldRef.current.x = w / 2 - camera.x * camera.zoom;
      worldRef.current.y = h / 2 - camera.y * camera.zoom;
      worldRef.current.scale.set(camera.zoom);
    }

    // Imperatively update agent positions + sprites every frame
    for (const a of agents) {
      const sim = simsRef.current.get(a.id);
      const container = agentContainersRef.current.get(a.id);
      if (!sim || !container) continue;

      // Smooth position update
      container.x = sim.x;
      container.y = sim.y;
      container.zIndex = Math.floor(sim.y);

      // Update sprite texture for animation
      const sprite = agentSpritesRef.current.get(a.id);
      const charFrames = assets.characters.get(a.archetype);
      if (sprite && charFrames) {
        if (sim.state === 'WALKING') {
          sprite.texture = getWalkFrame(charFrames, sim.direction, sim.walk);
        } else {
          sprite.texture = getIdleFrame(charFrames, sim.direction);
        }
      }
    }
  });

  // Build plot lookup
  const plotByKey = new Map<string, Plot>();
  for (const p of plots) plotByKey.set(`${p.x}:${p.y}`, p);

  const gridSpan = PLOT_PX + ROAD_PX;

  // Sparse decorations — only along plot edges (not filling empty cells)
  const decorations: { x: number; y: number; tileId: number; scale: number }[] = [];
  {
    const rng = mulberry32(hashToSeed('deco:global'));
    for (const p of plots) {
      const wx = (p.x - centerX) * gridSpan;
      const wy = (p.y - centerY) * gridSpan;
      // 1-2 decorations per plot
      for (let d = 0; d < 2; d++) {
        if (rng() > 0.55) continue;
        const side = Math.floor(rng() * 4);
        const offset = (rng() - 0.5) * PLOT_PX * 0.6;
        let dx = 0, dy = 0;
        if (side === 0) { dx = offset; dy = -PLOT_PX / 2 - ROAD_PX * 0.3; }
        else if (side === 1) { dx = offset; dy = PLOT_PX / 2 + ROAD_PX * 0.3; }
        else if (side === 2) { dx = -PLOT_PX / 2 - ROAD_PX * 0.3; dy = offset; }
        else { dx = PLOT_PX / 2 + ROAD_PX * 0.3; dy = offset; }
        const tileId = TREE_TILES[Math.floor(rng() * TREE_TILES.length)];
        const scale = 0.25 + rng() * 0.3;
        decorations.push({ x: wx + dx, y: wy + dy, tileId, scale });
      }
    }
  }

  // Ref callbacks for agent containers + sprites
  const setAgentContainerRef = useCallback((id: string, node: Container | null) => {
    if (node) agentContainersRef.current.set(id, node);
    else agentContainersRef.current.delete(id);
  }, []);
  const setAgentSpriteRef = useCallback((id: string, node: Sprite | null) => {
    if (node) agentSpritesRef.current.set(id, node);
    else agentSpritesRef.current.delete(id);
  }, []);

  return (
    <>
      <pixiContainer ref={worldRef as any} sortableChildren>
        {/* ── Terrain tiles ── */}
        {plots.map((p) => {
          const wx = (p.x - centerX) * gridSpan;
          const wy = (p.y - centerY) * gridSpan;
          const rng = mulberry32(hashToSeed(`tile:${p.x}:${p.y}`));
          const tileIds = zoneToTileIds(p.zone);
          const tiles: { tex: Texture | null; px: number; py: number }[] = [];

          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
              const tileId = tileIds[Math.floor(rng() * tileIds.length)];
              tiles.push({
                tex: assets.getTile(tileId),
                px: wx + c * TILE_SIZE - PLOT_PX / 2 + TILE_SIZE / 2,
                py: wy + r * TILE_SIZE - PLOT_PX / 2 + TILE_SIZE / 2,
              });
            }
          }

          return tiles.map((t, i) =>
            t.tex ? (
              <pixiSprite
                key={`t-${p.id}-${i}`}
                texture={t.tex}
                x={t.px}
                y={t.py}
                anchor={0.5}
                scale={{ x: TILE_SIZE / 64, y: TILE_SIZE / 64 }}
                zIndex={-1000}
              />
            ) : null,
          );
        })}

        {/* ── Roads + shadows (single batched Graphics) ── */}
        <pixiGraphics
          draw={(g: Graphics) => {
            g.clear();
            const roadColor = 0x2a3142;
            const roadEdge = 0x3d4a5e;

            // Horizontal roads
            for (let iy = minY; iy <= maxY; iy++) {
              const wy = (iy - centerY) * gridSpan + PLOT_PX / 2;
              const wx1 = (minX - centerX) * gridSpan - PLOT_PX / 2 - ROAD_PX;
              const totalW = (maxX - minX + 1) * gridSpan + ROAD_PX;
              g.setFillStyle({ color: roadColor, alpha: 0.9 });
              g.rect(wx1, wy, totalW, ROAD_PX); g.fill();
              g.setFillStyle({ color: roadEdge, alpha: 0.4 });
              g.rect(wx1, wy, totalW, 2); g.fill();
              g.rect(wx1, wy + ROAD_PX - 2, totalW, 2); g.fill();
            }
            // Vertical roads
            for (let ix = minX; ix <= maxX; ix++) {
              const wx = (ix - centerX) * gridSpan + PLOT_PX / 2;
              const wy1 = (minY - centerY) * gridSpan - PLOT_PX / 2 - ROAD_PX;
              const totalH = (maxY - minY + 1) * gridSpan + ROAD_PX;
              g.setFillStyle({ color: roadColor, alpha: 0.9 });
              g.rect(wx, wy1, ROAD_PX, totalH); g.fill();
              g.setFillStyle({ color: roadEdge, alpha: 0.4 });
              g.rect(wx, wy1, 2, totalH); g.fill();
              g.rect(wx + ROAD_PX - 2, wy1, 2, totalH); g.fill();
            }
            // Intersection dots
            g.setFillStyle({ color: 0x4a5568, alpha: 0.5 });
            for (let ix = minX; ix <= maxX; ix++) {
              for (let iy = minY; iy <= maxY; iy++) {
                const cx = (ix - centerX) * gridSpan + PLOT_PX / 2 + ROAD_PX / 2;
                const cy = (iy - centerY) * gridSpan + PLOT_PX / 2 + ROAD_PX / 2;
                g.circle(cx, cy, 3); g.fill();
              }
            }
            // Ring road
            const rx1 = (minX - centerX) * gridSpan - PLOT_PX / 2 - ROAD_PX * 2;
            const ry1 = (minY - centerY) * gridSpan - PLOT_PX / 2 - ROAD_PX * 2;
            const rw = (maxX - minX + 1) * gridSpan + ROAD_PX * 4;
            const rh = (maxY - minY + 1) * gridSpan + ROAD_PX * 4;
            g.setFillStyle({ color: 0x1e2738, alpha: 0.9 });
            g.rect(rx1, ry1, rw, ROAD_PX); g.fill();
            g.rect(rx1, ry1 + rh - ROAD_PX, rw, ROAD_PX); g.fill();
            g.rect(rx1, ry1, ROAD_PX, rh); g.fill();
            g.rect(rx1 + rw - ROAD_PX, ry1, ROAD_PX, rh); g.fill();
            g.setFillStyle({ color: roadEdge, alpha: 0.3 });
            g.rect(rx1, ry1, rw, 2); g.fill();
            g.rect(rx1, ry1 + rh - 2, rw, 2); g.fill();
            g.rect(rx1, ry1, 2, rh); g.fill();
            g.rect(rx1 + rw - 2, ry1, 2, rh); g.fill();

            // ── Batched building shadows ──
            g.setFillStyle({ color: 0x000000, alpha: 0.12 });
            for (const p of plots) {
              if (p.status === 'BUILT' || p.status === 'UNDER_CONSTRUCTION') {
                const wx = (p.x - centerX) * gridSpan;
                const wy = (p.y - centerY) * gridSpan;
                g.ellipse(wx, wy + PLOT_PX / 2 + 3, PLOT_PX * 0.38, 7); g.fill();
              }
            }
            // ── Batched decoration shadows ──
            g.setFillStyle({ color: 0x000000, alpha: 0.08 });
            for (const d of decorations) {
              g.ellipse(d.x, d.y + 12 * d.scale, 12 * d.scale, 3 * d.scale); g.fill();
            }
          }}
          zIndex={-500}
        />

        {/* ── Plot zone overlays + buildings ── */}
        {plots.map((p) => {
          const wx = (p.x - centerX) * gridSpan;
          const wy = (p.y - centerY) * gridSpan;
          const selected = p.id === selectedPlotId;
          const zoneColor = ZONE_COLORS[p.zone];
          const buildingZIndex = Math.floor(wy + PLOT_PX / 2);

          return (
            <pixiContainer key={`plot-${p.id}`} zIndex={buildingZIndex}>
              {/* Zone tint overlay */}
              <pixiGraphics
                eventMode="static"
                cursor="pointer"
                onPointerDown={() => { onSelectPlot(p.id); playSound('click'); }}
                draw={(g: Graphics) => {
                  g.clear();
                  g.setFillStyle({ color: zoneColor, alpha: p.status === 'BUILT' ? 0.12 : 0.08 });
                  g.rect(wx - PLOT_PX / 2, wy - PLOT_PX / 2, PLOT_PX, PLOT_PX); g.fill();
                  if (selected) {
                    g.setStrokeStyle({ color: 0xffffff, width: 2, alpha: 0.9 });
                    g.rect(wx - PLOT_PX / 2, wy - PLOT_PX / 2, PLOT_PX, PLOT_PX); g.stroke();
                  }
                }}
              />

              {/* Claimed: flag */}
              {p.status === 'CLAIMED' && (
                <pixiGraphics draw={(g: Graphics) => {
                  g.clear();
                  g.setFillStyle({ color: 0x8b5a2b });
                  g.rect(wx + PLOT_PX / 2 - 12, wy - PLOT_PX / 2 + 4, 3, 28); g.fill();
                  g.setFillStyle({ color: zoneColor, alpha: 0.9 });
                  g.rect(wx + PLOT_PX / 2 - 9, wy - PLOT_PX / 2 + 4, 16, 10); g.fill();
                }} />
              )}

              {/* Under construction: scaffold + progress */}
              {p.status === 'UNDER_CONSTRUCTION' && (
                <pixiGraphics draw={(g: Graphics) => {
                  g.clear();
                  const progress = Math.min(1, (p.apiCallsUsed || 0) / 5);
                  const bh = PLOT_PX * 0.6 * Math.max(0.2, progress);
                  g.setFillStyle({ color: 0x6b7280, alpha: 0.4 });
                  g.rect(wx - PLOT_PX * 0.3, wy + PLOT_PX / 2 - bh - 4, PLOT_PX * 0.6, bh); g.fill();
                  g.setStrokeStyle({ color: 0x9ca3af, alpha: 0.5, width: 1 });
                  g.moveTo(wx - PLOT_PX * 0.3, wy + PLOT_PX / 2 - bh - 4);
                  g.lineTo(wx + PLOT_PX * 0.3, wy + PLOT_PX / 2 - 4); g.stroke();
                  g.moveTo(wx + PLOT_PX * 0.3, wy + PLOT_PX / 2 - bh - 4);
                  g.lineTo(wx - PLOT_PX * 0.3, wy + PLOT_PX / 2 - 4); g.stroke();
                  g.setFillStyle({ color: 0x1f2937 });
                  g.rect(wx - PLOT_PX * 0.35, wy + PLOT_PX / 2 + 2, PLOT_PX * 0.7, 6); g.fill();
                  g.setFillStyle({ color: zoneColor });
                  g.rect(wx - PLOT_PX * 0.35, wy + PLOT_PX / 2 + 2, PLOT_PX * 0.7 * progress, 6); g.fill();
                }} />
              )}

              {/* Built: procedural building (single Graphics — no facade tiles) */}
              {p.status === 'BUILT' && (
                <pixiGraphics draw={(g: Graphics) => {
                  g.clear();
                  const localRng = mulberry32(hashToSeed(`bld:${p.id}`));
                  const bw = PLOT_PX * 0.65;
                  const bh = PLOT_PX * (0.45 + localRng() * 0.25);
                  const bodyTop = wy + PLOT_PX / 2 - bh - 4;
                  // Building body
                  g.setFillStyle({ color: zoneColor, alpha: 0.45 });
                  g.roundRect(wx - bw / 2, bodyTop, bw, bh, 3); g.fill();
                  // Darker base
                  g.setFillStyle({ color: 0x000000, alpha: 0.15 });
                  g.roundRect(wx - bw / 2, bodyTop + bh * 0.6, bw, bh * 0.4, 3); g.fill();
                  // Border
                  g.setStrokeStyle({ color: zoneColor, alpha: 0.7, width: 1.5 });
                  g.roundRect(wx - bw / 2, bodyTop, bw, bh, 3); g.stroke();
                  // Windows
                  const cols = 2 + Math.floor(localRng() * 2);
                  const rows = 1 + Math.floor(localRng() * 2);
                  const winW = 8, winH = 8, gap = 4;
                  const startX = wx - ((cols * (winW + gap) - gap) / 2);
                  const startY = bodyTop + 8;
                  for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                      const lit = localRng() > 0.3;
                      g.setFillStyle({ color: lit ? 0xfbbf24 : 0x374151, alpha: lit ? 0.6 + localRng() * 0.3 : 0.4 });
                      g.rect(startX + c * (winW + gap), startY + r * (winH + gap + 2), winW, winH); g.fill();
                    }
                  }
                  // Door
                  g.setFillStyle({ color: 0x4b2e14, alpha: 0.8 });
                  g.roundRect(wx - 5, bodyTop + bh - 14, 10, 14, 2); g.fill();
                  // Roof
                  g.setFillStyle({ color: zoneColor, alpha: 0.55 });
                  g.rect(wx - bw / 2 - 3, bodyTop - 4, bw + 6, 5); g.fill();
                  // Chimney
                  if (localRng() > 0.5) {
                    g.setFillStyle({ color: 0x6b7280, alpha: 0.7 });
                    g.rect(wx + bw / 4, bodyTop - 14, 8, 14); g.fill();
                  }
                }} />
              )}

              {/* Plot label */}
              <pixiText
                text={(p.buildingName || p.zone).slice(0, 12)}
                x={wx} y={wy - PLOT_PX / 2 - 8}
                anchor={{ x: 0.5, y: 1 }}
                style={{ fontFamily: 'monospace', fontSize: 9, fill: selected ? 0xffffff : 0x94a3b8, stroke: { color: 0x050914, width: 2 } }}
              />
            </pixiContainer>
          );
        })}

        {/* ── Decorations (just sprites, shadows are batched above) ── */}
        {decorations.map((d, i) => {
          const tex = assets.getTile(d.tileId);
          if (!tex) return null;
          return (
            <pixiSprite
              key={`deco-${i}`}
              texture={tex}
              x={d.x} y={d.y}
              anchor={{ x: 0.5, y: 0.85 }}
              scale={{ x: d.scale, y: d.scale }}
              zIndex={Math.floor(d.y)}
            />
          );
        })}

        {/* ── Agents (containers positioned imperatively in useTick) ── */}
        {agents.map((a) => {
          const sim = simsRef.current.get(a.id);
          if (!sim || sim.state === 'DEAD') return null;
          const archColor = ARCHETYPE_COLORS[a.archetype] || 0x93c5fd;
          const glyph = ARCHETYPE_GLYPH[a.archetype] || '\u25CF';
          const selected = a.id === selectedAgentId;
          const charFrames = assets.characters.get(a.archetype);
          const econ = getEconomicState(a.bankroll + a.reserveBalance, false);
          const econInd = ECONOMIC_INDICATORS[econ];
          const actInd = ACTIVITY_INDICATORS[sim.state];
          const trade = tradeByAgentId[a.id];
          const tintMod = econ === 'THRIVING' ? 1.0 : econ === 'COMFORTABLE' ? 1.0 :
            econ === 'STRUGGLING' ? 0.85 : econ === 'BROKE' ? 0.7 : econ === 'HOMELESS' ? 0.5 : 1.0;

          // Initial texture (will be updated imperatively)
          let charTex: Texture | null = null;
          if (charFrames) {
            charTex = sim.state === 'WALKING'
              ? getWalkFrame(charFrames, sim.direction, sim.walk)
              : getIdleFrame(charFrames, sim.direction);
          }

          return (
            <pixiContainer
              key={`agent-${a.id}`}
              ref={(node: any) => setAgentContainerRef(a.id, node)}
              x={sim.x} y={sim.y}
              eventMode="static"
              cursor="pointer"
              onPointerDown={() => { onSelectAgent(a.id); onSelectPlot(null); playSound('click'); }}
              zIndex={Math.floor(sim.y)}
            >
              {/* Shadow */}
              <pixiGraphics draw={(g: Graphics) => {
                g.clear();
                g.setFillStyle({ color: 0x000000, alpha: 0.15 });
                g.ellipse(0, 4, 10, 4); g.fill();
              }} />

              {charTex ? (
                <pixiSprite
                  ref={(node: any) => setAgentSpriteRef(a.id, node)}
                  texture={charTex}
                  anchor={{ x: 0.5, y: 0.85 }}
                  scale={{ x: 1.2, y: 1.2 }}
                  tint={tintMod < 1 ? 0x888888 : 0xffffff}
                />
              ) : (
                <pixiGraphics draw={(g: Graphics) => {
                  g.clear();
                  g.setFillStyle({ color: archColor, alpha: 0.95 });
                  g.circle(0, 0, selected ? 10 : 8); g.fill();
                }} />
              )}

              {/* Nameplate */}
              <pixiText
                text={`${glyph} ${a.name.slice(0, 10)}`}
                x={0} y={-28} anchor={{ x: 0.5, y: 1 }}
                style={{ fontFamily: 'monospace', fontSize: 8, fill: selected ? 0xffffff : 0xcbd5e1, stroke: { color: 0x050914, width: 2 } }}
              />

              {actInd && (
                <pixiText text={actInd.emoji} x={0} y={-36} anchor={0.5} style={{ fontSize: 12 }} />
              )}

              {econ !== 'COMFORTABLE' && econInd && (
                <pixiText text={econInd.emoji} x={14} y={-32} anchor={0.5} style={{ fontSize: 9 }} />
              )}

              {selected && (
                <pixiGraphics draw={(g: Graphics) => {
                  g.clear();
                  g.setStrokeStyle({ color: 0xffffff, alpha: 0.85, width: 1.5 });
                  g.circle(0, -4, 18); g.stroke();
                }} />
              )}

              {trade && Date.now() < trade.until && (
                <pixiText
                  text={trade.text} x={0} y={-48} anchor={0.5}
                  style={{ fontFamily: 'monospace', fontSize: 7, fill: trade.isBuy ? 0x34d399 : 0xf43f5e, stroke: { color: 0x050914, width: 2 } }}
                />
              )}
            </pixiContainer>
          );
        })}

        {/* ── Rain effect ── */}
        {weather !== 'clear' && (
          <pixiGraphics zIndex={99000} draw={(g: Graphics) => {
            g.clear();
            g.setFillStyle({ color: 0xa8c8e8, alpha: weather === 'storm' ? 0.6 : 0.3 });
            for (const drop of rainRef.current) {
              g.rect(drop.x, drop.y, 1, 6); g.fill();
              drop.y += drop.speed;
              if (drop.y > 600) { drop.y = -600; drop.x = Math.random() * 2000 - 1000; }
            }
          }} />
        )}

        {/* Day/Night overlay */}
        {dayNightAlpha > 0 && (
          <pixiGraphics zIndex={99500} draw={(g: Graphics) => {
            g.clear();
            g.setFillStyle({ color: dayNightTint, alpha: dayNightAlpha });
            g.rect(-2000, -2000, 4000, 4000); g.fill();
          }} />
        )}

        {/* Prosperity sparkles */}
        {economicState.prosperity > 0.7 && (
          <pixiGraphics zIndex={99100} draw={(g: Graphics) => {
            g.clear();
            const count = Math.floor((economicState.prosperity - 0.7) * 30);
            const t = Date.now() / 1000;
            g.setFillStyle({ color: 0xfbbf24, alpha: 0.5 });
            for (let i = 0; i < count; i++) {
              g.circle(Math.sin(t + i * 2.7) * 400, Math.cos(t * 0.7 + i * 3.1) * 300, 2); g.fill();
            }
          }} />
        )}
      </pixiContainer>
    </>
  );
}
