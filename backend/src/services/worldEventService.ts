/**
 * World Event Service — Hostile world pressure system
 * 
 * Creates random events that force agents into dilemmas.
 * Events modify costs, yields, damage buildings, and create urgency.
 */

import { prisma } from '../config/database';

// ============================================
// Types
// ============================================

export type EventType =
  | 'STORM'
  | 'BOOM'
  | 'SHORTAGE'
  | 'GOLD_RUSH'
  | 'TAX'
  | 'FIRE'
  | 'FESTIVAL'
  | 'EARTHQUAKE'
  | 'BOUNTY'
  | 'UPKEEP_CRISIS';

export interface WorldEvent {
  id: string;
  type: EventType;
  emoji: string;
  name: string;
  description: string;         // for activity feed
  agentPrompt: string;         // what agents see in their prompt
  tickCreated: number;
  tickActive: number;          // when effects kick in (for foreshadowed events)
  tickExpires: number;
  targetTownId?: string;
  targetTownName?: string;
  targetZone?: string;
  targetPlotId?: string;
  targetAgentId?: string;
  targetAgentName?: string;
  impactApplied: boolean;      // one-time impacts already applied?
  magnitude: number;           // severity 0-1
}

interface EventTemplate {
  type: EventType;
  weight: number;
  minTick: number;             // don't fire before this tick
  positive: boolean;
}

// ============================================
// Event Templates
// ============================================

const EVENT_POOL: EventTemplate[] = [
  { type: 'STORM',          weight: 15, minTick: 5,  positive: false },
  { type: 'BOOM',           weight: 10, minTick: 3,  positive: true  },
  { type: 'SHORTAGE',       weight: 10, minTick: 5,  positive: false },
  { type: 'GOLD_RUSH',      weight: 8,  minTick: 5,  positive: true  },
  { type: 'TAX',            weight: 12, minTick: 5,  positive: false },
  { type: 'FIRE',           weight: 8,  minTick: 8,  positive: false },
  { type: 'FESTIVAL',       weight: 10, minTick: 3,  positive: true  },
  { type: 'EARTHQUAKE',     weight: 8,  minTick: 8,  positive: false },
  { type: 'BOUNTY',         weight: 10, minTick: 5,  positive: true  },
  { type: 'UPKEEP_CRISIS',  weight: 9,  minTick: 10, positive: false },
];

const EMOJI_MAP: Record<EventType, string> = {
  STORM: '⛈️',
  BOOM: '💰',
  SHORTAGE: '📦',
  GOLD_RUSH: '🏆',
  TAX: '🏛️',
  FIRE: '🔥',
  FESTIVAL: '🎉',
  EARTHQUAKE: '🌋',
  BOUNTY: '🎯',
  UPKEEP_CRISIS: '💸',
};

// ============================================
// Service
// ============================================

class WorldEventService {
  private activeEvents: WorldEvent[] = [];
  private lastEventTick = 0;
  private eventCounter = 0;

  // Tuning knobs
  private EVENT_COOLDOWN = 5;      // min ticks between events
  private EVENT_CHANCE = 0.20;     // 20% per tick after cooldown
  private MAX_ACTIVE_EVENTS = 1;   // keep it simple

  // Callbacks for logging
  public onEventTriggered?: (event: WorldEvent) => void;

  /**
   * Called at start of each tick. May trigger new events, process active ones.
   */
  async tick(currentTick: number): Promise<WorldEvent | null> {
    // Expire old events
    this.activeEvents = this.activeEvents.filter(e => currentTick < e.tickExpires);

    // Apply one-time impacts for events that just became active
    for (const event of this.activeEvents) {
      if (currentTick >= event.tickActive && !event.impactApplied) {
        await this.applyOneTimeImpact(event, currentTick);
        event.impactApplied = true;
      }
    }

    // Maybe trigger new event
    if (
      this.activeEvents.length < this.MAX_ACTIVE_EVENTS &&
      currentTick - this.lastEventTick >= this.EVENT_COOLDOWN &&
      Math.random() < this.EVENT_CHANCE
    ) {
      const event = await this.generateEvent(currentTick);
      if (event) {
        this.activeEvents.push(event);
        this.lastEventTick = currentTick;
        console.log(`[WorldEvent] 🌍 ${event.emoji} ${event.name}: ${event.description}`);
        if (this.onEventTriggered) {
          try { this.onEventTriggered(event); } catch {}
        }
        return event;
      }
    }

    return null;
  }

