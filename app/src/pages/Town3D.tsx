import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sky, Line } from '@react-three/drei';
import { Button } from '@ui/button';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { PrivyWalletConnect } from '../components/PrivyWalletConnect';
import { SpawnAgent } from '../components/SpawnAgent';
import { playSound, isSoundEnabled, setSoundEnabled } from '../utils/sounds';
// [removed: ResizablePanel, useDegenState, DegenDashboard, PositionTracker, SwapTicker]
import { useWheelStatus } from '../hooks/useWheelStatus';
import { WheelBanner } from '../components/wheel/WheelBanner';
import { WheelArena } from '../components/wheel/WheelArena';
// [removed: confetti]
import { BuildingMesh, preloadBuildingModels } from '../components/buildings';
import { AgentDroid } from '../components/agents/AgentDroid';
import { OnboardingOverlay, isOnboarded } from '../components/onboarding';
import { buildRoadGraph, findPath, type RoadGraph, type RoadSegInput } from '../world/roadGraph';
import { WorldScene } from '../world/WorldScene';
import { StreetLights, generateLightPositions } from '../world/StreetLight';

const API_BASE = '/api/v1';
const TOWN_SPACING = 20;

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
  // Progressive thinking fields
  lastActionType?: string;
  lastReasoning?: string;
  lastNarrative?: string;
  lastTargetPlot?: number | null;
  lastTickAt?: string | null;
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

// [removed: AgentGoalView interface]

type ActivityItem =
  | { kind: 'swap'; data: EconomySwapRow }
  | { kind: 'event'; data: TownEvent };

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error (${res.status}): ${res.statusText}`);
  return res.json() as Promise<T>;
}

function safeTrim(s: unknown, maxLen: number): string {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function formatTimeLeft(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${s}s`;
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

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

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
  const worldHeight = 0.35;
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
  TRAVELING: { emoji: '🚶', color: '#38bdf8' },
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
    <sprite ref={spriteRef} position={[0, 2.6, 0]} scale={[0.28, 0.28, 1]}>
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
    <sprite position={[0.3, 2.5, 0]} scale={[0.18, 0.18, 1]}>
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
      fillRef.current.position.x = (pct - 1) * 0.225;
    }
  });

  // Don't show at full health
  if (health >= 100) return null;

  const healthColor = health > 60 ? '#22c55e' : health > 30 ? '#eab308' : '#ef4444';

  return (
    <group ref={groupRef} position={[0, 2.2, 0]}>
      {/* Background bar */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[0.5, 0.07]} />
        <meshBasicMaterial color="#1f2937" transparent opacity={0.8} />
      </mesh>
      {/* Health fill */}
      <mesh ref={fillRef} position={[0, 0, 0.01]}>
        <planeGeometry args={[0.45, 0.05]} />
        <meshBasicMaterial color={healthColor} />
      </mesh>
    </group>
  );
}

// BuildProgressBar moved to ../components/buildings/constructionStages.tsx

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

// ConstructionAnimation moved to ../components/buildings/effects.tsx

