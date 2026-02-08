/**
 * Agent state machine + pathfinding for the 2D pixel town.
 * Port of Town3D's useFrame agent simulation to a tick-based system.
 */
import { useRef, useEffect, useCallback } from 'react';
import type { Agent, Plot, AgentSim2D, Vec2 } from '../types';
import { getEconomicState } from '../types';
import { ARCHETYPE_SPEED, CHAT_DURATION, PLOT_PX, ROAD_PX, TILE_SIZE } from '../constants';
import { hashToSeed, mulberry32 } from '../rendering/atlas';

/** Convert grid (col,row) + center offsets to world px */
function plotWorldPos(
  p: { x: number; y: number },
  centerX: number,
  centerY: number,
): Vec2 {
  const wx = (p.x - centerX) * (PLOT_PX + ROAD_PX) + PLOT_PX / 2;
  const wy = (p.y - centerY) * (PLOT_PX + ROAD_PX) + PLOT_PX / 2;
  return { x: wx, y: wy };
}

function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function useAgentSim(
  agents: Agent[],
  plots: Plot[],
  relationshipsRef: React.MutableRefObject<{ agentAId: string; agentBId: string; status: string; score: number }[]>,
  onChatStart?: (townId: string, agentAId: string, agentBId: string) => void,
  townId?: string,
) {
  const simsRef = useRef<Map<string, AgentSim2D>>(new Map());

  // Pre-compute plot positions
  const boundsRef = useRef({ centerX: 0, centerY: 0, minX: 0, maxX: 0, minY: 0, maxY: 0 });

  useEffect(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of plots) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    if (!Number.isFinite(minX)) { minX = 0; maxX = 0; minY = 0; maxY = 0; }
    boundsRef.current = { centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2, minX, maxX, minY, maxY };
  }, [plots]);

  // Road node positions — use INTERSECTIONS between plots (not plot centers)
  const roadNodesRef = useRef<Vec2[]>([]);
  useEffect(() => {
    const b = boundsRef.current;
    const gridSpan = PLOT_PX + ROAD_PX;
    const nodes: Vec2[] = [];

    // Road intersections: corners where grid lines cross
    // These are at the corners of each plot (between plots), NOT at plot centers
    for (let ix = b.minX; ix <= b.maxX + 1; ix++) {
      for (let iy = b.minY; iy <= b.maxY + 1; iy++) {
        // Intersection at top-left corner of plot (ix, iy)
        const wx = (ix - b.centerX) * gridSpan - PLOT_PX / 2 - ROAD_PX / 2;
        const wy = (iy - b.centerY) * gridSpan - PLOT_PX / 2 - ROAD_PX / 2;
        nodes.push({ x: wx, y: wy });
      }
    }

    // Road midpoints along horizontal roads
    for (let ix = b.minX; ix <= b.maxX; ix++) {
      for (let iy = b.minY; iy <= b.maxY; iy++) {
        // Midpoint of road segment between intersections (on horizontal roads)
        const wx = (ix - b.centerX) * gridSpan;
        const wy = (iy - b.centerY) * gridSpan - PLOT_PX / 2 - ROAD_PX / 2;
        nodes.push({ x: wx, y: wy });
        // Midpoint on vertical roads
        const wx2 = (ix - b.centerX) * gridSpan - PLOT_PX / 2 - ROAD_PX / 2;
        const wy2 = (iy - b.centerY) * gridSpan;
        nodes.push({ x: wx2, y: wy2 });
      }
    }

    // Perimeter roaming nodes — ring road area outside the main grid
    const margin = gridSpan * 1.5;
    const ringLeft = (b.minX - b.centerX) * gridSpan - PLOT_PX / 2 - margin;
    const ringRight = (b.maxX - b.centerX) * gridSpan + PLOT_PX / 2 + margin;
    const ringTop = (b.minY - b.centerY) * gridSpan - PLOT_PX / 2 - margin;
    const ringBottom = (b.maxY - b.centerY) * gridSpan + PLOT_PX / 2 + margin;

    // Add nodes along the perimeter
    const perimeterSteps = 12;
    for (let i = 0; i < perimeterSteps; i++) {
      const t = i / perimeterSteps;
      nodes.push({ x: ringLeft + (ringRight - ringLeft) * t, y: ringTop }); // top edge
      nodes.push({ x: ringLeft + (ringRight - ringLeft) * t, y: ringBottom }); // bottom edge
      nodes.push({ x: ringLeft, y: ringTop + (ringBottom - ringTop) * t }); // left edge
      nodes.push({ x: ringRight, y: ringTop + (ringBottom - ringTop) * t }); // right edge
    }

    roadNodesRef.current = nodes;
  }, [plots]);

  // Initialize / reconcile agent sims
  useEffect(() => {
    const sims = simsRef.current;
    const agentIds = new Set(agents.map(a => a.id));
    for (const id of Array.from(sims.keys())) {
      if (!agentIds.has(id)) sims.delete(id);
    }
    const nodes = roadNodesRef.current;
    for (const a of agents) {
      if (sims.has(a.id)) continue;
      const rng = mulberry32(hashToSeed(a.id));
      const start = nodes[Math.floor(rng() * Math.max(1, nodes.length))] ?? { x: 0, y: 0 };
      // Random spawn offset so agents don't stack on exact node positions
      const offsetX = (rng() - 0.5) * TILE_SIZE * 2;
      const offsetY = (rng() - 0.5) * TILE_SIZE * 2;
      const speed = (ARCHETYPE_SPEED[a.archetype] || 1.2) * TILE_SIZE * 2;
      sims.set(a.id, {
        id: a.id, x: start.x + offsetX, y: start.y + offsetY,
        tx: start.x + offsetX, ty: start.y + offsetY,
        heading: { x: 0, y: 1 }, speed, walk: rng() * 10,
        state: 'WALKING', stateTimer: 0, stateEndsAt: 0,
        targetPlotId: null, chatPartnerId: null, chatEndsAt: 0,
        chatCooldownUntil: 0,
        health: 100, direction: 'down', frame: 0,
      });
    }
  }, [agents]);

  /** Advance all agent simulations by `dt` seconds */
  const tick = useCallback((dt: number) => {
    const sims = simsRef.current;
    const b = boundsRef.current;
    const nodes = roadNodesRef.current;
    const now = performance.now() / 1000;
    const builtPlots = plots.filter(p => p.status === 'BUILT' || p.status === 'UNDER_CONSTRUCTION');
    const ucPlots = plots.filter(p => p.status === 'UNDER_CONSTRUCTION');
    const entPlots = plots.filter(p => p.status === 'BUILT' && p.zone === 'ENTERTAINMENT');

    for (const a of agents) {
      const sim = sims.get(a.id);
      if (!sim) continue;
      sim.stateTimer += dt;

      if (sim.state === 'DEAD') continue;

      const econ = getEconomicState(a.bankroll + a.reserveBalance, false);

      // Broke → beg/scheme transition
      if ((econ === 'BROKE' || econ === 'HOMELESS') && sim.state === 'WALKING') {
        if (Math.random() < 0.05 * dt) {
          sim.state = 'BEGGING'; sim.stateTimer = 0; sim.stateEndsAt = 4 + Math.random() * 3;
          sim.tx = sim.x; sim.ty = sim.y;
        }
        if (econ === 'HOMELESS' && Math.random() < 0.02 * dt) {
          sim.state = 'SCHEMING'; sim.stateTimer = 0; sim.stateEndsAt = 3 + Math.random() * 2;
          sim.tx = sim.x; sim.ty = sim.y;
        }
      }

      // Fixed-duration states
      for (const st of ['BEGGING', 'SCHEMING', 'SHOPPING', 'BUILDING', 'MINING', 'PLAYING'] as const) {
        if (sim.state === st) {
          if (sim.stateTimer > sim.stateEndsAt) {
            sim.state = 'WALKING'; sim.stateEndsAt = 0; sim.targetPlotId = null;
          }
          continue; // don't move
        }
      }

      // Chatting
      if (sim.state === 'CHATTING') {
        if (sim.stateTimer > sim.chatEndsAt) {
          sim.state = 'WALKING';
          sim.chatCooldownUntil = now + 8; // 8 second cooldown after chat
          const partner = sims.get(sim.chatPartnerId!);
          if (partner) {
            partner.state = 'WALKING';
            partner.chatPartnerId = null;
            partner.chatCooldownUntil = now + 8;
          }
          sim.chatPartnerId = null;
        }
        continue;
      }

      // Chat proximity check — respect cooldown
      if (sim.state === 'WALKING' && !sim.chatPartnerId && now > sim.chatCooldownUntil) {
        for (const [otherId, other] of sims) {
          if (otherId === a.id || other.state !== 'WALKING' || other.chatPartnerId) continue;
          if (now < other.chatCooldownUntil) continue; // other agent still on cooldown
          if (dist({ x: sim.x, y: sim.y }, { x: other.x, y: other.y }) < TILE_SIZE * 1.5) {
            const archetype = a.archetype;
            const [minDur, maxDur] = CHAT_DURATION[archetype] ?? [3, 5];
            const duration = minDur + Math.random() * (maxDur - minDur);
            sim.state = 'CHATTING'; sim.chatPartnerId = otherId; sim.stateTimer = 0; sim.chatEndsAt = duration;
            other.state = 'CHATTING'; other.chatPartnerId = a.id; other.stateTimer = 0; other.chatEndsAt = duration;
            sim.tx = sim.x; sim.ty = sim.y;
            other.tx = other.x; other.ty = other.y;
            if (townId) onChatStart?.(townId, a.id, otherId);
            break;
          }
        }
      }

      // Near building → shop/build/play
      if (sim.state === 'WALKING') {
        for (const plot of builtPlots) {
          const pp = plotWorldPos(plot, b.centerX, b.centerY);
          if (dist({ x: sim.x, y: sim.y }, pp) < PLOT_PX && Math.random() < 0.005 * dt) {
            sim.state = 'SHOPPING'; sim.targetPlotId = plot.id; sim.stateTimer = 0; sim.stateEndsAt = 2 + Math.random() * 3;
            sim.tx = sim.x; sim.ty = sim.y; break;
          }
        }
      }
      if (sim.state === 'WALKING') {
        for (const plot of ucPlots) {
          const pp = plotWorldPos(plot, b.centerX, b.centerY);
          if (dist({ x: sim.x, y: sim.y }, pp) < PLOT_PX && Math.random() < 0.008 * dt) {
            sim.state = 'BUILDING'; sim.targetPlotId = plot.id; sim.stateTimer = 0; sim.stateEndsAt = 4 + Math.random() * 3;
            sim.tx = sim.x; sim.ty = sim.y; break;
          }
        }
      }
      if (sim.state === 'WALKING') {
        for (const plot of entPlots) {
          const pp = plotWorldPos(plot, b.centerX, b.centerY);
          if (dist({ x: sim.x, y: sim.y }, pp) < PLOT_PX && Math.random() < 0.006 * dt) {
            sim.state = 'PLAYING'; sim.targetPlotId = plot.id; sim.stateTimer = 0; sim.stateEndsAt = 5 + Math.random() * 5;
            sim.tx = sim.x; sim.ty = sim.y; break;
          }
        }
      }
      if (sim.state === 'WALKING' && Math.random() < 0.001 * dt) {
        sim.state = 'MINING'; sim.stateTimer = 0; sim.stateEndsAt = 3 + Math.random() * 2;
        sim.tx = sim.x; sim.ty = sim.y;
      }

      // Walking movement
      if (sim.state === 'WALKING') {
        // Pick new target if reached
        const d = dist({ x: sim.x, y: sim.y }, { x: sim.tx, y: sim.ty });
        if (d < TILE_SIZE * 0.5) {
          const rng = mulberry32(hashToSeed(`${a.id}:${Math.floor(sim.walk)}`));
          const roll = rng();
          const rels = relationshipsRef.current;
          let picked = false;

          // 15% → walk toward friend/rival
          if (rels.length > 0 && roll < 0.15) {
            const myRels = rels.filter(r => r.agentAId === a.id || r.agentBId === a.id);
            if (myRels.length > 0) {
              const rel = myRels[Math.floor(rng() * myRels.length)];
              const targetId = rel.agentAId === a.id ? rel.agentBId : rel.agentAId;
              const targetSim = sims.get(targetId);
              if (targetSim && targetSim.state !== 'DEAD') {
                sim.tx = targetSim.x; sim.ty = targetSim.y; picked = true;
              }
            }
          }
          // 25% → head to building
          if (!picked && builtPlots.length > 0 && roll < 0.40) {
            const tp = builtPlots[Math.floor(rng() * builtPlots.length)];
            const pp = plotWorldPos(tp, b.centerX, b.centerY);
            sim.tx = pp.x; sim.ty = pp.y; sim.targetPlotId = tp.id; picked = true;
          }
          // 60% → random road node (with small random offset)
          if (!picked && nodes.length > 0) {
            const target = nodes[Math.floor(rng() * nodes.length)];
            const offsetX = (rng() - 0.5) * TILE_SIZE;
            const offsetY = (rng() - 0.5) * TILE_SIZE;
            sim.tx = target.x + offsetX; sim.ty = target.y + offsetY; sim.targetPlotId = null;
          }
        }

        // Move toward target
        const dx = sim.tx - sim.x;
        const dy = sim.ty - sim.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 1) {
          const nx = dx / len;
          const ny = dy / len;
          sim.heading = { x: sim.heading.x * 0.75 + nx * 0.25, y: sim.heading.y * 0.75 + ny * 0.25 };
          const step = Math.min(sim.speed * dt, len);
          sim.x += nx * step;
          sim.y += ny * step;
          sim.walk += dt * sim.speed / TILE_SIZE * 0.35;

          // Update direction for sprite
          if (Math.abs(nx) > Math.abs(ny)) {
            sim.direction = nx > 0 ? 'right' : 'left';
          } else {
            sim.direction = ny > 0 ? 'down' : 'up';
          }
        }
      }
    }

    // Hard separation
    const simList = Array.from(sims.values()).filter(s => s.state !== 'DEAD');
    const minSep = TILE_SIZE * 0.8;
    const minSepSq = minSep * minSep;
    for (let i = 0; i < simList.length; i++) {
      for (let j = i + 1; j < simList.length; j++) {
        const a = simList[i], bb = simList[j];
        const dx = a.x - bb.x, dy = a.y - bb.y;
        const dSq = dx * dx + dy * dy;
        if (dSq > 0.0001 && dSq < minSepSq) {
          const d = Math.sqrt(dSq);
          const push = (minSep - d) * 0.5;
          const nx = dx / d, ny = dy / d;
          a.x += nx * push; a.y += ny * push;
          bb.x -= nx * push; bb.y -= ny * push;
        } else if (dSq <= 0.0001) {
          const ang = ((i * 97 + j * 131) % 360) * Math.PI / 180;
          a.x += Math.cos(ang) * minSep * 0.25; a.y += Math.sin(ang) * minSep * 0.25;
          bb.x -= Math.cos(ang) * minSep * 0.25; bb.y -= Math.sin(ang) * minSep * 0.25;
        }
      }
    }
  }, [agents, plots, relationshipsRef, onChatStart, townId]);

  return { simsRef, tick };
}
