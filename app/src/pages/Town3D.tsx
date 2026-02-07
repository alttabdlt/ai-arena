import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky, Line } from '@react-three/drei';
import { Button } from '@ui/button';
import { Badge } from '@ui/badge';
import { Card } from '@ui/card';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { WalletConnect } from '../components/WalletConnect';
import { playSound, isSoundEnabled, setSoundEnabled } from '../utils/sounds';

const API_BASE = '/api/v1';
const TOWN_SPACING = 8;

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
  level?: number;
  status: string;
  totalPlots: number;
  builtPlots: number;
  completionPct: number;
  totalInvested: number;
  yieldPerTick?: number;
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
  reserveBalance: number;
  wins: number;
  losses: number;
  draws?: number;
  elo: number;
  apiCostCents?: number;
  isInMatch?: boolean;
}

interface EconomyPoolSummary {
  id: string;
  reserveBalance: number;
  arenaBalance: number;
  feeBps: number;
  cumulativeFeesReserve: number;
  cumulativeFeesArena: number;
  spotPrice: number;
  updatedAt: string;
}

interface EconomySwapRow {
  id: string;
  createdAt: string;
  agent: { id: string; name: string; archetype: string };
  side: 'BUY_ARENA' | 'SELL_ARENA';
  amountIn: number;
  amountOut: number;
  feeAmount: number;
  priceBefore: number;
  priceAfter: number;
}

interface TownEvent {
  id: string;
  townId: string;
  agentId: string | null;
  eventType:
    | 'PLOT_CLAIMED'
    | 'BUILD_STARTED'
    | 'BUILD_COMPLETED'
    | 'TOWN_COMPLETED'
    | 'YIELD_DISTRIBUTED'
    | 'TRADE'
    | 'ARENA_MATCH'
    | 'CUSTOM';
  title: string;
  description: string;
  metadata: string;
  createdAt: string;
}

interface Contributor {
  agentId: string;
  agentName: string;
  archetype: string;
  arenaSpent: number;
  plotsBuilt: number;
  yieldShare: number;
  totalYieldClaimed: number;
}

type ActivityItem = 
  | { kind: 'swap'; data: EconomySwapRow }
  | { kind: 'event'; data: TownEvent };

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

// Activity indicator emojis
const ACTIVITY_INDICATORS: Record<AgentActivity, { emoji: string; color: string } | null> = {
  WALKING: null, // No indicator when walking
  IDLE: { emoji: '💤', color: '#94a3b8' },
  SHOPPING: { emoji: '🛒', color: '#34d399' },
  CHATTING: { emoji: '💬', color: '#60a5fa' },
  BUILDING: { emoji: '🔨', color: '#fbbf24' },
  MINING: { emoji: '⛏️', color: '#f97316' },
  PLAYING: { emoji: '🎮', color: '#a855f7' },
  BEGGING: { emoji: '🙏', color: '#9ca3af' },
  SCHEMING: { emoji: '🤫', color: '#6366f1' },
};

// Economic state indicators (shown as secondary badge)
const ECONOMIC_INDICATORS: Record<AgentEconomicState, { emoji: string; color: string }> = {
  THRIVING: { emoji: '💎', color: '#22d3ee' },
  COMFORTABLE: { emoji: '😊', color: '#22c55e' },
  STRUGGLING: { emoji: '😰', color: '#eab308' },
  BROKE: { emoji: '😫', color: '#f97316' },
  HOMELESS: { emoji: '🥺', color: '#ef4444' },
  DEAD: { emoji: '💀', color: '#6b7280' },
  RECOVERING: { emoji: '🩹', color: '#a855f7' },
};

// Legacy mapping for backward compatibility
const STATE_INDICATORS: Record<AgentState, { emoji: string; color: string } | null> = {
  ...ACTIVITY_INDICATORS,
  DEAD: { emoji: '💀', color: '#ef4444' },
};

