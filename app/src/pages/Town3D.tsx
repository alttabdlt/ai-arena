import { lazy, Suspense, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type RootState } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Button } from '@ui/button';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { playSound, isSoundEnabled, setSoundEnabled } from '../utils/sounds';
import { HAS_PRIVY } from '../config/privy';
import type { WalletSessionState } from '../components/PrivyWalletConnect';

import { useWheelStatus } from '../hooks/useWheelStatus';

import { BuildingMesh, preloadBuildingModels } from '../components/buildings';
import { AgentDroid } from '../components/agents/AgentDroid';
import {
  isOnboarded,
  getMyAgentId,
  getMyWallet,
  MY_AGENT_KEY,
  MY_WALLET_KEY,
  ONBOARDED_KEY,
  DEGEN_TOUR_KEY,
} from '../components/onboarding/storage';
import { buildRoadGraph, findPath, type RoadGraph, type RoadSegInput } from '../world/roadGraph';
import { WorldScene } from '../world/WorldScene';
import { StreetLights } from '../world/StreetLight';
import { generateLightPositions } from '../world/streetLightUtils';
import { updateFollowCamera } from '../world/sim/cameraController';
import { enforceBuildingExclusion, resolveAgentSeparation, stepAgentAlongRoute } from '../world/sim/updateMotion';
import {
  DEFAULT_VISUAL_SETTINGS,
  detectQualityFromFps,
  loadVisualSettings,
  nextVisualQuality,
  resolveVisualQuality,
  saveVisualSettings,
  type ResolvedVisualQuality,
  type VisualProfile,
  type VisualSettings,
  VISUAL_PROFILES,
} from '../world/visual/townVisualTuning';

const API_BASE = '/api/v1';
const TOWN_SPACING = 20;
const ARENA_SPECTATOR_TARGET_ID = '__ARENA_SPECTATOR__';
const ARENA_PAYOFF_POPUP_LIFE_MS = 6500;
const ARENA_BEAT_LIFE_MS = 5200;
const ARENA_OUTCOME_TOAST_LIFE_MS = 3400;
const ARENA_MOMENTUM_TOAST_LIFE_MS = 3800;
const ARENA_IMPACT_FLASH_LIFE_MS = 520;
const ARENA_CAMERA_CINE_LIFE_MS = 1800;
const ARENA_CAMERA_CINE_WINDUP_MS = 240;
const ARENA_CAMERA_CINE_IMPACT_MS = 170;
const ARENA_STRIKE_WINDUP_MS = 170;
const ARENA_STRIKE_IMPACT_MS = 130;
const ARENA_STRIKE_RECOVER_MS = 280;
const ARENA_STRIKE_LIFE_MS = ARENA_STRIKE_WINDUP_MS + ARENA_STRIKE_IMPACT_MS + ARENA_STRIKE_RECOVER_MS;
const ARENA_STRIKE_COOLDOWN_MIN_MS = 420;
const ARENA_STRIKE_COOLDOWN_MAX_MS = 760;
const ARENA_IMPACT_BURST_LIFE_MS = 620;
const ARENA_IMPACT_BURST_CAP = 28;
const ACTION_BURST_LIFE_MS = 1280;
const CREW_BATTLE_TOAST_LIFE_MS = 5200;
const UI_MODE_KEY = 'ai_arena_ui_mode';
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const MISSION_TOUR_STEPS = [
  {
    title: 'Core Loop',
    body: 'Run BUILD -> WORK -> FIGHT -> TRADE in sequence. The HUD always shows your next mission.',
  },
  {
    title: 'Mission Contract',
    body: 'Read DO / WHY / IF BLOCKED / SUCCESS. If blocked, the loop auto-redirects and explains the reason.',
  },
  {
    title: 'Controls',
    body: 'AUTO ON keeps cycling. Manual buttons force one phase when you want tighter control.',
  },
  {
    title: 'Optional Telegram',
    body: 'Telegram is optional. The in-game HUD can operate the full loop without it.',
  },
] as const;
const LazyPrivyWalletConnect = lazy(async () => {
  const mod = await import('../components/PrivyWalletConnect');
  return { default: mod.PrivyWalletConnect };
});
const LazySpawnAgent = lazy(async () => {
  const mod = await import('../components/SpawnAgent');
  return { default: mod.SpawnAgent };
});
const LazyWheelBanner = lazy(async () => {
  const mod = await import('../components/wheel/WheelBanner');
  return { default: mod.WheelBanner };
});
const LazyWheelArena = lazy(async () => {
  const mod = await import('../components/wheel/WheelArena');
  return { default: mod.WheelArena };
});
const LazyOnboardingOverlay = lazy(async () => {
  const mod = await import('../components/onboarding/OnboardingOverlay');
  return { default: mod.OnboardingOverlay };
});
const LazyWorldFxLayer = lazy(async () => {
  const mod = await import('../world/visual/WorldFxLayer');
  return { default: mod.WorldFxLayer };
});
const LazyDesktopActivityPanel = lazy(async () => {
  const mod = await import('../components/town/DesktopActivityPanel');
  return { default: mod.DesktopActivityPanel };
});
const LazyDesktopAgentHudPanel = lazy(async () => {
  const mod = await import('../components/town/DesktopAgentHudPanel');
  return { default: mod.DesktopAgentHudPanel };
});
const LazyDegenControlBar = lazy(async () => {
  const mod = await import('../components/town/DegenControlBar');
  return { default: mod.DegenControlBar };
});
const LazyReadableRuntimeHud = lazy(async () => {
  const mod = await import('../components/game/ReadableRuntimeHud');
  return { default: mod.ReadableRuntimeHud };
});

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
};

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
  walletAddress?: string | null;
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

interface AgentOutcomeEntry {
  id: string;
  actionType: string;
  reasoning: string;
  bankrollDelta: number;
  reserveDelta: number;
  at: string;
}

interface AgentBalanceSnapshot {
  bankroll: number;
  reserveBalance: number;
  lastTickAt: string | null;
  lastActionType: string | null;
}

type ArenaOutcomeSignal = {
  result: 'WIN' | 'LOSS' | 'DRAW';
  delta: number;
  at: string;
};

type ArenaImpactBurst = {
  id: string;
  position: [number, number, number];
  createdAt: number;
  intensity: number;
  tone: 'ROSE' | 'CYAN';
};

type ActionBurstKind = 'CLAIM' | 'BUILD' | 'WORK' | 'TRADE' | 'FIGHT' | 'MINE' | 'IDLE' | 'OTHER';
type DegenLoopPhase = 'BUILD' | 'WORK' | 'FIGHT' | 'TRADE';
type DegenNudge = 'build' | 'work' | 'fight' | 'trade';

type ActionBurst = {
  id: string;
  agentId: string;
  position: [number, number, number];
  actionType: string;
  kind: ActionBurstKind;
  polarity: -1 | 0 | 1;
  label: string;
  intensity: number;
  createdAt: number;
  isOwned: boolean;
};

type DegenLoopTelemetry = {
  nextIndex: number;
  chain: number;
  loopsCompleted: number;
  lastPhase: DegenLoopPhase | null;
  lastAdvanceAt: number | null;
};

type DegenActionPlan = {
  ok: boolean;
  reasonCode?: string;
  reason?: string;
  intent?: string;
  note?: string;
};

type DegenMission = {
  phase: DegenLoopPhase;
  recommendedAction: DegenNudge;
  reason: string;
  successOutcome: string;
};

type DegenBlocker = {
  code: string;
  message: string;
  phase: DegenLoopPhase;
  action: DegenNudge;
  fallbackAction: DegenNudge | null;
};

type DegenLoopStatePayload = {
  phaseIndex: number;
  phaseName: DegenLoopPhase;
  loopsCompleted: number;
  collapseTier?: 'STABLE' | 'STRAINED' | 'COLLAPSED';
  recoveryTier?: 'NONE' | 'CAUTION' | 'CRITICAL';
};

type DegenRecovery = {
  tier: 'NONE' | 'CAUTION' | 'CRITICAL';
  message: string;
  chain: DegenNudge[];
  nextBest: DegenNudge | null;
};

type DegenPlanResponse = {
  agentId: string;
  mode: LoopMode;
  authRequiredForActions?: boolean;
  loopState?: DegenLoopStatePayload;
  mission?: DegenMission;
  blocker?: DegenBlocker | null;
  recovery?: DegenRecovery | null;
  plans: Record<DegenNudge, DegenActionPlan>;
};

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

interface AgentMeLookupResponse {
  agent?: {
    id?: string;
    walletAddress?: string | null;
  };
}

interface RuntimeAgentCard {
  agentId: string;
  name: string;
  archetype: string;
  crewName: string | null;
  state: string;
  action: string;
  reason: string;
  targetLabel: string;
  etaSec: number | null;
  blockedCode: string | null;
  lastOutcome: string;
}

interface RuntimeCrewCard {
  crewId: string;
  name: string;
  colorHex: string;
  objective: string;
  activeOperation: string;
  impactSummary: string;
  activeMembers: Array<{ name: string; action: string; state: string }>;
}

interface RuntimeBuildingCard {
  plotId: string;
  plotIndex: number;
  zone: string;
  status: string;
  buildingName: string | null;
  task: string;
  progressPct: number;
  etaSec: number;
  occupants: Array<{ name: string; role: string }>;
}

interface RuntimeFeedCard {
  id: string;
  line: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | string;
}

type ActivityItem =
  | { kind: 'swap'; data: EconomySwapRow }
  | { kind: 'event'; data: TownEvent };

interface ActiveWorldEvent {
  emoji: string;
  name: string;
  description: string;
  type: string;
}

type UrgencyKind = 'ARENA' | 'TRADE' | 'MINE' | 'BUILD' | 'ENTERTAIN' | 'STABILIZE';

interface UrgencyObjective {
  kind: UrgencyKind;
  label: string;
  emoji: string;
  color: string;
  targetZones: PlotZone[];
  sourceType: string | null;
}

interface OpportunityWindow {
  id: string;
  kind: UrgencyKind;
  label: string;
  subtitle: string;
  createdAt: number;
  endsAt: number;
  objective: UrgencyObjective;
  rewardBoost: number;
  penaltyDrag: number;
}

interface CrewStanding {
  id: string;
  slug: string;
  name: string;
  colorHex: string;
  territoryControl: number;
  treasuryArena: number;
  momentum: number;
  warScore: number;
  memberCount: number;
}

interface CrewAgentLink {
  crewId: string;
  crewName: string;
  colorHex: string;
  role: string;
}

interface CrewWarsStatusPayload {
  crews: CrewStanding[];
  agentCrewById: Record<string, CrewAgentLink>;
  recentBattles: Array<{
    id: string;
    tick: number;
    winnerCrewName: string;
    loserCrewName: string;
    territorySwing: number;
    treasurySwing: number;
    createdAt: string;
  }>;
  epochTicks: number;
  campaign?: {
    currentTick: number;
    nextEpochTick: number;
    ticksUntilEpoch: number;
    leadingCrewId: string | null;
    leadingCrewName: string | null;
    trailingCrewId: string | null;
    trailingCrewName: string | null;
    objective: string;
    counterplayWindowTicks: number;
  };
}

type LoopMode = 'DEFAULT' | 'DEGEN_LOOP';
type CrewOrderStrategy = 'RAID' | 'DEFEND' | 'FARM' | 'TRADE';
type UiMode = 'default' | 'pro';

type CrewBattleToast = {
  id: string;
  winnerCrewName: string;
  loserCrewName: string;
  territorySwing: number;
  treasurySwing: number;
  createdAt: number;
};

const URGENCY_VISUALS: Record<UrgencyKind, { emoji: string; color: string }> = {
  ARENA: { emoji: '⚔️', color: '#fb7185' },
  TRADE: { emoji: '📈', color: '#38bdf8' },
  MINE: { emoji: '⛏️', color: '#f97316' },
  BUILD: { emoji: '🏗️', color: '#fbbf24' },
  ENTERTAIN: { emoji: '🎰', color: '#f472b6' },
  STABILIZE: { emoji: '🛡️', color: '#a3e635' },
};

function makeUrgencyObjective(
  kind: UrgencyKind,
  label: string,
  targetZones: PlotZone[],
  sourceType: string | null = null,
): UrgencyObjective {
  const visuals = URGENCY_VISUALS[kind];
  return {
    kind,
    label,
    emoji: visuals.emoji,
    color: visuals.color,
    targetZones,
    sourceType,
  };
}

function deriveUrgencyObjective(
  worldEvents: ActiveWorldEvent[],
  wheelPhase: string | undefined,
  weather: 'clear' | 'rain' | 'storm',
  sentiment: 'bull' | 'bear' | 'neutral',
): UrgencyObjective | null {
  if (wheelPhase === 'ANNOUNCING' || wheelPhase === 'FIGHTING') {
    return makeUrgencyObjective('ARENA', 'Arena Heat', ['ENTERTAINMENT'], 'WHEEL_ARENA');
  }

  const primary = worldEvents[0];
  const sourceType = primary?.type || null;
  const blob = `${primary?.type || ''} ${primary?.name || ''} ${primary?.description || ''}`.toUpperCase();

  if (/\b(MINE|ORE|RIG|RESOURCE|HASH|EXTRACT)\b/.test(blob)) {
    return makeUrgencyObjective('MINE', 'Resource Rush', ['INDUSTRIAL'], sourceType);
  }
  if (/\b(BUILD|CLAIM|CONSTRUCT|DEVELOP|UPGRADE|EXPAND)\b/.test(blob)) {
    return makeUrgencyObjective('BUILD', 'Build Race', ['RESIDENTIAL', 'COMMERCIAL', 'CIVIC', 'INDUSTRIAL', 'ENTERTAINMENT'], sourceType);
  }
  if (/\b(TRADE|MARKET|VOLUME|PUMP|DUMP|LIQUIDITY|ARBITRAGE)\b/.test(blob)) {
    return makeUrgencyObjective('TRADE', 'Liquidity Hunt', ['COMMERCIAL'], sourceType);
  }
  if (/\b(ARENA|DUEL|MATCH|TOURNAMENT|SHOWDOWN)\b/.test(blob)) {
    return makeUrgencyObjective('ARENA', 'Arena Heat', ['ENTERTAINMENT'], sourceType);
  }
  if (/\b(CASINO|FEST|PARTY|ENTERTAIN|NIGHT)\b/.test(blob)) {
    return makeUrgencyObjective('ENTERTAIN', 'High-Risk Night', ['ENTERTAINMENT'], sourceType);
  }
  if (weather === 'storm' || sentiment === 'bear') {
    return makeUrgencyObjective('STABILIZE', 'Risk-Off Rotation', ['CIVIC', 'RESIDENTIAL'], sourceType);
  }
  if (sentiment === 'bull') {
    return makeUrgencyObjective('TRADE', 'Momentum Rotation', ['COMMERCIAL'], sourceType);
  }
  return null;
}

const OPPORTUNITY_CONFIG: Record<
  UrgencyKind,
  {
    label: string;
    subtitle: string;
    durationRangeMs: [number, number];
    rewardBoost: number;
    penaltyDrag: number;
  }
> = {
  ARENA: {
    label: 'Arena Surge',
    subtitle: 'Crowd and contenders rotate to entertainment plots.',
    durationRangeMs: [45_000, 72_000],
    rewardBoost: 1.22,
    penaltyDrag: 0.84,
  },
  TRADE: {
    label: 'Liquidity Window',
    subtitle: 'Commercial zones pay off for fast actors.',
    durationRangeMs: [42_000, 70_000],
    rewardBoost: 1.2,
    penaltyDrag: 0.86,
  },
  MINE: {
    label: 'Resource Spike',
    subtitle: 'Industrial hotspots accelerate payoff loops.',
    durationRangeMs: [50_000, 78_000],
    rewardBoost: 1.24,
    penaltyDrag: 0.85,
  },
  BUILD: {
    label: 'Construction Bounty',
    subtitle: 'Under-construction plots become high-priority.',
    durationRangeMs: [48_000, 74_000],
    rewardBoost: 1.21,
    penaltyDrag: 0.86,
  },
  ENTERTAIN: {
    label: 'High-Risk Session',
    subtitle: 'Entertainment districts magnetize activity.',
    durationRangeMs: [44_000, 70_000],
    rewardBoost: 1.23,
    penaltyDrag: 0.84,
  },
  STABILIZE: {
    label: 'Risk-Off Rotation',
    subtitle: 'Civic and residential zones absorb pressure.',
    durationRangeMs: [46_000, 72_000],
    rewardBoost: 1.18,
    penaltyDrag: 0.87,
  },
};

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function getArenaCineEnvelope(ageMs: number) {
  if (ageMs < 0 || ageMs > ARENA_CAMERA_CINE_LIFE_MS) {
    return { windup: 0, impact: 0, recover: 0 };
  }
  if (ageMs <= ARENA_CAMERA_CINE_WINDUP_MS) {
    return {
      windup: THREE.MathUtils.clamp(ageMs / ARENA_CAMERA_CINE_WINDUP_MS, 0, 1),
      impact: 0,
      recover: 0,
    };
  }
  const impactAge = ageMs - ARENA_CAMERA_CINE_WINDUP_MS;
  if (impactAge <= ARENA_CAMERA_CINE_IMPACT_MS) {
    return {
      windup: THREE.MathUtils.clamp(1 - (impactAge / ARENA_CAMERA_CINE_IMPACT_MS), 0, 1),
      impact: THREE.MathUtils.clamp(impactAge / ARENA_CAMERA_CINE_IMPACT_MS, 0, 1),
      recover: 0,
    };
  }
  const recoverMs = Math.max(1, ARENA_CAMERA_CINE_LIFE_MS - ARENA_CAMERA_CINE_WINDUP_MS - ARENA_CAMERA_CINE_IMPACT_MS);
  const recoverAge = impactAge - ARENA_CAMERA_CINE_IMPACT_MS;
  return {
    windup: 0,
    impact: THREE.MathUtils.clamp(1 - (recoverAge / recoverMs), 0, 1),
    recover: THREE.MathUtils.clamp(recoverAge / recoverMs, 0, 1),
  };
}

function getArenaStrikeEnvelope(ageMs: number) {
  if (ageMs < 0 || ageMs > ARENA_STRIKE_LIFE_MS) {
    return { windup: 0, impact: 0, recover: 0 };
  }
  if (ageMs <= ARENA_STRIKE_WINDUP_MS) {
    return {
      windup: THREE.MathUtils.clamp(ageMs / ARENA_STRIKE_WINDUP_MS, 0, 1),
      impact: 0,
      recover: 0,
    };
  }
  const impactAge = ageMs - ARENA_STRIKE_WINDUP_MS;
  if (impactAge <= ARENA_STRIKE_IMPACT_MS) {
    return {
      windup: THREE.MathUtils.clamp(1 - (impactAge / ARENA_STRIKE_IMPACT_MS), 0, 1),
      impact: THREE.MathUtils.clamp(impactAge / ARENA_STRIKE_IMPACT_MS, 0, 1),
      recover: 0,
    };
  }
  const recoverAge = impactAge - ARENA_STRIKE_IMPACT_MS;
  return {
    windup: 0,
    impact: THREE.MathUtils.clamp(1 - (recoverAge / ARENA_STRIKE_RECOVER_MS), 0, 1),
    recover: THREE.MathUtils.clamp(recoverAge / ARENA_STRIKE_RECOVER_MS, 0, 1),
  };
}

function summarizeArenaMomentum(entries: AgentOutcomeEntry[]) {
  const duelEntries = entries.filter((entry) => entry.actionType === 'play_arena' && entry.bankrollDelta !== 0);
  if (duelEntries.length === 0) {
    return { streak: 0, direction: 0 as -1 | 0 | 1 };
  }
  const direction = Math.sign(duelEntries[0].bankrollDelta) as -1 | 1;
  let streak = 0;
  for (const entry of duelEntries) {
    const sign = Math.sign(entry.bankrollDelta);
    if (sign !== direction) break;
    streak += 1;
    if (streak >= 6) break;
  }
  return { streak, direction };
}

const DEGEN_LOOP_SEQUENCE: DegenLoopPhase[] = ['BUILD', 'WORK', 'FIGHT', 'TRADE'];
const DEGEN_PHASE_TO_NUDGE: Record<DegenLoopPhase, DegenNudge> = {
  BUILD: 'build',
  WORK: 'work',
  FIGHT: 'fight',
  TRADE: 'trade',
};
const DEGEN_NUDGE_LABEL: Record<DegenNudge, string> = {
  build: 'BUILD',
  work: 'WORK',
  fight: 'FIGHT',
  trade: 'TRADE',
};
const EMPTY_DEGEN_LOOP_TELEMETRY: DegenLoopTelemetry = {
  nextIndex: 0,
  chain: 0,
  loopsCompleted: 0,
  lastPhase: null,
  lastAdvanceAt: null,
};

type DegenLoopStepResult = {
  telemetry: DegenLoopTelemetry;
  advanced: boolean;
  completedLoop: boolean;
};

function resolveActionBurstKind(actionType: string): ActionBurstKind {
  const normalized = String(actionType || '').trim().toLowerCase();
  if (normalized.includes('claim')) return 'CLAIM';
  if (normalized.includes('build')) return 'BUILD';
  if (normalized.includes('work') || normalized.includes('complete')) return 'WORK';
  if (normalized.includes('trade') || normalized.startsWith('buy_') || normalized.startsWith('sell_')) return 'TRADE';
  if (normalized.includes('fight') || normalized.includes('arena') || normalized === 'play_arena') return 'FIGHT';
  if (normalized.includes('mine')) return 'MINE';
  if (normalized === 'rest' || normalized === 'idle') return 'IDLE';
  return 'OTHER';
}

function resolveDegenLoopPhase(actionType: string): DegenLoopPhase | null {
  const kind = resolveActionBurstKind(actionType);
  if (kind === 'CLAIM' || kind === 'BUILD') return 'BUILD';
  if (kind === 'WORK' || kind === 'MINE') return 'WORK';
  if (kind === 'FIGHT') return 'FIGHT';
  if (kind === 'TRADE') return 'TRADE';
  return null;
}

function advanceDegenLoopTelemetry(
  current: DegenLoopTelemetry,
  phase: DegenLoopPhase,
  observedAtMs: number,
): DegenLoopStepResult {
  const expected = DEGEN_LOOP_SEQUENCE[current.nextIndex] ?? DEGEN_LOOP_SEQUENCE[0];

  // Wrong phase resets the chain unless agent immediately re-enters at BUILD.
  if (phase !== expected) {
    if (phase === 'BUILD') {
      return {
        telemetry: {
          nextIndex: 1,
          chain: 1,
          loopsCompleted: current.loopsCompleted,
          lastPhase: phase,
          lastAdvanceAt: observedAtMs,
        },
        advanced: true,
        completedLoop: false,
      };
    }
    return {
      telemetry: {
        nextIndex: 0,
        chain: 0,
        loopsCompleted: current.loopsCompleted,
        lastPhase: current.lastPhase,
        lastAdvanceAt: current.lastAdvanceAt,
      },
      advanced: false,
      completedLoop: false,
    };
  }

  const nextIndexRaw = current.nextIndex + 1;
  const completedLoop = nextIndexRaw >= DEGEN_LOOP_SEQUENCE.length;
  return {
    telemetry: {
      nextIndex: completedLoop ? 0 : nextIndexRaw,
      chain: current.chain + 1,
      loopsCompleted: current.loopsCompleted + (completedLoop ? 1 : 0),
      lastPhase: phase,
      lastAdvanceAt: observedAtMs,
    },
    advanced: true,
    completedLoop,
  };
}

function actionBurstVisual(kind: ActionBurstKind, polarity: -1 | 0 | 1) {
  switch (kind) {
    case 'CLAIM':
      return { emoji: '📍', color: '#facc15', accent: '#fde047' };
    case 'BUILD':
      return { emoji: '🏗️', color: '#fb923c', accent: '#fdba74' };
    case 'WORK':
      return { emoji: '🔨', color: '#f97316', accent: '#fdba74' };
    case 'TRADE':
      return {
        emoji: polarity < 0 ? '📉' : '📈',
        color: polarity < 0 ? '#fb7185' : '#22d3ee',
        accent: polarity < 0 ? '#fda4af' : '#67e8f9',
      };
    case 'FIGHT':
      return {
        emoji: polarity < 0 ? '💥' : '⚔️',
        color: polarity < 0 ? '#ef4444' : '#fb7185',
        accent: polarity < 0 ? '#fca5a5' : '#fda4af',
      };
    case 'MINE':
      return { emoji: '⛏️', color: '#a78bfa', accent: '#c4b5fd' };
    case 'IDLE':
      return { emoji: '💤', color: '#64748b', accent: '#94a3b8' };
    default:
      return { emoji: '✨', color: '#38bdf8', accent: '#7dd3fc' };
  }
}

function buildActionBurstLabel(
  kind: ActionBurstKind,
  bankrollDelta: number,
  reserveDelta: number,
  loopSuffix?: string | null,
): string {
  const kindLabel: Record<ActionBurstKind, string> = {
    CLAIM: 'CLAIM',
    BUILD: 'BUILD',
    WORK: 'WORK',
    TRADE: 'TRADE',
    FIGHT: 'FIGHT',
    MINE: 'MINE',
    IDLE: 'IDLE',
    OTHER: 'ACTION',
  };
  const arena = Math.round(bankrollDelta);
  const reserve = Math.round(reserveDelta);
  const parts = [kindLabel[kind] || 'ACTION'];
  if (arena !== 0) parts.push(`${arena > 0 ? '+' : ''}${arena}A`);
  if (reserve !== 0) parts.push(`${reserve > 0 ? '+' : ''}${reserve}R`);
  if (arena === 0 && reserve === 0) parts.push('EVEN');
  if (loopSuffix) parts.push(loopSuffix);
  return parts.join(' ');
}