// Speech bubble for chatting agents
function SpeechBubble({
  text,
  position,
  bg = 'rgba(255, 255, 255, 0.95)',
  fg = '#1e293b',
}: {
  text: string;
  position: [number, number, number];
  bg?: string;
  fg?: string;
}) {
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
    ctx.fillStyle = bg;
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
    ctx.fillStyle = fg;
    ctx.font = `${fontSize}px ui-monospace, monospace`;
    ctx.textBaseline = 'middle';
    ctx.fillText(displayText, 10, (h - 6) / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return { texture, width: w, height: h };
  }, [text, bg, fg]);

  const aspect = width / height;
  const worldHeight = 0.22;
  const worldWidth = worldHeight * aspect;

  return (
    <sprite position={position} scale={[worldWidth, worldHeight, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

// Thought bubble — shows agent's last reasoning above their head
function ThoughtBubble({
  agent,
  position,
}: {
  agent: Agent;
  position: [number, number, number];
}) {
  const lastAction = agent.lastActionType;
  const lastReasoning = agent.lastReasoning;
  const lastTickAt = agent.lastTickAt;

  // Show if the agent acted recently (within 90s — generous window for 30s tick interval)
  const isRecent = lastTickAt
    ? (Date.now() - new Date(lastTickAt).getTime()) < 90_000
    : false;

  if (!isRecent || !lastAction || !lastReasoning) return null;

  // Clean up reasoning (remove [AUTO] prefix, trim)
  const cleanReasoning = lastReasoning
    .replace(/\[AUTO\]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Build display text: emoji + short action + reasoning snippet
  const actionEmojis: Record<string, string> = {
    claim_plot: '📍', start_build: '🔨', do_work: '🏗️', complete_build: '🎉',
    buy_arena: '💱', sell_arena: '💱', mine: '⛏️', play_arena: '🎮',
    buy_skill: '💳', rest: '💤',
  };
  const emoji = actionEmojis[lastAction] || '💭';
  const maxLen = 50;
  const text = cleanReasoning.length > maxLen
    ? `${emoji} ${cleanReasoning.slice(0, maxLen)}…`
    : `${emoji} ${cleanReasoning}`;

  const { texture, width, height } = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { texture: new THREE.Texture(), width: 1, height: 1 };

    const fontSize = 16;
    ctx.font = `${fontSize}px ui-monospace, monospace`;
    const displayText = text.slice(0, 55);
    const metrics = ctx.measureText(displayText);
    const w = Math.max(80, metrics.width + 24);
    const h = fontSize + 18;
    canvas.width = w;
    canvas.height = h;

    // Thought bubble background (darker, translucent)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    type RoundRectCapable = CanvasRenderingContext2D & {
      roundRect?: (x: number, y: number, w: number, h: number, radii: number) => void;
    };
    const roundRect = (ctx as RoundRectCapable).roundRect;
    if (typeof roundRect === 'function') {
      roundRect.call(ctx, 0, 0, w, h - 6, 6);
    } else {
      ctx.rect(0, 0, w, h - 6);
    }
    ctx.fill();

    // Thin accent line at top
    ctx.fillStyle = lastAction === 'rest' ? '#64748b' : '#38bdf8';
    ctx.fillRect(0, 0, w, 2);

    // Tail
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 5, h - 6);
    ctx.lineTo(w / 2, h);
    ctx.lineTo(w / 2 + 5, h - 6);
    ctx.fill();

    // Text
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `${fontSize}px ui-monospace, monospace`;
    ctx.textBaseline = 'middle';
    ctx.fillText(displayText, 12, (h - 6) / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return { texture, width: w, height: h };
  }, [text, lastAction]);

  const aspect = width / height;
  const worldHeight = 1.2; // Much larger — visible above agents at metaverse scale
  const worldWidth = worldHeight * aspect;

  return (
    <sprite position={position} scale={[worldWidth, worldHeight, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} opacity={0.92} />
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

// BuildingWindows moved to ../components/buildings/shared.tsx

// Ambient floating particles
function AmbientParticles({ count = 50 }: { count?: number }) {
  const particlesRef = useRef<THREE.Points>(null);
  
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 200;
      arr[i * 3 + 1] = Math.random() * 30 + 3;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 200;
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
    const x = Math.cos(angle) * 100;
    const y = Math.sin(angle) * 80 + 20; // Keep above horizon mostly
    const z = Math.sin(angle * 0.5) * 60;
    
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
      arr[i * 3] = (Math.random() - 0.5) * 250;
      arr[i * 3 + 1] = Math.random() * 50 + 10;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 250;
    }
    return arr;
  }, [intensity]);

  useFrame(() => {
    if (!rainRef.current) return;
    const pos = rainRef.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < intensity; i++) {
      pos[i * 3 + 1] -= 0.8; // Fall speed
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3 + 1] = 50 + Math.random() * 15;
        pos[i * 3] = (Math.random() - 0.5) * 250;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 250;
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

// IndustrialSmoke moved to ../components/buildings/effects.tsx

// Smog layer for polluted towns
function SmogLayer({ pollution }: { pollution: number }) {
  if (pollution < 0.3) return null;
  
  const opacity = (pollution - 0.3) * 0.4; // Max 0.28 opacity at full pollution
  
  return (
    <mesh position={[0, 35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[500, 500]} />
      <meshBasicMaterial color="#3d3825" transparent opacity={opacity} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Market sentiment sky tint
function SentimentAmbience({ sentiment }: { sentiment: 'bull' | 'bear' | 'neutral' }) {
  const color = sentiment === 'bull' ? '#1a2f1a' : sentiment === 'bear' ? '#2f1a1a' : '#1a1a2f';
  const intensity = sentiment === 'neutral' ? 0 : 0.15;
  
  return (
    <mesh position={[0, 60, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[600, 600]} />
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
      arr[i * 3] = (Math.random() - 0.5) * 150;
      arr[i * 3 + 1] = Math.random() * 20 + 3;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 150;
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

    // Grass-green base
    ctx.fillStyle = '#1a3a1a';
    ctx.fillRect(0, 0, size, size);

    // Grass variation — random patches of slightly different greens
    for (let i = 0; i < 800; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const g = 30 + Math.floor(Math.random() * 40);
      ctx.fillStyle = `rgba(${10 + Math.floor(Math.random() * 20)}, ${g + 20}, ${10 + Math.floor(Math.random() * 15)}, 0.3)`;
      ctx.fillRect(x, y, 2 + Math.random() * 3, 1);
    }

    // Subtle grass blade streaks
    ctx.strokeStyle = 'rgba(40, 80, 30, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 4, y + Math.random() * 6);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12, 12);
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  }, []);
}

function zoneMaterial(zone: PlotZone, selected: boolean) {
  const base = new THREE.Color('#2a3328'); // earthy base (not pure black)
  const tint = new THREE.Color(ZONE_COLORS[zone]);
  const color = base.lerp(tint, 0.35);
  const emissive = selected ? tint.clone().multiplyScalar(0.3) : new THREE.Color('#000000');
  return { color, emissive };
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

// buildHeight + BuildingMesh moved to ../components/buildings/

// Mobile detection hook
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

// Agent activity states
type AgentActivity = 'WALKING' | 'IDLE' | 'SHOPPING' | 'CHATTING' | 'BUILDING' | 'MINING' | 'PLAYING' | 'BEGGING' | 'SCHEMING' | 'TRAVELING';

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
  stateEndsAt: number; // stateTimer value when state should end (for fixed-duration states)
  targetPlotId: string | null; // Building they're heading to
  chatPartnerId: string | null; // Agent they're chatting with
  chatEndsAt: number; // stateTimer value when chat should end
  health: number; // 0-100, dies at 0
};

// AgentDroid moved to ../components/agents/AgentDroid.tsx

function Minimap({
  plots,
  agents,
  simsRef,
  selectedAgentId,
  spacing,
  onSelectAgent,
  className,
}: {
  plots: Plot[];
  agents: Agent[];
  simsRef: React.MutableRefObject<Map<string, AgentSim>>;
  selectedAgentId: string | null;
  spacing: number;
  onSelectAgent: (id: string) => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = 160;

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

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, size, size);

      // Background
      ctx.fillStyle = 'rgba(5, 9, 20, 0.9)';
      ctx.fillRect(0, 0, size, size);

      // Calculate world bounds for mapping
      const worldW = (bounds.maxX - bounds.minX + 3) * spacing;
      const worldH = (bounds.maxY - bounds.minY + 3) * spacing;
      const worldRange = Math.max(worldW, worldH);
      const scale = (size - 16) / worldRange;
      const cx = size / 2;
      const cy = size / 2;

      // Draw plots
      for (const p of plots) {
        const wx = (p.x - bounds.centerX) * spacing;
        const wz = (p.y - bounds.centerY) * spacing;
        const sx = cx + wx * scale;
        const sy = cy + wz * scale;
        const plotSize = Math.max(4, spacing * scale * 0.7);

        ctx.fillStyle = p.status === 'BUILT'
          ? ZONE_COLORS[p.zone]
          : p.status === 'UNDER_CONSTRUCTION'
            ? ZONE_COLORS[p.zone] + '80'
            : 'rgba(30, 41, 59, 0.6)';
        ctx.fillRect(sx - plotSize / 2, sy - plotSize / 2, plotSize, plotSize);
      }

      // Draw agents
      const sims = simsRef.current;
      for (const a of agents) {
        const sim = sims.get(a.id);
        if (!sim || sim.state === 'DEAD') continue;
        const sx = cx + sim.position.x * scale;
        const sy = cy + sim.position.z * scale;
        const color = ARCHETYPE_COLORS[a.archetype] || '#93c5fd';
        const isSelected = a.id === selectedAgentId;

        // Ring for followed agent
        if (isSelected) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(sx, sy, 5, 0, Math.PI * 2);
          ctx.stroke();

          // FOV cone
          const heading = sim.heading.clone().normalize();
          const angle = Math.atan2(heading.z, heading.x);
          const fovHalf = 0.4;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(angle - fovHalf) * 20, sy + Math.sin(angle - fovHalf) * 20);
          ctx.lineTo(sx + Math.cos(angle + fovHalf) * 20, sy + Math.sin(angle + fovHalf) * 20);
          ctx.closePath();
          ctx.fill();
        }

        // Agent dot
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(sx, sy, isSelected ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    draw();
    const interval = setInterval(draw, 200);
    return () => clearInterval(interval);
  }, [plots, agents, simsRef, selectedAgentId, bounds, spacing]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (size / rect.width);
    const my = (e.clientY - rect.top) * (size / rect.height);

    const worldW = (bounds.maxX - bounds.minX + 3) * spacing;
    const worldH = (bounds.maxY - bounds.minY + 3) * spacing;
    const worldRange = Math.max(worldW, worldH);
    const scale = (size - 16) / worldRange;
    const cx = size / 2;
    const cy = size / 2;

    // Find closest agent
    let bestDist = 12;
    let bestId: string | null = null;
    const sims = simsRef.current;
    for (const a of agents) {
      const sim = sims.get(a.id);
      if (!sim || sim.state === 'DEAD') continue;
      const sx = cx + sim.position.x * scale;
      const sy = cy + sim.position.z * scale;
      const d = Math.hypot(mx - sx, my - sy);
      if (d < bestDist) {
        bestDist = d;
        bestId = a.id;
      }
    }
    if (bestId) onSelectAgent(bestId);
  };

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      onClick={handleClick}
      className={`block rounded-lg cursor-crosshair ${
        className ?? 'border border-slate-700/50 bg-slate-950/80 backdrop-blur-sm'
      }`}
    />
  );
}

function TownScene({
  town,
  agents,
  selectedPlotId,
  setSelectedPlotId,
  selectedAgentId,
  setSelectedAgentId,
  introRef,
  simsRef,
  onChatStart,
  tradeByAgentId,
  weather,
  economicState,
  coinBursts,
  setCoinBursts,
  deathEffects,
  setDeathEffects,
  spawnEffects,
  setSpawnEffects,
  relationshipsRef,
  fightingAgentIds,
}: {
  town: Town;
  agents: Agent[];
  selectedPlotId: string | null;
  setSelectedPlotId: (id: string | null) => void;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  introRef: React.MutableRefObject<{ active: boolean; t: number }>;
  simsRef: React.MutableRefObject<Map<string, AgentSim>>;
  onChatStart?: (townId: string, agentAId: string, agentBId: string) => void;
  tradeByAgentId: Record<string, { text: string; until: number; isBuy: boolean }>;
  weather: 'clear' | 'rain' | 'storm';
  economicState: { pollution: number; prosperity: number; sentiment: 'bull' | 'bear' | 'neutral' };
  coinBursts: { id: string; position: [number, number, number]; isBuy: boolean }[];
  setCoinBursts: React.Dispatch<React.SetStateAction<{ id: string; position: [number, number, number]; isBuy: boolean }[]>>;
  deathEffects: { id: string; position: [number, number, number] }[];
  setDeathEffects: React.Dispatch<React.SetStateAction<{ id: string; position: [number, number, number] }[]>>;
  spawnEffects: { id: string; position: [number, number, number]; color: string }[];
  setSpawnEffects: React.Dispatch<React.SetStateAction<{ id: string; position: [number, number, number]; color: string }[]>>;
  relationshipsRef: React.MutableRefObject<{ agentAId: string; agentBId: string; status: string; score: number }[]>;
  fightingAgentIds?: Set<string>;
}) {
  const groundTex = useGroundTexture();
  const plots = town.plots;

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
    const cols = maxX - minX + 1;
    const rows = maxY - minY + 1;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    return { minX, maxX, minY, maxY, cols, rows, centerX, centerY };
  }, [plots]);

  const spacing = TOWN_SPACING;
  const lotSize = 16;
  const roadW = Math.max(2.0, spacing - lotSize);

  const roadNodes = useMemo(() => {
    const nodes: THREE.Vector3[] = [];
    // Include a perimeter ring so agents have somewhere to walk even in tiny towns.
    for (let ix = bounds.minX - 1; ix <= bounds.maxX; ix++) {
      for (let iy = bounds.minY - 1; iy <= bounds.maxY; iy++) {
        const wx = (ix + 0.5 - bounds.centerX) * spacing;
        const wz = (iy + 0.5 - bounds.centerY) * spacing;
        nodes.push(new THREE.Vector3(wx, 0.02, wz));
      }
    }
    return nodes;
  }, [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY, bounds.centerX, bounds.centerY, spacing]);

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
      const speed = 2.5 + rng() * 1.5;
      sims.set(a.id, {
        id: a.id,
        position: start,
        heading: new THREE.Vector3(0, 0, 1),
        route: [],
        speed,
        walk: rng() * 10,
        state: 'WALKING',
        stateTimer: 0,
        stateEndsAt: 0,
        targetPlotId: null,
        chatPartnerId: null,
        chatEndsAt: 0,
        health: 100,
      });
    }
  }, [agents, roadNodes, simsRef]);

  const CHAT_DURATION: Record<string, [number, number]> = {
    SHARK: [2, 3], DEGEN: [2, 3],
    ROCK: [3, 4], GRINDER: [3, 4],
    CHAMELEON: [4, 6],
  };

  const plotWorldPosByIndex = useMemo(() => {
    const m = new Map<number, THREE.Vector3>();
    for (const p of plots) {
      const wx = (p.x - bounds.centerX) * spacing;
      const wz = (p.y - bounds.centerY) * spacing;
      m.set(p.plotIndex, new THREE.Vector3(wx, 0.02, wz));
    }
    return m;
  }, [plots, bounds.centerX, bounds.centerY, spacing]);

  // Get plot world position (stable objects; do not mutate returned vectors)
  const getPlotWorldPos = useCallback(
    (plotIndex: number) => plotWorldPosByIndex.get(plotIndex) ?? new THREE.Vector3(0, 0.02, 0),
    [plotWorldPosByIndex],
  );

  // Find built buildings (places agents can visit)
  const builtPlots = useMemo(() => plots.filter((p) => p.status === 'BUILT' || p.status === 'UNDER_CONSTRUCTION'), [plots]);
  const underConstructionPlots = useMemo(() => plots.filter((p) => p.status === 'UNDER_CONSTRUCTION'), [plots]);
  const entertainmentPlots = useMemo(() => plots.filter((p) => p.status === 'BUILT' && p.zone === 'ENTERTAINMENT'), [plots]);

  // Building exclusion zones — AABB half-extent for collision
  const BUILDING_HALF = 7.0; // buildings are ~12 units, half = 6 + margin
  const BUILDING_APPROACH = 9.0; // agents stop this far from center (building edge + sidewalk)

  // Precompute building AABBs for fast collision
  const buildingAABBs = useMemo(() => {
    return builtPlots.map((p) => {
      const pos = getPlotWorldPos(p.plotIndex);
      return {
        id: p.id,
        cx: pos.x,
        cz: pos.z,
        minX: pos.x - BUILDING_HALF,
        maxX: pos.x + BUILDING_HALF,
        minZ: pos.z - BUILDING_HALF,
        maxZ: pos.z + BUILDING_HALF,
      };
    });
  }, [builtPlots, getPlotWorldPos]);

  // Get entrance point for a building (nearest edge toward center of town)
  const getBuildingEntrance = useCallback((plotIndex: number): THREE.Vector3 => {
    const pos = getPlotWorldPos(plotIndex);
    // Push the target point outward from building center by BUILDING_APPROACH
    const dirToCenter = new THREE.Vector3(-pos.x, 0, -pos.z).normalize();
    if (dirToCenter.length() < 0.01) dirToCenter.set(1, 0, 0); // fallback
    return new THREE.Vector3(
      pos.x + dirToCenter.x * BUILDING_APPROACH,
      0.02,
      pos.z + dirToCenter.z * BUILDING_APPROACH,
    );
  }, [getPlotWorldPos]);

  const roadSegments = useMemo(() => {
    type Seg = { id: string; kind: 'V' | 'H'; x: number; z: number; len: number; tone: 'ring' | 'arterial' | 'local' };
    const segs: Seg[] = [];
    const seen = new Set<string>();
    const occ = new Set<string>();
    for (const p of plots) occ.add(`${p.x}:${p.y}`);

    const randForKey = (key: string) => mulberry32(hashToSeed(`${town.id}:roads:${key}`))();

    const addV = (boundaryX: number, rowY: number, len: number, tone: Seg['tone']) => {
      const id = `V:${boundaryX}:${rowY}:${len}:${tone}`;
      if (seen.has(id)) return;
      seen.add(id);
      segs.push({
        id,
        kind: 'V',
        x: (boundaryX - bounds.centerX) * spacing,
        z: (rowY - bounds.centerY) * spacing,
        len,
        tone,
      });
    };

    const addH = (colX: number, boundaryY: number, len: number, tone: Seg['tone']) => {
      const id = `H:${colX}:${boundaryY}:${len}:${tone}`;
      if (seen.has(id)) return;
      seen.add(id);
      segs.push({
        id,
        kind: 'H',
        x: (colX - bounds.centerX) * spacing,
        z: (boundaryY - bounds.centerY) * spacing,
        len,
        tone,
      });
    };

    // Perimeter ring: 4 big roads that frame the town footprint.
    const lenX = (bounds.cols + 1) * spacing;
    const lenZ = (bounds.rows + 1) * spacing;
    const ringV = [bounds.minX - 1, bounds.maxX];
    const ringH = [bounds.minY - 1, bounds.maxY];
    addV(ringV[0], (bounds.minY + bounds.maxY) / 2, lenZ, 'ring');
    addV(ringV[1], (bounds.minY + bounds.maxY) / 2, lenZ, 'ring');
    addH((bounds.minX + bounds.maxX) / 2, ringH[0], lenX, 'ring');
    addH((bounds.minX + bounds.maxX) / 2, ringH[1], lenX, 'ring');

    // A couple of seeded arterials to make the city feel less grid-locked.
    const arterialRng = mulberry32(hashToSeed(`${town.id}:arterials:v1`));
    const vBoundary = (bounds.minX - 1) + Math.floor(arterialRng() * (bounds.cols + 1));
    const hBoundary = (bounds.minY - 1) + Math.floor(arterialRng() * (bounds.rows + 1));
    addV(vBoundary, (bounds.minY + bounds.maxY) / 2, lenZ, 'arterial');
    addH((bounds.minX + bounds.maxX) / 2, hBoundary, lenX, 'arterial');

    const longV = new Set<number>([...ringV, vBoundary]);
    const longH = new Set<number>([...ringH, hBoundary]);

    // Local road tiles around plot edges (with sparse internal streets).
    const internalChance = 0.25;
    const localLen = spacing;
    for (const p of plots) {
      const x = p.x;
      const y = p.y;

      const edges: Array<{
        key: string;
        neighbor: string;
        add: () => void;
      }> = [
        {
          key: `V:${x - 1}:${y}`,
          neighbor: `${x - 1}:${y}`,
          add: () => addV(x - 1, y, localLen, 'local'),
        },
        {
          key: `V:${x}:${y}`,
          neighbor: `${x + 1}:${y}`,
          add: () => addV(x, y, localLen, 'local'),
        },
        {
          key: `H:${x}:${y - 1}`,
          neighbor: `${x}:${y - 1}`,
          add: () => addH(x, y - 1, localLen, 'local'),
        },
        {
          key: `H:${x}:${y}`,
          neighbor: `${x}:${y + 1}`,
          add: () => addH(x, y, localLen, 'local'),
        },
      ];

      for (const e of edges) {
        // Avoid overlapping the long perimeter/arterial roads.
        if (e.key.startsWith('V:')) {
          const bx = Number(e.key.split(':')[1]);
          if (Number.isFinite(bx) && longV.has(bx)) continue;
        } else if (e.key.startsWith('H:')) {
          const by = Number(e.key.split(':')[2]);
          if (Number.isFinite(by) && longH.has(by)) continue;
        }

        // Each segment is shared by two plots; only add once.
        const segKey = `${e.key}:${localLen}:local`;
        if (seen.has(segKey)) continue;

        const neighborOccupied = occ.has(e.neighbor);
        if (!neighborOccupied || randForKey(e.key) < internalChance) {
          e.add();
        }
      }
    }

    return segs;
  }, [plots, bounds, spacing, town.id]);

  // Build a navigable road graph from the procedural road segments (A* pathfinding).
  const roadGraph = useMemo<RoadGraph>(() => {
    const segInputs: RoadSegInput[] = roadSegments.map((s) => ({
      id: s.id,
      kind: s.kind,
      x: s.x,
      z: s.z,
      len: s.len,
      tone: s.tone,
    }));
    return buildRoadGraph(segInputs, plotWorldPosByIndex);
  }, [roadSegments, plotWorldPosByIndex]);

  /** Route an agent from A to B using A* on the road graph, with Catmull-Rom smoothing. */
  function buildRoute(from: THREE.Vector3, to: THREE.Vector3) {
    return findPath(roadGraph, from, to);
  }

  // Street light positions (placed every ~20 units along ring/arterial roads)
  const streetLightPositions = useMemo(() => {
    const mainRoads = roadSegments.filter((s) => s.tone === 'ring' || s.tone === 'arterial');
    return generateLightPositions(mainRoads, 20);
  }, [roadSegments]);

  const fogScale = useMemo(() => {
    return Math.max(1, Math.min(2.8, Math.max(bounds.cols, bounds.rows) / 6));
  }, [bounds.cols, bounds.rows]);

  const groundSize = useMemo(() => {
    return Math.max(500, Math.max(bounds.cols, bounds.rows) * spacing * 4);
  }, [bounds.cols, bounds.rows, spacing]);

  const groundTint = useMemo(() => {
    const t = String(town.theme || '').toLowerCase();
    if (t.includes('desert') || t.includes('oasis')) return '#3d3520';
    if (t.includes('tropical') || t.includes('island') || t.includes('resort') || t.includes('harbor') || t.includes('cove')) return '#1a3828';
    if (t.includes('arctic') || t.includes('snow')) return '#c8d8e8';
    if (t.includes('volcanic') || t.includes('forge')) return '#2a1a10';
    if (t.includes('forest') || t.includes('enchanted')) return '#143820';
    return '#1a3a1a'; // default: grass green
  }, [town.theme]);

  const landmarks = useMemo(() => {
    const theme = String(town.theme || '').toLowerCase();
    const rng = mulberry32(hashToSeed(`${town.id}:landmarks:v1`));
    const base = Math.max(bounds.cols, bounds.rows) * spacing * 0.5;
    const outside = base + spacing * 4;

    const hasWater = /island|cove|harbor|fishing|pirate|oasis|resort/.test(theme);
    const hasForest = /forest|enchanted/.test(theme);
    const hasMountain = /mountain|fortress|volcanic|arctic|cavern|crystal|underground/.test(theme);
    const hasCyber = /cyberpunk|steampunk|trading hub/.test(theme);

    const side = rng() < 0.5 ? 1 : -1;

    const lake = hasWater
      ? {
          pos: [side * (outside + base * 0.25), 0.015, (rng() * 2 - 1) * base * 0.45] as [number, number, number],
          r: Math.max(18, base * (0.38 + rng() * 0.16)),
        }
      : null;

    let hill: { pos: [number, number, number]; r: number; h: number } | null = null;
    if (hasMountain) {
      const r = Math.max(10, base * (0.22 + rng() * 0.16));
      const h = Math.max(8, base * (0.18 + rng() * 0.10));
      hill = {
        pos: [-side * (outside + base * 0.18), h / 2, (rng() * 2 - 1) * base * 0.55],
        r,
        h,
      };
    }

    const neon: Array<{ pos: [number, number, number]; w: number; h: number; d: number; color: string }> = [];
    if (hasCyber) {
      const n = 3 + Math.floor(rng() * 4);
      for (let i = 0; i < n; i++) {
        neon.push({
          pos: [
            (rng() < 0.5 ? 1 : -1) * (outside + base * (0.05 + rng() * 0.25)),
            1.2 + rng() * 0.8,
            (rng() * 2 - 1) * base * 0.7,
          ],
          w: 1.2 + rng() * 1.8,
          h: 1.4 + rng() * 2.8,
          d: 0.25,
          color: rng() < 0.5 ? '#22d3ee' : '#a78bfa',
        });
      }
    }

    const rocks: Array<{ pos: [number, number, number]; s: number; color: string }> = [];
    const trees: Array<{ pos: [number, number, number]; s: number }> = [];

    const ringN = 26 + Math.floor(rng() * 20);
    for (let i = 0; i < ringN; i++) {
      const ang = rng() * Math.PI * 2;
      const r = outside + base * (0.25 + rng() * 0.45);
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      const s = 0.8 + rng() * 1.8;
      rocks.push({
        pos: [x, 0.04, z],
        s,
        color: hasMountain ? '#6a6a60' : '#7a7a6a',
      });
    }

    if (hasForest) {
      const center: [number, number, number] = [side * (outside + base * 0.12), 0.02, -side * base * 0.55];
      const treeN = 18 + Math.floor(rng() * 18);
      for (let i = 0; i < treeN; i++) {
        const dx = (rng() + rng() - 1) * base * 0.35;
        const dz = (rng() + rng() - 1) * base * 0.35;
        trees.push({
          pos: [center[0] + dx, 0.02, center[2] + dz],
          s: 0.8 + rng() * 1.6,
        });
      }
    }

    // Always scatter some trees around the perimeter for a natural look
    const perimeterTrees = 12 + Math.floor(rng() * 16);
    for (let i = 0; i < perimeterTrees; i++) {
      const ang = rng() * Math.PI * 2;
      const r = outside + base * (0.1 + rng() * 0.35);
      trees.push({
        pos: [Math.cos(ang) * r, 0.02, Math.sin(ang) * r],
        s: 0.6 + rng() * 1.4,
      });
    }

    return { lake, hill, neon, rocks, trees };
  }, [town.id, town.theme, bounds.cols, bounds.rows, spacing]);

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
          sim.stateEndsAt = 4 + Math.random() * 3;
          sim.route = [];
        }
        // 2% chance to start scheming when homeless
        if (economicState === 'HOMELESS' && Math.random() < 0.02) {
          sim.state = 'SCHEMING' as AgentState;
          sim.stateTimer = 0;
          sim.stateEndsAt = 3 + Math.random() * 2;
          sim.route = [];
        }
      }

      // Handle IDLE state (thinking before next move)
      if (sim.state === 'IDLE') {
        if (sim.stateEndsAt <= 0) sim.stateEndsAt = 2 + Math.random() * 3;
        if (sim.stateTimer > sim.stateEndsAt) {
          sim.state = 'WALKING';
          sim.stateEndsAt = 0;
        }
        const g = agentGroupRefs.current.get(a.id);
        if (g) g.position.copy(sim.position);
        continue;
      }

      // Handle BEGGING state
      if (sim.state === 'BEGGING') {
        if (sim.stateEndsAt <= 0) sim.stateEndsAt = 4 + Math.random() * 3;
        if (sim.stateTimer > sim.stateEndsAt) {
          sim.state = 'WALKING';
          sim.stateEndsAt = 0;
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
        if (sim.stateEndsAt <= 0) sim.stateEndsAt = 3 + Math.random() * 2;
        if (sim.stateTimer > sim.stateEndsAt) {
          sim.state = 'WALKING';
          sim.stateEndsAt = 0;
        }
        const g = agentGroupRefs.current.get(a.id);
        if (g) {
          g.position.copy(sim.position);
          // Look around suspiciously
          g.rotation.y += Math.sin(sim.stateTimer * 5) * 0.02;
        }
        continue;
      }

      // Check for nearby agents to chat with (shuffled to avoid deterministic pairings)
      if (sim.state === 'WALKING' && !sim.chatPartnerId) {
        const candidates: [string, typeof sim][] = [];
        for (const [otherId, other] of sims) {
          if (otherId === a.id || other.state !== 'WALKING' || other.chatPartnerId) continue;
          if (sim.position.distanceTo(other.position) < 1.5) {
            candidates.push([otherId, other]);
          }
        }
        if (candidates.length > 0) {
          // Fisher-Yates shuffle with seeded RNG
          const chatRng = mulberry32(hashToSeed(`${a.id}:chat:${Math.floor(sim.walk)}`));
          for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(chatRng() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
          }
          const [otherId, other] = candidates[0];
          // Determine chat duration based on archetype
          const archetype = agents.find(ag => ag.id === a.id)?.archetype ?? '';
          const [minDur, maxDur] = CHAT_DURATION[archetype] ?? [3, 5];
          const duration = minDur + Math.random() * (maxDur - minDur);
          // Start chatting!
          sim.state = 'CHATTING';
          sim.chatPartnerId = otherId;
          sim.stateTimer = 0;
          sim.chatEndsAt = duration;
          other.state = 'CHATTING';
          other.chatPartnerId = a.id;
          other.stateTimer = 0;
          other.chatEndsAt = duration;
          sim.route = [];
          other.route = [];
          onChatStart?.(town.id, a.id, otherId);
        }
      }

      // ── Backend-driven behavior: use agent's last real decision ──
      // Check if agent has a recent backend action to drive their 3D state
      const backendActionAge = a.lastTickAt
        ? (Date.now() - new Date(a.lastTickAt).getTime())
        : Infinity;
      const hasRecentAction = backendActionAge < 35_000; // Within one tick cycle

      if (sim.state === 'WALKING' && hasRecentAction && a.lastActionType) {
        const actionType = a.lastActionType;
        const targetPlotIdx = a.lastTargetPlot;

        // If we have a target plot, route there first
        if (targetPlotIdx != null && sim.route.length === 0) {
          const targetPos = getPlotWorldPos(targetPlotIdx);
          if (targetPos) {
            const entrance = getBuildingEntrance(targetPlotIdx);
            const dist = sim.position.distanceTo(entrance);
            if (dist > 2.5) {
              // Walk toward the target plot
              sim.route = buildRoute(sim.position, entrance);
            } else {
              // Already at the plot — start the action animation
              const stateMap: Record<string, AgentState> = {
                claim_plot: 'BUILDING',
                start_build: 'BUILDING',
                do_work: 'BUILDING',
                complete_build: 'BUILDING',
                buy_skill: 'SHOPPING',
                buy_arena: 'SHOPPING',
                sell_arena: 'SHOPPING',
                mine: 'MINING',
                play_arena: 'PLAYING',
              };
              const newState = stateMap[actionType];
              if (newState && sim.state === 'WALKING') {
                sim.state = newState;
                sim.targetPlotId = plots.find(p => p.plotIndex === targetPlotIdx)?.id || null;
                sim.stateTimer = 0;
                sim.stateEndsAt = 4 + Math.random() * 4;
                sim.route = [];
              }
            }
          }
        } else if (!targetPlotIdx && sim.route.length === 0) {
          // No target plot — actions like mine, rest happen in-place
          const inPlaceActions: Record<string, AgentState> = {
            mine: 'MINING',
            rest: 'IDLE',
          };
          const newState = inPlaceActions[actionType];
          if (newState) {
            sim.state = newState as AgentState;
            sim.stateTimer = 0;
            sim.stateEndsAt = 3 + Math.random() * 3;
            sim.route = [];
          }
        }
      }

      // Handle CHATTING state
      if (sim.state === 'CHATTING') {
        if (sim.stateTimer > sim.chatEndsAt) {
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
        if (sim.stateEndsAt <= 0) sim.stateEndsAt = 2 + Math.random() * 3;
        if (sim.stateTimer > sim.stateEndsAt) { // Shop for 2-5 seconds
          sim.state = 'WALKING';
          sim.stateEndsAt = 0;
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
        if (sim.stateEndsAt <= 0) sim.stateEndsAt = 4 + Math.random() * 3;
        if (sim.stateTimer > sim.stateEndsAt) { // Build for 4-7 seconds
          sim.state = 'WALKING';
          sim.stateEndsAt = 0;
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
        if (sim.stateEndsAt <= 0) sim.stateEndsAt = 3 + Math.random() * 2;
        if (sim.stateTimer > sim.stateEndsAt) { // Mine for 3-5 seconds
          sim.state = 'WALKING';
          sim.stateEndsAt = 0;
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
        if (sim.stateEndsAt <= 0) sim.stateEndsAt = 5 + Math.random() * 5;
        if (sim.stateTimer > sim.stateEndsAt) { // Play for 5-10 seconds
          sim.state = 'WALKING';
          sim.stateEndsAt = 0;
        }
        // Spin in place while playing
        const g = agentGroupRefs.current.get(a.id);
        if (g) {
          g.position.copy(sim.position);
          g.rotation.y = sim.stateTimer * 2;
        }
        continue;
      }

      // WALKING behavior — think → walk → stop → think cycle
      if (sim.route.length === 0) {
        // Just arrived at destination: stop and "think" before moving again
        if (sim.state === 'WALKING' && sim.stateEndsAt <= 0) {
          // Enter IDLE ("thinking") state for 2-5 seconds
          sim.state = 'IDLE';
          sim.stateTimer = 0;
          sim.stateEndsAt = 2 + Math.random() * 3;
          sim.route = [];
          const g = agentGroupRefs.current.get(a.id);
          if (g) g.position.copy(sim.position);
          continue;
        }

        // Done thinking — pick a new destination
        const rng = mulberry32(hashToSeed(`${a.id}:${Math.floor(sim.walk)}`));
        const roll = rng();
        const rels = relationshipsRef.current;
        let pickedTarget = false;

        // Priority 1: Backend-driven target plot
        if (!pickedTarget && hasRecentAction && a.lastTargetPlot != null) {
          const entrance = getBuildingEntrance(a.lastTargetPlot);
          if (entrance && sim.position.distanceTo(entrance) > 2.5) {
            sim.targetPlotId = plots.find(p => p.plotIndex === a.lastTargetPlot)?.id || null;
            sim.route = buildRoute(sim.position, entrance);
            pickedTarget = true;
          }
        }

        // 20% chance: walk toward a friend/rival
        if (!pickedTarget && rels.length > 0 && roll < 0.20) {
          const myRels = rels.filter(r => r.agentAId === a.id || r.agentBId === a.id);
          if (myRels.length > 0) {
            const rel = myRels[Math.floor(rng() * myRels.length)];
            const targetId = rel.agentAId === a.id ? rel.agentBId : rel.agentAId;
            const targetSim = sims.get(targetId);
            if (targetSim && targetSim.state !== 'DEAD') {
              sim.targetPlotId = null;
              sim.route = buildRoute(sim.position, targetSim.position.clone());
              pickedTarget = true;
            }
          }
        }

        // 30% chance: head to a building
        if (!pickedTarget && builtPlots.length > 0 && roll < 0.50) {
          const targetPlot = builtPlots[Math.floor(rng() * builtPlots.length)];
          const entrance = getBuildingEntrance(targetPlot.plotIndex);
          sim.targetPlotId = targetPlot.id;
          sim.route = buildRoute(sim.position, entrance);
          pickedTarget = true;
        }

        // Fallback: random road node
        if (!pickedTarget) {
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
        // Reset stateEndsAt so next arrival triggers thinking
        sim.stateEndsAt = 0;
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
        if (otherDist < 1.0 && otherDist > 0.01) {
          avoidance.addScaledVector(toOther.normalize(), -0.5 * (1.0 - otherDist));
        }
      }

      dir.normalize();
      dir.add(avoidance).normalize();
      sim.heading.lerp(dir, 0.25);
      sim.position.addScaledVector(dir, sim.speed * dt);
      sim.walk += dt * sim.speed * 2.2;

      // ── HARD AABB building exclusion ──
      // After all movement, physically prevent agent from being inside any building.
      // This is the hard guarantee — no soft push, just clamp out.
      for (const bb of buildingAABBs) {
        const px = sim.position.x;
        const pz = sim.position.z;
        // Check if agent is inside this building's AABB
        if (px > bb.minX && px < bb.maxX && pz > bb.minZ && pz < bb.maxZ) {
          // Find the nearest edge to push out through
          const dLeft = px - bb.minX;
          const dRight = bb.maxX - px;
          const dTop = pz - bb.minZ;
          const dBottom = bb.maxZ - pz;
          const minD = Math.min(dLeft, dRight, dTop, dBottom);
          const margin = 0.15; // small extra push so they clear the edge
          if (minD === dLeft) sim.position.x = bb.minX - margin;
          else if (minD === dRight) sim.position.x = bb.maxX + margin;
          else if (minD === dTop) sim.position.z = bb.minZ - margin;
          else sim.position.z = bb.maxZ + margin;
          // Clear route since it was going through the building
          if (sim.route.length > 0) sim.route = [];
        }
      }

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

      // Third-person camera locked behind followed agent
      if (selectedAgentId) {
        const sim = sims.get(selectedAgentId);
        if (sim) {
          const headingNorm = sim.heading.clone().normalize();
          if (introRef.current.active) {
            // Cinematic swoop from sky to behind agent
            introRef.current.t = Math.min(1, introRef.current.t + dt * 0.5);
            const e = easeOutCubic(introRef.current.t);
            const skyPos = new THREE.Vector3(50, 55, 50);
            const behind = headingNorm.clone().multiplyScalar(-14);
            const target = sim.position.clone().add(behind).add(new THREE.Vector3(0, 7, 0));
            camera.position.lerpVectors(skyPos, target, e);
            const skyLook = new THREE.Vector3(0, 0, 0);
            const agentLook = sim.position.clone().add(new THREE.Vector3(0, 2.5, 0))
              .add(headingNorm.clone().multiplyScalar(5));
            const lookTarget = skyLook.clone().lerp(agentLook, e);
            camera.lookAt(lookTarget);
            if (introRef.current.t >= 1) introRef.current.active = false;
          } else {
            // Normal third-person follow
            const back = headingNorm.clone().multiplyScalar(-14);
            const desired = sim.position.clone().add(back).add(new THREE.Vector3(0, 7, 0));
            camera.position.lerp(desired, 0.06);
            const lookAhead = sim.position.clone().add(new THREE.Vector3(0, 2.5, 0))
              .add(headingNorm.clone().multiplyScalar(5));
            camera.lookAt(lookAhead);
          }
        }
      }
  });

  return (
    <group>
      {/* Day/Night cycle with moving sun */}
      <DayNightCycle timeScale={0.015} />

      {/* Fog - soft atmospheric */}
      <fog attach="fog" args={[
        weather === 'storm' ? '#2a3545' : weather === 'rain' ? '#3a4a5a' : '#7a9ab0',
        weather === 'storm' ? 60 : weather === 'rain' ? 100 : 120,
        (weather === 'storm' ? 250 : weather === 'rain' ? 350 : 500) * fogScale
      ]} />

      {/* Ambient floating particles */}
      <AmbientParticles count={25} />

      {/* Economic atmosphere effects */}
      <SmogLayer pollution={economicState.pollution} />
      <SentimentAmbience sentiment={economicState.sentiment} />
      <ProsperitySparkles prosperity={economicState.prosperity} />

      {/* Weather effects */}
      {weather === 'rain' && <RainEffect intensity={80} />}
      {weather === 'storm' && <RainEffect intensity={200} />}

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

      {/* Ambient light */}
      <ambientLight intensity={weather === 'storm' ? 0.5 : weather === 'rain' ? 0.7 : 1.0} />
      {/* Warm directional sunlight */}
      <directionalLight position={[80, 120, 50]} intensity={weather === 'storm' ? 0.3 : weather === 'rain' ? 0.5 : 1.2} color="#fff5e0" />

      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial color={groundTint} map={groundTex ?? undefined} roughness={1} />
      </mesh>

      {/* Roads / paths (procedural) */}
      <group position={[0, 0.01, 0]}>
        {roadSegments.map((s) => {
          return (
            <mesh key={s.id} position={[s.x, 0, s.z]}>
              <boxGeometry args={[
                s.kind === 'H' ? s.len : roadW,
                0.05,
                s.kind === 'V' ? s.len : roadW
              ]} />
              <meshStandardMaterial
                color={s.tone === 'arterial' ? '#5a5a5a' : s.tone === 'ring' ? '#4a4a4a' : '#3a3a3a'}
                roughness={0.85}
              />
            </mesh>
          );
        })}
      </group>

      {/* Street lights along main roads */}
      {streetLightPositions.length > 0 && <StreetLights positions={streetLightPositions} />}

      {/* Landmarks / outskirts (procedural) */}
      <group>
        {landmarks.lake && (
          <mesh receiveShadow rotation-x={-Math.PI / 2} position={landmarks.lake.pos}>
            <circleGeometry args={[landmarks.lake.r, 48]} />
            <meshStandardMaterial color={'#2277bb'} transparent opacity={0.7} roughness={0.15} metalness={0.1} />
          </mesh>
        )}
        {landmarks.hill && (
          <mesh receiveShadow position={landmarks.hill.pos}>
            <coneGeometry args={[landmarks.hill.r, landmarks.hill.h, 14]} />
            <meshStandardMaterial color={'#3a5a3a'} roughness={0.9} />
          </mesh>
        )}
        {landmarks.neon.map((n, idx) => (
          <mesh key={`neon-${idx}`} position={n.pos} castShadow>
            <boxGeometry args={[n.w, n.h, n.d]} />
            <meshStandardMaterial color={n.color} emissive={n.color} emissiveIntensity={0.9} roughness={0.3} />
          </mesh>
        ))}
        {landmarks.rocks.map((r, idx) => (
          <mesh key={`rock-${idx}`} position={r.pos} castShadow receiveShadow>
            <dodecahedronGeometry args={[r.s, 0]} />
            <meshStandardMaterial color={'#6b6b60'} roughness={0.95} />
          </mesh>
        ))}
        {landmarks.trees.map((t, idx) => (
          <group key={`tree-${idx}`} position={t.pos} scale={t.s * 2.5}>
            <mesh castShadow receiveShadow position={[0, 1.5, 0]}>
              <cylinderGeometry args={[0.3, 0.45, 3.0, 6]} />
              <meshStandardMaterial color={'#5a3a20'} roughness={0.9} />
            </mesh>
            <mesh castShadow receiveShadow position={[0, 4.0, 0]}>
              <coneGeometry args={[1.6, 3.8, 7]} />
              <meshStandardMaterial color={'#1a6830'} roughness={0.8} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Lots + Buildings */}
      {plots.map((p) => {
        const wx = (p.x - bounds.centerX) * spacing;
        const wz = (p.y - bounds.centerY) * spacing;
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
              <boxGeometry args={[lotSize, 0.12, lotSize]} />
              <meshStandardMaterial
                color={color}
                emissive={emissive}
                roughness={0.92}
              />
            </mesh>

            {/* Claimed marker for claimed but not yet building */}
            {p.status === 'CLAIMED' && (
              <ClaimedMarker position={[wx + 6.5, 0, wz + 6.5]} color={ZONE_COLORS[p.zone]} />
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

	      {/* Central Arena Building */}
	      <group position={[0, 0, 0]}>
	        {/* Arena platform */}
	        <mesh position={[0, 0.05, 0]} receiveShadow>
	          <cylinderGeometry args={[8, 9, 0.3, 32]} />
	          <meshStandardMaterial color="#1a1a2e" metalness={0.6} roughness={0.3} />
	        </mesh>
	        {/* Arena dome */}
	        <mesh position={[0, 3.5, 0]} castShadow>
	          <sphereGeometry args={[5, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
	          <meshStandardMaterial color="#16213e" transparent opacity={0.6} metalness={0.8} roughness={0.2} side={THREE.DoubleSide} />
	        </mesh>
	        {/* Arena ring */}
	        <mesh position={[0, 0.4, 0]}>
	          <torusGeometry args={[7.5, 0.15, 8, 48]} />
	          <meshStandardMaterial color="#e94560" emissive="#e94560" emissiveIntensity={0.5} />
	        </mesh>
	        {/* Arena pillars */}
	        {[0, 1, 2, 3, 4, 5].map((i) => {
	          const angle = (i / 6) * Math.PI * 2;
	          return (
	            <mesh key={`pillar-${i}`} position={[Math.cos(angle) * 7.5, 2, Math.sin(angle) * 7.5]} castShadow>
	              <cylinderGeometry args={[0.3, 0.3, 4, 8]} />
	              <meshStandardMaterial color="#0f3460" metalness={0.7} roughness={0.3} />
	            </mesh>
	          );
	        })}
	        {/* Arena label */}
	        <BillboardLabel text={`⚔️ ARENA ${fightingAgentIds?.size ? `(${fightingAgentIds.size} inside)` : ''}`} position={[0, 6.5, 0]} color="#e94560" />
	        {/* Glow when fight active */}
	        {(fightingAgentIds?.size ?? 0) > 0 && (
	          <pointLight position={[0, 4, 0]} color="#e94560" intensity={3} distance={15} />
	        )}
	      </group>

	      {/* Agents */}
	      <group>
	        {agents.filter((a) => !fightingAgentIds?.has(a.id)).map((a) => {
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
	                onClick={() => {}}
	                simsRef={simsRef}
	                economicState={economicState}
	                BillboardLabel={BillboardLabel}
	              />
		              {tradeByAgentId[a.id]?.text && (
		                <SpeechBubble
		                  text={tradeByAgentId[a.id].text}
		                  position={[0, 2.85, 0]}
		                  bg={tradeByAgentId[a.id].isBuy ? 'rgba(16, 185, 129, 0.92)' : 'rgba(244, 63, 94, 0.92)'}
		                  fg={'#0b1220'}
		                />
		              )}
		              <StateIndicator agentId={a.id} simsRef={simsRef} />
		              <HealthBar agentId={a.id} simsRef={simsRef} />
		            </group>
	          );
	        })}
      </group>
      
      {/* Destination lines for visible agents */}
      {agents.filter((a) => !fightingAgentIds?.has(a.id)).map((a) => (
        <DestinationLine
          key={`line-${a.id}`}
          agentId={a.id}
          simsRef={simsRef}
          color={ARCHETYPE_COLORS[a.archetype] || '#93c5fd'}
        />
      ))}

      {/* Agent trails */}
      {agents.filter((a) => !fightingAgentIds?.has(a.id)).map((a) => (
        <AgentTrail
          key={`trail-${a.id}`}
          agentId={a.id}
          simsRef={simsRef}
          color={ARCHETYPE_COLORS[a.archetype] || '#93c5fd'}
        />
      ))}

    </group>
  );
}

// Mini-map component showing bird's eye view

// Floating notification for swaps
interface SwapNotification {
  id: string;
  agentId: string;
  agentName: string;
  archetype: string;
  side: 'BUY_ARENA' | 'SELL_ARENA';
  amount: number;
  createdAt: number;
}

// Preload building GLB models as soon as module is imported
preloadBuildingModels();

export default function Town3D() {
  const isMobile = useIsMobile();
  const [mobilePanel, setMobilePanel] = useState<'none' | 'info' | 'feed' | 'chat' | 'agent' | 'spawn'>('none');
  const [towns, setTowns] = useState<TownSummary[]>([]);
  const [town, setTown] = useState<Town | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [economy, setEconomy] = useState<EconomyPoolSummary | null>(null);
  const [swaps, setSwaps] = useState<EconomySwapRow[]>([]);
  const [events, setEvents] = useState<TownEvent[]>([]);
  const [worldEvents, setWorldEvents] = useState<{ emoji: string; name: string; description: string; type: string }[]>([]);
  // [removed: agentGoalsById state]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swapNotifications, setSwapNotifications] = useState<SwapNotification[]>([]);
  const [eventNotifications, setEventNotifications] = useState<TownEvent[]>([]);
  const seenSwapIdsRef = useRef<Set<string>>(new Set());
  const swapsPrimedRef = useRef(false);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const seenTradeEventIdsRef = useRef<Set<string>>(new Set());

  const userSelectedTownIdRef = useRef<string | null>(null);
  const activeTownIdRef = useRef<string | null>(null);
  const [selectedTownId, setSelectedTownId] = useState<string | null>(null);

  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const introRef = useRef({ active: true, t: 0 });
  const simsRef = useRef<Map<string, AgentSim>>(new Map());

  // Auto-select first agent so camera has someone to follow
  useEffect(() => {
    if (!selectedAgentId && agents.length > 0) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  // Keep active town id in a ref for interval callbacks
  useEffect(() => {
    activeTownIdRef.current = town?.id ?? null;
  }, [town?.id]);

  // Relationship ref (kept for TownScene prop, but no longer polled)
  type RelEntry = { agentAId: string; agentBId: string; status: string; score: number };
  const relationshipsRef = useRef<RelEntry[]>([]);

  // [removed: fetchGoals polling]

  // Trade speech bubbles (kept for 3D display)
  const [tradeByAgentId, setTradeByAgentId] = useState<Record<string, { text: string; until: number; isBuy: boolean }>>({});

  // Clear trade bubbles when switching towns
  useEffect(() => {
    seenTradeEventIdsRef.current = new Set();
    setTradeByAgentId({});
  }, [town?.id]);


  // [removed: AgentAction interface, agentActions state]

  
  
  // Sound toggle
  const [soundOn, setSoundOn] = useState(true);

  // Degen mode state
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [showSpawnOverlay, setShowSpawnOverlay] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboarded());

  // connectWallet: Privy handles this via PrivyWalletConnect component.
  // This fallback tries window.ethereum for SpawnAgent compatibility.
  const connectWallet = useCallback(async (): Promise<string | null> => {
    if (walletAddress) return walletAddress;
    try {
      const eth = (window as any).ethereum;
      if (!eth) { alert('Click "Sign In" to create a wallet — no extension needed!'); return null; }
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      const addr = accounts?.[0] || null;
      if (addr) setWalletAddress(addr);
      return addr;
    } catch { return null; }
  }, [walletAddress]);
  const wheel = useWheelStatus();
  const [wheelArenaOpen, setWheelArenaOpen] = useState(false);

  // Compute which agents are currently fighting (hide them from the map)
  const fightingAgentIds = useMemo(() => {
    const ids = new Set<string>();
    const phase = wheel.status?.phase;
    const match = wheel.status?.currentMatch;
    if (match && (phase === 'ANNOUNCING' || phase === 'FIGHTING' || phase === 'AFTERMATH')) {
      ids.add(match.agent1.id);
      ids.add(match.agent2.id);
    }
    return ids;
  }, [wheel.status?.phase, wheel.status?.currentMatch?.agent1?.id, wheel.status?.currentMatch?.agent2?.id]);

  // Auto-open WheelArena when a match starts (ANNOUNCING/FIGHTING/AFTERMATH)
  useEffect(() => {
    const p = wheel.status?.phase;
    if (p === 'ANNOUNCING' || p === 'FIGHTING') {
      setWheelArenaOpen(true);
    } else if (p === 'PREP' || p === 'IDLE') {
      // Auto-close after AFTERMATH fades
      const t = setTimeout(() => setWheelArenaOpen(false), 1000);
      return () => clearTimeout(t);
    }
  }, [wheel.status?.phase]);

  // [removed: confetti/PnL effect]
  
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

  const pushTradeText = useCallback((agentId: string, isBuy: boolean, text: string) => {
    const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 64);
    if (!agentId || !clean) return;
    const until = Date.now() + 2400;
    setTradeByAgentId((prev) => ({ ...prev, [agentId]: { text: clean, until, isBuy } }));
    window.setTimeout(() => {
      setTradeByAgentId((prev) => {
        if (prev[agentId]?.until !== until) return prev;
        const next = { ...prev };
        delete next[agentId];
        return next;
      });
    }, 2700);
  }, []);

  const pushTradeAmount = useCallback((agentId: string, isBuy: boolean, amount: number) => {
    const amt = Math.max(0, Math.round(Number(amount) || 0));
    if (!agentId || amt <= 0) return;
    pushTradeText(agentId, isBuy, `${isBuy ? 'BUY' : 'SELL'} ${amt.toLocaleString()} ARENA`);
  }, [pushTradeText]);

  const agentById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const agentByIdRef = useRef<Map<string, Agent>>(new Map());
  useEffect(() => {
    agentByIdRef.current = agentById;
  }, [agentById]);

  // [removed: requestChat callback]

  // [removed: fetch agent action logs]



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

  // Poll world events
  useEffect(() => {
    let cancelled = false;
    async function loadWorldEvents() {
      try {
        const res = await apiFetch<{ events: { emoji: string; name: string; description: string; type: string }[] }>('/events/active');
        if (!cancelled) setWorldEvents(res.events);
      } catch {}
    }
    loadWorldEvents();
    const t = setInterval(loadWorldEvents, 10000);
    return () => { cancelled = true; clearInterval(t); };
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
          // Prime swap IDs on first fetch so we don't "replay" historical swaps as live notifications.
          if (!swapsPrimedRef.current) {
            swapsPrimedRef.current = true;
            for (const s of res.swaps) {
              if (s?.id) seenSwapIdsRef.current.add(s.id);
            }
            setSwaps(res.swaps);
            return;
          }

          // Detect new swaps for notifications
          const newNotifs: SwapNotification[] = [];
	          for (const s of res.swaps) {
	            if (!seenSwapIdsRef.current.has(s.id)) {
	              seenSwapIdsRef.current.add(s.id);
	              newNotifs.push({
	                id: s.id,
	                agentId: s.agent?.id || '',
	                agentName: s.agent?.name || 'Unknown',
	                archetype: s.agent?.archetype || 'ROCK',
	                side: s.side,
	                amount: s.side === 'BUY_ARENA' ? s.amountOut : s.amountIn,
	                createdAt: Date.now(),
	              });
	            }
	          }
	          if (newNotifs.length > 0) {
	            setSwapNotifications(prev => [...newNotifs, ...prev].slice(0, 3));
	            // Play sound for new swaps
	            playSound('swap');
	            // Add coin burst effects (spawn around the agent so the swap feels "real")
	            newNotifs.forEach(n => {
	              const sim = n.agentId ? simsRef.current.get(n.agentId) : null;
	              const pos: [number, number, number] = sim
	                ? [sim.position.x, 2.1, sim.position.z]
	                : [(Math.random() - 0.5) * 30, 2, (Math.random() - 0.5) * 30];
	              setCoinBursts(prev => [...prev, { id: n.id, position: pos, isBuy: n.side === 'BUY_ARENA' }]);
	            });
	            // Auto-remove after 3 seconds
	            setTimeout(() => {
	              setSwapNotifications(prev => prev.filter(n => !newNotifs.some(nn => nn.id === n.id)));
	            }, 3000);
	          }
          setSwaps(res.swaps);
        }
      } catch {
        // ignore
      }
	    }
	    void loadSwaps();
	    const t = setInterval(loadSwaps, 5000);
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

          // Trade speech bubbles from authoritative TownEvents (purpose-aware).
          const activeTownId = activeTownIdRef.current;
          if (activeTownId) {
            const tradeBubbles: Array<{ agentId: string; isBuy: boolean; text: string }> = [];
            for (const e of res.events) {
              if (e.townId !== activeTownId) continue;
              if (seenTradeEventIdsRef.current.has(e.id)) continue;
              if (e.eventType !== 'TRADE') continue;
              if (!e.agentId) continue;

              let meta: any = null;
              try {
                meta = JSON.parse(e.metadata || '{}');
              } catch {
                meta = null;
              }
              if (!meta || typeof meta !== 'object') continue;
              if (String(meta.kind || '') !== 'AGENT_TRADE') continue;

              const side = String(meta.side || '').toUpperCase();
              if (side !== 'BUY_ARENA' && side !== 'SELL_ARENA') continue;
              const isBuy = side === 'BUY_ARENA';
              const nextAction = typeof meta.nextAction === 'string' ? meta.nextAction : '';
              const purpose = typeof meta.purpose === 'string' ? meta.purpose : '';
              const amountArena = Number(meta.amountArena || (isBuy ? meta.amountOut : meta.amountIn) || 0);

              const label =
                safeTrim(nextAction, 20)
                  ? `${isBuy ? 'FUEL' : 'CASH'} → ${safeTrim(nextAction, 20)}`
                  : safeTrim(purpose, 44)
                    ? safeTrim(purpose, 44)
                    : Number.isFinite(amountArena) && amountArena > 0
                      ? `${isBuy ? 'BUY' : 'SELL'} ${Math.round(amountArena)} ARENA`
                      : '';

              if (label) {
                tradeBubbles.push({ agentId: e.agentId, isBuy, text: label });
              }
              seenTradeEventIdsRef.current.add(e.id);
            }

            // Limit bursts per poll to avoid spam if history backfills.
            tradeBubbles.slice(0, 6).forEach((b) => {
              pushTradeText(b.agentId, b.isBuy, b.text);
            });
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
  const recentSwaps = useMemo(() => swaps.slice(0, 8), [swaps]);

  // Latest agent thoughts for the activity panel
  const latestThoughts = useMemo(() => {
    return agents
      .filter(a => a.lastReasoning && a.lastTickAt)
      .map(a => ({
        agentId: a.id,
        agentName: a.name,
        archetype: a.archetype,
        actionType: a.lastActionType || 'rest',
        reasoning: a.lastReasoning || '',
        narrative: a.lastNarrative || '',
        tickAt: a.lastTickAt || '',
      }))
      .sort((a, b) => new Date(b.tickAt).getTime() - new Date(a.tickAt).getTime());
  }, [agents]);
  // [removed: selectedAgentSwaps]

  // [removed: selectedAgentObjective useMemo]

  // [removed: tradeTickerItems useMemo]

  // Merge swaps and events into unified activity feed
  const activityFeed = useMemo(() => {
    // If a swap is mirrored as a TRADE town event (with purpose), show the event and hide the raw swap row.
    const tradeSwapIds = new Set<string>();
    for (const e of events) {
      if (e.eventType !== 'TRADE') continue;
      try {
        const meta = JSON.parse(e.metadata || '{}') as any;
        if (meta && typeof meta === 'object' && String(meta.kind || '') === 'AGENT_TRADE' && typeof meta.swapId === 'string') {
          tradeSwapIds.add(meta.swapId);
        }
      } catch {
        // ignore
      }
    }

    const swapItems = swaps
      .filter((s) => !tradeSwapIds.has(s.id))
      .map((s): ActivityItem => ({ kind: 'swap', data: s }));
    const eventItems = events.map((e): ActivityItem => ({ kind: 'event', data: e }));

    // Reserve slots for events so swaps don't crowd them out
    const sortByTime = (a: ActivityItem, b: ActivityItem) => {
      const aTime = a.data.createdAt;
      const bTime = b.data.createdAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    };

    const recentEvents = eventItems.sort(sortByTime).slice(0, 8);
    const recentSwaps = swapItems.sort(sortByTime).slice(0, 15 - recentEvents.length);

    const combined = [...recentEvents, ...recentSwaps];
    combined.sort(sortByTime);
    return combined;
  }, [swaps, events]);

  // [removed: feedTab state]

  // [removed: auto-show mobile agent panel]

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

  // Shared: Wheel Arena overlay (renders on top of everything, both mobile & desktop)
  const wheelArenaOverlay = wheelArenaOpen && wheel.status && (wheel.status.phase === 'ANNOUNCING' || wheel.status.phase === 'FIGHTING' || wheel.status.phase === 'AFTERMATH') ? (
    <WheelArena
      status={wheel.status}
      odds={wheel.odds}
      walletAddress={walletAddress}
      onBet={wheel.placeBet}
      loading={wheel.loading}
      onClose={() => setWheelArenaOpen(false)}
    />
  ) : null;

  /* ────────────── MOBILE LAYOUT ────────────── */
  if (isMobile) return (
    <div className="flex flex-col h-[100svh] w-full overflow-hidden bg-[#050914]">
      {showOnboarding && (
        <OnboardingOverlay walletAddress={walletAddress} onComplete={() => setShowOnboarding(false)} />
      )}
      {wheelArenaOverlay}
      {/* Mobile top bar — compact */}
      <div className="shrink-0 flex items-center justify-between px-3 py-1 bg-slate-950/95 border-b border-slate-800/40 z-50">
        <span className="text-xs font-bold text-amber-400">AI TOWN</span>
        {economy && Number.isFinite(economy.spotPrice) && (
          <span className="text-[10px] text-slate-500 font-mono">$ARENA {economy.spotPrice.toFixed(4)}</span>
        )}
        <div className="flex items-center gap-1">
          {worldEvents.length > 0 && (
            <span className="text-[10px] animate-pulse text-amber-400" title={worldEvents[0].name}>
              {worldEvents[0].emoji}
            </span>
          )}
          <span className="text-[10px]" title={`Weather: ${weather}`}>
            {weather === 'clear' ? '☀️' : weather === 'rain' ? '🌧️' : '⛈️'}
          </span>
          <span className="text-[10px]">
            {economicState.sentiment === 'bull' ? '📈' : economicState.sentiment === 'bear' ? '📉' : '➡️'}
          </span>
          {wheel.status?.phase === 'ANNOUNCING' && (
            <span className="text-[10px] animate-pulse text-purple-400" title="Betting open!">🎰</span>
          )}
          {wheel.status?.phase === 'FIGHTING' && (
            <span className="text-[10px] animate-pulse text-red-400" title="Fight in progress">⚔️</span>
          )}
        </div>
      </div>

      {/* Fullscreen 3D Canvas */}
      <div className="relative flex-1 min-h-0" style={{ touchAction: 'none' }}>
        <Canvas
          shadows={false}
          dpr={1}
          camera={{ position: [50, 55, 50], fov: 50, near: 0.5, far: 3000 }}
          gl={{ antialias: false, powerPreference: 'low-power', alpha: false }}
          onPointerMissed={() => { setSelectedPlotId(null); }}
          fallback={<div className="h-full w-full grid place-items-center bg-slate-950 text-slate-300 text-sm">WebGL not supported</div>}
        >
          <TownScene
            town={town}
            agents={agents}
            selectedPlotId={selectedPlotId}
            setSelectedPlotId={setSelectedPlotId}
            selectedAgentId={selectedAgentId}
            setSelectedAgentId={setSelectedAgentId}
            introRef={introRef}
            simsRef={simsRef}
            tradeByAgentId={tradeByAgentId}
            weather={'clear'}
            economicState={{ pollution: 0, prosperity: economicState.prosperity, sentiment: economicState.sentiment }}
            coinBursts={coinBursts}
            setCoinBursts={setCoinBursts}
            deathEffects={deathEffects}
            setDeathEffects={setDeathEffects}
            spawnEffects={spawnEffects}
            setSpawnEffects={setSpawnEffects}
            relationshipsRef={relationshipsRef}
            fightingAgentIds={fightingAgentIds}
          />
        </Canvas>

        {/* Swap Notifications — center-top mobile */}
        <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-50">
          {swapNotifications.slice(0, 2).map((notif) => {
            const isBuy = notif.side === 'BUY_ARENA';
            return (
              <div key={notif.id} className="animate-in slide-in-from-top-2 fade-in duration-300">
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] backdrop-blur-md ${
                  isBuy ? 'bg-emerald-950/80 text-emerald-200' : 'bg-rose-950/80 text-rose-200'
                }`}>
                  <span>{isBuy ? '📈' : '📉'}</span>
                  <span className="font-mono">{notif.agentName}</span>
                  <span className="font-mono font-semibold">{Math.round(notif.amount)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* (mobile town info removed) */}

        {/* Wheel of Fate banner (mobile) */}
        {wheel.status && wheel.status.phase !== 'IDLE' && wheel.status.phase !== 'PREP' && (
          <div className="pointer-events-auto absolute bottom-14 left-0 right-0 z-50">
            <WheelBanner
              status={wheel.status}
              odds={wheel.odds}
              walletAddress={walletAddress}
              onBet={wheel.placeBet}
              loading={wheel.loading}
              isMobile
            />
          </div>
        )}

        {/* Mobile bottom nav buttons */}
        <div className="pointer-events-auto absolute bottom-2 left-2 right-2 z-50 flex items-center justify-between">
          <div className="flex gap-1.5">
            <button
              className={`px-3 py-1.5 rounded-lg text-xs backdrop-blur-md border transition-all ${
                mobilePanel === 'feed' ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-slate-950/70 border-slate-800/40 text-slate-300'
              }`}
              onClick={() => setMobilePanel(mobilePanel === 'feed' ? 'none' : 'feed')}
            >
              📋 Feed
            </button>
            <button
              className={`px-3 py-1.5 rounded-lg text-xs backdrop-blur-md border transition-all ${
                mobilePanel === 'spawn' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-slate-950/70 border-slate-800/40 text-slate-300'
              }`}
              onClick={() => setMobilePanel(mobilePanel === 'spawn' ? 'none' : 'spawn')}
            >
              🤖+
            </button>
          </div>
        </div>

        {/* Mobile bottom sheet */}
        {mobilePanel !== 'none' && (
          <div className="absolute bottom-12 left-0 right-0 z-40 max-h-[50vh] overflow-auto">
            <div className="mx-2 backdrop-blur-xl bg-slate-950/90 rounded-t-xl border border-slate-800/40 p-3">
              {/* Close handle */}
              <div className="flex justify-center mb-2">
                <button
                  className="w-10 h-1 rounded-full bg-slate-600"
                  onClick={() => setMobilePanel('none')}
                />
              </div>

              {mobilePanel === 'feed' && (
                <div className="space-y-1 max-h-[40vh] overflow-auto">
                  <div className="text-xs font-semibold text-slate-200 mb-1">Activity Feed</div>
                  {activityFeed.filter((item) => {
                    // Filter to current agent
                    if (selectedAgentId) {
                      if (item.kind === 'swap') {
                        if (item.data.agentId !== selectedAgentId) return false;
                      } else {
                        const ev = item.data;
                        if (ev.agentId && ev.agentId !== selectedAgentId) {
                          try { const m = JSON.parse(ev.metadata || '{}'); if (m?.winnerId !== selectedAgentId && m?.loserId !== selectedAgentId) return false; } catch { return false; }
                        }
                      }
                    }
                    if (item.kind === 'swap') return true;
                    const e = item.data;
                    if (e.eventType === 'ARENA_MATCH' || e.eventType === 'TRADE') return true;
                    const HIDDEN = ['PLOT_CLAIMED','BUILD_STARTED','BUILD_COMPLETED','TOWN_COMPLETED','YIELD_DISTRIBUTED','AGENT_CHAT','RELATIONSHIP_CHANGE','TOWN_OBJECTIVE','TOWN_OBJECTIVE_RESOLVED','X402_SKILL'];
                    if (HIDDEN.includes(e.eventType)) return false;
                    try { const meta = JSON.parse(e.metadata || '{}'); if (meta?.kind && HIDDEN.includes(meta.kind)) return false; } catch {}
                    return true;
                  }).slice(0, 15).map((item) => {
                    if (item.kind === 'swap') {
                      const s = item.data;
                      const isBuy = s.side === 'BUY_ARENA';
                      const amountArena = isBuy ? s.amountOut : s.amountIn;
                      return (
                        <div key={s.id} className="text-[10px] text-slate-300 py-0.5 border-b border-slate-800/30">
                          💱 <span className="font-mono">{s.agent?.name || '?'}</span> {isBuy ? 'bought' : 'sold'}{' '}
                          <span className="font-mono text-slate-200">{Math.round(amountArena)}</span> ARENA
                        </div>
                      );
                    }
                    const e = item.data;
                    return (
                      <div key={e.id} className="text-[10px] text-slate-300 py-0.5 border-b border-slate-800/30">
                        📝 {e.title || e.eventType}
                        <span className="text-slate-600 ml-1">· {timeAgo(e.createdAt)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* [removed: mobile agent panel] */}
            </div>
          </div>
        )}

              {mobilePanel === 'spawn' && (
                <SpawnAgent
                  walletAddress={walletAddress}
                  onConnectWallet={connectWallet}
                  onSpawned={() => { setTimeout(() => setMobilePanel('none'), 2000); }}
                />
              )}
      </div>

      {/* [removed: mobile SwapTicker] */}
    </div>
  );

  /* ────────────── DESKTOP LAYOUT ────────────── */
  return (
    <div className="flex flex-col h-[100svh] w-full overflow-hidden bg-[#050914]">
      {/* In-game onboarding overlay */}
      {showOnboarding && (
        <OnboardingOverlay
          walletAddress={walletAddress}
          onComplete={() => setShowOnboarding(false)}
        />
      )}
      {wheelArenaOverlay}
      {/* Top Bar: Degen Stats */}
      <div className="shrink-0 flex items-center justify-between px-4 py-1.5 bg-slate-950/90 border-b border-slate-800/40 z-50">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-amber-400">AI TOWN</span>
          {economy && Number.isFinite(economy.spotPrice) && (
            <span className="text-[10px] text-slate-500 font-mono">$ARENA {economy.spotPrice.toFixed(4)}</span>
          )}
          {wheel.status?.phase === 'ANNOUNCING' && (
            <span className="text-[10px] bg-purple-900/60 text-purple-300 px-2 py-0.5 rounded-full animate-pulse">🎰 Betting Open</span>
          )}
          {wheel.status?.phase === 'FIGHTING' && (
            <span className="text-[10px] bg-red-900/60 text-red-300 px-2 py-0.5 rounded-full animate-pulse">⚔️ Fight!</span>
          )}
          {wheel.status?.phase === 'AFTERMATH' && (
            <span className="text-[10px] bg-amber-900/60 text-amber-300 px-2 py-0.5 rounded-full">🏆 Result</span>
          )}
        </div>
        <PrivyWalletConnect compact onAddressChange={setWalletAddress} />
        <button
          onClick={() => setShowSpawnOverlay(true)}
          className="px-3 py-1 bg-gradient-to-r from-amber-600/80 to-orange-600/80 text-white text-xs font-bold rounded hover:from-amber-500 hover:to-orange-500 transition-all"
        >
          🤖 Spawn Agent
        </button>
      </div>

      {/* Spawn Agent Overlay */}
      {showSpawnOverlay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-950 border border-slate-700/50 rounded-xl shadow-2xl w-[400px] max-w-[90vw] max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between px-4 pt-3">
              <span className="text-xs text-slate-500">New Agent</span>
              <button onClick={() => setShowSpawnOverlay(false)} className="text-slate-500 hover:text-slate-300 text-lg">✕</button>
            </div>
            <SpawnAgent
              walletAddress={walletAddress}
              onConnectWallet={connectWallet}
              onSpawned={() => { setTimeout(() => setShowSpawnOverlay(false), 2000); }}
            />
          </div>
        </div>
      )}

      {/* Main content: fullscreen 3D */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
      {/* 3D Canvas */}
      <Canvas
        shadows={false}
        dpr={[1, 1.5]}
        camera={{ position: [50, 55, 50], fov: 45, near: 0.1, far: 3000 }}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        onPointerMissed={() => {
          setSelectedPlotId(null);
        }}
      >
        <TownScene
          town={town}
          agents={agents}
          selectedPlotId={selectedPlotId}
          setSelectedPlotId={setSelectedPlotId}
          selectedAgentId={selectedAgentId}
          setSelectedAgentId={setSelectedAgentId}
          introRef={introRef}
          simsRef={simsRef}
          tradeByAgentId={tradeByAgentId}
          weather={weather}
          economicState={economicState}
          coinBursts={coinBursts}
          setCoinBursts={setCoinBursts}
          deathEffects={deathEffects}
          setDeathEffects={setDeathEffects}
          spawnEffects={spawnEffects}
          setSpawnEffects={setSpawnEffects}
          relationshipsRef={relationshipsRef}
          fightingAgentIds={fightingAgentIds}
        />
      </Canvas>

      {/* Swap Notifications - floating toasts (center-top) */}
      <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 z-50">
        {swapNotifications.slice(0, 3).map((notif) => {
          const isBuy = notif.side === 'BUY_ARENA';
          const color = ARCHETYPE_COLORS[notif.archetype] || '#93c5fd';
          const glyph = ARCHETYPE_GLYPH[notif.archetype] || '●';
          return (
            <div
              key={notif.id}
              className="animate-in slide-in-from-top-2 fade-in duration-300 pointer-events-auto"
            >
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur-md shadow-lg ${
                isBuy
                  ? 'bg-emerald-950/80 border-emerald-700/50 text-emerald-200'
                  : 'bg-rose-950/80 border-rose-700/50 text-rose-200'
              }`}>
                <span className="text-sm">{isBuy ? '📈' : '📉'}</span>
                <span style={{ color }} className="font-mono text-xs">
                  {glyph} {notif.agentName}
                </span>
                <span className="text-[10px] opacity-80">
                  {isBuy ? 'bought' : 'sold'}
                </span>
                <span className="font-mono text-xs font-semibold">
                  {Math.round(notif.amount).toLocaleString()}
                </span>
                <span className="text-[10px] opacity-80">$ARENA</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* (world event banner and build completion banners removed) */}

      {/* Overlay UI */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 hud-backplate" />
        <div className="pointer-events-auto absolute left-3 top-3">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-100 hover:bg-slate-900/40 backdrop-blur-md bg-slate-950/70 rounded-lg border border-slate-800/40"
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

        {/* Agent HUD — shows followed agent + switcher strip */}
        <div className="pointer-events-auto absolute right-3 top-3 max-w-[340px]">
          {selectedAgent && (
            <div className="hud-panel p-3">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex h-4 w-4 rounded-full shrink-0"
                  style={{ backgroundColor: ARCHETYPE_COLORS[selectedAgent.archetype] || '#93c5fd' }}
                />
                <div className="min-w-0">
                  <div className="font-mono text-sm font-semibold text-slate-100 truncate">
                    {(ARCHETYPE_GLYPH[selectedAgent.archetype] || '●') + ' ' + selectedAgent.name}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {selectedAgent.archetype}
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-300">
                <div className="rounded-md border border-slate-800 bg-slate-950/40 p-1.5 text-center">
                  <div className="text-slate-500">$ARENA</div>
                  <div className="font-mono text-slate-100">{Math.round(selectedAgent.bankroll)}</div>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-950/40 p-1.5 text-center">
                  <div className="text-slate-500">W/L</div>
                  <div className="font-mono text-slate-100">{selectedAgent.wins}/{selectedAgent.losses}</div>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-950/40 p-1.5 text-center">
                  <div className="text-slate-500">ELO</div>
                  <div className="font-mono text-slate-100">{selectedAgent.elo}</div>
                </div>
              </div>
              {/* Agent thought process */}
              {selectedAgent.lastReasoning && (
                <div className="mt-2 pt-2 border-t border-slate-800/50">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-1">
                    <span>🧠</span>
                    <span className="font-medium uppercase tracking-wide">
                      {(selectedAgent.lastActionType || 'thinking').replace(/_/g, ' ')}
                    </span>
                    {selectedAgent.lastTickAt && (
                      <span className="ml-auto">{timeAgo(selectedAgent.lastTickAt)}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-300 italic leading-relaxed max-h-[80px] overflow-auto scrollbar-thin scrollbar-thumb-slate-700/60">
                    &ldquo;{selectedAgent.lastReasoning.slice(0, 300)}{selectedAgent.lastReasoning.length > 300 ? '…' : ''}&rdquo;
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* (minimap removed) */}

        <div className="pointer-events-auto absolute left-3 bottom-3 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end max-w-[calc(100vw-24px)]">
          <div className="w-[420px] max-w-[calc(100vw-24px)]">
            <div className="hud-panel p-3">
		              {(activityFeed.length > 0 || recentSwaps.length > 0) && (
		                <div>
		                  <div className="flex items-center justify-between mb-2">
                        <div className="text-[11px] font-semibold text-slate-100">Activity</div>
                        <div className="text-[10px] text-slate-500">
                          {recentSwaps.length > 0 ? `swaps ${recentSwaps.length}` : ''}
                        </div>
		                  </div>
		                  <div className="max-h-[170px] overflow-auto pr-1 space-y-1 scrollbar-thin scrollbar-thumb-slate-700/60">
		                    {activityFeed.filter((item) => {
		                      // Filter to current agent only
		                      if (selectedAgentId) {
		                        if (item.kind === 'swap') {
		                          if (item.data.agentId !== selectedAgentId) return false;
		                        } else {
		                          const e = item.data;
		                          if (e.agentId && e.agentId !== selectedAgentId) {
		                            // Also check metadata for matches involving selected agent
		                            try {
		                              const meta = JSON.parse(e.metadata || '{}');
		                              if (meta?.winnerId !== selectedAgentId && meta?.loserId !== selectedAgentId) return false;
		                            } catch { return false; }
		                          }
		                        }
		                      }
		                      if (item.kind === 'swap') return true;
		                      const e = item.data;
		                      if (e.eventType === 'ARENA_MATCH' || e.eventType === 'TRADE') return true;
		                      const HIDDEN = ['PLOT_CLAIMED','BUILD_STARTED','BUILD_COMPLETED','TOWN_COMPLETED','YIELD_DISTRIBUTED','AGENT_CHAT','RELATIONSHIP_CHANGE','TOWN_OBJECTIVE','TOWN_OBJECTIVE_RESOLVED','X402_SKILL'];
		                      if (HIDDEN.includes(e.eventType)) return false;
		                      try {
		                        const meta = JSON.parse(e.metadata || '{}');
		                        if (meta?.kind && HIDDEN.includes(meta.kind)) return false;
		                      } catch {}
		                      return true;
		                    }).map((item) => {
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
		                            className="flex items-center justify-between gap-2 rounded-md border border-slate-800/50 bg-slate-950/30 px-2 py-1 text-[11px] text-slate-300 transition-colors hover:bg-slate-900/30"
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
                              const objectiveType = typeof metaObj?.objectiveType === 'string' ? String(metaObj.objectiveType).toUpperCase() : '';
                              const isObjective = kind === 'TOWN_OBJECTIVE' && participants.length >= 2;
                              const isObjectiveResolved = kind === 'TOWN_OBJECTIVE_RESOLVED' && participants.length >= 2;
                              const resolution = isObjectiveResolved ? String(metaObj?.resolution || '').toUpperCase() : '';

			                        const relTo = isRelChange ? String(metaObj?.to || '').toUpperCase() : '';
			                        const relEmoji = relTo === 'FRIEND' ? '🤝' : relTo === 'RIVAL' ? '💢' : '🧊';

                              const objEmoji = isObjective
                                ? objectiveType === 'RACE_CLAIM'
                                  ? '🏁'
                                  : objectiveType === 'PACT_CLAIM'
                                    ? '🤝'
                                    : '🎯'
                                : '';
                              const objResolvedEmoji = isObjectiveResolved
                                ? resolution === 'FULFILLED'
                                  ? '✅'
                                  : resolution === 'BROKEN'
                                    ? '💔'
                                    : resolution === 'SNIPED'
                                      ? '🪓'
                                      : resolution === 'CLAIMED'
                                        ? '🏆'
                                        : '🎯'
                                : '';

			                        const emoji = isSkill ? '💳' : isChat ? '💬' : isRelChange ? relEmoji : isObjective ? objEmoji : isObjectiveResolved ? objResolvedEmoji :
			                                     e.eventType === 'PLOT_CLAIMED' ? '📍' : 
			                                     e.eventType === 'BUILD_STARTED' ? '🏗️' :
			                                     e.eventType === 'BUILD_COMPLETED' ? '✅' :
			                                     e.eventType === 'TOWN_COMPLETED' ? '🎉' :
			                                     e.eventType === 'YIELD_DISTRIBUTED' ? '💎' :
			                                     e.eventType === 'TRADE' ? '💱' : '📝';
		
			                        const chatSnippet = isChat && typeof lines[0]?.text === 'string' ? lines[0].text.slice(0, 70) : '';
                              const expiresAtMs = isObjective ? Number(metaObj?.expiresAtMs || 0) : Number.NaN;
                              const leftMs = Number.isFinite(expiresAtMs) ? expiresAtMs - Date.now() : 0;
				                        const desc = isSkill
				                          ? (e.description || `bought ${(skillName ?? '').toUpperCase()}`)
				                          : isChat
				                            ? (chatSnippet ? `chatted: "${chatSnippet}${chatSnippet.length >= 70 ? '…' : ''}"` : 'chatted')
				                            : isRelChange
				                              ? (e.title || (relTo === 'FRIEND' ? 'became friends' : relTo === 'RIVAL' ? 'became rivals' : 'changed relationship'))
                                  : isObjective
                                    ? `${safeTrim(e.title || 'Objective', 120)}${leftMs > 0 ? ` · ${formatTimeLeft(leftMs)} left` : ''}`
                                    : isObjectiveResolved
                                      ? (e.title || 'Objective resolved')
				                              : e.eventType === 'PLOT_CLAIMED' ? (e.title || 'claimed a plot')
				                                : e.eventType === 'BUILD_STARTED' ? (e.title || 'started building')
				                                  : e.eventType === 'BUILD_COMPLETED' ? (e.title || 'completed a build')
				                                    : e.eventType === 'TOWN_COMPLETED' ? (e.title || 'Town completed!')
				                                      : e.title || e.description || e.eventType;

				                        const isPairEvent = (isChat || isRelChange || isObjective || isObjectiveResolved) && participants.length >= 2;
				                        const p0 = isPairEvent && participants[0] ? agentById.get(participants[0]) : null;
				                        const p1 = isPairEvent && participants[1] ? agentById.get(participants[1]) : null;
				                        const header = (
				                          <div className="min-w-0 truncate">
				                            <span>{emoji}</span>{' '}
				                            {isPairEvent && p0 && p1 ? (
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
				                        );

				                        if (isChat) {
				                          const chatLines = lines
				                            .map((l) => ({
				                              agentId: typeof l.agentId === 'string' ? l.agentId : '',
				                              text: typeof l.text === 'string' ? l.text : '',
				                            }))
				                            .filter((l) => l.agentId && l.text);

				                          const relationship = metaObj?.relationship;
				                          const relObj =
				                            relationship && typeof relationship === 'object'
				                              ? (relationship as Record<string, unknown>)
				                              : null;
				                          const relStatus = typeof relObj?.status === 'string' ? relObj.status : null;
				                          const relScore = relObj?.score != null ? Number(relObj.score) : null;

				                          return (
				                            <details
				                              key={e.id}
				                              className="rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[11px] text-slate-300"
				                            >
				                              <summary className="cursor-pointer select-none flex items-center justify-between gap-2">
				                                {header}
				                                <span className="shrink-0 text-slate-600">· {timeAgo(e.createdAt)}</span>
				                              </summary>
				                              <div className="mt-1 space-y-1">
				                                {chatLines.map((l, idx) => {
				                                  const a = agentById.get(l.agentId);
				                                  const glyph = a ? (ARCHETYPE_GLYPH[a.archetype] || '●') : '●';
				                                  const color = a ? (ARCHETYPE_COLORS[a.archetype] || '#93c5fd') : '#93c5fd';
				                                  const name = a?.name || l.agentId.slice(0, 6);
				                                  return (
				                                    <div key={idx} className="font-mono text-[10px]">
				                                      <span style={{ color }}>
				                                        {glyph} {name}:
				                                      </span>{' '}
				                                      <span className="text-slate-300">"{l.text}"</span>
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

                              if (isObjective || isObjectiveResolved) {
                                const extra =
                                  isObjective && leftMs > 0
                                    ? `expires in ${formatTimeLeft(leftMs)}`
                                    : null;

                                return (
                                  <details
                                    key={e.id}
                                    className="rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[11px] text-slate-300"
                                  >
                                    <summary className="cursor-pointer select-none flex items-center justify-between gap-2">
                                      {header}
                                      <span className="shrink-0 text-slate-600">· {timeAgo(e.createdAt)}</span>
                                    </summary>
                                    <div className="mt-1 space-y-1 text-[10px] text-slate-400">
                                      {e.description && <div className="whitespace-pre-wrap">{safeTrim(e.description, 420)}</div>}
                                      {extra && <div className="text-slate-500">{extra}</div>}
                                    </div>
                                  </details>
                                );
                              }

				                        // Extract reasoning from metadata — only for selected agent
				                        const isMyEvent = e.agentId === selectedAgentId;
				                        const reasoning = (isMyEvent && typeof metaObj?.reasoning === 'string')
				                          ? String(metaObj.reasoning).replace(/\[AUTO\]\s*/g, '').trim()
				                          : '';

				                        return (
				                          <div
				                            key={e.id}
				                            className="rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[11px] text-slate-300"
				                          >
				                            <div className="flex items-center justify-between gap-2">
				                              {header}
				                              <span className="shrink-0 text-slate-600">· {timeAgo(e.createdAt)}</span>
				                            </div>
				                            {reasoning && (
				                              <div className="mt-0.5 text-[10px] text-slate-500 leading-snug truncate">
				                                💭 {reasoning.length > 100 ? reasoning.slice(0, 100) + '…' : reasoning}
				                              </div>
				                            )}
				                          </div>
				                        );
			                      }
			                    })}
		                  </div>
		                </div>
		              )}

              {/* Agent Thoughts — latest decisions from all agents */}
              {latestThoughts.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-800/40">
                  <div className="text-[11px] font-semibold text-slate-100 mb-2">🧠 Agent Thoughts</div>
                  <div className="max-h-[200px] overflow-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700/60">
                    {latestThoughts.slice(0, 12).map((t) => {
                      const color = ARCHETYPE_COLORS[t.archetype] || '#93c5fd';
                      const glyph = ARCHETYPE_GLYPH[t.archetype] || '●';
                      const actionEmoji: Record<string, string> = {
                        buy_arena: '💰', sell_arena: '📤', claim_plot: '📍',
                        start_build: '🏗️', do_work: '🔨', complete_build: '✅',
                        mine: '⛏️', play_arena: '🎮', buy_skill: '💳',
                        rest: '😴', transfer_arena: '💸',
                      };
                      return (
                        <details
                          key={t.agentId + ':' + t.tickAt}
                          className="rounded-md border border-slate-800/60 bg-slate-950/30 px-2 py-1 text-[11px] text-slate-300"
                        >
                          <summary className="cursor-pointer select-none flex items-center justify-between gap-2">
                            <div className="min-w-0 truncate">
                              <span>{actionEmoji[t.actionType] || '🤔'}</span>{' '}
                              <span className="font-mono" style={{ color }}>
                                {glyph} {t.agentName}
                              </span>{' '}
                              <span className="text-slate-400">{t.actionType.replace(/_/g, ' ')}</span>
                            </div>
                            <span className="shrink-0 text-slate-600">· {timeAgo(t.tickAt)}</span>
                          </summary>
                          <div className="mt-1 text-[10px] text-slate-400 italic leading-relaxed whitespace-pre-wrap">
                            &ldquo;{t.reasoning.slice(0, 400)}{t.reasoning.length > 400 ? '…' : ''}&rdquo;
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Wheel of Fate Banner (centered floating overlay) */}
        {wheel.status && wheel.status.phase !== 'IDLE' && wheel.status.phase !== 'PREP' && (
          <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-3">
            <WheelBanner
              status={wheel.status}
              odds={wheel.odds}
              walletAddress={walletAddress}
              onBet={wheel.placeBet}
              loading={wheel.loading}
            />
          </div>
        )}

	      </div>
      </div>
    </div>
	  );
	}