function drawEmojiTexture(emoji: string) {
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  ctx.font = `${size * 0.75}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

// Pre-create emoji textures for performance
const EMOJI_TEXTURES: Record<string, THREE.Texture> = {};
function getEmojiTexture(emoji: string) {
  if (!EMOJI_TEXTURES[emoji]) {
    EMOJI_TEXTURES[emoji] = drawEmojiTexture(emoji);
  }
  return EMOJI_TEXTURES[emoji];
}

function StateIndicator({
  agentId,
  simsRef,
}: {
  agentId: string;
  simsRef: React.MutableRefObject<Map<string, AgentSim>>;
}) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const [currentState, setCurrentState] = useState<AgentState>('WALKING');

  useFrame(() => {
    const sim = simsRef.current.get(agentId);
    if (sim && sim.state !== currentState) {
      setCurrentState(sim.state);
    }
  });

  const indicator = STATE_INDICATORS[currentState];
  if (!indicator) return null;

  const texture = getEmojiTexture(indicator.emoji);

  return (
    <sprite ref={spriteRef} position={[0, 3.3, 0]} scale={[0.6, 0.6, 1]}>
      <spriteMaterial map={texture} transparent opacity={0.95} depthWrite={false} />
    </sprite>
  );
}

// Economic state indicator (wealth tier badge)
function EconomicIndicator({
  agent,
}: {
  agent: Agent;
}) {
  const economicState = getEconomicState(agent.bankroll + agent.reserveBalance, false);
  const indicator = ECONOMIC_INDICATORS[economicState];
  
  // Only show for non-comfortable states (dramatic moments)
  if (economicState === 'COMFORTABLE') return null;
  
  const texture = getEmojiTexture(indicator.emoji);

  return (
    <sprite position={[0.5, 3.0, 0]} scale={[0.4, 0.4, 1]}>
      <spriteMaterial map={texture} transparent opacity={0.85} depthWrite={false} />
    </sprite>
  );
}

// Health bar floating above agent
function HealthBar({
  agentId,
  simsRef,
}: {
  agentId: string;
  simsRef: React.MutableRefObject<Map<string, AgentSim>>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const fillRef = useRef<THREE.Mesh>(null);
  const [health, setHealth] = useState(100);

  useFrame(() => {
    const sim = simsRef.current.get(agentId);
    if (sim && sim.health !== health) {
      setHealth(sim.health);
    }
    // Update fill scale
    if (fillRef.current) {
      const pct = Math.max(0, Math.min(1, health / 100));
      fillRef.current.scale.x = pct;
      fillRef.current.position.x = (pct - 1) * 0.4;
    }
  });

  // Don't show at full health
  if (health >= 100) return null;

  const healthColor = health > 60 ? '#22c55e' : health > 30 ? '#eab308' : '#ef4444';

  return (
    <group ref={groupRef} position={[0, 2.5, 0]}>
      {/* Background bar */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[0.9, 0.12]} />
        <meshBasicMaterial color="#1f2937" transparent opacity={0.8} />
      </mesh>
      {/* Health fill */}
      <mesh ref={fillRef} position={[0, 0, 0.01]}>
        <planeGeometry args={[0.8, 0.08]} />
        <meshBasicMaterial color={healthColor} />
      </mesh>
    </group>
  );
}

// Progress bar for buildings under construction
function BuildProgressBar({ progress, position }: { progress: number; position: [number, number, number] }) {
  const pct = Math.max(0, Math.min(1, progress));
  
  return (
    <group position={position}>
      {/* Background */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[3.5, 0.25]} />
        <meshBasicMaterial color="#1e293b" transparent opacity={0.9} />
      </mesh>
      {/* Fill */}
      <mesh position={[(pct - 1) * 1.6, 0, 0.01]} scale={[pct, 1, 1]}>
        <planeGeometry args={[3.2, 0.18]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
      {/* Percentage text sprite */}
      <BillboardLabel 
        text={`${Math.round(pct * 100)}%`} 
        position={[0, 0.4, 0]} 
        color="#fbbf24" 
      />
    </group>
  );
}

// Particle system for effects
function ParticleEffect({
  position,
  color,
  count = 12,
  onComplete,
}: {
  position: [number, number, number];
  color: string;
  count?: number;
  onComplete?: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<{ pos: THREE.Vector3; vel: THREE.Vector3; life: number }[]>([]);
  const [alive, setAlive] = useState(true);

  useEffect(() => {
    // Initialize particles
    particlesRef.current = Array.from({ length: count }, () => ({
      pos: new THREE.Vector3(0, 0, 0),
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 3 + 2,
        (Math.random() - 0.5) * 4
      ),
      life: 1,
    }));
  }, [count]);

  useFrame((_, dt) => {
    if (!groupRef.current || !alive) return;
    
    let allDead = true;
    const children = groupRef.current.children as THREE.Mesh[];
    
    particlesRef.current.forEach((p, i) => {
      if (p.life <= 0) return;
      
      p.life -= dt * 1.5;
      p.vel.y -= dt * 8; // gravity
      p.pos.add(p.vel.clone().multiplyScalar(dt));
      
      if (children[i]) {
        children[i].position.copy(p.pos);
        children[i].scale.setScalar(p.life * 0.3);
        (children[i].material as THREE.MeshBasicMaterial).opacity = p.life;
      }
      
      if (p.life > 0) allDead = false;
    });
    
    if (allDead) {
      setAlive(false);
      onComplete?.();
    }
  });

  if (!alive) return null;

  return (
    <group ref={groupRef} position={position}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshBasicMaterial color={color} transparent />
        </mesh>
      ))}
    </group>
  );
}

// Agent destination line (path visualization)
function DestinationLine({
  agentId,
  simsRef,
  color,
}: {
  agentId: string;
  simsRef: React.MutableRefObject<Map<string, AgentSim>>;
  color: string;
}) {
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const lastSigRef = useRef<{ len: number; start: THREE.Vector3; end: THREE.Vector3 } | null>(null);

  useFrame(() => {
    const sim = simsRef.current.get(agentId);
    if (!sim || sim.state === 'DEAD' || sim.route.length === 0) {
      setPoints((prev) => (prev.length > 0 ? [] : prev));
      lastSigRef.current = null;
      return;
    }
    
    const start = sim.position;
    const end = sim.route[sim.route.length - 1] ?? start;
    const last = lastSigRef.current;

    const posThresholdSq = 0.2 * 0.2;
    const lenChanged = !last || last.len !== sim.route.length;
    const startMoved = !last || last.start.distanceToSquared(start) > posThresholdSq;
    const endMoved = !last || last.end.distanceToSquared(end) > posThresholdSq;

    if (lenChanged || startMoved || endMoved) {
      const newPoints = [start.clone(), ...sim.route.map((p) => p.clone())];
      setPoints(newPoints);
      lastSigRef.current = { len: sim.route.length, start: start.clone(), end: end.clone() };
    }
  });

  if (points.length < 2) return null;

  return (
    <Line
      points={points}
      color={color}
      lineWidth={1.5}
      transparent
      opacity={0.3}
      dashed
      dashSize={0.3}
      gapSize={0.2}
    />
  );
}

// Animated construction crane/scaffolding
function ConstructionAnimation({ position }: { position: [number, number, number] }) {
  const craneRef = useRef<THREE.Group>(null);
  const hookRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (craneRef.current) {
      craneRef.current.rotation.y = Math.sin(t * 0.3) * 0.4;
    }
    if (hookRef.current) {
      hookRef.current.position.y = 2.5 + Math.sin(t * 1.5) * 0.5;
    }
  });

  return (
    <group position={position}>
      {/* Crane base */}
      <mesh position={[1.8, 1.5, 1.8]}>
        <boxGeometry args={[0.3, 3, 0.3]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>
      {/* Crane arm */}
      <group ref={craneRef} position={[1.8, 3, 1.8]}>
        <mesh position={[-1, 0.15, 0]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.2, 2.5, 0.2]} />
          <meshStandardMaterial color="#fbbf24" />
        </mesh>
        {/* Hook */}
        <mesh ref={hookRef} position={[-2, 2.5, 0]}>
          <boxGeometry args={[0.15, 0.5, 0.15]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
        {/* Cable */}
        <mesh position={[-2, 2.8, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.8, 8]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      </group>
    </group>
  );
}

// Speech bubble for chatting agents
function SpeechBubble({ text, position }: { text: string; position: [number, number, number] }) {
  const { texture, width, height } = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { texture: new THREE.Texture(), width: 1, height: 1 };

    const fontSize = 20;
    ctx.font = `${fontSize}px ui-monospace, monospace`;
    const displayText = text.slice(0, 20);
    const metrics = ctx.measureText(displayText);
    const w = Math.max(60, metrics.width + 20);
    const h = fontSize + 16;
    canvas.width = w;
    canvas.height = h;

    // Bubble background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    // roundRect isn't supported everywhere (or typed consistently), so keep a small fallback.
    type RoundRectCapable = CanvasRenderingContext2D & {
      roundRect?: (x: number, y: number, w: number, h: number, radii: number) => void;
    };
    const roundRect = (ctx as RoundRectCapable).roundRect;
    if (typeof roundRect === 'function') {
      roundRect.call(ctx, 0, 0, w, h - 6, 8);
    } else {
      const r = 8;
      const ww = w;
      const hh = h - 6;
      ctx.moveTo(r, 0);
      ctx.arcTo(ww, 0, ww, hh, r);
      ctx.arcTo(ww, hh, 0, hh, r);
      ctx.arcTo(0, hh, 0, 0, r);
      ctx.arcTo(0, 0, ww, 0, r);
      ctx.closePath();
    }
    ctx.fill();
    
    // Tail
    ctx.beginPath();
    ctx.moveTo(w / 2 - 6, h - 6);
    ctx.lineTo(w / 2, h);
    ctx.lineTo(w / 2 + 6, h - 6);
    ctx.fill();

    // Text
    ctx.fillStyle = '#1e293b';
    ctx.font = `${fontSize}px ui-monospace, monospace`;
    ctx.textBaseline = 'middle';
    ctx.fillText(displayText, 10, (h - 6) / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return { texture, width: w, height: h };
  }, [text]);

  const aspect = width / height;
  const worldHeight = 0.5;
  const worldWidth = worldHeight * aspect;

  return (
    <sprite position={position} scale={[worldWidth, worldHeight, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

// Claimed plot marker (flag/stake)
function ClaimedMarker({ position, color }: { position: [number, number, number]; color: string }) {
  const flagRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (flagRef.current) {
      flagRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });

  return (
    <group position={position}>
      {/* Stake */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 1, 8]} />
        <meshStandardMaterial color="#8b5a2b" />
      </mesh>
      {/* Flag */}
      <mesh ref={flagRef} position={[0.25, 0.85, 0]}>
        <planeGeometry args={[0.5, 0.3]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} emissive={color} emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

// Building windows (glowing at night)
function BuildingWindows({ height, zone }: { height: number; zone: PlotZone }) {
  const windowColor = ZONE_COLORS[zone];
  const rows = Math.max(1, Math.floor(height / 1.2));
  const cols = 2;
  
  return (
    <group>
      {Array.from({ length: rows }).map((_, row) => (
        Array.from({ length: cols }).map((_, col) => {
          const x = (col - 0.5) * 0.8;
          const y = 0.8 + row * 1.0;
          const z = 1.45;
          // Randomly lit windows
          const isLit = Math.random() > 0.3;
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
      )).flat()}
    </group>
  );
}

// Ambient floating particles
function AmbientParticles({ count = 50 }: { count?: number }) {
  const particlesRef = useRef<THREE.Points>(null);
  
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 80;
      arr[i * 3 + 1] = Math.random() * 15 + 2;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (!particlesRef.current) return;
    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] += Math.sin(t + i) * 0.002;
      positions[i * 3] += Math.cos(t * 0.5 + i) * 0.001;
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#94a3b8" size={0.15} transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

// Agent trail effect
function AgentTrail({
  agentId,
  simsRef,
  color,
}: {
  agentId: string;
  simsRef: React.MutableRefObject<Map<string, AgentSim>>;
  color: string;
}) {
  const trailRef = useRef<THREE.Vector3[]>([]);
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const maxLength = 15;

  useFrame(() => {
    const sim = simsRef.current.get(agentId);
    if (!sim || sim.state === 'DEAD') return;

    const trail = trailRef.current;
    const currentPos = sim.position.clone();
    currentPos.y = 0.1;

    // Add point if moved enough
    const lastPoint = trail[trail.length - 1];
    if (!lastPoint || currentPos.distanceTo(lastPoint) > 0.3) {
      trail.push(currentPos);
      if (trail.length > maxLength) trail.shift();
      setPoints([...trail]);
    }
  });

  if (points.length < 2) return null;

  return (
    <Line
      points={points}
      color={color}
      lineWidth={2}
      transparent
      opacity={0.2}
    />
  );
}

// Day/Night cycle controller
function DayNightCycle({ timeScale = 0.02 }: { timeScale?: number }) {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const skyRef = useRef<THREE.Mesh | null>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime * timeScale;
    const angle = t % (Math.PI * 2);
    
    // Sun orbits around
    const x = Math.cos(angle) * 50;
    const y = Math.sin(angle) * 40 + 10; // Keep above horizon mostly
    const z = Math.sin(angle * 0.5) * 30;
    
    if (sunRef.current) {
      sunRef.current.position.set(x, Math.max(y, 5), z);
      // Dim light at night
      const dayFactor = Math.max(0, Math.min(1, (y + 10) / 50));
      sunRef.current.intensity = 0.3 + dayFactor * 0.9;
    }

    // Avoid setState in the render loop; update the Sky shader uniform directly.
    type SunPosLike = { set: (x: number, y: number, z: number) => void };
    type SkyMaterialLike = { uniforms?: { sunPosition?: { value?: SunPosLike } } };
    const skyMesh = skyRef.current;
    const sunPos = (skyMesh?.material as unknown as SkyMaterialLike | undefined)?.uniforms?.sunPosition?.value;
    if (sunPos) {
      sunPos.set(x, Math.max(y, -5), z);
    }
  });

  return (
    <>
      <Sky 
        ref={skyRef}
        distance={450000} 
        sunPosition={[1, 1, 0]} 
        turbidity={10} 
        rayleigh={1.8} 
        mieCoefficient={0.005} 
        mieDirectionalG={0.8} 
      />
      <directionalLight
        ref={sunRef}
        position={[1, 1, 0]}
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
    </>
  );
}

// Rain effect
function RainEffect({ intensity = 200 }: { intensity?: number }) {
  const rainRef = useRef<THREE.Points>(null);
  
  const positions = useMemo(() => {
    const arr = new Float32Array(intensity * 3);
    for (let i = 0; i < intensity; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 100;
      arr[i * 3 + 1] = Math.random() * 30 + 5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    return arr;
  }, [intensity]);

  useFrame(() => {
    if (!rainRef.current) return;
    const pos = rainRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < intensity; i++) {
      pos[i * 3 + 1] -= 0.5; // Fall speed
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3 + 1] = 30 + Math.random() * 10;
        pos[i * 3] = (Math.random() - 0.5) * 100;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 100;
      }
    }
    rainRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={rainRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={intensity}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial 
        color="#a8c8e8" 
        size={0.1} 
        transparent 
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

// Coin burst effect for transactions
function CoinBurst({ 
  position, 
  isBuy,
  onComplete 
}: { 
  position: [number, number, number]; 
  isBuy: boolean;
  onComplete?: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const coinsRef = useRef<{ pos: THREE.Vector3; vel: THREE.Vector3; rot: number }[]>([]);
  const [alive, setAlive] = useState(true);
  const startTime = useRef(Date.now());

  useEffect(() => {
    coinsRef.current = Array.from({ length: 8 }, () => ({
      pos: new THREE.Vector3(0, 0, 0),
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 4 + 2,
        (Math.random() - 0.5) * 3
      ),
      rot: Math.random() * Math.PI * 2,
    }));
  }, []);

  useFrame((_, dt) => {
    if (!groupRef.current || !alive) return;
    
    const elapsed = (Date.now() - startTime.current) / 1000;
    if (elapsed > 1.5) {
      setAlive(false);
      onComplete?.();
      return;
    }

    const children = groupRef.current.children as THREE.Mesh[];
    coinsRef.current.forEach((coin, i) => {
      coin.vel.y -= dt * 10;
      coin.pos.add(coin.vel.clone().multiplyScalar(dt));
      coin.rot += dt * 8;
      
      if (children[i]) {
        children[i].position.copy(coin.pos);
        children[i].rotation.y = coin.rot;
        const fade = Math.max(0, 1 - elapsed / 1.5);
        (children[i].material as THREE.MeshStandardMaterial).opacity = fade;
      }
    });
  });

  if (!alive) return null;

  return (
    <group ref={groupRef} position={position}>
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i}>
          <cylinderGeometry args={[0.15, 0.15, 0.05, 16]} />
          <meshStandardMaterial 
            color={isBuy ? '#fbbf24' : '#ef4444'} 
            emissive={isBuy ? '#fbbf24' : '#ef4444'}
            emissiveIntensity={0.5}
            transparent 
          />
        </mesh>
      ))}
    </group>
  );
}

// Death smoke effect
function DeathSmoke({ position, onComplete }: { position: [number, number, number]; onComplete?: () => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const smokesRef = useRef<{ pos: THREE.Vector3; scale: number; opacity: number }[]>([]);
  const [alive, setAlive] = useState(true);
  const startTime = useRef(Date.now());

  useEffect(() => {
    smokesRef.current = Array.from({ length: 6 }, (_, i) => ({
      pos: new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        i * 0.3,
        (Math.random() - 0.5) * 0.5
      ),
      scale: 0.3 + Math.random() * 0.3,
      opacity: 0.8,
    }));
  }, []);

  useFrame((_, dt) => {
    if (!groupRef.current || !alive) return;
    
    const elapsed = (Date.now() - startTime.current) / 1000;
    if (elapsed > 2) {
      setAlive(false);
      onComplete?.();
      return;
    }

    const children = groupRef.current.children as THREE.Mesh[];
    smokesRef.current.forEach((smoke, i) => {
      smoke.pos.y += dt * 1.5;
      smoke.scale += dt * 0.5;
      smoke.opacity = Math.max(0, 0.8 - elapsed / 2);
      
      if (children[i]) {
        children[i].position.copy(smoke.pos);
        children[i].scale.setScalar(smoke.scale);
        (children[i].material as THREE.MeshStandardMaterial).opacity = smoke.opacity;
      }
    });
  });

  if (!alive) return null;

  return (
    <group ref={groupRef} position={position}>
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.5, 8, 8]} />
          <meshStandardMaterial color="#4b5563" transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// Spawn sparkle effect
function SpawnSparkle({ position, color, onComplete }: { position: [number, number, number]; color: string; onComplete?: () => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const [alive, setAlive] = useState(true);
  const startTime = useRef(Date.now());

  useFrame(() => {
    if (!groupRef.current || !alive) return;
    
    const elapsed = (Date.now() - startTime.current) / 1000;
    if (elapsed > 1) {
      setAlive(false);
      onComplete?.();
      return;
    }

    // Expand ring
    groupRef.current.scale.setScalar(1 + elapsed * 3);
    groupRef.current.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      (mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 1 - elapsed);
      mesh.rotation.y = elapsed * 5 + i * 0.5;
    });
  });

  if (!alive) return null;

  return (
    <group ref={groupRef} position={position}>
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * 0.5, 0.5, Math.sin(angle) * 0.5]}>
            <boxGeometry args={[0.1, 0.3, 0.1]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} transparent />
          </mesh>
        );
      })}
    </group>
  );
}

// Hover tooltip for 3D objects
function HoverTooltip({ 
  text, 
  visible, 
  worldPosition 
}: { 
  text: string; 
  visible: boolean; 
  worldPosition: THREE.Vector3;
}) {
  const { camera } = useThree();
  const [screenPos, setScreenPos] = useState({ x: 0, y: 0 });

  useFrame(() => {
    if (!visible) return;
    const pos = worldPosition.clone().project(camera);
    setScreenPos({
      x: (pos.x * 0.5 + 0.5) * window.innerWidth,
      y: (-pos.y * 0.5 + 0.5) * window.innerHeight,
    });
  });

  if (!visible) return null;

  // This renders in 3D space - for HTML tooltips we'd need Html from drei
  return (
    <BillboardLabel 
      text={text} 
      position={[worldPosition.x, worldPosition.y + 2, worldPosition.z]} 
      color="#fbbf24"
    />
  );
}

// Industrial smoke from factories
function IndustrialSmoke({ position, intensity = 1 }: { position: [number, number, number]; intensity?: number }) {
  const smokesRef = useRef<THREE.Points>(null);
  const count = Math.floor(20 * intensity);
  
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 0.5;
      arr[i * 3 + 1] = Math.random() * 3;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (!smokesRef.current) return;
    const pos = smokesRef.current.geometry.attributes.position.array as Float32Array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += 0.02; // Rise
      pos[i * 3] += Math.sin(t + i) * 0.005; // Drift
      pos[i * 3 + 2] += Math.cos(t * 0.7 + i) * 0.005;
      if (pos[i * 3 + 1] > 5) {
        pos[i * 3 + 1] = 0;
        pos[i * 3] = (Math.random() - 0.5) * 0.5;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
      }
    }
    smokesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={smokesRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#4b5563" size={0.4} transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

// Smog layer for polluted towns
function SmogLayer({ pollution }: { pollution: number }) {
  if (pollution < 0.3) return null;
  
  const opacity = (pollution - 0.3) * 0.4; // Max 0.28 opacity at full pollution
  
  return (
    <mesh position={[0, 15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial color="#3d3825" transparent opacity={opacity} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Market sentiment sky tint
function SentimentAmbience({ sentiment }: { sentiment: 'bull' | 'bear' | 'neutral' }) {
  const color = sentiment === 'bull' ? '#1a2f1a' : sentiment === 'bear' ? '#2f1a1a' : '#1a1a2f';
  const intensity = sentiment === 'neutral' ? 0 : 0.15;
  
  return (
    <mesh position={[0, 50, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[300, 300]} />
      <meshBasicMaterial color={color} transparent opacity={intensity} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Prosperity sparkles (golden particles in prosperous towns)
function ProsperitySparkles({ prosperity }: { prosperity: number }) {
  const sparklesRef = useRef<THREE.Points>(null);
  const count = Math.floor(prosperity * 30);
  
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 60;
      arr[i * 3 + 1] = Math.random() * 8 + 2;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (!sparklesRef.current || count === 0) return;
    const t = state.clock.elapsedTime;
    sparklesRef.current.rotation.y = t * 0.05;
  });

  if (count === 0) return null;

  return (
    <points ref={sparklesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#fbbf24" size={0.2} transparent opacity={0.6} sizeAttenuation />
    </points>
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

function timeAgo(ts: string) {
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return `${h}h`;
}

function prettyJson(raw: string | undefined, maxLen: number = 2200): string {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2).slice(0, maxLen);
  } catch {
    return String(raw).slice(0, maxLen);
  }
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
    // Calculate progress based on API calls (assume 10 calls = complete)
    const maxCalls = 10;
    const progress = Math.min(1, (plot.apiCallsUsed || 0) / maxCalls);
    const partialHeight = 0.8 + progress * (h - 0.8);
    
    // Under construction scaffold with progress bar and crane
    return (
      <group position={position}>
        {/* Partial building rising */}
        <mesh position={[0, partialHeight / 2, 0]}>
          <boxGeometry args={[3.6, partialHeight, 3.6]} />
          <meshStandardMaterial 
            color={'#0b1220'} 
            emissive={tint.clone().multiplyScalar(selected ? 0.35 : 0.1)} 
          />
        </mesh>
        {/* Construction platform */}
        <mesh position={[0, partialHeight + 0.05, 0]}>
          <boxGeometry args={[3.9, 0.1, 3.9]} />
          <meshStandardMaterial color={accent} emissive={accent.clone().multiplyScalar(0.3)} />
        </mesh>
        {/* Wireframe outline of final building */}
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[4.0, h, 4.0]} />
          <meshStandardMaterial color={'#93c5fd'} transparent opacity={0.08} wireframe />
        </mesh>
        {/* Scaffolding poles */}
        {[[-1.9, 1.9], [1.9, 1.9], [-1.9, -1.9], [1.9, -1.9]].map(([x, z], i) => (
          <mesh key={i} position={[x, h / 2, z]}>
            <cylinderGeometry args={[0.08, 0.08, h, 8]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
        ))}
        {/* Progress bar */}
        <BuildProgressBar progress={progress} position={[0, h + 0.8, 0]} />
        {/* Animated crane */}
        {plot.status === 'UNDER_CONSTRUCTION' && <ConstructionAnimation position={[0, 0, 0]} />}
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
        {/* Windows */}
        <BuildingWindows height={h} zone={zone} />
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
        {/* Smokestack */}
        <mesh castShadow position={[1.4, h * 0.62, -0.6]}>
          <cylinderGeometry args={[0.32, 0.4, h * 0.9, 10]} />
          <meshStandardMaterial color={'#64748b'} />
        </mesh>
        <mesh castShadow position={[1.4, h * 1.05, -0.6]}>
          <sphereGeometry args={[0.35, 10, 10]} />
          <meshStandardMaterial color={accent} emissive={accent.clone().multiplyScalar(0.2)} />
        </mesh>
        {/* Factory smoke */}
        <IndustrialSmoke position={[1.4, h * 1.2, -0.6]} intensity={1.2} />
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
        <BuildingWindows height={h} zone={zone} />
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

// Agent activity states
type AgentActivity = 'WALKING' | 'IDLE' | 'SHOPPING' | 'CHATTING' | 'BUILDING' | 'MINING' | 'PLAYING' | 'BEGGING' | 'SCHEMING';

// Agent economic states (based on bankroll)
type AgentEconomicState = 'THRIVING' | 'COMFORTABLE' | 'STRUGGLING' | 'BROKE' | 'HOMELESS' | 'DEAD' | 'RECOVERING';

// Combined state for backward compatibility
type AgentState = AgentActivity | 'DEAD';

// Helper to get economic state from bankroll
function getEconomicState(bankroll: number, isDead: boolean): AgentEconomicState {
  if (isDead) return 'DEAD';
  if (bankroll >= 1000) return 'THRIVING';
  if (bankroll >= 100) return 'COMFORTABLE';
  if (bankroll >= 10) return 'STRUGGLING';
  if (bankroll > 0) return 'BROKE';
  return 'HOMELESS';
}

type AgentSim = {
  id: string;
  position: THREE.Vector3;
  heading: THREE.Vector3;
  route: THREE.Vector3[];
  speed: number;
  walk: number;
  state: AgentState;
  stateTimer: number; // Time spent in current state
  targetPlotId: string | null; // Building they're heading to
  chatPartnerId: string | null; // Agent they're chatting with
  health: number; // 0-100, dies at 0
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
  const innerGroup = useRef<THREE.Group>(null);

  // Death is reserved for combat (not bankroll). For now, agents don't "die" visually.
  const isDead = false;

  useFrame((state) => {
    if (!group.current) return;

    // Dead agents fall over and stop animating
    if (isDead) {
      if (innerGroup.current) {
        // Smoothly fall over to the side
        innerGroup.current.rotation.z = THREE.MathUtils.lerp(
          innerGroup.current.rotation.z,
          Math.PI / 2,
          0.05
        );
        innerGroup.current.position.y = THREE.MathUtils.lerp(
          innerGroup.current.position.y,
          -0.8,
          0.05
        );
      }
      return;
    }

    const t = state.clock.elapsedTime;
    const swing = Math.sin(t * 6) * 0.55;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.6;
    if (armR.current) armR.current.rotation.x = swing * 0.6;
    if (body.current) body.current.position.y = 1.05 + Math.sin(t * 6) * 0.06;
  });

  const glyph = ARCHETYPE_GLYPH[agent.archetype] || '●';
  const label = isDead ? `💀${agent.name.slice(0, 5)}` : `${glyph}${agent.name.slice(0, 6)}`;
  const labelColor = isDead ? '#6b7280' : (selected ? '#e2e8f0' : '#cbd5e1');

  return (
    <group ref={group} onPointerDown={(e) => (e.stopPropagation(), onClick())}>
      <group ref={innerGroup}>
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
      </group>

      <BillboardLabel text={label} position={[0, 2.75, 0]} color={labelColor} />
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
  simsRef,
  onChatStart,
  speechByAgentId,
  weather,
  economicState,
  coinBursts,
  setCoinBursts,
  deathEffects,
  setDeathEffects,
  spawnEffects,
  setSpawnEffects,
}: {
  town: Town;
  agents: Agent[];
  selectedPlotId: string | null;
  setSelectedPlotId: (id: string | null) => void;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  followCam: boolean;
  simsRef: React.MutableRefObject<Map<string, AgentSim>>;
  onChatStart?: (townId: string, agentAId: string, agentBId: string) => void;
  speechByAgentId: Record<string, { text: string; until: number }>;
  weather: 'clear' | 'rain' | 'storm';
  economicState: { pollution: number; prosperity: number; sentiment: 'bull' | 'bear' | 'neutral' };
  coinBursts: { id: string; position: [number, number, number]; isBuy: boolean }[];
  setCoinBursts: React.Dispatch<React.SetStateAction<{ id: string; position: [number, number, number]; isBuy: boolean }[]>>;
  deathEffects: { id: string; position: [number, number, number] }[];
  setDeathEffects: React.Dispatch<React.SetStateAction<{ id: string; position: [number, number, number] }[]>>;
  spawnEffects: { id: string; position: [number, number, number]; color: string }[];
  setSpawnEffects: React.Dispatch<React.SetStateAction<{ id: string; position: [number, number, number]; color: string }[]>>;
}) {
  const groundTex = useGroundTexture();
  const plots = town.plots;

  const grid = useMemo(() => {
    const maxX = plots.reduce((m, p) => Math.max(m, p.x), 0);
    const maxY = plots.reduce((m, p) => Math.max(m, p.y), 0);
    return { cols: maxX + 1, rows: maxY + 1 };
  }, [plots]);

  const spacing = TOWN_SPACING;
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
        state: 'WALKING',
        stateTimer: 0,
        targetPlotId: null,
        chatPartnerId: null,
        health: 100,
      });
    }
  }, [agents, roadNodes, simsRef]);

  function buildRoute(from: THREE.Vector3, to: THREE.Vector3) {
    const pts: THREE.Vector3[] = [];
    const mid = new THREE.Vector3(to.x, to.y, from.z);
    pts.push(mid, to);
    return pts;
  }

  const plotWorldPosByIndex = useMemo(() => {
    const m = new Map<number, THREE.Vector3>();
    for (const p of plots) {
      const wx = (p.x - halfX) * spacing;
      const wz = (p.y - halfY) * spacing;
      m.set(p.plotIndex, new THREE.Vector3(wx, 0.02, wz));
    }
    return m;
  }, [plots, halfX, halfY, spacing]);

  // Get plot world position (stable objects; do not mutate returned vectors)
  const getPlotWorldPos = useCallback(
    (plotIndex: number) => plotWorldPosByIndex.get(plotIndex) ?? new THREE.Vector3(0, 0.02, 0),
    [plotWorldPosByIndex],
  );

  // Find built buildings (places agents can visit)
  const builtPlots = useMemo(() => plots.filter((p) => p.status === 'BUILT' || p.status === 'UNDER_CONSTRUCTION'), [plots]);
  const underConstructionPlots = useMemo(() => plots.filter((p) => p.status === 'UNDER_CONSTRUCTION'), [plots]);
  const entertainmentPlots = useMemo(() => plots.filter((p) => p.status === 'BUILT' && p.zone === 'ENTERTAINMENT'), [plots]);

  useFrame((_, dt) => {
    const sims = simsRef.current;

    for (const a of agents) {
      const sim = sims.get(a.id);
      if (!sim) continue;

      // Update state timer
      sim.stateTimer += dt;

      // Dead agents don't move
      if (sim.state === 'DEAD') {
        const g = agentGroupRefs.current.get(a.id);
        if (g) g.position.copy(sim.position);
        continue;
      }

      // Economic state affects behavior (broke agents beg/scheme, not die)
      const economicState = getEconomicState(a.bankroll + a.reserveBalance, false);
      
      // Broke/homeless agents have different behavior
      if ((economicState === 'BROKE' || economicState === 'HOMELESS') && sim.state === 'WALKING') {
        // 5% chance to start begging when broke
        if (Math.random() < 0.05) {
          sim.state = 'BEGGING' as AgentState;
          sim.stateTimer = 0;
          sim.route = [];
        }
        // 2% chance to start scheming when homeless
        if (economicState === 'HOMELESS' && Math.random() < 0.02) {
          sim.state = 'SCHEMING' as AgentState;
          sim.stateTimer = 0;
          sim.route = [];
        }
      }

      // Handle BEGGING state
      if (sim.state === 'BEGGING') {
        if (sim.stateTimer > 4 + Math.random() * 3) {
          sim.state = 'WALKING';
        }
        const g = agentGroupRefs.current.get(a.id);
        if (g) {
          g.position.copy(sim.position);
          // Slight sway while begging
          g.position.y = 0.02 + Math.sin(sim.stateTimer * 3) * 0.03;
        }
        continue;
      }

      // Handle SCHEMING state
      if (sim.state === 'SCHEMING') {
        if (sim.stateTimer > 3 + Math.random() * 2) {
          sim.state = 'WALKING';
        }
        const g = agentGroupRefs.current.get(a.id);
        if (g) {
          g.position.copy(sim.position);
          // Look around suspiciously
          g.rotation.y += Math.sin(sim.stateTimer * 5) * 0.02;
        }
        continue;
      }

      // Check for nearby agents to chat with
      if (sim.state === 'WALKING') {
        for (const [otherId, other] of sims) {
          if (otherId === a.id || other.state === 'DEAD') continue;
          const dist = sim.position.distanceTo(other.position);
          if (dist < 1.5 && other.state === 'WALKING' && !sim.chatPartnerId && !other.chatPartnerId) {
            // Start chatting!
            sim.state = 'CHATTING';
            sim.chatPartnerId = otherId;
            sim.stateTimer = 0;
            other.state = 'CHATTING';
            other.chatPartnerId = a.id;
            other.stateTimer = 0;
            sim.route = [];
            other.route = [];
            onChatStart?.(town.id, a.id, otherId);
            break;
          }
        }
      }

      // Check if near a building to shop
      if (sim.state === 'WALKING' && builtPlots.length > 0) {
        for (const plot of builtPlots) {
          const plotPos = getPlotWorldPos(plot.plotIndex);
          const dist = sim.position.distanceTo(plotPos);
          if (dist < 3.5 && Math.random() < 0.005) { // Small chance to stop and shop
            sim.state = 'SHOPPING';
            sim.targetPlotId = plot.id;
            sim.stateTimer = 0;
            sim.route = [];
            break;
          }
        }
      }

      // Check if near an under-construction plot to help build
      if (sim.state === 'WALKING' && underConstructionPlots.length > 0) {
        for (const plot of underConstructionPlots) {
          const plotPos = getPlotWorldPos(plot.plotIndex);
          const dist = sim.position.distanceTo(plotPos);
          if (dist < 3.5 && Math.random() < 0.008) { // Chance to start building
            sim.state = 'BUILDING';
            sim.targetPlotId = plot.id;
            sim.stateTimer = 0;
            sim.route = [];
            break;
          }
        }
      }

      // Check if near entertainment to play games
      if (sim.state === 'WALKING' && entertainmentPlots.length > 0) {
        for (const plot of entertainmentPlots) {
          const plotPos = getPlotWorldPos(plot.plotIndex);
          const dist = sim.position.distanceTo(plotPos);
          if (dist < 3.5 && Math.random() < 0.006) { // Chance to play games
            sim.state = 'PLAYING';
            sim.targetPlotId = plot.id;
            sim.stateTimer = 0;
            sim.route = [];
            break;
          }
        }
      }

      // Random chance to mine (anywhere)
      if (sim.state === 'WALKING' && Math.random() < 0.001) {
        sim.state = 'MINING';
        sim.stateTimer = 0;
        sim.route = [];
      }

      // Handle CHATTING state
      if (sim.state === 'CHATTING') {
        if (sim.stateTimer > 3 + Math.random() * 2) { // Chat for 3-5 seconds
          sim.state = 'WALKING';
          const partner = sims.get(sim.chatPartnerId!);
          if (partner) {
            partner.state = 'WALKING';
            partner.chatPartnerId = null;
          }
          sim.chatPartnerId = null;
        }
        // Stay still while chatting
        const g = agentGroupRefs.current.get(a.id);
        if (g) {
          g.position.copy(sim.position);
          // Face chat partner
          const partner = sims.get(sim.chatPartnerId!);
          if (partner) {
            const toPartner = partner.position.clone().sub(sim.position).normalize();
            sim.heading.lerp(toPartner, 0.1);
            g.rotation.y = Math.atan2(sim.heading.x, sim.heading.z);
          }
        }
        continue;
      }

      // Handle SHOPPING state
      if (sim.state === 'SHOPPING') {
        if (sim.stateTimer > 2 + Math.random() * 3) { // Shop for 2-5 seconds
          sim.state = 'WALKING';
          sim.targetPlotId = null;
        }
        // Stay still while shopping
        const g = agentGroupRefs.current.get(a.id);
        if (g) {
          g.position.copy(sim.position);
        }
        continue;
      }

      // Handle BUILDING state
      if (sim.state === 'BUILDING') {
        if (sim.stateTimer > 4 + Math.random() * 3) { // Build for 4-7 seconds
          sim.state = 'WALKING';
          sim.targetPlotId = null;
        }
        // Stay still while building, bob up and down
        const g = agentGroupRefs.current.get(a.id);
        if (g) {
          g.position.copy(sim.position);
          g.position.y = 0.02 + Math.sin(sim.stateTimer * 8) * 0.1;
        }
        continue;
      }

      // Handle MINING state
      if (sim.state === 'MINING') {
        if (sim.stateTimer > 3 + Math.random() * 2) { // Mine for 3-5 seconds
          sim.state = 'WALKING';
        }
        // Stay still while mining with a shake effect
        const g = agentGroupRefs.current.get(a.id);
        if (g) {
          g.position.copy(sim.position);
          g.position.x += Math.sin(sim.stateTimer * 20) * 0.05;
        }
        continue;
      }

      // Handle PLAYING state (arena games)
      if (sim.state === 'PLAYING') {
        if (sim.stateTimer > 5 + Math.random() * 5) { // Play for 5-10 seconds
          sim.state = 'WALKING';
        }
        // Spin in place while playing
        const g = agentGroupRefs.current.get(a.id);
        if (g) {
          g.position.copy(sim.position);
          g.rotation.y = sim.stateTimer * 2;
        }
        continue;
      }

      // WALKING behavior - pick destination
      if (sim.route.length === 0) {
        const rng = mulberry32(hashToSeed(`${a.id}:${Math.floor(sim.walk)}`));
        
        // 40% chance to head to a building, 60% random walk
        if (builtPlots.length > 0 && rng() < 0.4) {
          const targetPlot = builtPlots[Math.floor(rng() * builtPlots.length)];
          const target = getPlotWorldPos(targetPlot.plotIndex);
          sim.targetPlotId = targetPlot.id;
          sim.route = buildRoute(sim.position, target);
        } else {
          // Random walk
          let attempts = 0;
          let target: THREE.Vector3;
          do {
            target = roadNodes[Math.floor(rng() * roadNodes.length)]?.clone() ?? new THREE.Vector3(0, 0.02, 0);
            attempts++;
          } while (attempts < 5 && Array.from(sims.values()).some(
            (other) => other !== sim && other.position.distanceTo(target) < 1.5
          ));
          sim.targetPlotId = null;
          sim.route = buildRoute(sim.position, target);
        }
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

      // Collision avoidance: push away from nearby agents
      const avoidance = new THREE.Vector3();
      for (const [otherId, other] of sims) {
        if (otherId === a.id || other.state === 'DEAD') continue;
        const toOther = other.position.clone().sub(sim.position);
        const otherDist = toOther.length();
        if (otherDist < 1.2 && otherDist > 0.01) {
          avoidance.addScaledVector(toOther.normalize(), -0.5 * (1.2 - otherDist));
        }
      }

      dir.normalize();
      dir.add(avoidance).normalize();
      sim.heading.lerp(dir, 0.25);
      sim.position.addScaledVector(dir, sim.speed * dt);
      sim.walk += dt * sim.speed * 2.2;

      const g = agentGroupRefs.current.get(a.id);
      if (g) {
        g.position.copy(sim.position);
        g.rotation.y = Math.atan2(sim.heading.x, sim.heading.z);
      }
    }

      // Hard separation so agents can't "phase" through each other.
      const simList = Array.from(sims.values()).filter((s) => s.state !== 'DEAD');
      const minSep = 0.95;
      const minSepSq = minSep * minSep;

      for (let i = 0; i < simList.length; i++) {
        for (let j = i + 1; j < simList.length; j++) {
          const a = simList[i];
          const b = simList[j];
          const dx = a.position.x - b.position.x;
          const dz = a.position.z - b.position.z;
          const dSq = dx * dx + dz * dz;

          if (dSq > 0.000001 && dSq < minSepSq) {
            const d = Math.sqrt(dSq);
            const push = (minSep - d) * 0.5;
            const nx = dx / d;
            const nz = dz / d;
            a.position.x += nx * push;
            a.position.z += nz * push;
            b.position.x -= nx * push;
            b.position.z -= nz * push;
          } else if (dSq <= 0.000001) {
            // Exactly overlapping — nudge deterministically.
            const ang = (i * 97 + j * 131) % 360;
            const rad = (ang * Math.PI) / 180;
            const nx = Math.cos(rad);
            const nz = Math.sin(rad);
            a.position.x += nx * (minSep * 0.25);
            a.position.z += nz * (minSep * 0.25);
            b.position.x -= nx * (minSep * 0.25);
            b.position.z -= nz * (minSep * 0.25);
          }
        }
      }

      // Apply corrected positions to rendered groups while preserving any state-specific offsets (shake/bob).
      for (const sim of simList) {
        const g = agentGroupRefs.current.get(sim.id);
        if (!g) continue;
        const dx = g.position.x - sim.position.x;
        const dz = g.position.z - sim.position.z;
        g.position.x = sim.position.x + dx;
        g.position.z = sim.position.z + dz;
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
      {/* Day/Night cycle with moving sun */}
      <DayNightCycle timeScale={0.015} />

      {/* Fog - denser during rain/storm */}
      <fog attach="fog" args={[
        weather === 'storm' ? '#0a1525' : weather === 'rain' ? '#080d18' : '#050914',
        weather === 'storm' ? 15 : weather === 'rain' ? 25 : 30,
        weather === 'storm' ? 60 : weather === 'rain' ? 80 : 110
      ]} />

      {/* Ambient floating particles */}
      <AmbientParticles count={60} />

      {/* Economic atmosphere effects */}
      <SmogLayer pollution={economicState.pollution} />
      <SentimentAmbience sentiment={economicState.sentiment} />
      <ProsperitySparkles prosperity={economicState.prosperity} />

      {/* Weather effects */}
      {weather === 'rain' && <RainEffect intensity={200} />}
      {weather === 'storm' && <RainEffect intensity={500} />}

      {/* Coin burst effects */}
      {coinBursts.map((burst) => (
        <CoinBurst
          key={burst.id}
          position={burst.position}
          isBuy={burst.isBuy}
          onComplete={() => setCoinBursts(prev => prev.filter(b => b.id !== burst.id))}
        />
      ))}

      {/* Death smoke effects */}
      {deathEffects.map((effect) => (
        <DeathSmoke
          key={effect.id}
          position={effect.position}
          onComplete={() => setDeathEffects(prev => prev.filter(e => e.id !== effect.id))}
        />
      ))}

      {/* Spawn sparkle effects */}
      {spawnEffects.map((effect) => (
        <SpawnSparkle
          key={effect.id}
          position={effect.position}
          color={effect.color}
          onComplete={() => setSpawnEffects(prev => prev.filter(e => e.id !== effect.id))}
        />
      ))}

      {/* Ambient light - dimmer during bad weather */}
      <ambientLight intensity={weather === 'storm' ? 0.2 : weather === 'rain' ? 0.3 : 0.4} />

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
        const name = p.buildingName?.trim() || (p.status === 'EMPTY' ? 'Available' : p.status.replace(/_/g, ' '));

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

            {/* Claimed marker for claimed but not yet building */}
            {p.status === 'CLAIMED' && (
              <ClaimedMarker position={[wx + 2.2, 0, wz + 2.2]} color={ZONE_COLORS[p.zone]} />
            )}

            {(p.status === 'UNDER_CONSTRUCTION' || p.status === 'BUILT') && (
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
	          const baseColor = ARCHETYPE_COLORS[a.archetype] || '#93c5fd';
	          const economicState = getEconomicState(a.bankroll + a.reserveBalance, false);
	          const isDead = false; // Death is now only from combat, not bankroll
	          // Color reflects economic state: thriving=bright, broke=desaturated
	          const economicColorMod = economicState === 'THRIVING' ? 1.15 : 
	                                   economicState === 'COMFORTABLE' ? 1.0 :
	                                   economicState === 'STRUGGLING' ? 0.85 :
	                                   economicState === 'BROKE' ? 0.7 :
	                                   economicState === 'HOMELESS' ? 0.5 : 1.0;
	          const baseColorObj = new THREE.Color(baseColor);
	          const modColor = baseColorObj.multiplyScalar(economicColorMod);
	          const color = isDead ? '#4b5563' : `#${modColor.getHexString()}`;
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
	              {speechByAgentId[a.id]?.text && (
	                <SpeechBubble text={speechByAgentId[a.id].text} position={[0, 3.35, 0]} />
	              )}
	              <StateIndicator agentId={a.id} simsRef={simsRef} />
	              <EconomicIndicator agent={a} />
	              <HealthBar agentId={a.id} simsRef={simsRef} />
	            </group>
	          );
	        })}
      </group>
      
      {/* Destination lines for all agents */}
      {agents.map((a) => (
        <DestinationLine
          key={`line-${a.id}`}
          agentId={a.id}
          simsRef={simsRef}
          color={ARCHETYPE_COLORS[a.archetype] || '#93c5fd'}
        />
      ))}

      {/* Agent trails */}
      {agents.map((a) => (
        <AgentTrail
          key={`trail-${a.id}`}
          agentId={a.id}
          simsRef={simsRef}
          color={ARCHETYPE_COLORS[a.archetype] || '#93c5fd'}
        />
      ))}

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

