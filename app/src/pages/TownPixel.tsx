import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type MutableRefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { Application, extend, useApplication, useTick } from '@pixi/react';
import {
  Assets,
  Container,
  FederatedPointerEvent,
  Graphics,
  Sprite,
  Text,
  Texture,
} from 'pixi.js';
import { Button } from '@ui/button';
import { WalletConnect } from '../components/WalletConnect';

extend({ Container, Graphics, Sprite, Text });

const API_BASE = '/api/v1';

type PlotZone = 'RESIDENTIAL' | 'COMMERCIAL' | 'CIVIC' | 'INDUSTRIAL' | 'ENTERTAINMENT';
type PlotStatus = 'EMPTY' | 'CLAIMED' | 'UNDER_CONSTRUCTION' | 'BUILT';

type Town = {
  id: string;
  name: string;
  theme: string;
  level?: number;
  status: string;
  totalPlots: number;
  builtPlots: number;
  completionPct: number;
  yieldPerTick?: number;
  plots: Plot[];
};

type TownSummary = {
  id: string;
  name: string;
  level: number;
  status: string;
  theme: string;
};

type Plot = {
  id: string;
  plotIndex: number;
  x: number;
  y: number;
  zone: PlotZone;
  status: PlotStatus;
  buildingType?: string | null;
  buildingName?: string | null;
  buildingDesc?: string | null;
  buildingData?: string | null;
  ownerId?: string | null;
  builderId?: string | null;
  apiCallsUsed: number;
  buildCostArena: number;
};

type Agent = {
  id: string;
  name: string;
  archetype: string;
  bankroll: number;
  reserveBalance: number;
  wins: number;
  losses: number;
  elo: number;
};

type EconomyPoolSummary = {
  spotPrice: number;
  feeBps: number;
};

const ZONE_COLORS: Record<PlotZone, number> = {
  RESIDENTIAL: 0x34d399,
  COMMERCIAL: 0x60a5fa,
  CIVIC: 0xa78bfa,
  INDUSTRIAL: 0xf97316,
  ENTERTAINMENT: 0xfbbf24,
};

const ARCHETYPE_COLORS: Record<string, number> = {
  SHARK: 0xef4444,
  ROCK: 0x94a3b8,
  CHAMELEON: 0x34d399,
  DEGEN: 0xfbbf24,
  GRINDER: 0x818cf8,
};

const ARCHETYPE_GLYPH: Record<string, string> = {
  SHARK: '▲',
  ROCK: '●',
  CHAMELEON: '◆',
  DEGEN: '★',
  GRINDER: '◎',
};

