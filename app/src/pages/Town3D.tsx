import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import { Button } from '@ui/button';
import { Badge } from '@ui/badge';
import { Card } from '@ui/card';
import { Loader2 } from 'lucide-react';

const API_BASE = '/api/v1';

type PlotZone = 'RESIDENTIAL' | 'COMMERCIAL' | 'CIVIC' | 'INDUSTRIAL' | 'ENTERTAINMENT';
type PlotStatus = 'EMPTY' | 'CLAIMED' | 'UNDER_CONSTRUCTION' | 'BUILT';

interface Plot {
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

interface Town {
  id: string;
  name: string;
  theme: string;
  status: string;
  totalPlots: number;
  builtPlots: number;
  completionPct: number;
  totalInvested: number;
  plots: Plot[];
}

interface TownSummary {
  id: string;
  name: string;
  level: number;
  status: string;
  theme: string;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  archetype: string;
  bankroll: number;
  wins: number;
  losses: number;
  draws?: number;
  elo: number;
  apiCostCents?: number;
  isInMatch?: boolean;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error (${res.status}): ${res.statusText}`);
  return res.json() as Promise<T>;
}

const ZONE_COLORS: Record<PlotZone, string> = {
  RESIDENTIAL: '#3ee08f',
  COMMERCIAL: '#49a7ff',
  CIVIC: '#ffd166',
  INDUSTRIAL: '#ff8c42',
  ENTERTAINMENT: '#ff4fd8',
};

const ARCHETYPE_COLORS: Record<string, string> = {
  SHARK: '#ef4444',
  ROCK: '#94a3b8',
  CHAMELEON: '#34d399',
  DEGEN: '#fbbf24',
  GRINDER: '#818cf8',
};

const ARCHETYPE_GLYPH: Record<string, string> = {
  SHARK: '▲',
  ROCK: '●',
  CHAMELEON: '◆',
  DEGEN: '★',
  GRINDER: '◎',
};

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
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawLabelTexture(text: string, opts?: { fg?: string; bg?: string }) {
  const fg = opts?.fg ?? '#e5e7eb';
  const bg = opts?.bg ?? 'rgba(15, 23, 42, 0.88)';

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { texture: new THREE.Texture(), width: 1, height: 1 };

  const fontSize = 28;
  ctx.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  const padX = 18;
  const padY = 12;
  const metrics = ctx.measureText(text);
  const textWidth = Math.ceil(metrics.width);
  const w = Math.max(64, textWidth + padX * 2);
  const h = Math.max(40, fontSize + padY * 2);
  canvas.width = w;
  canvas.height = h;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = bg;
  const r = 12;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - r, 0);
  ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r);
  ctx.quadraticCurveTo(w, h, w - r, h);
  ctx.lineTo(r, h);
  ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = fg;
  ctx.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, padX, h / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return { texture, width: w, height: h };
}

function BillboardLabel({
  text,
  position,
  color,
}: {
  text: string;
  position: [number, number, number];
  color?: string;
}) {
  const { texture, width, height } = useMemo(() => drawLabelTexture(text, { fg: color }), [text, color]);
  const aspect = width / height;
  const worldHeight = 0.8;
  const worldWidth = worldHeight * aspect;

  return (
    <sprite position={position} scale={[worldWidth, worldHeight, 1]}>
      <spriteMaterial map={texture} transparent opacity={0.98} depthWrite={false} />
    </sprite>
  );
}

function useGroundTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= size; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    // small noise specks
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let i = 0; i < 1200; i++) {
      ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 10);
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  }, []);
}

function zoneMaterial(zone: PlotZone, selected: boolean) {
  const base = new THREE.Color('#0f172a');
  const tint = new THREE.Color(ZONE_COLORS[zone]);
  const color = base.lerp(tint, 0.22);
  const emissive = selected ? tint.clone().multiplyScalar(0.35) : new THREE.Color('#000000');
  return { color, emissive };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function buildHeight(plot: Plot) {
  // Use proof-of-inference signals to make the city feel "earned".
  const api = clamp(plot.apiCallsUsed || 0, 0, 20);
  const arena = clamp(plot.buildCostArena || 0, 0, 500);
  return 1.2 + api * 0.08 + Math.log10(1 + arena) * 0.9;
}

function BuildingMesh({
  plot,
  position,
  selected,
}: {
  plot: Plot;
  position: [number, number, number];
  selected: boolean;
}) {
  const h = buildHeight(plot);
  const zone = plot.zone;
  const tint = new THREE.Color(ZONE_COLORS[zone]);
  const main = tint.clone().multiplyScalar(0.55);
  const accent = tint.clone().multiplyScalar(0.9);

  if (plot.status !== 'BUILT') {
    // Under construction scaffold.
    return (
      <group position={position}>
        <mesh position={[0, 0.8, 0]}>
          <boxGeometry args={[3.6, 1.6, 3.6]} />
          <meshStandardMaterial color={'#0b1220'} emissive={tint.clone().multiplyScalar(selected ? 0.35 : 0.1)} />
        </mesh>
        <mesh position={[0, 1.9, 0]}>
          <boxGeometry args={[3.9, 0.05, 3.9]} />
          <meshStandardMaterial color={accent} emissive={accent.clone().multiplyScalar(0.3)} />
        </mesh>
        <mesh position={[0, 1.6, 0]}>
          <boxGeometry args={[4.0, 3.4, 4.0]} />
          <meshStandardMaterial color={'#93c5fd'} transparent opacity={0.06} wireframe />
        </mesh>
      </group>
    );
  }

  // Simple stylized silhouettes by zone.
  if (zone === 'RESIDENTIAL') {
    return (
      <group position={position}>
        <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
          <boxGeometry args={[3.2, h, 2.8]} />
          <meshStandardMaterial color={main} emissive={selected ? accent.clone().multiplyScalar(0.28) : undefined} />
        </mesh>
        <mesh castShadow position={[0, h + 0.55, 0]}>
          <coneGeometry args={[2.2, 1.2, 4]} />
          <meshStandardMaterial color={accent} />
        </mesh>
      </group>
    );
  }

  if (zone === 'INDUSTRIAL') {
    return (
      <group position={position}>
        <mesh castShadow receiveShadow position={[-0.3, h / 2, 0]}>
          <boxGeometry args={[3.4, h, 3.2]} />
          <meshStandardMaterial color={main} emissive={selected ? accent.clone().multiplyScalar(0.25) : undefined} />
        </mesh>
        <mesh castShadow position={[1.4, h * 0.62, -0.6]}>
          <cylinderGeometry args={[0.32, 0.4, h * 0.9, 10]} />
          <meshStandardMaterial color={'#64748b'} />
        </mesh>
        <mesh castShadow position={[1.4, h * 1.05, -0.6]}>
          <sphereGeometry args={[0.35, 10, 10]} />
          <meshStandardMaterial color={accent} emissive={accent.clone().multiplyScalar(0.2)} />
        </mesh>
      </group>
    );
  }

  if (zone === 'ENTERTAINMENT') {
    return (
      <group position={position}>
        <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
          <boxGeometry args={[3.6, h, 3.0]} />
          <meshStandardMaterial color={main} emissive={selected ? accent.clone().multiplyScalar(0.3) : undefined} />
        </mesh>
        <mesh castShadow position={[0, h + 0.35, 0]}>
          <torusGeometry args={[1.4, 0.18, 12, 28]} />
          <meshStandardMaterial color={accent} emissive={accent.clone().multiplyScalar(0.35)} />
        </mesh>
      </group>
    );
  }

  if (zone === 'CIVIC') {
    return (
      <group position={position}>
        <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
          <boxGeometry args={[3.8, h, 3.4]} />
          <meshStandardMaterial color={main} emissive={selected ? accent.clone().multiplyScalar(0.25) : undefined} />
        </mesh>
        <mesh castShadow position={[-1.3, h * 0.45, 1.3]}>
          <cylinderGeometry args={[0.2, 0.2, h * 0.9, 10]} />
          <meshStandardMaterial color={'#cbd5e1'} />
        </mesh>
        <mesh castShadow position={[1.3, h * 0.45, 1.3]}>
          <cylinderGeometry args={[0.2, 0.2, h * 0.9, 10]} />
          <meshStandardMaterial color={'#cbd5e1'} />
        </mesh>
      </group>
    );
  }

  // COMMERCIAL default.
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[3.4, h, 3.4]} />
        <meshStandardMaterial color={main} emissive={selected ? accent.clone().multiplyScalar(0.25) : undefined} />
      </mesh>
      <mesh castShadow position={[0, h * 0.65, 1.8]}>
        <boxGeometry args={[2.2, 0.5, 0.15]} />
        <meshStandardMaterial color={accent} emissive={accent.clone().multiplyScalar(0.35)} />
      </mesh>
    </group>
  );
}

type AgentSim = {
  id: string;
  position: THREE.Vector3;
  heading: THREE.Vector3;
  route: THREE.Vector3[];
  speed: number;
  walk: number;
};

function AgentDroid({
  agent,
  color,
  selected,
  onClick,
}: {
  agent: Agent;
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  const body = useRef<THREE.Mesh>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Mesh>(null);
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const swing = Math.sin(t * 6) * 0.55;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.6;
    if (armR.current) armR.current.rotation.x = swing * 0.6;
    if (body.current) body.current.position.y = 1.05 + Math.sin(t * 6) * 0.06;
  });

  const glyph = ARCHETYPE_GLYPH[agent.archetype] || '●';
  const label = `${glyph}${agent.name.slice(0, 6)}`;

  return (
    <group ref={group} onPointerDown={(e) => (e.stopPropagation(), onClick())}>
      <mesh ref={legL} castShadow position={[-0.25, 0.35, 0]}>
        <boxGeometry args={[0.28, 0.7, 0.28]} />
        <meshStandardMaterial color={'#0b1220'} />
      </mesh>
      <mesh ref={legR} castShadow position={[0.25, 0.35, 0]}>
        <boxGeometry args={[0.28, 0.7, 0.28]} />
        <meshStandardMaterial color={'#0b1220'} />
      </mesh>

      <mesh ref={armL} castShadow position={[-0.55, 1.05, 0]}>
        <boxGeometry args={[0.22, 0.65, 0.22]} />
        <meshStandardMaterial color={'#1f2937'} />
      </mesh>
      <mesh ref={armR} castShadow position={[0.55, 1.05, 0]}>
        <boxGeometry args={[0.22, 0.65, 0.22]} />
        <meshStandardMaterial color={'#1f2937'} />
      </mesh>

      <mesh ref={body} castShadow position={[0, 1.05, 0]}>
        <capsuleGeometry args={[0.55, 0.9, 8, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={selected ? new THREE.Color(color).multiplyScalar(0.4) : new THREE.Color('#000')}
          emissiveIntensity={0.9}
          roughness={0.35}
          metalness={0.08}
        />
      </mesh>

      <mesh castShadow position={[0, 1.9, 0.05]}>
        <sphereGeometry args={[0.38, 16, 16]} />
        <meshStandardMaterial color={'#e2e8f0'} roughness={0.15} />
      </mesh>
      <mesh position={[-0.14, 1.95, 0.36]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color={'#0b1220'} emissive={selected ? new THREE.Color('#93c5fd') : undefined} />
      </mesh>
      <mesh position={[0.14, 1.95, 0.36]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color={'#0b1220'} emissive={selected ? new THREE.Color('#93c5fd') : undefined} />
      </mesh>

      <BillboardLabel text={label} position={[0, 2.75, 0]} color={selected ? '#e2e8f0' : '#cbd5e1'} />
    </group>
  );
}

function TownScene({
  town,
  agents,
  selectedPlotId,
  setSelectedPlotId,
  selectedAgentId,
  setSelectedAgentId,
  followCam,
}: {
  town: Town;
  agents: Agent[];
  selectedPlotId: string | null;
  setSelectedPlotId: (id: string | null) => void;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  followCam: boolean;
}) {
  const groundTex = useGroundTexture();
  const plots = town.plots;

  const grid = useMemo(() => {
    const maxX = plots.reduce((m, p) => Math.max(m, p.x), 0);
    const maxY = plots.reduce((m, p) => Math.max(m, p.y), 0);
    return { cols: maxX + 1, rows: maxY + 1 };
  }, [plots]);

  const spacing = 8;
  const lotSize = 6;
  const roadW = Math.max(1.0, spacing - lotSize);
  const halfX = (grid.cols - 1) / 2;
  const halfY = (grid.rows - 1) / 2;

  const roadNodes = useMemo(() => {
    const nodes: THREE.Vector3[] = [];
    // Include a perimeter ring so agents have somewhere to walk even in tiny towns.
    for (let ix = -1; ix <= grid.cols - 1; ix++) {
      for (let iy = -1; iy <= grid.rows - 1; iy++) {
        const wx = (ix + 0.5 - halfX) * spacing;
        const wz = (iy + 0.5 - halfY) * spacing;
        nodes.push(new THREE.Vector3(wx, 0.02, wz));
      }
    }
    return nodes;
  }, [grid.cols, grid.rows, halfX, halfY, spacing]);

  const simsRef = useRef<Map<string, AgentSim>>(new Map());
  const agentGroupRefs = useRef<Map<string, THREE.Group>>(new Map());
  const { camera } = useThree();

  useEffect(() => {
    const sims = simsRef.current;
    const agentIds = new Set(agents.map((a) => a.id));
    for (const id of Array.from(sims.keys())) {
      if (!agentIds.has(id)) sims.delete(id);
    }

    for (const a of agents) {
      if (sims.has(a.id)) continue;
      const rng = mulberry32(hashToSeed(a.id));
      const start = roadNodes[Math.floor(rng() * roadNodes.length)]?.clone() ?? new THREE.Vector3(0, 0.02, 0);
      const speed = 1.2 + rng() * 0.9;
      sims.set(a.id, {
        id: a.id,
        position: start,
        heading: new THREE.Vector3(0, 0, 1),
        route: [],
        speed,
        walk: rng() * 10,
      });
    }
  }, [agents, roadNodes]);

  function buildRoute(from: THREE.Vector3, to: THREE.Vector3) {
    const pts: THREE.Vector3[] = [];
    const mid = new THREE.Vector3(to.x, to.y, from.z);
    pts.push(mid, to);
    return pts;
  }

  useFrame((_, dt) => {
    const sims = simsRef.current;

    for (const a of agents) {
      const sim = sims.get(a.id);
      if (!sim) continue;

      if (sim.route.length === 0) {
        const rng = mulberry32(hashToSeed(`${a.id}:${Math.floor(sim.walk)}`));
        const target = roadNodes[Math.floor(rng() * roadNodes.length)]?.clone() ?? new THREE.Vector3(0, 0.02, 0);
        sim.route = buildRoute(sim.position, target);
      }

      const wp = sim.route[0];
      if (!wp) continue;

      const dir = wp.clone().sub(sim.position);
      const dist = dir.length();
      if (dist < 0.12) {
        sim.position.copy(wp);
        sim.route.shift();
        continue;
      }

      dir.normalize();
      sim.heading.lerp(dir, 0.25);
      sim.position.addScaledVector(dir, sim.speed * dt);
      sim.walk += dt * sim.speed * 2.2;

      const g = agentGroupRefs.current.get(a.id);
      if (g) {
        g.position.copy(sim.position);
        g.rotation.y = Math.atan2(sim.heading.x, sim.heading.z);
      }
    }

    if (followCam && selectedAgentId) {
      const sim = sims.get(selectedAgentId);
      if (sim) {
        const back = sim.heading.clone().normalize().multiplyScalar(-10);
        const desired = sim.position.clone().add(back).add(new THREE.Vector3(0, 7, 0));
        camera.position.lerp(desired, 0.08);
        camera.lookAt(sim.position.x, sim.position.y + 1.6, sim.position.z);
      }
    }
  });

  return (
    <group>
      <Sky distance={450000} sunPosition={[1, 1, 0]} turbidity={10} rayleigh={1.8} mieCoefficient={0.005} mieDirectionalG={0.8} />

      <fog attach="fog" args={['#050914', 30, 110]} />

      <ambientLight intensity={0.5} />
      <directionalLight
        position={[26, 40, 18]}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
      />

      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color={'#0b1220'} map={groundTex ?? undefined} roughness={1} />
      </mesh>

      {/* Roads */}
      <group position={[0, 0.01, 0]}>
        {Array.from({ length: grid.cols + 1 }).map((_, i) => {
          const x = (i - 1 - halfX) * spacing;
          const len = (grid.rows + 1) * spacing;
          return (
            <mesh key={`v-${i}`} position={[x, 0, 0]}>
              <boxGeometry args={[roadW, 0.05, len]} />
              <meshStandardMaterial color={'#0a0f1f'} roughness={0.95} />
            </mesh>
          );
        })}
        {Array.from({ length: grid.rows + 1 }).map((_, i) => {
          const z = (i - 1 - halfY) * spacing;
          const len = (grid.cols + 1) * spacing;
          return (
            <mesh key={`h-${i}`} position={[0, 0, z]}>
              <boxGeometry args={[len, 0.05, roadW]} />
              <meshStandardMaterial color={'#0a0f1f'} roughness={0.95} />
            </mesh>
          );
        })}
      </group>

      {/* Lots + Buildings */}
      {plots.map((p) => {
        const wx = (p.x - halfX) * spacing;
        const wz = (p.y - halfY) * spacing;
        const selected = p.id === selectedPlotId;
        const { color, emissive } = zoneMaterial(p.zone, selected);
        const name = p.buildingName?.trim() || (p.status === 'EMPTY' ? 'Available' : p.status.replaceAll('_', ' '));

        return (
          <group key={p.id}>
            <mesh
              receiveShadow
              position={[wx, 0.02, wz]}
              onPointerDown={(e) => {
                e.stopPropagation();
                setSelectedPlotId(p.id);
              }}
            >
              <boxGeometry args={[lotSize, 0.08, lotSize]} />
              <meshStandardMaterial
                color={color}
                emissive={emissive}
                roughness={0.92}
              />
            </mesh>

            {p.status !== 'EMPTY' && (
              <BuildingMesh plot={p} selected={selected} position={[wx, 0.06, wz]} />
            )}

            <BillboardLabel
              text={name.length > 18 ? `${name.slice(0, 18)}…` : name}
              position={[wx, 3.6, wz]}
              color={selected ? '#e2e8f0' : '#cbd5e1'}
            />
          </group>
        );
      })}

      {/* Agents */}
      <group>
        {agents.map((a) => {
          const color = ARCHETYPE_COLORS[a.archetype] || '#93c5fd';
          const selected = a.id === selectedAgentId;
          return (
            <group
              key={a.id}
              ref={(ref) => {
                if (ref) agentGroupRefs.current.set(a.id, ref);
                else agentGroupRefs.current.delete(a.id);
              }}
            >
              <AgentDroid
                agent={a}
                color={color}
                selected={selected}
                onClick={() => {
                  setSelectedAgentId(a.id);
                  setSelectedPlotId(null);
                }}
              />
            </group>
          );
        })}
      </group>

      <OrbitControls
        enabled={!followCam}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={0.35}
        minDistance={12}
        maxDistance={95}
      />
    </group>
  );
}

export default function Town3D() {
  const [towns, setTowns] = useState<TownSummary[]>([]);
  const [town, setTown] = useState<Town | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userSelectedTownIdRef = useRef<string | null>(null);
  const [selectedTownId, setSelectedTownId] = useState<string | null>(null);

  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [followCam, setFollowCam] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [townsRes, activeTownRes, agentsRes] = await Promise.all([
          apiFetch<{ towns: TownSummary[] }>('/towns'),
          apiFetch<{ town: Town | null }>('/town'),
          apiFetch<Agent[]>('/agents'),
        ]);

        if (cancelled) return;
        setTowns(townsRes.towns);
        setAgents(agentsRes);

        const activeId = activeTownRes.town?.id ?? townsRes.towns[0]?.id ?? null;
        const nextSelected = userSelectedTownIdRef.current ?? activeId;
        if (nextSelected) {
          setSelectedTownId(nextSelected);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedTownId) return;
    let cancelled = false;

    async function loadTown() {
      try {
        const res = await apiFetch<{ town: Town }>(`/town/${selectedTownId}`);
        if (!cancelled) setTown(res.town);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load town');
      }
    }

    void loadTown();
    const t = setInterval(loadTown, 2500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [selectedTownId]);

  useEffect(() => {
    let cancelled = false;
    async function loadAgents() {
      try {
        const res = await apiFetch<Agent[]>('/agents');
        if (!cancelled) setAgents(res);
      } catch {
        // ignore
      }
    }
    const t = setInterval(loadAgents, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const selectedPlot = useMemo(() => town?.plots.find((p) => p.id === selectedPlotId) ?? null, [town, selectedPlotId]);
  const selectedAgent = useMemo(() => agents.find((a) => a.id === selectedAgentId) ?? null, [agents, selectedAgentId]);
  const agentById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  if (loading) {
    return (
      <div className="h-[100svh] w-full grid place-items-center bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
        <div className="flex items-center gap-2 text-slate-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading city…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[100svh] w-full grid place-items-center bg-slate-950">
        <div className="max-w-lg text-center text-slate-200">
          <p className="font-mono text-sm text-red-300">{error}</p>
          <p className="mt-2 text-xs text-slate-400">Make sure the backend is running on `localhost:4000`.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => window.location.reload()} variant="secondary">
              Reload
            </Button>
            <Button asChild variant="outline">
              <Link to="/terminal">Terminal</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!town) {
    return (
      <div className="h-[100svh] w-full grid place-items-center bg-slate-950 text-slate-200">
        <div className="text-center">
          <p className="text-sm">No town found.</p>
          <p className="mt-1 text-xs text-slate-400">Create one via `POST /api/v1/town/next` or restart the backend.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[100svh] w-full overflow-hidden bg-[#050914]">
      {/* 3D Canvas */}
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [26, 28, 26], fov: 50, near: 0.1, far: 500 }}
        onPointerMissed={() => {
          setSelectedPlotId(null);
          setSelectedAgentId(null);
        }}
      >
        <TownScene
          town={town}
          agents={agents}
          selectedPlotId={selectedPlotId}
          setSelectedPlotId={setSelectedPlotId}
          selectedAgentId={selectedAgentId}
          setSelectedAgentId={setSelectedAgentId}
          followCam={followCam}
        />
      </Canvas>

      {/* Overlay UI */}
      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute left-3 top-3 w-[360px] max-w-[calc(100vw-24px)]">
          <Card className="border-slate-800/70 bg-slate-950/70 backdrop-blur-md p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-100">AI Town</span>
                  <Badge variant="outline" className="border-slate-700/70 text-slate-300 text-[10px]">
                    {town.status}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-slate-300">
                  <span className="font-mono">{town.name}</span>
                  <span className="text-slate-500"> · </span>
                  <span className="text-slate-400">{town.theme || 'unthemed'}</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {town.builtPlots}/{town.totalPlots} plots built · {Math.round(town.completionPct)}%
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" className="pointer-events-auto">
                  <Link to="/arena">Arena</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="pointer-events-auto">
                  <Link to="/terminal">Terminal</Link>
                </Button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="text-[11px] text-slate-400">Town</label>
              <select
                className="h-8 flex-1 min-w-[180px] rounded-md border border-slate-800 bg-slate-950/70 px-2 text-xs text-slate-200"
                value={selectedTownId ?? ''}
                onChange={(e) => {
                  const id = e.target.value || null;
                  userSelectedTownIdRef.current = id;
                  setSelectedTownId(id);
                  setSelectedPlotId(null);
                  setSelectedAgentId(null);
                  setFollowCam(false);
                }}
              >
                {towns.map((t) => (
                  <option key={t.id} value={t.id}>
                    L{t.level} · {t.name} ({t.status})
                  </option>
                ))}
              </select>

              <Button
                size="sm"
                variant={followCam ? 'secondary' : 'outline'}
                onClick={() => setFollowCam((v) => !v)}
                disabled={!selectedAgentId}
                title={selectedAgentId ? 'Follow selected agent' : 'Select an agent to follow'}
              >
                Follow
              </Button>
            </div>
          </Card>
        </div>

        <div className="pointer-events-auto absolute right-3 top-3 w-[320px] max-w-[calc(100vw-24px)]">
          <Card className="border-slate-800/70 bg-slate-950/70 backdrop-blur-md p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-100">Agents</div>
              <div className="text-[11px] text-slate-500">{agents.length}</div>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1 max-h-[38svh] overflow-auto pr-1">
              {agents.map((a) => {
                const color = ARCHETYPE_COLORS[a.archetype] || '#93c5fd';
                const glyph = ARCHETYPE_GLYPH[a.archetype] || '●';
                const active = a.id === selectedAgentId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`flex items-center justify-between rounded-md border px-2 py-1 text-left text-xs transition-colors ${
                      active
                        ? 'border-slate-600 bg-slate-900/60'
                        : 'border-slate-800 bg-slate-950/40 hover:bg-slate-900/40'
                    }`}
                    onClick={() => {
                      setSelectedAgentId(a.id);
                      setSelectedPlotId(null);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="font-mono text-slate-200">
                        {glyph} {a.name}
                      </span>
                    </span>
                    <span className="text-[11px] text-slate-500">ELO {a.elo}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="pointer-events-auto absolute left-3 bottom-3 w-[420px] max-w-[calc(100vw-24px)]">
          <Card className="border-slate-800/70 bg-slate-950/70 backdrop-blur-md p-3">
            <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
              {(Object.keys(ZONE_COLORS) as PlotZone[]).map((z) => (
                <span key={z} className="inline-flex items-center gap-1">
                  <span className="inline-flex h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ZONE_COLORS[z] }} />
                  {z.slice(0, 3)}
                </span>
              ))}
              <span className="text-slate-600">|</span>
              {Object.keys(ARCHETYPE_GLYPH).map((k) => (
                <span key={k} className="inline-flex items-center gap-1">
                  <span className="font-mono" style={{ color: ARCHETYPE_COLORS[k] || '#cbd5e1' }}>
                    {ARCHETYPE_GLYPH[k]}
                  </span>
                  {k.slice(0, 4)}
                </span>
              ))}
            </div>
          </Card>
        </div>

        {(selectedPlot || selectedAgent) && (
          <div className="pointer-events-auto absolute right-3 bottom-3 w-[420px] max-w-[calc(100vw-24px)]">
            <Card className="border-slate-800/70 bg-slate-950/70 backdrop-blur-md p-3">
              {selectedPlot && (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-100">Plot #{selectedPlot.plotIndex}</div>
                      <div className="mt-1 text-sm text-slate-200 font-mono">
                        {selectedPlot.buildingName || 'Available'}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {selectedPlot.zone} · {selectedPlot.status}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setSelectedPlotId(null)}>
                      Close
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-2">
                      <div className="text-slate-500">API calls</div>
                      <div className="font-mono text-slate-100">{selectedPlot.apiCallsUsed ?? 0}</div>
                    </div>
                    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-2">
                      <div className="text-slate-500">$ARENA</div>
                      <div className="font-mono text-slate-100">{selectedPlot.buildCostArena ?? 0}</div>
                    </div>
                  </div>
                  {selectedPlot.ownerId && (
                    <div className="mt-2 text-[11px] text-slate-400">
                      Owner:{' '}
                      <span className="text-slate-200 font-mono">
                        {(() => {
                          const owner = agentById.get(selectedPlot.ownerId!);
                          if (!owner) return selectedPlot.ownerId.slice(0, 8);
                          const g = ARCHETYPE_GLYPH[owner.archetype] || '●';
                          return `${g} ${owner.name}`;
                        })()}
                      </span>
                    </div>
                  )}
                  {selectedPlot.buildingDesc && (
                    <div className="mt-2 text-xs text-slate-300 leading-snug">
                      {selectedPlot.buildingDesc}
                    </div>
                  )}
                </div>
              )}

              {selectedAgent && !selectedPlot && (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-100">Agent</div>
                      <div className="mt-1 text-sm text-slate-200 font-mono">
                        {(ARCHETYPE_GLYPH[selectedAgent.archetype] || '●') + ' ' + selectedAgent.name}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">{selectedAgent.archetype} · ELO {selectedAgent.elo}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setSelectedAgentId(null)}>
                      Close
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-300">
                    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-2">
                      <div className="text-slate-500">Bankroll</div>
                      <div className="font-mono text-slate-100">{Math.round(selectedAgent.bankroll)}</div>
                    </div>
                    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-2">
                      <div className="text-slate-500">W/L</div>
                      <div className="font-mono text-slate-100">
                        {selectedAgent.wins}/{selectedAgent.losses}
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-2">
                      <div className="text-slate-500">API $</div>
                      <div className="font-mono text-slate-100">
                        {((selectedAgent.apiCostCents || 0) / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

