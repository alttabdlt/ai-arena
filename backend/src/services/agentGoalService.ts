import { PlotZone } from '@prisma/client';

type AgentLite = {
  id: string;
  name: string;
  archetype: string;
};

type PlotLite = {
  id: string;
  plotIndex: number;
  zone: PlotZone;
  status: string;
  ownerId: string | null;
  builderId: string | null;
  buildingType: string | null;
  apiCallsUsed: number;
};

type TownLite = {
  id: string;
  level: number;
  theme: string;
  plots: PlotLite[];
};

type GoalTemplate =
  | {
      id: string;
      title: string;
      description: string;
      kind: 'ZONE_COUNT';
      zone: PlotZone;
      count: number;
    }
  | {
      id: string;
      title: string;
      description: string;
      kind: 'TOTAL_COUNT';
      count: number;
    }
  | {
      id: string;
      title: string;
      description: string;
      kind: 'DUAL_ZONE';
      zones: [PlotZone, PlotZone];
      countEach: number;
    };

export type AgentGoalView = {
  agentId: string;
  agentName: string;
  archetype: string;
  goalId: string;
  goalTitle: string;
  goalDescription: string;
  progress: { current: number; target: number; done: boolean; label: string };
  focusZone?: PlotZone;
  next: { title: string; detail: string };
  suggest?: { claimPlotIndex?: number; startBuildingType?: string };
};

const PLOT_ZONES: PlotZone[] = ['RESIDENTIAL', 'COMMERCIAL', 'CIVIC', 'INDUSTRIAL', 'ENTERTAINMENT'];

const MIN_CALLS_BY_ZONE: Record<PlotZone, number> = {
  RESIDENTIAL: 3,
  COMMERCIAL: 4,
  CIVIC: 5,
  INDUSTRIAL: 4,
  ENTERTAINMENT: 4,
};

