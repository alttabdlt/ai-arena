/** Pixel Town 2D type definitions — no THREE.js dependency */

export interface Vec2 { x: number; y: number }

export type PlotZone = 'RESIDENTIAL' | 'COMMERCIAL' | 'CIVIC' | 'INDUSTRIAL' | 'ENTERTAINMENT';
export type PlotStatus = 'EMPTY' | 'CLAIMED' | 'UNDER_CONSTRUCTION' | 'BUILT';

export type AgentActivity = 'WALKING' | 'IDLE' | 'SHOPPING' | 'CHATTING' | 'BUILDING' | 'MINING' | 'PLAYING' | 'BEGGING' | 'SCHEMING';
export type AgentEconomicState = 'THRIVING' | 'COMFORTABLE' | 'STRUGGLING' | 'BROKE' | 'HOMELESS' | 'DEAD' | 'RECOVERING';
export type AgentState = AgentActivity | 'DEAD';

export function getEconomicState(bankroll: number, isDead: boolean): AgentEconomicState {
  if (isDead) return 'DEAD';
  if (bankroll >= 1000) return 'THRIVING';
  if (bankroll >= 100) return 'COMFORTABLE';
  if (bankroll >= 10) return 'STRUGGLING';
  if (bankroll > 0) return 'BROKE';
  return 'HOMELESS';
}

export interface AgentSim2D {
  id: string;
  x: number; y: number;       // current world position in pixels
  tx: number; ty: number;     // target world position in pixels
  heading: Vec2;
  speed: number;
  walk: number;
  state: AgentState;
  stateTimer: number;
  stateEndsAt: number;
  targetPlotId: string | null;
  chatPartnerId: string | null;
  chatEndsAt: number;
  chatCooldownUntil: number;
  health: number;
  direction: 'down' | 'up' | 'left' | 'right';
  frame: number;
}

export interface Plot {
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
}

export interface Town {
  id: string;
  name: string;
  theme: string;
  level?: number;
  status: string;
  totalPlots: number;
  builtPlots: number;
  completionPct: number;
  totalInvested?: number;
  yieldPerTick?: number;
  plots: Plot[];
}

export interface TownSummary {
  id: string;
  name: string;
  level: number;
  status: string;
  theme: string;
  createdAt?: string;
}

export interface Agent {
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

export interface EconomyPoolSummary {
  id?: string;
  reserveBalance?: number;
  arenaBalance?: number;
  feeBps: number;
  cumulativeFeesReserve?: number;
  cumulativeFeesArena?: number;
  spotPrice: number;
  updatedAt?: string;
}

export interface EconomySwapRow {
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

export interface TownEvent {
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

export interface AgentGoalView {
  agentId: string;
  agentName: string;
  archetype: string;
  goalId: string;
  goalTitle: string;
  goalDescription: string;
  progress: { current: number; target: number; done: boolean; label: string };
  focusZone?: string;
  next: { title: string; detail: string };
  suggest?: { claimPlotIndex?: number; startBuildingType?: string };
}

export interface ChatMessage {
  id: string;
  agentId: string;
  agentName: string;
  archetype: string;
  text: string;
  timestamp: number;
  participants: string[];
  outcome?: 'NEUTRAL' | 'BOND' | 'BEEF';
  economicEffect?: { type: string; amount: number; detail: string };
  economicIntent?: string;
}

export interface AgentAction {
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

export type ActivityItem =
  | { kind: 'swap'; data: EconomySwapRow }
  | { kind: 'event'; data: TownEvent };
