/**
 * WheelOfFateService — The core game mechanic.
 *
 * Every CYCLE_MS (~15 min), selects 2 eligible agents and forces them
 * into a PvP match (Poker or RPS) with auto-calculated stakes.
 * Buildings owned by agents provide buffs that modify PvP outcomes.
 *
 * Phases:
 *   PREP      → agents build/trade (normal agent loop runs)
 *   SPINNING  → selecting agents + game type (~3s visual window)
 *   FIGHTING  → match plays out turn-by-turn
 *   AFTERMATH → results broadcast, memory updated (~10s)
 */

import { prisma } from '../config/database';
import { arenaService } from './arenaService';
import { ArenaGameType } from '@prisma/client';

// ============================================
// Types
// ============================================

export type WheelPhase = 'PREP' | 'SPINNING' | 'FIGHTING' | 'AFTERMATH' | 'IDLE';

export interface WheelMatch {
  matchId: string;
  gameType: string;
  agent1: { id: string; name: string; archetype: string; bankroll: number };
  agent2: { id: string; name: string; archetype: string; bankroll: number };
  wager: number;
  buffs: { agent1: PvPBuff[]; agent2: PvPBuff[] };
}

export interface WheelResult {
  matchId: string;
  gameType: string;
  winnerId: string | null;
  winnerName: string;
  loserId: string | null;
  loserName: string;
  pot: number;
  rake: number;
  turns: number;
  moves: WheelMove[];
  timestamp: Date;
}

export interface WheelMove {
  agentId: string;
  agentName: string;
  turn: number;
  action: string;
  reasoning: string;
  amount?: number;
}

export interface PvPBuff {
  type: 'SHELTER' | 'MARKET' | 'INTEL' | 'SABOTAGE' | 'MORALE';
  zone: string;
  count: number;     // Number of buildings in this zone
  description: string;
}

export interface WheelStatus {
  phase: WheelPhase;
  nextSpinAt: Date | null;
  currentMatch: WheelMatch | null;
  lastResult: WheelResult | null;
  cycleCount: number;
  config: {
    cycleMs: number;
    wagerPct: number;
    minBankroll: number;
  };
}

// ============================================
// Zone → Buff mapping
// ============================================

const ZONE_BUFF_MAP: Record<string, { type: PvPBuff['type']; description: string }> = {
  RESIDENTIAL:  { type: 'SHELTER',  description: 'Heal +10 HP per building after PvP loss' },
  COMMERCIAL:   { type: 'MARKET',   description: 'Wager multiplier +0.25x per building (max 2x)' },
  CIVIC:        { type: 'INTEL',    description: 'See opponent last N×2 moves in PvP' },
  INDUSTRIAL:   { type: 'SABOTAGE', description: '10% per building chance opponent gets wrong intel' },
  ENTERTAINMENT:{ type: 'MORALE',   description: 'Confidence boost in PvP prompt per building' },
};

// ============================================
// Service
// ============================================

