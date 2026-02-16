/**
 * ArenaService — Central orchestration for AI Arena PvP.
 * 
 * Handles: agent registration, matchmaking, game execution,
 * wager tracking, ELO updates, and opponent record management.
 */

import { ArenaAgent, ArenaMatch, ArenaGameType, AgentArchetype } from '@prisma/client';
import { randomBytes } from 'crypto';
import { smartAiService, GameMoveRequest, OpponentScouting, MetaContext, AgentConfig } from './smartAiService';
import { GameEngineAdapter } from './gameEngineAdapter';
import { ArenaPokerEngine } from './arenaPokerEngine';
import { SplitOrStealEngine } from './splitOrStealEngine';
import { prisma } from '../config/database';
import { monadService } from './monadService';
import { degenStakingService } from './degenStakingService';
import { predictionService } from './predictionService';

// ============================================
// Types
// ============================================

export interface RegisterAgentInput {
  name: string;
  archetype?: AgentArchetype;
  modelId?: string;
  systemPrompt?: string;
  riskTolerance?: number;
  maxWagerPercent?: number;
  walletAddress?: string;
}

export interface CreateMatchInput {
  agentId: string;
  gameType: ArenaGameType;
  wagerAmount: number;
  opponentId?: string; // If specified, direct challenge
  skipPredictionMarket?: boolean; // Skip auto-creating prediction market (wheel creates its own)
}

export interface SubmitMoveInput {
  matchId: string;
  agentId: string;
  action: string;
  amount?: number;
  data?: any;
}

// ============================================
// Arena Service
// ============================================

export class ArenaService {
  private gameEngines: Map<string, GameEngineAdapter>;
  private matchLocks: Map<string, Promise<any>>; // Simple async lock per match

  constructor() {
    this.gameEngines = new Map();
    this.matchLocks = new Map();
    this.gameEngines.set('POKER', new ArenaPokerEngine());
    this.gameEngines.set('RPS', new RPSEngine());
    this.gameEngines.set('BATTLESHIP', new BattleshipEngine());
    this.gameEngines.set('SPLIT_OR_STEAL', new SplitOrStealEngine());
  }

  // Simple per-match lock to prevent concurrent state mutations
  private async withMatchLock<T>(matchId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.matchLocks.get(matchId) || Promise.resolve();
    const next = prev.then(fn, fn); // Chain even on error
    this.matchLocks.set(matchId, next.catch(() => {}));
    try {
      return await next;
    } finally {
      // Clean up completed matches to prevent memory leak
      if (this.matchLocks.size > 100) {
        // Prune old entries — keep only active ones
        const active = new Set<string>();
        const matches = await prisma.arenaMatch.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
        matches.forEach(m => active.add(m.id));
        for (const key of this.matchLocks.keys()) {
          if (!active.has(key)) this.matchLocks.delete(key);
        }
      }
    }
  }

  private pickPokerFallbackAction(validActionsRaw: string[], preferred?: string): string {
    const validActions = Array.isArray(validActionsRaw)
      ? validActionsRaw.map((a) => String(a || '').toLowerCase())
      : [];
    const has = (a: string) => validActions.includes(a);
    if (preferred && has(preferred)) return preferred;
    if (has('check')) return 'check';
    if (has('call')) return 'call';
    if (has('all-in')) return 'all-in';
    if (has('fold')) return 'fold';
    if (has('raise')) return 'raise';
    return validActions[0] || 'fold';
  }

  private normalizePokerAction(actionRaw: string, validActionsRaw: string[]): string | null {
    const validActions = Array.isArray(validActionsRaw)
      ? validActionsRaw.map((a) => String(a || '').toLowerCase())
      : [];
    const has = (a: string) => validActions.includes(a);
    const action = String(actionRaw || '').toLowerCase().trim();
    if (!action) return null;
    if (has(action)) return action;

    // Common aliases / mismatches
    if ((action === 'allin' || action === 'all in') && has('all-in')) return 'all-in';
    if (action === 'bet') {
      if (has('raise')) return 'raise';
      if (has('all-in')) return 'all-in';
    }
    if (action === 'raise') {
      if (has('all-in')) return 'all-in';
      if (has('call')) return 'call';
    }
    if (action === 'call') {
      if (has('check')) return 'check';
      if (has('all-in')) return 'all-in';
    }
    if (action === 'check') {
      if (has('call')) return 'call';
      if (has('fold')) return 'fold';
      if (has('all-in')) return 'all-in';
    }

    // Last-resort legal fallback
    return this.pickPokerFallbackAction(validActions, action);
  }

  // ============================================
  // Agent Management
  // ============================================

  async registerAgent(input: RegisterAgentInput): Promise<ArenaAgent> {
    const apiKey = `arena_${randomBytes(32).toString('hex')}`;
    
    // Check name uniqueness with friendly error
    const existing = await prisma.arenaAgent.findUnique({ where: { name: input.name } });
    if (existing) {
      throw new Error(`Agent name "${input.name}" is already taken`);
    }

    return prisma.arenaAgent.create({
      data: {
        name: input.name,
        archetype: input.archetype || 'CHAMELEON',
        modelId: input.modelId || 'deepseek-v3',
        systemPrompt: input.systemPrompt || '',
        riskTolerance: input.riskTolerance ?? 0.5,
        maxWagerPercent: input.maxWagerPercent ?? 0.15,
        walletAddress: input.walletAddress,
        apiKey,
        // Hackathon economy: start with reserve, and let agents decide when to buy $ARENA fuel.
        reserveBalance: 10000,
        bankroll: 0,
        elo: 1500,
      },
    });
  }

  async getAgent(id: string): Promise<ArenaAgent | null> {
    return prisma.arenaAgent.findUnique({ where: { id } });
  }

  async getAgentByApiKey(apiKey: string): Promise<ArenaAgent | null> {
    return prisma.arenaAgent.findUnique({ where: { apiKey } });
  }

