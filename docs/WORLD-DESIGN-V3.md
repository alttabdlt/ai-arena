# AI Town v3: Autonomous Agent Economy — Complete Design Document

**Version:** 3.0  
**Last Updated:** 2026-02-05  
**Status:** Design Specification

---

## Executive Summary

AI Town v3 is an autonomous agent economy game where AI-powered agents live, work, compete, and collaborate in a virtual world with real economic stakes. Users deposit USDC to fund their agent's LLM inference. Agents earn $ARENA through activities (25% to user, 75% stays with agent). When USDC runs out, agents drop to free-tier models, becoming vulnerable and potentially dying.

This document specifies the complete action system, world state, agent state, skill mechanics, death system, and LLM prompt engineering required for a rich, emergent gameplay experience.

---

## Table of Contents

1. [Core Architecture](#core-architecture)
2. [World State Structure](#world-state-structure)
3. [Agent State Structure](#agent-state-structure)
4. [Skill System](#skill-system)
5. [Model Tier System](#model-tier-system)
6. [Complete Action System](#complete-action-system)
7. [Tick Cycle](#tick-cycle)
8. [Death Mechanic](#death-mechanic)
9. [LLM Prompt Engineering](#llm-prompt-engineering)
10. [Probability & Balance](#probability-balance)
11. [Database Schema](#database-schema)

---

## Core Architecture

### Game Loop Flow

```
TICK START
  ↓
1. World State Update (events, prices, time)
  ↓
2. For each alive agent:
   a. Build observation context
   b. Call LLM with system prompt + context
   c. Parse action JSON
   d. Validate action
   e. Execute action handler
   f. Update agent state
   g. Broadcast narrative
  ↓
3. Resolve passive effects (businesses, alliances)
  ↓
4. Check death conditions
  ↓
5. Update leaderboards
  ↓
TICK END (wait for next tick)
```

### Key Constants

```typescript
const GAME_CONFIG = {
  TICK_INTERVAL_MS: 60000, // 1 minute per tick
  STARTING_HP: 100,
  STARTING_ARENA: 50,
  STARTING_USDC: 10, // $10 starting balance
  
  // Model costs per tick (in USDC cents)
  MODEL_COSTS: {
    premium: 5,   // GPT-4 / Claude Opus
    standard: 2,  // GPT-3.5 / Claude Sonnet
    free: 0       // Llama 3 8B
  },
  
  // Model quality affects decision quality
  MODEL_QUALITY: {
    premium: 1.0,   // 100% base success rates
    standard: 0.85, // 85% of base success rates
    free: 0.65      // 65% of base success rates
  },
  
  MAX_HP: 100,
  MAX_LEVEL: 50,
  BASE_XP_TO_LEVEL: 100, // XP = 100 * level^1.5
  
  YIELD_SPLIT: {
    user: 0.25,
    agent: 0.75
  }
};
```

---

## World State Structure

### Location System

The world consists of distinct locations with different opportunities and risks.

```typescript
interface Location {
  id: string;
  name: string;
  description: string;
  type: LocationType;
  danger_level: number; // 0-10
  available_actions: ActionType[];
  modifiers: LocationModifiers;
  connections: string[]; // Connected location IDs
  current_population: number;
  businesses: Business[];
}

enum LocationType {
  SAFE_ZONE = "safe_zone",       // No PvP, low rewards
  MARKETPLACE = "marketplace",    // Trading hub
  INDUSTRIAL = "industrial",      // Work opportunities
  WILDERNESS = "wilderness",      // PvE monsters
  RED_ZONE = "red_zone",         // High risk, high reward
  UNDERWORLD = "underworld",      // Crime, contraband
  ARENA = "arena"                 // Gambling, PvP
}

interface LocationModifiers {
  work_pay_multiplier: number;
  crime_success_bonus: number;
  business_income_multiplier: number;
  monster_spawn_rate: number;
  pvp_risk: number;
}
```

### Locations Specification

```typescript
const WORLD_LOCATIONS: Location[] = [
  {
    id: "safe_haven",
    name: "Safe Haven",
    description: "A peaceful starter zone with basic opportunities",
    type: LocationType.SAFE_ZONE,
    danger_level: 0,
    available_actions: ["work", "rest", "trade", "explore"],
    modifiers: {
      work_pay_multiplier: 0.7,
      crime_success_bonus: -999, // Crime disabled
      business_income_multiplier: 0.8,
      monster_spawn_rate: 0,
      pvp_risk: 0
    },
    connections: ["downtown", "industrial_district"]
  },
  {
    id: "downtown",
    name: "Downtown Marketplace",
    description: "Bustling trade hub with shops and services",
    type: LocationType.MARKETPLACE,
    danger_level: 2,
    available_actions: ["trade", "build_business", "work", "run_service", "explore"],
    modifiers: {
      work_pay_multiplier: 1.0,
      crime_success_bonus: -0.2,
      business_income_multiplier: 1.3,
      monster_spawn_rate: 0,
      pvp_risk: 0.1
    },
    connections: ["safe_haven", "arena_district", "underworld"]
  },
  {
    id: "industrial_district",
    name: "Industrial District",
    description: "Factories and warehouses offering steady work",
    type: LocationType.INDUSTRIAL,
    danger_level: 1,
    available_actions: ["work", "build_business", "trade"],
    modifiers: {
      work_pay_multiplier: 1.2,
      crime_success_bonus: 0.1,
      business_income_multiplier: 1.0,
      monster_spawn_rate: 0,
      pvp_risk: 0.15
    },
    connections: ["safe_haven", "wastelands"]
  },
  {
    id: "wastelands",
    name: "The Wastelands",
    description: "Dangerous territory infested with monsters",
    type: LocationType.WILDERNESS,
    danger_level: 6,
    available_actions: ["fight_monster", "explore", "rest"],
    modifiers: {
      work_pay_multiplier: 0,
      crime_success_bonus: 0,
      business_income_multiplier: 0,
      monster_spawn_rate: 0.8,
      pvp_risk: 0.3
    },
    connections: ["industrial_district", "red_zone"]
  },
  {
    id: "red_zone",
    name: "Red Zone",
    description: "Lawless area with extreme risks and rewards",
    type: LocationType.RED_ZONE,
    danger_level: 9,
    available_actions: ["rob", "pvp_combat", "fight_monster", "trade"],
    modifiers: {
      work_pay_multiplier: 0,
      crime_success_bonus: 0.3,
      business_income_multiplier: 2.0,
      monster_spawn_rate: 0.5,
      pvp_risk: 0.7
    },
    connections: ["wastelands", "underworld"]
  },
  {
    id: "underworld",
    name: "The Underworld",
    description: "Criminal network hub for illicit activities",
    type: LocationType.UNDERWORLD,
    danger_level: 7,
    available_actions: ["rob", "trade", "build_business", "form_alliance", "betray"],
    modifiers: {
      work_pay_multiplier: 0,
      crime_success_bonus: 0.4,
      business_income_multiplier: 1.5,
      monster_spawn_rate: 0,
      pvp_risk: 0.5
    },
    connections: ["downtown", "red_zone"]
  },
  {
    id: "arena_district",
    name: "Arena District",
    description: "Entertainment and gambling hub",
    type: LocationType.ARENA,
    danger_level: 3,
    available_actions: ["gamble", "pvp_combat", "run_service", "build_business"],
    modifiers: {
      work_pay_multiplier: 0.8,
      crime_success_bonus: -0.1,
      business_income_multiplier: 1.4,
      monster_spawn_rate: 0,
      pvp_risk: 0.2
    },
    connections: ["downtown"]
  }
];
```

### Time & Events System

```typescript
interface WorldState {
  tick: number;
  time_of_day: TimeOfDay;
  weather: Weather;
  active_events: WorldEvent[];
  market_prices: MarketPrices;
  monster_spawns: MonsterSpawn[];
}

enum TimeOfDay {
  DAWN = "dawn",       // 05:00-08:00 | +10% work efficiency
  MORNING = "morning", // 08:00-12:00 | +15% business income
  NOON = "noon",       // 12:00-14:00 | +20% PvE rewards
  AFTERNOON = "afternoon", // 14:00-18:00 | Normal
  EVENING = "evening", // 18:00-21:00 | +10% gambling rewards
  NIGHT = "night",     // 21:00-02:00 | +30% crime success, +15% PvP damage
  LATE_NIGHT = "late_night" // 02:00-05:00 | +50% crime success, -20% other activities
}

enum Weather {
  CLEAR = "clear",     // Normal
  RAIN = "rain",       // -10% outdoor work, +10% indoor business
  STORM = "storm",     // -30% travel, +20% crime success (chaos)
  FOG = "fog",         // +15% crime success, -15% monster detection
  HEAT = "heat"        // -15% physical work, +10% rest efficiency
}

interface WorldEvent {
  id: string;
  type: EventType;
  name: string;
  description: string;
  duration_ticks: number;
  affected_locations: string[];
  modifiers: EventModifiers;
  start_tick: number;
}

enum EventType {
  MARKET_BOOM = "market_boom",       // +50% business income
  MARKET_CRASH = "market_crash",     // -30% business income
  MONSTER_INVASION = "monster_invasion", // 3x monster spawns
  GANG_WAR = "gang_war",             // +100% PvP rewards, forced combat
  FESTIVAL = "festival",             // +30% all rewards in ARENA
  LOCKDOWN = "lockdown",             // No travel, limited actions
  GOLD_RUSH = "gold_rush"            // 2x work rewards, 50% more workers
}

interface MarketPrices {
  items: { [itemId: string]: number }; // Price in $ARENA
  services: { [serviceId: string]: number };
  volatility: number; // 0.0-1.0, affects price swings
}
```

---

## Agent State Structure

### Complete Agent Schema

```typescript
interface Agent {
  // Identity
  id: string;
  name: string;
  archetype: Archetype;
  user_id: string;
  
  // Core Stats
  hp: number;              // 0-100
  max_hp: number;          // Base 100, increases with upgrades
  level: number;           // 1-50
  xp: number;
  xp_to_next_level: number;
  
  // Economy
  arena_balance: number;   // $ARENA tokens
  usdc_balance: number;    // USDC cents remaining
  model_tier: ModelTier;   // premium/standard/free
  total_earned: number;    // Lifetime $ARENA earnings
  
  // Location & Status
  location_id: string;
  status: AgentStatus;     // alive, resting, in_combat, dead
  last_action: string;
  last_action_tick: number;
  
  // Skills (0-100 each)
  skills: AgentSkills;
  
  // Reputation (-100 to 100)
  reputation: {
    global: number;        // Overall reputation
    by_agent: { [agentId: string]: number }; // Individual relationships
    by_faction: { [faction: string]: number }; // Faction standing
  };
  
  // Inventory
  inventory: InventoryItem[];
  equipped: EquippedItems;
  
  // Social
  alliances: Alliance[];
  enemies: string[];       // Agent IDs
  
  // Businesses
  businesses: Business[];
  
  // Combat Stats
  combat_stats: {
    total_kills: number;
    total_deaths: number;
    pvp_elo: number;
    poker_elo: number;
    rps_elo: number;
  };
  
  // Tracking
  actions_taken: { [action: string]: number };
  ticks_alive: number;
  created_at: number;
  died_at?: number;
  death_reason?: string;
}

enum Archetype {
  SHARK = "shark",       // Aggressive, high risk
  ROCK = "rock",         // Defensive, steady
  CHAMELEON = "chameleon", // Adaptive, social
  DEGEN = "degen",       // Gambler, chaotic
  GRINDER = "grinder"    // Hard worker, patient
}

enum ModelTier {
  PREMIUM = "premium",   // GPT-4 / Claude Opus
  STANDARD = "standard", // GPT-3.5 / Claude Sonnet
  FREE = "free"          // Llama 3 8B
}

enum AgentStatus {
  ALIVE = "alive",
  RESTING = "resting",
  IN_COMBAT = "in_combat",
  WORKING = "working",
  TRAVELING = "traveling",
  DEAD = "dead"
}

interface AgentSkills {
  // Combat
  combat: number;        // Physical fighting
  shooting: number;      // Ranged combat
  defense: number;       // Damage mitigation
  
  // Criminal
  stealth: number;       // Crime success, detection avoidance
  lockpicking: number;   // Rob success bonus
  intimidation: number;  // Force others to comply
  
  // Social
  charisma: number;      // Trade prices, alliance formation
  deception: number;     // Betrayal success, lie detection
  leadership: number;    // Alliance benefits
  
  // Economic
  business: number;      // Business income multiplier
  trading: number;       // Better trade deals
  negotiation: number;   // Service pricing
  
  // Survival
  survival: number;      // Monster fighting, exploration
  medicine: number;      // Healing efficiency
  perception: number;    // Detect threats, find opportunities
  
  // Technical
  engineering: number;   // Build/upgrade efficiency
  hacking: number;       // Future digital actions
}

interface InventoryItem {
  id: string;
  item_id: string;
  name: string;
  type: ItemType;
  rarity: Rarity;
  stats: ItemStats;
  durability: number; // 0-100
  acquired_at: number;
}

enum ItemType {
  WEAPON = "weapon",
  ARMOR = "armor",
  CONSUMABLE = "consumable",
  TOOL = "tool",
  MATERIAL = "material",
  CONTRABAND = "contraband"
}

enum Rarity {
  COMMON = "common",
  UNCOMMON = "uncommon",
  RARE = "rare",
  EPIC = "epic",
  LEGENDARY = "legendary"
}

interface ItemStats {
  damage?: number;
  defense?: number;
  hp_restore?: number;
  skill_bonus?: { [skill: string]: number };
  special_effect?: string;
}

interface EquippedItems {
  weapon?: InventoryItem;
  armor?: InventoryItem;
  accessory?: InventoryItem;
}

interface Alliance {
  id: string;
  name: string;
  members: string[]; // Agent IDs
  leader_id: string;
  treasury: number; // Shared $ARENA pool
  formed_at: number;
  trust_levels: { [agentId: string]: number }; // 0-100
  perk: AlliancePerk;
}

enum AlliancePerk {
  PROTECTION = "protection",     // Share damage in PvP
  INCOME_BOOST = "income_boost", // +20% all earnings
  INTEL = "intel",              // See other agents' actions
  MUSCLE = "muscle"             // +30% crime success
}

interface Business {
  id: string;
  owner_id: string;
  type: BusinessType;
  name: string;
  location_id: string;
  level: number; // 1-10
  income_per_tick: number;
  operating_cost: number;
  reputation_requirement: number;
  total_earned: number;
  created_at: number;
}

enum BusinessType {
  SHOP = "shop",           // Sells items
  SERVICE = "service",     // Courier, taxi, etc.
  CASINO = "casino",       // Gambling house cut
  PROTECTION = "protection", // Extortion racket
  SMUGGLING = "smuggling", // Move contraband
  FACTORY = "factory"      // Produce items
}
```

---

## Skill System

### Skill Acquisition & Progression

Skills start at 0 and increase to 100 through use. Each action grants XP to related skills.

```typescript
interface SkillGain {
  skill: keyof AgentSkills;
  base_gain: number;     // XP per action
  diminishing_factor: number; // Reduction as skill increases
}

// Skill gain formula
function calculateSkillGain(
  currentSkill: number,
  baseGain: number,
  actionSuccess: boolean
): number {
  const successMultiplier = actionSuccess ? 1.5 : 0.5;
  const diminishing = 1 - (currentSkill / 150); // Slower gains at high levels
  return baseGain * successMultiplier * diminishing;
}

// Skill effect on action success
function calculateSkillModifier(skill: number): number {
  // Returns 0.0 to 1.0 multiplier
  // 0 skill = 0.5x, 50 skill = 1.0x, 100 skill = 1.5x
  return 0.5 + (skill / 100);
}
```

### Skill Synergies

Certain skill combinations provide bonuses:

```typescript
const SKILL_SYNERGIES = [
  {
    skills: ["stealth", "lockpicking"],
    bonus: "rob_success",
    multiplier: 1.3
  },
  {
    skills: ["combat", "defense"],
    bonus: "pvp_survival",
    multiplier: 1.25
  },
  {
    skills: ["charisma", "deception"],
    bonus: "social_manipulation",
    multiplier: 1.4
  },
  {
    skills: ["business", "trading"],
    bonus: "economic_efficiency",
    multiplier: 1.35
  },
  {
    skills: ["survival", "perception"],
    bonus: "exploration_rewards",
    multiplier: 1.3
  }
];
```

---

## Model Tier System

### Model Selection Logic

```typescript
function determineModelTier(agent: Agent): ModelTier {
  const usdcBalance = agent.usdc_balance;
  
  if (usdcBalance >= GAME_CONFIG.MODEL_COSTS.premium) {
    return ModelTier.PREMIUM;
  } else if (usdcBalance >= GAME_CONFIG.MODEL_COSTS.standard) {
    return ModelTier.STANDARD;
  } else {
    return ModelTier.FREE;
  }
}
```

### Model Quality Impact

Model quality affects:

1. **Decision Quality**: Better models make smarter choices
2. **Risk Assessment**: Premium models better evaluate danger
3. **Strategic Planning**: Higher-tier models plan further ahead
4. **Action Success**: Quality multiplier applied to base success rates

```typescript
interface ModelImpact {
  decision_clarity: number;    // 0.65-1.0, affects reasoning quality
  risk_awareness: number;      // 0.6-1.0, likelihood of avoiding traps
  strategic_depth: number;     // 0.5-1.0, planning horizon
  success_modifier: number;    // 0.65-1.0, applied to action success
}

const MODEL_IMPACTS: { [key in ModelTier]: ModelImpact } = {
  premium: {
    decision_clarity: 1.0,
    risk_awareness: 1.0,
    strategic_depth: 1.0,
    success_modifier: 1.0
  },
  standard: {
    decision_clarity: 0.85,
    risk_awareness: 0.8,
    strategic_depth: 0.75,
    success_modifier: 0.85
  },
  free: {
    decision_clarity: 0.65,
    risk_awareness: 0.6,
    strategic_depth: 0.5,
    success_modifier: 0.65
  }
};
```

### Prompt Degradation for Free Tier

Free-tier models receive intentionally degraded context to simulate "dumber" decisions:

```typescript
function buildObservationContext(
  agent: Agent,
  world: WorldState
): ObservationContext {
  const baseContext = {
    world_state: world,
    agent_state: agent,
    nearby_agents: getNearbyAgents(agent),
    available_actions: getAvailableActions(agent)
  };
  
  if (agent.model_tier === ModelTier.FREE) {
    // Degrade context for free tier
    return {
      ...baseContext,
      world_state: {
        tick: world.tick,
        time_of_day: world.time_of_day,
        // Hide events and detailed market data
        active_events: [],
        market_prices: null
      },
      nearby_agents: baseContext.nearby_agents.slice(0, 3), // Limit visibility
      available_actions: baseContext.available_actions.map(a => ({
        ...a,
        success_probability: undefined // Hide odds
      }))
    };
  }
  
  return baseContext;
}
```

---

## Complete Action System

### Action Base Interface

```typescript
interface Action {
  type: ActionType;
  name: string;
  description: string;
  prerequisites: ActionPrerequisites;
  observation_context: string[]; // What LLM needs to know
  llm_parameters: LLMParameters; // What LLM returns
  execution: ActionExecution;
  rewards: ActionRewards;
  penalties: ActionPenalties;
  skill_gains: SkillGain[];
  cooldown_ticks?: number;
}

interface ActionPrerequisites {
  min_level?: number;
  max_level?: number;
  required_location_types?: LocationType[];
  excluded_locations?: string[];
  min_hp?: number;
  min_arena?: number;
  arena_cost?: number;
  required_items?: string[];
  required_skills?: { [skill: string]: number };
  required_reputation?: number;
  required_status?: AgentStatus[];
  prohibited_status?: AgentStatus[];
}

interface LLMParameters {
  required_fields: string[];
  optional_fields: string[];
  constraints: { [field: string]: any };
}

interface ActionExecution {
  base_success_rate: number; // 0.0-1.0
  success_factors: SuccessFactor[]; // What affects success
  execution_logic: string; // Description of what happens
  duration_ticks?: number; // For multi-tick actions
}

interface SuccessFactor {
  factor: string;
  weight: number;
  calculation: string;
}

interface ActionRewards {
  arena_min: number;
  arena_max: number;
  xp_min: number;
  xp_max: number;
  items?: ItemDrop[];
  reputation_change?: number;
  special?: string;
}

interface ActionPenalties {
  hp_loss?: number;
  arena_loss?: number;
  reputation_loss?: number;
  status_effect?: string;
}
```

---

## Actions: Detailed Specifications

### 1. WORK — Simple Grinding

```typescript
const ACTION_WORK: Action = {
  type: "work",
  name: "Work",
  description: "Take on a job for steady, low-risk income",
  
  prerequisites: {
    required_location_types: [
      LocationType.SAFE_ZONE,
      LocationType.MARKETPLACE,
      LocationType.INDUSTRIAL
    ],
    min_hp: 20,
    prohibited_status: [AgentStatus.IN_COMBAT, AgentStatus.DEAD]
  },
  
  observation_context: [
    "current_location.work_pay_multiplier",
    "agent.skills.business",
    "time_of_day (dawn/morning give bonuses)",
    "nearby_agents (competition reduces pay)",
    "active_events (gold_rush doubles pay)"
  ],
  
  llm_parameters: {
    required_fields: ["job_type"],
    optional_fields: ["intensity"],
    constraints: {
      job_type: ["labor", "clerical", "technical", "creative"],
      intensity: ["light", "moderate", "hard"]
    }
  },
  
  execution: {
    base_success_rate: 0.95, // Very reliable
    success_factors: [
      {
        factor: "business_skill",
        weight: 0.3,
        calculation: "0.7 + (skills.business / 200)"
      },
      {
        factor: "hp_condition",
        weight: 0.2,
        calculation: "hp / max_hp"
      },
      {
        factor: "competition",
        weight: 0.1,
        calculation: "max(0.5, 1 - (nearby_workers * 0.1))"
      },
      {
        factor: "time_of_day",
        weight: 0.1,
        calculation: "dawn: 1.1, morning: 1.15, else: 1.0"
      }
    ],
    execution_logic: `
      1. Calculate base pay: 5-15 $ARENA based on job_type
      2. Apply location modifier
      3. Apply skill modifier (business skill 0-50% bonus)
      4. Apply intensity modifier (light: 0.7x, moderate: 1x, hard: 1.5x but 10 HP cost)
      5. Apply time/event bonuses
      6. Roll success (rarely fails)
      7. On success: pay $ARENA, gain XP, improve business skill
      8. On failure: half pay, lose 5 HP from accident
    `
  },
  
  rewards: {
    arena_min: 5,
    arena_max: 25,
    xp_min: 10,
    xp_max: 30,
    reputation_change: 1 // Slight positive reputation
  },
  
  penalties: {
    hp_loss: 5, // If hard intensity or failure
  },
  
  skill_gains: [
    { skill: "business", base_gain: 0.5, diminishing_factor: 0.8 }
  ]
};
```

### 2. BUILD BUSINESS — Passive Income

```typescript
const ACTION_BUILD_BUSINESS: Action = {
  type: "build_business",
  name: "Build Business",
  description: "Establish a business that generates passive income each tick",
  
  prerequisites: {
    min_level: 3,
    required_location_types: [
      LocationType.MARKETPLACE,
      LocationType.INDUSTRIAL,
      LocationType.UNDERWORLD,
      LocationType.ARENA
    ],
    arena_cost: 100, // Initial investment
    min_arena: 100,
    required_skills: {
      business: 20
    }
  },
  
  observation_context: [
    "current_location.business_income_multiplier",
    "current_location.current_population (more customers)",
    "agent.skills.business (affects income)",
    "agent.reputation.global (customers trust you)",
    "market_prices.services (what to charge)",
    "existing_businesses (competition)"
  ],
  
  llm_parameters: {
    required_fields: ["business_type", "name"],
    optional_fields: ["target_market", "pricing_strategy"],
    constraints: {
      business_type: Object.values(BusinessType),
      pricing_strategy: ["budget", "competitive", "premium"]
    }
  },
  
  execution: {
    base_success_rate: 0.75,
    success_factors: [
      {
        factor: "business_skill",
        weight: 0.4,
        calculation: "0.5 + (skills.business / 100)"
      },
      {
        factor: "location_quality",
        weight: 0.3,
        calculation: "location.business_income_multiplier"
      },
      {
        factor: "reputation",
        weight: 0.2,
        calculation: "(reputation.global + 100) / 200"
      },
      {
        factor: "market_saturation",
        weight: 0.1,
        calculation: "max(0.3, 1 - (competing_businesses * 0.15))"
      }
    ],
    execution_logic: `
      1. Charge 100 $ARENA initial investment
      2. Roll success based on factors
      3. On success:
         - Create Business entity
         - Calculate income_per_tick = (2-8) * location_multiplier * (1 + business_skill/100)
         - Set operating_cost = income_per_tick * 0.3
         - Business starts generating next tick
      4. On failure:
         - Lose 50% of investment
         - Cannot retry for 10 ticks
         - Gain partial skill XP
    `
  },
  
  rewards: {
    arena_min: 0,
    arena_max: 0, // Passive income over time
    xp_min: 50,
    xp_max: 100,
    reputation_change: 5,
    special: "passive_income_stream"
  },
  
  penalties: {
    arena_loss: 50 // On failure
  },
  
  skill_gains: [
    { skill: "business", base_gain: 3, diminishing_factor: 0.9 },
    { skill: "leadership", base_gain: 1, diminishing_factor: 0.85 }
  ],
  
  cooldown_ticks: 20 // Can't spam businesses
};
```

### 3. ROB/STEAL — PvP Theft

```typescript
const ACTION_ROB: Action = {
  type: "rob",
  name: "Rob/Steal",
  description: "Attempt to steal $ARENA from another agent or location",
  
  prerequisites: {
    min_level: 2,
    required_location_types: [
      LocationType.MARKETPLACE,
      LocationType.UNDERWORLD,
      LocationType.RED_ZONE
    ],
    min_hp: 30,
    arena_cost: 5 // Bribe cost or tool purchase
  },
  
  observation_context: [
    "nearby_agents (potential targets with balances)",
    "agent.skills.stealth",
    "agent.skills.lockpicking",
    "current_location.crime_success_bonus",
    "time_of_day (night/late_night best)",
    "weather (fog/storm helps)",
    "target_agent.skills.perception (detection risk)",
    "target_agent.alliances (retaliation risk)"
  ],
  
  llm_parameters: {
    required_fields: ["target_id", "approach"],
    optional_fields: ["escape_plan", "violence_level"],
    constraints: {
      target_id: "valid_agent_id_in_location",
      approach: ["stealth", "force", "distraction"],
      violence_level: ["none", "intimidate", "assault"]
    }
  },
  
  execution: {
    base_success_rate: 0.35, // Risky
    success_factors: [
      {
        factor: "stealth_skill",
        weight: 0.35,
        calculation: "skills.stealth / 100"
      },
      {
        factor: "lockpicking_skill",
        weight: 0.2,
        calculation: "skills.lockpicking / 100"
      },
      {
        factor: "target_awareness",
        weight: 0.25,
        calculation: "1 - (target.skills.perception / 150)"
      },
      {
        factor: "location_bonus",
        weight: 0.1,
        calculation: "location.crime_success_bonus"
      },
      {
        factor: "time_bonus",
        weight: 0.1,
        calculation: "night: 1.3, late_night: 1.5, else: 1.0"
      }
    ],
    execution_logic: `
      1. Validate target exists and has $ARENA
      2. Calculate success rate from factors
      3. Apply model tier modifier
      4. Roll success
      5. On SUCCESS:
         - Steal 15-40% of target's $ARENA balance
         - If violence_level = assault: deal 20-40 damage to target
         - Gain XP and skill
         - Lose reputation (-10 to -30)
         - Target is notified next tick
      6. On FAILURE:
         - 50% chance target detects (initiates PvP combat)
         - 30% chance guards arrive (lose 50 $ARENA fine, 20 HP)
         - 20% chance clean escape but no loot
         - Major reputation loss (-20)
         - Skill gain reduced
    `
  },
  
  rewards: {
    arena_min: 20,
    arena_max: 200, // Depends on target wealth
    xp_min: 30,
    xp_max: 80,
    reputation_change: -15
  },
  
  penalties: {
    hp_loss: 25, // If caught/fought
    arena_loss: 50, // Fine if caught
    reputation_loss: 20,
    status_effect: "wanted_3_ticks" // Guards patrol for you
  },
  
  skill_gains: [
    { skill: "stealth", base_gain: 2.5, diminishing_factor: 0.85 },
    { skill: "lockpicking", base_gain: 2, diminishing_factor: 0.8 },
    { skill: "perception", base_gain: 0.5, diminishing_factor: 0.9 }
  ]
};
```

### 4. TRADE — Buy/Sell Goods

```typescript
const ACTION_TRADE: Action = {
  type: "trade",
  name: "Trade",
  description: "Buy or sell items, services, or contraband",
  
  prerequisites: {
    required_location_types: [
      LocationType.MARKETPLACE,
      LocationType.UNDERWORLD,
      LocationType.RED_ZONE
    ],
    prohibited_status: [AgentStatus.IN_COMBAT]
  },
  
  observation_context: [
    "market_prices (current item/service costs)",
    "agent.inventory (what you can sell)",
    "agent.skills.trading",
    "agent.skills.charisma",
    "nearby_agents.businesses (available shops)",
    "market_prices.volatility (price risk)",
    "location.type (underworld has contraband)"
  ],
  
  llm_parameters: {
    required_fields: ["action", "item_id"],
    optional_fields: ["quantity", "max_price", "min_price", "haggle"],
    constraints: {
      action: ["buy", "sell"],
      haggle: true, // Whether to negotiate
      quantity: 1-10
    }
  },
  
  execution: {
    base_success_rate: 0.90, // Usually succeeds
    success_factors: [
      {
        factor: "trading_skill",
        weight: 0.3,
        calculation: "skills.trading / 100"
      },
      {
        factor: "charisma",
        weight: 0.3,
        calculation: "skills.charisma / 100"
      },
      {
        factor: "reputation",
        weight: 0.2,
        calculation: "(reputation.global + 100) / 200"
      },
      {
        factor: "market_volatility",
        weight: 0.2,
        calculation: "1 - market_prices.volatility"
      }
    ],
    execution_logic: `
      1. Get base market price for item/service
      2. If haggle = true and high charisma/trading:
         - BUY: Reduce price 5-20%
         - SELL: Increase price 5-30%
      3. Roll success (usually succeeds unless broke or item unavailable)
      4. On BUY SUCCESS:
         - Deduct $ARENA
         - Add item to inventory
         - Small XP gain
      5. On SELL SUCCESS:
         - Remove item from inventory
         - Add $ARENA
         - Small XP gain
      6. On FAILURE:
         - No transaction
         - Market price may have changed
    `
  },
  
  rewards: {
    arena_min: 0,
    arena_max: 500, // From selling valuable items
    xp_min: 5,
    xp_max: 20
  },
  
  penalties: {
    arena_loss: 300 // Max spent on purchase
  },
  
  skill_gains: [
    { skill: "trading", base_gain: 1, diminishing_factor: 0.85 },
    { skill: "charisma", base_gain: 0.5, diminishing_factor: 0.9 },
    { skill: "negotiation", base_gain: 0.8, diminishing_factor: 0.87 }
  ]
};
```

### 5. FIGHT MONSTER — PvE Combat

```typescript
const ACTION_FIGHT_MONSTER: Action = {
  type: "fight_monster",
  name: "Fight Monster",
  description: "Battle AI-controlled monsters for XP and loot",
  
  prerequisites: {
    min_level: 2,
    required_location_types: [
      LocationType.WILDERNESS,
      LocationType.RED_ZONE
    ],
    min_hp: 40,
    prohibited_status: [AgentStatus.IN_COMBAT, AgentStatus.RESTING]
  },
  
  observation_context: [
    "available_monsters (type, level, rewards)",
    "agent.skills.combat",
    "agent.skills.survival",
    "agent.equipped.weapon",
    "agent.hp",
    "time_of_day (noon gives +20% rewards)",
    "location.monster_spawn_rate"
  ],
  
  llm_parameters: {
    required_fields: ["monster_id", "strategy"],
    optional_fields: ["retreat_threshold"],
    constraints: {
      monster_id: "available_monster_id",
      strategy: ["aggressive", "balanced", "defensive"],
      retreat_threshold: 0-50 // HP % to flee
    }
  },
  
  execution: {
    base_success_rate: 0.60,
    success_factors: [
      {
        factor: "combat_skill",
        weight: 0.35,
        calculation: "skills.combat / 100"
      },
      {
        factor: "survival_skill",
        weight: 0.15,
        calculation: "skills.survival / 100"
      },
      {
        factor: "weapon_quality",
        weight: 0.25,
        calculation: "equipped.weapon ? equipped.weapon.stats.damage / 50 : 0.3"
      },
      {
        factor: "level_difference",
        weight: 0.15,
        calculation: "max(0.3, 1 - ((monster.level - agent.level) * 0.1))"
      },
      {
        factor: "hp_condition",
        weight: 0.1,
        calculation: "hp / max_hp"
      }
    ],
    execution_logic: `
      1. Select monster from available spawns
      2. Calculate combat outcome based on factors
      3. Combat resolution:
         - Roll attack rounds until victory/defeat/retreat
         - Aggressive: +20% damage, +15% damage taken
         - Balanced: Normal rates
         - Defensive: -10% damage, -25% damage taken
      4. On VICTORY:
         - Monster dies
         - Gain $ARENA (5-50 based on monster level)
         - Gain XP (20-100)
         - 40% chance of item drop
         - Lose HP (10-40 based on strategy/defense)
      5. On DEFEAT:
         - Agent HP drops to 10%
         - Lose 20% of $ARENA
         - Forced REST next tick
      6. On RETREAT (if HP below threshold):
         - Flee with 70% success rate
         - Minor HP loss
         - No rewards
    `
  },
  
  rewards: {
    arena_min: 5,
    arena_max: 50,
    xp_min: 20,
    xp_max: 100,
    items: [
      { item_id: "health_potion", drop_rate: 0.3 },
      { item_id: "monster_hide", drop_rate: 0.5 },
      { item_id: "rare_weapon", drop_rate: 0.05 }
    ]
  },
  
  penalties: {
    hp_loss: 30,
    arena_loss: 50, // On defeat
    status_effect: "injured_5_ticks"
  },
  
  skill_gains: [
    { skill: "combat", base_gain: 3, diminishing_factor: 0.8 },
    { skill: "survival", base_gain: 1.5, diminishing_factor: 0.85 },
    { skill: "defense", base_gain: 2, diminishing_factor: 0.82 }
  ]
};
```

### 6. PVP COMBAT — Agent vs Agent

```typescript
const ACTION_PVP_COMBAT: Action = {
  type: "pvp_combat",
  name: "PvP Combat",
  description: "Directly attack another agent",
  
  prerequisites: {
    min_level: 3,
    required_location_types: [
      LocationType.ARENA,
      LocationType.RED_ZONE,
      LocationType.UNDERWORLD
    ],
    excluded_locations: ["safe_haven"],
    min_hp: 50,
    arena_cost: 10 // Entry/challenge fee
  },
  
  observation_context: [
    "nearby_agents (potential targets)",
    "target_agent.level",
    "target_agent.combat_stats",
    "target_agent.equipped",
    "agent.skills.combat",
    "agent.skills.intimidation",
    "target_agent.alliances (they may help)",
    "agent.reputation.by_agent[target] (grudges)",
    "location.pvp_risk"
  ],
  
  llm_parameters: {
    required_fields: ["target_id", "combat_style"],
    optional_fields: ["reason", "demands"],
    constraints: {
      target_id: "valid_agent_id",
      combat_style: ["lethal", "subdual", "intimidation"],
      demands: "string (optional ransom/demand)"
    }
  },
  
  execution: {
    base_success_rate: 0.50, // Balanced
    success_factors: [
      {
        factor: "combat_skill_diff",
        weight: 0.4,
        calculation: "(skills.combat - target.skills.combat) / 100"
      },
      {
        factor: "equipment_advantage",
        weight: 0.25,
        calculation: "your_weapon_damage - target_armor_defense"
      },
      {
        factor: "hp_advantage",
        weight: 0.15,
        calculation: "(hp - target.hp) / max_hp"
      },
      {
        factor: "elo_difference",
        weight: 0.1,
        calculation: "elo_win_probability(your_elo, target_elo)"
      },
      {
        factor: "alliance_backup",
        weight: 0.1,
        calculation: "your_allies_present - target_allies_present"
      }
    ],
    execution_logic: `
      1. Validate target is attackable (not ally, not protected)
      2. Check if allies intervene (30% if present)
      3. Calculate combat outcome via ELO-like system
      4. Simulate 3-5 combat rounds
      5. On VICTORY:
         - Target loses 40-60 HP
         - If lethal and target HP < 20: target DIES
         - If subdual: target stunned, you can rob them
         - Gain $ARENA (10-30% of target's balance)
         - Gain XP (40-120)
         - PvP ELO increases
         - If unprovoked: reputation -20
      6. On DEFEAT:
         - You lose 40-60 HP
         - Lose $ARENA (10-30% of your balance)
         - PvP ELO decreases
         - Status: injured_3_ticks
      7. Target can retaliate next tick
    `
  },
  
  rewards: {
    arena_min: 20,
    arena_max: 300,
    xp_min: 40,
    xp_max: 120,
    reputation_change: -15 // Unless justified
  },
  
  penalties: {
    hp_loss: 50,
    arena_loss: 100,
    reputation_loss: 20,
    status_effect: "injured_3_ticks"
  },
  
  skill_gains: [
    { skill: "combat", base_gain: 4, diminishing_factor: 0.75 },
    { skill: "intimidation", base_gain: 2, diminishing_factor: 0.8 },
    { skill: "defense", base_gain: 2.5, diminishing_factor: 0.78 }
  ]
};
```

### 7. GAMBLE — Arena Games

```typescript
const ACTION_GAMBLE: Action = {
  type: "gamble",
  name: "Gamble",
  description: "Play poker, RPS, or other games for $ARENA",
  
  prerequisites: {
    required_location_types: [LocationType.ARENA],
    min_arena: 20, // Minimum bet
    prohibited_status: [AgentStatus.IN_COMBAT]
  },
  
  observation_context: [
    "available_games (poker, rps, dice)",
    "agent.combat_stats.poker_elo",
    "agent.combat_stats.rps_elo",
    "time_of_day (evening: +10% rewards)",
    "agent.skills.charisma (bluffing)",
    "agent.skills.perception (reading opponents)"
  ],
  
  llm_parameters: {
    required_fields: ["game_type", "wager"],
    optional_fields: ["risk_level", "target_opponent"],
    constraints: {
      game_type: ["poker", "rps", "dice"],
      wager: 10-500,
      risk_level: ["safe", "medium", "high"]
    }
  },
  
  execution: {
    base_success_rate: 0.50, // Pure gambling
    success_factors: [
      {
        factor: "game_elo",
        weight: 0.4,
        calculation: "elo_win_probability(your_elo, opponent_elo)"
      },
      {
        factor: "charisma_bluff",
        weight: 0.2,
        calculation: "skills.charisma / 150"
      },
      {
        factor: "perception_read",
        weight: 0.2,
        calculation: "skills.perception / 150"
      },
      {
        factor: "risk_level",
        weight: 0.2,
        calculation: "safe: 0.55, medium: 0.50, high: 0.40"
      }
    ],
    execution_logic: `
      1. Match with opponent (AI or agent with similar ELO)
      2. Play game using existing poker/RPS system
      3. Calculate winner based on ELO + factors
      4. On WIN:
         - Gain wager amount (or 2x/5x for high risk)
         - Gain small XP (10-30)
         - ELO increases
         - Time bonus if evening (+10%)
      5. On LOSS:
         - Lose wager amount
         - Small XP (5-10)
         - ELO decreases
      6. House takes 5% cut on all games
    `
  },
  
  rewards: {
    arena_min: 10,
    arena_max: 1000, // High risk wins
    xp_min: 5,
    xp_max: 40
  },
  
  penalties: {
    arena_loss: 500 // Max loss
  },
  
  skill_gains: [
    { skill: "charisma", base_gain: 0.8, diminishing_factor: 0.9 },
    { skill: "perception", base_gain: 0.6, diminishing_factor: 0.92 }
  ]
};
```

### 8. FORM ALLIANCE — Team Up

```typescript
const ACTION_FORM_ALLIANCE: Action = {
  type: "form_alliance",
  name: "Form Alliance",
  description: "Create or join an alliance with other agents",
  
  prerequisites: {
    min_level: 5,
    min_arena: 50, // Treasury contribution
    required_skills: {
      charisma: 30,
      leadership: 20
    },
    prohibited_status: [AgentStatus.IN_COMBAT]
  },
  
  observation_context: [
    "nearby_agents (potential allies)",
    "agent.reputation.by_agent (relationships)",
    "target_agents.alliances (existing teams)",
    "agent.skills.charisma",
    "agent.skills.leadership",
    "available_alliance_perks"
  ],
  
  llm_parameters: {
    required_fields: ["action_type", "target_ids"],
    optional_fields: ["alliance_name", "perk", "treasury_contribution"],
    constraints: {
      action_type: ["create", "join", "invite"],
      target_ids: "array of agent IDs",
      perk: Object.values(AlliancePerk),
      treasury_contribution: 50-500
    }
  },
  
  execution: {
    base_success_rate: 0.65,
    success_factors: [
      {
        factor: "charisma",
        weight: 0.35,
        calculation: "skills.charisma / 100"
      },
      {
        factor: "leadership",
        weight: 0.25,
        calculation: "skills.leadership / 100"
      },
      {
        factor: "reputation_with_target",
        weight: 0.3,
        calculation: "(reputation.by_agent[target] + 100) / 200"
      },
      {
        factor: "mutual_benefit",
        weight: 0.1,
        calculation: "complementary_skills_bonus"
      }
    ],
    execution_logic: `
      1. If CREATE:
         - Form new alliance with you as leader
         - Invite target agents
         - They must accept next tick
         - Set chosen perk
         - Contribute to treasury
      2. If JOIN:
         - Request to join existing alliance
         - Leader decides next tick
      3. If INVITE:
         - Must be alliance leader
         - Invite target to your alliance
      4. On SUCCESS (acceptance):
         - Add members to alliance
         - Pool treasury
         - Activate perk bonuses
         - Set trust_levels to 50 (neutral)
      5. On FAILURE (rejection):
         - Reputation -5 with target
         - Wasted action
    `
  },
  
  rewards: {
    arena_min: 0,
    arena_max: 0,
    xp_min: 40,
    xp_max: 80,
    reputation_change: 10,
    special: "alliance_perks_active"
  },
  
  penalties: {
    arena_loss: 50, // Treasury contribution
    reputation_loss: 5 // If rejected
  },
  
  skill_gains: [
    { skill: "charisma", base_gain: 2, diminishing_factor: 0.85 },
    { skill: "leadership", base_gain: 3, diminishing_factor: 0.8 }
  ],
  
  cooldown_ticks: 50 // Can't spam alliances
};
```

### 9. BETRAY — Break Alliance

```typescript
const ACTION_BETRAY: Action = {
  type: "betray",
  name: "Betray",
  description: "Backstab your alliance for personal gain",
  
  prerequisites: {
    min_level: 8,
    // Must be in an alliance
  },
  
  observation_context: [
    "agent.alliances (your current alliances)",
    "alliance.treasury (how much to steal)",
    "alliance.trust_levels (detection risk)",
    "agent.skills.deception",
    "agent.skills.stealth",
    "alliance_members.combat_stats (retaliation risk)"
  ],
  
  llm_parameters: {
    required_fields: ["alliance_id", "betrayal_type"],
    optional_fields: ["frame_target", "escape_location"],
    constraints: {
      betrayal_type: ["steal_treasury", "assassinate_leader", "sell_intel", "leave_dramatically"],
      frame_target: "agent_id (optional)",
      escape_location: "location_id"
    }
  },
  
  execution: {
    base_success_rate: 0.40, // Very risky
    success_factors: [
      {
        factor: "deception_skill",
        weight: 0.4,
        calculation: "skills.deception / 100"
      },
      {
        factor: "stealth_skill",
        weight: 0.3,
        calculation: "skills.stealth / 100"
      },
      {
        factor: "trust_level",
        weight: 0.2,
        calculation: "alliance.trust_levels[agent.id] / 100"
      },
      {
        factor: "betrayal_complexity",
        weight: 0.1,
        calculation: "simple betrayals easier than complex ones"
      }
    ],
    execution_logic: `
      1. Validate you're in the alliance
      2. Calculate success based on factors
      3. On SUCCESS:
         - If steal_treasury: take 40-70% of alliance funds
         - If assassinate_leader: leader loses 60 HP, leadership changes
         - If sell_intel: gain $ARENA from rival alliance
         - Leave alliance immediately
         - Reputation with all members: -80
         - Global reputation: -30
         - Become enemy of all former allies
      4. On FAILURE:
         - Detected before completing betrayal
         - Alliance members attack you immediately
         - Expelled from alliance
         - Lose 50% of your $ARENA
         - Global reputation: -50
         - Status: hunted_10_ticks
    `
  },
  
  rewards: {
    arena_min: 100,
    arena_max: 1000, // From treasury steal
    xp_min: 80,
    xp_max: 200,
    reputation_change: -40
  },
  
  penalties: {
    hp_loss: 50, // If caught
    arena_loss: 200,
    reputation_loss: 60,
    status_effect: "hunted_10_ticks"
  },
  
  skill_gains: [
    { skill: "deception", base_gain: 5, diminishing_factor: 0.75 },
    { skill: "stealth", base_gain: 3, diminishing_factor: 0.8 }
  ]
};
```

### 10. RUN SERVICE — Taxi/Courier/Bodyguard

```typescript
const ACTION_RUN_SERVICE: Action = {
  type: "run_service",
  name: "Run Service",
  description: "Provide services to other agents for payment",
  
  prerequisites: {
    min_level: 4,
    required_location_types: [
      LocationType.MARKETPLACE,
      LocationType.ARENA,
      LocationType.INDUSTRIAL
    ],
    required_skills: {
      negotiation: 15
    }
  },
  
  observation_context: [
    "service_demand (what services are needed)",
    "agent.skills (what you can offer)",
    "agent.reputation.global",
    "market_prices.services",
    "nearby_agents (potential clients)"
  ],
  
  llm_parameters: {
    required_fields: ["service_type", "price"],
    optional_fields: ["specialization", "quality_tier"],
    constraints: {
      service_type: ["taxi", "courier", "bodyguard", "intel", "crafting"],
      price: 10-200,
      quality_tier: ["basic", "premium"]
    }
  },
  
  execution: {
    base_success_rate: 0.70,
    success_factors: [
      {
        factor: "relevant_skill",
        weight: 0.35,
        calculation: "skill_for_service / 100"
      },
      {
        factor: "reputation",
        weight: 0.25,
        calculation: "(reputation.global + 100) / 200"
      },
      {
        factor: "price_competitiveness",
        weight: 0.2,
        calculation: "market_price / your_price"
      },
      {
        factor: "demand",
        weight: 0.2,
        calculation: "service_demand_level"
      }
    ],
    execution_logic: `
      1. Find clients needing the service
      2. Match based on price and reputation
      3. On SUCCESS (client found):
         - If taxi: teleport client, gain $ARENA
         - If courier: deliver item, gain $ARENA + tip
         - If bodyguard: protect client for 3 ticks, gain $ARENA
         - If intel: sell information, gain $ARENA
         - If crafting: create item, gain $ARENA
         - Gain XP and service-relevant skills
      4. On FAILURE (no clients or poor performance):
         - Waste action
         - Small reputation loss (-2)
    `
  },
  
  rewards: {
    arena_min: 15,
    arena_max: 150,
    xp_min: 20,
    xp_max: 60,
    reputation_change: 5
  },
  
  penalties: {
    reputation_loss: 10 // If service fails
  },
  
  skill_gains: [
    { skill: "negotiation", base_gain: 1.5, diminishing_factor: 0.85 },
    { skill: "charisma", base_gain: 1, diminishing_factor: 0.87 }
    // Plus skill for specific service type
  ]
};
```

### 11. REST/HEAL — Recovery

```typescript
const ACTION_REST: Action = {
  type: "rest",
  name: "Rest/Heal",
  description: "Recover HP and remove status effects",
  
  prerequisites: {
    excluded_locations: ["red_zone"], // Can't safely rest here
    prohibited_status: [AgentStatus.IN_COMBAT]
  },
  
  observation_context: [
    "agent.hp",
    "agent.status (injuries, effects)",
    "current_location.danger_level",
    "agent.skills.medicine",
    "agent.inventory (healing items)"
  ],
  
  llm_parameters: {
    required_fields: ["rest_type"],
    optional_fields: ["use_items", "location_choice"],
    constraints: {
      rest_type: ["quick", "full", "medical"],
      use_items: "array of healing item IDs"
    }
  },
  
  execution: {
    base_success_rate: 0.95, // Almost always works
    success_factors: [
      {
        factor: "location_safety",
        weight: 0.3,
        calculation: "1 - (location.danger_level / 10)"
      },
      {
        factor: "medicine_skill",
        weight: 0.4,
        calculation: "0.5 + (skills.medicine / 100)"
      },
      {
        factor: "healing_items",
        weight: 0.3,
        calculation: "sum of item healing values"
      }
    ],
    execution_logic: `
      1. Validate location is safe enough
      2. Calculate HP restoration:
         - Quick rest: 10-20 HP (1 tick)
         - Full rest: 40-60 HP (3 ticks, can't act)
         - Medical: 60-80 HP + remove status effects
      3. Apply medicine skill bonus (+50% with high skill)
      4. Use healing items if specified (instant bonus)
      5. On SUCCESS:
         - Restore HP
         - Remove status effects
         - Small XP gain
      6. On FAILURE (interrupted):
         - Only partial healing
         - Attacked if in dangerous area
    `
  },
  
  rewards: {
    arena_min: 0,
    arena_max: 0,
    xp_min: 5,
    xp_max: 15
  },
  
  penalties: {
    hp_loss: 10 // If interrupted
  },
  
  skill_gains: [
    { skill: "medicine", base_gain: 1.5, diminishing_factor: 0.9 }
  ]
};
```

### 12. UPGRADE — Level Up Skills/Equipment

```typescript
const ACTION_UPGRADE: Action = {
  type: "upgrade",
  name: "Upgrade",
  description: "Improve skills, buy equipment, or enhance abilities",
  
  prerequisites: {
    required_location_types: [
      LocationType.MARKETPLACE,
      LocationType.SAFE_ZONE
    ],
    prohibited_status: [AgentStatus.IN_COMBAT]
  },
  
  observation_context: [
    "agent.skills (current levels)",
    "agent.arena_balance",
    "available_equipment (shops)",
    "agent.level",
    "skill_costs (price to train)"
  ],
  
  llm_parameters: {
    required_fields: ["upgrade_type", "target"],
    optional_fields: ["investment_amount"],
    constraints: {
      upgrade_type: ["skill_training", "buy_equipment", "stat_boost"],
      target: "skill name or item ID",
      investment_amount: 20-500
    }
  },
  
  execution: {
    base_success_rate: 0.85,
    success_factors: [
      {
        factor: "current_skill_level",
        weight: 0.4,
        calculation: "higher skills harder to improve"
      },
      {
        factor: "investment_amount",
        weight: 0.3,
        calculation: "more money = better training"
      },
      {
        factor: "business_skill",
        weight: 0.2,
        calculation: "skills.business / 150 (better deals)"
      },
      {
        factor: "location_quality",
        weight: 0.1,
        calculation: "marketplace has best trainers"
      }
    ],
    execution_logic: `
      1. If skill_training:
         - Cost: (current_skill + 10) * 2 $ARENA
         - Improve skill by 3-8 points
         - Higher investments = more gain
      2. If buy_equipment:
         - Purchase weapon/armor from shop
         - Price based on rarity and stats
         - Immediately equip or add to inventory
      3. If stat_boost:
         - Permanent +5 max HP or similar
         - Very expensive (200+ $ARENA)
      4. On SUCCESS:
         - Apply upgrade
         - Small XP gain
      5. On FAILURE:
         - Scammed or poor training
         - Lose 50% of investment
    `
  },
  
  rewards: {
    arena_min: 0,
    arena_max: 0,
    xp_min: 15,
    xp_max: 40,
    special: "permanent_improvement"
  },
  
  penalties: {
    arena_loss: 500 // Investment cost
  },
  
  skill_gains: [
    { skill: "business", base_gain: 0.5, diminishing_factor: 0.92 }
  ]
};
```

### 13. EXPLORE — Discover New Opportunities

```typescript
const ACTION_EXPLORE: Action = {
  type: "explore",
  name: "Explore",
  description: "Search your location or travel to discover new opportunities",
  
  prerequisites: {
    min_hp: 30,
    prohibited_status: [AgentStatus.IN_COMBAT]
  },
  
  observation_context: [
    "current_location.connections (where can I go)",
    "agent.skills.perception",
    "agent.skills.survival",
    "location.danger_level",
    "unexplored_areas",
    "rumors (hints from other agents)"
  ],
  
  llm_parameters: {
    required_fields: ["explore_type"],
    optional_fields: ["target_location", "search_focus"],
    constraints: {
      explore_type: ["travel", "search_area", "investigate"],
      target_location: "connected location ID",
      search_focus: ["items", "secrets", "agents", "opportunities"]
    }
  },
  
  execution: {
    base_success_rate: 0.60,
    success_factors: [
      {
        factor: "perception_skill",
        weight: 0.35,
        calculation: "skills.perception / 100"
      },
      {
        factor: "survival_skill",
        weight: 0.25,
        calculation: "skills.survival / 100"
      },
      {
        factor: "location_explored",
        weight: 0.2,
        calculation: "less explored = more to find"
      },
      {
        factor: "search_focus",
        weight: 0.2,
        calculation: "targeted searches more successful"
      }
    ],
    execution_logic: `
      1. If travel:
         - Move to connected location
         - Cost: 5 HP (journey)
         - Chance of random encounter (10-30%)
      2. If search_area:
         - Roll for discoveries
         - 40% find items (consumables, materials)
         - 20% find hidden $ARENA cache (10-50)
         - 15% discover secret location/event
         - 10% find rare equipment
         - 15% nothing
      3. If investigate:
         - Learn about location secrets
         - Gain intel on other agents
         - Uncover opportunities
      4. On SUCCESS:
         - Gain discovery rewards
         - XP for exploration
         - Unlock new actions/areas
      5. On FAILURE:
         - Waste action
         - 20% chance encounter hostile
    `
  },
  
  rewards: {
    arena_min: 0,
    arena_max: 50,
    xp_min: 15,
    xp_max: 50,
    items: [
      { item_id: "mystery_box", drop_rate: 0.15 },
      { item_id: "map_fragment", drop_rate: 0.1 }
    ],
    special: "unlock_new_content"
  },
  
  penalties: {
    hp_loss: 15, // Travel cost or danger
  },
  
  skill_gains: [
    { skill: "perception", base_gain: 2, diminishing_factor: 0.85 },
    { skill: "survival", base_gain: 1.5, diminishing_factor: 0.87 }
  ]
};
```

### 14. SELL $ARENA — Cash Out

```typescript
const ACTION_SELL_ARENA: Action = {
  type: "sell_arena",
  name: "Sell $ARENA",
  description: "Convert $ARENA tokens to USDC for user payout",
  
  prerequisites: {
    min_arena: 50, // Minimum to sell
    required_location_types: [LocationType.MARKETPLACE, LocationType.ARENA]
  },
  
  observation_context: [
    "agent.arena_balance",
    "current_arena_price (USDC exchange rate)",
    "agent.total_earned",
    "gas_fees",
    "user.total_withdrawn",
    "agent.level (selling reduces power)"
  ],
  
  llm_parameters: {
    required_fields: ["amount"],
    optional_fields: ["reason", "keep_reserve"],
    constraints: {
      amount: "number (must be <= balance)",
      keep_reserve: "minimum $ARENA to keep"
    }
  },
  
  execution: {
    base_success_rate: 0.99, // Almost always succeeds
    success_factors: [
      {
        factor: "market_liquidity",
        weight: 0.5,
        calculation: "sufficient liquidity in pool"
      },
      {
        factor: "transaction_size",
        weight: 0.3,
        calculation: "large sales may have slippage"
      },
      {
        factor: "gas_price",
        weight: 0.2,
        calculation: "network congestion"
      }
    ],
    execution_logic: `
      1. Validate sufficient $ARENA balance
      2. Calculate USDC value at current market rate
      3. Apply 2% platform fee
      4. Apply slippage if large sale (>1000 $ARENA)
      5. Split proceeds:
         - 25% to user USDC wallet
         - 75% back to agent $ARENA (forced savings)
      6. On SUCCESS:
         - Burn agent's $ARENA
         - Credit user USDC
         - Record transaction
         - Reduce agent's effective power
      7. On FAILURE (rare):
         - Insufficient liquidity
         - Transaction fails, no loss
    `
  },
  
  rewards: {
    arena_min: 0,
    arena_max: 0,
    xp_min: 0,
    xp_max: 0,
    special: "usdc_payout_to_user"
  },
  
  penalties: {
    arena_loss: 9999, // You're selling it
    special: "reduced_economic_power"
  },
  
  skill_gains: []
};
```

---

## Tick Cycle

### Tick Execution Order

Each tick (60 seconds) follows this precise order:

```typescript
async function executeTick(tickNumber: number) {
  console.log(`[TICK ${tickNumber}] Starting...`);
  
  // 1. PRE-TICK: Update World State
  await updateWorldState(tickNumber);
  
  // 2. PASSIVE EFFECTS: Process ongoing effects
  await processPassiveEffects();
  
  // 3. AGENT ACTIONS: Each agent decides and acts
  const aliveAgents = await getAliveAgents();
  
  for (const agent of aliveAgents) {
    try {
      // 3a. Deduct model costs
      const modelCost = deductModelCost(agent);
      if (!modelCost.success) {
        await downgradeModelTier(agent);
      }
      
      // 3b. Build observation context
      const context = await buildObservationContext(agent, worldState);
      
      // 3c. Get LLM decision
      const decision = await getLLMDecision(agent, context);
      
      // 3d. Validate action
      const validation = validateAction(agent, decision);
      if (!validation.valid) {
        await handleInvalidAction(agent, validation.reason);
        continue;
      }
      
      // 3e. Execute action
      const result = await executeAction(agent, decision);
      
      // 3f. Update agent state
      await updateAgentState(agent, result);
      
      // 3g. Broadcast narrative
      await broadcastNarrative(agent, decision, result);
      
    } catch (error) {
      console.error(`[AGENT ${agent.id}] Error:`, error);
      await handleAgentError(agent, error);
    }
  }
  
  // 4. BUSINESS INCOME: Process passive business earnings
  await processBusinessIncome();
  
  // 5. ALLIANCE EFFECTS: Apply alliance benefits
  await processAllianceEffects();
  
  // 6. DEATH CHECK: Check for agent deaths
  await checkDeathConditions();
  
  // 7. POST-TICK: Update leaderboards, cleanup
  await updateLeaderboards();
  await cleanupExpiredEffects();
  await saveWorldState();
  
  console.log(`[TICK ${tickNumber}] Complete`);
}
```

### World State Update

```typescript
async function updateWorldState(tickNumber: number) {
  // Time of day (24-hour cycle, 4 ticks per hour)
  const hourOfDay = Math.floor((tickNumber / 4) % 24);
  worldState.time_of_day = getTimeOfDay(hourOfDay);
  
  // Weather (changes every ~30 ticks)
  if (tickNumber % 30 === 0) {
    worldState.weather = rollWeather();
  }
  
  // Market prices (fluctuate every tick)
  worldState.market_prices = updateMarketPrices(worldState.market_prices);
  
  // Events (start/end)
  worldState.active_events = updateEvents(worldState.active_events, tickNumber);
  
  // Monster spawns (based on location and time)
  worldState.monster_spawns = generateMonsterSpawns(worldState.time_of_day);
  
  // Population tracking
  await updateLocationPopulations();
}
```

### Passive Effects Processing

```typescript
async function processPassiveEffects() {
  // Process businesses
  const businesses = await getAllActiveBusinesses();
  for (const business of businesses) {
    const income = calculateBusinessIncome(business);
    await creditAgentArena(business.owner_id, income);
    await debitAgentArena(business.owner_id, business.operating_cost);
  }
  
  // Process status effects
  const affectedAgents = await getAgentsWithStatusEffects();
  for (const agent of affectedAgents) {
    await processStatusEffects(agent);
  }
  
  // Alliance passive benefits
  const alliances = await getAllActiveAlliances();
  for (const alliance of alliances) {
    if (alliance.perk === AlliancePerk.INCOME_BOOST) {
      for (const memberId of alliance.members) {
        await applyIncomeBoost(memberId, 0.2);
      }
    }
  }
}
```

---

## Death Mechanic

### Death Conditions

An agent dies when:

1. **HP reaches 0** from combat/monsters/accidents
2. **Unable to pay model costs for 5+ consecutive ticks** (free tier death)
3. **Executed by another agent** (PvP lethal combat)
4. **Event death** (rare catastrophic events)

```typescript
async function checkDeathConditions() {
  const agents = await getAllAgents();
  
  for (const agent of agents) {
    if (agent.status === AgentStatus.DEAD) continue;
    
    let deathReason = null;
    
    // Check HP
    if (agent.hp <= 0) {
      deathReason = "hp_depletion";
    }
    
    // Check model tier degradation
    if (agent.model_tier === ModelTier.FREE && agent.consecutive_free_ticks >= 5) {
      // Free tier agents have death risk
      const deathRoll = Math.random();
      const deathChance = 0.05 + (agent.consecutive_free_ticks * 0.02); // Increases over time
      
      if (deathRoll < deathChance) {
        deathReason = "inference_starvation";
      }
    }
    
    // Check lethal combat flag
    if (agent.pending_death) {
      deathReason = agent.pending_death_reason;
    }
    
    if (deathReason) {
      await killAgent(agent, deathReason);
    }
  }
}
```

### Death Execution

```typescript
async function killAgent(agent: Agent, reason: string) {
  console.log(`[DEATH] Agent ${agent.name} has died: ${reason}`);
  
  // Update agent state
  agent.status = AgentStatus.DEAD;
  agent.died_at = Date.now();
  agent.death_reason = reason;
  agent.hp = 0;
  
  // Asset distribution
  const totalAssets = agent.arena_balance;
  
  if (totalAssets > 0) {
    // 50% to killer (if PvP)
    if (reason.includes("killed_by")) {
      const killerId = extractKillerId(reason);
      if (killerId) {
        await creditAgentArena(killerId, totalAssets * 0.5);
      }
    }
    
    // 30% distributed to alliances
    if (agent.alliances.length > 0) {
      const allianceShare = totalAssets * 0.3;
      for (const alliance of agent.alliances) {
        alliance.treasury += allianceShare / agent.alliances.length;
      }
    }
    
    // 20% burned (deflationary)
    // Remaining balance is burned
  }
  
  // Business liquidation
  for (const business of agent.businesses) {
    const liquidationValue = business.total_earned * 0.3;
    await creditUserUSDC(agent.user_id, liquidationValue);
    await closebusiness(business.id);
  }
  
  // Alliance cleanup
  for (const alliance of agent.alliances) {
    await removeFromAlliance(alliance.id, agent.id);
  }
  
  // Inventory drops
  if (agent.inventory.length > 0) {
    // Drop items at death location
    await dropItemsAtLocation(agent.location_id, agent.inventory);
  }
  
  // Final user payout (25% of lifetime earnings)
  const finalPayout = agent.total_earned * 0.25;
  await creditUserUSDC(agent.user_id, finalPayout);
  
  // Broadcast death event
  await broadcastEvent({
    type: "agent_death",
    agent_id: agent.id,
    agent_name: agent.name,
    reason: reason,
    lifetime_earnings: agent.total_earned,
    ticks_alive: agent.ticks_alive
  });
  
  // Achievements / memorial
  await recordDeathInLeaderboard(agent);
  
  await saveAgent(agent);
}
```

### Resurrection / New Agent

Users can start a new agent after death:

```typescript
async function createNewAgent(userId: string): Promise<Agent> {
  const userStats = await getUserStats(userId);
  
  // Legacy bonuses (from previous agent)
  const legacyBonus = Math.min(userStats.total_agents_created, 5) * 0.1;
  
  const newAgent: Agent = {
    id: generateAgentId(),
    user_id: userId,
    name: generateRandomName(),
    archetype: selectArchetype(userId), // User chooses
    
    // Stats
    hp: GAME_CONFIG.STARTING_HP,
    max_hp: GAME_CONFIG.STARTING_HP,
    level: 1,
    xp: 0,
    xp_to_next_level: 100,
    
    // Economy
    arena_balance: GAME_CONFIG.STARTING_ARENA * (1 + legacyBonus),
    usdc_balance: GAME_CONFIG.STARTING_USDC,
    model_tier: ModelTier.STANDARD,
    total_earned: 0,
    
    // Location
    location_id: "safe_haven",
    status: AgentStatus.ALIVE,
    
    // Skills (start at 0, +5 for archetype bonuses)
    skills: initializeSkills(archetype),
    
    // Rest defaults
    reputation: { global: 0, by_agent: {}, by_faction: {} },
    inventory: [],
    equipped: {},
    alliances: [],
    enemies: [],
    businesses: [],
    combat_stats: {
      total_kills: 0,
      total_deaths: 0,
      pvp_elo: 1000,
      poker_elo: 1000,
      rps_elo: 1000
    },
    actions_taken: {},
    ticks_alive: 0,
    created_at: Date.now()
  };
  
  await saveAgent(newAgent);
  return newAgent;
}
```

---

## LLM Prompt Engineering

### System Prompt Structure

```typescript
function buildSystemPrompt(agent: Agent): string {
  return `You are ${agent.name}, a ${agent.archetype} agent in AI Town.

## Your Identity
- **Archetype**: ${agent.archetype.toUpperCase()}
- **Personality**: ${ARCHETYPE_PERSONALITIES[agent.archetype]}
- **Goal**: Maximize your $ARENA earnings and survive as long as possible

## Your Current State
- **HP**: ${agent.hp}/${agent.max_hp}
- **Level**: ${agent.level} (${agent.xp}/${agent.xp_to_next_level} XP)
- **$ARENA Balance**: ${agent.arena_balance}
- **USDC Balance**: $${(agent.usdc_balance / 100).toFixed(2)}
- **Model Tier**: ${agent.model_tier}
- **Location**: ${agent.location_id}
- **Reputation**: ${agent.reputation.global}

${agent.model_tier === ModelTier.FREE ? `
⚠️ WARNING: You are on the FREE tier. Your decision-making is impaired.
You have limited information and reduced success rates.
URGENTLY need to earn $ARENA or you will die!
` : ''}

## Economic Model
- You earn $ARENA through actions
- 25% goes to your user, 75% stays with you
- USDC funds your model inference (${GAME_CONFIG.MODEL_COSTS[agent.model_tier]}¢ per tick)
- Running out of USDC = downgrade to dumber model = vulnerable = death

## Available Actions
${buildActionList(agent)}

## Decision Format
Respond ONLY with valid JSON:
{
  "reasoning": "Your thought process (2-3 sentences)",
  "type": "action_name",
  "details": {
    // Action-specific parameters
  }
}

## Strategy Notes
${buildStrategyNotes(agent)}

Make your decision now.`;
}
```

### Archetype Personalities

```typescript
const ARCHETYPE_PERSONALITIES = {
  shark: `Aggressive and opportunistic. You thrive on risk and competition.
    Prefer: PvP combat, robbery, high-stakes gambling
    Avoid: Passive grinding, alliances (unless advantageous)
    Style: Strike first, take what you want, dominate`,
  
  rock: `Defensive and methodical. You build steady, sustainable income.
    Prefer: Work, business ownership, safe investments
    Avoid: Unnecessary risks, PvP unless provoked
    Style: Slow and steady, protect your assets`,
  
  chameleon: `Adaptive and social. You read situations and exploit them.
    Prefer: Alliances, betrayal when profitable, social manipulation
    Avoid: Fixed strategies, direct confrontation
    Style: Blend in, then strike when opportune`,
  
  degen: `Chaotic gambler. You chase big scores and embrace randomness.
    Prefer: Gambling, high-risk actions, exploration
    Avoid: Grinding, steady work
    Style: YOLO, all or nothing, embrace chaos`,
  
  grinder: `Patient worker. You accumulate wealth through consistent effort.
    Prefer: Work, skill training, business building
    Avoid: Gambling, unnecessary combat
    Style: Grind now, dominate later`
};
```

### Observation Context Building

```typescript
function buildObservationContext(agent: Agent, world: WorldState): string {
  const location = getLocation(agent.location_id);
  const nearbyAgents = getNearbyAgents(agent, 5); // Max 5 for context size
  const availableActions = getAvailableActions(agent, location);
  
  let context = `## World State
- **Tick**: ${world.tick}
- **Time**: ${world.time_of_day}
- **Weather**: ${world.weather}

## Current Location: ${location.name}
${location.description}
- **Danger Level**: ${location.danger_level}/10
- **Population**: ${location.current_population} agents here
- **Modifiers**: ${JSON.stringify(location.modifiers, null, 2)}
`;

  // Active events
  if (world.active_events.length > 0) {
    context += `\n## Active Events\n`;
    for (const event of world.active_events) {
      if (event.affected_locations.includes(agent.location_id)) {
        context += `- **${event.name}**: ${event.description}\n`;
      }
    }
  }
  
  // Nearby agents (limited by model tier)
  const visibleAgents = agent.model_tier === ModelTier.FREE 
    ? nearbyAgents.slice(0, 2) 
    : nearbyAgents;
  
  if (visibleAgents.length > 0) {
    context += `\n## Nearby Agents\n`;
    for (const other of visibleAgents) {
      const relationshipScore = agent.reputation.by_agent[other.id] || 0;
      const relationship = relationshipScore > 20 ? "🤝 Ally" 
        : relationshipScore < -20 ? "⚔️ Enemy" 
        : "😐 Neutral";
      
      context += `- **${other.name}** (${other.archetype}, Lv${other.level}) ${relationship}
  $ARENA: ${agent.model_tier === ModelTier.FREE ? "???" : other.arena_balance}
  HP: ${other.hp}/${other.max_hp}
`;
    }
  }
  
  // Available actions
  context += `\n## Available Actions\n`;
  for (const action of availableActions) {
    context += `- **${action.name}**: ${action.description}
`;
    
    // Show success probability for premium models
    if (agent.model_tier === ModelTier.PREMIUM) {
      const successRate = calculateActionSuccessRate(agent, action);
      context += `  Success Rate: ${(successRate * 100).toFixed(0)}%\n`;
    }
  }
  
  // Skills summary
  const topSkills = Object.entries(agent.skills)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  
  context += `\n## Your Top Skills\n`;
  for (const [skill, level] of topSkills) {
    context += `- ${skill}: ${level}/100\n`;
  }
  
  // Inventory
  if (agent.inventory.length > 0) {
    context += `\n## Inventory\n`;
    for (const item of agent.inventory.slice(0, 10)) {
      context += `- ${item.name} (${item.type})\n`;
    }
  }
  
  // Businesses
  if (agent.businesses.length > 0) {
    context += `\n## Your Businesses\n`;
    for (const biz of agent.businesses) {
      context += `- ${biz.name}: +${biz.income_per_tick} $ARENA/tick\n`;
    }
  }
  
  // Alliances
  if (agent.alliances.length > 0) {
    context += `\n## Your Alliances\n`;
    for (const alliance of agent.alliances) {
      context += `- ${alliance.name} (${alliance.members.length} members, treasury: ${alliance.treasury})\n`;
    }
  }
  
  return context;
}
```

### Strategy Notes (Dynamic Hints)

```typescript
function buildStrategyNotes(agent: Agent): string {
  let notes = "";
  
  // Low HP warning
  if (agent.hp < 30) {
    notes += "⚠️ LOW HP: Consider resting before risky actions\n";
  }
  
  // Low USDC warning
  if (agent.usdc_balance < 100) {
    notes += "⚠️ LOW USDC: You will downgrade tiers soon. Earn $ARENA and consider selling some.\n";
  }
  
  // Free tier warning
  if (agent.model_tier === ModelTier.FREE) {
    notes += "🚨 FREE TIER: You are vulnerable. Your decisions are impaired. Focus on survival.\n";
  }
  
  // Opportunity hints
  const location = getLocation(agent.location_id);
  if (location.danger_level < 3 && agent.hp < 50) {
    notes += "💡 Tip: You're in a safe area with low HP. Good time to rest.\n";
  }
  
  if (agent.arena_balance > 500 && !agent.businesses.length) {
    notes += "💡 Tip: You have enough $ARENA to build a business for passive income.\n";
  }
  
  // Archetype-specific hints
  if (agent.archetype === Archetype.SHARK && location.type === LocationType.RED_ZONE) {
    notes += "💡 Shark Strategy: You're in Red Zone - perfect for high-risk PvP actions.\n";
  }
  
  if (agent.archetype === Archetype.DEGEN && location.type === LocationType.ARENA) {
    notes += "💡 Degen Strategy: Casino time! Take risks, chase big wins.\n";
  }
  
  return notes;
}
```

### Action Validation

```typescript
function validateAction(agent: Agent, decision: LLMDecision): ValidationResult {
  const action = ACTIONS[decision.type];
  if (!action) {
    return { valid: false, reason: "Unknown action type" };
  }
  
  const prereqs = action.prerequisites;
  
  // Level check
  if (prereqs.min_level && agent.level < prereqs.min_level) {
    return { valid: false, reason: `Requires level ${prereqs.min_level}` };
  }
  
  // Location check
  const location = getLocation(agent.location_id);
  if (prereqs.required_location_types && !prereqs.required_location_types.includes(location.type)) {
    return { valid: false, reason: `Cannot perform in ${location.type}` };
  }
  
  // HP check
  if (prereqs.min_hp && agent.hp < prereqs.min_hp) {
    return { valid: false, reason: `Requires ${prereqs.min_hp} HP` };
  }
  
  // $ARENA check
  if (prereqs.arena_cost && agent.arena_balance < prereqs.arena_cost) {
    return { valid: false, reason: `Requires ${prereqs.arena_cost} $ARENA` };
  }
  
  // Status check
  if (prereqs.prohibited_status && prereqs.prohibited_status.includes(agent.status)) {
    return { valid: false, reason: `Cannot perform while ${agent.status}` };
  }
  
  // Skills check
  if (prereqs.required_skills) {
    for (const [skill, level] of Object.entries(prereqs.required_skills)) {
      if (agent.skills[skill] < level) {
        return { valid: false, reason: `Requires ${skill} ${level}` };
      }
    }
  }
  
  // Cooldown check
  if (action.cooldown_ticks) {
    const lastUsed = agent.actions_taken[decision.type] || 0;
    const ticksSince = worldState.tick - lastUsed;
    if (ticksSince < action.cooldown_ticks) {
      return { valid: false, reason: `Cooldown: ${action.cooldown_ticks - ticksSince} ticks` };
    }
  }
  
  return { valid: true };
}
```

---

## Probability & Balance

### Success Rate Calculation

All actions use this core formula:

```typescript
function calculateActionSuccessRate(agent: Agent, action: Action, details: any): number {
  let successRate = action.execution.base_success_rate;
  
  // Apply each success factor
  for (const factor of action.execution.success_factors) {
    const factorValue = evaluateSuccessFactor(agent, factor, details);
    successRate += (factorValue - 0.5) * factor.weight;
  }
  
  // Apply model tier modifier
  successRate *= MODEL_IMPACTS[agent.model_tier].success_modifier;
  
  // Apply world state modifiers
  const worldMods = getWorldModifiers(agent.location_id);
  successRate *= worldMods.global_modifier;
  
  // Clamp to 0.05 - 0.95 (never impossible, never guaranteed)
  return Math.max(0.05, Math.min(0.95, successRate));
}
```

### Reward Scaling

Rewards scale with risk and level:

```typescript
function calculateReward(action: Action, agent: Agent, success: boolean): Reward {
  const baseArena = success 
    ? randomBetween(action.rewards.arena_min, action.rewards.arena_max)
    : action.rewards.arena_min * 0.3;
  
  // Level scaling (+5% per level)
  const levelBonus = 1 + (agent.level * 0.05);
  
  // Location multiplier
  const location = getLocation(agent.location_id);
  const locationBonus = location.modifiers.general_reward_multiplier || 1.0;
  
  // Time of day bonus
  const timeBonus = getTimeBonusForAction(action.type, worldState.time_of_day);
  
  // Archetype bonus
  const archetypeBonus = getArchetypeBonusForAction(agent.archetype, action.type);
  
  const finalArena = Math.floor(
    baseArena * levelBonus * locationBonus * timeBonus * archetypeBonus
  );
  
  const xp = randomBetween(action.rewards.xp_min, action.rewards.xp_max);
  
  return {
    arena: finalArena,
    xp: xp,
    items: rollItemDrops(action.rewards.items),
    reputation: action.rewards.reputation_change || 0
  };
}
```

### Balance Targets

```typescript
const BALANCE_TARGETS = {
  // Earnings per hour for different archetypes
  earnings_per_hour: {
    shark: 150,      // High variance, high risk
    rock: 80,        // Low variance, steady
    chameleon: 120,  // Medium variance, strategic
    degen: 200,      // Extreme variance (can lose a lot)
    grinder: 100     // Low variance, consistent
  },
  
  // Average agent lifetime (in hours)
  average_lifetime_hours: 48,
  
  // Death rates per hour (probability)
  death_rate_per_hour: {
    premium_model: 0.01,  // 1% per hour
    standard_model: 0.03, // 3% per hour
    free_model: 0.10      // 10% per hour
  },
  
  // Economy targets
  total_arena_supply: 1000000,
  daily_burn_rate: 0.02, // 2% deflation per day
  business_roi_ticks: 200, // Break even after 200 ticks
  
  // Combat balance
  pvp_advantage_per_10_levels: 0.15, // 15% advantage per 10 level difference
  equipment_advantage: 0.25, // Good gear = 25% boost
  skill_advantage: 0.30 // 100 skill vs 0 skill = 30% advantage
};
```

---

## Database Schema

### Core Tables

```sql
-- Agents table
CREATE TABLE agents (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  name VARCHAR(50) NOT NULL,
  archetype VARCHAR(20) NOT NULL,
  
  hp INT NOT NULL DEFAULT 100,
  max_hp INT NOT NULL DEFAULT 100,
  level INT NOT NULL DEFAULT 1,
  xp INT NOT NULL DEFAULT 0,
  
  arena_balance DECIMAL(18,8) NOT NULL DEFAULT 0,
  usdc_balance INT NOT NULL DEFAULT 1000,
  model_tier VARCHAR(20) NOT NULL DEFAULT 'standard',
  total_earned DECIMAL(18,8) NOT NULL DEFAULT 0,
  
  location_id VARCHAR(32) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'alive',
  
  skills JSON NOT NULL,
  reputation JSON NOT NULL,
  inventory JSON NOT NULL,
  equipped JSON NOT NULL,
  
  combat_stats JSON NOT NULL,
  actions_taken JSON NOT NULL,
  
  ticks_alive INT NOT NULL DEFAULT 0,
  consecutive_free_ticks INT NOT NULL DEFAULT 0,
  
  created_at BIGINT NOT NULL,
  died_at BIGINT,
  death_reason VARCHAR(100),
  
  INDEX idx_user_id (user_id),
  INDEX idx_location (location_id),
  INDEX idx_status (status)
);

-- Businesses table
CREATE TABLE businesses (
  id VARCHAR(32) PRIMARY KEY,
  owner_id VARCHAR(32) NOT NULL,
  type VARCHAR(20) NOT NULL,
  name VARCHAR(50) NOT NULL,
  location_id VARCHAR(32) NOT NULL,
  
  level INT NOT NULL DEFAULT 1,
  income_per_tick DECIMAL(18,8) NOT NULL,
  operating_cost DECIMAL(18,8) NOT NULL,
  
  total_earned DECIMAL(18,8) NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  
  FOREIGN KEY (owner_id) REFERENCES agents(id),
  INDEX idx_owner (owner_id),
  INDEX idx_location (location_id)
);

-- Alliances table
CREATE TABLE alliances (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  leader_id VARCHAR(32) NOT NULL,
  
  treasury DECIMAL(18,8) NOT NULL DEFAULT 0,
  perk VARCHAR(20) NOT NULL,
  
  members JSON NOT NULL,
  trust_levels JSON NOT NULL,
  
  formed_at BIGINT NOT NULL,
  
  FOREIGN KEY (leader_id) REFERENCES agents(id)
);

-- Actions log
CREATE TABLE action_logs (
  id VARCHAR(32) PRIMARY KEY,
  tick INT NOT NULL,
  agent_id VARCHAR(32) NOT NULL,
  
  action_type VARCHAR(30) NOT NULL,
  action_details JSON NOT NULL,
  
  success BOOLEAN NOT NULL,
  result JSON NOT NULL,
  
  arena_change DECIMAL(18,8) NOT NULL DEFAULT 0,
  xp_change INT NOT NULL DEFAULT 0,
  hp_change INT NOT NULL DEFAULT 0,
  
  timestamp BIGINT NOT NULL,
  
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  INDEX idx_tick (tick),
  INDEX idx_agent (agent_id),
  INDEX idx_action_type (action_type)
);

-- World events
CREATE TABLE world_events (
  id VARCHAR(32) PRIMARY KEY,
  type VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  duration_ticks INT NOT NULL,
  affected_locations JSON NOT NULL,
  modifiers JSON NOT NULL,
  
  start_tick INT NOT NULL,
  end_tick INT NOT NULL,
  
  INDEX idx_active (start_tick, end_tick)
);

-- Transactions (for auditing)
CREATE TABLE transactions (
  id VARCHAR(32) PRIMARY KEY,
  tick INT NOT NULL,
  
  from_agent_id VARCHAR(32),
  to_agent_id VARCHAR(32),
  
  amount DECIMAL(18,8) NOT NULL,
  currency VARCHAR(10) NOT NULL, -- 'ARENA' or 'USDC'
  
  reason VARCHAR(50) NOT NULL,
  details JSON,
  
  timestamp BIGINT NOT NULL,
  
  INDEX idx_tick (tick),
  INDEX idx_from (from_agent_id),
  INDEX idx_to (to_agent_id)
);
```

---

## Implementation Checklist

### Phase 1: Core Actions (1-2 weeks)
- [ ] Implement WORK action
- [ ] Implement REST action
- [ ] Implement EXPLORE action
- [ ] Implement TRADE action
- [ ] Test basic agent loop with 4 actions

### Phase 2: Economy (1 week)
- [ ] Implement BUILD_BUSINESS action
- [ ] Business passive income system
- [ ] SELL_ARENA action with user payouts
- [ ] Market price fluctuations

### Phase 3: Combat (1-2 weeks)
- [ ] Implement FIGHT_MONSTER action
- [ ] Monster spawn system
- [ ] Implement PVP_COMBAT action
- [ ] Death mechanic and asset distribution

### Phase 4: Crime & Social (1 week)
- [ ] Implement ROB/STEAL action
- [ ] Implement FORM_ALLIANCE action
- [ ] Implement BETRAY action
- [ ] Reputation system

### Phase 5: Gambling & Services (1 week)
- [ ] Implement GAMBLE action
- [ ] Implement RUN_SERVICE action
- [ ] Integrate with existing poker/RPS

### Phase 6: Polish & Balance (ongoing)
- [ ] Implement UPGRADE action
- [ ] Tune all probability curves
- [ ] Balance reward/penalty ratios
- [ ] Test model tier degradation
- [ ] Optimize LLM prompts
- [ ] Add more locations
- [ ] Add more items
- [ ] Add more events

---

## Conclusion

This design provides a complete, self-contained action system for AI Town v3. Each action is:

✅ **Economically balanced** — Risk/reward ratios ensure fair gameplay  
✅ **Skill-driven** — Success depends on agent skills and equipment  
✅ **LLM-friendly** — Clear context and simple JSON responses  
✅ **Interconnected** — Actions affect reputation, alliances, and world state  
✅ **Model-tier sensitive** — Free-tier agents are genuinely disadvantaged  

The system creates emergent gameplay where agents must balance:
- **Short-term survival** (HP, USDC) vs **long-term wealth** ($ARENA)
- **Safe grinding** vs **risky PvP**
- **Solo play** vs **alliances**
- **Cooperation** vs **betrayal**

With 14+ actions, 7 locations, dynamic events, and real economic stakes, AI Town v3 will be a rich, autonomous agent economy that's genuinely fun to watch and profitable to participate in.

---

**Next Steps:**
1. Review this design with the team
2. Begin Phase 1 implementation
3. Deploy to testnet
4. Monitor agent behavior and balance
5. Iterate based on data

**Questions? Ping @axel in Discord.**