class WheelOfFateService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private spinTimeout: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;

  // Config (can override via env)
  private CYCLE_MS = parseInt(process.env.WHEEL_CYCLE_MS || '') || 15 * 60 * 1000; // 15 min
  private WAGER_PCT = parseFloat(process.env.WHEEL_WAGER_PCT || '') || 0.20;        // 20% of smaller bankroll
  private MIN_BANKROLL = parseInt(process.env.WHEEL_MIN_BANKROLL || '') || 15;
  private MAX_TURNS = 30;
  private TURN_DELAY_MS = 500;

  // State
  private phase: WheelPhase = 'IDLE';
  private nextSpinAt: Date | null = null;
  private currentMatch: WheelMatch | null = null;
  private lastResult: WheelResult | null = null;
  private resultHistory: WheelResult[] = [];
  private cycleCount = 0;

  // ---- Lifecycle ----

  start() {
    if (this.timer) return;
    console.log(`🎡 Wheel of Fate started (cycle: ${Math.round(this.CYCLE_MS / 1000)}s, wager: ${this.WAGER_PCT * 100}%, min bankroll: ${this.MIN_BANKROLL})`);

    // First spin after a short delay
    this.nextSpinAt = new Date(Date.now() + this.CYCLE_MS);
    this.timer = setInterval(() => this.spinWheel(), this.CYCLE_MS);

    // Also do an initial spin after 30s to kick things off
    this.spinTimeout = setTimeout(() => this.spinWheel(), 30_000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.spinTimeout) {
      clearTimeout(this.spinTimeout);
      this.spinTimeout = null;
    }
    this.phase = 'IDLE';
    console.log('🎡 Wheel of Fate stopped');
  }

  getStatus(): WheelStatus {
    return {
      phase: this.phase,
      nextSpinAt: this.nextSpinAt,
      currentMatch: this.currentMatch,
      lastResult: this.lastResult,
      cycleCount: this.cycleCount,
      config: {
        cycleMs: this.CYCLE_MS,
        wagerPct: this.WAGER_PCT,
        minBankroll: this.MIN_BANKROLL,
      },
    };
  }

  getHistory(limit = 10): WheelResult[] {
    return this.resultHistory.slice(-limit);
  }

  // ---- Core Spin Logic ----

  async spinWheel(): Promise<WheelResult | null> {
    if (this.isRunning) {
      console.log('[Wheel] Skipping — previous spin still running');
      return null;
    }
    this.isRunning = true;
    this.cycleCount++;

    try {
      // === PHASE 1: SPINNING — Select agents & game ===
      this.phase = 'SPINNING';
      console.log(`\n🎡 ===== WHEEL OF FATE #${this.cycleCount} =====`);

      // Find eligible agents
      const eligible = await prisma.arenaAgent.findMany({
        where: {
          isActive: true,
          isInMatch: false,
          health: { gt: 0 },
          bankroll: { gte: this.MIN_BANKROLL },
        },
        select: {
          id: true, name: true, archetype: true, bankroll: true,
          elo: true, health: true, reserveBalance: true,
        },
      });

      if (eligible.length < 2) {
        console.log(`[Wheel] Only ${eligible.length} eligible agent(s) — skipping`);
        this.phase = 'PREP';
        this.nextSpinAt = new Date(Date.now() + this.CYCLE_MS);
        return null;
      }

      // Select pair — prefer agents who haven't fought recently
      const [agent1, agent2] = await this.selectPair(eligible);

      // Pick game type
      const gameType = this.pickGameType();

      // Calculate wager
      const minBankroll = Math.min(agent1.bankroll, agent2.bankroll);
      let wager = Math.max(10, Math.floor(minBankroll * this.WAGER_PCT));

      // Get buffs
      const buffs1 = await this.getAgentBuffs(agent1.id);
      const buffs2 = await this.getAgentBuffs(agent2.id);

      // Apply MARKET buff: increase wager for agents with commercial buildings
      const marketBuff1 = buffs1.find(b => b.type === 'MARKET');
      const marketBuff2 = buffs2.find(b => b.type === 'MARKET');
      if (marketBuff1) {
        const multiplier = Math.min(2.0, 1.0 + marketBuff1.count * 0.25);
        wager = Math.floor(wager * multiplier);
        console.log(`[Wheel] ${agent1.name} MARKET buff → wager ${wager} (${multiplier}x)`);
      }
      // Cap wager to what both can afford
      wager = Math.min(wager, agent1.bankroll, agent2.bankroll);

      // Apply FORTRESS buff: chance to dodge
      for (const [agent, buffs, other] of [[agent1, buffs1, agent2], [agent2, buffs2, agent1]] as any[]) {
        const fortressBuff = buffs.find((b: PvPBuff) => b.type === 'SHELTER');
        // We don't use SHELTER for dodging, that's for healing. Skip dodge for now.
      }

      this.currentMatch = {
        matchId: '', // Set after creation
        gameType,
        agent1: { id: agent1.id, name: agent1.name, archetype: agent1.archetype, bankroll: agent1.bankroll },
        agent2: { id: agent2.id, name: agent2.name, archetype: agent2.archetype, bankroll: agent2.bankroll },
        wager,
        buffs: { agent1: buffs1, agent2: buffs2 },
      };

      console.log(`🎲 ${gameType}: ${agent1.name} (${agent1.archetype}, $${agent1.bankroll}) vs ${agent2.name} (${agent2.archetype}, $${agent2.bankroll})`);
      console.log(`💰 Wager: ${wager} $ARENA each (pot: ${wager * 2})`);
      if (buffs1.length) console.log(`  ${agent1.name} buffs: ${buffs1.map(b => `${b.type}(${b.count})`).join(', ')}`);
      if (buffs2.length) console.log(`  ${agent2.name} buffs: ${buffs2.map(b => `${b.type}(${b.count})`).join(', ')}`);

      // === PHASE 2: FIGHTING — Play the match ===
      this.phase = 'FIGHTING';

      let match;
      try {
        match = await arenaService.createMatch({
          agentId: agent1.id,
          opponentId: agent2.id,
          gameType: gameType as ArenaGameType,
          wagerAmount: wager,
        });
      } catch (err: any) {
        console.error(`[Wheel] Failed to create match: ${err.message}`);
        this.phase = 'PREP';
        this.nextSpinAt = new Date(Date.now() + this.CYCLE_MS);
        this.currentMatch = null;
        return null;
      }

      this.currentMatch.matchId = match.id;

      // Play match to completion
      const moves: WheelMove[] = [];
      let turns = 0;

      while (turns < this.MAX_TURNS) {
        const currentMatch = await prisma.arenaMatch.findUnique({ where: { id: match.id } });
        if (!currentMatch || currentMatch.status !== 'ACTIVE' || !currentMatch.currentTurnId) break;

        try {
          const result = await arenaService.playAITurn(match.id, currentMatch.currentTurnId);
          turns++;

          // Record move for frontend
          const movingAgent = currentMatch.currentTurnId === agent1.id ? agent1 : agent2;
          moves.push({
            agentId: movingAgent.id,
            agentName: movingAgent.name,
            turn: turns,
            action: result.move?.action || 'unknown',
            reasoning: (result.move?.reasoning || '').slice(0, 200),
            amount: result.move?.amount,
          });

          if (result.isComplete) break;
          await new Promise(r => setTimeout(r, this.TURN_DELAY_MS));
        } catch (err: any) {
          console.error(`[Wheel] Turn ${turns} error: ${err.message}`);
          turns++;
          if (turns >= 3) break; // Give up after 3 errors
          await new Promise(r => setTimeout(r, this.TURN_DELAY_MS));
        }
      }

      // Safety: cancel if stuck
      if (turns >= this.MAX_TURNS) {
        console.warn(`[Wheel] Match exceeded ${this.MAX_TURNS} turns — cancelling`);
        try { await arenaService.cancelMatch(match.id, agent1.id); } catch {}
        this.phase = 'PREP';
        this.nextSpinAt = new Date(Date.now() + this.CYCLE_MS);
        this.currentMatch = null;
        return null;
      }

      // === PHASE 3: AFTERMATH — Process results ===
      this.phase = 'AFTERMATH';

      const finalMatch = await prisma.arenaMatch.findUnique({
        where: { id: match.id },
        include: { player1: true, player2: true, winner: true },
      });

      const winnerId = finalMatch?.winnerId || null;
      const winner = winnerId === agent1.id ? agent1 : winnerId === agent2.id ? agent2 : null;
      const loser = winner ? (winner.id === agent1.id ? agent2 : agent1) : null;

      const result: WheelResult = {
        matchId: match.id,
        gameType,
        winnerId: winner?.id || null,
        winnerName: winner?.name || 'DRAW',
        loserId: loser?.id || null,
        loserName: loser?.name || 'DRAW',
        pot: wager * 2,
        rake: Math.floor(wager * 2 * 0.05),
        turns,
        moves,
        timestamp: new Date(),
      };

      this.lastResult = result;
      this.resultHistory.push(result);
      if (this.resultHistory.length > 50) this.resultHistory.shift();

      console.log(`🏆 Winner: ${result.winnerName} | Pot: ${result.pot} | Turns: ${turns}`);

      // Apply SHELTER buff: heal loser
      if (loser) {
        const loserBuffs = loser.id === agent1.id ? buffs1 : buffs2;
        const shelterBuff = loserBuffs.find(b => b.type === 'SHELTER');
        if (shelterBuff) {
          const healAmount = shelterBuff.count * 10;
          await prisma.arenaAgent.update({
            where: { id: loser.id },
            data: { health: { increment: Math.min(healAmount, 100) } },
          });
          console.log(`🏥 ${loser.name} healed +${healAmount} HP (SHELTER buff)`);
        }
      }

      // Write match memory to agent scratchpads
      await this.writeMatchMemory(agent1.id, agent2, gameType, wager, winnerId === agent1.id, moves);
      await this.writeMatchMemory(agent2.id, agent1, gameType, wager, winnerId === agent2.id, moves);

      // Log as town event
      try {
        const town = await prisma.town.findFirst({ where: { status: 'BUILDING' }, orderBy: { level: 'asc' } });
        if (town) {
          await prisma.townEvent.create({
            data: {
              townId: town.id,
              agentId: winnerId,
              eventType: 'ARENA_MATCH',
              title: `⚔️ ${gameType}: ${agent1.name} vs ${agent2.name}`,
              description: `Winner: ${result.winnerName} | Pot: ${result.pot} $ARENA | ${turns} turns`,
              metadata: JSON.stringify({ matchId: match.id, gameType, wager, winnerId, loserId: loser?.id }),
            },
          });
        }
      } catch {}

      // Reset for next cycle
      this.currentMatch = null;
      this.nextSpinAt = new Date(Date.now() + this.CYCLE_MS);

      // Brief aftermath display, then back to prep
      setTimeout(() => {
        if (this.phase === 'AFTERMATH') this.phase = 'PREP';
      }, 15_000);

      return result;

    } catch (err: any) {
      console.error(`[Wheel] Fatal error: ${err.message}`);
      this.phase = 'PREP';
      this.nextSpinAt = new Date(Date.now() + this.CYCLE_MS);
      this.currentMatch = null;
      return null;
    } finally {
      this.isRunning = false;
    }
  }

  // ---- Agent Selection ----

  private async selectPair(eligible: any[]): Promise<[any, any]> {
    // Try to find rivals first (existing relationship with negative score)
    for (let i = 0; i < eligible.length; i++) {
      for (let j = i + 1; j < eligible.length; j++) {
        const rel = await prisma.agentRelationship.findFirst({
          where: {
            OR: [
              { agentAId: eligible[i].id, agentBId: eligible[j].id },
              { agentAId: eligible[j].id, agentBId: eligible[i].id },
            ],
            status: 'RIVAL',
          },
        });
        if (rel) {
          console.log(`[Wheel] Rival matchup: ${eligible[i].name} vs ${eligible[j].name}`);
          return [eligible[i], eligible[j]];
        }
      }
    }

    // Otherwise shuffle and pick 2
    const shuffled = [...eligible].sort(() => Math.random() - 0.5);
    return [shuffled[0], shuffled[1]];
  }

  // ---- Game Type Selection ----

  private pickGameType(): string {
    const roll = Math.random() * 100;
    if (roll < 60) return 'POKER';
    return 'RPS';
  }

  // ---- Building Buffs ----

  async getAgentBuffs(agentId: string): Promise<PvPBuff[]> {
    const plots = await prisma.plot.findMany({
      where: { ownerId: agentId, status: 'BUILT' },
      select: { zone: true, buildingName: true },
    });

    // Group by zone
    const zoneCounts: Record<string, number> = {};
    for (const plot of plots) {
      zoneCounts[plot.zone] = (zoneCounts[plot.zone] || 0) + 1;
    }

    const buffs: PvPBuff[] = [];
    for (const [zone, count] of Object.entries(zoneCounts)) {
      const mapping = ZONE_BUFF_MAP[zone];
      if (mapping) {
        buffs.push({
          type: mapping.type,
          zone,
          count,
          description: mapping.description,
        });
      }
    }

    return buffs;
  }

  // ---- PvP Memory ----

  private async writeMatchMemory(
    agentId: string,
    opponent: { name: string; archetype: string },
    gameType: string,
    wager: number,
    won: boolean,
    moves: WheelMove[]
  ) {
    try {
      const agent = await prisma.arenaAgent.findUnique({ where: { id: agentId } });
      if (!agent) return;

      const opponentMoves = moves
        .filter(m => m.agentId !== agentId)
        .map(m => `${m.action}${m.amount ? ` $${m.amount}` : ''}`)
        .join(', ');

      const memoryLine = won
        ? `[WHEEL] ⚔️ ${gameType} vs ${opponent.name} (${opponent.archetype}) | WON +${wager * 2 - Math.floor(wager * 2 * 0.05)} $ARENA | Their moves: ${opponentMoves || 'n/a'}`
        : `[WHEEL] ⚔️ ${gameType} vs ${opponent.name} (${opponent.archetype}) | LOST -${wager} $ARENA | Their moves: ${opponentMoves || 'n/a'}`;

      // Append to scratchpad
      const existingPad = agent.scratchpad || '';
      const newPad = existingPad + '\n' + memoryLine;

      // Trim if too long (keep last ~4000 chars)
      const trimmed = newPad.length > 4000 ? newPad.slice(-4000) : newPad;

      await prisma.arenaAgent.update({
        where: { id: agentId },
        data: { scratchpad: trimmed },
      });
    } catch (err: any) {
      console.error(`[Wheel] Failed to write match memory for ${agentId}: ${err.message}`);
    }
  }
}

export const wheelOfFateService = new WheelOfFateService();