function safeJsonObject(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw as any;
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hashToSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toIso(x: number, y: number, tileW: number, tileH: number) {
  const sx = (x - y) * (tileW / 2);
  const sy = (x + y) * (tileH / 2);
  return { sx, sy };
}

function fromIso(sx: number, sy: number, tileW: number, tileH: number) {
  const a = sx / (tileW / 2);
  const b = sy / (tileH / 2);
  const x = (a + b) / 2;
  const y = (b - a) / 2;
  return { x, y };
}

function setNearest(tex: Texture | null) {
  if (!tex) return;
  try {
    tex.source.style.scaleMode = 'nearest';
  } catch {}
}

function useTexture(url: string | null) {
  const [tex, setTex] = useState<Texture | null>(null);
  useEffect(() => {
    let alive = true;
    setTex(null);
    if (!url) return () => { alive = false; };
    void (async () => {
      try {
        const t = (await Assets.load(url)) as Texture;
        setNearest(t);
        if (alive) setTex(t);
      } catch {
        if (alive) setTex(null);
      }
    })();
    return () => { alive = false; };
  }, [url]);
  return tex;
}

type AgentSim = {
  id: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  speed: number; // tiles per second
};

type PixelWorldControls = {
  panToTile: (x: number, y: number) => void;
  panToPlotId: (plotId: string) => void;
  panToAgentId: (agentId: string) => void;
  resetCamera: () => void;
  zoomBy: (factor: number) => void;
  getCamera: () => { x: number; y: number; scale: number };
  setFollowAgentId: (agentId: string | null) => void;
  getFollowAgentId: () => string | null;
};

function TownPixelWorld({
  town,
  agents,
  selectedPlotId,
  setSelectedPlotId,
  selectedAgentId,
  setSelectedAgentId,
  controlsRef,
}: {
  town: Town;
  agents: Agent[];
  selectedPlotId: string | null;
  setSelectedPlotId: (id: string | null) => void;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  controlsRef?: MutableRefObject<PixelWorldControls | null>;
}) {
  const { app, isInitialised } = useApplication();
  const worldRef = useRef<Container | null>(null);

  const tileW = 36;
  const tileH = 18;

  const plots = town.plots || [];

  const bounds = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of plots) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
      minX = 0; maxX = 0; minY = 0; maxY = 0;
    }
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    return { minX, maxX, minY, maxY, centerX, centerY };
  }, [plots]);

  const tileList = useMemo(() => {
    const margin = 14;
    const items: Array<{ x: number; y: number; key: string }> = [];
    for (let x = bounds.minX - margin; x <= bounds.maxX + margin; x++) {
      for (let y = bounds.minY - margin; y <= bounds.maxY + margin; y++) {
        items.push({ x, y, key: `${x}:${y}` });
      }
    }
    items.sort((a, b) => (a.x + a.y) - (b.x + b.y));
    return items;
  }, [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY]);

  const plotByKey = useMemo(() => {
    const m = new Map<string, Plot>();
    for (const p of plots) m.set(`${p.x}:${p.y}`, p);
    return m;
  }, [plots]);

  const plotById = useMemo(() => {
    const m = new Map<string, Plot>();
    for (const p of plots) m.set(p.id, p);
    return m;
  }, [plots]);

  const sortedPlotsForSprites = useMemo(() => {
    const withDepth = plots.map((p) => ({ p, d: p.x + p.y }));
    withDepth.sort((a, b) => a.d - b.d);
    return withDepth.map(({ p }) => p);
  }, [plots]);

  // Camera state lives in refs (avoid rerenders while panning/zooming).
  const cameraRef = useRef({ x: 0, y: 0, scale: 1.35 });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; camX: number; camY: number; moved: boolean }>({
    active: false,
    startX: 0,
    startY: 0,
    camX: 0,
    camY: 0,
    moved: false,
  });
  const followAgentIdRef = useRef<string | null>(null);

  // Agent sims
  const simsRef = useRef<Map<string, AgentSim>>(new Map());
  const agentNodeRefs = useRef<Map<string, Container>>(new Map());
  const agentsRef = useRef<Agent[]>(agents);
  useEffect(() => { agentsRef.current = agents; }, [agents]);

  useEffect(() => {
    if (!isInitialised) return;
    // Reset camera on town load.
    cameraRef.current.x = Math.round(app.renderer.width / 2);
    cameraRef.current.y = Math.round(app.renderer.height * 0.28);
    cameraRef.current.scale = 1.35;
    followAgentIdRef.current = null;
    // Reset agent sims on town load.
    simsRef.current = new Map();
  }, [isInitialised, app, town.id]);

  const agentIdsKey = useMemo(() => agents.map(a => a.id).sort().join('|'), [agents]);
  useEffect(() => {
    const sims = simsRef.current;
    const currentAgents = agentsRef.current;
    const ids = new Set(currentAgents.map(a => a.id));
    for (const id of Array.from(sims.keys())) {
      if (!ids.has(id)) sims.delete(id);
    }
    if (followAgentIdRef.current && !ids.has(followAgentIdRef.current)) {
      followAgentIdRef.current = null;
    }

    const margin = 3;
    const minX = bounds.minX - margin;
    const maxX = bounds.maxX + margin;
    const minY = bounds.minY - margin;
    const maxY = bounds.maxY + margin;

    for (const a of currentAgents) {
      if (sims.has(a.id)) continue;
      const rng = mulberry32(hashToSeed(`${town.id}:${a.id}`));
      const x = minX + rng() * (maxX - minX);
      const y = minY + rng() * (maxY - minY);
      const tx = minX + rng() * (maxX - minX);
      const ty = minY + rng() * (maxY - minY);
      sims.set(a.id, { id: a.id, x, y, tx, ty, speed: 0.7 + rng() * 0.55 });
    }
  }, [agentIdsKey, town.id, bounds.minX, bounds.maxX, bounds.minY, bounds.maxY]);

  const worldDirtyRef = useRef(true);
  useEffect(() => {
    worldDirtyRef.current = true;
  }, [town.id, plots.map(p => `${p.id}:${p.status}:${p.zone}:${p.ownerId ?? ''}`).join('|')]);

  const drawWorld = useCallback((g: Graphics) => {
    if (!worldDirtyRef.current) return;
    worldDirtyRef.current = false;

    g.clear();

    for (const t of tileList) {
      const plot = plotByKey.get(t.key);
      const gx = t.x - bounds.centerX;
      const gy = t.y - bounds.centerY;
      const { sx, sy } = toIso(gx, gy, tileW, tileH);

      const isPlot = !!plot;
      let base = 0x0f2013;
      let alpha = 0.85;
      if (isPlot) {
        base = ZONE_COLORS[plot!.zone] || 0x334155;
        alpha =
          plot!.status === 'BUILT' ? 0.88 :
          plot!.status === 'UNDER_CONSTRUCTION' ? 0.72 :
          plot!.status === 'CLAIMED' ? 0.62 :
          0.45;
      } else {
        const nearPlot =
          plotByKey.has(`${t.x + 1}:${t.y}`) ||
          plotByKey.has(`${t.x - 1}:${t.y}`) ||
          plotByKey.has(`${t.x}:${t.y + 1}`) ||
          plotByKey.has(`${t.x}:${t.y - 1}`);
        if (nearPlot) {
          base = 0x111827;
          alpha = 0.9;
        } else {
          const cell = 5;
          const nx = Math.floor(t.x / cell);
          const ny = Math.floor(t.y / cell);
          const v = mulberry32(hashToSeed(`${town.id}:${nx}:${ny}:terrain`))();
          if (v < 0.1) base = 0x0b2a4d; // water-ish
          else if (v < 0.22) base = 0x0a2a18; // forest-ish
          else base = 0x0f2013; // grass-ish
          alpha = 0.85;
        }
      }

      const outline = isPlot ? 0x0f172a : 0x0b1220;
      const outlineAlpha = isPlot ? 0.55 : 0.18;

      g.setFillStyle({ color: base, alpha });
      g.moveTo(sx, sy - tileH / 2);
      g.lineTo(sx + tileW / 2, sy);
      g.lineTo(sx, sy + tileH / 2);
      g.lineTo(sx - tileW / 2, sy);
      g.closePath();
      g.fill();

      g.setStrokeStyle({ color: outline, alpha: outlineAlpha, width: 1 });
      g.moveTo(sx, sy - tileH / 2);
      g.lineTo(sx + tileW / 2, sy);
      g.lineTo(sx, sy + tileH / 2);
      g.lineTo(sx - tileW / 2, sy);
      g.closePath();
      g.stroke();

      // Subtle iso shading for depth.
      g.setStrokeStyle({ color: 0xffffff, alpha: isPlot ? 0.12 : 0.06, width: 1 });
      g.moveTo(sx, sy - tileH / 2);
      g.lineTo(sx + tileW / 2, sy);
      g.stroke();
      g.moveTo(sx, sy - tileH / 2);
      g.lineTo(sx - tileW / 2, sy);
      g.stroke();

      g.setStrokeStyle({ color: 0x000000, alpha: isPlot ? 0.28 : 0.18, width: 1 });
      g.moveTo(sx - tileW / 2, sy);
      g.lineTo(sx, sy + tileH / 2);
      g.lineTo(sx + tileW / 2, sy);
      g.stroke();

      // Small zoning dot for readability at zoomed-out levels.
      if (isPlot) {
        const z = base;
        g.setFillStyle({ color: z, alpha: 0.9 });
        g.circle(sx, sy - 1, 1.2);
        g.fill();
      }
    }
  }, [tileList, plotByKey, bounds.centerX, bounds.centerY, tileW, tileH, town.id]);

  const selectionDirtyRef = useRef(true);
  useEffect(() => { selectionDirtyRef.current = true; }, [selectedPlotId, selectedAgentId]);

  const drawSelection = useCallback((g: Graphics) => {
    if (!selectionDirtyRef.current) return;
    selectionDirtyRef.current = false;

    g.clear();

    if (selectedPlotId) {
      const p = plotById.get(selectedPlotId);
      if (p) {
        const gx = p.x - bounds.centerX;
        const gy = p.y - bounds.centerY;
        const { sx, sy } = toIso(gx, gy, tileW, tileH);
        g.setStrokeStyle({ color: 0xffffff, alpha: 0.8, width: 2 });
        g.moveTo(sx, sy - tileH / 2);
        g.lineTo(sx + tileW / 2, sy);
        g.lineTo(sx, sy + tileH / 2);
        g.lineTo(sx - tileW / 2, sy);
        g.closePath();
        g.stroke();
      }
    }
  }, [selectedPlotId, plotById, bounds.centerX, bounds.centerY, tileW, tileH]);

  const onPointerDown = useCallback((e: FederatedPointerEvent) => {
    const d = dragRef.current;
    d.active = true;
    d.startX = e.global.x;
    d.startY = e.global.y;
    d.camX = cameraRef.current.x;
    d.camY = cameraRef.current.y;
    d.moved = false;
  }, []);

  const onPointerMove = useCallback((e: FederatedPointerEvent) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.global.x - d.startX;
    const dy = e.global.y - d.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    cameraRef.current.x = d.camX + dx;
    cameraRef.current.y = d.camY + dy;
  }, []);

  const resetCamera = useCallback(() => {
    if (!isInitialised) return;
    cameraRef.current.x = Math.round(app.renderer.width / 2);
    cameraRef.current.y = Math.round(app.renderer.height * 0.28);
    cameraRef.current.scale = 1.35;
  }, [isInitialised, app]);

  const zoomBy = useCallback((factor: number) => {
    if (!Number.isFinite(factor) || factor === 0) return;
    cameraRef.current.scale = clamp(cameraRef.current.scale * factor, 0.75, 3.25);
  }, []);

  const getCamera = useCallback(() => cameraRef.current, []);

  const panToIso = useCallback((sx: number, sy: number) => {
    if (!isInitialised) return;
    const scale = cameraRef.current.scale;
    const cx = app.renderer.width / 2;
    const cy = app.renderer.height / 2;
    cameraRef.current.x = Math.round(cx - sx * scale);
    cameraRef.current.y = Math.round(cy - sy * scale);
  }, [isInitialised, app]);

  const panToTile = useCallback((x: number, y: number) => {
    const gx = x - bounds.centerX;
    const gy = y - bounds.centerY;
    const { sx, sy } = toIso(gx, gy, tileW, tileH);
    panToIso(sx, sy);
  }, [bounds.centerX, bounds.centerY, tileW, tileH, panToIso]);

  const panToPlotId = useCallback((plotId: string) => {
    const p = plotById.get(plotId);
    if (!p) return;
    panToTile(p.x, p.y);
  }, [plotById, panToTile]);

  const panToAgentId = useCallback((agentId: string) => {
    const sim = simsRef.current.get(agentId);
    if (!sim) return;
    const gx = sim.x - bounds.centerX;
    const gy = sim.y - bounds.centerY;
    const { sx, sy } = toIso(gx, gy, tileW, tileH);
    panToIso(sx, sy + tileH / 2 - 10);
  }, [bounds.centerX, bounds.centerY, tileW, tileH, panToIso]);

  const setFollowAgentId = useCallback((agentId: string | null) => {
    followAgentIdRef.current = agentId;
  }, []);

  const getFollowAgentId = useCallback(() => followAgentIdRef.current, []);

  useEffect(() => {
    if (!controlsRef) return;
    controlsRef.current = {
      panToTile,
      panToPlotId,
      panToAgentId,
      resetCamera,
      zoomBy,
      getCamera,
      setFollowAgentId,
      getFollowAgentId,
    };
    return () => {
      if (controlsRef.current) controlsRef.current = null;
    };
  }, [controlsRef, panToTile, panToPlotId, panToAgentId, resetCamera, zoomBy, getCamera, setFollowAgentId, getFollowAgentId]);

  const onPointerUp = useCallback((e: FederatedPointerEvent) => {
    const d = dragRef.current;
    const moved = d.moved;
    d.active = false;

    if (moved) return;

    const world = worldRef.current;
    if (!world) return;

    const scale = cameraRef.current.scale;
    const lx = (e.global.x - world.position.x) / scale;
    const ly = (e.global.y - world.position.y) / scale;

    // Prefer selecting agents if close.
    let bestAgentId: string | null = null;
    let bestDist = 14;
    for (const a of agents) {
      const sim = simsRef.current.get(a.id);
      if (!sim) continue;
      const gx = sim.x - bounds.centerX;
      const gy = sim.y - bounds.centerY;
      const { sx, sy } = toIso(gx, gy, tileW, tileH);
      const dx = lx - sx;
      const dy = ly - (sy + tileH / 2 - 10);
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestAgentId = a.id;
      }
    }
    if (bestAgentId) {
      setSelectedAgentId(bestAgentId);
      setSelectedPlotId(null);
      return;
    }

    const grid = fromIso(lx, ly, tileW, tileH);
    const gx = Math.round(grid.x + bounds.centerX);
    const gy = Math.round(grid.y + bounds.centerY);
    const p = plotByKey.get(`${gx}:${gy}`);
    if (p) {
      setSelectedPlotId(p.id);
      setSelectedAgentId(null);
    } else {
      setSelectedPlotId(null);
    }
  }, [agents, bounds.centerX, bounds.centerY, tileW, tileH, plotByKey, setSelectedPlotId, setSelectedAgentId]);

  const onWheel = useCallback((e: any) => {
    const deltaY = typeof e?.deltaY === 'number' ? e.deltaY : 0;
    if (!Number.isFinite(deltaY) || deltaY === 0) return;
    const z = Math.exp(-deltaY * 0.0012);
    zoomBy(z);
  }, [zoomBy]);

  // Main tick: update camera transform + agent motion.
  useTick((delta) => {
    const dt = delta / 60;
    const margin = 3;
    const minX = bounds.minX - margin;
    const maxX = bounds.maxX + margin;
    const minY = bounds.minY - margin;
    const maxY = bounds.maxY + margin;
    for (const a of agents) {
      const sim = simsRef.current.get(a.id);
      if (!sim) continue;
      const dx = sim.tx - sim.x;
      const dy = sim.ty - sim.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.08) {
        const rng = mulberry32(hashToSeed(`${town.id}:${a.id}:${Math.floor(sim.x * 10)}:${Math.floor(sim.y * 10)}`));
        sim.tx = minX + rng() * (maxX - minX);
        sim.ty = minY + rng() * (maxY - minY);
      } else {
        const step = sim.speed * dt;
        sim.x += (dx / dist) * step;
        sim.y += (dy / dist) * step;
      }

      const node = agentNodeRefs.current.get(a.id);
      if (node) {
        const gx = sim.x - bounds.centerX;
        const gy = sim.y - bounds.centerY;
        const { sx, sy } = toIso(gx, gy, tileW, tileH);
        node.position.set(sx, sy + tileH / 2 - 10);
      }
    }

    const followId = followAgentIdRef.current;
    if (followId && !dragRef.current.active) {
      const sim = simsRef.current.get(followId);
      if (sim) {
        const gx = sim.x - bounds.centerX;
        const gy = sim.y - bounds.centerY;
        const { sx, sy } = toIso(gx, gy, tileW, tileH);
        const scale = cameraRef.current.scale;
        const cx = app.renderer.width / 2;
        const cy = app.renderer.height / 2;
        const targetX = cx - sx * scale;
        const targetY = cy - (sy + tileH / 2 - 10) * scale;
        const k = 1 - Math.pow(0.02, dt);
        cameraRef.current.x += (targetX - cameraRef.current.x) * k;
        cameraRef.current.y += (targetY - cameraRef.current.y) * k;
      }
    }

    const world = worldRef.current;
    if (world) {
      const c = cameraRef.current;
      world.position.set(c.x, c.y);
      world.scale.set(c.scale);
    }
  });

  const renderBuildingSprite = (plot: Plot) => {
    const meta = safeJsonObject(plot.buildingData);
    const visual = meta && typeof meta._visual === 'object' ? (meta._visual as any) : null;
    const spriteUrl = visual && typeof visual.spriteUrl === 'string' ? String(visual.spriteUrl) : null;
    const emoji = visual && typeof visual.emoji === 'string' ? String(visual.emoji) : null;

    const gx = plot.x - bounds.centerX;
    const gy = plot.y - bounds.centerY;
    const { sx, sy } = toIso(gx, gy, tileW, tileH);

    if (spriteUrl) {
      return (
        <BuildingSprite
          key={plot.id}
          spriteUrl={spriteUrl}
          x={sx}
          y={sy + tileH / 2 + 2}
          tileW={tileW}
        />
      );
    }

    const label = emoji || (plot.status === 'UNDER_CONSTRUCTION' ? '🏗️' : '🏠');
    return (
      <pixiText
        key={plot.id}
        text={label}
        x={sx}
        y={sy + 2}
        anchor={{ x: 0.5, y: 0.6 }}
        style={{
          fontFamily: 'monospace',
          fontSize: 14,
          fill: 0xffffff,
        }}
      />
    );
  };

  return (
    <pixiContainer
      ref={worldRef}
      eventMode="static"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerUpOutside={onPointerUp}
      onWheel={onWheel}
    >
      <pixiGraphics draw={drawWorld} />
      <pixiGraphics draw={drawSelection} />

      {/* Buildings */}
      {sortedPlotsForSprites
        .filter((p) => p.status !== 'EMPTY')
        .map((p) => renderBuildingSprite(p))}

      {/* Agents */}
      {agents.map((a) => {
        const color = ARCHETYPE_COLORS[a.archetype] || 0x93c5fd;
        const glyph = ARCHETYPE_GLYPH[a.archetype] || '●';
        const isSelected = a.id === selectedAgentId;
        return (
          <pixiContainer
            key={a.id}
            ref={(node: any) => {
              if (node) agentNodeRefs.current.set(a.id, node);
              else agentNodeRefs.current.delete(a.id);
            }}
            zIndex={10000}
          >
            <pixiGraphics
              draw={(g: Graphics) => {
                g.clear();
                g.setFillStyle({ color, alpha: 0.95 });
                g.circle(0, 0, isSelected ? 5.5 : 4.2);
                g.fill();
                g.setStrokeStyle({ color: 0x0b1220, alpha: 0.65, width: 1 });
                g.circle(0, 0, isSelected ? 5.5 : 4.2);
                g.stroke();
              }}
            />
            <pixiText
              text={glyph}
              x={0}
              y={-1}
              anchor={{ x: 0.5, y: 0.5 }}
              style={{
                fontFamily: 'monospace',
                fontSize: 10,
                fill: 0x0b1220,
              }}
            />
          </pixiContainer>
        );
      })}

    </pixiContainer>
  );
}