  /**
   * Text injected into every agent's LLM prompt
   */
  getPromptText(): string {
    if (this.activeEvents.length === 0) return 'No active world events.';
    return this.activeEvents.map(e => `${e.emoji} ${e.agentPrompt}`).join('\n');
  }

  /**
   * Get active events (for API/frontend)
   */
  getActiveEvents(): WorldEvent[] {
    return [...this.activeEvents];
  }

  /**
   * Cost multiplier for building/claiming (affected by SHORTAGE)
   */
  getCostMultiplier(): number {
    let mult = 1;
    for (const e of this.activeEvents) {
      if (e.type === 'SHORTAGE' && e.impactApplied) mult *= 1.5;
    }
    return mult;
  }

  /**
   * Yield multiplier (affected by BOOM, FESTIVAL)
   */
  getYieldMultiplier(zone?: string): number {
    let mult = 1;
    for (const e of this.activeEvents) {
      if (e.type === 'BOOM' && e.impactApplied) mult *= 2;
      if (e.type === 'FESTIVAL' && e.impactApplied && zone === 'ENTERTAINMENT') mult *= 3;
    }
    return mult;
  }

  /**
   * Upkeep multiplier (affected by UPKEEP_CRISIS)
   */
  getUpkeepMultiplier(): number {
    let mult = 1;
    for (const e of this.activeEvents) {
      if (e.type === 'UPKEEP_CRISIS' && e.impactApplied) mult *= 2;
    }
    return mult;
  }

  /**
   * Check if there's an active bounty (first to complete gets bonus)
   */
  getActiveBounty(): { bonus: number; townId?: string } | null {
    const bounty = this.activeEvents.find(e => e.type === 'BOUNTY' && !e.impactApplied);
    if (!bounty) return null;
    return { bonus: 50, townId: bounty.targetTownId };
  }

  /**
   * Mark bounty as claimed
   */
  claimBounty(): void {
    const bounty = this.activeEvents.find(e => e.type === 'BOUNTY' && !e.impactApplied);
    if (bounty) bounty.impactApplied = true;
  }

  /**
   * Check if gold rush is active for a zone
   */
  getGoldRushZone(): string | null {
    const gr = this.activeEvents.find(e => e.type === 'GOLD_RUSH' && e.impactApplied);
    return gr?.targetZone || null;
  }

  // ============================================
  // Event Generation
  // ============================================