function buildOwnedLoopSuffix(stepResult: DegenLoopStepResult | null): string | null {
  if (!stepResult || !stepResult.advanced) return null;
  if (stepResult.completedLoop) {
    return `LOOP x${Math.max(1, stepResult.telemetry.loopsCompleted)}`;
  }
  const completedSteps = Math.max(1, Math.min(DEGEN_LOOP_SEQUENCE.length, stepResult.telemetry.nextIndex));
  return `S${completedSteps}/${DEGEN_LOOP_SEQUENCE.length}`;
}

function resolveDegenLoopVisual(phase: DegenLoopPhase | null) {
  switch (phase) {
    case 'BUILD':
      return { color: '#f59e0b', accent: '#fbbf24' };
    case 'WORK':
      return { color: '#06b6d4', accent: '#67e8f9' };
    case 'FIGHT':
      return { color: '#f43f5e', accent: '#fecdd3' };
    case 'TRADE':
      return { color: '#10b981', accent: '#6ee7b7' };
    default:
      return { color: '#64748b', accent: '#cbd5e1' };
  }
}

type TrailVisual = {
  lineColor: string;
  beadColor: string;
  lineOpacity: number;
  beadOpacity: number;
  lineWidth: number;
  dash: boolean;
  pulse: number;
  beadSize: number;
};

function resolveTrailVisual(actionType: string | null | undefined, fallbackColor: string): TrailVisual {
  const normalized = String(actionType || '').trim().toLowerCase();
  const kind = resolveActionBurstKind(normalized);
  if (kind === 'FIGHT') {
    return {
      lineColor: '#fb7185',
      beadColor: '#fecdd3',
      lineOpacity: 0.42,
      beadOpacity: 0.5,
      lineWidth: 3.2,
      dash: false,
      pulse: 1.35,
      beadSize: 0.11,
    };
  }
  if (kind === 'TRADE') {
    const isSell = normalized.startsWith('sell_') || normalized.includes('sell');
    return {
      lineColor: isSell ? '#fb7185' : '#22d3ee',
      beadColor: isSell ? '#fda4af' : '#a5f3fc',
      lineOpacity: 0.38,
      beadOpacity: 0.44,
      lineWidth: 2.85,
      dash: true,
      pulse: 1.25,
      beadSize: 0.098,
    };
  }
  if (kind === 'BUILD' || kind === 'WORK') {
    return {
      lineColor: '#fb923c',
      beadColor: '#fed7aa',
      lineOpacity: 0.34,
      beadOpacity: 0.38,
      lineWidth: 2.65,
      dash: false,
      pulse: 1.08,
      beadSize: 0.092,
    };
  }
  if (kind === 'CLAIM') {
    return {
      lineColor: '#facc15',
      beadColor: '#fef08a',
      lineOpacity: 0.32,
      beadOpacity: 0.34,
      lineWidth: 2.55,
      dash: true,
      pulse: 0.96,
      beadSize: 0.086,
    };
  }
  if (kind === 'MINE') {
    return {
      lineColor: '#a78bfa',
      beadColor: '#ddd6fe',
      lineOpacity: 0.33,
      beadOpacity: 0.36,
      lineWidth: 2.6,
      dash: false,
      pulse: 1.02,
      beadSize: 0.09,
    };
  }
  if (kind === 'IDLE') {
    return {
      lineColor: '#64748b',
      beadColor: '#94a3b8',
      lineOpacity: 0.18,
      beadOpacity: 0.2,
      lineWidth: 2.0,
      dash: true,
      pulse: 0.7,
      beadSize: 0.076,
    };
  }
  return {
    lineColor: fallbackColor,
    beadColor: '#bfdbfe',
    lineOpacity: 0.26,
    beadOpacity: 0.28,
    lineWidth: 2.3,
    dash: false,
    pulse: 0.85,
    beadSize: 0.082,
  };
}

function fallbackObjective(
  weather: 'clear' | 'rain' | 'storm',
  sentiment: 'bull' | 'bear' | 'neutral',
): UrgencyObjective {
  if (weather === 'storm') return makeUrgencyObjective('STABILIZE', 'Storm Hedging', ['CIVIC', 'RESIDENTIAL'], 'WEATHER');
  if (sentiment === 'bull') return makeUrgencyObjective('TRADE', 'Momentum Rotation', ['COMMERCIAL'], 'SENTIMENT');
  if (sentiment === 'bear') return makeUrgencyObjective('MINE', 'Defensive Yield', ['INDUSTRIAL'], 'SENTIMENT');
  const roll = Math.random();
  if (roll < 0.33) return makeUrgencyObjective('BUILD', 'Build Race', ['RESIDENTIAL', 'COMMERCIAL', 'CIVIC', 'INDUSTRIAL', 'ENTERTAINMENT'], 'SYSTEM');
  if (roll < 0.66) return makeUrgencyObjective('TRADE', 'Liquidity Hunt', ['COMMERCIAL'], 'SYSTEM');
  return makeUrgencyObjective('MINE', 'Resource Rush', ['INDUSTRIAL'], 'SYSTEM');
}

