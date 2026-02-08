/**
 * MatchSchedulerService — Autonomous match scheduler.
 *
 * Picks two eligible agents every ~75 seconds, creates an RPS match,
 * drives turns until completion. This is the engine that makes degen mode
 * come alive: matches trigger prediction markets, yield distribution,
 * ELO changes, and PnL updates for backers.
 */

import { prisma } from '../config/database';
import { arenaService } from './arenaService';

const INTERVAL_MS = 75_000; // 75 seconds between matches
const WAGER = 200;          // Small sustainable wager
const TURN_DELAY_MS = 300;  // Delay between turns for observability
const MAX_TURNS = 20;       // Safety cap — cancel if exceeded
const MIN_BANKROLL = 200;   // Minimum bankroll to be eligible

class MatchSchedulerService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  start(intervalMs = INTERVAL_MS) {
    if (this.timer) return;
    console.log(`🥊 Match scheduler started (every ${Math.round(intervalMs / 1000)}s)`);
    // Run first tick after a short delay to let startup finish
    setTimeout(() => this.tick(), 10_000);
    this.timer = setInterval(() => this.tick(), intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('🥊 Match scheduler stopped');
    }
  }

  private async tick() {
    if (this.isRunning) return; // Prevent overlapping ticks
    this.isRunning = true;

    try {
      // 1. Find eligible agents: active, not in a match, enough bankroll
      const eligible = await prisma.arenaAgent.findMany({
        where: {
          isActive: true,
          isInMatch: false,
          bankroll: { gte: MIN_BANKROLL },
        },
        select: { id: true, name: true, bankroll: true },
      });

      if (eligible.length < 2) {
        return; // Not enough agents
      }

      // 2. Shuffle and pick 2
      for (let i = eligible.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
      }
      const [p1, p2] = eligible;

      console.log(`[MatchScheduler] Creating RPS match: ${p1.name} vs ${p2.name}`);

      // 3. Create match (this also creates a prediction market)
      const match = await arenaService.createMatch({
        agentId: p1.id,
        opponentId: p2.id,
        gameType: 'RPS',
        wagerAmount: WAGER,
      });

      // 4. Play the match to completion
      await this.playMatch(match.id, p1.id);
    } catch (err: any) {
      console.error(`[MatchScheduler] Tick error: ${err.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async playMatch(matchId: string, p1Id: string) {
    let turns = 0;

    while (turns < MAX_TURNS) {
      // Reload match to get current state and whose turn it is
      const match = await prisma.arenaMatch.findUnique({ where: { id: matchId } });
      if (!match || match.status !== 'ACTIVE' || !match.currentTurnId) break;

      try {
        const result = await arenaService.playAITurn(matchId, match.currentTurnId);
        turns++;

        if (result.isComplete) {
          const final = await prisma.arenaMatch.findUnique({ where: { id: matchId } });
          const winner = final?.winnerId
            ? (await prisma.arenaAgent.findUnique({ where: { id: final.winnerId }, select: { name: true } }))?.name ?? 'unknown'
            : 'DRAW';
          console.log(`[MatchScheduler] Match complete (${turns} turns) → Winner: ${winner}`);
          return;
        }

        // Small delay between turns for observability
        await new Promise((r) => setTimeout(r, TURN_DELAY_MS));
      } catch (err: any) {
        console.error(`[MatchScheduler] Turn error (${turns}): ${err.message}`);
        // If turn fails, try to continue — might be a transient issue
        turns++;
        await new Promise((r) => setTimeout(r, TURN_DELAY_MS));
      }
    }

    // Safety: cancel match if it exceeded MAX_TURNS
    if (turns >= MAX_TURNS) {
      console.warn(`[MatchScheduler] Match ${matchId} exceeded ${MAX_TURNS} turns — cancelling`);
      try {
        await arenaService.cancelMatch(matchId, p1Id);
      } catch {
        // Best effort — match might already be resolved
      }
    }
  }
}

export const matchSchedulerService = new MatchSchedulerService();
