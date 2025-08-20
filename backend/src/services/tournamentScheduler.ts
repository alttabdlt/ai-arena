import { PrismaClient } from '@prisma/client';
import { PubSub } from 'graphql-subscriptions';
import * as cron from 'node-cron';
// import { getGameManagerService } from './gameManagerService';
import { AIService } from './aiService';

export interface TournamentConfig {
  id: string;
  startTime: Date;
  gameType: 'POKER' | 'REVERSE_HANGMAN' | 'CONNECT4';
  participants: TournamentParticipant[];
  bettingDeadline: Date;
  status: 'SCHEDULED' | 'BETTING_OPEN' | 'BETTING_CLOSED' | 'IN_PROGRESS' | 'COMPLETED';
  totalBettingPool: number;
  housePoolContribution: number;
  gameInstanceId?: string; // Reference to actual game instance
}

export interface TournamentParticipant {
  id: string;
  aiModel: string;
  name: string;
  odds: number;
  totalBetsPlaced: number;
}

export interface Bet {
  id: string;
  userId: string;
  tournamentId: string;
  participantId: string;
  amount: number;
  potentialPayout: number;
  timestamp: Date;
}

export class TournamentScheduler {
  private static instance: TournamentScheduler;
  private prisma: PrismaClient; // TODO: Use for database persistence
  private pubsub: PubSub;
  // private gameManager: any; // GameManagerService instance - TODO: implement game logic
  // private aiService: AIService; // TODO: implement AI integration
  private scheduledTournaments: Map<string, TournamentConfig> = new Map();
  private activeBets: Map<string, Bet[]> = new Map();
  private schedulerJob: any = null;
  private statusCheckInterval: any = null;
  
  // Tournament schedule: every 15 minutes
  private schedulePattern = '0,15,30,45 * * * *'; // At :00, :15, :30, :45 of every hour
  
  // Game rotation - using existing games optimized for tournaments
  private gameRotation = [
    'POKER',           // :00 - Fast poker with parallel AI
    'REVERSE_HANGMAN', // :15 - Quick word guessing
    'CONNECT4',        // :30 - Strategic placement  
    'POKER'            // :45 - Poker again (most popular)
  ];
  
  // AI Models pool
  private aiModels = [
    { model: 'gpt-4', name: 'GPT-4 Turbo' },
    { model: 'claude-3-opus', name: 'Claude Opus' },
    { model: 'deepseek-v2', name: 'DeepSeek V2' },
    { model: 'llama-3-70b', name: 'Llama 3' },
    { model: 'mixtral-8x7b', name: 'Mixtral' },
    { model: 'gemini-pro', name: 'Gemini Pro' },
    { model: 'command-r', name: 'Command R' },
    { model: 'qwen-72b', name: 'Qwen 72B' }
  ];

  private constructor(
    prisma: PrismaClient,
    pubsub: PubSub,
    _gameManager: any, // GameManagerService instance - TODO: implement
    _aiService: AIService // TODO: implement
  ) {
    this.prisma = prisma;
    this.pubsub = pubsub;
    // this.gameManager = gameManager;
    // this.aiService = aiService;
  }

  public static getInstance(
    prisma: PrismaClient,
    pubsub: PubSub,
    gameManager: any, // GameManagerService instance
    aiService: AIService
  ): TournamentScheduler {
    if (!TournamentScheduler.instance) {
      TournamentScheduler.instance = new TournamentScheduler(prisma, pubsub, gameManager, aiService);
    }
    return TournamentScheduler.instance;
  }