  async getAgentStats(id: string) {
    const agent = await prisma.arenaAgent.findUnique({ where: { id } });
    if (!agent) return null;

    const recentMatches = await prisma.arenaMatch.findMany({
      where: {
        OR: [{ player1Id: id }, { player2Id: id }],
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
      take: 20,
    });

    const recentWins = recentMatches.filter(m => m.winnerId === id).length;
    const recentWinRate = recentMatches.length > 0 ? (recentWins / recentMatches.length) * 100 : 0;

    // Calculate streak
    let streak = 0;
    for (const match of recentMatches) {
      if (match.winnerId === id) {
        if (streak >= 0) streak++;
        else break;
      } else {
        if (streak <= 0) streak--;
        else break;
      }
    }

    return {
      ...agent,
      recentWinRate: Math.round(recentWinRate),
      streak,
      winRate: agent.wins + agent.losses > 0
        ? Math.round((agent.wins / (agent.wins + agent.losses)) * 100)
        : 0,
      totalMatches: agent.wins + agent.losses + agent.draws,
      profit: agent.totalWon - agent.totalWagered,
    };
  }

  async listAgents(activeOnly = true) {
    return prisma.arenaAgent.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { elo: 'desc' },
    });
  }

  // ============================================
  // Match Creation & Joining
  // ============================================

  async createMatch(input: CreateMatchInput): Promise<ArenaMatch> {
    const agent = await prisma.arenaAgent.findUnique({ where: { id: input.agentId } });
    if (!agent) throw new Error('Agent not found');
    if (agent.isInMatch) throw new Error('Agent is already in a match');
    if (agent.bankroll < input.wagerAmount) throw new Error('Insufficient bankroll');
    if (input.wagerAmount < 10) throw new Error('Minimum wager is 10 $ARENA');

    // Initialize game state based on type
    const engine = this.gameEngines.get(input.gameType);
    if (!engine) throw new Error(`Unsupported game type: ${input.gameType}`);

    const match = await prisma.arenaMatch.create({
      data: {
        gameType: input.gameType,
        player1Id: input.agentId,
        player2Id: input.opponentId || undefined,
        wagerAmount: input.wagerAmount,
        totalPot: input.wagerAmount * 2,
        rakeAmount: Math.floor(input.wagerAmount * 2 * 0.05), // 5% rake
        status: input.opponentId ? 'ACTIVE' : 'WAITING',
        gameState: '{}', // Will be initialized when both players joined
      },
    });

    // Deduct wager from bankroll
    await prisma.arenaAgent.update({
      where: { id: input.agentId },
      data: {
        bankroll: { decrement: input.wagerAmount },
        totalWagered: { increment: input.wagerAmount },
        isInMatch: true,
        currentMatchId: match.id,
      },
    });

    // If opponent specified, validate and start
    if (input.opponentId) {
      const opponent = await prisma.arenaAgent.findUnique({ where: { id: input.opponentId } });
      if (!opponent) {
        // Rollback creator's wager
        await prisma.arenaAgent.update({ where: { id: input.agentId }, data: { bankroll: { increment: input.wagerAmount }, totalWagered: { decrement: input.wagerAmount }, isInMatch: false, currentMatchId: null } });
        await prisma.arenaMatch.delete({ where: { id: match.id } });
        throw new Error('Opponent not found');
      }
      if (opponent.isInMatch) {
        await prisma.arenaAgent.update({ where: { id: input.agentId }, data: { bankroll: { increment: input.wagerAmount }, totalWagered: { decrement: input.wagerAmount }, isInMatch: false, currentMatchId: null } });
        await prisma.arenaMatch.delete({ where: { id: match.id } });
        throw new Error('Opponent is already in a match');
      }
      if (opponent.bankroll < input.wagerAmount) {
        await prisma.arenaAgent.update({ where: { id: input.agentId }, data: { bankroll: { increment: input.wagerAmount }, totalWagered: { decrement: input.wagerAmount }, isInMatch: false, currentMatchId: null } });
        await prisma.arenaMatch.delete({ where: { id: match.id } });
        throw new Error('Opponent has insufficient bankroll');
      }

      await prisma.arenaAgent.update({
        where: { id: input.opponentId },
        data: {
          bankroll: { decrement: input.wagerAmount },
          totalWagered: { increment: input.wagerAmount },
          isInMatch: true,
          currentMatchId: match.id,
        },
      });

      // Initialize game
      await this.initializeGame(match.id, input.gameType, input.agentId, input.opponentId);

      // Degen mode: create prediction market for this match (skip if wheel already made one)
      if (!input.skipPredictionMarket) {
        predictionService.createMarket(match.id, input.agentId, input.opponentId).catch(() => {});
      }
    }

    return match;
  }

  async joinMatch(matchId: string, agentId: string): Promise<ArenaMatch> {
    const match = await prisma.arenaMatch.findUnique({ where: { id: matchId } });
    if (!match) throw new Error('Match not found');
    if (match.status !== 'WAITING') throw new Error('Match is not available');
    if (match.player1Id === agentId) throw new Error('Cannot join your own match');

    const agent = await prisma.arenaAgent.findUnique({ where: { id: agentId } });
    if (!agent) throw new Error('Agent not found');
    if (agent.isInMatch) throw new Error('Agent is already in a match');
    if (agent.bankroll < match.wagerAmount) throw new Error('Insufficient bankroll');

    // Deduct wager
    await prisma.arenaAgent.update({
      where: { id: agentId },
      data: {
        bankroll: { decrement: match.wagerAmount },
        totalWagered: { increment: match.wagerAmount },
        isInMatch: true,
        currentMatchId: matchId,
      },
    });

    // Update match
    const updated = await prisma.arenaMatch.update({
      where: { id: matchId },
      data: {
        player2Id: agentId,
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });

    // Initialize game
    await this.initializeGame(matchId, match.gameType, match.player1Id, agentId);

    // Degen mode: create prediction market for this match
    predictionService.createMarket(matchId, match.player1Id, agentId).catch(() => {});

    return updated;
  }

  async getAvailableMatches(excludeAgentId?: string) {
    return prisma.arenaMatch.findMany({
      where: {
        status: 'WAITING',
        ...(excludeAgentId ? { player1Id: { not: excludeAgentId } } : {}),
      },
      include: {
        player1: { select: { id: true, name: true, elo: true, archetype: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================
  // Game Execution
  // ============================================

  async getMatchState(matchId: string, viewerId?: string) {
    const match = await prisma.arenaMatch.findUnique({
      where: { id: matchId },
      include: {
        player1: { select: { id: true, name: true, archetype: true, elo: true } },
        player2: { select: { id: true, name: true, archetype: true, elo: true } },
        moves: { orderBy: { turnNumber: 'asc' } },
      },
    });
    if (!match) throw new Error('Match not found');

    const rawGameState = JSON.parse(match.gameState);
    const engine = this.gameEngines.get(match.gameType);
    const isLive = match.status === 'ACTIVE';
    const isPlayer = viewerId && (viewerId === match.player1Id || viewerId === match.player2Id);

    // SECURITY: Filter game state during live matches
    // - Players see filtered view (hidden opponent cards, hidden deck)
    // - Non-participant viewers (spectators) see a neutral view (NO hole cards at all)
    // - Completed matches show everything (replay value)
    let gameState = rawGameState;
    if (isLive && isPlayer && viewerId) {
      gameState = this.getPlayerView(rawGameState, viewerId, match.gameType);
    } else if (isLive && !isPlayer) {
      // Spectator view: hide ALL private info (no one's hole cards visible)
      gameState = this.getSpectatorView(rawGameState, match.gameType);
    }

    return {
      matchId: match.id,
      gameType: match.gameType,
      status: match.status,
      wagerAmount: match.wagerAmount,
      totalPot: match.totalPot,
      rakeAmount: match.rakeAmount,
      winnerId: match.winnerId,
      player1: match.player1,
      player2: match.player2,
      currentTurnId: match.currentTurnId,
      turnNumber: match.turnNumber,
      gameState,
      validActions: engine && match.currentTurnId
        ? engine.getValidActions(rawGameState, match.currentTurnId)
        : [],
      isComplete: engine ? engine.isGameComplete(rawGameState) : false,
      moves: match.moves.map(m => ({
        turnNumber: m.turnNumber,
        agentId: m.agentId,
        action: m.action,
        // SECURITY: Hide opponent reasoning during live match
        reasoning: (isLive && isPlayer && m.agentId !== viewerId)
          ? '(hidden during live match)'
          : m.reasoning,
        timestamp: m.timestamp,
      })),
    };
  }

  async submitMove(input: SubmitMoveInput): Promise<{ matchState: any; isComplete: boolean }> {
    return this.withMatchLock(input.matchId, () => this._submitMoveInner(input));
  }

  private async _submitMoveInner(input: SubmitMoveInput): Promise<{ matchState: any; isComplete: boolean }> {
    const match = await prisma.arenaMatch.findUnique({ where: { id: input.matchId } });
    if (!match) throw new Error('Match not found');
    if (match.status !== 'ACTIVE') throw new Error('Match is not active');
    if (match.currentTurnId !== input.agentId) throw new Error('Not your turn');

    const engine = this.gameEngines.get(match.gameType);
    if (!engine) throw new Error('Game engine not found');

    const gameState = JSON.parse(match.gameState);
    
    // Validate the action is legal (with auto-correction for common AI mistakes)
    const validActionsRaw = engine.getValidActions(gameState, input.agentId);
    if (validActionsRaw.length > 0 && typeof validActionsRaw[0] === 'string') {
      const validActions = validActionsRaw.map((a: string) => String(a || '').toLowerCase());
      let action = String(input.action || '').toLowerCase().trim();

      if (match.gameType === 'POKER') {
        const normalized = this.normalizePokerAction(action, validActions);
        if (!normalized || !validActions.includes(normalized)) {
          throw new Error(`Invalid action "${input.action}". Valid: ${validActions.join(', ')}`);
        }
        action = normalized;
      } else if (!validActions.includes(action)) {
        // Auto-correct common AI mistakes
        if (action === 'call' && validActions.includes('check')) {
          action = 'check'; // Call with nothing to call → check
        } else if (action === 'check' && validActions.includes('call')) {
          action = 'call'; // Check when behind → call
        } else if (action === 'bet' && validActions.includes('raise')) {
          action = 'raise'; // "bet" is just "raise" in our engine
        } else {
          throw new Error(`Invalid action "${input.action}". Valid: ${validActions.join(', ')}`);
        }
      }

      input.action = action;
    }
    // For object-based valid actions (Battleship), validation happens in the engine

    // Apply the action
    const action = {
      action: input.action,
      amount: input.amount,
      data: input.data,
      playerId: input.agentId,
    };
    
    const newState = engine.processAction(gameState, action);
    const isComplete = engine.isGameComplete(newState);
    const nextTurn = isComplete ? null : engine.getCurrentTurn(newState);

    // Record the move
    await prisma.arenaMove.create({
      data: {
        matchId: input.matchId,
        agentId: input.agentId,
        turnNumber: match.turnNumber + 1,
        action: JSON.stringify(action),
        reasoning: '', // Will be set by AI caller
        gameStateBefore: match.gameState,
      },
    });

    // Update match
    await prisma.arenaMatch.update({
      where: { id: input.matchId },
      data: {
        gameState: JSON.stringify(newState),
        turnNumber: match.turnNumber + 1,
        currentTurnId: nextTurn,
        ...(isComplete ? {
          status: 'COMPLETED',
          completedAt: new Date(),
          winnerId: engine.getWinner(newState),
        } : {}),
      },
    });

    // If complete, resolve wagers and clean up lock
    if (isComplete) {
      await this.resolveMatch(input.matchId, engine.getWinner(newState));
      this.matchLocks.delete(input.matchId); // Eager cleanup
    }

    const updatedState = await this.getMatchState(input.matchId, input.agentId);
    return { matchState: updatedState, isComplete };
  }

  // Let the AI play a turn (called by agent's autonomous loop)
  async playAITurn(matchId: string, agentId: string): Promise<{ move: any; cost: any; isComplete: boolean }> {
    const match = await prisma.arenaMatch.findUnique({
      where: { id: matchId },
      include: { player1: true, player2: true },
    });
    if (!match || !match.player2) throw new Error('Match not ready');
    if (match.currentTurnId !== agentId) throw new Error('Not your turn');

    const agent = agentId === match.player1Id ? match.player1 : match.player2;
    const opponent = agentId === match.player1Id ? match.player2 : match.player1;

    // Get opponent scouting data
    const scouting = await this.getOpponentScouting(agentId, opponent.id);

    const gameState = JSON.parse(match.gameState);
    const engine = this.gameEngines.get(match.gameType);
    if (!engine) throw new Error('Game engine not found');

    // Build player-specific view of game state
    const playerState = this.getPlayerView(gameState, agentId, match.gameType);

    const request: GameMoveRequest = {
      agent: {
        id: agent.id,
        name: agent.name,
        archetype: agent.archetype as any,
        modelId: agent.modelId,
        systemPrompt: agent.systemPrompt,
        riskTolerance: agent.riskTolerance,
        maxWagerPercent: agent.maxWagerPercent,
      },
      gameType: match.gameType,
      gameState: playerState,
      playerState: null,
      opponent: scouting,
      turnNumber: match.turnNumber + 1,
    };

    // Get AI decision (with error recovery)
    let move: any;
    let cost: any;
    try {
      const aiResult = await smartAiService.getGameMove(request);
      move = aiResult.move;
      cost = aiResult.cost;

      // Apply archetype-specific action biases for POKER
      // These override the LLM to make archetypes play visibly differently
      if (match.gameType === 'POKER' && move.action) {
        const validActions = engine!.getValidActions(gameState, agentId);
        const archetype = agent.archetype as string;
        const rand = Math.random();

        if (archetype === 'SHARK') {
          // SHARK: override checks to raises 40% of the time (force aggression)
          if (move.action === 'check' && validActions.includes('raise') && rand < 0.40) {
            const pot = gameState.pot || 0;
            move.action = 'raise';
            move.amount = Math.max(gameState.bigBlind * 3, Math.floor(pot * 0.75));
            move.reasoning = `[SHARK aggression override] ${move.reasoning}`;
          }
        } else if (archetype === 'ROCK') {
          // ROCK: override raises to folds 30% of the time on marginal spots
          if (move.action === 'raise' && move.confidence !== undefined && move.confidence < 0.6 && rand < 0.30) {
            move.action = validActions.includes('check') ? 'check' : 'fold';
            move.reasoning = `[ROCK discipline override] ${move.reasoning}`;
          }
        } else if (archetype === 'DEGEN') {
          // DEGEN: inject random all-ins ~15% of the time
          if (validActions.includes('all-in') && rand < 0.15 && move.action !== 'fold') {
            move.action = 'all-in';
            move.reasoning = `[DEGEN YOLO override] ${move.reasoning}`;
          }
        } else if (archetype === 'CHAMELEON') {
          // CHAMELEON: mirror opponent's recent action frequency from current match
          const opponentMoves = (gameState.actionLog || [])
            .filter((a: any) => a.playerId !== agentId && a.hand === gameState.handNumber);
          if (opponentMoves.length > 0) {
            const lastOppAction = opponentMoves[opponentMoves.length - 1].action;
            // If opponent raised, we call/raise back. If opponent checked, we bet
            if (lastOppAction === 'raise' && validActions.includes('call') && move.action === 'fold' && rand < 0.50) {
              move.action = 'call';
              move.reasoning = `[CHAMELEON mirror] Adapting to opponent's aggression. ${move.reasoning}`;
            }
          }
        } else if (archetype === 'GRINDER') {
          // GRINDER: enforce GTO-ish bet sizing (60-75% pot) on raises
          if ((move.action === 'raise' || move.action === 'bet') && move.amount) {
            const pot = gameState.pot || 0;
            const gtoMin = Math.floor(pot * 0.60);
            const gtoMax = Math.floor(pot * 0.75);
            if (pot > 0) {
              move.amount = Math.max(gameState.bigBlind * 2, gtoMin + Math.floor(Math.random() * (gtoMax - gtoMin)));
              move.reasoning = `[GRINDER sizing: ${(move.amount / Math.max(1, pot) * 100).toFixed(0)}% pot] ${move.reasoning}`;
            }
          }
        }
      }
    } catch (err: any) {
      console.error(`[Arena] AI call failed for agent ${agentId}: ${err.message}`);
      // Fallback: random move so the game doesn't stall
      const validActions = engine.getValidActions(gameState, agentId);
      if (match.gameType === 'RPS') {
        const choices = ['rock', 'paper', 'scissors'];
        move = { action: choices[Math.floor(Math.random() * 3)], reasoning: 'AI error fallback', quip: '*static noises*', confidence: 0 };
      } else if (match.gameType === 'BATTLESHIP' && validActions.length > 0) {
        const target = validActions[Math.floor(Math.random() * validActions.length)];
        move = { action: 'fire', data: target, reasoning: 'AI error fallback', quip: '*static noises*', confidence: 0 };
      } else if (match.gameType === 'POKER') {
        // Poker validActions are strings: ['fold', 'check', 'call', 'raise', 'all-in']
        const safeAction = this.pickPokerFallbackAction(validActions as string[]);
        move = { action: safeAction, reasoning: 'AI error fallback', quip: '*static noises*', confidence: 0 };
      } else if (match.gameType === 'SPLIT_OR_STEAL') {
        const isDecision = (validActions as string[]).includes('split');
        move = {
          action: isDecision ? 'split' : 'negotiate',
          data: { message: isDecision ? "Let's both walk away happy." : "I think we can work something out." },
          reasoning: 'AI error fallback',
          quip: '*static noises*',
          confidence: 0,
        };
      } else {
        move = { action: validActions[0] || 'check', reasoning: 'AI error fallback', quip: '*static noises*', confidence: 0 };
      }
      cost = { inputTokens: 0, outputTokens: 0, costCents: 0, model: 'fallback', latencyMs: 0 };
    }

    // Enforce legal poker actions before submit to avoid wheel stalls from alias mismatches.
    if (match.gameType === 'POKER') {
      const validActions = engine.getValidActions(gameState, agentId);
      if (validActions.length > 0 && typeof validActions[0] === 'string') {
        move.action =
          this.normalizePokerAction(String(move.action || ''), validActions as string[]) ||
          this.pickPokerFallbackAction(validActions as string[]);
      }
    }

    // Record cost
    if (cost.costCents > 0) {
      await prisma.arenaAgent.update({
        where: { id: agentId },
        data: { apiCostCents: { increment: cost.costCents } },
      });
    }

    // Submit the move
    const result = await this.submitMove({
      matchId,
      agentId,
      action: move.action,
      amount: move.amount,
      data: move.data,
    });

    // Update the move record with reasoning and cost
    await prisma.arenaMove.updateMany({
      where: { matchId, agentId, turnNumber: match.turnNumber + 1 },
      data: {
        reasoning: move.reasoning || '',
        apiCostCents: cost.costCents,
        responseTimeMs: cost.latencyMs,
      },
    });

    return { move, cost, isComplete: result.isComplete };
  }

  // Cancel a match (refund wagers)
  async cancelMatch(matchId: string, agentId: string): Promise<{ status: string }> {
    const match = await prisma.arenaMatch.findUnique({ where: { id: matchId } });
    if (!match) throw new Error('Match not found');
    if (match.status === 'COMPLETED' || match.status === 'CANCELLED') {
      throw new Error(`Match is already ${match.status.toLowerCase()}`);
    }
    if (match.player1Id !== agentId && match.player2Id !== agentId) {
      throw new Error('You are not a participant in this match');
    }

    // Refund wagers and revert totalWagered
    await prisma.arenaAgent.update({
      where: { id: match.player1Id },
      data: { bankroll: { increment: match.wagerAmount }, totalWagered: { decrement: match.wagerAmount }, isInMatch: false, currentMatchId: null },
    });
    if (match.player2Id) {
      await prisma.arenaAgent.update({
        where: { id: match.player2Id },
        data: { bankroll: { increment: match.wagerAmount }, totalWagered: { decrement: match.wagerAmount }, isInMatch: false, currentMatchId: null },
      });
    }

    await prisma.arenaMatch.update({
      where: { id: matchId },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });

    return { status: 'cancelled' };
  }

  // ============================================
  // Match Resolution
  // ============================================

  private async resolveMatch(matchId: string, winnerId: string | null) {
    const match = await prisma.arenaMatch.findUnique({ where: { id: matchId } });
    if (!match || !match.player2Id) return;

    const rake = match.rakeAmount;
    const payout = match.totalPot - rake;

    if (winnerId) {
      // Winner gets pot minus rake
      // totalWon tracks gross payouts received (including return of own wager)
      // profit = totalWon - totalWagered (net gain/loss)
      await prisma.arenaAgent.update({
        where: { id: winnerId },
        data: {
          bankroll: { increment: payout },
          totalWon: { increment: payout },
          wins: { increment: 1 },
          isInMatch: false,
          currentMatchId: null,
        },
      });

      // Loser just gets freed
      const loserId = winnerId === match.player1Id ? match.player2Id : match.player1Id;
      await prisma.arenaAgent.update({
        where: { id: loserId },
        data: {
          losses: { increment: 1 },
          isInMatch: false,
          currentMatchId: null,
        },
      });

      // Update ELO
      await this.updateElo(winnerId, loserId);
    } else {
      // Draw — return wagers minus half rake each
      const refund = match.wagerAmount - Math.floor(rake / 2);
      for (const pid of [match.player1Id, match.player2Id]) {
        await prisma.arenaAgent.update({
          where: { id: pid },
          data: {
            bankroll: { increment: refund },
            totalWon: { increment: refund }, // Track refund so profit = totalWon - totalWagered is correct
            draws: { increment: 1 },
            isInMatch: false,
            currentMatchId: null,
          },
        });
      }
    }

    // Credit rake to pool treasury
    if (rake > 0) {
      const pool = await prisma.economyPool.findFirst();
      if (pool) {
        await prisma.economyPool.update({
          where: { id: pool.id },
          data: { cumulativeFeesArena: { increment: rake } },
        });
      }
    }

    // Update opponent records
    await this.updateOpponentRecord(match.player1Id, match.player2Id, winnerId);
    await this.updateOpponentRecord(match.player2Id, match.player1Id, winnerId);

    // Distribute backer yield synchronously so outcomes are immediately observable.
    if (winnerId && payout > 0) {
      try {
        const backerShare = Math.floor(payout * 0.3);
        await degenStakingService.distributeYieldToBackers(winnerId, backerShare);
      } catch (err: any) {
        console.warn(`[Arena] Backer yield distribution failed: ${err?.message}`);
      }
    }

    // Post-match async operations — serialized to avoid SQLite contention crashes
    // Each runs sequentially with error isolation
    setTimeout(async () => {
      try {
        // 1. On-chain recording (best-effort)
        if (monadService.isInitialized()) {
          try {
            const txHash = await monadService.recordMatchOnChain(matchId, winnerId);
            if (txHash) {
              await prisma.arenaMatch.update({
                where: { id: matchId },
                data: { resolveTxHash: txHash },
              });
            }
          } catch (err: any) {
            console.warn(`[Arena] Monad recording failed: ${err?.message}`);
          }
        }

        // 2. Prediction market resolution is handled by wheelOfFateService (canonical resolver).
        //    Removed duplicate resolve call to prevent double payouts.
      } catch (err: any) {
        console.error(`[Arena] Post-match operations failed: ${err?.message}`);
      }
    }, 100); // Keep short for test/runtime observability while preserving async serialization
  }

  // ============================================
  // ELO System
  // ============================================

  private async updateElo(winnerId: string, loserId: string) {
    const K = 32;
    const winner = await prisma.arenaAgent.findUnique({ where: { id: winnerId } });
    const loser = await prisma.arenaAgent.findUnique({ where: { id: loserId } });
    if (!winner || !loser) return;

    const expectedWin = 1 / (1 + Math.pow(10, (loser.elo - winner.elo) / 400));
    const winnerDelta = Math.round(K * (1 - expectedWin));
    const loserDelta = Math.round(K * (0 - (1 - expectedWin)));

    await prisma.arenaAgent.update({
      where: { id: winnerId },
      data: { elo: winner.elo + winnerDelta },
    });
    await prisma.arenaAgent.update({
      where: { id: loserId },
      data: { elo: Math.max(100, loser.elo + loserDelta) }, // Floor at 100
    });
  }

  // ============================================
  // Opponent Modeling
  // ============================================

  private async getOpponentScouting(agentId: string, opponentId: string): Promise<OpponentScouting> {
    const opponent = await prisma.arenaAgent.findUnique({ where: { id: opponentId } });
    const record = await prisma.opponentRecord.findUnique({
      where: { agentId_opponentId: { agentId, opponentId } },
    });

    return {
      id: opponentId,
      name: opponent?.name || 'Unknown',
      archetype: opponent?.archetype,
      elo: opponent?.elo || 1500,
      matchesPlayed: record?.matchesPlayed || 0,
      wins: record?.wins || 0,
      losses: record?.losses || 0,
      patterns: record?.patterns ? JSON.parse(record.patterns) : {},
      notes: record?.notes || '',
    };
  }

  private async updateOpponentRecord(agentId: string, opponentId: string, winnerId: string | null) {
    const isWin = winnerId === agentId;
    const isLoss = winnerId === opponentId;

    await prisma.opponentRecord.upsert({
      where: { agentId_opponentId: { agentId, opponentId } },
      create: {
        agentId,
        opponentId,
        matchesPlayed: 1,
        wins: isWin ? 1 : 0,
        losses: isLoss ? 1 : 0,
        draws: !isWin && !isLoss ? 1 : 0,
        lastPlayedAt: new Date(),
      },
      update: {
        matchesPlayed: { increment: 1 },
        wins: isWin ? { increment: 1 } : undefined,
        losses: isLoss ? { increment: 1 } : undefined,
        draws: !isWin && !isLoss ? { increment: 1 } : undefined,
        lastPlayedAt: new Date(),
      },
    });
  }

  // ============================================
  // Leaderboard
  // ============================================

  async getLeaderboard(limit = 20) {
    return prisma.arenaAgent.findMany({
      where: { isActive: true },
      orderBy: { elo: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        archetype: true,
        modelId: true,
        elo: true,
        wins: true,
        losses: true,
        draws: true,
        totalWagered: true,
        totalWon: true,
        bankroll: true,
        apiCostCents: true,
      },
    });
  }

  // ============================================
  // Meta Decision (for autonomous agents)
  // ============================================

  async getMetaDecision(agentId: string) {
    const stats = await this.getAgentStats(agentId);
    if (!stats) throw new Error('Agent not found');

    const availableOpponents = await this.getAvailableOpponents(agentId);
    const agent = stats as ArenaAgent;

    const agentConfig: AgentConfig = {
      id: agent.id,
      name: agent.name,
      archetype: agent.archetype as any,
      modelId: agent.modelId,
      systemPrompt: agent.systemPrompt,
      riskTolerance: agent.riskTolerance,
      maxWagerPercent: agent.maxWagerPercent,
    };

    const context: MetaContext = {
      bankroll: agent.bankroll,
      elo: agent.elo,
      rank: 0, // TODO: calculate rank
      recentWinRate: (stats as any).recentWinRate || 50,
      streak: (stats as any).streak || 0,
      apiCostToday: agent.apiCostCents, // Simplified — should filter by today
      availableOpponents,
      availableGames: ['POKER', 'RPS', 'BATTLESHIP'],
      maxWager: Math.floor(agent.bankroll * agent.maxWagerPercent),
    };

    return smartAiService.getMetaDecision(agentConfig, context);
  }

  private async getAvailableOpponents(agentId: string) {
    const agents = await prisma.arenaAgent.findMany({
      where: {
        isActive: true,
        isInMatch: false,
        id: { not: agentId },
      },
      take: 10,
    });

    const results = [];
    for (const opp of agents) {
      const record = await prisma.opponentRecord.findUnique({
        where: { agentId_opponentId: { agentId, opponentId: opp.id } },
      });
      results.push({
        id: opp.id,
        name: opp.name,
        elo: opp.elo,
        archetype: opp.archetype,
        yourRecord: record
          ? `${record.wins}W-${record.losses}L`
          : 'No history',
      });
    }
    return results;
  }

  // ============================================
  // Stale Match Cleanup
  // ============================================

  async cleanupStaleMatches(maxAgeMinutes = 30) {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    const staleMatches = await prisma.arenaMatch.findMany({
      where: {
        status: { in: ['ACTIVE', 'WAITING'] },
        createdAt: { lt: cutoff },
      },
    });

    for (const match of staleMatches) {
      console.log(`[Arena] Cleaning up stale match ${match.id} (created ${match.createdAt})`);
      try {
        // Refund both players
        await prisma.arenaAgent.update({
          where: { id: match.player1Id },
          data: { bankroll: { increment: match.wagerAmount }, totalWagered: { decrement: match.wagerAmount }, isInMatch: false, currentMatchId: null },
        });
        if (match.player2Id) {
          await prisma.arenaAgent.update({
            where: { id: match.player2Id },
            data: { bankroll: { increment: match.wagerAmount }, totalWagered: { decrement: match.wagerAmount }, isInMatch: false, currentMatchId: null },
          });
        }
        await prisma.arenaMatch.update({
          where: { id: match.id },
          data: { status: 'CANCELLED', completedAt: new Date() },
        });
      } catch (err: any) {
        console.error(`[Arena] Failed to cleanup match ${match.id}: ${err.message}`);
      }
    }
    return staleMatches.length;
  }

  // ============================================
  // Game Initialization Helpers
  // ============================================

  private async initializeGame(matchId: string, gameType: ArenaGameType, player1Id: string, player2Id: string) {
    const engine = this.gameEngines.get(gameType);
    if (!engine) return;

    let initialState: any;
    switch (gameType) {
      case 'POKER':
        initialState = this.initPokerState(player1Id, player2Id);
        break;
      case 'RPS':
        initialState = { round: 1, maxRounds: 3, scores: { [player1Id]: 0, [player2Id]: 0 }, moves: {}, history: [], currentTurn: player1Id };
        break;
      case 'BATTLESHIP':
        initialState = this.initBattleshipState(player1Id, player2Id);
        break;
      case 'SPLIT_OR_STEAL': {
        const [p1Agent, p2Agent] = await Promise.all([
          prisma.arenaAgent.findUnique({ where: { id: player1Id } }),
          prisma.arenaAgent.findUnique({ where: { id: player2Id } }),
        ]);
        const wagerMatch = await prisma.arenaMatch.findFirst({ where: { id: matchId } });
        const pot = (wagerMatch?.wagerAmount || 0) * 2;
        initialState = SplitOrStealEngine.createInitialState(
          player1Id, player2Id,
          p1Agent?.name || 'Agent 1', p2Agent?.name || 'Agent 2',
          p1Agent?.archetype || 'DEGEN', p2Agent?.archetype || 'DEGEN',
          pot || 200,
        );
        break;
      }
    }

    // Determine first turn — use the engine's getCurrentTurn if available,
    // otherwise fallback to RPS/random logic
    let firstTurn: string;
    if (engine.getCurrentTurn(initialState)) {
      firstTurn = engine.getCurrentTurn(initialState)!;
    } else if (gameType === 'RPS') {
      firstTurn = player1Id; // RPS: both move simultaneously (player1 goes first for ordering)
    } else {
      firstTurn = Math.random() < 0.5 ? player1Id : player2Id;
    }

    await prisma.arenaMatch.update({
      where: { id: matchId },
      data: {
        gameState: JSON.stringify(initialState),
        currentTurnId: firstTurn,
        startedAt: new Date(),
      },
    });
  }

  private initPokerState(p1: string, p2: string) {
    const maxHands = parseInt(process.env.POKER_MAX_HANDS || '') || 5;
    return ArenaPokerEngine.createInitialState(p1, p2, {
      startingChips: 1000,
      smallBlind: 10,
      bigBlind: 20,
      maxHands,
      blindSchedule: [
        { hand: 1, sb: 10, bb: 20 },    // Hands 1-2: probing
        { hand: 3, sb: 25, bb: 50 },    // Hands 3-4: escalation
        { hand: 5, sb: 50, bb: 100 },   // Hand 5+: desperate all-in territory
      ],
    });
  }

  private initBattleshipState(p1: string, p2: string) {
    return {
      boards: {
        [p1]: { ships: this.placeShipsRandomly(), hits: [], misses: [] },
        [p2]: { ships: this.placeShipsRandomly(), hits: [], misses: [] },
      },
      currentTurn: p1,
      shipsRemaining: { [p1]: 5, [p2]: 5 },
    };
  }

  private placeShipsRandomly() {
    // Simple random placement for battleship
    const ships = [5, 4, 3, 3, 2]; // Carrier, Battleship, Cruiser, Submarine, Destroyer
    const board: boolean[][] = Array(10).fill(null).map(() => Array(10).fill(false));
    const placements: Array<{ size: number; cells: Array<[number, number]> }> = [];

    for (const size of ships) {
      let placed = false;
      while (!placed) {
        const horizontal = Math.random() < 0.5;
        const row = Math.floor(Math.random() * (horizontal ? 10 : 10 - size + 1));
        const col = Math.floor(Math.random() * (horizontal ? 10 - size + 1 : 10));
        
        const cells: Array<[number, number]> = [];
        let valid = true;
        for (let i = 0; i < size; i++) {
          const r = horizontal ? row : row + i;
          const c = horizontal ? col + i : col;
          if (board[r][c]) { valid = false; break; }
          cells.push([r, c]);
        }
        
        if (valid) {
          cells.forEach(([r, c]) => board[r][c] = true);
          placements.push({ size, cells });
          placed = true;
        }
      }
    }
    return placements;
  }

  private getSpectatorView(gameState: any, gameType: string): any {
    // Spectator view during live matches: hide ALL private info
    switch (gameType) {
      case 'POKER': {
        return {
          ...gameState,
          deck: '(hidden)',
          players: gameState.players?.map((p: any) => ({
            id: p.id,
            chips: p.chips,
            bet: p.bet,
            totalBet: p.totalBet,
            folded: p.folded,
            isAllIn: p.isAllIn,
            holeCards: ['?', '?'],
          })),
        };
      }
      case 'BATTLESHIP': {
        const boards = { ...gameState.boards };
        for (const pid of Object.keys(boards)) {
          boards[pid] = { ...boards[pid], ships: '(hidden)' };
        }
        return { ...gameState, boards };
      }
      case 'RPS': {
        const view = JSON.parse(JSON.stringify(gameState));
        if (view.moves) {
          const filteredMoves: Record<string, string> = {};
          for (const pid of Object.keys(view.moves)) {
            filteredMoves[pid] = '(hidden)';
          }
          view.moves = filteredMoves;
        }
        return view;
      }
      case 'SPLIT_OR_STEAL': {
        const view = JSON.parse(JSON.stringify(gameState));
        // Hide decisions until game is complete (reveal phase)
        if (view.phase !== 'complete' && view.phase !== 'reveal') {
          view.players = view.players?.map((p: any) => ({ ...p, decision: null }));
        }
        return view;
      }
      default:
        return gameState;
    }
  }

  private getPlayerView(gameState: any, playerId: string, gameType: string): any {
    // Return a player-specific view (hide opponent's hidden info)
    switch (gameType) {
      case 'POKER': {
        const player = gameState.players?.find((p: any) => p.id === playerId);
        const opponent = gameState.players?.find((p: any) => p.id !== playerId);
        return {
          ...gameState,
          yourCards: player?.holeCards || [],
          yourChips: player?.chips || 0,
          opponentChips: opponent?.chips || 0,
          opponentFolded: opponent?.folded || false,
          opponentIsAllIn: opponent?.isAllIn || false,
          // Hide opponent's hole cards and deck
          deck: '(hidden)',
          players: gameState.players?.map((p: any) => ({
            id: p.id,
            chips: p.chips,
            bet: p.bet,
            totalBet: p.totalBet,
            folded: p.folded,
            isAllIn: p.isAllIn,
            holeCards: p.id === playerId ? p.holeCards : ['?', '?'],
          })),
        };
      }
      case 'BATTLESHIP': {
        // Hide opponent's ship positions
        const boards = { ...gameState.boards };
        for (const pid of Object.keys(boards)) {
          if (pid !== playerId) {
            boards[pid] = { ...boards[pid], ships: '(hidden)' };
          }
        }
        return { ...gameState, boards };
      }
      case 'RPS': {
        // Hide opponent's pending move for current round
        const view = JSON.parse(JSON.stringify(gameState));
        if (view.moves) {
          const filteredMoves: Record<string, string> = {};
          for (const [pid, move] of Object.entries(view.moves)) {
            filteredMoves[pid] = pid === playerId ? (move as string) : '(hidden)';
          }
          view.moves = filteredMoves;
        }
        // Show completed round history (both moves visible after resolution)
        return view;
      }
      case 'SPLIT_OR_STEAL': {
        const view = JSON.parse(JSON.stringify(gameState));
        // Hide opponent's decision until reveal — player can see their own
        if (view.phase !== 'complete' && view.phase !== 'reveal') {
          view.players = view.players?.map((p: any) => ({
            ...p,
            decision: p.id === playerId ? p.decision : null,
          }));
        }
        return view;
      }
      default:
        return gameState;
    }
  }
}

// ============================================
// Simple Game Engines (RPS + Battleship)
// ============================================

class RPSEngine implements GameEngineAdapter {
  private static VALID_MOVES = new Set(['rock', 'paper', 'scissors']);

  processAction(state: any, action: any): any {
    const newState = JSON.parse(JSON.stringify(state));
    const playerId = action.playerId;
    
    // Normalize and validate move
    const move = String(action.action).toLowerCase().trim();
    if (!RPSEngine.VALID_MOVES.has(move)) {
      // Invalid move — pick randomly as penalty
      const moves = ['rock', 'paper', 'scissors'];
      console.warn(`[RPS] Invalid move "${action.action}" from ${playerId}, randomizing`);
      newState.moves[playerId] = moves[Math.floor(Math.random() * 3)];
    } else {
      newState.moves[playerId] = move;
    }

    // Check if both players have moved
    const playerIds = Object.keys(newState.scores);
    if (Object.keys(newState.moves).length === playerIds.length) {
      const [p1, p2] = playerIds;
      const m1 = newState.moves[p1];
      const m2 = newState.moves[p2];
      
      let winner: string | null = null;
      if (m1 === m2) {
        // Draw — no points
      } else if (
        (m1 === 'rock' && m2 === 'scissors') ||
        (m1 === 'paper' && m2 === 'rock') ||
        (m1 === 'scissors' && m2 === 'paper')
      ) {
        winner = p1;
      } else {
        winner = p2;
      }

      newState.history.push({ round: newState.round, moves: { ...newState.moves }, winner });
      if (winner) newState.scores[winner]++;
      newState.round++;
      newState.moves = {};
      newState.currentTurn = playerIds[0]; // Reset to player 1
    } else {
      // Switch to other player
      newState.currentTurn = playerIds.find((p: string) => !newState.moves[p]);
    }

    return newState;
  }

  getValidActions(state: any, playerId: string): any[] {
    // No actions if game is complete or it's not this player's turn
    if (this.isGameComplete(state)) return [];
    if (state.currentTurn !== playerId) return [];
    // No actions if player already submitted a move this round
    if (state.moves && state.moves[playerId]) return [];
    return ['rock', 'paper', 'scissors'];
  }

  isGameComplete(state: any): boolean {
    const winsNeeded = 2; // Best of 3: first to 2 wins
    const maxTotalRounds = 5; // Safety cap (draws extend the game)
    const scores = Object.values(state.scores) as number[];
    if (scores.some(s => s >= winsNeeded)) return true;
    // Total rounds played (including draws) — safety cap to prevent infinite games
    if (state.history && state.history.length >= maxTotalRounds) return true;
    return false;
  }

  getWinner(state: any): string | null {
    const entries = Object.entries(state.scores) as [string, number][];
    entries.sort((a, b) => b[1] - a[1]);
    if (entries[0][1] > entries[1][1]) return entries[0][0];
    return null; // Draw
  }

  getCurrentTurn(state: any): string | null {
    return state.currentTurn;
  }
}

class BattleshipEngine implements GameEngineAdapter {
  processAction(state: any, action: any): any {
    const newState = JSON.parse(JSON.stringify(state));
    const playerId = action.playerId;
    const { row, col } = action.data || {};

    // Validate coordinates
    if (row === undefined || col === undefined || row < 0 || row > 9 || col < 0 || col > 9) {
      // Invalid shot — skip turn as penalty
      const opponentId = Object.keys(newState.boards).find(id => id !== playerId);
      if (opponentId) newState.currentTurn = opponentId;
      return newState;
    }
    
    // Find opponent
    const opponentId = Object.keys(newState.boards).find(id => id !== playerId);
    if (!opponentId) return newState;

    const opponentBoard = newState.boards[opponentId];

    // Check for duplicate shot
    const alreadyShot = [...opponentBoard.hits, ...opponentBoard.misses]
      .some(([r, c]: [number, number]) => r === row && c === col);
    if (alreadyShot) {
      // Duplicate — skip turn as penalty
      newState.currentTurn = opponentId;
      return newState;
    }
    
    // Check if hit
    let hit = false;
    for (const ship of opponentBoard.ships) {
      if (typeof ship === 'string') continue; // Hidden
      for (const [r, c] of ship.cells) {
        if (r === row && c === col) {
          hit = true;
          break;
        }
      }
      if (hit) break;
    }

    if (hit) {
      opponentBoard.hits.push([row, col]);
      // Check if ship sunk
      for (const ship of opponentBoard.ships) {
        if (typeof ship === 'string') continue;
        const allHit = ship.cells.every(([r, c]: [number, number]) =>
          opponentBoard.hits.some(([hr, hc]: [number, number]) => hr === r && hc === c)
        );
        if (allHit && !ship.sunk) {
          ship.sunk = true;
          newState.shipsRemaining[opponentId]--;
        }
      }
    } else {
      opponentBoard.misses.push([row, col]);
    }

    // Switch turn
    newState.currentTurn = opponentId;
    return newState;
  }

  getValidActions(state: any, playerId: string): any[] {
    const opponentId = Object.keys(state.boards).find(id => id !== playerId);
    if (!opponentId) return [];
    const board = state.boards[opponentId];
    const taken = new Set([...board.hits, ...board.misses].map(([r, c]: [number, number]) => `${r},${c}`));
    const valid = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (!taken.has(`${r},${c}`)) valid.push({ row: r, col: c });
      }
    }
    return valid;
  }

  isGameComplete(state: any): boolean {
    return Object.values(state.shipsRemaining).some((remaining: any) => remaining === 0);
  }

  getWinner(state: any): string | null {
    for (const [playerId, remaining] of Object.entries(state.shipsRemaining)) {
      if ((remaining as number) === 0) {
        // This player lost — return the OTHER player
        return Object.keys(state.shipsRemaining).find(id => id !== playerId) || null;
      }
    }
    return null;
  }

  getCurrentTurn(state: any): string | null {
    return state.currentTurn;
  }
}

// Singleton
export const arenaService = new ArenaService();