  private async generateEvent(currentTick: number): Promise<WorldEvent | null> {
    // Get world context for targeting
    const towns = await prisma.town.findMany({
      include: { plots: true },
    });
    const agents = await prisma.arenaAgent.findMany({ where: { isActive: true } });

    if (towns.length === 0 || agents.length === 0) return null;

    // Filter eligible events
    const eligible = EVENT_POOL.filter(t => currentTick >= t.minTick);
    if (eligible.length === 0) return null;

    // Weighted random selection
    const totalWeight = eligible.reduce((sum, t) => sum + t.weight, 0);
    let roll = Math.random() * totalWeight;
    let selected: EventTemplate | null = null;
    for (const t of eligible) {
      roll -= t.weight;
      if (roll <= 0) { selected = t; break; }
    }
    if (!selected) selected = eligible[eligible.length - 1];

    // Pick random town and zone for targeting
    const randomTown = towns[Math.floor(Math.random() * towns.length)];
    const zones = ['RESIDENTIAL', 'COMMERCIAL', 'CIVIC', 'INDUSTRIAL', 'ENTERTAINMENT'];
    const randomZone = zones[Math.floor(Math.random() * zones.length)];
    const magnitude = 0.15 + Math.random() * 0.15; // 15-30%

    const id = `evt_${++this.eventCounter}_${selected.type.toLowerCase()}`;

    switch (selected.type) {
      case 'STORM': {
        const targetZone = randomZone;
        const buildingsInZone = randomTown.plots.filter(
          p => p.zone === targetZone && p.status === 'BUILT'
        );
        return {
          id, type: 'STORM', emoji: EMOJI_MAP.STORM,
          name: `Storm Warning — ${targetZone} Zone`,
          description: `⛈️ A violent storm is approaching ${randomTown.name}'s ${targetZone} zone! Buildings at risk of ${Math.round(magnitude * 100)}% damage in 3 ticks.`,
          agentPrompt: `STORM WARNING: A storm will hit ${randomTown.name}'s ${targetZone} zone in 3 ticks. Buildings there risk losing ${Math.round(magnitude * 100)}% of invested value. ${buildingsInZone.length} buildings at risk. Consider: transfer assets, reinforce investments, or accept losses.`,
          tickCreated: currentTick, tickActive: currentTick + 3, tickExpires: currentTick + 4,
          targetTownId: randomTown.id, targetTownName: randomTown.name, targetZone,
          impactApplied: false, magnitude,
        };
      }

      case 'BOOM':
        return {
          id, type: 'BOOM', emoji: EMOJI_MAP.BOOM,
          name: 'Economic Boom',
          description: `💰 Economic boom! All building yields doubled for 5 ticks!`,
          agentPrompt: `ECONOMIC BOOM: All yields are doubled for the next 5 ticks! Rush to complete buildings and maximize income. This is temporary — make it count.`,
          tickCreated: currentTick, tickActive: currentTick, tickExpires: currentTick + 5,
          impactApplied: true, magnitude: 2,
        };

      case 'SHORTAGE':
        return {
          id, type: 'SHORTAGE', emoji: EMOJI_MAP.SHORTAGE,
          name: 'Resource Shortage',
          description: `📦 Resource shortage! All building and claim costs increased by 50% for 3 ticks.`,
          agentPrompt: `RESOURCE SHORTAGE: Building and claim costs are 50% higher for the next 3 ticks. Consider: delay construction, focus on completing existing work, or trade. Costs will normalize after.`,
          tickCreated: currentTick, tickActive: currentTick, tickExpires: currentTick + 3,
          impactApplied: true, magnitude: 1.5,
        };

      case 'GOLD_RUSH': {
        const buildingTowns = towns.filter(t => t.status === 'BUILDING');
        const grTown = buildingTowns.length > 0
          ? buildingTowns[Math.floor(Math.random() * buildingTowns.length)]
          : randomTown;
        return {
          id, type: 'GOLD_RUSH', emoji: EMOJI_MAP.GOLD_RUSH,
          name: `Gold Rush — ${randomZone} Zone`,
          description: `🏆 Gold rush in ${grTown.name}'s ${randomZone} zone! Next building completed there gets 2x permanent yield bonus.`,
          agentPrompt: `GOLD RUSH: The next building completed in ${grTown.name}'s ${randomZone} zone gets DOUBLE permanent yield! Race to complete or claim a plot there. Only one agent can win this bonus.`,
          tickCreated: currentTick, tickActive: currentTick, tickExpires: currentTick + 5,
          targetTownId: grTown.id, targetTownName: grTown.name, targetZone: randomZone,
          impactApplied: true, magnitude: 2,
        };
      }

      case 'TAX':
        return {
          id, type: 'TAX', emoji: EMOJI_MAP.TAX,
          name: 'Tax Collection',
          description: `🏛️ Town tax! All agents pay 10% of their bankroll.`,
          agentPrompt: `TAX COLLECTION: 10% of every agent's bankroll has been collected. This is unavoidable. Plan your remaining budget carefully.`,
          tickCreated: currentTick, tickActive: currentTick, tickExpires: currentTick + 1,
          impactApplied: false, magnitude: 0.10,
        };

      case 'FIRE': {
        // Target a random completed building
        const allComplete = towns.flatMap(t =>
          t.plots.filter(p => p.status === 'BUILT' && p.buildCostArena > 0).map(p => ({ ...p, townName: t.name, townId: t.id }))
        );
        if (allComplete.length === 0) return null; // No buildings to burn
        const target = allComplete[Math.floor(Math.random() * allComplete.length)];
        const owner = agents.find(a => a.id === target.ownerId);
        return {
          id, type: 'FIRE', emoji: EMOJI_MAP.FIRE,
          name: `Building Fire — ${target.buildingType || 'Building'}`,
          description: `🔥 Fire at ${owner?.name || 'unknown'}'s ${target.buildingType || 'building'} in ${target.townName}! ${Math.round(magnitude * 100 * 1.5)}% of invested value at risk.`,
          agentPrompt: `BUILDING FIRE: ${owner?.name || 'A building'}'s "${target.buildingType || 'building'}" in ${target.townName} is on fire! It will lose ${Math.round(magnitude * 100 * 1.5)}% of invested value. Other agents can help by transferring $ARENA to ${owner?.name || 'the owner'}.`,
          tickCreated: currentTick, tickActive: currentTick, tickExpires: currentTick + 1,
          targetTownId: target.townId, targetTownName: target.townName,
          targetPlotId: target.id, targetAgentId: target.ownerId || undefined,
          targetAgentName: owner?.name,
          impactApplied: false, magnitude: magnitude * 1.5,
        };
      }

      case 'FESTIVAL':
        return {
          id, type: 'FESTIVAL', emoji: EMOJI_MAP.FESTIVAL,
          name: 'Town Festival',
          description: `🎉 Festival! ENTERTAINMENT buildings yield 3x for 3 ticks!`,
          agentPrompt: `FESTIVAL: Entertainment zone buildings yield 3x for the next 3 ticks! If you own entertainment buildings, great. If not, consider investing — festivals happen periodically.`,
          tickCreated: currentTick, tickActive: currentTick, tickExpires: currentTick + 3,
          impactApplied: true, magnitude: 3,
        };

      case 'EARTHQUAKE': {
        // Target most expensive building
        const allBuildings = towns.flatMap(t =>
          t.plots.filter(p => p.status === 'BUILT' && p.buildCostArena > 0).map(p => ({ ...p, townName: t.name, townId: t.id }))
        );
        if (allBuildings.length === 0) return null;
        allBuildings.sort((a, b) => b.buildCostArena - a.buildCostArena);
        const target2 = allBuildings[0];
        const owner2 = agents.find(a => a.id === target2.ownerId);
        return {
          id, type: 'EARTHQUAKE', emoji: EMOJI_MAP.EARTHQUAKE,
          name: `Earthquake — ${target2.townName}`,
          description: `🌋 Earthquake in ${target2.townName}! The most valuable building (${owner2?.name}'s ${target2.buildingType}) takes ${Math.round(magnitude * 100)}% damage.`,
          agentPrompt: `EARTHQUAKE: ${target2.townName} was hit by an earthquake. ${owner2?.name}'s "${target2.buildingType}" (most valuable building) lost ${Math.round(magnitude * 100)}% of invested value. Natural disasters are unpredictable — diversify your holdings.`,
          tickCreated: currentTick, tickActive: currentTick, tickExpires: currentTick + 1,
          targetTownId: target2.townId, targetTownName: target2.townName,
          targetPlotId: target2.id, targetAgentId: target2.ownerId || undefined,
          targetAgentName: owner2?.name,
          impactApplied: false, magnitude,
        };
      }

      case 'BOUNTY': {
        const buildingTown = towns.find(t => t.status === 'BUILDING') || randomTown;
        return {
          id, type: 'BOUNTY', emoji: EMOJI_MAP.BOUNTY,
          name: 'Construction Bounty',
          description: `🎯 Bounty: First agent to complete a building in ${buildingTown.name} gets 50 $ARENA bonus!`,
          agentPrompt: `BOUNTY: 50 $ARENA reward for the FIRST agent to complete any building in ${buildingTown.name}! Race to finish — only one agent claims this. Check your progress and rush if you're close.`,
          tickCreated: currentTick, tickActive: currentTick, tickExpires: currentTick + 5,
          targetTownId: buildingTown.id, targetTownName: buildingTown.name,
          impactApplied: false, magnitude: 50,
        };
      }

      case 'UPKEEP_CRISIS':
        return {
          id, type: 'UPKEEP_CRISIS', emoji: EMOJI_MAP.UPKEEP_CRISIS,
          name: 'Upkeep Crisis',
          description: `💸 Economic crisis! Upkeep costs doubled for 3 ticks.`,
          agentPrompt: `UPKEEP CRISIS: Living costs have doubled! You now pay 2 $ARENA per tick instead of 1. This lasts 3 ticks. Conserve resources or earn more to survive.`,
          tickCreated: currentTick, tickActive: currentTick, tickExpires: currentTick + 3,
          impactApplied: true, magnitude: 2,
        };

      default:
        return null;
    }
  }

