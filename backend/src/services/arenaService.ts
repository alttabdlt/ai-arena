/**
 * ArenaService — Central orchestration for AI Arena PvP.
 * 
 * Handles: agent registration, matchmaking, game execution,
 * wager tracking, ELO updates, and opponent record management.
 */

import { PrismaClient, ArenaAgent, ArenaMatch, ArenaGameType, AgentArchetype } from '@prisma/client';
import { randomBytes } from 'crypto';
import { smartAiService, GameMoveRequest, OpponentScouting, MetaContext, AgentConfig } from './smartAiService';
import { GameEngineAdapterFactory, GameEngineAdapter } from './gameEngineAdapter';

const prisma = new PrismaClient();

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

  constructor() {
    this.gameEngines = new Map();
    this.gameEngines.set('POKER', GameEngineAdapterFactory.create('poker'));
    // RPS and Battleship will be added
    this.gameEngines.set('RPS', new RPSEngine());
    this.gameEngines.set('BATTLESHIP', new BattleshipEngine());
  }

  // ============================================
  // Agent Management
  // ============================================

  async registerAgent(input: RegisterAgentInput): Promise<ArenaAgent> {
    const apiKey = `arena_${randomBytes(32).toString('hex')}`;
    
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
        bankroll: 10000, // Starting bankroll
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

    // If opponent specified, also deduct and start
    if (input.opponentId) {
      const opponent = await prisma.arenaAgent.findUnique({ where: { id: input.opponentId } });
      if (!opponent) throw new Error('Opponent not found');
      if (opponent.bankroll < input.wagerAmount) throw new Error('Opponent has insufficient bankroll');

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

  async getMatchState(matchId: string) {
    const match = await prisma.arenaMatch.findUnique({
      where: { id: matchId },
      include: {
        player1: { select: { id: true, name: true, archetype: true, elo: true } },
        player2: { select: { id: true, name: true, archetype: true, elo: true } },
        moves: { orderBy: { turnNumber: 'asc' } },
      },
    });
    if (!match) throw new Error('Match not found');

    const gameState = JSON.parse(match.gameState);
    const engine = this.gameEngines.get(match.gameType);

    return {
      matchId: match.id,
      gameType: match.gameType,
      status: match.status,
      wagerAmount: match.wagerAmount,
      totalPot: match.totalPot,
      player1: match.player1,
      player2: match.player2,
      currentTurnId: match.currentTurnId,
      turnNumber: match.turnNumber,
      gameState,
      validActions: engine && match.currentTurnId
        ? engine.getValidActions(gameState, match.currentTurnId)
        : [],
      isComplete: engine ? engine.isGameComplete(gameState) : false,
      moves: match.moves.map(m => ({
        turnNumber: m.turnNumber,
        agentId: m.agentId,
        action: m.action,
        reasoning: m.reasoning,
        timestamp: m.timestamp,
      })),
    };
  }

  async submitMove(input: SubmitMoveInput): Promise<{ matchState: any; isComplete: boolean }> {
    const match = await prisma.arenaMatch.findUnique({ where: { id: input.matchId } });
    if (!match) throw new Error('Match not found');
    if (match.status !== 'ACTIVE') throw new Error('Match is not active');
    if (match.currentTurnId !== input.agentId) throw new Error('Not your turn');

    const engine = this.gameEngines.get(match.gameType);
    if (!engine) throw new Error('Game engine not found');

    const gameState = JSON.parse(match.gameState);
    
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

    // If complete, resolve wagers
    if (isComplete) {
      await this.resolveMatch(input.matchId, engine.getWinner(newState));
    }

    const updatedState = await this.getMatchState(input.matchId);
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

    // Get AI decision
    const { move, cost } = await smartAiService.getGameMove(request);

    // Record cost
    await prisma.arenaAgent.update({
      where: { id: agentId },
      data: { apiCostCents: { increment: cost.costCents } },
    });

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
        reasoning: move.reasoning,
        apiCostCents: cost.costCents,
        responseTimeMs: cost.latencyMs,
      },
    });

    return { move, cost, isComplete: result.isComplete };
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
            draws: { increment: 1 },
            isInMatch: false,
            currentMatchId: null,
          },
        });
      }
    }

    // Update opponent records
    await this.updateOpponentRecord(match.player1Id, match.player2Id, winnerId);
    await this.updateOpponentRecord(match.player2Id, match.player1Id, winnerId);
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
        initialState = { round: 1, maxRounds: 5, scores: { [player1Id]: 0, [player2Id]: 0 }, moves: {}, history: [] };
        break;
      case 'BATTLESHIP':
        initialState = this.initBattleshipState(player1Id, player2Id);
        break;
    }

    // Determine first turn
    const firstTurn = gameType === 'RPS' ? player1Id : // RPS: both move simultaneously (player1 goes first for ordering)
      Math.random() < 0.5 ? player1Id : player2Id; // Random for others

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
    // Simplified poker state — the existing poker engine will handle the full state
    const deck = this.shuffleDeck();
    return {
      players: [
        { id: p1, chips: 1000, bet: 0, folded: false, cards: [deck.pop(), deck.pop()] },
        { id: p2, chips: 1000, bet: 0, folded: false, cards: [deck.pop(), deck.pop()] },
      ],
      deck,
      communityCards: [],
      pot: 0,
      currentBet: 0,
      phase: 'preflop',
      dealerIndex: 0,
      currentTurn: p1,
      smallBlind: 10,
      bigBlind: 20,
      handNumber: 1,
    };
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

  private shuffleDeck(): string[] {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = suits.flatMap(s => ranks.map(r => `${r}${s}`));
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
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

  private getPlayerView(gameState: any, playerId: string, gameType: string): any {
    // Return a player-specific view (hide opponent's hidden info)
    switch (gameType) {
      case 'POKER': {
        const player = gameState.players?.find((p: any) => p.id === playerId);
        const opponent = gameState.players?.find((p: any) => p.id !== playerId);
        return {
          ...gameState,
          yourCards: player?.cards || [],
          yourChips: player?.chips || 0,
          opponentChips: opponent?.chips || 0,
          opponentFolded: opponent?.folded || false,
          // Hide opponent's cards
          players: gameState.players?.map((p: any) => ({
            ...p,
            cards: p.id === playerId ? p.cards : ['?', '?'],
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
      default:
        return gameState;
    }
  }
}

// ============================================
// Simple Game Engines (RPS + Battleship)
// ============================================

class RPSEngine implements GameEngineAdapter {
  processAction(state: any, action: any): any {
    const newState = JSON.parse(JSON.stringify(state));
    const playerId = action.playerId;
    newState.moves[playerId] = action.action; // rock/paper/scissors

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

  getValidActions(_state: any, _playerId: string): any[] {
    return ['rock', 'paper', 'scissors'];
  }

  isGameComplete(state: any): boolean {
    const maxRounds = state.maxRounds || 5;
    // Bo5: first to 3 wins, or all rounds played
    const scores = Object.values(state.scores) as number[];
    if (scores.some(s => s >= Math.ceil(maxRounds / 2))) return true;
    if (state.round > maxRounds) return true;
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
    
    // Find opponent
    const opponentId = Object.keys(newState.boards).find(id => id !== playerId);
    if (!opponentId) return newState;

    const opponentBoard = newState.boards[opponentId];
    
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