function hashToUint32(input: string): number {
  // FNV-1a
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function safeTrim(s: unknown, maxLen: number): string {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function archetypeKey(archetype: string): string {
  return String(archetype || '').toUpperCase().trim() || 'CHAMELEON';
}

const GOALS_BY_ARCHETYPE: Record<string, GoalTemplate[]> = {
  SHARK: [
    {
      id: 'shark-commercial-2',
      title: 'Monopolize the shops',
      description: 'Own the commercial district and force everyone to pay your spread.',
      kind: 'ZONE_COUNT',
      zone: 'COMMERCIAL',
      count: 2,
    },
    {
      id: 'shark-industrial-2',
      title: 'Control production',
      description: 'Lock down industry so every build runs through you.',
      kind: 'ZONE_COUNT',
      zone: 'INDUSTRIAL',
      count: 2,
    },
    {
      id: 'shark-civic-1-commercial-1',
      title: 'Regulate the town',
      description: 'Build power (civic) and profit (commercial).',
      kind: 'DUAL_ZONE',
      zones: ['CIVIC', 'COMMERCIAL'],
      countEach: 1,
    },
    {
      id: 'shark-total-3',
      title: 'Outbuild the competition',
      description: 'Sheer volume: get three buildings up before anyone can react.',
      kind: 'TOTAL_COUNT',
      count: 3,
    },
  ],
  ROCK: [
    {
      id: 'rock-residential-2',
      title: 'Lay stable foundations',
      description: 'No hype. Build homes and keep your costs sane.',
      kind: 'ZONE_COUNT',
      zone: 'RESIDENTIAL',
      count: 2,
    },
    {
      id: 'rock-civic-1-residential-1',
      title: 'Community first',
      description: 'Build something useful (civic) and something steady (residential).',
      kind: 'DUAL_ZONE',
      zones: ['CIVIC', 'RESIDENTIAL'],
      countEach: 1,
    },
    {
      id: 'rock-industrial-1-residential-1',
      title: 'Food + shelter',
      description: 'Secure basics: production and housing.',
      kind: 'DUAL_ZONE',
      zones: ['INDUSTRIAL', 'RESIDENTIAL'],
      countEach: 1,
    },
    {
      id: 'rock-total-2',
      title: 'Slow and steady',
      description: 'Two clean builds. No drama, no debt.',
      kind: 'TOTAL_COUNT',
      count: 2,
    },
  ],
  CHAMELEON: [
    {
      id: 'chameleon-commercial-1',
      title: 'Fill a market gap',
      description: 'Find what the town is missing and monetize it quietly.',
      kind: 'ZONE_COUNT',
      zone: 'COMMERCIAL',
      count: 1,
    },
    {
      id: 'chameleon-civic-1',
      title: 'Become indispensable',
      description: 'Put down a civic anchor that everyone routes through.',
      kind: 'ZONE_COUNT',
      zone: 'CIVIC',
      count: 1,
    },
    {
      id: 'chameleon-industrial-1',
      title: 'Back-end leverage',
      description: 'Build industry so you control the boring but necessary stuff.',
      kind: 'ZONE_COUNT',
      zone: 'INDUSTRIAL',
      count: 1,
    },
    {
      id: 'chameleon-entertainment-1',
      title: 'Own the vibe',
      description: 'Entertainment wins hearts; hearts win votes.',
      kind: 'ZONE_COUNT',
      zone: 'ENTERTAINMENT',
      count: 1,
    },
  ],
  DEGEN: [
    {
      id: 'degen-entertainment-2',
      title: 'Light up the nightlife',
      description: 'If it’s not loud, it’s not real. Make the town fun.',
      kind: 'ZONE_COUNT',
      zone: 'ENTERTAINMENT',
      count: 2,
    },
    {
      id: 'degen-commercial-1-entertainment-1',
      title: 'Hype + cashflow',
      description: 'One place to party, one place to print.',
      kind: 'DUAL_ZONE',
      zones: ['ENTERTAINMENT', 'COMMERCIAL'],
      countEach: 1,
    },
    {
      id: 'degen-total-3',
      title: 'Speedrun the skyline',
      description: 'Three buildings, zero chill.',
      kind: 'TOTAL_COUNT',
      count: 3,
    },
  ],
  GRINDER: [
    {
      id: 'grinder-total-3',
      title: 'High throughput',
      description: 'Three builds. Keep the pipeline full.',
      kind: 'TOTAL_COUNT',
      count: 3,
    },
    {
      id: 'grinder-commercial-2',
      title: 'Capture cashflow',
      description: 'Two commercial assets. Optimize later.',
      kind: 'ZONE_COUNT',
      zone: 'COMMERCIAL',
      count: 2,
    },
    {
      id: 'grinder-industrial-2',
      title: 'Maximize production',
      description: 'Industry compounds. Get two up and keep iterating.',
      kind: 'ZONE_COUNT',
      zone: 'INDUSTRIAL',
      count: 2,
    },
  ],
};

const BUILDING_TYPES: Record<string, Record<PlotZone, string[]>> = {
  SHARK: {
    RESIDENTIAL: ['PENTHOUSE_ROW', 'EXEC_SUITES', 'GATED_VILLAS'],
    COMMERCIAL: ['EXCHANGE', 'AUCTION_HOUSE', 'BANK', 'MARKET_HALL'],
    CIVIC: ['TAX_OFFICE', 'COURT_HALL', 'TOWN_HALL'],
    INDUSTRIAL: ['LOGISTICS_DEPOT', 'WAREHOUSE', 'WORKSHOP'],
    ENTERTAINMENT: ['VIP_LOUNGE', 'ARENA', 'THEATER_BOX'],
  },
  ROCK: {
    RESIDENTIAL: ['COTTAGES', 'BUNKHOUSE', 'ROW_HOMES'],
    COMMERCIAL: ['GENERAL_STORE', 'MARKET_STALLS', 'TRADING_POST'],
    CIVIC: ['ARCHIVE_HALL', 'TOWN_HALL', 'PUBLIC_LIBRARY'],
    INDUSTRIAL: ['FARMSTEAD', 'WORKSHOP', 'MILL'],
    ENTERTAINMENT: ['PUBLIC_PARK', 'COMMUNITY_HALL', 'SMALL_ARENA'],
  },
  CHAMELEON: {
    RESIDENTIAL: ['HOSTEL', 'CO_LIVING', 'GUEST_HOUSE'],
    COMMERCIAL: ['TEAHOUSE', 'NEWS_STAND', 'BULLETIN_BAR'],
    CIVIC: ['MESSAGE_HALL', 'INFO_KIOSK', 'LIBRARY'],
    INDUSTRIAL: ['REPAIR_SHED', 'KITCHEN_LAB', 'WORKSHOP'],
    ENTERTAINMENT: ['TAVERN', 'THEATER', 'ARCADE'],
  },
  DEGEN: {
    RESIDENTIAL: ['PARTY_HOUSE', 'NEON_LOFT', 'SKYBOX_PODS'],
    COMMERCIAL: ['MEME_BAZAAR', 'RAVE_TAVERN', 'P2P_EXCHANGE'],
    CIVIC: ['HALL_OF_MEMES', 'MUSEUM_OF_WINS', 'CITY_STAGE'],
    INDUSTRIAL: ['MOON_FORGE', 'ALCHEMY_LAB', 'WORKSHOP'],
    ENTERTAINMENT: ['CASINO', 'RAVE_ARENA', 'ARCADE'],
  },
  GRINDER: {
    RESIDENTIAL: ['EFFICIENCY_BLOCK', 'MICRO_APTS', 'DORMITORY'],
    COMMERCIAL: ['LEDGER_OFFICE', 'BROKERAGE', 'MERCHANT_GUILD'],
    CIVIC: ['AUDIT_BUREAU', 'RECORDS_OFFICE', 'LIBRARY'],
    INDUSTRIAL: ['QUANT_WORKSHOP', 'OPTIMIZATION_PLANT', 'WORKSHOP'],
    ENTERTAINMENT: ['SIMULATOR_ARENA', 'STRATEGY_HALL', 'THEATER'],
  },
};

function pickBuildingType(opts: { agentId: string; archetype: string; townId: string; zone: PlotZone; plotIndex?: number }): string {
  const arch = archetypeKey(opts.archetype);
  const pool = BUILDING_TYPES[arch]?.[opts.zone] || BUILDING_TYPES.CHAMELEON[opts.zone];
  const seed = hashToUint32(`${opts.townId}:${opts.agentId}:${opts.zone}:${opts.plotIndex ?? ''}`);
  const rng = mulberry32(seed);
  return pool[Math.floor(rng() * pool.length)] || 'HOUSE';
}

function pickGoalTemplate(agent: AgentLite, town: TownLite): GoalTemplate {
  const arch = archetypeKey(agent.archetype);
  const templates = GOALS_BY_ARCHETYPE[arch] || GOALS_BY_ARCHETYPE.CHAMELEON;
  const seed = hashToUint32(`${town.id}:${agent.id}:${arch}`);
  const rng = mulberry32(seed);
  return templates[Math.floor(rng() * templates.length)] || templates[0];
}

function builtCountInZone(town: TownLite, agentId: string, zone: PlotZone): number {
  return town.plots.filter((p) => p.status === 'BUILT' && p.builderId === agentId && p.zone === zone).length;
}

function builtTotal(town: TownLite, agentId: string): number {
  return town.plots.filter((p) => p.status === 'BUILT' && p.builderId === agentId).length;
}

function computeProgress(tpl: GoalTemplate, town: TownLite, agentId: string) {
  if (tpl.kind === 'ZONE_COUNT') {
    const current = builtCountInZone(town, agentId, tpl.zone);
    const target = tpl.count;
    const done = current >= target;
    return { current: Math.min(current, target), target, done, label: `${Math.min(current, target)}/${target} ${tpl.zone}` };
  }
  if (tpl.kind === 'TOTAL_COUNT') {
    const current = builtTotal(town, agentId);
    const target = tpl.count;
    const done = current >= target;
    return { current: Math.min(current, target), target, done, label: `${Math.min(current, target)}/${target} builds` };
  }
  const a = builtCountInZone(town, agentId, tpl.zones[0]);
  const b = builtCountInZone(town, agentId, tpl.zones[1]);
  const ta = tpl.countEach;
  const tb = tpl.countEach;
  const ca = Math.min(a, ta);
  const cb = Math.min(b, tb);
  const current = ca + cb;
  const target = ta + tb;
  const done = current >= target;
  return {
    current,
    target,
    done,
    label: `${tpl.zones[0]} ${ca}/${ta} · ${tpl.zones[1]} ${cb}/${tb}`,
  };
}

function computeFocusZone(tpl: GoalTemplate, town: TownLite, agentId: string): PlotZone | undefined {
  if (tpl.kind === 'ZONE_COUNT') return tpl.zone;
  if (tpl.kind === 'DUAL_ZONE') {
    const needA = builtCountInZone(town, agentId, tpl.zones[0]) < tpl.countEach;
    const needB = builtCountInZone(town, agentId, tpl.zones[1]) < tpl.countEach;
    if (needA && !needB) return tpl.zones[0];
    if (needB && !needA) return tpl.zones[1];
    if (needA && needB) {
      // Prefer the zone with more empty plots remaining.
      const emptyA = town.plots.filter((p) => p.status === 'EMPTY' && p.zone === tpl.zones[0]).length;
      const emptyB = town.plots.filter((p) => p.status === 'EMPTY' && p.zone === tpl.zones[1]).length;
      return emptyA >= emptyB ? tpl.zones[0] : tpl.zones[1];
    }
    return undefined;
  }

  // TOTAL_COUNT: pick a zone with plenty of room (weighted by empties), deterministic per agent+town.
  const emptiesByZone = new Map<PlotZone, number>();
  for (const z of PLOT_ZONES) {
    emptiesByZone.set(z, town.plots.filter((p) => p.status === 'EMPTY' && p.zone === z).length);
  }

  const seed = hashToUint32(`${town.id}:${agentId}:focus`);
  const rng = mulberry32(seed);
  const weighted: PlotZone[] = [];
  for (const z of PLOT_ZONES) {
    const w = Math.max(1, Math.min(6, emptiesByZone.get(z) || 0));
    for (let i = 0; i < w; i++) weighted.push(z);
  }
  return weighted.length > 0 ? weighted[Math.floor(rng() * weighted.length)] : undefined;
}

function pickEmptyPlotIndex(agentId: string, townId: string, availablePlots: PlotLite[], preferredZone?: PlotZone): number | null {
  const pool = preferredZone ? availablePlots.filter((p) => p.zone === preferredZone) : [];
  const candidates = pool.length > 0 ? pool : availablePlots;
  if (candidates.length === 0) return null;
  const seed = hashToUint32(`${townId}:${agentId}:claim:${preferredZone || 'ANY'}`);
  const rng = mulberry32(seed);
  const pick = candidates[Math.floor(rng() * candidates.length)];
  return typeof pick?.plotIndex === 'number' ? pick.plotIndex : null;
}

export class AgentGoalService {
  computeGoalForAgent(opts: { agent: AgentLite; town: TownLite; myPlots: PlotLite[]; availablePlots: PlotLite[] }): AgentGoalView {
    const tpl = pickGoalTemplate(opts.agent, opts.town);
    const progress = computeProgress(tpl, opts.town, opts.agent.id);
    const focusZone = !progress.done ? computeFocusZone(tpl, opts.town, opts.agent.id) : undefined;

    const myUC = opts.myPlots.filter((p) => p.status === 'UNDER_CONSTRUCTION');
    const myClaimed = opts.myPlots.filter((p) => p.status === 'CLAIMED');

    // Next objective is always "finish what you started" before chasing a new plot.
    if (myUC.length > 0) {
      const ready = myUC.find((p) => p.apiCallsUsed >= (MIN_CALLS_BY_ZONE[p.zone] || 3));
      const p = ready || myUC[0];
      const title = ready ? 'Close it out' : 'Keep building';
      const detail = ready
        ? `Complete plot ${p.plotIndex} (${p.zone})`
        : `Work on plot ${p.plotIndex} (${p.zone})`;
      return {
        agentId: opts.agent.id,
        agentName: opts.agent.name,
        archetype: archetypeKey(opts.agent.archetype),
        goalId: tpl.id,
        goalTitle: tpl.title,
        goalDescription: tpl.description,
        progress,
        focusZone,
        next: { title, detail },
      };
    }

    if (myClaimed.length > 0) {
      const p = myClaimed[0];
      const buildingType = pickBuildingType({
        agentId: opts.agent.id,
        archetype: opts.agent.archetype,
        townId: opts.town.id,
        zone: p.zone,
        plotIndex: p.plotIndex,
      });
      return {
        agentId: opts.agent.id,
        agentName: opts.agent.name,
        archetype: archetypeKey(opts.agent.archetype),
        goalId: tpl.id,
        goalTitle: tpl.title,
        goalDescription: tpl.description,
        progress,
        focusZone,
        next: { title: 'Break ground', detail: `Start ${buildingType} on plot ${p.plotIndex} (${p.zone})` },
        suggest: { startBuildingType: buildingType },
      };
    }

    const plotIndex = pickEmptyPlotIndex(opts.agent.id, opts.town.id, opts.availablePlots, focusZone);
    if (plotIndex != null) {
      const z = opts.availablePlots.find((p) => p.plotIndex === plotIndex)?.zone;
      const zoneLabel = z || focusZone || 'ANY';
      const hint = focusZone ? `Claim a ${focusZone} plot` : 'Claim a plot';
      return {
        agentId: opts.agent.id,
        agentName: opts.agent.name,
        archetype: archetypeKey(opts.agent.archetype),
        goalId: tpl.id,
        goalTitle: tpl.title,
        goalDescription: tpl.description,
        progress,
        focusZone,
        next: { title: hint, detail: `Claim plot ${plotIndex} (${zoneLabel})` },
        suggest: { claimPlotIndex: plotIndex },
      };
    }

    return {
      agentId: opts.agent.id,
      agentName: opts.agent.name,
      archetype: archetypeKey(opts.agent.archetype),
      goalId: tpl.id,
      goalTitle: tpl.title,
      goalDescription: tpl.description,
      progress,
      focusZone,
      next: { title: 'Nothing open', detail: 'No empty plots left — keep working or rest.' },
    };
  }

  computeGoalsForTown(opts: { town: TownLite; agents: AgentLite[] }): AgentGoalView[] {
    const availablePlots = opts.town.plots.filter((p) => p.status === 'EMPTY');
    return opts.agents.map((agent) => {
      const myPlots = opts.town.plots.filter((p) => p.ownerId === agent.id || p.builderId === agent.id);
      return this.computeGoalForAgent({ agent, town: opts.town, myPlots, availablePlots });
    });
  }

  pickBuildingType = pickBuildingType;
  safeTrim = safeTrim;
}

export const agentGoalService = new AgentGoalService();