  public initialize(): void {
    // Schedule tournaments every 15 minutes
    this.schedulerJob = cron.schedule(this.schedulePattern, () => {
      this.createNextTournament();
    });
    
    // Check tournament status every second
    this.statusCheckInterval = setInterval(() => {
      this.checkTournamentStatus();
    }, 1000);
    
    // Pre-schedule tournaments only if not in fast startup mode
    const fastStartup = process.env.FAST_STARTUP === 'true';
    const enablePreschedule = process.env.ENABLE_TOURNAMENT_PRESCHEDULE !== 'false';
    
    if (!fastStartup && enablePreschedule) {
      this.preScheduleTournaments();
      console.log('🎰 Tournament Scheduler initialized - Pre-scheduled 5 tournaments');
    } else {
      // Just create the next tournament
      this.createNextTournament();
      console.log('🎰 Tournament Scheduler initialized - Tournaments every 15 minutes');
    }
  }
  
  public start(): void {
    if (!this.schedulerJob) {
      this.initialize();
    }
  }
  
  public stop(): void {
    if (this.schedulerJob) {
      this.schedulerJob.stop();
      this.schedulerJob = null;
    }
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }
    console.log('🛑 Tournament Scheduler stopped');
  }

  private preScheduleTournaments(): void {
    const now = new Date();
    const currentMinute = now.getMinutes();
    
    // Find next tournament slot
    const slots = [0, 15, 30, 45];
    let nextSlotIndex = slots.findIndex(slot => slot > currentMinute);
    if (nextSlotIndex === -1) nextSlotIndex = 0; // Wrap to next hour
    
    // Schedule next 5 tournaments (only log first one to reduce noise)
    for (let i = 0; i < 5; i++) {
      const slotIndex = (nextSlotIndex + i) % 4;
      const slot = slots[slotIndex];
      
      const tournamentTime = new Date(now);
      tournamentTime.setSeconds(0);
      tournamentTime.setMilliseconds(0);
      
      if (i === 0 && slot > currentMinute) {
        // Same hour
        tournamentTime.setMinutes(slot);
      } else {
        // Next hour(s)
        const hoursToAdd = Math.floor((nextSlotIndex + i) / 4) + (slot <= currentMinute ? 1 : 0);
        tournamentTime.setHours(tournamentTime.getHours() + hoursToAdd);
        tournamentTime.setMinutes(slot);
      }
      
      // Only log the first tournament to reduce startup noise
      if (i === 0) {
        this.createTournament(tournamentTime, this.gameRotation[slotIndex] as any);
      } else {
        this.createTournamentSilent(tournamentTime, this.gameRotation[slotIndex] as any);
      }
    }
  }
  
  private createTournamentSilent(startTime: Date, gameType: 'POKER' | 'REVERSE_HANGMAN' | 'CONNECT4'): void {
    // Same as createTournament but without console.log
    const tournamentId = `tournament-${startTime.getTime()}`;
    const bettingDeadline = new Date(startTime.getTime() - 2 * 60 * 1000); // 2 mins before start
    
    // Select 2 random AI models
    const shuffled = [...this.aiModels].sort(() => Math.random() - 0.5);
    const participants: TournamentParticipant[] = shuffled.slice(0, 2).map((ai, index) => ({
      id: `participant-${tournamentId}-${index}`,
      aiModel: ai.model,
      name: ai.name,
      odds: this.calculateInitialOdds(ai.model, gameType),
      totalBetsPlaced: 0
    }));
    
    const tournament: TournamentConfig = {
      id: tournamentId,
      startTime,
      gameType,
      participants,
      bettingDeadline,
      status: 'SCHEDULED',
      totalBettingPool: 0,
      housePoolContribution: 1000 // House adds 1000 XP base
    };
    
    this.scheduledTournaments.set(tournamentId, tournament);
    this.activeBets.set(tournamentId, []);
    
    // Publish tournament created event
    this.pubsub.publish('TOURNAMENT_CREATED', { 
      tournamentCreated: tournament 
    });
  }

  private createNextTournament(): void {
    const now = new Date();
    // const currentMinute = now.getMinutes();
    // const slotIndex = Math.floor(currentMinute / 15); // Not used in simple scheduling
    
    // Create tournament for 75 minutes from now (5 slots ahead)
    const futureTime = new Date(now.getTime() + 75 * 60 * 1000);
    futureTime.setSeconds(0);
    futureTime.setMilliseconds(0);
    
    const futureSlotIndex = Math.floor(futureTime.getMinutes() / 15);
    const gameType = this.gameRotation[futureSlotIndex] as any;
    
    this.createTournament(futureTime, gameType);
  }

  private createTournament(startTime: Date, gameType: 'POKER' | 'REVERSE_HANGMAN' | 'CONNECT4'): void {
    const tournamentId = `tournament-${startTime.getTime()}`;
    
    // Skip if already exists
    if (this.scheduledTournaments.has(tournamentId)) {
      return;
    }
    
    // Select exactly 2 AI models for 1v1 match
    const shuffled = [...this.aiModels].sort(() => Math.random() - 0.5);
    const selectedModels = shuffled.slice(0, 2); // Always 2 participants for 1v1
    
    // Create participants with initial odds
    const participants: TournamentParticipant[] = selectedModels.map((model) => ({
      id: `${tournamentId}-${model.model}`,
      aiModel: model.model,
      name: model.name,
      odds: this.calculateInitialOdds(model.model, gameType),
      totalBetsPlaced: 0
    }));
    
    // Betting deadline is 1 minute before tournament
    const bettingDeadline = new Date(startTime.getTime() - 60 * 1000);
    
    const tournament: TournamentConfig = {
      id: tournamentId,
      startTime,
      gameType,
      participants,
      bettingDeadline,
      status: 'SCHEDULED',
      totalBettingPool: 0,
      housePoolContribution: 0
    };
    
    this.scheduledTournaments.set(tournamentId, tournament);
    this.activeBets.set(tournamentId, []);
    
    // Publish tournament created event
    this.pubsub.publish('TOURNAMENT_CREATED', { 
      tournamentCreated: tournament 
    });
    
    console.log(`📅 Tournament scheduled: ${gameType} at ${startTime.toLocaleTimeString()}`);
  }

  private calculateInitialOdds(model: string, gameType: string): number {
    // Base odds based on model reputation
    const baseOdds: Record<string, number> = {
      'gpt-4': 2.5,
      'claude-3-opus': 2.8,
      'deepseek-v2': 4.5,
      'llama-3-70b': 3.8,
      'mixtral-8x7b': 5.2,
      'gemini-pro': 3.2,
      'command-r': 6.5,
      'qwen-72b': 7.0
    };
    
    // Adjust for game type strengths
    let odds = baseOdds[model] || 10.0;
    
    if (gameType === 'PROMPT_RACING' && model.includes('gpt')) {
      odds *= 0.8; // GPT models are faster
    } else if (gameType === 'VIBE_CHECK' && model.includes('claude')) {
      odds *= 0.85; // Claude has better personality
    } else if (gameType === 'LIGHTNING_POKER' && model.includes('deepseek')) {
      odds *= 1.2; // DeepSeek less optimal at poker
    }
    
    // Add some randomness (±15%)
    odds *= (0.85 + Math.random() * 0.3);
    
    return Math.round(odds * 100) / 100; // Round to 2 decimals
  }

  private checkTournamentStatus(): void {
    const now = new Date();
    
    this.scheduledTournaments.forEach(tournament => {
      const timeUntilStart = tournament.startTime.getTime() - now.getTime();
      const timeUntilBettingClose = tournament.bettingDeadline.getTime() - now.getTime();
      
      // Open betting 14 minutes before tournament
      if (timeUntilStart <= 14 * 60 * 1000 && tournament.status === 'SCHEDULED') {
        tournament.status = 'BETTING_OPEN';
        this.pubsub.publish('TOURNAMENT_BETTING_OPEN', { 
          tournamentBettingOpen: tournament 
        });
        console.log(`🎲 Betting open for tournament ${tournament.id}`);
      }
      
      // Close betting 1 minute before tournament
      if (timeUntilBettingClose <= 0 && tournament.status === 'BETTING_OPEN') {
        tournament.status = 'BETTING_CLOSED';
        this.finalizeBettingOdds(tournament);
        this.pubsub.publish('TOURNAMENT_BETTING_CLOSED', { 
          tournamentBettingClosed: tournament 
        });
        console.log(`🔒 Betting closed for tournament ${tournament.id}`);
      }
      
      // Start tournament
      if (timeUntilStart <= 0 && tournament.status === 'BETTING_CLOSED') {
        tournament.status = 'IN_PROGRESS';
        this.startTournament(tournament);
      }
      
      // Clean up old completed tournaments (older than 1 hour)
      if (tournament.status === 'COMPLETED' && 
          now.getTime() - tournament.startTime.getTime() > 60 * 60 * 1000) {
        this.scheduledTournaments.delete(tournament.id);
        this.activeBets.delete(tournament.id);
      }
    });
  }

  private finalizeBettingOdds(tournament: TournamentConfig): void {
    const bets = this.activeBets.get(tournament.id) || [];
    
    // Calculate total pool
    tournament.totalBettingPool = bets.reduce((sum, bet) => sum + bet.amount, 0);
    
    // Add house contribution (5% of pool)
    tournament.housePoolContribution = tournament.totalBettingPool * 0.05;
    
    // Update dynamic odds based on betting distribution
    tournament.participants.forEach(participant => {
      const participantBets = bets.filter(b => b.participantId === participant.id);
      participant.totalBetsPlaced = participantBets.reduce((sum, bet) => sum + bet.amount, 0);
      
      // Parimutuel odds calculation
      if (participant.totalBetsPlaced > 0) {
        const totalPool = tournament.totalBettingPool + tournament.housePoolContribution;
        const houseCut = totalPool * 0.05; // 5% house edge
        const payoutPool = totalPool - houseCut;
        
        // New odds = (Total Payout Pool) / (Total Bets on Participant)
        participant.odds = payoutPool / participant.totalBetsPlaced;
      }
    });
    
    // Update potential payouts for all bets
    bets.forEach(bet => {
      const participant = tournament.participants.find(p => p.id === bet.participantId);
      if (participant) {
        bet.potentialPayout = bet.amount * participant.odds;
      }
    });
  }

  private async startTournament(tournament: TournamentConfig): Promise<void> {
    console.log(`🏁 Starting tournament ${tournament.id} - ${tournament.gameType}`);
    
    this.pubsub.publish('TOURNAMENT_STARTED', { 
      tournamentStarted: tournament 
    });
    
    // Execute the tournament game using real game engines
    switch (tournament.gameType) {
      case 'POKER':
        await this.runTournamentPoker(tournament);
        break;
      case 'REVERSE_HANGMAN':
        await this.runTournamentReverseHangman(tournament);
        break;
      case 'CONNECT4':
        await this.runTournamentConnect4(tournament);
        break;
    }
  }

  private async runTournamentPoker(tournament: TournamentConfig): Promise<void> {
    console.log(`🎮 Starting tournament poker: ${tournament.participants[0].name} vs ${tournament.participants[1].name}`);
    
    // Import game manager service
    const { getGameManagerService } = await import('./gameManagerService');
    const gameManager = getGameManagerService();
    
    // Generate unique game ID
    const gameId = `tournament-poker-${tournament.id}-${Date.now()}`;
    
    // Map participants to player IDs
    const playerIds = tournament.participants.map(p => p.id);
    
    // Create initial poker state
    const initialState = {
      phase: 'preflop',
      players: tournament.participants.map((p, _idx) => ({
        id: p.id,
        name: p.name,
        chips: 1000, // Small stacks for faster play
        cards: [],
        bet: 0,
        totalBet: 0,
        folded: false,
        isActive: true,
        isAllIn: false,
        hasActed: false,
        modelType: p.aiModel
      })),
      communityCards: [],
      pot: 0,
      currentBet: 0,
      currentTurn: playerIds[0],
      deck: null, // Will be initialized by game engine
      handNumber: 1,
      bigBlind: 100, // Aggressive blinds
      smallBlind: 50,
      dealerIndex: 0,
      timeoutMs: 10000 // 10 second timeout
      // Note: Poker is turn-based - players act sequentially, not in parallel
    };
    
    try {
      // Create and start the game
      await gameManager.createGame(gameId, 'poker', playerIds, initialState);
      tournament.gameInstanceId = gameId;
      
      // Start the game
      await gameManager.startGame(gameId);
      
      // Wait for game completion (with timeout)
      const maxWaitTime = 90000; // 90 seconds max
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        const gameState = gameManager.getGameById(gameId);
        
        if (gameState?.status === 'completed') {
          // Get the winner
          const winner = gameState.state.winners?.[0];
          if (winner) {
            const winnerParticipant = tournament.participants.find(
              p => p.id === winner.playerId
            );
            if (winnerParticipant) {
              this.completeTournament(tournament, winnerParticipant.id);
              return;
            }
          }
          break;
        }
        
        // Wait 1 second before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // If timeout, pick a random winner
      console.log('⚠️ Tournament poker timed out, selecting random winner');
      const randomWinner = tournament.participants[Math.floor(Math.random() * 2)];
      this.completeTournament(tournament, randomWinner.id);
      
    } catch (error) {
      console.error('Error running tournament poker:', error);
      // Fallback to random winner
      const randomWinner = tournament.participants[Math.floor(Math.random() * 2)];
      this.completeTournament(tournament, randomWinner.id);
    }
  }

  private async runTournamentReverseHangman(tournament: TournamentConfig): Promise<void> {
    console.log(`🎮 Starting tournament reverse hangman: ${tournament.participants[0].name} vs ${tournament.participants[1].name}`);
    
    // Import game manager service
    const { getGameManagerService } = await import('./gameManagerService');
    const gameManager = getGameManagerService();
    
    // Generate unique game ID
    const gameId = `tournament-hangman-${tournament.id}-${Date.now()}`;
    
    // Map participants to player IDs
    const playerIds = tournament.participants.map(p => p.id);
    
    // Create initial reverse hangman state
    const initialState = {
      phase: 'playing',
      players: tournament.participants.map(p => ({
        id: p.id,
        name: p.name,
        roundsWon: 0,
        totalScore: 0,
        modelType: p.aiModel
      })),
      currentPromptPair: {
        prompt: 'a red sports car driving fast',
        output: 'An image of a sleek crimson Ferrari speeding down a highway'
      },
      attempts: [],
      maxAttempts: 5, // Limited attempts for quick resolution
      currentTurn: playerIds[0],
      turnCount: 0,
      timeoutMs: 10000 // 10 second timeout
      // Note: Reverse Hangman is turn-based - players guess sequentially
    };
    
    try {
      // Create and start the game
      await gameManager.createGame(gameId, 'reverse-hangman', playerIds, initialState);
      tournament.gameInstanceId = gameId;
      
      // Start the game
      await gameManager.startGame(gameId);
      
      // Wait for game completion (with timeout)
      const maxWaitTime = 60000; // 60 seconds max for reverse hangman
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        const gameState = gameManager.getGameById(gameId);
        
        if (gameState?.status === 'completed') {
          // Get the winner
          const winner = gameState.state.winners?.[0];
          if (winner) {
            const winnerParticipant = tournament.participants.find(
              p => p.id === winner.playerId
            );
            if (winnerParticipant) {
              this.completeTournament(tournament, winnerParticipant.id);
              return;
            }
          }
          break;
        }
        
        // Wait 1 second before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // If timeout, pick a random winner
      console.log('⚠️ Tournament reverse hangman timed out, selecting random winner');
      const randomWinner = tournament.participants[Math.floor(Math.random() * 2)];
      this.completeTournament(tournament, randomWinner.id);
      
    } catch (error) {
      console.error('Error running tournament reverse hangman:', error);
      // Fallback to random winner
      const randomWinner = tournament.participants[Math.floor(Math.random() * 2)];
      this.completeTournament(tournament, randomWinner.id);
    }
  }

  private async runTournamentConnect4(tournament: TournamentConfig): Promise<void> {
    console.log(`🎮 Starting tournament connect4: ${tournament.participants[0].name} vs ${tournament.participants[1].name}`);
    
    // Import game manager service
    const { getGameManagerService } = await import('./gameManagerService');
    const gameManager = getGameManagerService();
    
    // Generate unique game ID
    const gameId = `tournament-connect4-${tournament.id}-${Date.now()}`;
    
    // Map participants to player IDs
    const playerIds = tournament.participants.map(p => p.id);
    
    // Create initial connect4 state
    const initialState = {
      board: Array(6).fill(null).map(() => Array(7).fill(null)),
      players: tournament.participants.map((p, idx) => ({
        id: p.id,
        name: p.name,
        color: idx === 0 ? 'red' : 'yellow',
        modelType: p.aiModel
      })),
      currentTurn: playerIds[0],
      currentPlayerIndex: 0,
      phase: 'playing',
      gamePhase: 'playing',
      winner: null,
      moveCount: 0,
      timeoutMs: 10000 // 10 second timeout per move
      // Note: Connect4 is strictly turn-based - one player moves at a time
    };
    
    try {
      // Create and start the game
      await gameManager.createGame(gameId, 'connect4', playerIds, initialState);
      tournament.gameInstanceId = gameId;
      
      // Start the game
      await gameManager.startGame(gameId);
      
      // Wait for game completion (with timeout)
      const maxWaitTime = 120000; // 120 seconds max for connect4
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        const gameState = gameManager.getGameById(gameId);
        
        if (gameState?.status === 'completed') {
          // Get the winner
          const winner = gameState.state.winners?.[0] || gameState.state.winner;
          if (winner) {
            const winnerId = typeof winner === 'string' ? winner : winner.playerId;
            const winnerParticipant = tournament.participants.find(
              p => p.id === winnerId
            );
            if (winnerParticipant) {
              this.completeTournament(tournament, winnerParticipant.id);
              return;
            }
          }
          break;
        }
        
        // Wait 1 second before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // If timeout, pick a random winner
      console.log('⚠️ Tournament connect4 timed out, selecting random winner');
      const randomWinner = tournament.participants[Math.floor(Math.random() * 2)];
      this.completeTournament(tournament, randomWinner.id);
      
    } catch (error) {
      console.error('Error running tournament connect4:', error);
      // Fallback to random winner
      const randomWinner = tournament.participants[Math.floor(Math.random() * 2)];
      this.completeTournament(tournament, randomWinner.id);
    }
  }

  private completeTournament(tournament: TournamentConfig, winnerId: string): void {
    tournament.status = 'COMPLETED';
    
    const winner = tournament.participants.find(p => p.id === winnerId);
    const bets = this.activeBets.get(tournament.id) || [];
    
    // Process payouts
    const winningBets = bets.filter(b => b.participantId === winnerId);
    const totalPayout = winningBets.reduce((sum, bet) => sum + bet.potentialPayout, 0);
    
    // Publish results
    this.pubsub.publish('TOURNAMENT_COMPLETED', {
      tournamentCompleted: {
        tournament,
        winner,
        totalPayout,
        winningBets
      }
    });
    
    console.log(`🏆 Tournament ${tournament.id} completed! Winner: ${winner?.name}`);
    
    // Process payouts (would integrate with XP/wallet system)
    this.processPayouts(tournament, winnerId, winningBets);
  }

  private processPayouts(_tournament: TournamentConfig, _winnerId: string, winningBets: Bet[]): void {
    // This would integrate with the XP economy service
    winningBets.forEach(bet => {
      console.log(`💰 Payout ${bet.potentialPayout} XP to user ${bet.userId}`);
      // TODO: Actually credit XP to user account
    });
  }


  // Public methods for placing bets
  public placeBet(userId: string, tournamentId: string, participantId: string, amount: number): Bet | null {
    const tournament = this.scheduledTournaments.get(tournamentId);
    
    if (!tournament || tournament.status !== 'BETTING_OPEN') {
      return null;
    }
    
    const participant = tournament.participants.find(p => p.id === participantId);
    if (!participant) {
      return null;
    }
    
    const bet: Bet = {
      id: `bet-${Date.now()}-${Math.random()}`,
      userId,
      tournamentId,
      participantId,
      amount,
      potentialPayout: amount * participant.odds,
      timestamp: new Date()
    };
    
    const bets = this.activeBets.get(tournamentId) || [];
    bets.push(bet);
    this.activeBets.set(tournamentId, bets);
    
    // Update participant's total bets
    participant.totalBetsPlaced += amount;
    
    // Publish bet placed event
    this.pubsub.publish('BET_PLACED', { betPlaced: bet });
    
    return bet;
  }

  public getUpcomingTournaments(): TournamentConfig[] {
    return Array.from(this.scheduledTournaments.values())
      .filter(t => t.status !== 'COMPLETED')
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .slice(0, 5);
  }

  public getTournament(id: string): TournamentConfig | undefined {
    return this.scheduledTournaments.get(id);
  }

  public getUserBets(userId: string): Bet[] {
    const allBets: Bet[] = [];
    this.activeBets.forEach(bets => {
      allBets.push(...bets.filter(b => b.userId === userId));
    });
    return allBets;
  }
  
  public async forceCompleteTournament(tournamentId: string): Promise<void> {
    // Public method for admin testing - completes a tournament with a random winner
    const tournament = this.scheduledTournaments.get(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }
    
    // TODO: In the future, persist to database
    // await this.prisma.bettingTournament.update(...)
    void this.prisma; // Acknowledge future use
    
    // Pick a random winner
    const winner = tournament.participants[Math.floor(Math.random() * tournament.participants.length)];
    
    // Update tournament status
    tournament.status = 'COMPLETED';
    
    // Calculate payouts (simplified for testing)
    const bets = this.activeBets.get(tournamentId) || [];
    const winningBets = bets.filter(b => b.participantId === winner.id);
    
    // Distribute payouts to winners
    winningBets.forEach(bet => {
      console.log(`💰 Payout to user ${bet.userId}: ${bet.potentialPayout} XP`);
    });
    
    // Emit completion event
    this.pubsub.publish('TOURNAMENT_COMPLETED', {
      tournamentCompleted: {
        id: tournamentId,
        winnerId: winner.id,
        winnerName: winner.name
      }
    });
    
    console.log(`✅ Tournament ${tournamentId} completed. Winner: ${winner.name}`);
  }
}

// Helper function to get the singleton instance
let schedulerInstance: TournamentScheduler | null = null;

export function initializeTournamentScheduler(
  prisma: PrismaClient,
  pubsub: PubSub,
  gameManager: any, // GameManagerService instance
  aiService: AIService
): TournamentScheduler {
  if (!schedulerInstance) {
    schedulerInstance = TournamentScheduler.getInstance(prisma, pubsub, gameManager, aiService);
  }
  return schedulerInstance;
}

export function getTournamentScheduler(): TournamentScheduler {
  if (!schedulerInstance) {
    throw new Error('Tournament scheduler not initialized. Call initializeTournamentScheduler first.');
  }
  return schedulerInstance;
}