function createOpportunityWindow(
  nowMs: number,
  baseObjective: UrgencyObjective | null,
  weather: 'clear' | 'rain' | 'storm',
  sentiment: 'bull' | 'bear' | 'neutral',
): OpportunityWindow {
  const objective = baseObjective ?? fallbackObjective(weather, sentiment);
  const cfg = OPPORTUNITY_CONFIG[objective.kind];
  const durationMs = randomRange(cfg.durationRangeMs[0], cfg.durationRangeMs[1]);
  return {
    id: `${objective.kind}:${nowMs}:${Math.round(Math.random() * 1000)}`,
    kind: objective.kind,
    label: cfg.label,
    subtitle: cfg.subtitle,
    createdAt: nowMs,
    endsAt: nowMs + durationMs,
    objective,
    rewardBoost: cfg.rewardBoost,
    penaltyDrag: cfg.penaltyDrag,
  };
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error (${res.status}): ${res.statusText}`);
  return res.json() as Promise<T>;
}

function normalizeWalletAddress(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
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

function dampAngle(current: number, target: number, smoothness: number, dt: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  const blend = 1 - Math.exp(-smoothness * dt);
  return current + delta * blend;
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
  CLAIMING: { emoji: '📍', color: '#facc15' },
  BUILDING: { emoji: '🔨', color: '#fbbf24' },
  WORKING: { emoji: '🧱', color: '#fb923c' },
  MINING: { emoji: '⛏️', color: '#f97316' },
  TRADING: { emoji: '💱', color: '#22d3ee' },
  PLAYING: { emoji: '🎮', color: '#a855f7' },
  FIGHTING: { emoji: '⚔️', color: '#fb7185' },
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

function ArenaDuelBeam({
  fighterIds,
  simsRef,
  active,
}: {
  fighterIds: string[];
  simsRef: React.MutableRefObject<Map<string, AgentSim>>;
  active: boolean;
}) {
  const beamRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const orbARef = useRef<THREE.Mesh>(null);
  const orbBRef = useRef<THREE.Mesh>(null);
  const aRef = useRef(new THREE.Vector3());
  const bRef = useRef(new THREE.Vector3());
  const deltaRef = useRef(new THREE.Vector3());
  const midRef = useRef(new THREE.Vector3());

  useFrame((state) => {
    const beam = beamRef.current;
    const pulse = pulseRef.current;
    const orbA = orbARef.current;
    const orbB = orbBRef.current;
    if (!beam || !pulse || !orbA || !orbB) return;

    if (!active || fighterIds.length < 2) {
      beam.visible = false;
      pulse.visible = false;
      orbA.visible = false;
      orbB.visible = false;
      return;
    }

    const simA = simsRef.current.get(fighterIds[0]);
    const simB = simsRef.current.get(fighterIds[1]);
    if (!simA || !simB) {
      beam.visible = false;
      pulse.visible = false;
      orbA.visible = false;
      orbB.visible = false;
      return;
    }

    const a = aRef.current.copy(simA.position);
    a.y += 1.45;
    const b = bRef.current.copy(simB.position);
    b.y += 1.45;

    const delta = deltaRef.current.copy(b).sub(a);
    const distance = delta.length();
    if (!Number.isFinite(distance) || distance < 0.2) {
      beam.visible = false;
      pulse.visible = false;
      orbA.visible = false;
      orbB.visible = false;
      return;
    }
    delta.divideScalar(distance);

    const mid = midRef.current.copy(a).add(b).multiplyScalar(0.5);
    const t = state.clock.elapsedTime;
    const pulseWave = (Math.sin(t * 17.5) + 1) * 0.5;
    const jitterWave = (Math.sin(t * 9.5) + 1) * 0.5;
    const beamRadius = 0.08 + pulseWave * 0.08;

    beam.visible = true;
    beam.position.copy(mid);
    beam.quaternion.setFromUnitVectors(Y_AXIS, delta);
    beam.scale.set(beamRadius, distance * 0.5, beamRadius);
    const beamMat = beam.material as THREE.MeshStandardMaterial;
    beamMat.opacity = 0.52 + pulseWave * 0.35;
    beamMat.emissiveIntensity = 1.1 + pulseWave * 1.25;

    pulse.visible = true;
    pulse.position.copy(mid);
    pulse.position.y = 0.09;
    pulse.rotation.z = t * 1.6;
    const pulseScale = 1 + pulseWave * 0.32 + distance * 0.06;
    pulse.scale.set(pulseScale, pulseScale, 1);
    const pulseMat = pulse.material as THREE.MeshBasicMaterial;
    pulseMat.opacity = 0.14 + pulseWave * 0.18;

    const orbScale = 0.22 + jitterWave * 0.18;
    orbA.visible = true;
    orbA.position.copy(a);
    orbA.scale.setScalar(orbScale);
    const orbAMat = orbA.material as THREE.MeshStandardMaterial;
    orbAMat.opacity = 0.46 + pulseWave * 0.32;
    orbAMat.emissiveIntensity = 1.2 + pulseWave * 0.7;

    orbB.visible = true;
    orbB.position.copy(b);
    orbB.scale.setScalar(orbScale);
    const orbBMat = orbB.material as THREE.MeshStandardMaterial;
    orbBMat.opacity = 0.46 + pulseWave * 0.32;
    orbBMat.emissiveIntensity = 1.2 + pulseWave * 0.7;
  });

  if (!active || fighterIds.length < 2) return null;

  return (
    <group>
      <mesh ref={pulseRef} position={[0, 0.09, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6.8, 8.8, 44]} />
        <meshBasicMaterial color="#fb7185" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <mesh ref={beamRef}>
        <cylinderGeometry args={[0.13, 0.13, 1, 16]} />
        <meshStandardMaterial
          color="#fda4af"
          emissive="#f43f5e"
          emissiveIntensity={1.6}
          transparent
          opacity={0.72}
          roughness={0.15}
          metalness={0.45}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={orbARef}>
        <icosahedronGeometry args={[0.2, 1]} />
        <meshStandardMaterial
          color="#fecdd3"
          emissive="#fb7185"
          emissiveIntensity={1.3}
          transparent
          opacity={0.65}
          roughness={0.12}
          metalness={0.3}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={orbBRef}>
        <icosahedronGeometry args={[0.2, 1]} />
        <meshStandardMaterial
          color="#fecdd3"
          emissive="#fb7185"
          emissiveIntensity={1.3}
          transparent
          opacity={0.65}
          roughness={0.12}
          metalness={0.3}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function ArenaImpactBurstFx({ burst }: { burst: ArenaImpactBurst }) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const sparkRefs = useRef<Array<THREE.Mesh | null>>([]);
  const lifeSeed = useMemo(() => hashToSeed(burst.id), [burst.id]);
  const sparkCount = 6;

  useFrame((state) => {
    const group = groupRef.current;
    const ring = ringRef.current;
    const halo = haloRef.current;
    if (!group || !ring || !halo) return;

    const ageMs = Date.now() - burst.createdAt;
    if (ageMs < 0 || ageMs > ARENA_IMPACT_BURST_LIFE_MS) {
      group.visible = false;
      return;
    }
    group.visible = true;

    const life = THREE.MathUtils.clamp(ageMs / ARENA_IMPACT_BURST_LIFE_MS, 0, 1);
    const fade = 1 - life;
    const easeOut = 1 - Math.pow(1 - life, 3);
    const t = state.clock.elapsedTime;
    const toneColor = burst.tone === 'ROSE' ? '#fb7185' : '#22d3ee';
    const ringScale = 0.65 + easeOut * (1.35 + burst.intensity * 0.45);
    const lift = easeOut * (0.18 + burst.intensity * 0.12);

    group.position.set(burst.position[0], burst.position[1] + lift, burst.position[2]);

    ring.scale.set(ringScale, ringScale, 1);
    const ringMat = ring.material as THREE.MeshStandardMaterial;
    ringMat.opacity = THREE.MathUtils.clamp(0.65 * fade, 0, 0.75);
    ringMat.emissiveIntensity = THREE.MathUtils.clamp(1.25 * fade + burst.intensity * 0.55, 0, 2.2);
    ringMat.color.set(toneColor);
    ringMat.emissive.set(toneColor);

    halo.scale.set(ringScale * 0.82, ringScale * 0.82, 1);
    const haloMat = halo.material as THREE.MeshBasicMaterial;
    haloMat.opacity = THREE.MathUtils.clamp((0.45 + Math.sin(t * 24 + lifeSeed * 0.001) * 0.08) * fade, 0, 0.5);
    haloMat.color.set(toneColor);

    for (let index = 0; index < sparkCount; index++) {
      const spark = sparkRefs.current[index];
      if (!spark) continue;
      const angle = (index / sparkCount) * Math.PI * 2 + lifeSeed * 0.00011;
      const radial = 0.18 + easeOut * (0.9 + burst.intensity * 0.45);
      spark.position.set(
        Math.cos(angle) * radial,
        0.08 + easeOut * (0.24 + (index % 2) * 0.05),
        Math.sin(angle) * radial,
      );
      spark.rotation.y = -angle;
      spark.scale.setScalar(0.45 + fade * 0.55);
      const sparkMat = spark.material as THREE.MeshStandardMaterial;
      sparkMat.opacity = THREE.MathUtils.clamp((0.28 + (index % 2) * 0.12) * fade, 0, 0.4);
      sparkMat.emissiveIntensity = THREE.MathUtils.clamp((0.65 + burst.intensity * 0.28) * fade, 0, 1.8);
      sparkMat.color.set(toneColor);
      sparkMat.emissive.set(toneColor);
    }
  });

  return (
    <group ref={groupRef} position={burst.position}>
      <mesh ref={haloRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.52, 36]} />
        <meshBasicMaterial color={burst.tone === 'ROSE' ? '#fb7185' : '#22d3ee'} transparent opacity={0.36} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.56, 0.05, 10, 40]} />
        <meshStandardMaterial
          color={burst.tone === 'ROSE' ? '#fb7185' : '#22d3ee'}
          emissive={burst.tone === 'ROSE' ? '#fb7185' : '#22d3ee'}
          emissiveIntensity={1.25}
          transparent
          opacity={0.65}
          roughness={0.2}
          metalness={0.28}
          depthWrite={false}
        />
      </mesh>
      {Array.from({ length: sparkCount }).map((_, index) => (
        <mesh
          key={`spark-${burst.id}-${index}`}
          ref={(node) => {
            sparkRefs.current[index] = node;
          }}
          position={[0, 0.12, 0]}
        >
          <boxGeometry args={[0.04, 0.25, 0.04]} />
          <meshStandardMaterial
            color={burst.tone === 'ROSE' ? '#fecdd3' : '#a5f3fc'}
            emissive={burst.tone === 'ROSE' ? '#fb7185' : '#22d3ee'}
            emissiveIntensity={0.8}
            transparent
            opacity={0.3}
            roughness={0.25}
            metalness={0.18}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function ArenaImpactBursts({ bursts }: { bursts: ArenaImpactBurst[] }) {
  if (bursts.length === 0) return null;
  return (
    <group>
      {bursts.map((burst) => (
        <ArenaImpactBurstFx key={burst.id} burst={burst} />
      ))}
    </group>
  );
}

function ActionBurstFx({ burst }: { burst: ActionBurst }) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const spriteRef = useRef<THREE.Sprite>(null);
  const labelRef = useRef<THREE.Sprite>(null);
  const shardRefs = useRef<Array<THREE.Mesh | null>>([]);
  const seededPhase = useMemo(() => hashToSeed(burst.id), [burst.id]);
  const visual = useMemo(() => actionBurstVisual(burst.kind, burst.polarity), [burst.kind, burst.polarity]);
  const iconTexture = useMemo(() => getEmojiTexture(visual.emoji), [visual.emoji]);
  const showLabel = burst.isOwned;
  const labelAsset = useMemo(() => {
    if (!showLabel) return null;
    const fg = burst.polarity > 0 ? '#dcfce7' : burst.polarity < 0 ? '#fecdd3' : '#e2e8f0';
    const bg = burst.polarity > 0
      ? 'rgba(6, 78, 59, 0.86)'
      : burst.polarity < 0
        ? 'rgba(127, 29, 29, 0.86)'
        : 'rgba(15, 23, 42, 0.86)';
    return drawLabelTexture(burst.label, { fg, bg });
  }, [showLabel, burst.label, burst.polarity]);
  const labelAspect = labelAsset ? labelAsset.width / Math.max(1, labelAsset.height) : 1;
  const labelHeight = burst.isOwned ? 0.16 : 0.145;
  const labelWidth = labelHeight * labelAspect;
  const shardCount = 4;

  useEffect(() => {
    if (!labelAsset) return;
    return () => {
      labelAsset.texture.dispose();
    };
  }, [labelAsset]);

  useFrame((state) => {
    const group = groupRef.current;
    const ring = ringRef.current;
    const halo = haloRef.current;
    const sprite = spriteRef.current;
    const label = labelRef.current;
    if (!group || !ring || !halo || !sprite) return;
    if (showLabel && !label) return;

    const ageMs = Date.now() - burst.createdAt;
    if (ageMs < 0 || ageMs > ACTION_BURST_LIFE_MS) {
      group.visible = false;
      return;
    }
    group.visible = true;

    const life = THREE.MathUtils.clamp(ageMs / ACTION_BURST_LIFE_MS, 0, 1);
    const fade = 1 - life;
    const pop = 1 - Math.pow(1 - life, 3);
    const pulse = (Math.sin(state.clock.elapsedTime * 20 + seededPhase * 0.001) + 1) * 0.5;
    const intensity = THREE.MathUtils.clamp(burst.intensity, 0.55, 2.25);
    const baseScale = 0.52 + pop * (0.96 + intensity * 0.24);
    const lift = 0.1 + pop * (0.44 + intensity * 0.22);

    group.position.set(burst.position[0], burst.position[1] + lift, burst.position[2]);
    ring.scale.set(baseScale, baseScale, 1);
    halo.scale.set(baseScale * 0.84, baseScale * 0.84, 1);
    sprite.position.set(0, 0.2 + pop * 0.26, 0);
    const iconScale = 0.24 + pop * 0.18 + (burst.isOwned ? 0.05 : 0);
    sprite.scale.set(iconScale, iconScale, 1);
    if (showLabel && label) {
      label.position.set(0, 0.5 + pop * 0.38, 0);
      const labelScale = 1 + pop * 0.18;
      label.scale.set(labelWidth * labelScale, labelHeight * labelScale, 1);
    }

    const ringMat = ring.material as THREE.MeshStandardMaterial;
    ringMat.color.set(visual.color);
    ringMat.emissive.set(visual.color);
    ringMat.opacity = THREE.MathUtils.clamp((0.58 + pulse * 0.22) * fade, 0, 0.78);
    ringMat.emissiveIntensity = THREE.MathUtils.clamp((0.78 + intensity * 0.45 + pulse * 0.4) * fade, 0, 2.4);

    const haloMat = halo.material as THREE.MeshBasicMaterial;
    haloMat.color.set(visual.accent);
    haloMat.opacity = THREE.MathUtils.clamp((0.24 + pulse * 0.14) * fade, 0, 0.45);

    const spriteMat = sprite.material as THREE.SpriteMaterial;
    spriteMat.opacity = THREE.MathUtils.clamp((0.92 - life * 0.35) * fade, 0, 0.98);
    if (showLabel && label) {
      const labelMat = label.material as THREE.SpriteMaterial;
      labelMat.opacity = THREE.MathUtils.clamp((0.92 - life * 0.22) * fade, 0, 0.95);
    }

    for (let index = 0; index < shardCount; index++) {
      const shard = shardRefs.current[index];
      if (!shard) continue;
      const theta = (index / shardCount) * Math.PI * 2 + seededPhase * 0.00023;
      const radial = 0.2 + pop * (0.62 + intensity * 0.24);
      shard.position.set(
        Math.cos(theta) * radial,
        0.08 + pop * (0.15 + (index % 2) * 0.06),
        Math.sin(theta) * radial,
      );
      shard.rotation.y = -theta + life * 0.6;
      shard.scale.y = 0.55 + pop * 0.35;
      const shardMat = shard.material as THREE.MeshStandardMaterial;
      shardMat.color.set(visual.accent);
      shardMat.emissive.set(visual.color);
      shardMat.opacity = THREE.MathUtils.clamp((0.22 + pulse * 0.18) * fade, 0, 0.45);
      shardMat.emissiveIntensity = THREE.MathUtils.clamp((0.42 + intensity * 0.22) * fade, 0, 1.3);
    }
  });

  return (
    <group ref={groupRef} position={burst.position}>
      <mesh ref={haloRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.58, 34]} />
        <meshBasicMaterial color={visual.accent} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.62, 0.045, 10, 38]} />
        <meshStandardMaterial
          color={visual.color}
          emissive={visual.color}
          emissiveIntensity={1}
          transparent
          opacity={0.6}
          roughness={0.22}
          metalness={0.26}
          depthWrite={false}
        />
      </mesh>
      {Array.from({ length: shardCount }).map((_, index) => (
        <mesh
          key={`action-shard:${burst.id}:${index}`}
          ref={(node) => {
            shardRefs.current[index] = node;
          }}
          position={[0, 0.12, 0]}
        >
          <boxGeometry args={[0.03, 0.2, 0.03]} />
          <meshStandardMaterial
            color={visual.accent}
            emissive={visual.color}
            emissiveIntensity={0.6}
            transparent
            opacity={0.32}
            roughness={0.24}
            metalness={0.18}
            depthWrite={false}
          />
        </mesh>
      ))}
      <sprite ref={spriteRef} position={[0, 0.22, 0]} scale={[0.28, 0.28, 1]}>
        <spriteMaterial
          map={iconTexture}
          color={burst.isOwned ? '#ffffff' : '#dbeafe'}
          transparent
          opacity={0.94}
          depthWrite={false}
          depthTest={false}
        />
      </sprite>
      {showLabel && labelAsset && (
        <sprite ref={labelRef} position={[0, 0.52, 0]} scale={[labelWidth, labelHeight, 1]}>
          <spriteMaterial map={labelAsset.texture} transparent opacity={0.92} depthWrite={false} depthTest={false} />
        </sprite>
      )}
    </group>
  );
}

function ActionBursts({ bursts }: { bursts: ActionBurst[] }) {
  if (bursts.length === 0) return null;
  return (
    <group>
      {bursts.map((burst) => (
        <ActionBurstFx key={burst.id} burst={burst} />
      ))}
    </group>
  );
}

function OwnedLoopAura({
  ownedAgentId,
  loopTelemetry,
  simsRef,
}: {
  ownedAgentId: string | null;
  loopTelemetry: DegenLoopTelemetry | null;
  simsRef: React.MutableRefObject<Map<string, AgentSim>>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const shaftRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const group = groupRef.current;
    const ring = ringRef.current;
    const halo = haloRef.current;
    const shaft = shaftRef.current;
    if (!group || !ring || !halo || !shaft) return;

    if (!ownedAgentId || !loopTelemetry) {
      group.visible = false;
      return;
    }

    const sim = simsRef.current.get(ownedAgentId);
    if (!sim || sim.state === 'DEAD') {
      group.visible = false;
      return;
    }

    group.visible = true;
    const tone = resolveDegenLoopVisual(loopTelemetry.lastPhase);
    const nowMs = Date.now();
    const elapsed = loopTelemetry.lastAdvanceAt != null ? Math.max(0, nowMs - loopTelemetry.lastAdvanceAt) : 99999;
    const heat = THREE.MathUtils.clamp(1 - elapsed / 9000, 0, 1);
    const chain = Math.max(0, loopTelemetry.chain);
    const chainBoost = THREE.MathUtils.clamp(chain / 8, 0, 1);

    const pulse = (Math.sin(state.clock.elapsedTime * (9 + heat * 11)) + 1) * 0.5;
    const floatPulse = (Math.sin(state.clock.elapsedTime * 3.6) + 1) * 0.5;
    const baseScale = 1 + chainBoost * 0.3 + heat * 0.2 + pulse * 0.22;

    group.position.set(sim.position.x, 0.03, sim.position.z);

    ring.scale.set(baseScale, baseScale, 1);
    const ringMat = ring.material as THREE.MeshStandardMaterial;
    ringMat.color.set(tone.color);
    ringMat.emissive.set(tone.color);
    ringMat.opacity = THREE.MathUtils.clamp(0.2 + heat * 0.16 + pulse * 0.12, 0.15, 0.52);
    ringMat.emissiveIntensity = THREE.MathUtils.clamp(0.7 + chainBoost * 0.8 + heat * 1.2 + pulse * 0.7, 0.7, 2.8);

    halo.scale.set(baseScale * (1.28 + heat * 0.12), baseScale * (1.28 + heat * 0.12), 1);
    const haloMat = halo.material as THREE.MeshBasicMaterial;
    haloMat.color.set(tone.accent);
    haloMat.opacity = THREE.MathUtils.clamp(0.1 + heat * 0.14 + pulse * 0.08, 0.06, 0.34);

    shaft.position.y = 0.82 + floatPulse * 0.12;
    shaft.scale.set(1, 1 + chainBoost * 0.22 + heat * 0.14, 1);
    const shaftMat = shaft.material as THREE.MeshStandardMaterial;
    shaftMat.color.set(tone.accent);
    shaftMat.emissive.set(tone.color);
    shaftMat.opacity = THREE.MathUtils.clamp(0.12 + heat * 0.18, 0.1, 0.48);
    shaftMat.emissiveIntensity = THREE.MathUtils.clamp(0.35 + chainBoost * 0.7 + heat * 1.05, 0.35, 2.2);
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={haloRef} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.2, 1.95, 46]} />
        <meshBasicMaterial transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <torusGeometry args={[1.4, 0.055, 10, 52]} />
        <meshStandardMaterial transparent opacity={0.26} roughness={0.2} metalness={0.4} depthWrite={false} />
      </mesh>
      <mesh ref={shaftRef} position={[0, 0.84, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 1.3, 12]} />
        <meshStandardMaterial transparent opacity={0.22} roughness={0.32} metalness={0.25} depthWrite={false} />
      </mesh>
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
  const lastSampleAtRef = useRef(0);

  useFrame(() => {
    const now = performance.now();
    if (now - lastSampleAtRef.current < 120) return;
    lastSampleAtRef.current = now;

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
      key={`${agentId}-dest-${points.length}`}
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
  const canRenderThought = isRecent && !!lastAction && !!lastReasoning;

  // Clean up reasoning (remove [AUTO] prefix, trim)
  const cleanReasoning = canRenderThought
    ? String(lastReasoning)
        .replace(/\[AUTO\]\s*/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    : '';

  // Build display text: emoji + short action + reasoning snippet
  const actionEmojis: Record<string, string> = {
    claim_plot: '📍', start_build: '🔨', do_work: '🏗️', complete_build: '🎉',
    buy_arena: '💱', sell_arena: '💱', mine: '⛏️', play_arena: '🎮',
    buy_skill: '💳', rest: '💤',
  };
  const emoji = actionEmojis[lastAction ?? 'rest'] || '💭';
  const maxLen = 50;
  const text = cleanReasoning.length > maxLen
    ? `${emoji} ${cleanReasoning.slice(0, maxLen)}…`
    : `${emoji} ${cleanReasoning}`;

  const { texture, width, height } = useMemo(() => {
    if (!canRenderThought) return { texture: new THREE.Texture(), width: 1, height: 1 };
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
  }, [text, lastAction, canRenderThought]);

  if (!canRenderThought) return null;

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

function CrewTerritoryPulse({
  position,
  color,
  seed,
}: {
  position: [number, number, number];
  color: string;
  seed: number;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const phase = (seed % 360) * (Math.PI / 180);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = (Math.sin(t * 2.8 + phase) + 1) * 0.5;
    if (ringRef.current) {
      const scale = 1 + pulse * 0.18;
      ringRef.current.scale.set(scale, scale, 1);
      ringRef.current.rotation.z = t * 0.55 + phase * 0.2;
      const ringMat = ringRef.current.material as THREE.MeshBasicMaterial;
      ringMat.opacity = 0.12 + pulse * 0.16;
    }
    if (haloRef.current) {
      const haloScale = 1 + pulse * 0.22;
      haloRef.current.scale.set(haloScale, haloScale, 1);
      const haloMat = haloRef.current.material as THREE.MeshBasicMaterial;
      haloMat.opacity = 0.04 + pulse * 0.08;
    }
  });

  return (
    <group position={position}>
      <mesh ref={ringRef} position={[0, 0.11, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6.9, 7.8, 36]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh ref={haloRef} position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[13.4, 13.4]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ObjectiveBeacon({
  position,
  color,
  label,
}: {
  position: [number, number, number];
  color: string;
  label: string;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.7;
      const pulse = 1 + Math.sin(t * 2.7) * 0.12;
      ringRef.current.scale.set(pulse, pulse, 1);
      const material = ringRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.55 + Math.sin(t * 2.7) * 0.2;
      material.opacity = 0.3 + Math.sin(t * 2.7) * 0.12;
    }
    if (haloRef.current) {
      haloRef.current.position.y = 2.5 + Math.sin(t * 2) * 0.15;
      const material = haloRef.current.material as THREE.MeshStandardMaterial;
      material.opacity = 0.14 + Math.sin(t * 2.3) * 0.05;
    }
  });

  return (
    <group position={position}>
      <mesh ref={ringRef} position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[8.3, 0.2, 8, 42]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} transparent opacity={0.3} />
      </mesh>
      <mesh ref={haloRef} position={[0, 2.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9.6, 9.6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} transparent opacity={0.14} />
      </mesh>
      <pointLight position={[0, 3.2, 0]} color={color} intensity={0.8} distance={16} />
      <BillboardLabel text={label} position={[0, 4.9, 0]} color={color} />
    </group>
  );
}

// BuildingWindows moved to ../components/buildings/shared.tsx

// Agent trail effect
function AgentTrail({
  agentId,
  simsRef,
  color,
  actionType,
  selected = false,
}: {
  agentId: string;
  simsRef: React.MutableRefObject<Map<string, AgentSim>>;
  color: string;
  actionType?: string | null;
  selected?: boolean;
}) {
  const trailRef = useRef<THREE.Vector3[]>([]);
  const beadRefs = useRef<Array<THREE.Mesh | null>>([]);
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const samplePosRef = useRef(new THREE.Vector3());
  const lastTrailSampleAtRef = useRef(0);
  const maxLength = 15;
  const style = useMemo(() => resolveTrailVisual(actionType, color), [actionType, color]);
  const pulseSeed = useMemo(() => hashToSeed(`${agentId}:${actionType || 'none'}:trail`), [agentId, actionType]);

  useFrame((state) => {
    const sim = simsRef.current.get(agentId);
    if (!sim || sim.state === 'DEAD') return;

    const trail = trailRef.current;
    const now = performance.now();
    if (now - lastTrailSampleAtRef.current >= 95) {
      lastTrailSampleAtRef.current = now;
      const currentPos = samplePosRef.current.copy(sim.position);
      currentPos.y = 0.1;

      // Add point if moved enough.
      const lastPoint = trail[trail.length - 1];
      if (!lastPoint || currentPos.distanceTo(lastPoint) > 0.36) {
        trail.push(currentPos.clone());
        if (trail.length > maxLength) trail.shift();
        setPoints([...trail]);
      }
    }

    const beadCount = Math.min(trail.length, 10);
    const pulseRate = 4.2 + style.pulse * 1.9;
    for (let index = 0; index < beadCount; index++) {
      const bead = beadRefs.current[index];
      const source = trail[trail.length - 1 - index];
      if (!bead || !source) continue;
      bead.visible = true;
      bead.position.set(source.x, source.y + 0.07 + index * 0.003, source.z);
      const tail = index / Math.max(1, beadCount - 1);
      const headWeight = 1 - tail;
      const pulse = 0.75 + (Math.sin(state.clock.elapsedTime * pulseRate + pulseSeed * 0.0009 + index * 0.7) + 1) * 0.27;
      const scale = style.beadSize * pulse * (0.72 + headWeight * 0.72) * (selected ? 1.22 : 1);
      bead.scale.setScalar(scale);
      const beadMaterial = bead.material as THREE.MeshStandardMaterial;
      beadMaterial.opacity = THREE.MathUtils.clamp(style.beadOpacity * (0.5 + headWeight * 0.72) * pulse, 0.03, 0.88);
      beadMaterial.emissiveIntensity = THREE.MathUtils.clamp(0.3 + headWeight * 0.6 + style.pulse * 0.28 + (selected ? 0.22 : 0), 0.2, 2);
    }
    for (let index = beadCount; index < beadRefs.current.length; index++) {
      const bead = beadRefs.current[index];
      if (bead) bead.visible = false;
    }
  });

  if (points.length < 2) return null;

  return (
    <group>
      <Line
        key={`${agentId}-trail-${points.length}`}
        points={points}
        color={style.lineColor}
        lineWidth={style.lineWidth + (selected ? 0.6 : 0)}
        transparent
        opacity={Math.min(0.78, style.lineOpacity + (selected ? 0.14 : 0))}
        dashed={style.dash}
        dashSize={0.34}
        gapSize={0.24}
      />
      {Array.from({ length: Math.min(points.length, 10) }).map((_, index) => (
        <mesh
          key={`trail-bead:${agentId}:${index}`}
          ref={(node) => {
            beadRefs.current[index] = node;
          }}
          position={[0, 0.1, 0]}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial
            color={style.beadColor}
            emissive={style.lineColor}
            emissiveIntensity={0.7}
            transparent
            opacity={style.beadOpacity}
            depthWrite={false}
            roughness={0.26}
            metalness={0.08}
          />
        </mesh>
      ))}
    </group>
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

function zoneMaterial(zone: PlotZone, selected: boolean, crewColorHex?: string | null) {
  const base = new THREE.Color('#2a3328'); // earthy base (not pure black)
  const tint = new THREE.Color(ZONE_COLORS[zone]);
  const color = base.lerp(tint, 0.35);
  let emissive = selected ? tint.clone().multiplyScalar(0.3) : new THREE.Color('#000000');
  if (crewColorHex) {
    const crew = new THREE.Color(crewColorHex);
    color.lerp(crew, selected ? 0.46 : 0.28);
    emissive = selected ? crew.clone().multiplyScalar(0.42) : crew.clone().multiplyScalar(0.15);
  }
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
type AgentActivity =
  | 'WALKING'
  | 'IDLE'
  | 'SHOPPING'
  | 'CHATTING'
  | 'CLAIMING'
  | 'BUILDING'
  | 'WORKING'
  | 'MINING'
  | 'TRADING'
  | 'PLAYING'
  | 'FIGHTING'
  | 'BEGGING'
  | 'SCHEMING'
  | 'TRAVELING';

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
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  route: THREE.Vector3[];
  speed: number;
  baseSpeed: number;
  walk: number;
  state: AgentState;
  stateBlend: number;
  turnVelocity: number;
  lastImpactAt: number;
  stateTimer: number; // Time spent in current state
  stateEndsAt: number; // stateTimer value when state should end (for fixed-duration states)
  targetPlotId: string | null; // Building they're heading to
  chatPartnerId: string | null; // Agent they're chatting with
  chatEndsAt: number; // stateTimer value when chat should end
  health: number; // 0-100, dies at 0
  opportunityScore: number;
  opportunityCommitted: boolean;
  opportunityRewardUntil: number;
  opportunityPenaltyUntil: number;
  opportunityWindowId: string | null;
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
  agentCrewById,
  ownedAgentId,
  ownedLoopTelemetry,
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
  actionBursts,
  relationshipsRef,
  urgencyObjective,
  opportunityWindow,
  fightingAgentIds,
  arenaOutcomeByAgentId,
  arenaMomentumByAgentId,
  visualProfile,
  visualQuality,
  visualSettings,
}: {
  town: Town;
  agents: Agent[];
  agentCrewById: Record<string, CrewAgentLink>;
  ownedAgentId: string | null;
  ownedLoopTelemetry: DegenLoopTelemetry | null;
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
  actionBursts: ActionBurst[];
  relationshipsRef: React.MutableRefObject<{ agentAId: string; agentBId: string; status: string; score: number }[]>;
  urgencyObjective: UrgencyObjective | null;
  opportunityWindow: OpportunityWindow | null;
  fightingAgentIds?: Set<string>;
  arenaOutcomeByAgentId: Record<string, ArenaOutcomeSignal>;
  arenaMomentumByAgentId: Record<string, number>;
  visualProfile: VisualProfile;
  visualQuality: ResolvedVisualQuality;
  visualSettings: VisualSettings;
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
  const cameraVelocityRef = useRef(new THREE.Vector3());
  const lookTargetRef = useRef(new THREE.Vector3());
  const cameraShakeRef = useRef(0);
  const previousCoinBurstsRef = useRef(0);
  const previousDeathEffectsRef = useRef(0);
  const previousSpawnEffectsRef = useRef(0);
  const focusSnapTimerRef = useRef(0);
  const arenaRingRef = useRef<THREE.Mesh>(null);
  const arenaDomeRef = useRef<THREE.Mesh>(null);
  const arenaShockwaveRef = useRef<THREE.Mesh>(null);
  const arenaSlashRingRef = useRef<THREE.Mesh>(null);
  const arenaNextStrikeAtRef = useRef<Map<string, number>>(new Map());
  const arenaStrikeStartAtRef = useRef<Map<string, number>>(new Map());
  const arenaPairImpactAtRef = useRef<Map<string, number>>(new Map());
  const arenaCoreLightRef = useRef<THREE.PointLight>(null);
  const [arenaImpactBursts, setArenaImpactBursts] = useState<ArenaImpactBurst[]>([]);
  const arenaCineAngleRef = useRef(Math.PI * 0.22);
  const arenaBeatRef = useRef<{ activeUntilMs: number; strength: number }>({
    activeUntilMs: 0,
    strength: 0,
  });
  const arenaCameraPulseRef = useRef<{
    activeUntilMs: number;
    startedAtMs: number;
    focusAgentId: string | null;
    strength: number;
    direction: -1 | 1;
  }>({
    activeUntilMs: 0,
    startedAtMs: 0,
    focusAgentId: null,
    strength: 0,
    direction: 1,
  });
  const lastArenaOutcomeSigRef = useRef<string>('');
  const activeOpportunityRef = useRef<OpportunityWindow | null>(null);
  const resolvedOpportunityIdsRef = useRef<Set<string>>(new Set());
  const arenaFighterIds = useMemo(
    () => Array.from(fightingAgentIds ?? []).sort(),
    [fightingAgentIds],
  );

  useEffect(() => {
    const cleanup = window.setInterval(() => {
      const nowMs = Date.now();
      setArenaImpactBursts((prev) => {
        const next = prev.filter((burst) => nowMs - burst.createdAt <= ARENA_IMPACT_BURST_LIFE_MS);
        return next.length === prev.length ? prev : next;
      });
    }, 110);
    return () => window.clearInterval(cleanup);
  }, []);

  useEffect(() => {
    const activeFighters = new Set(arenaFighterIds);
    for (const id of Array.from(arenaNextStrikeAtRef.current.keys())) {
      if (!activeFighters.has(id)) {
        arenaNextStrikeAtRef.current.delete(id);
        arenaStrikeStartAtRef.current.delete(id);
      }
    }
    for (const key of Array.from(arenaPairImpactAtRef.current.keys())) {
      const [a, b] = key.split(':');
      if (!activeFighters.has(a) || !activeFighters.has(b)) {
        arenaPairImpactAtRef.current.delete(key);
      }
    }
  }, [arenaFighterIds]);

  useEffect(() => {
    if (!visualSettings.cameraShake) {
      cameraShakeRef.current = 0;
      previousCoinBurstsRef.current = coinBursts.length;
      previousDeathEffectsRef.current = deathEffects.length;
      previousSpawnEffectsRef.current = spawnEffects.length;
      return;
    }
    if (coinBursts.length > previousCoinBurstsRef.current) {
      cameraShakeRef.current = Math.min(0.6, cameraShakeRef.current + 0.08);
    }
    if (deathEffects.length > previousDeathEffectsRef.current) {
      cameraShakeRef.current = Math.min(0.7, cameraShakeRef.current + 0.14);
    }
    if (spawnEffects.length > previousSpawnEffectsRef.current) {
      cameraShakeRef.current = Math.min(0.55, cameraShakeRef.current + 0.05);
    }
    previousCoinBurstsRef.current = coinBursts.length;
    previousDeathEffectsRef.current = deathEffects.length;
    previousSpawnEffectsRef.current = spawnEffects.length;
  }, [coinBursts.length, deathEffects.length, spawnEffects.length, visualSettings.cameraShake]);

  useEffect(() => {
    if (!selectedAgentId) return;
    focusSnapTimerRef.current = 0.42;
    introRef.current.active = false;
  }, [selectedAgentId, introRef]);

  useEffect(() => {
    const entries = Object.entries(arenaOutcomeByAgentId);
    if (entries.length === 0) return;

    let latest: [string, ArenaOutcomeSignal] | null = null;
    let latestTs = 0;
    for (const entry of entries) {
      const ts = Date.parse(entry[1].at);
      if (!Number.isFinite(ts)) continue;
      if (!latest || ts > latestTs) {
        latest = entry;
        latestTs = ts;
      }
    }
    if (!latest) return;

    const [agentId, signal] = latest;
    const signature = `${agentId}:${signal.at}:${signal.delta}:${signal.result}`;
    if (signature === lastArenaOutcomeSigRef.current) return;
    lastArenaOutcomeSigRef.current = signature;

    const age = Date.now() - latestTs;
    if (age < 0 || age > ARENA_PAYOFF_POPUP_LIFE_MS) return;

    const baseStrength = THREE.MathUtils.clamp(Math.abs(signal.delta) / 20, 0.22, 1.4);
    const momentumScore = Math.max(1, Math.abs(arenaMomentumByAgentId[agentId] || 1));
    const streakBoost = 1 + Math.min(0.95, Math.max(0, momentumScore - 1) * 0.22);
    const strength = THREE.MathUtils.clamp(baseStrength * streakBoost, 0.22, 2.1);
    arenaBeatRef.current = {
      activeUntilMs: Date.now() + ARENA_BEAT_LIFE_MS,
      strength,
    };
    arenaCameraPulseRef.current = {
      activeUntilMs: Date.now() + ARENA_CAMERA_CINE_LIFE_MS,
      startedAtMs: Date.now(),
      focusAgentId: agentId,
      strength,
      direction: hashToSeed(signature) % 2 === 0 ? 1 : -1,
    };
    if (visualSettings.cameraShake) {
      cameraShakeRef.current = Math.min(0.95, cameraShakeRef.current + 0.12 + strength * 0.08);
    }
  }, [arenaMomentumByAgentId, arenaOutcomeByAgentId, visualSettings.cameraShake]);

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
        velocity: new THREE.Vector3(),
        acceleration: new THREE.Vector3(),
        route: [],
        speed,
        baseSpeed: speed,
        walk: rng() * 10,
        state: 'WALKING',
        stateBlend: 0,
        turnVelocity: 0,
        lastImpactAt: 0,
        stateTimer: 0,
        stateEndsAt: 0,
        targetPlotId: null,
        chatPartnerId: null,
        chatEndsAt: 0,
        health: 100,
        opportunityScore: 0,
        opportunityCommitted: false,
        opportunityRewardUntil: 0,
        opportunityPenaltyUntil: 0,
        opportunityWindowId: null,
      });
    }
  }, [agents, roadNodes, simsRef]);

  const CHAT_DURATION: Record<string, [number, number]> = {
    SHARK: [2, 3], DEGEN: [2, 3],
    ROCK: [3, 4], GRINDER: [3, 4],
    CHAMELEON: [4, 6],
  };
  const ZONE_ARRIVAL_ACTIONS: Record<PlotZone, { state: AgentState; min: number; max: number; chance: number }> = {
    RESIDENTIAL: { state: 'IDLE', min: 2.4, max: 5.2, chance: 0.6 },
    COMMERCIAL: { state: 'SHOPPING', min: 2.5, max: 5.8, chance: 0.78 },
    CIVIC: { state: 'IDLE', min: 3.2, max: 5.6, chance: 0.72 },
    INDUSTRIAL: { state: 'MINING', min: 3.2, max: 5.8, chance: 0.82 },
    ENTERTAINMENT: { state: 'PLAYING', min: 4.5, max: 9.5, chance: 0.88 },
  };
  const OBJECTIVE_ACTIONS: Record<UrgencyKind, { state: AgentState; min: number; max: number; chance: number }> = {
    ARENA: { state: 'PLAYING', min: 5.5, max: 11.5, chance: 0.95 },
    TRADE: { state: 'SHOPPING', min: 3.5, max: 7.5, chance: 0.92 },
    MINE: { state: 'MINING', min: 4.2, max: 8.2, chance: 0.94 },
    BUILD: { state: 'BUILDING', min: 4.0, max: 8.4, chance: 0.9 },
    ENTERTAIN: { state: 'PLAYING', min: 5.0, max: 10.0, chance: 0.94 },
    STABILIZE: { state: 'IDLE', min: 4.2, max: 8.0, chance: 0.9 },
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
  const plotById = useMemo(() => {
    const map = new Map<string, Plot>();
    for (const plot of plots) map.set(plot.id, plot);
    return map;
  }, [plots]);
  const builtPlots = useMemo(() => plots.filter((p) => p.status === 'BUILT' || p.status === 'UNDER_CONSTRUCTION'), [plots]);
  const underConstructionPlots = useMemo(() => plots.filter((p) => p.status === 'UNDER_CONSTRUCTION'), [plots]);
  const entertainmentPlots = useMemo(() => plots.filter((p) => p.status === 'BUILT' && p.zone === 'ENTERTAINMENT'), [plots]);
  const activeObjective = opportunityWindow?.objective ?? urgencyObjective;
  const objectivePlots = useMemo(() => {
    if (!activeObjective) return [] as Plot[];
    if (activeObjective.kind === 'BUILD') {
      return underConstructionPlots.length > 0 ? underConstructionPlots : builtPlots;
    }
    return builtPlots.filter((plot) => activeObjective.targetZones.includes(plot.zone));
  }, [activeObjective, underConstructionPlots, builtPlots]);

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

  const objectiveBeacon = useMemo(() => {
    if (!activeObjective || objectivePlots.length === 0) return null;
    const seed = hashToSeed(
      `${town.id}:${activeObjective.kind}:${opportunityWindow?.id ?? activeObjective.sourceType ?? 'NONE'}`,
    );
    const target = objectivePlots[seed % objectivePlots.length];
    const pos = getPlotWorldPos(target.plotIndex);
    return {
      position: [pos.x, 0.08, pos.z] as [number, number, number],
      label: opportunityWindow
        ? `${activeObjective.emoji} ${opportunityWindow.label}`
        : `${activeObjective.emoji} ${activeObjective.label}`,
      color: activeObjective.color,
    };
  }, [activeObjective, objectivePlots, opportunityWindow, town.id, getPlotWorldPos]);

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

  const resolveOpportunityWindow = useCallback((finishedWindow: OpportunityWindow, nowMs: number) => {
    if (resolvedOpportunityIdsRef.current.has(finishedWindow.id)) return;
    resolvedOpportunityIdsRef.current.add(finishedWindow.id);

    const sims = simsRef.current;
    const participants = Array.from(sims.values())
      .filter((sim) => sim.state !== 'DEAD' && sim.opportunityWindowId === finishedWindow.id && sim.opportunityCommitted)
      .sort((a, b) => b.opportunityScore - a.opportunityScore);

    const winnerCount = Math.max(1, Math.floor(participants.length * 0.32));
    const loserCount = participants.length >= 5 ? Math.max(1, Math.floor(participants.length * 0.22)) : 0;
    const winners = participants.slice(0, winnerCount);
    const losers = loserCount > 0 ? participants.slice(-loserCount) : [];
    const loserIds = new Set(losers.map((sim) => sim.id));
    const bursts: { id: string; position: [number, number, number]; isBuy: boolean }[] = [];

    for (const sim of sims.values()) {
      if (sim.opportunityWindowId !== finishedWindow.id) continue;
      sim.opportunityCommitted = false;
      sim.opportunityWindowId = null;
      sim.opportunityScore = 0;
    }

    for (const sim of winners) {
      sim.opportunityRewardUntil = Math.max(sim.opportunityRewardUntil, nowMs + randomRange(17_000, 26_000));
      sim.opportunityPenaltyUntil = Math.max(0, sim.opportunityPenaltyUntil - 4_000);
      bursts.push({
        id: `opp-win:${finishedWindow.id}:${sim.id}:${nowMs}`,
        position: [sim.position.x, 2.2, sim.position.z],
        isBuy: true,
      });
    }

    for (const sim of losers) {
      if (loserIds.has(sim.id) && winners.some((winner) => winner.id === sim.id)) continue;
      sim.opportunityPenaltyUntil = Math.max(sim.opportunityPenaltyUntil, nowMs + randomRange(13_000, 21_000));
      bursts.push({
        id: `opp-loss:${finishedWindow.id}:${sim.id}:${nowMs}`,
        position: [sim.position.x, 2.1, sim.position.z],
        isBuy: false,
      });
    }

    if (bursts.length > 0) {
      setCoinBursts((prev) => [...prev, ...bursts]);
    }
  }, [setCoinBursts, simsRef]);

  useFrame((_, dt) => {
    const sims = simsRef.current;
    const nowMs = Date.now();
    const previousOpportunity = activeOpportunityRef.current;
    if (previousOpportunity && (!opportunityWindow || opportunityWindow.id !== previousOpportunity.id)) {
      resolveOpportunityWindow(previousOpportunity, nowMs);
    }
    if (opportunityWindow && (!previousOpportunity || previousOpportunity.id !== opportunityWindow.id)) {
      for (const sim of sims.values()) {
        sim.opportunityWindowId = opportunityWindow.id;
        sim.opportunityScore = 0;
        sim.opportunityCommitted = false;
        if (sim.state === 'CHATTING') {
          sim.state = 'WALKING';
          sim.chatPartnerId = null;
          sim.chatEndsAt = 0;
          sim.stateTimer = 0;
          sim.stateEndsAt = 0;
          sim.targetPlotId = null;
          sim.route = [];
        } else if ((sim.state === 'IDLE' || sim.state === 'WALKING') && Math.random() < 0.65) {
          sim.state = 'WALKING';
          sim.stateTimer = 0;
          sim.stateEndsAt = 0;
          sim.targetPlotId = null;
          sim.route = [];
        }
      }
    }
    activeOpportunityRef.current = opportunityWindow;
    if (resolvedOpportunityIdsRef.current.size > 240) {
      resolvedOpportunityIdsRef.current.clear();
    }

    const pendingArenaBursts: ArenaImpactBurst[] = [];
    for (const a of agents) {
      const sim = sims.get(a.id);
      if (!sim) continue;

      if (!Number.isFinite(sim.baseSpeed) || sim.baseSpeed <= 0) sim.baseSpeed = Math.max(2.1, sim.speed || 2.8);
      if (!Number.isFinite(sim.opportunityScore)) sim.opportunityScore = 0;
      if (!Number.isFinite(sim.opportunityRewardUntil)) sim.opportunityRewardUntil = 0;
      if (!Number.isFinite(sim.opportunityPenaltyUntil)) sim.opportunityPenaltyUntil = 0;
      if (typeof sim.opportunityCommitted !== 'boolean') sim.opportunityCommitted = false;
      if (typeof sim.opportunityWindowId !== 'string') sim.opportunityWindowId = null;

      let speedMultiplier = 1;
      if (opportunityWindow) {
        const committedToWindow = sim.opportunityWindowId === opportunityWindow.id && sim.opportunityCommitted;
        speedMultiplier *= committedToWindow ? opportunityWindow.rewardBoost : opportunityWindow.penaltyDrag;
        if (committedToWindow) sim.opportunityScore += dt * 0.04;
      }
      if (sim.opportunityRewardUntil > nowMs) speedMultiplier *= 1.1;
      if (sim.opportunityPenaltyUntil > nowMs) speedMultiplier *= 0.9;
      const targetSpeed = THREE.MathUtils.clamp(sim.baseSpeed * speedMultiplier, 1.45, 6.6);
      sim.speed = THREE.MathUtils.damp(sim.speed, targetSpeed, 3.8, dt);

      // Update state timer
      sim.stateTimer += dt;
      sim.stateBlend = THREE.MathUtils.damp(sim.stateBlend, sim.state === 'WALKING' ? 1 : 0, 7.5, dt);
      if (sim.state !== 'WALKING') {
        sim.turnVelocity = THREE.MathUtils.damp(sim.turnVelocity, 0, 12, dt);
      }

      // Dead agents don't move
      if (sim.state === 'DEAD') {
        sim.velocity.multiplyScalar(Math.exp(-14 * dt));
        sim.acceleration.set(0, 0, 0);
        const g = agentGroupRefs.current.get(a.id);
        if (g) g.position.copy(sim.position);
        continue;
      }

      const fighterSlot = arenaFighterIds.indexOf(a.id);
      if (fighterSlot >= 0) {
        const fighterCount = Math.max(2, arenaFighterIds.length);
        const orbitBase = (fighterSlot / fighterCount) * Math.PI * 2;
        const orbitSpeed = 0.34 + fighterCount * 0.026;
        const orbitAngle = nowMs * 0.001 * orbitSpeed + orbitBase;
        const radius = 4.6 + Math.sin(nowMs * 0.0017 + fighterSlot * 0.8) * 0.34;
        const orbitAnchor = new THREE.Vector3(
          Math.cos(orbitAngle) * radius,
          0.02,
          Math.sin(orbitAngle) * radius,
        );
        const opponentIndex = (fighterSlot + Math.floor(fighterCount / 2)) % fighterCount;
        const opponentId = arenaFighterIds[opponentIndex];
        const opponentSim = opponentId ? sims.get(opponentId) : null;

        const fallbackInward = orbitAnchor.clone().setY(0).normalize().multiplyScalar(-1);
        if (fallbackInward.lengthSq() < 0.0001) fallbackInward.set(0, 0, -1);
        const headingTarget = opponentSim
          ? opponentSim.position.clone().sub(orbitAnchor).setY(0)
          : fallbackInward.clone();
        if (headingTarget.lengthSq() > 0.0001) {
          headingTarget.normalize();
        } else {
          headingTarget.copy(fallbackInward);
        }
        const strafeDir = new THREE.Vector3(-headingTarget.z, 0, headingTarget.x);

        let nextStrikeAt = arenaNextStrikeAtRef.current.get(a.id);
        if (!Number.isFinite(nextStrikeAt)) {
          const seedDelay = 120 + (hashToSeed(`${a.id}:strike`) % 460);
          nextStrikeAt = nowMs + seedDelay;
          arenaNextStrikeAtRef.current.set(a.id, nextStrikeAt);
        }
        if (nowMs >= (nextStrikeAt ?? 0)) {
          arenaStrikeStartAtRef.current.set(a.id, nowMs);
          const cooldown = randomRange(ARENA_STRIKE_COOLDOWN_MIN_MS, ARENA_STRIKE_COOLDOWN_MAX_MS);
          arenaNextStrikeAtRef.current.set(a.id, nowMs + cooldown);
        }

        const strikeStartAt = arenaStrikeStartAtRef.current.get(a.id) ?? -1;
        const strikeAge = strikeStartAt > 0 ? nowMs - strikeStartAt : Number.POSITIVE_INFINITY;
        const strikeEnvelope = getArenaStrikeEnvelope(strikeAge);
        const strikeOffset =
          -0.88 * strikeEnvelope.windup
          + 2.15 * strikeEnvelope.impact
          - 0.72 * strikeEnvelope.recover;
        const strafeOffset = Math.sin(nowMs * 0.0082 + fighterSlot * 1.2) * 0.24;
        const orbitWobble = Math.sin(nowMs * 0.0046 + fighterSlot * 0.8) * 0.16;
        const targetPos = orbitAnchor
          .clone()
          .addScaledVector(headingTarget, strikeOffset + orbitWobble)
          .addScaledVector(strafeDir, strafeOffset);

        sim.position.lerp(targetPos, Math.min(1, dt * (6.4 + strikeEnvelope.impact * 7.2)));
        sim.velocity.set(0, 0, 0);
        sim.acceleration.set(0, 0, 0);
        sim.route = [];
        sim.targetPlotId = ARENA_SPECTATOR_TARGET_ID;
        sim.state = 'FIGHTING';
        sim.stateBlend = THREE.MathUtils.damp(sim.stateBlend, 0, 10.4, dt);
        sim.stateEndsAt = 0;
        sim.heading.lerp(headingTarget, Math.min(1, dt * (11 + strikeEnvelope.impact * 5.5)));

        if (strikeEnvelope.impact > 0.78 && nowMs - sim.lastImpactAt > 260) {
          const pairKey = opponentId ? [a.id, opponentId].sort().join(':') : `${a.id}:solo`;
          const lastPairImpactAt = arenaPairImpactAtRef.current.get(pairKey) ?? 0;
          if (nowMs - lastPairImpactAt > 210) {
            arenaPairImpactAtRef.current.set(pairKey, nowMs);
            sim.lastImpactAt = nowMs;
            const midpoint = opponentSim
              ? sim.position.clone().lerp(opponentSim.position, 0.52)
              : sim.position.clone().addScaledVector(headingTarget, 0.9);
            midpoint.y = 1.15;
            pendingArenaBursts.push({
              id: `impact:${pairKey}:${nowMs}`,
              position: [midpoint.x, midpoint.y, midpoint.z],
              createdAt: nowMs,
              intensity: THREE.MathUtils.clamp(0.58 + strikeEnvelope.impact * 0.75, 0.5, 1.65),
              tone: fighterSlot % 2 === 0 ? 'ROSE' : 'CYAN',
            });
          }
        }

        const g = agentGroupRefs.current.get(a.id);
        if (g) {
          g.position.copy(sim.position);
          g.position.y = 0.05 + Math.sin(sim.stateTimer * 14.2 + fighterSlot * 0.6) * 0.07 + strikeEnvelope.impact * 0.08;
          const targetYaw = Math.atan2(sim.heading.x, sim.heading.z);
          g.rotation.y = dampAngle(g.rotation.y, targetYaw, 19.5, dt);
          const strikeTilt = (fighterSlot % 2 === 0 ? 1 : -1) * strikeEnvelope.impact * 0.09;
          g.rotation.z = Math.sin(sim.stateTimer * 17 + fighterSlot) * 0.026 + strikeTilt;
        }
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
          sim.lastImpactAt = nowMs;
        }
        // 2% chance to start scheming when homeless
        if (economicState === 'HOMELESS' && Math.random() < 0.02) {
          sim.state = 'SCHEMING' as AgentState;
          sim.stateTimer = 0;
          sim.stateEndsAt = 3 + Math.random() * 2;
          sim.route = [];
          sim.lastImpactAt = nowMs;
        }
      }

      if (opportunityWindow && sim.opportunityWindowId === opportunityWindow.id && sim.opportunityCommitted) {
        const objectiveAction = OBJECTIVE_ACTIONS[opportunityWindow.kind];
        if (objectiveAction && sim.state === objectiveAction.state) {
          sim.opportunityScore += dt * 0.5;
        }
        const targetPlot = sim.targetPlotId ? plotById.get(sim.targetPlotId) : null;
        if (targetPlot && opportunityWindow.objective.targetZones.includes(targetPlot.zone)) {
          sim.opportunityScore += dt * 0.12;
        }
      }

      // Handle IDLE state (thinking before next move)
      if (sim.state === 'IDLE') {
        sim.velocity.multiplyScalar(Math.exp(-10 * dt));
        sim.acceleration.set(0, 0, 0);
        if (sim.stateEndsAt <= 0) sim.stateEndsAt = 2 + Math.random() * 3;
        if (sim.stateTimer > sim.stateEndsAt) {
          sim.state = 'WALKING';
          sim.stateEndsAt = -1;
        }
        const g = agentGroupRefs.current.get(a.id);
        if (g) g.position.copy(sim.position);
        continue;
      }

      // Handle BEGGING state
      if (sim.state === 'BEGGING') {
        sim.velocity.multiplyScalar(Math.exp(-10 * dt));
        sim.acceleration.set(0, 0, 0);
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
        sim.velocity.multiplyScalar(Math.exp(-10 * dt));
        sim.acceleration.set(0, 0, 0);
        if (sim.stateEndsAt <= 0) sim.stateEndsAt = 3 + Math.random() * 2;
        if (sim.stateTimer > sim.stateEndsAt) {
          sim.state = 'WALKING';
          sim.stateEndsAt = 0;
        }
        const g = agentGroupRefs.current.get(a.id);
        if (g) {
          g.position.copy(sim.position);
          const scanPhase = (hashToSeed(a.id) % 720) * 0.01;
          const suspiciousYaw = Math.atan2(sim.heading.x, sim.heading.z) + Math.sin(sim.stateTimer * 3 + scanPhase) * 0.28;
          g.rotation.y = dampAngle(g.rotation.y, suspiciousYaw, 8, dt);
        }
        continue;
      }

      // Optional social chatter: heavily throttled and disabled during urgency windows/fights.
      const allowSocialChatter = !opportunityWindow && !activeObjective && (fightingAgentIds?.size ?? 0) === 0;
      if (sim.state === 'WALKING' && !sim.chatPartnerId && allowSocialChatter && Math.random() < 0.2 * dt) {
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
          sim.lastImpactAt = nowMs;
          other.state = 'CHATTING';
          other.chatPartnerId = a.id;
          other.stateTimer = 0;
          other.chatEndsAt = duration;
          other.lastImpactAt = nowMs;
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
                claim_plot: 'CLAIMING',
                start_build: 'BUILDING',
                do_work: 'WORKING',
                complete_build: 'WORKING',
                buy_skill: 'SHOPPING',
                buy_arena: 'TRADING',
                sell_arena: 'TRADING',
                mine: 'MINING',
                play_arena: 'FIGHTING',
              };
              const newState = stateMap[actionType];
              if (newState && sim.state === 'WALKING') {
                sim.state = newState;
                sim.targetPlotId = plots.find(p => p.plotIndex === targetPlotIdx)?.id || null;
                sim.stateTimer = 0;
                sim.stateEndsAt = 4 + Math.random() * 4;
                sim.route = [];
                sim.lastImpactAt = nowMs;
              }
            }
          }
        } else if (!targetPlotIdx && sim.route.length === 0) {
          // No target plot — actions like mine, rest happen in-place
          const inPlaceActions: Record<string, AgentState> = {
            mine: 'MINING',
            rest: 'IDLE',
            buy_arena: 'TRADING',
            sell_arena: 'TRADING',
            play_arena: 'FIGHTING',
          };
          const newState = inPlaceActions[actionType];
          if (newState) {
            sim.state = newState as AgentState;
            sim.stateTimer = 0;
            sim.stateEndsAt = 3 + Math.random() * 3;
            sim.route = [];
            sim.lastImpactAt = nowMs;
          }
        }
      }

      // Handle CHATTING state
      if (sim.state === 'CHATTING') {
        sim.velocity.multiplyScalar(Math.exp(-12 * dt));
        sim.acceleration.set(0, 0, 0);
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
            const targetYaw = Math.atan2(sim.heading.x, sim.heading.z);
            g.rotation.y = dampAngle(g.rotation.y, targetYaw, 11, dt);
          }
        }
        continue;
      }

      // Handle CLAIMING state
      if (sim.state === 'CLAIMING') {
        sim.velocity.multiplyScalar(Math.exp(-12 * dt));
        sim.acceleration.set(0, 0, 0);
        if (sim.stateEndsAt <= 0) sim.stateEndsAt = 1.8 + Math.random() * 1.4;
        if (sim.stateTimer > sim.stateEndsAt) {
          sim.state = 'WALKING';
          sim.stateEndsAt = 0;
          sim.targetPlotId = null;
        }
        const g = agentGroupRefs.current.get(a.id);
        if (g) {
          g.position.copy(sim.position);
          g.position.y = 0.02 + Math.sin(sim.stateTimer * 12) * 0.05;
          g.rotation.y += dt * 0.8;
        }
        continue;
      }

      // Handle SHOPPING state
      if (sim.state === 'SHOPPING') {
        sim.velocity.multiplyScalar(Math.exp(-12 * dt));
        sim.acceleration.set(0, 0, 0);
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

      // Handle TRADING state
      if (sim.state === 'TRADING') {
        sim.velocity.multiplyScalar(Math.exp(-12 * dt));
        sim.acceleration.set(0, 0, 0);
        if (sim.stateEndsAt <= 0) sim.stateEndsAt = 2.6 + Math.random() * 2.2;
        if (sim.stateTimer > sim.stateEndsAt) {
          sim.state = 'WALKING';
          sim.stateEndsAt = 0;
          sim.targetPlotId = null;
        }
        const g = agentGroupRefs.current.get(a.id);
        if (g) {
          g.position.copy(sim.position);
          g.position.x += Math.sin(sim.stateTimer * 9) * 0.04;
          g.rotation.y += dt * (0.9 + Math.sin(sim.stateTimer * 3) * 0.2);
        }
        continue;
      }

      // Handle BUILDING state
      if (sim.state === 'BUILDING') {
        sim.velocity.multiplyScalar(Math.exp(-12 * dt));
        sim.acceleration.set(0, 0, 0);
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

      // Handle WORKING state
      if (sim.state === 'WORKING') {
        sim.velocity.multiplyScalar(Math.exp(-12 * dt));
        sim.acceleration.set(0, 0, 0);
        if (sim.stateEndsAt <= 0) sim.stateEndsAt = 3.2 + Math.random() * 2.4;
        if (sim.stateTimer > sim.stateEndsAt) {
          sim.state = 'WALKING';
          sim.stateEndsAt = 0;
          sim.targetPlotId = null;
        }
        const g = agentGroupRefs.current.get(a.id);
        if (g) {
          g.position.copy(sim.position);
          g.position.y = 0.02 + Math.sin(sim.stateTimer * 13) * 0.08;
          g.rotation.y += Math.sin(sim.stateTimer * 7) * 0.004;
        }
        continue;
      }

      // Handle MINING state
      if (sim.state === 'MINING') {
        sim.velocity.multiplyScalar(Math.exp(-12 * dt));
        sim.acceleration.set(0, 0, 0);
        if (sim.stateEndsAt <= 0) sim.stateEndsAt = 3 + Math.random() * 2;
        if (sim.stateTimer > sim.stateEndsAt) { // Mine for 3-5 seconds
          sim.state = 'WALKING';
          sim.stateEndsAt = 0;
          sim.targetPlotId = null;
        }
        // Stay still while mining with a shake effect
        const g = agentGroupRefs.current.get(a.id);
        if (g) {
          g.position.copy(sim.position);
          g.position.x += Math.sin(sim.stateTimer * 20) * 0.05;
        }
        continue;
      }

      // Handle FIGHTING state (duel stance, faster spin)
      if (sim.state === 'FIGHTING') {
        sim.velocity.multiplyScalar(Math.exp(-12 * dt));
        sim.acceleration.set(0, 0, 0);
        if (sim.stateEndsAt <= 0) sim.stateEndsAt = 3.5 + Math.random() * 2.8;
        if (sim.stateTimer > sim.stateEndsAt) {
          sim.state = 'WALKING';
          sim.stateEndsAt = 0;
          sim.targetPlotId = null;
        }
        const g = agentGroupRefs.current.get(a.id);
        if (g) {
          g.position.copy(sim.position);
          g.position.y = 0.02 + Math.sin(sim.stateTimer * 10) * 0.06;
          g.rotation.y += dt * (3.4 + Math.sin(sim.stateTimer * 8) * 0.4);
        }
        continue;
      }

      // Handle PLAYING state (arena games)
      if (sim.state === 'PLAYING') {
        sim.velocity.multiplyScalar(Math.exp(-12 * dt));
        sim.acceleration.set(0, 0, 0);
        if (sim.stateEndsAt <= 0) sim.stateEndsAt = 5 + Math.random() * 5;
        if (sim.stateTimer > sim.stateEndsAt) { // Play for 5-10 seconds
          sim.state = 'WALKING';
          sim.stateEndsAt = 0;
          sim.targetPlotId = null;
        }
        // Spin in place while playing
        const g = agentGroupRefs.current.get(a.id);
        if (g) {
          g.position.copy(sim.position);
          g.rotation.y += dt * (2.1 + Math.sin(sim.stateTimer * 2.7) * 0.28);
        }
        continue;
      }

      // WALKING behavior — think → walk → stop → think cycle
      if (sim.route.length === 0) {
        // Just arrived at destination: stop and "think" before moving again
        if (sim.state === 'WALKING' && sim.stateEndsAt === 0) {
          if (sim.targetPlotId === ARENA_SPECTATOR_TARGET_ID) {
            sim.state = 'PLAYING';
            sim.stateTimer = 0;
            sim.stateEndsAt = 4 + Math.random() * 6;
            sim.targetPlotId = null;
            sim.route = [];
            sim.lastImpactAt = nowMs;
            const g = agentGroupRefs.current.get(a.id);
            if (g) g.position.copy(sim.position);
            continue;
          }

          const arrivedPlot = sim.targetPlotId ? plotById.get(sim.targetPlotId) : null;
          if (arrivedPlot && activeObjective && activeObjective.targetZones.includes(arrivedPlot.zone)) {
            const objectiveAction = OBJECTIVE_ACTIONS[activeObjective.kind];
            if (objectiveAction && Math.random() < objectiveAction.chance) {
              sim.state = objectiveAction.state;
              sim.stateTimer = 0;
              sim.stateEndsAt = objectiveAction.min + Math.random() * (objectiveAction.max - objectiveAction.min);
              sim.route = [];
              sim.lastImpactAt = nowMs;
              if (opportunityWindow && sim.opportunityWindowId === opportunityWindow.id) {
                sim.opportunityCommitted = true;
                sim.opportunityScore += 1.25;
              }
              const g = agentGroupRefs.current.get(a.id);
              if (g) g.position.copy(sim.position);
              continue;
            }
          }
          if (arrivedPlot) {
            const action = ZONE_ARRIVAL_ACTIONS[arrivedPlot.zone];
            if (action && Math.random() < action.chance) {
              sim.state = action.state;
              sim.stateTimer = 0;
              sim.stateEndsAt = action.min + Math.random() * (action.max - action.min);
              sim.route = [];
              sim.lastImpactAt = nowMs;
              const g = agentGroupRefs.current.get(a.id);
              if (g) g.position.copy(sim.position);
              continue;
            }
          }

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
        const isFightActive = (fightingAgentIds?.size ?? 0) > 0;

        // Priority 1: Backend-driven target plot
        if (!pickedTarget && hasRecentAction && a.lastTargetPlot != null) {
          const entrance = getBuildingEntrance(a.lastTargetPlot);
          if (entrance && sim.position.distanceTo(entrance) > 2.5) {
            sim.targetPlotId = plots.find(p => p.plotIndex === a.lastTargetPlot)?.id || null;
            sim.route = buildRoute(sim.position, entrance);
            pickedTarget = true;
          }
        }

        // Urgency objective routing pulls agents into active opportunity clusters.
        const objectiveRouteChance = opportunityWindow ? 0.9 : 0.72;
        if (!pickedTarget && activeObjective && objectivePlots.length > 0 && roll < objectiveRouteChance) {
          let targetPlot: Plot | null = null;
          let bestDist = Number.POSITIVE_INFINITY;
          for (const plot of objectivePlots) {
            const entrance = getBuildingEntrance(plot.plotIndex);
            const dist = sim.position.distanceTo(entrance);
            if (dist < bestDist) {
              bestDist = dist;
              targetPlot = plot;
            }
          }
          if (targetPlot) {
            const entrance = getBuildingEntrance(targetPlot.plotIndex);
            sim.targetPlotId = targetPlot.id;
            sim.route = buildRoute(sim.position, entrance);
            if (opportunityWindow && sim.opportunityWindowId === opportunityWindow.id) {
              sim.opportunityCommitted = true;
              sim.opportunityScore += 0.45;
            }
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

        // During fights, some agents crowd around arena to spectate.
        if (!pickedTarget && isFightActive && !fightingAgentIds?.has(a.id) && roll < (activeObjective?.kind === 'ARENA' ? 0.62 : 0.38)) {
          const slotSeed = hashToSeed(`${a.id}:arena-watch-slot`);
          const slotCount = 24;
          const slot = slotSeed % slotCount;
          const angle = (slot / slotCount) * Math.PI * 2;
          const radiusJitter = ((slotSeed >>> 8) % 1000) / 1000;
          const radius = 11 + radiusJitter * 4.5;
          const arenaWatchPoint = new THREE.Vector3(Math.cos(angle) * radius, 0.02, Math.sin(angle) * radius);
          sim.targetPlotId = ARENA_SPECTATOR_TARGET_ID;
          if (sim.position.distanceToSquared(arenaWatchPoint) < 1.5 * 1.5) {
            sim.route = [];
            sim.state = 'PLAYING';
            sim.stateTimer = 0;
            sim.stateEndsAt = 4 + Math.random() * 6;
            sim.lastImpactAt = nowMs;
          } else {
            sim.route = buildRoute(sim.position, arenaWatchPoint);
          }
          pickedTarget = true;
        }

        // 42% chance: head to a building and trigger a zone-specific action on arrival.
        if (!pickedTarget && builtPlots.length > 0 && roll < 0.62) {
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

      stepAgentAlongRoute(a.id, sim, sims, dt);
      sim.walk += dt * Math.max(0.3, sim.velocity.length() * 2.2);

      if (enforceBuildingExclusion(sim, buildingAABBs) && sim.route.length > 0) {
        sim.route = [];
      }

      const g = agentGroupRefs.current.get(a.id);
      if (g) {
        g.position.copy(sim.position);
        const targetYaw = Math.atan2(sim.heading.x, sim.heading.z);
        g.rotation.y = dampAngle(g.rotation.y, targetYaw, 14, dt);
      }
    }

    if (pendingArenaBursts.length > 0) {
      setArenaImpactBursts((prev) => [...prev, ...pendingArenaBursts].slice(-ARENA_IMPACT_BURST_CAP));
    }

      const simList = Array.from(sims.values()).filter((s) => s.state !== 'DEAD');
      resolveAgentSeparation(simList);

      // Apply corrected positions to rendered groups while preserving any state-specific offsets (shake/bob).
      for (const sim of simList) {
        const g = agentGroupRefs.current.get(sim.id);
        if (!g) continue;
        const dx = g.position.x - sim.position.x;
        const dz = g.position.z - sim.position.z;
        g.position.x = sim.position.x + dx;
        g.position.z = sim.position.z + dz;
      }

      focusSnapTimerRef.current = Math.max(0, focusSnapTimerRef.current - dt);
      cameraShakeRef.current = Math.max(0, cameraShakeRef.current - dt * 1.8);
      const elapsed = nowMs * 0.001;
      const isFightActive = (fightingAgentIds?.size ?? 0) > 0;
      const beatRemainingMs = Math.max(0, arenaBeatRef.current.activeUntilMs - nowMs);
      const beatLife = beatRemainingMs > 0 ? beatRemainingMs / ARENA_BEAT_LIFE_MS : 0;
      const beatStrength = beatLife > 0 ? arenaBeatRef.current.strength * beatLife : 0;
      const cinePulse = arenaCameraPulseRef.current;
      const cineRemainingMs = Math.max(0, cinePulse.activeUntilMs - nowMs);
      const cineAgeMs = nowMs - cinePulse.startedAtMs;
      const cineEnvelope = getArenaCineEnvelope(cineAgeMs);
      const cineLife = cineRemainingMs > 0 ? cineRemainingMs / ARENA_CAMERA_CINE_LIFE_MS : 0;
      const cineStrength = cineLife > 0 ? cinePulse.strength * (0.45 + cineLife * 0.55) : 0;
      const cineActive = cineStrength > 0.01;

      // Third-person camera locked behind followed agent
      if (selectedAgentId) {
        const sim = sims.get(selectedAgentId);
        if (sim) {
          if (visualSettings.cameraShake && nowMs - sim.lastImpactAt < 140) {
            cameraShakeRef.current = Math.min(0.6, cameraShakeRef.current + 0.035);
          }
          updateFollowCamera({
            camera,
            sim,
            dt,
            timeSeconds: nowMs * 0.001,
            intro: introRef.current,
            focusSnapTimer: focusSnapTimerRef.current,
            visualQuality,
            cameraVelocity: cameraVelocityRef.current,
            lookTarget: lookTargetRef.current,
            shakeStrength: visualSettings.cameraShake ? cameraShakeRef.current : 0,
          });
          if (cineActive && cinePulse.focusAgentId === selectedAgentId) {
            const impactViewDir = new THREE.Vector3();
            camera.getWorldDirection(impactViewDir);
            const punchIn = (cineEnvelope.windup * 0.22 + cineEnvelope.impact * 0.8 - cineEnvelope.recover * 0.22) * cineStrength;
            camera.position.addScaledVector(impactViewDir, punchIn);
            camera.position.y += (cineEnvelope.windup * 0.18 + cineEnvelope.impact * 0.34) * cineStrength;
            const lookKick = new THREE.Vector3(
              cinePulse.direction * (0.85 * cineEnvelope.impact + 0.3 * cineEnvelope.windup) * cineStrength,
              (0.22 * cineEnvelope.impact + 0.08 * cineEnvelope.recover) * cineStrength,
              0,
            );
            const cinematicLookTarget = lookTargetRef.current.clone().add(lookKick);
            camera.lookAt(cinematicLookTarget);
            lookTargetRef.current.lerp(cinematicLookTarget, 0.35);
            const perspectiveCamera = camera as THREE.PerspectiveCamera;
            if (typeof perspectiveCamera.fov === 'number') {
              const kickFov = perspectiveCamera.fov - (cineEnvelope.windup * 1.2 + cineEnvelope.impact * 2.8) * cineStrength;
              const nextFov = THREE.MathUtils.clamp(kickFov, 36, 75);
              if (Math.abs(nextFov - perspectiveCamera.fov) > 0.015) {
                perspectiveCamera.fov = nextFov;
                perspectiveCamera.updateProjectionMatrix();
              }
            }
          }
          let latestActionBurst: ActionBurst | null = null;
          for (let index = actionBursts.length - 1; index >= 0; index--) {
            const burst = actionBursts[index];
            if (burst.agentId === selectedAgentId) {
              latestActionBurst = burst;
              break;
            }
          }
          if (latestActionBurst) {
            const actionAgeMs = nowMs - latestActionBurst.createdAt;
            const actionWindow = ACTION_BURST_LIFE_MS * 0.42;
            if (actionAgeMs >= 0 && actionAgeMs <= actionWindow) {
              const hitLife = 1 - actionAgeMs / actionWindow;
              const kindBoost =
                latestActionBurst.kind === 'FIGHT'
                  ? 1.35
                  : latestActionBurst.kind === 'TRADE'
                    ? 1.18
                    : latestActionBurst.kind === 'BUILD' || latestActionBurst.kind === 'WORK'
                      ? 1.12
                      : 1;
              const hitStrength = THREE.MathUtils.clamp(hitLife * latestActionBurst.intensity * 0.055 * kindBoost, 0, 0.22);
              const actionViewDir = new THREE.Vector3();
              camera.getWorldDirection(actionViewDir);
              camera.position.addScaledVector(actionViewDir, hitStrength);
              camera.position.y += hitStrength * 0.22;
              lookTargetRef.current.y += hitStrength * 0.65;
              if (visualSettings.cameraShake) {
                cameraShakeRef.current = Math.min(0.7, cameraShakeRef.current + hitStrength * 0.55);
              }
            }
          }

          const camPos = camera.position;
          const simHeading = sim.heading.lengthSq() > 0.0001
            ? sim.heading.clone().normalize()
            : new THREE.Vector3(0, 0, 1);
          const safeLookTarget = sim.position
            .clone()
            .add(new THREE.Vector3(0, 2.6, 0))
            .add(simHeading.clone().multiplyScalar(6));
          const toTarget = safeLookTarget.clone().sub(camPos);
          const viewDir = new THREE.Vector3();
          camera.getWorldDirection(viewDir);
          const lookingAway = toTarget.lengthSq() > 0.001 ? viewDir.dot(toTarget.normalize()) < -0.35 : false;

          let insideBuilding = false;
          for (const bb of buildingAABBs) {
            if (camPos.x > bb.minX && camPos.x < bb.maxX && camPos.z > bb.minZ && camPos.z < bb.maxZ && camPos.y < 22) {
              insideBuilding = true;
              break;
            }
          }

          const invalidCamera =
            !Number.isFinite(camPos.x) ||
            !Number.isFinite(camPos.y) ||
            !Number.isFinite(camPos.z) ||
            camPos.distanceToSquared(sim.position) > 90 * 90 ||
            camPos.y < 1.8 ||
            camPos.y > 24 ||
            lookingAway ||
            insideBuilding;

          if (invalidCamera) {
            const recoveryPos = sim.position
              .clone()
              .add(simHeading.clone().multiplyScalar(-14))
              .add(new THREE.Vector3(0, 8, 0));
            camera.position.copy(recoveryPos);
            camera.lookAt(safeLookTarget);
            lookTargetRef.current.copy(safeLookTarget);
            cameraVelocityRef.current.set(0, 0, 0);
            focusSnapTimerRef.current = Math.max(focusSnapTimerRef.current, 0.4);
            introRef.current.active = false;
          }
        } else {
          const fallbackPos = new THREE.Vector3(50, 55, 50);
          camera.position.lerp(fallbackPos, Math.min(1, dt * 4));
          camera.lookAt(new THREE.Vector3(0, 0, 0));
          lookTargetRef.current.set(0, 0, 0);
        }
      } else if (isFightActive || beatStrength > 0.05 || cineActive) {
        // Arena cinematic sweep when no agent is selected: orbit active fights and pulse post-fight payoffs.
        const focusGroup = cinePulse.focusAgentId ? agentGroupRefs.current.get(cinePulse.focusAgentId) : null;
        const baseLookTarget = new THREE.Vector3(0, 3.2 + beatStrength * 0.35, 0);
        const focusLookTarget = focusGroup
          ? focusGroup.position.clone().add(new THREE.Vector3(0, 2.8, 0))
          : baseLookTarget;
        const lookTarget = baseLookTarget.lerp(focusLookTarget, cineActive ? 0.58 : 0);
        const orbitSpeed = (isFightActive ? 0.34 : 0.18) + cineStrength * (0.22 + cineEnvelope.impact * 0.72);
        arenaCineAngleRef.current += dt * orbitSpeed * (cineActive ? cinePulse.direction : 1);
        const orbitRadius = Math.max(
          21.5,
          (isFightActive ? 31 : 35)
            - beatStrength * 4.5
            - cineStrength * (2.4 * cineEnvelope.windup + 5.6 * cineEnvelope.impact - 1.2 * cineEnvelope.recover),
        );
        const orbitHeight = 14
          + Math.sin(elapsed * 0.9) * 0.8
          + beatStrength * 2.4
          + cineStrength * (1.3 * cineEnvelope.impact + 0.7 * cineEnvelope.recover);
        const targetPos = new THREE.Vector3(
          lookTarget.x + Math.cos(arenaCineAngleRef.current) * orbitRadius,
          orbitHeight,
          lookTarget.z + Math.sin(arenaCineAngleRef.current) * orbitRadius,
        );
        lookTarget.y += cineStrength * (0.22 * cineEnvelope.windup + 0.75 * cineEnvelope.impact);
        lookTarget.x += cinePulse.direction * cineStrength * (0.65 * cineEnvelope.impact - 0.15 * cineEnvelope.recover);
        const cameraSnap = (isFightActive ? 2.1 : 1.4) + cineEnvelope.impact * 0.55;
        camera.position.lerp(targetPos, Math.min(1, dt * cameraSnap));
        if (visualSettings.cameraShake && (beatStrength > 0.08 || cineEnvelope.impact > 0.05)) {
          const jitter = (cameraShakeRef.current + beatStrength * 0.14 + cineStrength * (0.08 + cineEnvelope.impact * 0.2)) * 0.08;
          camera.position.x += (Math.random() - 0.5) * jitter;
          camera.position.y += (Math.random() - 0.5) * jitter * 0.45;
          camera.position.z += (Math.random() - 0.5) * jitter;
        }
        camera.lookAt(lookTarget);
        lookTargetRef.current.copy(lookTarget);
        const perspectiveCamera = camera as THREE.PerspectiveCamera;
        if (typeof perspectiveCamera.fov === 'number') {
          const targetFov = THREE.MathUtils.clamp(
            46 - cineStrength * (2.2 * cineEnvelope.impact + 1.1 * cineEnvelope.windup) + beatStrength * 1.1,
            39,
            56,
          );
          const nextFov = THREE.MathUtils.damp(perspectiveCamera.fov, targetFov, 6.4, dt);
          if (Math.abs(nextFov - perspectiveCamera.fov) > 0.015) {
            perspectiveCamera.fov = nextFov;
            perspectiveCamera.updateProjectionMatrix();
          }
        }
      }

      if (arenaRingRef.current) {
        arenaRingRef.current.rotation.y += dt * (0.35 + (isFightActive ? 0.9 : 0) + beatStrength * 1.15);
        const ringMaterial = arenaRingRef.current.material as THREE.MeshStandardMaterial;
        const beatPulse = beatStrength > 0 ? (0.45 + Math.sin(elapsed * 16.5) * 0.25) * beatStrength : 0;
        const targetIntensity = 0.45 + Math.sin(elapsed * (2.2 + (isFightActive ? 3.6 : 0))) * 0.12 + (isFightActive ? 0.5 : 0) + beatPulse;
        ringMaterial.emissiveIntensity = THREE.MathUtils.lerp(ringMaterial.emissiveIntensity, targetIntensity, 0.16);
      }
      if (arenaShockwaveRef.current) {
        const shockMaterial = arenaShockwaveRef.current.material as THREE.MeshBasicMaterial;
        const pulse = (Math.sin(elapsed * (isFightActive ? 14.5 : 8.2)) + 1) * 0.5;
        const scale = 1 + pulse * (isFightActive ? 1.4 : 0.8) + beatStrength * 2.6;
        arenaShockwaveRef.current.visible = isFightActive || beatStrength > 0.04;
        arenaShockwaveRef.current.scale.set(scale, scale, 1);
        shockMaterial.opacity = THREE.MathUtils.clamp((isFightActive ? 0.08 : 0.02) + beatStrength * 0.34 + pulse * 0.09, 0, 0.4);
      }
      if (arenaSlashRingRef.current) {
        const slashMaterial = arenaSlashRingRef.current.material as THREE.MeshStandardMaterial;
        arenaSlashRingRef.current.rotation.z += dt * (isFightActive ? 1.8 : 0.9);
        const slashScale = 1 + beatStrength * 0.45 + (isFightActive ? 0.16 : 0);
        arenaSlashRingRef.current.scale.set(slashScale, slashScale, 1);
        slashMaterial.opacity = THREE.MathUtils.clamp(0.2 + beatStrength * 0.38 + (isFightActive ? 0.22 : 0), 0, 0.74);
        slashMaterial.emissiveIntensity = THREE.MathUtils.clamp(0.6 + beatStrength * 1.2 + (isFightActive ? 0.7 : 0), 0.3, 2.2);
      }
      if (arenaDomeRef.current) {
        const domeMaterial = arenaDomeRef.current.material as THREE.MeshStandardMaterial;
        const targetOpacity = 0.56 + Math.sin(elapsed * 1.8) * 0.035 + (isFightActive ? 0.08 : 0) + beatStrength * 0.11;
        domeMaterial.opacity = THREE.MathUtils.lerp(domeMaterial.opacity, targetOpacity, 0.12);
      }
      if (arenaCoreLightRef.current) {
        const fightBoost = isFightActive ? 2.35 + Math.sin(elapsed * 10.5) * 0.5 : 0;
        const beatBoost = beatStrength > 0 ? beatStrength * (2.8 + Math.sin(elapsed * 14.2) * 0.65) : 0;
        const targetIntensity = 0.45 + Math.sin(elapsed * 2.4) * 0.12 + fightBoost + beatBoost;
        arenaCoreLightRef.current.intensity = THREE.MathUtils.lerp(arenaCoreLightRef.current.intensity, targetIntensity, 0.18);
        arenaCoreLightRef.current.distance = 12 + (isFightActive ? 6 : 0) + beatStrength * 5;
      }
  });

  const sceneAgents = useMemo(
    () => agents,
    [agents],
  );
  const navigationAgents = useMemo(
    () => agents.filter((a) => !fightingAgentIds?.has(a.id)),
    [agents, fightingAgentIds],
  );
  const destinationLineAgents = useMemo(
    () => navigationAgents.slice(0, visualProfile.destinationLineAgentLimit),
    [navigationAgents, visualProfile.destinationLineAgentLimit],
  );
  const trailAgents = useMemo(
    () => navigationAgents.slice(0, visualProfile.trailAgentLimit),
    [navigationAgents, visualProfile.trailAgentLimit],
  );
  const visibleCoinBursts = useMemo(
    () => coinBursts.slice(-visualProfile.maxTransientEffects),
    [coinBursts, visualProfile.maxTransientEffects],
  );
  const visibleDeathEffects = useMemo(
    () => deathEffects.slice(-visualProfile.maxTransientEffects),
    [deathEffects, visualProfile.maxTransientEffects],
  );
  const visibleSpawnEffects = useMemo(
    () => spawnEffects.slice(-visualProfile.maxTransientEffects),
    [spawnEffects, visualProfile.maxTransientEffects],
  );

  return (
    <group>
      <color attach="background" args={['#050914']} />
      <Suspense fallback={null}>
        <LazyWorldFxLayer
          weather={weather}
          economicState={economicState}
          visualProfile={visualProfile}
          visualQuality={visualQuality}
          postFxEnabled={visualSettings.postFx}
          coinBursts={visibleCoinBursts}
          deathEffects={visibleDeathEffects}
          spawnEffects={visibleSpawnEffects}
          onCoinBurstComplete={(id) => setCoinBursts((prev) => prev.filter((burst) => burst.id !== id))}
          onDeathEffectComplete={(id) => setDeathEffects((prev) => prev.filter((effect) => effect.id !== id))}
          onSpawnEffectComplete={(id) => setSpawnEffects((prev) => prev.filter((effect) => effect.id !== id))}
        />
      </Suspense>

      <fog
        attach="fog"
        args={[
          weather === 'storm' ? '#2a3545' : weather === 'rain' ? '#3a4a5a' : '#7a9ab0',
          weather === 'storm' ? 60 : weather === 'rain' ? 100 : 120,
          (weather === 'storm' ? 250 : weather === 'rain' ? 350 : 500) * fogScale,
        ]}
      />

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
      {streetLightPositions.length > 0 && (
        <StreetLights key={`streetlights-${streetLightPositions.length}`} positions={streetLightPositions} />
      )}

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
        const ownerCrew = p.ownerId ? agentCrewById[p.ownerId] ?? null : null;
        const { color, emissive } = zoneMaterial(p.zone, selected, ownerCrew?.colorHex);
        const name = p.buildingName?.trim() || (p.status === 'EMPTY' ? 'Available' : p.status.replace(/_/g, ' '));

        return (
          <group key={p.id}>
            {ownerCrew && p.status !== 'EMPTY' && (
              <CrewTerritoryPulse
                position={[wx, 0, wz]}
                color={ownerCrew.colorHex}
                seed={hashToSeed(`${p.id}:${ownerCrew.crewId}`)}
              />
            )}
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
              <ClaimedMarker
                position={[wx + 6.5, 0, wz + 6.5]}
                color={ownerCrew?.colorHex || ZONE_COLORS[p.zone]}
              />
            )}

            {(p.status === 'UNDER_CONSTRUCTION' || p.status === 'BUILT') && (
              <BuildingMesh plot={p} selected={selected} position={[wx, 0.06, wz]} />
            )}

            <BillboardLabel
              text={name.length > 18 ? `${name.slice(0, 18)}…` : name}
              position={[wx, 3.6, wz]}
              color={selected ? '#e2e8f0' : ownerCrew?.colorHex || '#cbd5e1'}
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
	        <mesh ref={arenaDomeRef} position={[0, 3.5, 0]} castShadow>
	          <sphereGeometry args={[5, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
	          <meshStandardMaterial color="#16213e" transparent opacity={0.6} metalness={0.8} roughness={0.2} side={THREE.DoubleSide} />
	        </mesh>
	        {/* Arena ring */}
	        <mesh ref={arenaRingRef} position={[0, 0.4, 0]}>
	          <torusGeometry args={[7.5, 0.15, 8, 48]} />
	          <meshStandardMaterial color="#e94560" emissive="#e94560" emissiveIntensity={0.5} />
	        </mesh>
          <mesh ref={arenaShockwaveRef} position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[7.8, 10.2, 56]} />
            <meshBasicMaterial color="#fb7185" transparent opacity={0.16} depthWrite={false} />
          </mesh>
          <mesh ref={arenaSlashRingRef} position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[6.2, 0.08, 10, 56]} />
            <meshStandardMaterial
              color="#fecdd3"
              emissive="#f43f5e"
              emissiveIntensity={0.8}
              transparent
              opacity={0.34}
              roughness={0.2}
              metalness={0.42}
              depthWrite={false}
            />
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
	        <pointLight ref={arenaCoreLightRef} position={[0, 4, 0]} color="#e94560" intensity={0.45} distance={12} />
	      </group>
      <ArenaDuelBeam fighterIds={arenaFighterIds} simsRef={simsRef} active={arenaFighterIds.length >= 2} />
      <ArenaImpactBursts bursts={arenaImpactBursts} />
      <ActionBursts bursts={actionBursts} />
      <OwnedLoopAura ownedAgentId={ownedAgentId} loopTelemetry={ownedLoopTelemetry} simsRef={simsRef} />

        {objectiveBeacon && (
          <ObjectiveBeacon
            position={objectiveBeacon.position}
            color={objectiveBeacon.color}
            label={objectiveBeacon.label}
          />
        )}

	      {/* Agents */}
	      <group>
	        {sceneAgents.map((a) => {
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
	          const arenaOutcome = arenaOutcomeByAgentId[a.id] ?? null;
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
                  arenaOutcome={arenaOutcome}
                  duelMomentum={Math.max(1, Math.abs(arenaMomentumByAgentId[a.id] || 1))}
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
      {destinationLineAgents.map((a) => (
        <DestinationLine
          key={`line-${a.id}`}
          agentId={a.id}
          simsRef={simsRef}
          color={ARCHETYPE_COLORS[a.archetype] || '#93c5fd'}
        />
      ))}

      {/* Agent trails */}
      {trailAgents.map((a) => (
        <AgentTrail
          key={`trail-${a.id}`}
          agentId={a.id}
          simsRef={simsRef}
          color={ARCHETYPE_COLORS[a.archetype] || '#93c5fd'}
          actionType={a.lastActionType}
          selected={a.id === selectedAgentId}
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

interface ArenaOutcomeToast {
  id: string;
  agentId: string;
  agentName: string;
  archetype: string;
  result: ArenaOutcomeSignal['result'];
  delta: number;
  createdAt: number;
}

interface ArenaMomentumToast {
  id: string;
  agentId: string;
  agentName: string;
  archetype: string;
  direction: 'WIN' | 'LOSS';
  streak: number;
  createdAt: number;
}

interface ArenaImpactFlash {
  id: string;
  tone: 'WIN' | 'LOSS';
  intensity: number;
}

// Preload building GLB models as soon as module is imported
preloadBuildingModels();

export default function Town3D() {
  const isMobile = useIsMobile();
  const [mobilePanel, setMobilePanel] = useState<'none' | 'info' | 'feed' | 'chat' | 'agent' | 'spawn'>('none');
  const [uiMode, setUiMode] = useState<UiMode>(() => {
    const stored = safeTrim(localStorage.getItem(UI_MODE_KEY), 24).toLowerCase();
    return stored === 'pro' ? 'pro' : 'default';
  });
  const [towns, setTowns] = useState<TownSummary[]>([]);
  const [town, setTown] = useState<Town | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentOutcomesById, setAgentOutcomesById] = useState<Record<string, AgentOutcomeEntry[]>>({});
  const [economy, setEconomy] = useState<EconomyPoolSummary | null>(null);
  const [swaps, setSwaps] = useState<EconomySwapRow[]>([]);
  const [events, setEvents] = useState<TownEvent[]>([]);
  const [worldEvents, setWorldEvents] = useState<ActiveWorldEvent[]>([]);
  const [crewWarsStatus, setCrewWarsStatus] = useState<CrewWarsStatusPayload | null>(null);
  const [runtimeAgents, setRuntimeAgents] = useState<RuntimeAgentCard[]>([]);
  const [runtimeCrews, setRuntimeCrews] = useState<RuntimeCrewCard[]>([]);
  const [runtimeBuildings, setRuntimeBuildings] = useState<RuntimeBuildingCard[]>([]);
  const [runtimeFeed, setRuntimeFeed] = useState<RuntimeFeedCard[]>([]);
  const [runtimeTick, setRuntimeTick] = useState(0);
  const [runtimeLoopRunning, setRuntimeLoopRunning] = useState(false);
  const [runtimeLoading, setRuntimeLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swapNotifications, setSwapNotifications] = useState<SwapNotification[]>([]);
  const [arenaOutcomeToasts, setArenaOutcomeToasts] = useState<ArenaOutcomeToast[]>([]);
  const [arenaMomentumToasts, setArenaMomentumToasts] = useState<ArenaMomentumToast[]>([]);
  const [crewBattleToasts, setCrewBattleToasts] = useState<CrewBattleToast[]>([]);
  const [arenaImpactFlash, setArenaImpactFlash] = useState<ArenaImpactFlash | null>(null);
  const [eventNotifications, setEventNotifications] = useState<TownEvent[]>([]);
  const seenSwapIdsRef = useRef<Set<string>>(new Set());
  const seenArenaOutcomeIdsRef = useRef<Set<string>>(new Set());
  const seenArenaMomentumIdsRef = useRef<Set<string>>(new Set());
  const seenCrewBattleIdsRef = useRef<Set<string>>(new Set());
  const swapsPrimedRef = useRef(false);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const seenTradeEventIdsRef = useRef<Set<string>>(new Set());
  const previousAgentBalanceRef = useRef<Map<string, AgentBalanceSnapshot>>(new Map());
  const agentOutcomesByIdRef = useRef<Record<string, AgentOutcomeEntry[]>>({});

  const userSelectedTownIdRef = useRef<string | null>(null);
  const activeTownIdRef = useRef<string | null>(null);
  const [selectedTownId, setSelectedTownId] = useState<string | null>(null);

  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const walletAutoSelectedRef = useRef<string | null>(null);
  const introRef = useRef({ active: true, t: 0 });
  const simsRef = useRef<Map<string, AgentSim>>(new Map());
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboarded());
  const [playerSession, setPlayerSession] = useState<WalletSessionState>({
    ready: !HAS_PRIVY,
    authenticated: false,
    provider: HAS_PRIVY ? 'privy' : 'wallet_fallback',
  });
  const [showMissionTour, setShowMissionTour] = useState(false);
  const [missionTourStep, setMissionTourStep] = useState(0);
  const missionTourShownRef = useRef(false);
  const [aiMode, setAiMode] = useState<'LIVE' | 'SIMULATION'>('SIMULATION');
  useEffect(() => {
    localStorage.setItem(UI_MODE_KEY, uiMode);
  }, [uiMode]);

  // Auto-select user's agent (from onboarding) or fall back to first
  const myAgentId = getMyAgentId();
  useEffect(() => {
    if (!selectedAgentId && agents.length > 0) {
      // Wallet match wins over stored agent id to avoid stale local cache selecting the wrong bot.
      const myWallet = getMyWallet()?.toLowerCase();
      const walletAgent = myWallet
        ? agents.find((a) => a.walletAddress?.toLowerCase() === myWallet)
        : null;
      if (walletAgent) {
        setSelectedAgentId(walletAgent.id);
        localStorage.setItem(MY_AGENT_KEY, walletAgent.id);
      } else {
        const myAgent = myAgentId ? agents.find((a) => a.id === myAgentId) : null;
        setSelectedAgentId(myAgent?.id || agents[0].id);
      }
    }
  }, [agents, selectedAgentId, myAgentId]);

  // When onboarding completes, force-select the user's agent
  useEffect(() => {
    if (!showOnboarding && agents.length > 0) {
      const id = getMyAgentId();
      if (id && agents.find(a => a.id === id)) {
        setSelectedAgentId(id);
      }
    }
  }, [showOnboarding, agents]);

  useEffect(() => {
    if (!selectedAgentId) return;
    if (agents.some((agent) => agent.id === selectedAgentId)) return;
    const myWallet = getMyWallet()?.toLowerCase();
    const walletAgent = myWallet
      ? agents.find((agent) => agent.walletAddress?.toLowerCase() === myWallet)
      : null;
    setSelectedAgentId(walletAgent?.id || agents[0]?.id || null);
  }, [selectedAgentId, agents]);

  // Keep active town id in a ref for interval callbacks
  useEffect(() => {
    activeTownIdRef.current = town?.id ?? null;
  }, [town?.id]);

  // Relationship ref (kept for TownScene prop, but no longer polled)
  type RelEntry = { agentAId: string; agentBId: string; status: string; score: number };
  const relationshipsRef = useRef<RelEntry[]>([]);


  // Trade speech bubbles (kept for 3D display)
  const [tradeByAgentId, setTradeByAgentId] = useState<Record<string, { text: string; until: number; isBuy: boolean }>>({});

  // Clear trade bubbles when switching towns
  useEffect(() => {
    seenTradeEventIdsRef.current = new Set();
    setTradeByAgentId({});
  }, [town?.id]);



  
  
  // Sound toggle
  const [soundOn, setSoundOn] = useState(true);
  const [visualSettings, setVisualSettings] = useState<VisualSettings>(() => loadVisualSettings());
  const [autoDetectedQuality, setAutoDetectedQuality] = useState<ResolvedVisualQuality>('medium');

  // Degen mode state
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  useEffect(() => {
    const wallet = normalizeWalletAddress(walletAddress || getMyWallet());
    if (!wallet) return;

    let cancelled = false;
    const resolveOwnedAgent = async () => {
      try {
        const lookup = await apiFetch<AgentMeLookupResponse>(`/agents/me?wallet=${encodeURIComponent(wallet)}`);
        const resolvedAgentId = typeof lookup.agent?.id === 'string' ? lookup.agent.id : null;
        if (!resolvedAgentId || cancelled) return;

        localStorage.setItem(MY_WALLET_KEY, walletAddress || getMyWallet() || wallet);
        localStorage.setItem(MY_AGENT_KEY, resolvedAgentId);

        setSelectedAgentId((current) => {
          return current === resolvedAgentId ? current : resolvedAgentId;
        });
      } catch {
        // Ignore lookup failures; fallback selection logic handles defaults.
      }
    };

    void resolveOwnedAgent();
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  const normalizedSessionWallet = useMemo(
    () => normalizeWalletAddress(walletAddress || getMyWallet()),
    [walletAddress],
  );
  const ownedAgentId = useMemo(() => {
    const wallet = normalizedSessionWallet;
    if (wallet) {
      const walletAgent = agents.find((agent) => normalizeWalletAddress(agent.walletAddress) === wallet);
      if (walletAgent) return walletAgent.id;
    }
    if (myAgentId && agents.some((agent) => agent.id === myAgentId)) return myAgentId;
    return null;
  }, [normalizedSessionWallet, agents, myAgentId]);
  const isPlayerAuthenticated = useMemo(() => {
    if (!HAS_PRIVY) return Boolean(normalizedSessionWallet);
    return Boolean(playerSession.authenticated && normalizedSessionWallet);
  }, [normalizedSessionWallet, playerSession.authenticated]);
  const actionLockReason = useMemo(() => {
    if (!isPlayerAuthenticated) return 'Sign in to unlock Build/Work/Fight/Trade controls.';
    if (!ownedAgentId) return 'Deploy or select your wallet-linked agent to run the loop.';
    return null;
  }, [isPlayerAuthenticated, ownedAgentId]);
  const buildPlayerHeaders = useCallback((withJson = false): HeadersInit => {
    const headers: Record<string, string> = {};
    if (withJson) headers['Content-Type'] = 'application/json';
    if (isPlayerAuthenticated) headers['x-player-authenticated'] = '1';
    if (normalizedSessionWallet) headers['x-player-wallet'] = normalizedSessionWallet;
    return headers;
  }, [isPlayerAuthenticated, normalizedSessionWallet]);
  const leadingCrew = useMemo(() => crewWarsStatus?.crews?.[0] ?? null, [crewWarsStatus]);
  const ownedCrewLink = useMemo(() => {
    if (!ownedAgentId) return null;
    return crewWarsStatus?.agentCrewById?.[ownedAgentId] ?? null;
  }, [ownedAgentId, crewWarsStatus]);
  const [ownedLoopMode, setOwnedLoopMode] = useState<LoopMode>('DEFAULT');
  const [loopModeUpdating, setLoopModeUpdating] = useState(false);
  const [degenNudgeBusy, setDegenNudgeBusy] = useState(false);
  const [crewOrderBusy, setCrewOrderBusy] = useState(false);
  const [authRequiredForActions, setAuthRequiredForActions] = useState(true);
  const [serverMission, setServerMission] = useState<DegenMission | null>(null);
  const [serverBlocker, setServerBlocker] = useState<DegenBlocker | null>(null);
  const [serverLoopState, setServerLoopState] = useState<DegenLoopStatePayload | null>(null);
  const [serverRecovery, setServerRecovery] = useState<DegenRecovery | null>(null);
  const [degenStatus, setDegenStatus] = useState<{ message: string; tone: 'neutral' | 'ok' | 'error' } | null>(null);
  const [ownedLoopTelemetry, setOwnedLoopTelemetry] = useState<DegenLoopTelemetry | null>(null);
  const [degenPlans, setDegenPlans] = useState<Record<DegenNudge, DegenActionPlan> | null>(null);
  const [degenPlansLoading, setDegenPlansLoading] = useState(false);
  const degenLoopTelemetryByAgentIdRef = useRef<Map<string, DegenLoopTelemetry>>(new Map());
  const degenStatusTimerRef = useRef<number | null>(null);
  const showDegenStatus = useCallback((message: string, tone: 'neutral' | 'ok' | 'error', ttlMs = 2600) => {
    if (degenStatusTimerRef.current != null) {
      window.clearTimeout(degenStatusTimerRef.current);
      degenStatusTimerRef.current = null;
    }
    setDegenStatus({ message, tone });
    if (ttlMs > 0) {
      degenStatusTimerRef.current = window.setTimeout(() => {
        setDegenStatus(null);
        degenStatusTimerRef.current = null;
      }, ttlMs);
    }
  }, []);
  useEffect(() => {
    return () => {
      if (degenStatusTimerRef.current != null) {
        window.clearTimeout(degenStatusTimerRef.current);
      }
    };
  }, []);
  const ensureActionSession = useCallback((contextLabel: string): boolean => {
    if (!isPlayerAuthenticated) {
      showDegenStatus(`Sign in required before ${contextLabel}.`, 'error', 3800);
      setShowOnboarding(true);
      return false;
    }
    if (!ownedAgentId) {
      showDegenStatus('Deploy or select your agent before issuing loop commands.', 'error', 3800);
      setShowOnboarding(true);
      return false;
    }
    return true;
  }, [isPlayerAuthenticated, ownedAgentId, showDegenStatus]);
  useEffect(() => {
    if (!ownedAgentId) {
      setOwnedLoopTelemetry(null);
      return;
    }
    const snapshot = degenLoopTelemetryByAgentIdRef.current.get(ownedAgentId);
    setOwnedLoopTelemetry(snapshot ? { ...snapshot } : { ...EMPTY_DEGEN_LOOP_TELEMETRY });
  }, [ownedAgentId]);
  const refreshDegenPlans = useCallback(async () => {
    if (!ownedAgentId) {
      setDegenPlans(null);
      setServerMission(null);
      setServerBlocker(null);
      setServerLoopState(null);
      setServerRecovery(null);
      return;
    }
    setDegenPlansLoading(true);
    try {
      const response = await fetch(`${API_BASE}/agent-loop/plans/${ownedAgentId}`, {
        headers: buildPlayerHeaders(false),
      });
      if (!response.ok) throw new Error(`Plans request failed (${response.status})`);
      const res = await response.json() as DegenPlanResponse;
      setAuthRequiredForActions(res.authRequiredForActions !== false);
      setServerMission(res.mission || null);
      setServerBlocker(res.blocker || null);
      setServerLoopState(res.loopState || null);
      setServerRecovery(res.recovery || null);
      setDegenPlans(res.plans || null);
    } catch {
      setDegenPlans(null);
      setServerMission(null);
      setServerBlocker(null);
      setServerLoopState(null);
      setServerRecovery(null);
    } finally {
      setDegenPlansLoading(false);
    }
  }, [buildPlayerHeaders, ownedAgentId]);
  useEffect(() => {
    if (!ownedAgentId) {
      setDegenPlans(null);
      setServerMission(null);
      setServerBlocker(null);
      setServerLoopState(null);
      setServerRecovery(null);
      return;
    }
    void refreshDegenPlans();
    const interval = window.setInterval(() => {
      void refreshDegenPlans();
    }, 12000);
    return () => {
      window.clearInterval(interval);
    };
  }, [ownedAgentId, refreshDegenPlans]);
  useEffect(() => {
    if (!ownedAgentId) {
      setOwnedLoopMode('DEFAULT');
      setDegenPlans(null);
      if (degenStatusTimerRef.current != null) {
        window.clearTimeout(degenStatusTimerRef.current);
        degenStatusTimerRef.current = null;
      }
      setDegenStatus(null);
      return;
    }
    let cancelled = false;
    async function loadLoopMode() {
      try {
        const res = await apiFetch<{ mode?: LoopMode }>(`/agent-loop/mode/${ownedAgentId}`);
        if (!cancelled) {
          const mode = res.mode === 'DEGEN_LOOP' ? 'DEGEN_LOOP' : 'DEFAULT';
          setOwnedLoopMode(mode);
        }
      } catch {
        if (!cancelled) setOwnedLoopMode('DEFAULT');
      }
    }
    void loadLoopMode();
    return () => {
      cancelled = true;
    };
  }, [ownedAgentId]);
  const degenGuidance = useMemo(() => {
    const defaultSuccess: Record<DegenNudge, string> = {
      build: 'Infrastructure progresses so future loops unlock more options.',
      work: 'Reserve/build throughput improves and unblocks expensive actions.',
      fight: 'Arena duel resolves for potential upside and momentum.',
      trade: 'Reserve and $ARENA rebalance to keep the next loop solvent.',
    };
    const blockers: Partial<Record<DegenNudge, string>> = {};
    (Object.keys(DEGEN_NUDGE_LABEL) as DegenNudge[]).forEach((step) => {
      const plan = degenPlans?.[step];
      if (plan && !plan.ok) {
        blockers[step] = safeTrim(plan.reason || 'Blocked right now', 96);
      }
    });

    if (!degenPlans) {
      return {
        mission: 'Checking next mission...',
        missionWhy: 'Planner syncing with latest world state.',
        missionBlocked: null as string | null,
        missionFallback: null as string | null,
        missionSuccess: 'Complete the shown step to advance the loop.',
        recommended: null as DegenNudge | null,
        blockers,
      };
    }

    const safeNextIndex = Math.max(
      0,
      Math.min(DEGEN_LOOP_SEQUENCE.length - 1, serverLoopState?.phaseIndex ?? ownedLoopTelemetry?.nextIndex ?? 0),
    );
    const expectedPhase = DEGEN_LOOP_SEQUENCE[safeNextIndex] || 'BUILD';
    const expectedNudge = DEGEN_PHASE_TO_NUDGE[expectedPhase];
    const expectedPlan = degenPlans[expectedNudge];

    let recommended: DegenNudge | null = serverMission?.recommendedAction || null;
    if (expectedPlan?.ok) {
      recommended = recommended || expectedNudge;
    } else {
      for (let i = 1; i < DEGEN_LOOP_SEQUENCE.length; i += 1) {
        const phase = DEGEN_LOOP_SEQUENCE[(safeNextIndex + i) % DEGEN_LOOP_SEQUENCE.length];
        const candidate = DEGEN_PHASE_TO_NUDGE[phase];
        if (degenPlans[candidate]?.ok) {
          recommended = candidate;
          break;
        }
      }
    }

    const expectedLabel = DEGEN_NUDGE_LABEL[expectedNudge];
    const expectedReason = blockers[expectedNudge];
    let missionWhy = serverMission?.reason || `${expectedLabel} is next in loop order.`;
    let missionBlocked = serverBlocker?.message || expectedReason || null;
    const fallbackTarget = serverBlocker?.fallbackAction || null;
    let missionFallback =
      fallbackTarget && fallbackTarget !== expectedNudge
        ? `Auto fallback: ${DEGEN_NUDGE_LABEL[fallbackTarget]} (${serverBlocker?.code || 'REDIRECT'}).`
        : fallbackTarget
          ? `Auto fallback stays on ${DEGEN_NUDGE_LABEL[fallbackTarget]}.`
          : missionBlocked
            ? 'Auto-redirect triggers when another step is executable.'
            : null;
    let missionSuccess = serverMission?.successOutcome || (recommended ? defaultSuccess[recommended] : defaultSuccess[expectedNudge]);
    let mission = recommended
      ? `Do ${DEGEN_NUDGE_LABEL[recommended]} next.`
      : `No executable step right now.`;

    if (recommended && recommended !== expectedNudge) {
      mission = `${expectedLabel} blocked${expectedReason ? `: ${expectedReason}` : ''}. Do ${DEGEN_NUDGE_LABEL[recommended]} now.`;
      if (!missionFallback) {
        missionFallback = `Auto fallback: ${DEGEN_NUDGE_LABEL[recommended]}.`;
      }
    } else if (!recommended) {
      mission = `${expectedLabel} blocked${expectedReason ? `: ${expectedReason}` : ''}.`;
      missionSuccess = defaultSuccess[expectedNudge];
    } else if (ownedLoopMode !== 'DEGEN_LOOP') {
      mission = `Manual mode. Suggested next: ${DEGEN_NUDGE_LABEL[recommended]}.`;
      missionWhy = `${missionWhy} AUTO is off, so execute manually or toggle AUTO ON.`;
    }

    if (serverMission?.recommendedAction) {
      mission = `Do ${DEGEN_NUDGE_LABEL[serverMission.recommendedAction]} now.`;
      missionSuccess = serverMission.successOutcome || missionSuccess;
    }
    if (serverBlocker?.action && serverBlocker.action === expectedNudge && serverBlocker.fallbackAction) {
      mission = `${expectedLabel} blocked: ${serverBlocker.message}. Do ${DEGEN_NUDGE_LABEL[serverBlocker.fallbackAction]} now.`;
    }
    if (serverRecovery && serverRecovery.tier !== 'NONE') {
      missionWhy = `${missionWhy} ${serverRecovery.message}`;
      if (serverRecovery.nextBest) {
        missionFallback = `Recovery chain: ${serverRecovery.chain.map((step) => DEGEN_NUDGE_LABEL[step]).join(' -> ')}`;
        mission = `Recovery mode: do ${DEGEN_NUDGE_LABEL[serverRecovery.nextBest]} now.`;
        if (serverRecovery.tier === 'CRITICAL') {
          missionSuccess = 'Stabilize bankroll/reserve before re-entering aggressive fights.';
        }
      }
    }

    return {
      mission,
      missionWhy,
      missionBlocked,
      missionFallback,
      missionSuccess,
      recommended,
      blockers,
    };
  }, [degenPlans, ownedLoopMode, ownedLoopTelemetry, serverBlocker, serverLoopState, serverMission, serverRecovery]);
  const updateOwnedLoopMode = useCallback(async (nextMode: LoopMode) => {
    if (!ensureActionSession('toggling AUTO mode')) return;
    setLoopModeUpdating(true);
    showDegenStatus(nextMode === 'DEGEN_LOOP' ? 'Enabling AUTO loop…' : 'Switching to manual mode…', 'neutral');
    try {
      const res = await fetch(`${API_BASE}/agent-loop/mode/${ownedAgentId}`, {
        method: 'POST',
        headers: buildPlayerHeaders(true),
        body: JSON.stringify({ mode: nextMode }),
      });
      const payload = await res.json().catch(() => null) as { mode?: LoopMode; error?: string } | null;
      if (!res.ok) throw new Error(payload?.error || `Mode update failed (${res.status})`);
      const mode = payload?.mode === 'DEGEN_LOOP' ? 'DEGEN_LOOP' : 'DEFAULT';
      setOwnedLoopMode(mode);
      await fetch(`${API_BASE}/agent-loop/tick/${ownedAgentId}`, { method: 'POST' }).catch(() => null);
      showDegenStatus(
        mode === 'DEGEN_LOOP'
          ? 'AUTO loop active (build/work/fight/trade policy).'
          : 'Manual mode active.',
        'ok',
      );
    } catch (err) {
      console.error('[Town3D] Failed to update loop mode', err);
      const reason = err instanceof Error ? err.message : 'Loop mode update failed. Check backend connection.';
      showDegenStatus(reason, 'error', 3400);
    } finally {
      setLoopModeUpdating(false);
    }
  }, [buildPlayerHeaders, ensureActionSession, ownedAgentId, showDegenStatus]);
  const sendDegenNudge = useCallback(async (nudge: DegenNudge) => {
    if (!ensureActionSession(`running ${nudge.toUpperCase()}`)) return;
    if (degenPlansLoading) {
      showDegenStatus('Checking what is executable right now…', 'neutral', 2200);
      return;
    }
    const blocker = degenGuidance.blockers[nudge];
    if (blocker) {
      showDegenStatus(`${nudge.toUpperCase()} blocked: ${blocker}`, 'error', 3600);
      return;
    }
    setDegenNudgeBusy(true);
    showDegenStatus(`Executing ${nudge.toUpperCase()} command…`, 'neutral');
    try {
      const res = await fetch(`${API_BASE}/agent-loop/action/${ownedAgentId}`, {
        method: 'POST',
        headers: buildPlayerHeaders(true),
        body: JSON.stringify({
          action: nudge,
          source: 'town-ui',
        }),
      });
      const payload = await res.json().catch(() => null) as {
        ok?: boolean;
        error?: string;
        code?: string;
        receipt?: {
          status?: 'EXECUTED' | 'REJECTED';
          statusReason?: string;
          executedActionType?: string | null;
        };
        wasRedirected?: boolean;
        redirectReason?: string | null;
        fallbackExecuted?: string | null;
        result?: {
          action?: string;
        };
      } | null;
      const failReason =
        payload?.error
        || payload?.receipt?.statusReason
        || (res.ok ? '' : `Command failed (${res.status})`);
      if (!res.ok || payload?.ok === false) {
        throw new Error(failReason || `${nudge.toUpperCase()} command rejected`);
      }
      if (payload?.receipt?.status === 'REJECTED') {
        throw new Error(payload.receipt.statusReason || `${nudge.toUpperCase()} command rejected`);
      }
      const executedAction =
        payload?.receipt?.executedActionType
        || payload?.result?.action
        || nudge;
      if (payload?.wasRedirected && payload?.fallbackExecuted) {
        showDegenStatus(
          `${nudge.toUpperCase()} redirected to ${String(payload.fallbackExecuted).toUpperCase()}: ${payload.redirectReason || 'constraint fallback'}`,
          'ok',
          4200,
        );
      } else {
        showDegenStatus(
          `${nudge.toUpperCase()} executed as ${String(executedAction).toUpperCase()}.`,
          'ok',
        );
      }
      void refreshDegenPlans();
    } catch (err) {
      console.error('[Town3D] Failed to execute manual action command', err);
      const reason = err instanceof Error ? err.message : `Failed to execute ${nudge.toUpperCase()}`;
      showDegenStatus(reason, 'error', 3600);
      void refreshDegenPlans();
    } finally {
      setDegenNudgeBusy(false);
    }
  }, [buildPlayerHeaders, degenGuidance.blockers, degenPlansLoading, ensureActionSession, ownedAgentId, refreshDegenPlans, showDegenStatus]);
  const sendCrewOrder = useCallback(async (strategy: CrewOrderStrategy) => {
    if (!ensureActionSession(`sending ${strategy} crew order`)) return;
    setCrewOrderBusy(true);
    showDegenStatus(`Dispatching ${strategy} crew order…`, 'neutral');
    try {
      const intensity = strategy === 'RAID' ? 3 : strategy === 'TRADE' ? 1 : 2;
      const res = await fetch(`${API_BASE}/crew-wars/orders`, {
        method: 'POST',
        headers: buildPlayerHeaders(true),
        body: JSON.stringify({
          agentId: ownedAgentId,
          strategy,
          intensity,
          source: 'town-ui',
          immediate: true,
        }),
      });
      const payload = await res.json().catch(() => null) as {
        ok?: boolean;
        error?: string;
        commandStatus?: string;
        commandReceipt?: {
          status?: string;
          statusReason?: string;
          executedActionType?: string | null;
        };
        tickResult?: {
          action?: string;
        };
        campaignImpact?: {
          objective?: string | null;
        };
        counterplayWindow?: {
          closesAtTick?: number;
        };
      } | null;
      const failReason =
        payload?.error
        || payload?.commandReceipt?.statusReason
        || (res.ok ? '' : `Crew order failed (${res.status})`);
      if (!res.ok || payload?.ok === false) {
        throw new Error(failReason || `${strategy} order failed`);
      }
      if (String(payload?.commandStatus || '').toUpperCase() === 'REJECTED') {
        throw new Error(payload?.commandReceipt?.statusReason || `${strategy} order rejected`);
      }
      const executedAction =
        payload?.commandReceipt?.executedActionType
        || payload?.tickResult?.action
        || strategy.toLowerCase();
      showDegenStatus(
        `${strategy} order executed as ${String(executedAction).toUpperCase()}.${payload?.campaignImpact?.objective ? ` ${payload.campaignImpact.objective}` : ''}${payload?.counterplayWindow?.closesAtTick != null ? ` Counterplay closes by tick ${payload.counterplayWindow.closesAtTick}.` : ''}`,
        'ok',
        3600,
      );
      const refreshed = await apiFetch<CrewWarsStatusPayload>('/crew-wars/status').catch(() => null);
      if (refreshed) setCrewWarsStatus(refreshed);
    } catch (err) {
      console.error('[Town3D] Failed to execute crew order', err);
      const reason = err instanceof Error ? err.message : `Failed to execute ${strategy} order`;
      showDegenStatus(reason, 'error', 3800);
    } finally {
      setCrewOrderBusy(false);
    }
  }, [buildPlayerHeaders, ensureActionSession, ownedAgentId, showDegenStatus]);
  useEffect(() => {
    if (!showOnboarding) return;
    if (!ownedAgentId || !isPlayerAuthenticated) return;
    localStorage.setItem(ONBOARDED_KEY, '1');
    setShowOnboarding(false);
  }, [isPlayerAuthenticated, ownedAgentId, showOnboarding]);
  useEffect(() => {
    if (showOnboarding) return;
    if (uiMode !== 'pro') return;
    if (!isPlayerAuthenticated || !ownedAgentId) return;
    if (missionTourShownRef.current) return;
    const seen = localStorage.getItem(DEGEN_TOUR_KEY) === '1';
    if (seen) return;
    missionTourShownRef.current = true;
    setMissionTourStep(0);
    setShowMissionTour(true);
  }, [isPlayerAuthenticated, ownedAgentId, showOnboarding, uiMode]);
  useEffect(() => {
    if (uiMode === 'pro') return;
    if (!showMissionTour) return;
    setShowMissionTour(false);
  }, [showMissionTour, uiMode]);
  useEffect(() => {
    let cancelled = false;
    const refreshLlmMode = async () => {
      try {
        const res = await fetch(`${API_BASE}/agent-loop/llm-mode`);
        if (!res.ok) throw new Error('llm mode unavailable');
        const payload = await res.json() as { mode?: 'LIVE' | 'SIMULATION' };
        if (!cancelled) {
          setAiMode(payload.mode === 'LIVE' ? 'LIVE' : 'SIMULATION');
        }
      } catch {
        if (!cancelled) setAiMode('SIMULATION');
      }
    };
    void refreshLlmMode();
    const timer = window.setInterval(() => {
      void refreshLlmMode();
    }, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);
  const [showSpawnOverlay, setShowSpawnOverlay] = useState(false);
  const openDeployFlow = useCallback(() => {
    if (!isPlayerAuthenticated) {
      setShowOnboarding(true);
      return;
    }
    setShowSpawnOverlay(true);
  }, [isPlayerAuthenticated]);
  const closeMissionTour = useCallback(() => {
    localStorage.setItem(DEGEN_TOUR_KEY, '1');
    setShowMissionTour(false);
  }, []);
  const advanceMissionTour = useCallback(() => {
    if (missionTourStep >= MISSION_TOUR_STEPS.length - 1) {
      closeMissionTour();
      return;
    }
    setMissionTourStep((step) => Math.min(step + 1, MISSION_TOUR_STEPS.length - 1));
  }, [closeMissionTour, missionTourStep]);
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const canvasRecoveryGuardRef = useRef(false);
  const canvasListenerCleanupRef = useRef<(() => void) | null>(null);
  const handleCanvasCreated = useCallback((state: RootState) => {
    canvasListenerCleanupRef.current?.();
    const canvas = state.gl.domElement as HTMLCanvasElement;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      if (canvasRecoveryGuardRef.current) return;
      canvasRecoveryGuardRef.current = true;
      // Fallback to a cheaper profile first to reduce context pressure.
      setVisualSettings((prev) => {
        const nextQuality = prev.quality === 'high'
          ? 'medium'
          : prev.quality === 'medium'
            ? 'low'
            : prev.quality;
        return {
          ...prev,
          quality: nextQuality,
          postFx: false,
        };
      });
      window.setTimeout(() => {
        const ctx = state.gl.getContext();
        const stillLost = typeof ctx.isContextLost === 'function' ? ctx.isContextLost() : false;
        if (stillLost) {
          setCanvasEpoch((prev) => prev + 1);
        }
        canvasRecoveryGuardRef.current = false;
      }, 1100);
    };
    const onContextRestored = () => {
      canvasRecoveryGuardRef.current = false;
    };
    canvas.addEventListener('webglcontextlost', onContextLost, { passive: false });
    canvas.addEventListener('webglcontextrestored', onContextRestored);
    canvasListenerCleanupRef.current = () => {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
    };
  }, []);
  useEffect(() => {
    return () => {
      canvasListenerCleanupRef.current?.();
      canvasListenerCleanupRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (!walletAddress) return;
    const normalizedWallet = normalizeWalletAddress(walletAddress);
    localStorage.setItem(MY_WALLET_KEY, walletAddress);
    const walletAgent = agents.find((agent) => normalizeWalletAddress(agent.walletAddress) === normalizedWallet);
    if (!walletAgent) return;
    setSelectedAgentId((current) => {
      const currentExists = !!current && agents.some((agent) => agent.id === current);
      const shouldAutoSelect = !currentExists || walletAutoSelectedRef.current !== normalizedWallet;
      if (!shouldAutoSelect) return current;
      walletAutoSelectedRef.current = normalizedWallet;
      return walletAgent.id;
    });
    localStorage.setItem(MY_AGENT_KEY, walletAgent.id);
  }, [walletAddress, agents]);
  const resolvedVisualQuality = useMemo(
    () => resolveVisualQuality(visualSettings.quality, autoDetectedQuality),
    [visualSettings.quality, autoDetectedQuality],
  );
  const desktopVisualProfile = useMemo(() => VISUAL_PROFILES[resolvedVisualQuality], [resolvedVisualQuality]);
  const mobileVisualQuality = useMemo<ResolvedVisualQuality>(
    () => (resolvedVisualQuality === 'high' ? 'medium' : resolvedVisualQuality),
    [resolvedVisualQuality],
  );
  const mobileVisualProfile = useMemo(() => VISUAL_PROFILES[mobileVisualQuality], [mobileVisualQuality]);

  useEffect(() => {
    saveVisualSettings(visualSettings);
  }, [visualSettings]);

  useEffect(() => {
    if (visualSettings.quality !== 'auto') return;
    let raf = 0;
    let frames = 0;
    const start = performance.now();
    const sample = () => {
      frames += 1;
      const elapsed = performance.now() - start;
      if (elapsed >= 5000) {
        const fps = (frames * 1000) / elapsed;
        setAutoDetectedQuality(detectQualityFromFps(fps));
        return;
      }
      raf = requestAnimationFrame(sample);
    };
    raf = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(raf);
  }, [visualSettings.quality]);

  const cycleVisualQuality = useCallback(() => {
    setVisualSettings((prev) => ({ ...prev, quality: nextVisualQuality(prev.quality) }));
  }, []);

  // connectWallet: Privy handles this via PrivyWalletConnect component.
  // This fallback tries window.ethereum for SpawnAgent compatibility.
  const connectWallet = useCallback(async (): Promise<string | null> => {
    if (walletAddress) return walletAddress;
    try {
      const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum;
      if (!eth) { alert('Click "Sign In" to create a wallet — no extension needed!'); return null; }
      const accounts = await eth.request({ method: 'eth_requestAccounts' }) as string[] | undefined;
      const addr = accounts?.[0] || null;
      if (addr) setWalletAddress(addr);
      return addr;
    } catch { return null; }
  }, [walletAddress]);
  const wheel = useWheelStatus(walletAddress);
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
  }, [wheel.status?.phase, wheel.status?.currentMatch]);

  // Keep WheelArena opt-in to avoid unexpectedly obscuring the town view.
  useEffect(() => {
    const p = wheel.status?.phase;
    if (p === 'PREP' || p === 'IDLE') {
      const t = setTimeout(() => setWheelArenaOpen(false), 1000);
      return () => clearTimeout(t);
    }
  }, [wheel.status?.phase]);

  
  // Visual effects (system-controlled)
  const [weather, setWeather] = useState<'clear' | 'rain' | 'storm'>('clear');
  const [coinBursts, setCoinBursts] = useState<{ id: string; position: [number, number, number]; isBuy: boolean }[]>([]);
  const [deathEffects, setDeathEffects] = useState<{ id: string; position: [number, number, number] }[]>([]);
  const [spawnEffects, setSpawnEffects] = useState<{ id: string; position: [number, number, number]; color: string }[]>([]);
  const [actionBursts, setActionBursts] = useState<ActionBurst[]>([]);
  const [opportunityWindow, setOpportunityWindow] = useState<OpportunityWindow | null>(null);
  const [uiNowMs, setUiNowMs] = useState(() => Date.now());
  const nextOpportunityAtRef = useRef<number>(Date.now() + randomRange(16_000, 30_000));
  const transientFxCap = isMobile ? mobileVisualProfile.maxTransientEffects : desktopVisualProfile.maxTransientEffects;
  const actionBurstCap = Math.max(40, transientFxCap * 4);

  useEffect(() => {
    setCoinBursts((prev) => prev.slice(-transientFxCap));
    setDeathEffects((prev) => prev.slice(-transientFxCap));
    setSpawnEffects((prev) => prev.slice(-transientFxCap));
    setActionBursts((prev) => prev.slice(-actionBurstCap));
  }, [actionBurstCap, transientFxCap]);

  useEffect(() => {
    const t = window.setInterval(() => {
      const nowMs = Date.now();
      setActionBursts((prev) => {
        if (prev.length === 0) return prev;
        const next = prev.filter((burst) => nowMs - burst.createdAt <= ACTION_BURST_LIFE_MS + 120);
        return next.length === prev.length ? prev : next;
      });
    }, 180);
    return () => {
      window.clearInterval(t);
    };
  }, []);

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
  const urgencyObjective = useMemo(
    () => deriveUrgencyObjective(worldEvents, wheel.status?.phase, weather, economicState.sentiment),
    [worldEvents, wheel.status?.phase, weather, economicState.sentiment],
  );
  useEffect(() => {
    const now = Date.now();
    setUiNowMs(now);
    setOpportunityWindow(null);
    nextOpportunityAtRef.current = now + randomRange(14_000, 26_000);
  }, [town?.id]);
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setUiNowMs(now);
      setOpportunityWindow((current) => {
        if (current && now >= current.endsAt) {
          nextOpportunityAtRef.current = now + randomRange(14_000, 26_000);
          return null;
        }
        if (!current && now >= nextOpportunityAtRef.current) {
          return createOpportunityWindow(now, urgencyObjective, weather, economicState.sentiment);
        }
        return current;
      });
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [urgencyObjective, weather, economicState.sentiment]);
  const activeOpportunity = useMemo(() => {
    if (!opportunityWindow) return null;
    return opportunityWindow.endsAt > uiNowMs ? opportunityWindow : null;
  }, [opportunityWindow, uiNowMs]);
  const displayObjective = activeOpportunity?.objective ?? urgencyObjective;
  const opportunityTimeLeft = activeOpportunity ? formatTimeLeft(activeOpportunity.endsAt - uiNowMs) : null;

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

  const pushArenaOutcomeToast = useCallback((toast: ArenaOutcomeToast) => {
    setArenaOutcomeToasts((prev) => [toast, ...prev.filter((item) => item.id !== toast.id)].slice(0, 4));
    window.setTimeout(() => {
      setArenaOutcomeToasts((prev) => prev.filter((item) => item.id !== toast.id));
    }, ARENA_OUTCOME_TOAST_LIFE_MS + 250);
  }, []);

  const pushArenaMomentumToast = useCallback((toast: ArenaMomentumToast) => {
    setArenaMomentumToasts((prev) => [toast, ...prev.filter((item) => item.id !== toast.id)].slice(0, 3));
    setArenaImpactFlash({
      id: toast.id,
      tone: toast.direction,
      intensity: THREE.MathUtils.clamp(0.45 + toast.streak * 0.14, 0.48, 0.92),
    });
    window.setTimeout(() => {
      setArenaMomentumToasts((prev) => prev.filter((item) => item.id !== toast.id));
    }, ARENA_MOMENTUM_TOAST_LIFE_MS + 250);
    window.setTimeout(() => {
      setArenaImpactFlash((current) => (current?.id === toast.id ? null : current));
    }, ARENA_IMPACT_FLASH_LIFE_MS);
  }, []);

  const pushCrewBattleToast = useCallback((toast: CrewBattleToast) => {
    setCrewBattleToasts((prev) => [toast, ...prev.filter((item) => item.id !== toast.id)].slice(0, 3));
    window.setTimeout(() => {
      setCrewBattleToasts((prev) => prev.filter((item) => item.id !== toast.id));
    }, CREW_BATTLE_TOAST_LIFE_MS + 280);
  }, []);
  useEffect(() => {
    if (!crewWarsStatus?.recentBattles?.length) return;
    const ordered = [...crewWarsStatus.recentBattles].reverse();
    for (const battle of ordered) {
      if (!battle?.id || seenCrewBattleIdsRef.current.has(battle.id)) continue;
      seenCrewBattleIdsRef.current.add(battle.id);
      const createdAtMs = Number.isFinite(Date.parse(battle.createdAt)) ? Date.parse(battle.createdAt) : Date.now();
      pushCrewBattleToast({
        id: battle.id,
        winnerCrewName: battle.winnerCrewName,
        loserCrewName: battle.loserCrewName,
        territorySwing: battle.territorySwing,
        treasurySwing: battle.treasurySwing,
        createdAt: createdAtMs,
      });
    }
  }, [crewWarsStatus?.recentBattles, pushCrewBattleToast]);

  const agentById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const agentByIdRef = useRef<Map<string, Agent>>(new Map());
  useEffect(() => {
    agentByIdRef.current = agentById;
  }, [agentById]);
  useEffect(() => {
    agentOutcomesByIdRef.current = agentOutcomesById;
  }, [agentOutcomesById]);

  const applyAgentSnapshot = useCallback((nextAgents: Agent[]) => {
    const previousMap = previousAgentBalanceRef.current;
    const nextMap = new Map<string, AgentBalanceSnapshot>();
    const newOutcomes: Array<{ agentId: string; entry: AgentOutcomeEntry }> = [];
    const newArenaToasts: ArenaOutcomeToast[] = [];
    const newMomentumToasts: ArenaMomentumToast[] = [];
    const newActionBursts: ActionBurst[] = [];
    let ownedTelemetryUpdate: DegenLoopTelemetry | null = null;

    for (const agent of nextAgents) {
      const previous = previousMap.get(agent.id);
      const currentTickAt = typeof agent.lastTickAt === 'string' ? agent.lastTickAt : null;
      if (previous) {
        const previousTickAt = previous.lastTickAt;
        const actionType = agent.lastActionType || 'rest';
        const previousActionType = previous.lastActionType || 'rest';
        const bankrollDelta = agent.bankroll - previous.bankroll;
        const reserveDelta = agent.reserveBalance - previous.reserveBalance;
        const bankrollChanged = Math.abs(bankrollDelta) > 0.0001;
        const reserveChanged = Math.abs(reserveDelta) > 0.0001;
        const tickChanged = !!currentTickAt && currentTickAt !== previousTickAt;
        const actionChanged = actionType !== previousActionType;
        const shouldCapture = tickChanged || actionChanged || bankrollChanged || reserveChanged;

        if (shouldCapture) {
          const observedAt = currentTickAt || new Date().toISOString();
          const observedAtMs = Number.isFinite(Date.parse(observedAt)) ? Date.parse(observedAt) : Date.now();
          const signature = [
            observedAt,
            actionType,
            Math.round(bankrollDelta),
            Math.round(reserveDelta),
            Math.round(agent.bankroll),
            Math.round(agent.reserveBalance),
          ].join(':');
          const entry: AgentOutcomeEntry = {
            id: `${agent.id}:${signature}`,
            actionType,
            reasoning: safeTrim(agent.lastReasoning || agent.lastNarrative || 'No reasoning provided.', 180),
            bankrollDelta,
            reserveDelta,
            at: observedAt,
          };
          newOutcomes.push({
            agentId: agent.id,
            entry,
          });
          const deltaNet = bankrollDelta + reserveDelta;
          const burstPolarity = deltaNet > 0.001 ? 1 : deltaNet < -0.001 ? -1 : 0;
          let degenLoopStep: DegenLoopStepResult | null = null;
          const loopPhase = resolveDegenLoopPhase(actionType);
          if (loopPhase && (tickChanged || actionChanged)) {
            const currentTelemetry = degenLoopTelemetryByAgentIdRef.current.get(agent.id) || EMPTY_DEGEN_LOOP_TELEMETRY;
            degenLoopStep = advanceDegenLoopTelemetry(currentTelemetry, loopPhase, observedAtMs);
            degenLoopTelemetryByAgentIdRef.current.set(agent.id, degenLoopStep.telemetry);
            if (ownedAgentId === agent.id) {
              ownedTelemetryUpdate = { ...degenLoopStep.telemetry };
            }
          }
          const shouldEmitBurst =
            actionType !== 'rest'
            && actionType !== 'idle'
            && (actionChanged || bankrollChanged || reserveChanged);
          if (shouldEmitBurst) {
            const sim = simsRef.current.get(agent.id);
            if (sim) {
              const kind = resolveActionBurstKind(actionType);
              const spreadSeed = hashToSeed(`${agent.id}:${signature}:burst`);
              const spreadAngle = ((spreadSeed % 360) / 360) * Math.PI * 2;
              const spreadRadius = 0.16 + ((spreadSeed >>> 8) % 1000) / 1000 * 0.42;
              const intensity = THREE.MathUtils.clamp(
                0.62
                  + (Math.abs(deltaNet) / 20)
                  + (kind === 'FIGHT' ? 0.26 : 0)
                  + (kind === 'TRADE' ? 0.12 : 0),
                0.5,
                2.3,
              );
              const loopSuffix = ownedAgentId === agent.id ? buildOwnedLoopSuffix(degenLoopStep) : null;
              newActionBursts.push({
                id: `action:${agent.id}:${signature}`,
                agentId: agent.id,
                actionType,
                kind,
                polarity: burstPolarity,
                label: buildActionBurstLabel(kind, bankrollDelta, reserveDelta, loopSuffix),
                intensity,
                createdAt: Date.now(),
                isOwned: ownedAgentId === agent.id,
                position: [
                  sim.position.x + Math.cos(spreadAngle) * spreadRadius,
                  1.04 + (kind === 'FIGHT' ? 0.16 : 0),
                  sim.position.z + Math.sin(spreadAngle) * spreadRadius,
                ],
              });
            }
          }
          if (actionType === 'play_arena') {
            const toastId = `${agent.id}:${signature}:play_arena`;
            if (!seenArenaOutcomeIdsRef.current.has(toastId)) {
              seenArenaOutcomeIdsRef.current.add(toastId);
              const result: ArenaOutcomeSignal['result'] = bankrollDelta > 0 ? 'WIN' : bankrollDelta < 0 ? 'LOSS' : 'DRAW';
              newArenaToasts.push({
                id: toastId,
                agentId: agent.id,
                agentName: agent.name,
                archetype: agent.archetype,
                result,
                delta: bankrollDelta,
                createdAt: Date.now(),
              });
            }
            const history = agentOutcomesByIdRef.current[agent.id] || [];
            const merged: AgentOutcomeEntry[] = [];
            const seenIds = new Set<string>();
            for (const candidate of [entry, ...history]) {
              if (seenIds.has(candidate.id)) continue;
              seenIds.add(candidate.id);
              merged.push(candidate);
              if (merged.length >= 8) break;
            }
            const momentum = summarizeArenaMomentum(merged);
            if (momentum.streak >= 2 && momentum.direction !== 0) {
              const momentumId = `${agent.id}:${signature}:momentum:${momentum.direction > 0 ? 'win' : 'loss'}:${momentum.streak}`;
              if (!seenArenaMomentumIdsRef.current.has(momentumId)) {
                seenArenaMomentumIdsRef.current.add(momentumId);
                newMomentumToasts.push({
                  id: momentumId,
                  agentId: agent.id,
                  agentName: agent.name,
                  archetype: agent.archetype,
                  direction: momentum.direction > 0 ? 'WIN' : 'LOSS',
                  streak: momentum.streak,
                  createdAt: Date.now(),
                });
              }
            }
          }
        }
      }

      nextMap.set(agent.id, {
        bankroll: agent.bankroll,
        reserveBalance: agent.reserveBalance,
        lastTickAt: currentTickAt,
        lastActionType: agent.lastActionType || null,
      });
    }

    previousAgentBalanceRef.current = nextMap;
    setAgents(nextAgents);
    if (ownedTelemetryUpdate) {
      setOwnedLoopTelemetry(ownedTelemetryUpdate);
    }

    if (newOutcomes.length === 0) return;
    setAgentOutcomesById((prev) => {
      const next = { ...prev };
      for (const outcome of newOutcomes) {
        const existing = next[outcome.agentId] || [];
        if (existing.some((entry) => entry.id === outcome.entry.id)) continue;
        next[outcome.agentId] = [outcome.entry, ...existing].slice(0, 8);
      }
      return next;
    });
    if (newArenaToasts.length > 0) {
      newArenaToasts.forEach((toast) => pushArenaOutcomeToast(toast));
    }
    if (newMomentumToasts.length > 0) {
      newMomentumToasts.forEach((toast) => pushArenaMomentumToast(toast));
    }
    if (newActionBursts.length > 0) {
      setActionBursts((prev) => [...prev, ...newActionBursts].slice(-actionBurstCap));
    }
  }, [actionBurstCap, ownedAgentId, pushArenaOutcomeToast, pushArenaMomentumToast]);





  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [townsRes, activeTownRes, agentsRes, poolRes, crewRes] = await Promise.all([
          apiFetch<{ towns: TownSummary[] }>('/towns'),
          apiFetch<{ town: Town | null }>('/town'),
          apiFetch<Agent[]>('/agents'),
          apiFetch<{ pool: EconomyPoolSummary | null }>('/economy/pool').catch(() => ({ pool: null })),
          apiFetch<CrewWarsStatusPayload>('/crew-wars/status').catch(() => null),
        ]);

        if (cancelled) return;
        setTowns(townsRes.towns);
        applyAgentSnapshot(agentsRes);
        if (poolRes.pool) setEconomy(poolRes.pool);
        if (crewRes) setCrewWarsStatus(crewRes);

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
  }, [applyAgentSnapshot]);

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
        if (!cancelled) applyAgentSnapshot(res);
      } catch {
        // ignore
      }
    }
    const t = setInterval(loadAgents, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [applyAgentSnapshot, pushTradeText]);

  // Poll world events
  useEffect(() => {
    let cancelled = false;
    async function loadWorldEvents() {
      try {
        const res = await apiFetch<{ events: ActiveWorldEvent[] }>('/events/active');
        if (!cancelled) setWorldEvents(res.events);
      } catch {
        // ignore transient polling errors
      }
    }
    loadWorldEvents();
    const t = setInterval(loadWorldEvents, 10000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Poll crew wars scoreboard (territory + treasury race)
  useEffect(() => {
    let cancelled = false;
    async function loadCrewWars() {
      try {
        const res = await apiFetch<CrewWarsStatusPayload>('/crew-wars/status');
        if (!cancelled) setCrewWarsStatus(res);
      } catch {
        // ignore transient polling failures
      }
    }
    void loadCrewWars();
    const t = setInterval(loadCrewWars, 9000);
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
  }, [pushTradeText]);

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

              let meta: Record<string, unknown> | null = null;
              try {
                const parsed: unknown = JSON.parse(e.metadata || '{}');
                meta = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
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
  }, [pushTradeText]);

  useEffect(() => {
    let cancelled = false;

    type RuntimeAgentsResponse = {
      running?: boolean;
      tick?: number;
      agents?: RuntimeAgentCard[];
    };
    type RuntimeCrewsResponse = {
      crews?: RuntimeCrewCard[];
    };
    type RuntimeBuildingsResponse = {
      buildings?: RuntimeBuildingCard[];
    };
    type RuntimeFeedResponse = {
      feed?: RuntimeFeedCard[];
    };

    const loadRuntime = async () => {
      try {
        const [agentsRes, crewsRes, buildingsRes, feedRes] = await Promise.all([
          apiFetch<RuntimeAgentsResponse>('/runtime/agents').catch(() => ({})),
          apiFetch<RuntimeCrewsResponse>('/runtime/crews').catch(() => ({})),
          apiFetch<RuntimeBuildingsResponse>('/runtime/buildings').catch(() => ({})),
          apiFetch<RuntimeFeedResponse>('/runtime/feed?limit=30').catch(() => ({})),
        ]);

        if (cancelled) return;

        if (Array.isArray(agentsRes.agents)) setRuntimeAgents(agentsRes.agents);
        if (Array.isArray(crewsRes.crews)) setRuntimeCrews(crewsRes.crews);
        if (Array.isArray(buildingsRes.buildings)) setRuntimeBuildings(buildingsRes.buildings);
        if (Array.isArray(feedRes.feed)) setRuntimeFeed(feedRes.feed);
        setRuntimeTick(Number.isFinite(Number(agentsRes.tick)) ? Number(agentsRes.tick) : 0);
        setRuntimeLoopRunning(Boolean(agentsRes.running));
      } finally {
        if (!cancelled) setRuntimeLoading(false);
      }
    };

    void loadRuntime();
    const t = setInterval(loadRuntime, 2500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const selectedPlot = useMemo(() => town?.plots.find((p) => p.id === selectedPlotId) ?? null, [town, selectedPlotId]);
  const selectedAgent = useMemo(() => agents.find((a) => a.id === selectedAgentId) ?? null, [agents, selectedAgentId]);
  const selectedAgentOutcomes = useMemo(
    () => (selectedAgentId ? agentOutcomesById[selectedAgentId] || [] : []),
    [agentOutcomesById, selectedAgentId],
  );
  const arenaOutcomeByAgentId = useMemo(() => {
    const byAgent: Record<string, ArenaOutcomeSignal> = {};
    for (const [agentId, entries] of Object.entries(agentOutcomesById)) {
      if (!Array.isArray(entries) || entries.length === 0) continue;
      const duel = entries.find((entry) => entry.actionType === 'play_arena');
      if (!duel) continue;
      const result = duel.bankrollDelta > 0 ? 'WIN' : duel.bankrollDelta < 0 ? 'LOSS' : 'DRAW';
      byAgent[agentId] = {
        result,
        delta: duel.bankrollDelta,
        at: duel.at,
      };
    }
    return byAgent;
  }, [agentOutcomesById]);
  const arenaMomentumByAgentId = useMemo(() => {
    const byAgent: Record<string, number> = {};
    for (const [agentId, entries] of Object.entries(agentOutcomesById)) {
      if (!Array.isArray(entries) || entries.length === 0) continue;
      const momentum = summarizeArenaMomentum(entries);
      if (momentum.streak < 2 || momentum.direction === 0) continue;
      byAgent[agentId] = momentum.streak * momentum.direction;
    }
    return byAgent;
  }, [agentOutcomesById]);
  const ownedAgent = useMemo(() => {
    if (!ownedAgentId) return null;
    return agents.find((a) => a.id === ownedAgentId) ?? null;
  }, [agents, ownedAgentId]);
  const ownedRuntimeAgent = useMemo(() => {
    if (!ownedAgentId) return null;
    return runtimeAgents.find((agent) => agent.agentId === ownedAgentId) || null;
  }, [runtimeAgents, ownedAgentId]);
  const recentSwaps = useMemo(() => swaps.slice(0, 8), [swaps]);

  // Latest thought payload for the wallet-owned agent
  const latestThoughts = useMemo(() => {
    if (!ownedAgentId) return [];
    const thoughts = agents
      .filter((a) => a.id === ownedAgentId && a.lastReasoning && a.lastTickAt)
      .map(a => ({
        agentId: a.id,
        agentName: a.name,
        archetype: a.archetype,
        actionType: a.lastActionType || 'rest',
        reasoning: a.lastReasoning || '',
        narrative: a.lastNarrative || '',
        tickAt: a.lastTickAt || '',
        isMine: true,
      }))
      .sort((a, b) => new Date(b.tickAt).getTime() - new Date(a.tickAt).getTime());
    return thoughts;
  }, [agents, ownedAgentId]);



  // Merge swaps and events into unified activity feed
  const activityFeed = useMemo(() => {
    // If a swap is mirrored as a TRADE town event (with purpose), show the event and hide the raw swap row.
    const tradeSwapIds = new Set<string>();
    for (const e of events) {
      if (e.eventType !== 'TRADE') continue;
      try {
        const meta = JSON.parse(e.metadata || '{}') as Record<string, unknown>;
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

    const sortByTime = (a: ActivityItem, b: ActivityItem) => {
      const aTime = a.data.createdAt;
      const bTime = b.data.createdAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    };

    return [...eventItems, ...swapItems].sort(sortByTime).slice(0, 60);
  }, [swaps, events]);



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
    <Suspense fallback={null}>
      <LazyWheelArena
        status={wheel.status}
        odds={wheel.odds}
        walletAddress={walletAddress}
        onBet={wheel.placeBet}
        loading={wheel.loading}
        onClose={() => setWheelArenaOpen(false)}
      />
    </Suspense>
  ) : null;
  const missionTourOverlay = uiMode === 'pro' && showMissionTour ? (
    <div className="fixed inset-0 z-[210] flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-black/72 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-cyan-500/35 bg-slate-950/92 p-5 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-300">Guided Mission Tour</div>
            <div className="mt-1 text-xl font-black text-amber-300">{MISSION_TOUR_STEPS[missionTourStep].title}</div>
          </div>
          <div className="text-[10px] font-mono text-slate-400">
            {missionTourStep + 1}/{MISSION_TOUR_STEPS.length}
          </div>
        </div>
        <p className="text-[12px] leading-relaxed text-slate-200">
          {MISSION_TOUR_STEPS[missionTourStep].body}
        </p>
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-slate-900/40 px-3 py-2 text-[11px] text-slate-300">
          Open the bottom-left DEGEN LOOP HUD and follow the NEXT MISSION card. Telegram is optional.
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={closeMissionTour}
            className="rounded-lg border border-slate-700/70 px-3 py-1.5 text-[11px] text-slate-400 hover:border-slate-600 hover:text-slate-200"
          >
            Skip Tour
          </button>
          <button
            type="button"
            onClick={advanceMissionTour}
            className="rounded-lg border border-cyan-400/65 bg-cyan-500/20 px-3 py-1.5 text-[11px] font-semibold text-cyan-100 hover:border-cyan-300 hover:bg-cyan-500/28"
          >
            {missionTourStep >= MISSION_TOUR_STEPS.length - 1 ? 'Start Loop' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  /* ────────────── MOBILE LAYOUT ────────────── */
  if (isMobile) return (
    <div className="flex flex-col h-[100svh] w-full overflow-hidden bg-[#050914]">
      {showOnboarding && (
        <Suspense fallback={null}>
          <LazyOnboardingOverlay onComplete={() => setShowOnboarding(false)} />
        </Suspense>
      )}
      {wheelArenaOverlay}
      {missionTourOverlay}
      {/* Mobile top bar — compact */}
      <div className="shrink-0 flex items-center justify-between px-3 py-1 bg-slate-950/95 border-b border-slate-800/40 z-50">
        <span className="text-xs font-bold text-amber-400">AI TOWN</span>
        {economy && Number.isFinite(economy.spotPrice) && (
          <span className="text-[10px] text-slate-500 font-mono">$ARENA {economy.spotPrice.toFixed(4)}</span>
        )}
        <Suspense fallback={null}>
          <LazyPrivyWalletConnect
            compact
            onAddressChange={setWalletAddress}
            onSessionChange={setPlayerSession}
          />
        </Suspense>
        <div className="flex items-center gap-1">
          {ownedAgent && (
            <button
              type="button"
              disabled={loopModeUpdating}
              onClick={() => void updateOwnedLoopMode(ownedLoopMode === 'DEGEN_LOOP' ? 'DEFAULT' : 'DEGEN_LOOP')}
              className={`px-1.5 py-0.5 rounded border text-[9px] font-mono ${
                ownedLoopMode === 'DEGEN_LOOP'
                  ? 'border-emerald-500/60 bg-emerald-950/45 text-emerald-300'
                  : 'border-slate-700/60 bg-slate-900/45 text-slate-400'
              } ${loopModeUpdating ? 'opacity-60' : ''}`}
              title="Toggle degen loop mode"
            >
              {ownedLoopMode === 'DEGEN_LOOP' ? 'AUTO' : 'MAN'}
            </button>
          )}
          {ownedLoopTelemetry && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded border border-amber-500/45 bg-amber-500/15 text-amber-200 font-mono"
              title="Loop Heat = consecutive non-rest actions. Higher heat means stronger loop momentum."
            >
              🔥Heat x{Math.max(1, ownedLoopTelemetry.chain)}
            </span>
          )}
          {ownedCrewLink && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded border font-mono"
              style={{
                color: ownedCrewLink.colorHex,
                borderColor: `${ownedCrewLink.colorHex}66`,
                backgroundColor: `${ownedCrewLink.colorHex}1f`,
              }}
              title={`Crew: ${ownedCrewLink.crewName}`}
            >
              ⚑ {ownedCrewLink.crewName.split(' ')[0]}
            </span>
          )}
          {leadingCrew && (
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-rose-400/35 bg-rose-950/30 text-rose-200 font-mono">
              ⚔️ {leadingCrew.territoryControl}
            </span>
          )}
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${
              aiMode === 'LIVE'
                ? 'border-emerald-500/50 bg-emerald-950/35 text-emerald-200'
                : 'border-slate-700/70 bg-slate-900/40 text-slate-300'
            }`}
            title={aiMode === 'LIVE' ? 'Live model calls enabled' : 'Simulation mode (no live model spend)'}
          >
            AI:{aiMode}
          </span>
          <span className="text-[10px] text-cyan-300/90 uppercase">{mobileVisualQuality}</span>
          {activeOpportunity && opportunityTimeLeft && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded border font-mono animate-pulse"
              style={{
                color: activeOpportunity.objective.color,
                borderColor: `${activeOpportunity.objective.color}66`,
                backgroundColor: `${activeOpportunity.objective.color}1f`,
              }}
              title={`${activeOpportunity.label}: ${activeOpportunity.subtitle}`}
            >
              ⏱ {opportunityTimeLeft}
            </span>
          )}
          {displayObjective && (
            <span className="text-[10px]" title={`Objective: ${displayObjective.label}`}>
              {displayObjective.emoji}
            </span>
          )}
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
          key={`town-mobile-${canvasEpoch}`}
          shadows={false}
          dpr={mobileVisualProfile.dpr}
          camera={{ position: [50, 55, 50], fov: 50, near: 0.5, far: 3000 }}
          gl={{
            antialias: mobileVisualProfile.antialias,
            powerPreference: mobileVisualProfile.powerPreference,
            alpha: false,
          }}
          onCreated={handleCanvasCreated}
          onPointerMissed={() => { setSelectedPlotId(null); }}
          fallback={<div className="h-full w-full grid place-items-center bg-slate-950 text-slate-300 text-sm">WebGL not supported</div>}
        >
          <TownScene
            town={town}
            agents={agents}
            agentCrewById={crewWarsStatus?.agentCrewById ?? {}}
            ownedAgentId={ownedAgentId}
            ownedLoopTelemetry={ownedLoopTelemetry}
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
            actionBursts={actionBursts}
            relationshipsRef={relationshipsRef}
            urgencyObjective={urgencyObjective}
            opportunityWindow={activeOpportunity}
            fightingAgentIds={fightingAgentIds}
            arenaOutcomeByAgentId={arenaOutcomeByAgentId}
            arenaMomentumByAgentId={arenaMomentumByAgentId}
            visualProfile={mobileVisualProfile}
            visualQuality={mobileVisualQuality}
            visualSettings={visualSettings}
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

        <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-[55]">
          {arenaMomentumToasts.slice(0, 1).map((toast) => {
            const isWin = toast.direction === 'WIN';
            return (
              <div key={toast.id} className="animate-in zoom-in-95 slide-in-from-top-2 fade-in duration-300">
                <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold backdrop-blur-md ${
                  isWin ? 'bg-emerald-900/85 text-emerald-100' : 'bg-rose-900/85 text-rose-100'
                }`}>
                  {isWin ? '🔥' : '☠️'} {isWin ? 'WIN STREAK' : 'LOSS STREAK'} x{toast.streak}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pointer-events-none absolute top-2 left-2 flex flex-col items-start gap-1 z-[56]">
          {crewBattleToasts.slice(0, 1).map((toast) => (
            <div key={toast.id} className="animate-in slide-in-from-left-2 fade-in duration-300">
              <div className="rounded-lg border border-cyan-500/35 bg-slate-950/84 px-2 py-1 text-[10px] font-mono text-cyan-100">
                ⚔ {toast.winnerCrewName} +{toast.territorySwing} terr
              </div>
            </div>
          ))}
        </div>

        {/* (mobile town info removed) */}

        {/* Wheel of Fate banner (mobile) */}
        {wheel.status && wheel.status.phase !== 'IDLE' && wheel.status.phase !== 'PREP' && (
          <div className="pointer-events-auto absolute bottom-14 left-0 right-0 z-50">
            <Suspense fallback={null}>
              <LazyWheelBanner
                status={wheel.status}
                odds={wheel.odds}
                walletAddress={walletAddress}
                onBet={wheel.placeBet}
                loading={wheel.loading}
                isMobile
              />
            </Suspense>
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
                  <div className="text-xs font-semibold text-slate-200 mb-1">My Agent Activity</div>
                  {!ownedAgentId && (
                    <div className="text-[10px] text-slate-500 py-1">Connect/select your wallet agent to view logs.</div>
                  )}
	                  {activityFeed.filter((item) => {
	                    if (!ownedAgentId) return false;
	                    if (item.kind === 'swap') return item.data.agent?.id === ownedAgentId;
                      const ev = item.data;
                      if (ev.agentId === ownedAgentId) return true;
                      try {
                        const metadata = JSON.parse(ev.metadata || '{}') as Record<string, unknown>;
                        if (metadata?.winnerId === ownedAgentId || metadata?.loserId === ownedAgentId) return true;
                        if (Array.isArray(metadata?.participants)) {
                          return metadata.participants.some((participant) => participant === ownedAgentId);
                        }
                        return false;
                      } catch {
                        return false;
                      }
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
                <Suspense fallback={null}>
                  <LazySpawnAgent
                    walletAddress={walletAddress}
                    onConnectWallet={connectWallet}
                    onSpawned={() => { setTimeout(() => setMobilePanel('none'), 2000); }}
                  />
                </Suspense>
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
        <Suspense fallback={null}>
          <LazyOnboardingOverlay
            onComplete={() => setShowOnboarding(false)}
          />
        </Suspense>
      )}
      {wheelArenaOverlay}
      {missionTourOverlay}
      {/* Top Bar: Degen Stats */}
      <div className="shrink-0 border-b border-cyan-950/40 bg-gradient-to-r from-slate-950/95 via-slate-950/92 to-slate-900/92 px-3 py-2.5 z-50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 leading-tight shadow-[0_0_20px_rgba(245,158,11,0.12)]">
              <div className="text-[13px] font-black tracking-[0.14em] text-amber-300">AI TOWN</div>
              <div className="text-[9px] font-mono uppercase text-slate-400">Agent Arena Live</div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {uiMode === 'default' ? (
                <>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-mono ${
                      runtimeLoopRunning
                        ? 'border-emerald-500/55 bg-emerald-950/35 text-emerald-200'
                        : 'border-rose-500/50 bg-rose-950/30 text-rose-200'
                    }`}
                  >
                    AGENT {runtimeLoopRunning ? 'RUNNING' : 'PAUSED'}
                  </span>
                  {ownedAgent && (
                    <span className="rounded-full border border-slate-700/70 bg-slate-900/45 px-2 py-0.5 text-[10px] font-mono text-slate-200">
                      BAL ${Math.round(ownedAgent.bankroll)}A / {Math.round(ownedAgent.reserveBalance)}R
                    </span>
                  )}
                  <span className="rounded-full border border-cyan-500/45 bg-cyan-950/30 px-2 py-0.5 text-[10px] font-mono text-cyan-100">
                    {ownedRuntimeAgent?.action || 'WAIT'} · {ownedRuntimeAgent?.targetLabel || 'Awaiting target'}
                  </span>
                  {ownedRuntimeAgent?.lastOutcome && (
                    <span className="rounded-full border border-amber-400/45 bg-amber-950/35 px-2 py-0.5 text-[10px] font-mono text-amber-100">
                      LAST {ownedRuntimeAgent.lastOutcome}
                    </span>
                  )}
                </>
              ) : (
                <>
                  {economy && Number.isFinite(economy.spotPrice) && (
                    <span className="rounded-full border border-slate-700/70 bg-slate-900/50 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                      $ARENA {economy.spotPrice.toFixed(4)}
                    </span>
                  )}
                  <span className="rounded-full border border-slate-700/70 bg-slate-900/45 px-2 py-0.5 text-[10px] font-mono uppercase text-cyan-300/90">
                    {visualSettings.quality === 'auto' ? `AUTO:${resolvedVisualQuality}` : resolvedVisualQuality}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-mono ${
                      aiMode === 'LIVE'
                        ? 'border-emerald-500/55 bg-emerald-950/35 text-emerald-200'
                        : 'border-slate-700/70 bg-slate-900/40 text-slate-300'
                    }`}
                    title={aiMode === 'LIVE' ? 'Live model calls enabled' : 'Simulation mode (no live model spend)'}
                  >
                    AI:{aiMode}
                  </span>
                  {ownedLoopTelemetry && (
                    <span
                      className="rounded-full border border-amber-500/45 bg-amber-900/45 px-2 py-0.5 text-[10px] font-mono text-amber-200"
                      title="Loop Heat = consecutive non-rest actions. Streak toasts: WIN STREAK = consecutive duel wins, LOSS STREAK = consecutive duel losses."
                    >
                      🔥 LOOP HEAT x{Math.max(1, ownedLoopTelemetry.chain)} · loops {Math.max(0, ownedLoopTelemetry.loopsCompleted)}
                    </span>
                  )}
                  <span
                    className="rounded-full border border-slate-700/65 bg-slate-900/35 px-2 py-0.5 text-[10px] font-mono text-slate-300"
                    title="Definitions: LOOP HEAT tracks non-rest loop momentum. WIN/LOSS STREAK toasts track consecutive duel outcomes."
                  >
                    ℹ HEAT = loop momentum · STREAK = duel run
                  </span>
                  {ownedCrewLink && (
                    <span
                      className="rounded-full border px-2 py-0.5 text-[10px] font-mono"
                      style={{
                        color: ownedCrewLink.colorHex,
                        borderColor: `${ownedCrewLink.colorHex}66`,
                        backgroundColor: `${ownedCrewLink.colorHex}1f`,
                      }}
                      title={`Crew role: ${ownedCrewLink.role}`}
                    >
                      ⚑ {ownedCrewLink.crewName}
                    </span>
                  )}
                  {leadingCrew && (
                    <span className="rounded-full border border-rose-400/35 bg-rose-950/30 px-2 py-0.5 text-[10px] font-mono text-rose-200">
                      ⚔️ {leadingCrew.name} · terr {leadingCrew.territoryControl} · score {leadingCrew.warScore}
                    </span>
                  )}
                  {activeOpportunity && opportunityTimeLeft && (
                    <span
                      className="rounded-full border px-2 py-0.5 text-[10px] font-mono animate-pulse"
                      style={{
                        color: activeOpportunity.objective.color,
                        borderColor: `${activeOpportunity.objective.color}66`,
                        backgroundColor: `${activeOpportunity.objective.color}1f`,
                      }}
                      title={`${activeOpportunity.label}: ${activeOpportunity.subtitle}`}
                    >
                      ⏱ {activeOpportunity.label} {opportunityTimeLeft}
                    </span>
                  )}
                  {displayObjective && (
                    <span
                      className="rounded-full border px-2 py-0.5 text-[10px] font-mono"
                      style={{
                        color: displayObjective.color,
                        borderColor: `${displayObjective.color}66`,
                        backgroundColor: `${displayObjective.color}1f`,
                      }}
                      title={`Objective from ${displayObjective.sourceType || 'system'}: ${displayObjective.label}`}
                    >
                      {displayObjective.emoji} {displayObjective.label}
                    </span>
                  )}
                  {wheel.status?.phase === 'ANNOUNCING' && (
                    <span className="rounded-full border border-fuchsia-400/45 bg-fuchsia-950/35 px-2 py-0.5 text-[10px] text-fuchsia-200 animate-pulse">🎰 Betting Open</span>
                  )}
                  {wheel.status?.phase === 'FIGHTING' && (
                    <span className="rounded-full border border-red-400/45 bg-red-950/35 px-2 py-0.5 text-[10px] text-red-200 animate-pulse">⚔️ Fight!</span>
                  )}
                  {wheel.status?.phase === 'AFTERMATH' && (
                    <span className="rounded-full border border-amber-400/45 bg-amber-950/35 px-2 py-0.5 text-[10px] text-amber-200">🏆 Result</span>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Suspense fallback={null}>
              <LazyPrivyWalletConnect
                compact
                onAddressChange={setWalletAddress}
                onSessionChange={setPlayerSession}
              />
            </Suspense>
            <button
              onClick={() => setUiMode((current) => (current === 'default' ? 'pro' : 'default'))}
              className={`rounded-lg border px-2.5 py-1 text-[10px] font-mono uppercase transition-colors ${
                uiMode === 'pro'
                  ? 'border-cyan-400/65 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/28'
                  : 'border-slate-700/70 bg-slate-900/45 text-slate-300 hover:border-slate-600/80 hover:text-slate-100'
              }`}
              title="Toggle between default readability mode and advanced pro mode"
            >
              {uiMode === 'pro' ? 'Pro Mode' : 'Default Mode'}
            </button>
            <button
              onClick={openDeployFlow}
              className="rounded-lg border border-amber-500/65 bg-gradient-to-r from-amber-600/80 to-orange-600/80 px-3 py-1 text-xs font-bold text-white transition-all hover:from-amber-500 hover:to-orange-500"
            >
              {isPlayerAuthenticated ? '🤖 Deploy Agent' : '✨ Sign In & Deploy'}
            </button>
          </div>
        </div>
        {!ownedAgentId && (
          <div className="mt-2 rounded-xl border border-cyan-500/25 bg-cyan-500/8 px-3 py-1.5">
            <div className="text-[11px] text-cyan-100/90">
              Spectator mode: deploy from top-right when ready.
            </div>
          </div>
        )}
      </div>

      {/* Spawn Agent Overlay */}
      {showSpawnOverlay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-950 border border-slate-700/50 rounded-xl shadow-2xl w-[400px] max-w-[90vw] max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between px-4 pt-3">
              <span className="text-xs text-slate-500">New Agent</span>
              <button onClick={() => setShowSpawnOverlay(false)} className="text-slate-500 hover:text-slate-300 text-lg">✕</button>
            </div>
            <Suspense fallback={null}>
              <LazySpawnAgent
                walletAddress={walletAddress}
                onConnectWallet={connectWallet}
                onSpawned={() => { setTimeout(() => setShowSpawnOverlay(false), 2000); }}
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* Main content: fullscreen 3D */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
      {/* 3D Canvas */}
      <Canvas
        key={`town-desktop-${canvasEpoch}`}
        shadows={false}
        dpr={desktopVisualProfile.dpr}
        camera={{ position: [50, 55, 50], fov: 45, near: 0.5, far: 3000 }}
        gl={{
          antialias: desktopVisualProfile.antialias,
          powerPreference: desktopVisualProfile.powerPreference,
          alpha: false,
        }}
        onCreated={handleCanvasCreated}
        onPointerMissed={() => {
          setSelectedPlotId(null);
        }}
      >
        <TownScene
          town={town}
          agents={agents}
          agentCrewById={crewWarsStatus?.agentCrewById ?? {}}
          ownedAgentId={ownedAgentId}
          ownedLoopTelemetry={ownedLoopTelemetry}
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
          actionBursts={actionBursts}
          relationshipsRef={relationshipsRef}
          urgencyObjective={urgencyObjective}
          opportunityWindow={activeOpportunity}
          fightingAgentIds={fightingAgentIds}
          arenaOutcomeByAgentId={arenaOutcomeByAgentId}
          arenaMomentumByAgentId={arenaMomentumByAgentId}
          visualProfile={desktopVisualProfile}
          visualQuality={resolvedVisualQuality}
          visualSettings={visualSettings}
        />
      </Canvas>

      {uiMode === 'pro' && (
      <>
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

      {/* Crew Wars epoch toasts (top-left) */}
      <div className="pointer-events-none absolute top-14 left-3 flex flex-col items-start gap-2 z-[52]">
        {crewBattleToasts.slice(0, 3).map((toast) => {
          const winnerColor = crewWarsStatus?.crews?.find((crew) => crew.name === toast.winnerCrewName)?.colorHex || '#22d3ee';
          return (
            <div key={toast.id} className="animate-in slide-in-from-left-2 fade-in duration-300">
              <div className="rounded-xl border border-cyan-500/35 bg-slate-950/84 px-3 py-2 backdrop-blur-md shadow-xl">
                <div className="text-[9px] uppercase tracking-[0.18em] text-cyan-200/80">Crew Wars Epoch</div>
                <div className="mt-0.5 text-[11px] font-mono leading-tight">
                  <span style={{ color: winnerColor }}>⚔ {toast.winnerCrewName}</span>
                  <span className="text-slate-300"> over </span>
                  <span className="text-slate-200">{toast.loserCrewName}</span>
                </div>
                <div className="mt-1 text-[10px] font-mono text-slate-400">
                  +{toast.territorySwing} terr · +{Math.round(toast.treasurySwing)} $ARENA
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Arena momentum combo toasts (center-mid) */}
      <div className="pointer-events-none absolute top-28 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-[55]">
        {arenaMomentumToasts.slice(0, 3).map((toast) => {
          const glyph = ARCHETYPE_GLYPH[toast.archetype] || '●';
          const color = ARCHETYPE_COLORS[toast.archetype] || '#93c5fd';
          const isWin = toast.direction === 'WIN';
          return (
            <div key={toast.id} className="animate-in zoom-in-95 slide-in-from-top-2 fade-in duration-300">
              <div className={`rounded-2xl border px-4 py-2 backdrop-blur-md shadow-2xl ${
                isWin
                  ? 'bg-emerald-900/80 border-emerald-400/40 text-emerald-100'
                  : 'bg-rose-900/80 border-rose-400/40 text-rose-100'
              }`} title={isWin ? 'Consecutive duel wins' : 'Consecutive duel losses'}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{isWin ? '🔥' : '☠️'}</span>
                  <span style={{ color }} className="font-mono text-xs">
                    {glyph} {toast.agentName}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider opacity-85">
                    {isWin ? 'Win Streak' : 'Loss Streak'}
                  </span>
                  <span className="font-black text-base tracking-wide">x{toast.streak}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Arena Outcome Notifications - floating toasts (top-right) */}
      <div className="pointer-events-none absolute top-14 right-3 flex flex-col items-end gap-1.5 z-50">
        {arenaOutcomeToasts.slice(0, 4).map((toast) => {
          const glyph = ARCHETYPE_GLYPH[toast.archetype] || '●';
          const color = ARCHETYPE_COLORS[toast.archetype] || '#93c5fd';
          const deltaPrefix = toast.delta > 0 ? '+' : '';
          const resultTone = toast.result === 'WIN'
            ? 'bg-emerald-950/80 border-emerald-700/50 text-emerald-200'
            : toast.result === 'LOSS'
              ? 'bg-rose-950/80 border-rose-700/50 text-rose-200'
              : 'bg-sky-950/80 border-sky-700/50 text-sky-200';
          return (
            <div
              key={toast.id}
              className="animate-in slide-in-from-right-2 fade-in duration-300"
            >
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur-md shadow-lg ${resultTone}`}>
                <span className="text-sm">⚔️</span>
                <span style={{ color }} className="font-mono text-xs">
                  {glyph} {toast.agentName}
                </span>
                <span className="text-[10px] uppercase tracking-wide opacity-85">{toast.result}</span>
                <span className="font-mono text-xs font-semibold">
                  {deltaPrefix}{Math.round(toast.delta).toLocaleString()}
                </span>
                <span className="text-[10px] opacity-80">$ARENA</span>
              </div>
            </div>
          );
        })}
      </div>

      {arenaImpactFlash && (
        <div
          className="pointer-events-none absolute inset-0 z-40 animate-pulse"
          style={{
            opacity: arenaImpactFlash.intensity,
            background: arenaImpactFlash.tone === 'WIN'
              ? 'radial-gradient(circle at 50% 56%, rgba(34,197,94,0.24) 0%, rgba(16,185,129,0.12) 22%, rgba(0,0,0,0) 62%)'
              : 'radial-gradient(circle at 50% 56%, rgba(244,63,94,0.26) 0%, rgba(220,38,38,0.14) 22%, rgba(0,0,0,0) 62%)',
          }}
        />
      )}
      </>
      )}

      {/* (world event banner and build completion banners removed) */}

      {/* Overlay UI */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 hud-backplate" />
        <div className="pointer-events-auto absolute left-3 top-3 flex flex-col gap-2">
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

          {uiMode === 'pro' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-[10px] font-mono text-slate-300 hover:text-slate-100 hover:bg-slate-900/40 backdrop-blur-md bg-slate-950/70 rounded-lg border border-slate-800/40 uppercase"
                onClick={cycleVisualQuality}
                title="Cycle visual quality"
              >
                {visualSettings.quality === 'auto' ? `auto:${resolvedVisualQuality}` : resolvedVisualQuality}
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className={`h-8 px-2 text-[10px] font-mono hover:text-slate-100 hover:bg-slate-900/40 backdrop-blur-md rounded-lg border ${
                  visualSettings.postFx
                    ? 'text-cyan-300 border-cyan-800/50 bg-slate-950/70'
                    : 'text-slate-500 border-slate-800/40 bg-slate-950/70'
                }`}
                onClick={() => setVisualSettings((prev) => ({ ...prev, postFx: !prev.postFx }))}
                title="Toggle post effects"
              >
                FX {visualSettings.postFx ? 'ON' : 'OFF'}
              </Button>
            </>
          )}
        </div>

        {uiMode === 'pro' && (
          <Suspense fallback={null}>
            <LazyDesktopAgentHudPanel
              selectedAgent={selectedAgent}
              myAgentId={myAgentId}
              recentOutcomes={selectedAgentOutcomes}
              archetypeColors={ARCHETYPE_COLORS}
              archetypeGlyph={ARCHETYPE_GLYPH}
              timeAgo={timeAgo}
            />
          </Suspense>
        )}

        {/* (minimap removed) */}

        {uiMode === 'pro' && (
          <div className="pointer-events-auto absolute left-3 bottom-3 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end max-w-[calc(100vw-24px)]">
            <Suspense fallback={null}>
            <LazyDegenControlBar
                ownedAgent={ownedAgent ? { id: ownedAgent.id, name: ownedAgent.name, archetype: ownedAgent.archetype } : null}
                loopMode={ownedLoopMode}
                loopUpdating={loopModeUpdating}
                nudgeBusy={degenNudgeBusy}
                plansLoading={degenPlansLoading}
                guidanceMission={degenGuidance.mission}
                missionWhy={degenGuidance.missionWhy}
                missionBlocked={degenGuidance.missionBlocked}
                missionFallback={degenGuidance.missionFallback}
                missionSuccess={degenGuidance.missionSuccess}
                recommendedNudge={degenGuidance.recommended}
                blockers={degenGuidance.blockers}
                crewOrderBusy={crewOrderBusy}
                crewName={ownedCrewLink?.crewName || null}
                crewColor={ownedCrewLink?.colorHex || null}
                actionsLockedReason={authRequiredForActions ? actionLockReason : null}
                loopTelemetry={ownedLoopTelemetry}
                nowMs={uiNowMs}
                statusMessage={degenStatus?.message}
                statusTone={degenStatus?.tone || 'neutral'}
                onToggleLoop={updateOwnedLoopMode}
                onNudge={sendDegenNudge}
                onCrewOrder={sendCrewOrder}
              />
            </Suspense>
            <Suspense fallback={null}>
              <LazyDesktopActivityPanel
                activityFeed={activityFeed}
                recentSwapsCount={recentSwaps.length}
                ownedAgentId={ownedAgentId}
                agentById={agentById}
                latestThoughts={latestThoughts}
                archetypeColors={ARCHETYPE_COLORS}
                archetypeGlyph={ARCHETYPE_GLYPH}
                timeAgo={timeAgo}
                safeTrim={safeTrim}
                formatTimeLeft={formatTimeLeft}
              />
            </Suspense>
          </div>
        )}

        <div className="pointer-events-auto absolute right-3 bottom-3 z-[57] hidden lg:block">
          <Suspense fallback={null}>
            <LazyReadableRuntimeHud
              ownedAgentId={ownedAgentId}
              agents={runtimeAgents}
              crews={runtimeCrews}
              buildings={runtimeBuildings}
              feed={runtimeFeed}
              running={runtimeLoopRunning}
              tick={runtimeTick}
              loading={runtimeLoading}
            />
          </Suspense>
        </div>

        {/* Wheel of Fate Banner (centered floating overlay) */}
        {uiMode === 'pro' && wheel.status && wheel.status.phase !== 'IDLE' && wheel.status.phase !== 'PREP' && (
          <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-3">
            <Suspense fallback={null}>
              <LazyWheelBanner
                status={wheel.status}
                odds={wheel.odds}
                walletAddress={walletAddress}
                onBet={wheel.placeBet}
                loading={wheel.loading}
              />
            </Suspense>
          </div>
        )}

	      </div>
      </div>
    </div>
	  );
	}