// Mini-map component showing bird's eye view
function MiniMap({
  town,
  agents,
  selectedAgentId,
  simsRef,
}: {
  town: Town;
  agents: Agent[];
  selectedAgentId: string | null;
  simsRef: React.MutableRefObject<Map<string, AgentSim>>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 160;
    canvas.width = size;
    canvas.height = size;

    // Calculate grid bounds
    const plots = town.plots;
    const maxX = plots.reduce((m, p) => Math.max(m, p.x), 0);
    const maxY = plots.reduce((m, p) => Math.max(m, p.y), 0);
    const cols = maxX + 1;
    const rows = maxY + 1;
    const cellW = size / (cols + 1);
    const cellH = size / (rows + 1);
    const halfX = (cols - 1) / 2;
    const halfY = (rows - 1) / 2;

    function draw() {
      // Clear
      ctx.fillStyle = '#0a0f1a';
      ctx.fillRect(0, 0, size, size);

      // Draw grid lines
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= cols + 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellW, 0);
        ctx.lineTo(i * cellW, size);
        ctx.stroke();
      }
      for (let i = 0; i <= rows + 1; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellH);
        ctx.lineTo(size, i * cellH);
        ctx.stroke();
      }

      // Draw plots
      for (const p of plots) {
        const px = (p.x + 0.5) * cellW;
        const py = (p.y + 0.5) * cellH;
        const ps = Math.min(cellW, cellH) * 0.7;

        let color = '#1e293b'; // Empty
        if (p.status === 'CLAIMED') color = '#334155';
        else if (p.status === 'UNDER_CONSTRUCTION') color = '#fbbf24';
        else if (p.status === 'BUILT') color = ZONE_COLORS[p.zone];

        ctx.fillStyle = color;
        ctx.fillRect(px - ps / 2, py - ps / 2, ps, ps);
      }

      // Draw agents as dots (use real sim positions when available)
      for (const a of agents) {
        const sim = simsRef.current.get(a.id);
        let ax: number;
        let ay: number;
        if (sim) {
          // TownScene world->grid:
          // worldX = (plotX - halfX) * spacing
          // plotX = worldX / spacing + halfX
          const plotX = sim.position.x / TOWN_SPACING + halfX;
          const plotY = sim.position.z / TOWN_SPACING + halfY;
          ax = (plotX + 0.5) * cellW;
          ay = (plotY + 0.5) * cellH;
        } else {
          // Fallback scatter (should be rare, usually sim exists after a frame)
          const seed = hashToSeed(a.id);
          const rng = mulberry32(seed);
          ax = rng() * size;
          ay = rng() * size;
        }

        const isSelected = a.id === selectedAgentId;
        ctx.beginPath();
        ctx.arc(ax, ay, isSelected ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#ffffff' : (ARCHETYPE_COLORS[a.archetype] || '#93c5fd');
        ctx.fill();

        if (isSelected) {
          ctx.strokeStyle = ARCHETYPE_COLORS[a.archetype] || '#93c5fd';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    let raf = 0;
    let alive = true;
    let last = 0;
    const loop = (t: number) => {
      if (!alive) return;
      // ~10fps is plenty for a tiny canvas.
      if (t - last >= 100) {
        draw();
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [town, agents, selectedAgentId, simsRef]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-[140px] rounded border border-slate-800/50"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

// Floating notification for swaps
interface SwapNotification {
  id: string;
  agentName: string;
  archetype: string;
  side: 'BUY_ARENA' | 'SELL_ARENA';
  amount: number;
  createdAt: number;
}

export default function Town3D() {
  const [towns, setTowns] = useState<TownSummary[]>([]);
  const [town, setTown] = useState<Town | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [economy, setEconomy] = useState<EconomyPoolSummary | null>(null);
  const [swaps, setSwaps] = useState<EconomySwapRow[]>([]);
  const [events, setEvents] = useState<TownEvent[]>([]);
  const [activityTab, setActivityTab] = useState<'all' | 'swaps' | 'builds' | 'skills' | 'chats'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swapNotifications, setSwapNotifications] = useState<SwapNotification[]>([]);
  const [eventNotifications, setEventNotifications] = useState<TownEvent[]>([]);
  const seenSwapIdsRef = useRef<Set<string>>(new Set());
  const seenEventIdsRef = useRef<Set<string>>(new Set());

  const userSelectedTownIdRef = useRef<string | null>(null);
  const [selectedTownId, setSelectedTownId] = useState<string | null>(null);

  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [followCam, setFollowCam] = useState(false);
  const simsRef = useRef<Map<string, AgentSim>>(new Map());

  // Short-lived speech bubbles (set on chat events)
  const [speechByAgentId, setSpeechByAgentId] = useState<Record<string, { text: string; until: number }>>({});
  const lastChatRequestRef = useRef<Map<string, number>>(new Map());

  // x402 payable content states
  const [x402Loading, setX402Loading] = useState<string | null>(null);
  const [x402Lore, setX402Lore] = useState<{ plotIndex: number; content: string } | null>(null);
  const [x402Interview, setX402Interview] = useState<{ agentId: string; content: string } | null>(null);
  const [x402Oracle, setX402Oracle] = useState<string | null>(null);

  // Agent action logs
  interface AgentAction {
    type: 'work' | 'event';
    id: string;
    workType?: string;
    content?: string;
    input?: string;
    output?: string;
    eventType?: string;
    title?: string;
    description?: string;
    metadata?: string;
    plotIndex?: number;
    buildingName?: string;
    zone?: string;
    createdAt: string;
  }
  const [agentActions, setAgentActions] = useState<AgentAction[]>([]);
  const [agentActionsLoading, setAgentActionsLoading] = useState(false);

  // Social graph (friends/rivals)
  type AgentRelationships = {
    maxFriends: number;
    friends: Array<{ agentId: string; name: string; archetype: string; score: number; since: string | null }>;
    rivals: Array<{ agentId: string; name: string; archetype: string; score: number; since: string | null }>;
  };
  const [selectedAgentRelationships, setSelectedAgentRelationships] = useState<AgentRelationships | null>(null);
  const [agentRelationshipsLoading, setAgentRelationshipsLoading] = useState(false);
  
  // Yield/contributor data
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [showYieldPanel, setShowYieldPanel] = useState(false);
  
  // Sound toggle
  const [soundOn, setSoundOn] = useState(true);
  
  // Visual effects (system-controlled)
  const [weather, setWeather] = useState<'clear' | 'rain' | 'storm'>('clear');
  const [coinBursts, setCoinBursts] = useState<{ id: string; position: [number, number, number]; isBuy: boolean }[]>([]);
  const [deathEffects, setDeathEffects] = useState<{ id: string; position: [number, number, number] }[]>([]);
  const [spawnEffects, setSpawnEffects] = useState<{ id: string; position: [number, number, number]; color: string }[]>([]);

  // Economic indicators derived from town state
  const economicState = useMemo(() => {
    if (!town) return { pollution: 0, prosperity: 0.5, sentiment: 'neutral' as const };
    
    const plots = town.plots;
    const industrialCount = plots.filter(p => p.status === 'BUILT' && p.zone === 'INDUSTRIAL').length;
    const commercialCount = plots.filter(p => p.status === 'BUILT' && p.zone === 'COMMERCIAL').length;
    const residentialCount = plots.filter(p => p.status === 'BUILT' && p.zone === 'RESIDENTIAL').length;
    const entertainmentCount = plots.filter(p => p.status === 'BUILT' && p.zone === 'ENTERTAINMENT').length;
    const civicCount = plots.filter(p => p.status === 'BUILT' && p.zone === 'CIVIC').length;
    const totalBuilt = industrialCount + commercialCount + residentialCount + entertainmentCount + civicCount;
    
    // Pollution: industrial creates pollution, civic/residential reduces it (parks, trees)
    const rawPollution = (industrialCount * 2) - (civicCount * 0.5) - (residentialCount * 0.3);
    const pollution = Math.max(0, Math.min(1, rawPollution / 10));
    
    // Prosperity: based on completion %, commercial activity, entertainment
    const completionBonus = town.completionPct / 100;
    const commerceBonus = commercialCount / Math.max(1, totalBuilt);
    const funBonus = entertainmentCount / Math.max(1, totalBuilt) * 0.5;
    const prosperity = Math.min(1, completionBonus * 0.5 + commerceBonus * 0.3 + funBonus + 0.2);
    
    // Market sentiment based on recent price action
    let sentiment: 'bull' | 'bear' | 'neutral' = 'neutral';
    if (swaps.length >= 2) {
      const recentSwaps = swaps.slice(0, 5);
      const buyCount = recentSwaps.filter(s => s.side === 'BUY_ARENA').length;
      const sellCount = recentSwaps.filter(s => s.side === 'SELL_ARENA').length;
      if (buyCount > sellCount + 1) sentiment = 'bull';
      else if (sellCount > buyCount + 1) sentiment = 'bear';
    }
    
    return { pollution, prosperity, sentiment };
  }, [town, swaps]);

  // Weather influenced by pollution (more pollution = more rain/storms)
  const pollution = economicState.pollution;
  useEffect(() => {
    const changeWeather = () => {
      const rand = Math.random();
      
      // Higher pollution increases chance of rain/storm
      const clearChance = 0.6 - (pollution * 0.4); // 60% down to 20%
      const rainChance = 0.25 + (pollution * 0.2); // 25% up to 45%
      // Storm is the remainder
      
      if (rand < clearChance) setWeather('clear');
      else if (rand < clearChance + rainChance) setWeather('rain');
      else setWeather('storm');
    };
    
    // Initial weather
    changeWeather();
    
    // Change weather periodically (faster during high pollution)
    const baseInterval = 45000;
    const pollutionFactor = 1 - (pollution * 0.5); // Faster changes with pollution
    const interval = setInterval(() => {
      changeWeather();
    }, baseInterval * pollutionFactor + Math.random() * 30000);
    
    return () => clearInterval(interval);
  }, [pollution]);

  // x402 API calls
  const fetchBuildingLore = async (plotIndex: number) => {
    setX402Loading('lore');
    try {
      const res = await fetch(`${API_BASE}/x402/building/${plotIndex}/lore`);
      if (!res.ok) throw new Error('Failed to fetch lore');
      const data = await res.json();
      setX402Lore({ plotIndex, content: data.lore || data.content || JSON.stringify(data) });
    } catch (e) {
      console.error('x402 lore error:', e);
    } finally {
      setX402Loading(null);
    }
  };

  const fetchAgentInterview = async (agentId: string) => {
    setX402Loading('interview');
    try {
      const res = await fetch(`${API_BASE}/x402/agent/${agentId}/interview`);
      if (!res.ok) throw new Error('Failed to fetch interview');
      const data = await res.json();
      setX402Interview({ agentId, content: data.interview || data.content || JSON.stringify(data) });
    } catch (e) {
      console.error('x402 interview error:', e);
    } finally {
      setX402Loading(null);
    }
  };

  const fetchTownOracle = async () => {
    setX402Loading('oracle');
    try {
      const res = await fetch(`${API_BASE}/x402/town/oracle`);
      if (!res.ok) throw new Error('Failed to fetch oracle');
      const data = await res.json();
      setX402Oracle(data.forecast || data.content || JSON.stringify(data));
    } catch (e) {
      console.error('x402 oracle error:', e);
    } finally {
      setX402Loading(null);
    }
  };

  const pushSpeech = useCallback((agentId: string, text: string) => {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return;
    const until = Date.now() + 6500;
    setSpeechByAgentId((prev) => ({ ...prev, [agentId]: { text: clean, until } }));
    window.setTimeout(() => {
      setSpeechByAgentId((prev) => {
        if (prev[agentId]?.until !== until) return prev;
        const next = { ...prev };
        delete next[agentId];
        return next;
      });
    }, 6800);
  }, []);

  const requestChat = useCallback(async (townId: string, agentAId: string, agentBId: string) => {
    const ids = [agentAId, agentBId].sort();
    const key = `${ids[0]}|${ids[1]}`;
    const now = Date.now();
    const last = lastChatRequestRef.current.get(key) || 0;
    if (now - last < 45_000) return; // local throttle (server has its own cooldown)
    lastChatRequestRef.current.set(key, now);

    try {
      const res = await fetch(`${API_BASE}/town/${townId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentAId, agentBId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const lines = data?.conversation?.lines;
      if (Array.isArray(lines)) {
        for (const l of lines) {
          if (l?.agentId && l?.text) pushSpeech(String(l.agentId), String(l.text));
        }
      }
    } catch {
      // ignore
    }
  }, [pushSpeech]);

  // Fetch agent action logs when agent is selected
  useEffect(() => {
    if (!selectedAgentId) {
      setAgentActions([]);
      setSelectedAgentRelationships(null);
      return;
    }
    let cancelled = false;
    setAgentActionsLoading(true);
    fetch(`${API_BASE}/agent/${selectedAgentId}/actions?limit=10`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.actions) {
          setAgentActions(data.actions);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAgentActionsLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedAgentId]);

  // Fetch agent friends/rivals
  useEffect(() => {
    if (!selectedAgentId) return;
    let cancelled = false;
    setAgentRelationshipsLoading(true);
    fetch(`${API_BASE}/agent/${selectedAgentId}/relationships`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data?.friends && data?.rivals) {
          setSelectedAgentRelationships(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAgentRelationshipsLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedAgentId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [townsRes, activeTownRes, agentsRes, poolRes] = await Promise.all([
          apiFetch<{ towns: TownSummary[] }>('/towns'),
          apiFetch<{ town: Town | null }>('/town'),
          apiFetch<Agent[]>('/agents'),
          apiFetch<{ pool: EconomyPoolSummary | null }>('/economy/pool').catch(() => ({ pool: null })),
        ]);

        if (cancelled) return;
        setTowns(townsRes.towns);
        setAgents(agentsRes);
        if (poolRes.pool) setEconomy(poolRes.pool);

        const activeId = activeTownRes.town?.id ?? townsRes.towns[0]?.id ?? null;
        const nextSelected = userSelectedTownIdRef.current ?? activeId;
        if (nextSelected) {
          setSelectedTownId(nextSelected);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load';
        if (!cancelled) setError(msg);
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
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load town';
        if (!cancelled) setError(msg);
      }
    }

    async function loadContributors() {
      try {
        const res = await apiFetch<{ contributors: Contributor[] }>(`/town/${selectedTownId}/contributors`);
        if (!cancelled) setContributors(res.contributors || []);
      } catch {
        // ignore
      }
    }

    void loadTown();
    void loadContributors();
    const t = setInterval(loadTown, 2500);
    const t2 = setInterval(loadContributors, 10000);
    return () => {
      cancelled = true;
      clearInterval(t);
      clearInterval(t2);
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

  useEffect(() => {
    let cancelled = false;
    async function loadEconomy() {
      try {
        const res = await apiFetch<{ pool: EconomyPoolSummary }>('/economy/pool');
        if (!cancelled) setEconomy(res.pool);
      } catch {
        // ignore
      }
    }
    void loadEconomy();
    const t = setInterval(loadEconomy, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadSwaps() {
      try {
        const res = await apiFetch<{ swaps: EconomySwapRow[] }>('/economy/swaps?limit=30');
        if (!cancelled) {
          // Detect new swaps for notifications
          const newNotifs: SwapNotification[] = [];
          for (const s of res.swaps) {
            if (!seenSwapIdsRef.current.has(s.id)) {
              seenSwapIdsRef.current.add(s.id);
              newNotifs.push({
                id: s.id,
                agentName: s.agent?.name || 'Unknown',
                archetype: s.agent?.archetype || 'ROCK',
                side: s.side,
                amount: s.side === 'BUY_ARENA' ? s.amountOut : s.amountIn,
                createdAt: Date.now(),
              });
            }
          }
          if (newNotifs.length > 0) {
            setSwapNotifications(prev => [...newNotifs, ...prev].slice(0, 5));
            // Play sound for new swaps
            playSound('swap');
            // Add coin burst effects (random position in town)
            newNotifs.forEach(n => {
              const pos: [number, number, number] = [
                (Math.random() - 0.5) * 30,
                2,
                (Math.random() - 0.5) * 30
              ];
              setCoinBursts(prev => [...prev, { id: n.id, position: pos, isBuy: n.side === 'BUY_ARENA' }]);
            });
            // Auto-remove after 4 seconds
            setTimeout(() => {
              setSwapNotifications(prev => prev.filter(n => !newNotifs.some(nn => nn.id === n.id)));
            }, 4000);
          }
          setSwaps(res.swaps);
        }
      } catch {
        // ignore
      }
    }
    void loadSwaps();
    const t = setInterval(loadSwaps, 3500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Fetch world events (claims, builds, completions)
  useEffect(() => {
    let cancelled = false;
    async function loadEvents() {
      try {
        const res = await apiFetch<{ events: TownEvent[] }>('/world/events?limit=50');
        if (!cancelled) {
          // Detect new build completions for notifications
          const newEvents: TownEvent[] = [];
          for (const e of res.events) {
            if (!seenEventIdsRef.current.has(e.id) && 
                (e.eventType === 'BUILD_COMPLETED' || e.eventType === 'TOWN_COMPLETED')) {
              seenEventIdsRef.current.add(e.id);
              newEvents.push(e);
            } else {
              seenEventIdsRef.current.add(e.id);
            }
          }
          if (newEvents.length > 0) {
            setEventNotifications(prev => [...newEvents, ...prev].slice(0, 3));
            // Play appropriate sound
            const hasTownComplete = newEvents.some(e => e.eventType === 'TOWN_COMPLETED');
            if (hasTownComplete) {
              playSound('townComplete');
            } else {
              playSound('buildComplete');
            }
            // Auto-remove after 5 seconds
            setTimeout(() => {
              setEventNotifications(prev => prev.filter(n => !newEvents.some(ne => ne.id === n.id)));
            }, 5000);
          }
          setEvents(res.events);
        }
      } catch {
        // ignore
      }
    }
    void loadEvents();
    const t = setInterval(loadEvents, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const selectedPlot = useMemo(() => town?.plots.find((p) => p.id === selectedPlotId) ?? null, [town, selectedPlotId]);
  const selectedAgent = useMemo(() => agents.find((a) => a.id === selectedAgentId) ?? null, [agents, selectedAgentId]);
  const agentById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const recentSwaps = useMemo(() => swaps.slice(0, 8), [swaps]);
  const selectedAgentSwaps = useMemo(
    () => (selectedAgent ? swaps.filter((s) => s.agent?.id === selectedAgent.id).slice(0, 5) : []),
    [swaps, selectedAgent],
  );

  // Merge swaps and events into unified activity feed
  const activityFeed = useMemo(() => {
    const getMetaKind = (e: TownEvent): string | null => {
      try {
        const meta = JSON.parse(e.metadata || '{}');
        return typeof meta?.kind === 'string' ? meta.kind : null;
      } catch {
        return null;
      }
    };

    const isSkillEvent = (e: TownEvent) => {
      return getMetaKind(e) === 'X402_SKILL';
    };
    const isChatEvent = (e: TownEvent) => getMetaKind(e) === 'AGENT_CHAT';
    const isRelationshipChange = (e: TownEvent) => getMetaKind(e) === 'RELATIONSHIP_CHANGE';

    const items: ActivityItem[] = [
      ...swaps.map((s): ActivityItem => ({ kind: 'swap', data: s })),
      ...events.map((e): ActivityItem => ({ kind: 'event', data: e })),
    ];
    // Sort by createdAt descending
    items.sort((a, b) => {
      const aTime = a.kind === 'swap' ? a.data.createdAt : a.data.createdAt;
      const bTime = b.kind === 'swap' ? b.data.createdAt : b.data.createdAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
    // Filter by tab
    if (activityTab === 'swaps') return items.filter(i => i.kind === 'swap').slice(0, 15);
    if (activityTab === 'builds') return items.filter(i => i.kind === 'event' && !isSkillEvent(i.data as TownEvent) && !isChatEvent(i.data as TownEvent) && !isRelationshipChange(i.data as TownEvent)).slice(0, 15);
    if (activityTab === 'skills') return items.filter(i => i.kind === 'event' && isSkillEvent(i.data as TownEvent)).slice(0, 15);
    if (activityTab === 'chats') return items.filter(i => i.kind === 'event' && (isChatEvent(i.data as TownEvent) || isRelationshipChange(i.data as TownEvent))).slice(0, 15);
    return items.slice(0, 15);
  }, [swaps, events, activityTab]);

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
          simsRef={simsRef}
          onChatStart={requestChat}
          speechByAgentId={speechByAgentId}
          weather={weather}
          economicState={economicState}
          coinBursts={coinBursts}
          setCoinBursts={setCoinBursts}
          deathEffects={deathEffects}
          setDeathEffects={setDeathEffects}
          spawnEffects={spawnEffects}
          setSpawnEffects={setSpawnEffects}
        />
      </Canvas>

      {/* Swap Notifications - floating toasts */}
      <div className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col-reverse gap-2 z-50">
        {swapNotifications.map((notif) => {
          const isBuy = notif.side === 'BUY_ARENA';
          const color = ARCHETYPE_COLORS[notif.archetype] || '#93c5fd';
          const glyph = ARCHETYPE_GLYPH[notif.archetype] || '●';
          return (
            <div
              key={notif.id}
              className="animate-in slide-in-from-bottom-4 fade-in duration-300 pointer-events-auto"
            >
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md shadow-lg ${
                isBuy 
                  ? 'bg-emerald-950/80 border-emerald-700/50 text-emerald-200' 
                  : 'bg-rose-950/80 border-rose-700/50 text-rose-200'
              }`}>
                <span className="text-lg">{isBuy ? '📈' : '📉'}</span>
                <span style={{ color }} className="font-mono text-sm">
                  {glyph} {notif.agentName}
                </span>
                <span className="text-xs opacity-80">
                  {isBuy ? 'bought' : 'sold'}
                </span>
                <span className="font-mono font-semibold">
                  {Math.round(notif.amount).toLocaleString()}
                </span>
                <span className="text-xs opacity-80">$ARENA</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Build Completion Notifications - top center */}
      <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50">
        {eventNotifications.map((event) => {
          const agent = agents.find(a => a.id === event.agentId);
          const color = agent ? (ARCHETYPE_COLORS[agent.archetype] || '#93c5fd') : '#93c5fd';
          const glyph = agent ? (ARCHETYPE_GLYPH[agent.archetype] || '●') : '●';
          const isTownComplete = event.eventType === 'TOWN_COMPLETED';
          return (
            <div
              key={event.id}
              className="animate-in slide-in-from-top-4 fade-in duration-500 pointer-events-auto"
            >
              <div className={`flex items-center gap-3 px-5 py-3 rounded-lg border backdrop-blur-md shadow-xl ${
                isTownComplete
                  ? 'bg-amber-950/90 border-amber-500/60 text-amber-100'
                  : 'bg-sky-950/90 border-sky-600/50 text-sky-100'
              }`}>
                <span className="text-2xl">{isTownComplete ? '🎉' : '🏗️'}</span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">
                    {isTownComplete ? 'Town Complete!' : 'Building Complete!'}
                  </span>
                  {agent && (
                    <span style={{ color }} className="font-mono text-xs">
                      {glyph} {agent.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
	                {economy && Number.isFinite(economy.spotPrice) && (
	                  <div className="mt-1 text-[11px] text-slate-500">
	                    💱 1 $ARENA ≈ {economy.spotPrice.toFixed(3)} reserve · fee {(economy.feeBps / 100).toFixed(2)}%
	                  </div>
	                )}
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
              <Button
                size="sm"
                variant="outline"
                className="border-purple-700/50 text-purple-300 hover:bg-purple-950/30"
                onClick={fetchTownOracle}
                disabled={x402Loading === 'oracle'}
                title="Get AI economic forecast ($0.001)"
              >
                {x402Loading === 'oracle' ? '...' : '🔮'}
              </Button>
              <Button
                size="sm"
                variant={showYieldPanel ? 'secondary' : 'outline'}
                onClick={() => setShowYieldPanel(v => !v)}
                title="Show yield & contributors"
              >
                💎
              </Button>
            </div>

            {/* Economic indicators + Weather + Sound */}
            <div className="mt-3 border-t border-slate-800/60 pt-3">
              <div className="flex items-center justify-between text-[10px] mb-2">
                <div className="flex items-center gap-3">
                  <span title={`Pollution: ${Math.round(economicState.pollution * 100)}%`}>
                    🏭 <span className={economicState.pollution > 0.5 ? 'text-red-400' : economicState.pollution > 0.3 ? 'text-amber-400' : 'text-green-400'}>
                      {economicState.pollution > 0.5 ? 'High' : economicState.pollution > 0.3 ? 'Med' : 'Low'}
                    </span>
                  </span>
                  <span title={`Prosperity: ${Math.round(economicState.prosperity * 100)}%`}>
                    💰 <span className={economicState.prosperity > 0.6 ? 'text-green-400' : economicState.prosperity > 0.3 ? 'text-amber-400' : 'text-red-400'}>
                      {economicState.prosperity > 0.6 ? 'High' : economicState.prosperity > 0.3 ? 'Med' : 'Low'}
                    </span>
                  </span>
                  <span title={`Market: ${economicState.sentiment}`}>
                    {economicState.sentiment === 'bull' ? '📈' : economicState.sentiment === 'bear' ? '📉' : '➡️'}
                  </span>
                </div>
                <span className="text-sm" title={`Weather: ${weather}`}>
                  {weather === 'clear' ? '☀️' : weather === 'rain' ? '🌧️' : '⛈️'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <WalletConnect compact />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-400 hover:text-slate-200"
                  onClick={() => {
                    const newState = !soundOn;
                    setSoundOn(newState);
                    setSoundEnabled(newState);
                    if (newState) playSound('click');
                  }}
                  title={soundOn ? 'Mute sounds' : 'Enable sounds'}
                >
                  {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {x402Oracle && (
              <div className="mt-3 p-2 rounded bg-purple-950/30 border border-purple-800/30 text-xs text-slate-300 max-h-[100px] overflow-auto">
                <div className="font-semibold text-purple-300 mb-1">🔮 Town Oracle</div>
                {x402Oracle}
              </div>
            )}

            {/* Yield Panel */}
            {showYieldPanel && (
              <div className="mt-3 border-t border-slate-800/60 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-amber-300">💎 Yield & Contributors</div>
                  {town?.status === 'COMPLETE' && (
                    <Badge variant="outline" className="border-green-600/50 text-green-400 text-[10px]">
                      Yielding
                    </Badge>
                  )}
                </div>
                
	                {town?.status === 'COMPLETE' ? (
	                  <div className="text-[11px] text-slate-300 mb-2">
	                    <span className="text-slate-400">Yield per tick:</span>{' '}
	                    <span className="font-mono text-amber-300">{town.yieldPerTick ?? 0} $ARENA</span>
	                  </div>
	                ) : (
                  <div className="text-[11px] text-slate-400 mb-2">
                    Complete all plots to start earning yield
                  </div>
                )}

                {contributors.length > 0 ? (
                  <div className="space-y-1 max-h-[120px] overflow-auto">
                    {contributors.slice(0, 8).map((c) => {
                      const color = ARCHETYPE_COLORS[c.archetype] || '#93c5fd';
                      const glyph = ARCHETYPE_GLYPH[c.archetype] || '●';
                      const yieldPct = (c.yieldShare * 100).toFixed(1);
                      return (
                        <div
                          key={c.agentId}
                          className="flex items-center justify-between rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[10px]"
                        >
                          <span className="font-mono" style={{ color }}>
                            {glyph} {c.agentName}
                          </span>
                          <span className="text-slate-400">
                            {c.plotsBuilt} plots · <span className="text-amber-300">{yieldPct}%</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500">No contributors yet</div>
                )}
              </div>
            )}
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

		        <div className="pointer-events-auto absolute left-3 bottom-3 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end max-w-[calc(100vw-24px)]">
              <div className="w-[420px] max-w-[calc(100vw-24px)]">
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
	
		              {economy && (
		                <div className="mt-3 border-t border-slate-800/60 pt-2 text-[11px] text-slate-300">
		                  <div className="flex flex-wrap items-center justify-between gap-2">
		                    <div className="text-slate-400">Pool</div>
		                    <div className="font-mono text-slate-200">
		                      {Math.round(economy.reserveBalance).toLocaleString()} reserve ·{' '}
		                      {Math.round(economy.arenaBalance).toLocaleString()} ARENA
		                    </div>
		                  </div>
		                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
		                    <div className="text-slate-400">Treasury fees</div>
		                    <div className="font-mono text-slate-200">
		                      {Math.round(economy.cumulativeFeesReserve).toLocaleString()} reserve +{' '}
		                      {Math.round(economy.cumulativeFeesArena).toLocaleString()} ARENA
		                    </div>
		                  </div>
		                </div>
		              )}
	
		              {(activityFeed.length > 0 || recentSwaps.length > 0) && (
		                <div className="mt-3 border-t border-slate-800/60 pt-2">
		                  <div className="flex items-center justify-between mb-2">
		                    <div className="text-[11px] font-semibold text-slate-200">Activity Feed</div>
		                    <div className="flex gap-1">
			                      {(['all', 'swaps', 'builds', 'skills', 'chats'] as const).map((tab) => (
			                        <button
			                          key={tab}
			                          onClick={() => setActivityTab(tab)}
			                          className={`px-2 py-0.5 text-[10px] rounded ${
			                            activityTab === tab
			                              ? 'bg-slate-700 text-slate-100'
			                              : 'text-slate-500 hover:text-slate-300'
			                          }`}
			                        >
			                          {tab === 'all' ? 'All' : tab === 'swaps' ? '💱' : tab === 'builds' ? '🏗️' : tab === 'skills' ? '💳' : '💬'}
			                        </button>
			                      ))}
		                    </div>
		                  </div>
		                  <div className="max-h-[160px] overflow-auto pr-1 space-y-1">
		                    {activityFeed.map((item) => {
		                      if (item.kind === 'swap') {
		                        const s = item.data;
		                        const color = ARCHETYPE_COLORS[s.agent?.archetype] || '#93c5fd';
		                        const glyph = ARCHETYPE_GLYPH[s.agent?.archetype] || '●';
		                        const isBuy = s.side === 'BUY_ARENA';
		                        const price = isBuy ? s.amountIn / Math.max(1, s.amountOut) : s.amountOut / Math.max(1, s.amountIn);
		                        const amountArena = isBuy ? s.amountOut : s.amountIn;
		                        return (
		                          <div
		                            key={s.id}
		                            className="flex items-center justify-between gap-2 rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[11px] text-slate-300"
		                          >
		                            <div className="min-w-0 truncate">
		                              <span className="text-slate-500">💱</span>{' '}
		                              <span className="font-mono" style={{ color }}>
		                                {glyph} {s.agent?.name || 'Unknown'}
		                              </span>{' '}
		                              <span className="text-slate-400">{isBuy ? 'bought' : 'sold'}</span>{' '}
		                              <span className="font-mono text-slate-200">{Math.round(amountArena).toLocaleString()}</span>{' '}
		                              <span className="text-slate-400">ARENA</span>
		                            </div>
		                            <div className="shrink-0 font-mono text-slate-500">@ {price.toFixed(3)}</div>
		                          </div>
		                        );
		                      } else {
		                        const e = item.data;
			                        const agent = e.agentId ? agentById.get(e.agentId) : null;
			                        const color = agent ? ARCHETYPE_COLORS[agent.archetype] || '#93c5fd' : '#93c5fd';
			                        const glyph = agent ? ARCHETYPE_GLYPH[agent.archetype] || '●' : '●';
			                        let meta: unknown = null;
			                        try {
			                          meta = JSON.parse(e.metadata || '{}');
			                        } catch {
			                          meta = null;
			                        }
			                        const metaObj = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : null;
			                        const kind = typeof metaObj?.kind === 'string' ? metaObj.kind : '';
			                        const skillName = typeof metaObj?.skill === 'string' ? metaObj.skill : null;
			                        const participants = Array.isArray(metaObj?.participants)
			                          ? metaObj.participants.filter((p): p is string => typeof p === 'string')
			                          : [];
			                        type LineLike = { agentId?: unknown; text?: unknown };
			                        const rawLines = Array.isArray(metaObj?.lines) ? metaObj.lines : [];
			                        const lines: LineLike[] = rawLines.filter((l): l is LineLike => !!l && typeof l === 'object');

			                        const isSkill = kind === 'X402_SKILL' && !!skillName;
			                        const isChat = kind === 'AGENT_CHAT' && participants.length >= 2 && lines.length >= 1;
			                        const isRelChange = kind === 'RELATIONSHIP_CHANGE' && participants.length >= 2;

			                        const relTo = isRelChange ? String(metaObj?.to || '').toUpperCase() : '';
			                        const relEmoji = relTo === 'FRIEND' ? '🤝' : relTo === 'RIVAL' ? '💢' : '🧊';

			                        const emoji = isSkill ? '💳' : isChat ? '💬' : isRelChange ? relEmoji :
			                                     e.eventType === 'PLOT_CLAIMED' ? '📍' : 
			                                     e.eventType === 'BUILD_STARTED' ? '🏗️' :
			                                     e.eventType === 'BUILD_COMPLETED' ? '✅' :
			                                     e.eventType === 'TOWN_COMPLETED' ? '🎉' :
			                                     e.eventType === 'YIELD_DISTRIBUTED' ? '💎' : '📝';
		
			                        const chatSnippet = isChat && typeof lines[0]?.text === 'string' ? lines[0].text.slice(0, 70) : '';
			                        const desc = isSkill
			                          ? (e.description || `bought ${(skillName ?? '').toUpperCase()}`)
			                          : isChat
			                            ? (chatSnippet ? `chatted: "${chatSnippet}${chatSnippet.length >= 70 ? '…' : ''}"` : 'chatted')
			                            : isRelChange
			                              ? (e.title || (relTo === 'FRIEND' ? 'became friends' : relTo === 'RIVAL' ? 'became rivals' : 'changed relationship'))
			                              : e.eventType === 'PLOT_CLAIMED' ? (e.title || 'claimed a plot')
			                                : e.eventType === 'BUILD_STARTED' ? (e.title || 'started building')
			                                  : e.eventType === 'BUILD_COMPLETED' ? (e.title || 'completed a build')
			                                    : e.eventType === 'TOWN_COMPLETED' ? (e.title || 'Town completed!')
			                                      : e.title || e.description || e.eventType;

			                        const p0 = (isChat || isRelChange) && participants[0] ? agentById.get(participants[0]) : null;
			                        const p1 = (isChat || isRelChange) && participants[1] ? agentById.get(participants[1]) : null;
			                        return (
			                          <div
			                            key={e.id}
			                            className="rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[11px] text-slate-300"
			                          >
			                            <div className="min-w-0 truncate">
			                              <span>{emoji}</span>{' '}
			                              {(isChat || isRelChange) && p0 && p1 ? (
			                                <>
			                                  <span className="font-mono" style={{ color: ARCHETYPE_COLORS[p0.archetype] || '#93c5fd' }}>
			                                    {(ARCHETYPE_GLYPH[p0.archetype] || '●')} {p0.name}
			                                  </span>
			                                  <span className="text-slate-600"> ↔ </span>
			                                  <span className="font-mono" style={{ color: ARCHETYPE_COLORS[p1.archetype] || '#93c5fd' }}>
			                                    {(ARCHETYPE_GLYPH[p1.archetype] || '●')} {p1.name}
			                                  </span>{' '}
			                                </>
			                              ) : agent ? (
			                                <span className="font-mono" style={{ color }}>
			                                  {glyph} {agent.name}
			                                </span>
			                              ) : null}{' '}
			                              <span className="text-slate-400">{desc}</span>
			                            </div>
			                          </div>
			                        );
		                      }
		                    })}
		                  </div>
		                </div>
		              )}
		            </Card>
              </div>

              {/* Mini-map */}
              <div className="w-[180px]">
                <Card className="border-slate-800/70 bg-slate-950/85 backdrop-blur-md p-2">
                  <div className="text-[10px] font-semibold text-slate-400 mb-1.5">MINI-MAP</div>
                  <MiniMap town={town} agents={agents} selectedAgentId={selectedAgentId} simsRef={simsRef} />
                </Card>
              </div>
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
                  
                  {/* x402 Building Lore Button */}
                  {selectedPlot.status === 'BUILT' && (
                    <div className="mt-3 border-t border-slate-800/60 pt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-purple-700/50 text-purple-300 hover:bg-purple-950/30"
                        onClick={() => fetchBuildingLore(selectedPlot.plotIndex)}
                        disabled={x402Loading === 'lore'}
                      >
                        {x402Loading === 'lore' ? (
                          <><Loader2 className="h-3 w-3 animate-spin mr-2" /> Loading...</>
                        ) : (
                          <>📖 Read Building Lore <span className="ml-2 text-[10px] opacity-60">$0.001</span></>
                        )}
                      </Button>
                      {x402Lore?.plotIndex === selectedPlot.plotIndex && (
                        <div className="mt-2 p-2 rounded bg-purple-950/30 border border-purple-800/30 text-xs text-slate-300 max-h-[120px] overflow-auto">
                          {x402Lore.content}
                        </div>
                      )}
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
		                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-300">
		                    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-2">
		                      <div className="text-slate-500">$ARENA</div>
		                      <div className="font-mono text-slate-100">{Math.round(selectedAgent.bankroll)}</div>
		                    </div>
	                    <div className="rounded-md border border-slate-800 bg-slate-950/40 p-2">
	                      <div className="text-slate-500">Reserve</div>
	                      <div className="font-mono text-slate-100">{Math.round(selectedAgent.reserveBalance)}</div>
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

			                  {selectedAgentSwaps.length > 0 && (
			                    <div className="mt-3 border-t border-slate-800/60 pt-2">
			                      <div className="text-[11px] font-semibold text-slate-200">Recent Trades</div>
			                      <div className="mt-2 grid grid-cols-1 gap-1">
			                        {selectedAgentSwaps.map((s) => {
			                          const isBuy = s.side === 'BUY_ARENA';
		                          const price = isBuy ? s.amountIn / Math.max(1, s.amountOut) : s.amountOut / Math.max(1, s.amountIn);
		                          const amountArena = isBuy ? s.amountOut : s.amountIn;
		                          return (
		                            <div
		                              key={s.id}
		                              className="flex items-center justify-between gap-2 rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[11px] text-slate-300"
		                            >
		                              <div className="min-w-0 truncate">
		                                <span className="text-slate-400">{isBuy ? 'BUY' : 'SELL'}</span>{' '}
		                                <span className="font-mono text-slate-200">{Math.round(amountArena).toLocaleString()}</span>{' '}
		                                <span className="text-slate-400">ARENA</span>
		                                <span className="text-slate-600"> · </span>
		                                <span className="text-slate-500">{timeAgo(s.createdAt)} ago</span>
		                              </div>
		                              <div className="shrink-0 font-mono text-slate-500">@ {price.toFixed(3)}</div>
		                            </div>
		                          );
		                        })}
			                      </div>
			                    </div>
			                  )}

                        {/* Friends / Rivals */}
                        <div className="mt-3 border-t border-slate-800/60 pt-2">
                          <div className="flex items-center justify-between">
                            <div className="text-[11px] font-semibold text-slate-200">Social</div>
                            {agentRelationshipsLoading && <Loader2 className="h-3 w-3 animate-spin text-slate-500" />}
                          </div>
                          {selectedAgentRelationships ? (
                            <div className="mt-2 space-y-1 text-[10px]">
                              <div className="text-slate-400">
                                Friends: <span className="text-slate-500">{selectedAgentRelationships.friends.length}/{selectedAgentRelationships.maxFriends}</span>
                              </div>
                              {selectedAgentRelationships.friends.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {selectedAgentRelationships.friends.slice(0, 4).map((f) => {
                                    const color = ARCHETYPE_COLORS[f.archetype] || '#93c5fd';
                                    const glyph = ARCHETYPE_GLYPH[f.archetype] || '●';
                                    return (
                                      <span
                                        key={f.agentId}
                                        className="inline-flex items-center gap-1 rounded border border-emerald-900/40 bg-emerald-950/20 px-1.5 py-0.5 font-mono text-[10px]"
                                        style={{ color }}
                                      >
                                        {glyph} {f.name}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-slate-500">No friends yet</div>
                              )}

                              <div className="mt-1 text-slate-400">Rivals:</div>
                              {selectedAgentRelationships.rivals.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {selectedAgentRelationships.rivals.slice(0, 4).map((f) => {
                                    const color = ARCHETYPE_COLORS[f.archetype] || '#93c5fd';
                                    const glyph = ARCHETYPE_GLYPH[f.archetype] || '●';
                                    return (
                                      <span
                                        key={f.agentId}
                                        className="inline-flex items-center gap-1 rounded border border-rose-900/40 bg-rose-950/15 px-1.5 py-0.5 font-mono text-[10px]"
                                        style={{ color }}
                                      >
                                        {glyph} {f.name}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-slate-500">No rivals</div>
                              )}
                            </div>
                          ) : (
                            <div className="mt-2 text-[10px] text-slate-500">No relationships yet</div>
                          )}
                        </div>

	                  {/* Agent Action Logs */}
	                  <div className="mt-3 border-t border-slate-800/60 pt-2">
	                    <div className="text-[11px] font-semibold text-slate-200 mb-2">
	                      Recent Actions {agentActionsLoading && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
                    </div>
                    <div className="max-h-[100px] overflow-auto space-y-1">
	                      {agentActions.length === 0 && !agentActionsLoading && (
	                        <div className="text-[10px] text-slate-500">No recent actions</div>
	                      )}
		                      {agentActions.map((action) => {
		                        const isSkillWork =
		                          action.type === 'work' &&
		                          action.workType === 'SERVICE' &&
		                          typeof action.content === 'string' &&
		                          action.content.startsWith('X402:');

	                        if (isSkillWork) {
	                          const label = action.content?.replace(/^X402:/, '').trim();
	                          return (
	                            <details
	                              key={action.id}
	                              className="rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[10px] text-slate-300"
	                            >
	                              <summary className="cursor-pointer select-none flex items-center justify-between gap-2">
	                                <div className="min-w-0 truncate">
	                                  <span className="text-purple-300">💳</span>{' '}
	                                  <span className="text-slate-200">{label || 'Paid Skill'}</span>
	                                </div>
	                                <span className="shrink-0 text-slate-600">· {timeAgo(action.createdAt)}</span>
	                              </summary>
	                              <div className="mt-1 space-y-1">
	                                {action.input && (
	                                  <pre className="whitespace-pre-wrap rounded bg-slate-950/40 p-1 font-mono text-[10px] text-slate-300">
	                                    {prettyJson(action.input, 1200)}
	                                  </pre>
	                                )}
	                                {action.output && (
	                                  <pre className="whitespace-pre-wrap rounded bg-slate-950/40 p-1 font-mono text-[10px] text-slate-200">
	                                    {prettyJson(action.output, 1600)}
	                                  </pre>
	                                )}
	                              </div>
	                            </details>
	                          );
		                        }

                            let meta: unknown = null;
                            try {
                              meta = JSON.parse(action.metadata || '{}');
                            } catch {
                              meta = null;
                            }

                            const metaObj = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : null;
                            const metaKind = typeof metaObj?.kind === 'string' ? metaObj.kind : '';

                            const participants = Array.isArray(metaObj?.participants)
                              ? metaObj.participants.filter((p): p is string => typeof p === 'string')
                              : [];

                            type LineLike = { agentId?: unknown; text?: unknown };
                            const rawLines = Array.isArray(metaObj?.lines) ? metaObj.lines : [];
                            const lines = rawLines
                              .filter((l): l is LineLike => !!l && typeof l === 'object')
                              .map((l) => ({ agentId: String(l.agentId ?? ''), text: String(l.text ?? '') }))
                              .filter((l) => l.agentId && l.text)
                              .slice(0, 4);

                            const isChatEvent = action.type === 'event' && metaKind === 'AGENT_CHAT' && lines.length > 0;
                            const isRelChangeEvent = action.type === 'event' && metaKind === 'RELATIONSHIP_CHANGE' && participants.length >= 2;

                            if (isChatEvent) {
                              const relationship = metaObj?.relationship;
                              const relObj =
                                relationship && typeof relationship === 'object'
                                  ? (relationship as Record<string, unknown>)
                                  : null;
                              const relStatus = typeof relObj?.status === 'string' ? relObj.status : null;
                              const relScore = relObj?.score != null ? Number(relObj.score) : null;

                              return (
                                <details
                                  key={action.id}
                                  className="rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[10px] text-slate-300"
                                >
                                  <summary className="cursor-pointer select-none flex items-center justify-between gap-2">
                                    <div className="min-w-0 truncate">
                                      <span className="text-sky-300">💬</span>{' '}
                                      <span className="text-slate-200">{action.title || 'Conversation'}</span>
                                    </div>
                                    <span className="shrink-0 text-slate-600">· {timeAgo(action.createdAt)}</span>
                                  </summary>
                                  <div className="mt-1 space-y-1">
                                    {lines.map((l, idx) => {
                                      const a = agentById.get(l.agentId);
                                      const glyph = a ? (ARCHETYPE_GLYPH[a.archetype] || '●') : '●';
                                      const color = a ? (ARCHETYPE_COLORS[a.archetype] || '#93c5fd') : '#93c5fd';
                                      const name = a?.name || l.agentId.slice(0, 6);
                                      return (
                                        <div key={idx} className="font-mono text-[10px]">
                                          <span style={{ color }}>{glyph} {name}:</span>{' '}
                                          <span className="text-slate-300">"{String(l.text || '').slice(0, 120)}"</span>
                                        </div>
                                      );
                                    })}
                                    {relStatus && (
                                      <div className="text-[10px] text-slate-500">
                                        rel: {relStatus} · score {Number.isFinite(relScore) ? relScore : 0}
                                      </div>
                                    )}
                                  </div>
                                </details>
                              );
                            }

                            if (isRelChangeEvent) {
                              const to = String(metaObj?.to || '').toUpperCase();
                              const emoji = to === 'FRIEND' ? '🤝' : to === 'RIVAL' ? '💢' : '🧊';
                              return (
                                <div
                                  key={action.id}
                                  className="rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[10px] text-slate-300"
                                >
                                  <span className="text-slate-200">{emoji}</span>{' '}
                                  <span className="text-slate-200">{action.title || 'Relationship change'}</span>
                                  <span className="text-slate-600 ml-1">· {timeAgo(action.createdAt)}</span>
                                </div>
                              );
                            }

		                        const workIcon = action.workType === 'MINE' ? '⛏️' : '🔨';
		                        const workLabel =
		                          action.plotIndex != null ? `Plot #${action.plotIndex}` : (action.workType || 'Work');
		                        const content = typeof action.content === 'string' ? action.content.trim() : '';
		                        const contentLine =
	                          content.length > 0
	                            ? content.length > 80 ? `${content.slice(0, 80)}…` : content
	                            : '';

	                        return (
	                          <div
	                            key={action.id}
	                            className="rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[10px] text-slate-300"
	                          >
	                            {action.type === 'work' ? (
	                              <>
	                                <span className="text-amber-400">{workIcon}</span>{' '}
	                                <span className="text-slate-400">{workLabel}</span>
	                                {contentLine && (
	                                  <div className="mt-0.5 text-slate-400 truncate">{contentLine}</div>
	                                )}
	                              </>
	                            ) : (
	                              <>
	                                <span>
	                                  {action.eventType === 'PLOT_CLAIMED' ? '📍' :
	                                   action.eventType === 'BUILD_STARTED' ? '🏗️' :
	                                   action.eventType === 'BUILD_COMPLETED' ? '✅' : '📝'}
	                                </span>{' '}
	                                <span className="text-slate-200">{action.title || action.eventType}</span>
	                              </>
	                            )}
	                            <span className="text-slate-600 ml-1">· {timeAgo(action.createdAt)}</span>
	                          </div>
	                        );
	                      })}
	                    </div>
	                  </div>

                  {/* x402 Agent Interview Button */}
                  <div className="mt-3 border-t border-slate-800/60 pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-purple-700/50 text-purple-300 hover:bg-purple-950/30"
                      onClick={() => fetchAgentInterview(selectedAgent.id)}
                      disabled={x402Loading === 'interview'}
                    >
                      {x402Loading === 'interview' ? (
                        <><Loader2 className="h-3 w-3 animate-spin mr-2" /> Interviewing...</>
                      ) : (
                        <>🎤 Interview Agent <span className="ml-2 text-[10px] opacity-60">$0.005</span></>
                      )}
                    </Button>
                    {x402Interview?.agentId === selectedAgent.id && (
                      <div className="mt-2 p-2 rounded bg-purple-950/30 border border-purple-800/30 text-xs text-slate-300 max-h-[150px] overflow-auto whitespace-pre-wrap">
                        {x402Interview.content}
                      </div>
                    )}
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