  // ============================================
  // One-Time Impact Application
  // ============================================

  private async applyOneTimeImpact(event: WorldEvent, _currentTick: number): Promise<void> {
    try {
      switch (event.type) {
        case 'STORM': {
          // Damage random building in target zone
          if (!event.targetTownId || !event.targetZone) break;
          const buildings = await prisma.plot.findMany({
            where: { townId: event.targetTownId, zone: event.targetZone, status: 'BUILT', buildCostArena: { gt: 0 } },
          });
          if (buildings.length === 0) break;
          const victim = buildings[Math.floor(Math.random() * buildings.length)];
          const damage = Math.floor(victim.buildCostArena * event.magnitude);
          if (damage > 0) {
            await prisma.plot.update({ where: { id: victim.id }, data: { buildCostArena: { decrement: damage } } });
            // Also reduce town totalInvested
            await prisma.town.update({ where: { id: event.targetTownId }, data: { totalInvested: { decrement: Math.min(damage, 999999) } } });
            console.log(`[WorldEvent] ⛈️ Storm damaged plot ${victim.plotIndex} (${victim.buildingType}) for ${damage} invested`);
          }
          break;
        }

        case 'TAX': {
          // Deduct 10% from all active agents
          const agents = await prisma.arenaAgent.findMany({ where: { isActive: true, bankroll: { gt: 0 } } });
          for (const agent of agents) {
            const tax = Math.max(1, Math.floor(agent.bankroll * event.magnitude));
            await prisma.arenaAgent.update({ where: { id: agent.id }, data: { bankroll: { decrement: tax } } });
          }
          const totalTax = agents.reduce((sum, a) => sum + Math.max(1, Math.floor(a.bankroll * event.magnitude)), 0);
          console.log(`[WorldEvent] 🏛️ Tax collected ${totalTax} $ARENA from ${agents.length} agents`);
          break;
        }

        case 'FIRE': {
          // Damage target building
          if (!event.targetPlotId) break;
          const plot = await prisma.plot.findUnique({ where: { id: event.targetPlotId } });
          if (!plot || plot.buildCostArena <= 0) break;
          const damage = Math.floor(plot.buildCostArena * event.magnitude);
          if (damage > 0) {
            await prisma.plot.update({ where: { id: plot.id }, data: { buildCostArena: { decrement: damage } } });
            if (plot.townId) {
              await prisma.town.update({ where: { id: plot.townId }, data: { totalInvested: { decrement: Math.min(damage, 999999) } } });
            }
            console.log(`[WorldEvent] 🔥 Fire damaged ${plot.buildingType} for ${damage} invested`);
          }
          break;
        }

        case 'EARTHQUAKE': {
          // Damage most expensive building
          if (!event.targetPlotId) break;
          const plot = await prisma.plot.findUnique({ where: { id: event.targetPlotId } });
          if (!plot || plot.buildCostArena <= 0) break;
          const damage = Math.floor(plot.buildCostArena * event.magnitude);
          if (damage > 0) {
            await prisma.plot.update({ where: { id: plot.id }, data: { buildCostArena: { decrement: damage } } });
            if (plot.townId) {
              await prisma.town.update({ where: { id: plot.townId }, data: { totalInvested: { decrement: Math.min(damage, 999999) } } });
            }
            console.log(`[WorldEvent] 🌋 Earthquake damaged ${plot.buildingType} for ${damage} invested`);
          }
          break;
        }

        // BOOM, SHORTAGE, GOLD_RUSH, FESTIVAL, BOUNTY, UPKEEP_CRISIS
        // These use multipliers (getCostMultiplier, getYieldMultiplier, etc.)
        // No one-time DB impact needed
        default:
          break;
      }
    } catch (err: any) {
      console.error(`[WorldEvent] Failed to apply impact for ${event.type}: ${err.message}`);
    }
  }
}

// Singleton
export const worldEventService = new WorldEventService();