function BuildingSprite({
  spriteUrl,
  x,
  y,
  tileW,
}: {
  spriteUrl: string;
  x: number;
  y: number;
  tileW: number;
}) {
  const tex = useTexture(spriteUrl);
  const sizeMatch = spriteUrl.match(/-(\d+)px\./i);
  const px = sizeMatch ? Number(sizeMatch[1]) : 64;
  const targetPx = tileW * 2;
  const scale = px > 0 ? targetPx / px : 1;
  return tex ? (
    <pixiSprite
      texture={tex}
      x={x}
      y={y}
      anchor={{ x: 0.5, y: 1 }}
      scale={{ x: scale, y: scale }}
    />
  ) : null;
}

export default function TownPixel() {
  const navigate = useNavigate();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [towns, setTowns] = useState<TownSummary[]>([]);
  const [selectedTownId, setSelectedTownId] = useState<string | null>(null);
  const [town, setTown] = useState<Town | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [economy, setEconomy] = useState<EconomyPoolSummary | null>(null);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [followAgentId, setFollowAgentId] = useState<string | null>(null);

  const stageParentRef = useRef<HTMLDivElement>(null);
  const worldControlsRef = useRef<PixelWorldControls | null>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const minimapTransformRef = useRef<{
    minX: number;
    minY: number;
    margin: number;
    cell: number;
    startX: number;
    startY: number;
  } | null>(null);

  const fetchTowns = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/towns`);
      const data = await res.json();
      if (Array.isArray(data?.towns)) setTowns(data.towns);
    } catch {}
  }, []);

  const fetchTown = useCallback(async (id: string | null) => {
    try {
      if (!id) {
        const res = await fetch(`${API_BASE}/town`);
        const data = await res.json();
        setTown(data?.town || null);
        setSelectedTownId(data?.town?.id || null);
        return;
      }
      const res = await fetch(`${API_BASE}/town/${id}`);
      const data = await res.json();
      setTown(data?.town || null);
    } catch {
      setTown(null);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/agents`);
      const data = await res.json();
      if (Array.isArray(data)) setAgents(data as any);
    } catch {}
  }, []);

  const fetchEconomy = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/economy/pool`);
      const data = await res.json();
      if (data && typeof data.spotPrice === 'number') {
        setEconomy({ spotPrice: data.spotPrice, feeBps: data.feeBps || 0 });
      }
    } catch {}
  }, []);

  useEffect(() => {
    void fetchTowns();
    void fetchAgents();
    void fetchEconomy();
    void fetchTown(selectedTownId);
    const t1 = setInterval(fetchAgents, 2500);
    const t2 = setInterval(fetchEconomy, 7000);
    const t3 = setInterval(() => fetchTown(selectedTownId), 3000);
    const t4 = setInterval(fetchTowns, 12000);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
      clearInterval(t3);
      clearInterval(t4);
    };
  }, [fetchTowns, fetchAgents, fetchEconomy, fetchTown, selectedTownId]);

  const selectedPlot = useMemo(() => {
    if (!town || !selectedPlotId) return null;
    return town.plots.find((p) => p.id === selectedPlotId) || null;
  }, [town, selectedPlotId]);

  const selectedAgent = useMemo(() => {
    if (!selectedAgentId) return null;
    return agents.find((a) => a.id === selectedAgentId) || null;
  }, [agents, selectedAgentId]);

  useEffect(() => {
    setFollowAgentId(null);
    worldControlsRef.current?.setFollowAgentId(null);
  }, [town?.id]);

  useEffect(() => {
    if (followAgentId && !agents.some((a) => a.id === followAgentId)) {
      setFollowAgentId(null);
      worldControlsRef.current?.setFollowAgentId(null);
    }
  }, [agents, followAgentId]);

  const minimapBounds = useMemo(() => {
    if (!town?.plots?.length) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of town.plots) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) return null;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    return { minX, maxX, minY, maxY, centerX, centerY };
  }, [town?.id, town?.plots]);

  const drawMinimap = useCallback(() => {
    const canvas = minimapRef.current;
    if (!canvas || !town || !minimapBounds) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = Math.min(canvas.width, canvas.height);
    const margin = 3;
    const w = (minimapBounds.maxX - minimapBounds.minX + 1) + margin * 2;
    const h = (minimapBounds.maxY - minimapBounds.minY + 1) + margin * 2;
    const cell = clamp(Math.floor((size - 16) / Math.max(w, h)), 2, 10);
    const mapW = w * cell;
    const mapH = h * cell;
    const startX = Math.floor((size - mapW) / 2);
    const startY = Math.floor((size - mapH) / 2);
    minimapTransformRef.current = { minX: minimapBounds.minX, minY: minimapBounds.minY, margin, cell, startX, startY };

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#050914';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const p of town.plots) {
      const x = startX + (p.x - (minimapBounds.minX - margin)) * cell;
      const y = startY + (p.y - (minimapBounds.minY - margin)) * cell;
      const base = ZONE_COLORS[p.zone] || 0x334155;
      ctx.globalAlpha =
        p.status === 'BUILT' ? 0.95 :
        p.status === 'UNDER_CONSTRUCTION' ? 0.75 :
        p.status === 'CLAIMED' ? 0.6 :
        0.35;
      ctx.fillStyle = `#${base.toString(16).padStart(6, '0')}`;
      ctx.fillRect(x, y, cell, cell);

      if (selectedPlotId && p.id === selectedPlotId) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 1, y - 1, cell + 2, cell + 2);
      }
    }
    ctx.globalAlpha = 1;

    // Camera dot (screen-center projected onto grid).
    const camera = worldControlsRef.current?.getCamera();
    const host = stageParentRef.current;
    if (camera && host) {
      const cx = host.clientWidth / 2;
      const cy = host.clientHeight / 2;
      const lx = (cx - camera.x) / camera.scale;
      const ly = (cy - camera.y) / camera.scale;
      const grid = fromIso(lx, ly, 36, 18);
      const gx = grid.x + minimapBounds.centerX;
      const gy = grid.y + minimapBounds.centerY;
      const x = startX + (gx - (minimapBounds.minX - margin)) * cell;
      const y = startY + (gy - (minimapBounds.minY - margin)) * cell;
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(Math.round(x - 1), Math.round(y - 1), 3, 3);
    }
  }, [minimapBounds, selectedPlotId, town]);

  useEffect(() => {
    drawMinimap();
    const t = setInterval(drawMinimap, 150);
    return () => clearInterval(t);
  }, [drawMinimap]);

  const onMinimapClick = useCallback((e: MouseEvent<HTMLCanvasElement>) => {
    const tr = minimapTransformRef.current;
    if (!tr) return;
    const canvas = minimapRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const my = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const gx = Math.floor((mx - tr.startX) / tr.cell) + (tr.minX - tr.margin);
    const gy = Math.floor((my - tr.startY) / tr.cell) + (tr.minY - tr.margin);
    worldControlsRef.current?.panToTile(gx, gy);
  }, []);

  return (
    <div className="flex flex-col h-[100svh] w-full overflow-hidden bg-[#050914]">
      <div className="shrink-0 flex items-center justify-between px-3 py-2 bg-[#0b1220] border-b-2 border-slate-700/70">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-bold text-amber-400 pixel-title">AI TOWN</span>
          <span className="text-[10px] text-slate-400">PIXEL</span>
          {economy && Number.isFinite(economy.spotPrice) && (
            <span className="text-[10px] text-slate-500 font-mono">
              $ARENA {economy.spotPrice.toFixed(4)} · fee {(economy.feeBps / 100).toFixed(2)}%
            </span>
          )}
          {town && (
            <span className="text-[10px] text-slate-500 truncate">
              · {town.name} ({town.status}) · {town.builtPlots}/{town.totalPlots} ({Math.round(town.completionPct)}%)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-none border-2 border-slate-700 bg-[#070b12] px-2 text-xs font-mono text-slate-200"
            value={selectedTownId ?? ''}
            onChange={(e) => {
              const id = e.target.value || null;
              setSelectedTownId(id);
              void fetchTown(id);
              setSelectedPlotId(null);
              setSelectedAgentId(null);
            }}
          >
            {towns.map((t) => (
              <option key={t.id} value={t.id}>
                L{t.level} · {t.name} ({t.status})
              </option>
            ))}
          </select>
          <Button size="sm" className="pixel-btn h-8 px-3 text-xs" onClick={() => navigate('/town')}>
            3D View
          </Button>
          <Button
            size="sm"
            className="pixel-btn h-8 px-2 text-xs"
            onClick={() => {
              setFollowAgentId(null);
              worldControlsRef.current?.setFollowAgentId(null);
              worldControlsRef.current?.resetCamera();
            }}
            title="Reset camera"
          >
            Reset
          </Button>
          <Button
            size="sm"
            className="pixel-btn h-8 px-2 text-xs"
            onClick={() => worldControlsRef.current?.zoomBy(1.12)}
            title="Zoom in"
          >
            +
          </Button>
          <Button
            size="sm"
            className="pixel-btn h-8 px-2 text-xs"
            onClick={() => worldControlsRef.current?.zoomBy(1 / 1.12)}
            title="Zoom out"
          >
            −
          </Button>
          <WalletConnect compact onAddressChange={setWalletAddress} />
          {walletAddress && (
            <div className="hidden md:block text-[10px] text-slate-600 font-mono">
              {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div ref={stageParentRef} className="relative flex-1 min-w-0">
          {town ? (
            <Application
              resizeTo={stageParentRef}
              autoStart
              antialias={false}
              backgroundAlpha={0}
              resolution={window.devicePixelRatio || 1}
            >
              <TownPixelWorld
                town={town}
                agents={agents}
                selectedPlotId={selectedPlotId}
                setSelectedPlotId={setSelectedPlotId}
                selectedAgentId={selectedAgentId}
                setSelectedAgentId={setSelectedAgentId}
                controlsRef={worldControlsRef}
              />
            </Application>
          ) : (
            <div className="h-full w-full grid place-items-center text-slate-400 text-sm">
              No active town. Create one from an agent.
            </div>
          )}

          {/* Minimal inspector */}
          {(selectedPlot || selectedAgent) && (
            <div className="absolute right-3 top-3 w-[320px] max-w-[calc(100vw-24px)] pixel-panel p-3">
              {selectedPlot && (
                <div className="space-y-1">
                  <div className="pixel-panel-title">Plot #{selectedPlot.plotIndex}</div>
                  <div className="text-[11px] text-slate-300 font-mono">{selectedPlot.buildingName || 'Available'}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {selectedPlot.zone} · {selectedPlot.status} · calls {selectedPlot.apiCallsUsed} · cost {selectedPlot.buildCostArena}
                  </div>
                  {selectedPlot.buildingDesc && (
                    <div className="text-[10px] text-slate-400 leading-snug">
                      {selectedPlot.buildingDesc.slice(0, 180)}{selectedPlot.buildingDesc.length > 180 ? '…' : ''}
                    </div>
                  )}
                </div>
              )}

              {selectedAgent && !selectedPlot && (
                <div className="space-y-1">
                  <div className="pixel-panel-title">
                    {(ARCHETYPE_GLYPH[selectedAgent.archetype] || '●') + ' ' + selectedAgent.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {selectedAgent.archetype} · ELO {selectedAgent.elo}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] text-slate-300">
                    <div className="rounded border border-slate-800/60 bg-slate-950/30 px-2 py-1">
                      <div className="text-slate-500">$ARENA</div>
                      <div className="font-mono text-slate-100">{Math.round(selectedAgent.bankroll)}</div>
                    </div>
                    <div className="rounded border border-slate-800/60 bg-slate-950/30 px-2 py-1">
                      <div className="text-slate-500">reserve</div>
                      <div className="font-mono text-slate-100">{Math.round(selectedAgent.reserveBalance)}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-2 flex gap-2">
                {selectedPlot && (
                  <Button size="sm" className="pixel-btn h-8 px-2 text-xs" onClick={() => worldControlsRef.current?.panToPlotId(selectedPlot.id)}>
                    Focus
                  </Button>
                )}
                {selectedAgent && !selectedPlot && (
                  <>
                    <Button size="sm" className="pixel-btn h-8 px-2 text-xs" onClick={() => worldControlsRef.current?.panToAgentId(selectedAgent.id)}>
                      Focus
                    </Button>
                    <Button
                      size="sm"
                      className="pixel-btn h-8 px-2 text-xs"
                      onClick={() => {
                        const next = followAgentId === selectedAgent.id ? null : selectedAgent.id;
                        setFollowAgentId(next);
                        worldControlsRef.current?.setFollowAgentId(next);
                        if (next) worldControlsRef.current?.panToAgentId(next);
                      }}
                    >
                      {followAgentId === selectedAgent.id ? 'Unfollow' : 'Follow'}
                    </Button>
                  </>
                )}
                <Button size="sm" className="pixel-btn h-8 px-2 text-xs" onClick={() => { setSelectedPlotId(null); setSelectedAgentId(null); }}>
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Minimap */}
          {town && minimapBounds && (
            <div className="absolute left-3 bottom-3 pixel-panel p-2">
              <div className="pixel-panel-kicker mb-1 flex items-center justify-between gap-2">
                <span>Minimap</span>
                {followAgentId && <span className="text-emerald-300">FOLLOW</span>}
              </div>
              <canvas
                ref={minimapRef}
                width={180}
                height={180}
                className="block border border-slate-700/60 bg-[#050914] cursor-pointer"
                onClick={onMinimapClick}
              />
              <div className="pixel-panel-kicker mt-1">click to jump</div>
            </div>
          )}

          {/* Controls */}
          <div className="absolute right-3 bottom-3 pixel-panel px-3 py-2 hidden md:block">
            <div className="pixel-panel-title mb-1">Controls</div>
            <div className="pixel-panel-kicker">drag: pan · wheel: zoom · click: select</div>
          </div>
        </div>

        {/* Side list (simple, game-dev friendly) */}
        <div className="hidden lg:flex w-[340px] shrink-0 border-l-2 border-slate-700/70 bg-[#0b1220] flex-col">
          <div className="px-3 py-2 border-b-2 border-slate-700/70">
            <div className="pixel-panel-title">Agents</div>
            <div className="pixel-panel-kicker">click to select · shift-click to focus</div>
          </div>
          <div className="flex-1 overflow-auto px-3 py-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-700/70">
            {agents.map((a) => {
              const color = ARCHETYPE_COLORS[a.archetype] || 0x93c5fd;
              const glyph = ARCHETYPE_GLYPH[a.archetype] || '●';
              const isSel = a.id === selectedAgentId;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={(e) => {
                    setSelectedAgentId(a.id);
                    setSelectedPlotId(null);
                    if (e.shiftKey) worldControlsRef.current?.panToAgentId(a.id);
                  }}
                  className={`w-full text-left rounded-md border px-2 py-1.5 text-[11px] transition-colors ${
                    isSel ? 'border-white/40 bg-slate-900/30' : 'border-slate-800/50 bg-slate-950/20 hover:bg-slate-900/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate font-mono" style={{ color: `#${color.toString(16).padStart(6, '0')}` }}>
                      {glyph} {a.name}
                    </div>
                    <div className="shrink-0 text-[10px] text-slate-500 font-mono">
                      {Math.round(a.bankroll)}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-600">{a.archetype} · ELO {a.elo}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
