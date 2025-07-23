import { PokerEngine, Player, ActionType, PlayerAction, GamePhase } from '../engine/poker-engine';
import { AIAgentManager, AIDecision } from '../ai/ai-agents';
import { StyleScoringSystem, StyleBonus } from '../scoring/style-scoring';
import { PointScoringSystem, PointEvent } from '../scoring/point-scoring';
import { achievementSystem, AchievementEvent } from '../achievements/achievement-system';
import botGambler from '@/assets/bot-gambler.png';
import botTerminator from '@/assets/bot-terminator.png';
import botZenMaster from '@/assets/bot-zen-master.png';

export interface GameSpeed {
  actionDelay: number;
  animationDelay: number;
}

export const GAME_SPEEDS: { [key: string]: GameSpeed } = {
  slow: { actionDelay: 3000, animationDelay: 1000 },
  normal: { actionDelay: 2000, animationDelay: 500 },
  fast: { actionDelay: 1000, animationDelay: 200 },
  thinking: { actionDelay: 60000, animationDelay: 2000 } // 1 minute thinking time
};

export interface PlayerInfo {
  id: string;
  name: string;
  avatar: string;
  isAI: boolean;
  chips: number;
  position: number;
  aiModel?: 'deepseek-chat' | 'gpt-4o' | 'claude-3-5-sonnet' | 'claude-3-opus';
}

export interface PlayerConfig {
  id: string;
  name: string;
  avatar: string;
  position: number;
  aiModel?: 'deepseek-chat' | 'gpt-4o' | 'claude-3-5-sonnet' | 'claude-3-opus';
}

export interface GameEvent {
  type: 'action' | 'phase-change' | 'hand-complete' | 'thinking' | 'style-bonus' | 'hand-misread' | 'points' | 'achievement';
  playerId?: string;
  action?: PlayerAction;
  reasoning?: string;
  phase?: GamePhase;
  winners?: { playerId: string; amount: number; hand?: string }[];
  styleBonuses?: StyleBonus[];
  misread?: {
    handNumber: number;
    actual: string;
    aiThought: string;
    holeCards: string[];
    boardCards: string[];
    phase: string;
    severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
    modelName: string;
  };
  pointEvents?: PointEvent[];
  achievementEvents?: AchievementEvent[];
  timestamp: number;
}

export interface DecisionHistoryEntry {
  handNumber: number;
  playerId: string;
  playerName: string;
  playerCards: string[];
  decision: AIDecision;
  gamePhase: GamePhase;
  communityCards: string[];
  timestamp: number;
}

export type GameState = 'setup' | 'playing' | 'paused' | 'finished';

export interface GameConfig {
  speed: 'thinking' | 'normal' | 'fast';
  startingChips: number;
  maxHands: number;
  showAIThinking: boolean;
  showDecisionHistory: boolean;
  playerCount: number; // 2-9 players
  playerConfigs?: PlayerConfig[];
}

export class PokerGameManager {
  private engine: PokerEngine;
  private aiManager: AIAgentManager;
  private players: Map<string, PlayerInfo> = new Map();
  private speed: GameSpeed = GAME_SPEEDS.thinking; // Default to 1 minute thinking
  private isPaused: boolean = false;
  private eventHandlers: ((event: GameEvent) => void)[] = [];
  private currentAIDecision: AIDecision | null = null;
  private aiDecisionHistory: Map<string, AIDecision> = new Map();
  private fullDecisionHistory: DecisionHistoryEntry[] = [];
  private currentHandNumber: number = 0;
  private gameState: GameState = 'setup';
  private currentHandActionHistory: { player: string; action: string; amount?: number; round: GamePhase }[] = [];
  private styleScoring: StyleScoringSystem;
  private pointScoring: PointScoringSystem;
  private lastAggressivePlayer: string | null = null;
  private handParticipants: Set<string> = new Set();
  private config: GameConfig = {
    speed: 'thinking',
    startingChips: 10000,
    maxHands: 20,
    showAIThinking: true,
    showDecisionHistory: true,
    playerCount: 3 // Default to 3 players
  };

  constructor() {
    this.engine = new PokerEngine();
    this.aiManager = new AIAgentManager();
    this.styleScoring = new StyleScoringSystem();
    this.pointScoring = new PointScoringSystem('BALANCED');
    
    // Subscribe to point events and emit them
    this.pointScoring.onPointEvent((event) => {
      this.emitEvent({
        type: 'points',
        pointEvents: [event],
        timestamp: Date.now()
      });
    });
    
    // Subscribe to achievement events and emit them
    achievementSystem.onAchievementUnlocked((event) => {
      this.emitEvent({
        type: 'achievement',
        achievementEvents: [event],
        timestamp: Date.now()
      });
    });
  }

  private generateAIPlayers(count: number): PlayerInfo[] {
    // If player configs are provided, use those
    if (this.config.playerConfigs && this.config.playerConfigs.length > 0) {
      return this.config.playerConfigs.map(config => ({
        id: config.id,
        name: config.name,
        avatar: config.avatar,
        isAI: true,
        chips: this.config.startingChips,
        position: config.position,
        aiModel: config.aiModel || 'gpt-4o' // Default to gpt-4o if not specified
      }));
    }
    
    // Otherwise use default generation
    const botProfiles = [
      { id: 'gambler', name: 'The Gambler', avatar: botGambler },
      { id: 'terminator', name: 'Terminator', avatar: botTerminator },
      { id: 'zenmaster', name: 'Zen Master', avatar: botZenMaster }
    ];
    
    // Additional bot names for when we have more than 3 players
    const additionalNames = [
      'Shark', 'Bluffer', 'Calculator', 'Rock', 'Maniac', 'Trickster'
    ];
    
    const players: PlayerInfo[] = [];
    
    for (let i = 0; i < count; i++) {
      let profile;
      
      if (i < botProfiles.length) {
        // Use the main bot profiles first
        profile = botProfiles[i];
      } else {
        // Create additional bots with random avatars from the main 3
        const avatarIndex = i % botProfiles.length;
        const nameIndex = (i - botProfiles.length) % additionalNames.length;
        profile = {
          id: `bot-${i}`,
          name: additionalNames[nameIndex],
          avatar: botProfiles[avatarIndex].avatar
        };
      }
      
      players.push({
        id: profile.id,
        name: profile.name,
        avatar: profile.avatar,
        isAI: true,
        chips: this.config.startingChips,
        position: i,
        aiModel: 'gpt-4o' // Default to gpt-4o
      });
    }
    
    return players;
  }

  initialize(): void {
    // Use playerConfigs if available, otherwise generate default players
    const aiPlayers = (this.config.playerConfigs && this.config.playerConfigs.length > 0)
      ? this.config.playerConfigs.map(config => ({
          id: config.id,
          name: config.name,
          avatar: config.avatar,
          isAI: true,
          chips: this.config.startingChips,
          position: config.position,
          aiModel: config.aiModel || 'gpt-4o' as const
        }))
      : this.generateAIPlayers(this.config.playerCount);

    aiPlayers.forEach(player => {
      this.players.set(player.id, player);
      this.engine.addPlayer(player.id, player.name, player.chips, player.position);
      this.styleScoring.initializePlayer(player.id);
      this.pointScoring.initializePlayer(player.id);
      achievementSystem.initializePlayer(player.id);
    });
    
    // Initialize AI agents with player configurations
    this.aiManager.initializeWithConfigs(aiPlayers);
  }

  startNewHand(): void {
    // Check if we've reached max hands (skip check if infinite hands mode)
    if (this.config.maxHands !== -1 && this.currentHandNumber >= this.config.maxHands) {
      this.handleGameFinish();
      return;
    }
    
    this.currentHandNumber++;
    this.engine.startNewHand();
    this.aiDecisionHistory.clear(); // Clear current hand decisions
    this.currentHandActionHistory = []; // Clear action history for new hand
    this.handParticipants.clear(); // Clear hand participants
    this.lastAggressivePlayer = null; // Clear last aggressive player
    
    // Increment hand count for point system (awards survival bonuses)
    this.pointScoring.incrementHandCount();
    
    // Initialize all players as participants
    const state = this.engine.getState();
    state.players.forEach(player => {
      if (!player.folded) {
        this.handParticipants.add(player.id);
        // Record hand participation for style scoring
        this.styleScoring.recordHandParticipation(player.id, true);
        // Track hand played for achievements
        achievementSystem.recordHandPlayed(player.id, this.currentHandNumber);
      } else {
        // Record non-participation
        this.styleScoring.recordHandParticipation(player.id, false);
      }
      
      // Update chip points for all players
      this.pointScoring.awardChipPoints(player.id, player.chips);
      
      // Update total points for achievement tracking
      const playerPoints = this.pointScoring.getPlayerPoints(player.id);
      achievementSystem.updateTotalPoints(player.id, playerPoints.totalPoints);
    });
    
    this.emitEvent({
      type: 'phase-change',
      phase: this.engine.getState().phase,
      timestamp: Date.now()
    });
    
    // Start AI turn processing
    this.processNextAITurn();
  }

  setSpeed(speedKey: string): void {
    if (this.gameState === 'playing' && !this.isPaused) {
      console.warn('Cannot change speed during active gameplay');
      return;
    }
    this.speed = GAME_SPEEDS[speedKey] || GAME_SPEEDS.normal;
  }

  // Configuration methods
  setConfig(config: Partial<GameConfig>): void {
    if (this.gameState !== 'setup') {
      console.warn('Cannot change configuration during active game');
      return;
    }
    
    // Validate player count
    if (config.playerCount !== undefined) {
      if (config.playerCount < 2 || config.playerCount > 9) {
        console.warn('Player count must be between 2 and 9');
        config.playerCount = Math.max(2, Math.min(9, config.playerCount));
      }
    }
    
    this.config = { ...this.config, ...config };
    if (config.speed) {
      this.speed = GAME_SPEEDS[config.speed] || GAME_SPEEDS.normal;
    }
    
    // Don't auto-initialize - let startGame handle initialization with proper configs
  }

  getConfig(): GameConfig {
    return { ...this.config };
  }

  getGameState(): GameState {
    return this.gameState;
  }

  startGame(): void {
    if (this.gameState !== 'setup') {
      console.warn('Game already started');
      return;
    }
    
    // Re-initialize players with current config
    this.players.clear();
    this.engine = new PokerEngine();
    
    // Use playerConfigs if available, otherwise generate default players
    const aiPlayers = (this.config.playerConfigs && this.config.playerConfigs.length > 0)
      ? this.config.playerConfigs.map(config => ({
          id: config.id,
          name: config.name,
          avatar: config.avatar,
          isAI: true,
          chips: this.config.startingChips,
          position: config.position,
          aiModel: config.aiModel || 'gpt-4o' as const
        }))
      : this.generateAIPlayers(this.config.playerCount);

    aiPlayers.forEach(player => {
      this.players.set(player.id, player);
      this.engine.addPlayer(player.id, player.name, player.chips, player.position);
      this.styleScoring.initializePlayer(player.id);
      this.pointScoring.initializePlayer(player.id);
      achievementSystem.initializePlayer(player.id);
    });
    
    // Initialize AI agents with player configurations
    this.aiManager.initializeWithConfigs(aiPlayers);
    
    this.gameState = 'playing';
    this.currentHandNumber = 0;
    this.startNewHand();
  }

  stopGame(): void {
    // Stop the game without resetting configuration
    this.gameState = 'setup';
    this.isPaused = true;
    
    // Clear AI agents to stop any pending decisions
    this.aiManager = new AIAgentManager();
    
    // Emit event to signal game stop
    this.emitEvent({
      type: 'hand-complete',
      winners: [],
      timestamp: Date.now()
    });
  }

  clearGame(): void {
    // Stop the game first
    this.stopGame();
    
    // Reset everything
    this.currentHandNumber = 0;
    this.aiDecisionHistory.clear();
    this.fullDecisionHistory = [];
    this.players.clear();
    this.engine = new PokerEngine();
    this.isPaused = false;
    
    // Don't re-initialize automatically - wait for explicit game start
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
    this.processNextAITurn();
  }

  getState() {
    const engineState = this.engine.getState();
    return {
      ...engineState,
      currentAIDecision: this.currentAIDecision,
      aiDecisionHistory: this.aiDecisionHistory
    };
  }

  getEnhancedState() {
    const engineState = this.engine.getState();
    
    // Map players with additional info (avatar, isAI)
    const enhancedPlayers = engineState.players.map(player => {
      const playerInfo = this.players.get(player.id);
      return {
        ...player,
        avatar: playerInfo?.avatar || '',
        isAI: playerInfo?.isAI || false
      };
    });
    
    return {
      ...engineState,
      players: enhancedPlayers,
      currentAIDecision: this.currentAIDecision,
      aiDecisionHistory: this.aiDecisionHistory
    };
  }

  getCurrentPlayer(): Player | null {
    return this.engine.getCurrentPlayer();
  }

  onGameEvent(handler: (event: GameEvent) => void): void {
    this.eventHandlers.push(handler);
  }

  private emitEvent(event: GameEvent): void {
    this.eventHandlers.forEach(handler => handler(event));
  }

  private async processNextAITurn(): Promise<void> {
    if (this.isPaused || this.gameState !== 'playing') return;
    
    // Additional validation to prevent orphaned games
    if (this.players.size === 0) {
      console.warn('No players initialized, stopping AI turns');
      return;
    }

    const currentPlayer = this.engine.getCurrentPlayer();
    if (!currentPlayer) {
      // Hand is complete
      const state = this.engine.getState();
      if (state.isHandComplete) {
        // Calculate style bonuses for winners
        const allStyleBonuses: StyleBonus[] = [];
        if (state.winners && state.winners.length > 0) {
          state.winners.forEach(winner => {
            const winnerPlayer = state.players.find(p => p.id === winner.playerId);
            if (winnerPlayer) {
              const result = {
                winnerId: winner.playerId,
                potSize: winner.amount,
                showdown: state.phase === 'showdown',
                winnerStartingStack: winnerPlayer.chips - winner.amount,
                winnerHoleCards: winnerPlayer.cards,
                loserStacks: state.players
                  .filter(p => p.id !== winner.playerId && this.handParticipants.has(p.id))
                  .map(p => p.chips),
                wasAggressor: this.lastAggressivePlayer === winner.playerId,
                communityCards: state.communityCards
              };
              const bonuses = this.styleScoring.recordHandResult(result);
              allStyleBonuses.push(...bonuses);
              
              // Award point system points
              this.pointScoring.recordHandWin(
                winner.playerId,
                winnerPlayer.cards,
                winner.amount,
                state.phase === 'showdown'
              );
              
              // Track achievement data
              achievementSystem.recordHandWin(
                winner.playerId,
                winnerPlayer.cards,
                winner.amount,
                winner.hand
              );
              
              // Update biggest pot for achievements
              achievementSystem.updateBiggestPot(winner.playerId, winner.amount);
              
              // Check if this was an unconventional win (trash/garbage tier hands)
              const handKey = this.getHandKey(winnerPlayer.cards);
              if (this.isTrashOrGarbageTier(handKey)) {
                achievementSystem.recordUnconventionalWin(winner.playerId);
              }
              
              // Check for bluff (won without showdown and was aggressive)
              if (state.phase !== 'showdown' && this.lastAggressivePlayer === winner.playerId) {
                const opponentCount = state.players.filter(p => 
                  p.id !== winner.playerId && this.handParticipants.has(p.id) && !p.folded
                ).length;
                
                this.pointScoring.recordBluff(winner.playerId, {
                  potSize: winner.amount,
                  opponentCount,
                  isRiver: state.communityCards.length === 5
                });
                
                // Track successful bluff for achievements
                achievementSystem.recordSuccessfulBluff(winner.playerId);
              }
              
              // Check for comeback win
              const stackPercent = (winnerPlayer.chips - winner.amount) / winner.amount * 100;
              this.pointScoring.recordComeback(winner.playerId, stackPercent);
              
              // Track comeback for achievements if stack was < 10%
              if (stackPercent < 10) {
                achievementSystem.recordComeback(winner.playerId);
              }
              
              // Check for David vs Goliath
              const loserStacks = result.loserStacks;
              const biggestLoserStack = Math.max(...loserStacks);
              if (biggestLoserStack > 0) {
                const stackRatio = biggestLoserStack / (winnerPlayer.chips - winner.amount);
                this.pointScoring.recordDavidVsGoliath(winner.playerId, stackRatio);
                
                // Track David vs Goliath for achievements if ratio > 3
                if (stackRatio > 3) {
                  achievementSystem.recordDavidVsGoliath(winner.playerId);
                }
              }
            }
          });
        }
        
        // Check for eliminations
        const eliminatedPlayers: string[] = [];
        state.players.forEach(player => {
          if (player.chips === 0 && !player.folded) {
            eliminatedPlayers.push(player.id);
            
            // Award elimination bonus to winners
            state.winners.forEach(winner => {
              const playerInfo = this.players.get(player.id);
              this.pointScoring.recordElimination(winner.playerId, playerInfo?.name || player.id);
              
              // Track elimination for achievements
              achievementSystem.recordElimination(winner.playerId);
            });
          }
        });
        
        this.emitEvent({
          type: 'hand-complete',
          winners: state.winners,
          styleBonuses: allStyleBonuses,
          timestamp: Date.now()
        });
        
        // Auto-start next hand after delay
        setTimeout(() => {
          if (!this.isPaused && this.gameState === 'playing') {
            // Increment hand number for next hand
            this.currentHandNumber++;
            
            // Clear current hand decisions
            this.aiDecisionHistory.clear();
            this.currentHandActionHistory = [];
            
            // Start new hand
            this.engine.resetForNewHand();
            
            // Emit phase change for new hand
            this.emitEvent({
              type: 'phase-change',
              phase: this.engine.getState().phase,
              timestamp: Date.now()
            });
            
            // Continue with AI turns
            this.processNextAITurn();
          }
        }, this.speed.actionDelay * 2);
      }
      return;
    }

    const playerInfo = this.players.get(currentPlayer.id);
    if (!playerInfo?.isAI) return;

    // Emit thinking event
    this.emitEvent({
      type: 'thinking',
      playerId: currentPlayer.id,
      timestamp: Date.now()
    });

    const validActions = this.engine.getValidActions(currentPlayer.id);
    const gameState = this.engine.getState();
    const agent = this.aiManager.getAgent(currentPlayer.id);

    if (!agent) return;

    try {
      // Get AI decision with action history
      const decision = await agent.makeDecision(currentPlayer, gameState, validActions, this.currentHandActionHistory, this.currentHandNumber);
      this.currentAIDecision = decision;
      this.aiDecisionHistory.set(currentPlayer.id, decision);

      // Store in persistent history
      const playerInfo = this.players.get(currentPlayer.id);
      if (playerInfo) {
        // Always add a new entry for each action
        const historyEntry = {
          handNumber: this.currentHandNumber,
          playerId: currentPlayer.id,
          playerName: playerInfo.name,
          playerCards: [...currentPlayer.cards],
          decision: decision,
          gamePhase: gameState.phase,
          communityCards: [...gameState.communityCards],
          timestamp: Date.now()
        };
        
        this.fullDecisionHistory.push(historyEntry);
        
        // Check for hand misread and emit event
        if (decision.handMisread && decision.misreadDetails) {
          this.emitEvent({
            type: 'hand-misread',
            playerId: currentPlayer.id,
            misread: {
              handNumber: this.currentHandNumber,
              actual: decision.misreadDetails.actual,
              aiThought: decision.misreadDetails.aiThought,
              holeCards: [...currentPlayer.cards],
              boardCards: [...gameState.communityCards],
              phase: gameState.phase,
              severity: decision.misreadDetails.severity,
              modelName: playerInfo.aiModel || 'unknown'
            },
            timestamp: Date.now()
          });
          
          // Apply point penalty for misread
          this.pointScoring.recordHandMisread(
            currentPlayer.id,
            decision.misreadDetails.severity,
            `${decision.misreadDetails.aiThought} (actual: ${decision.misreadDetails.actual})`
          );
        }
        
        // Check for illogical play
        if (decision.illogicalPlay) {
          this.pointScoring.recordIllogicalDecision(
            currentPlayer.id,
            decision.reasoning
          );
        }
      }

      // Execute action
      this.engine.executeAction(currentPlayer.id, decision.action);

      // Track action for style scoring
      this.styleScoring.recordAction(currentPlayer.id, decision.action.type);
      
      // Award points for aggressive actions
      this.pointScoring.recordAggressiveAction(currentPlayer.id, decision.action.type);
      
      // Track last aggressive player
      if (decision.action.type === 'raise' || decision.action.type === 'bet' || decision.action.type === 'all-in') {
        this.lastAggressivePlayer = currentPlayer.id;
        
        // Track all-in for achievements
        if (decision.action.type === 'all-in') {
          achievementSystem.recordAllIn(currentPlayer.id);
        }
      }
      
      // Remove from participants if folded
      if (decision.action.type === 'fold') {
        this.handParticipants.delete(currentPlayer.id);
      }

      // Track action in history
      if (playerInfo) {
        this.currentHandActionHistory.push({
          player: playerInfo.name,
          action: decision.action.type,
          amount: decision.action.amount,
          round: gameState.phase
        });
      }

      // Emit action event
      this.emitEvent({
        type: 'action',
        playerId: currentPlayer.id,
        action: decision.action,
        reasoning: decision.reasoning,
        timestamp: Date.now()
      });

      // Clear the current AI decision after a short delay
      setTimeout(() => {
        this.currentAIDecision = null;
      }, 1000); // Keep visible for 1 second after action

      // Check for phase changes
      const newState = this.engine.getState();
      if (newState.phase !== gameState.phase) {
        this.emitEvent({
          type: 'phase-change',
          phase: newState.phase,
          timestamp: Date.now()
        });
      }

      // Continue to next AI turn
      setTimeout(() => {
        this.processNextAITurn();
      }, this.speed.actionDelay);

    } catch (error) {
      console.error('AI decision error:', error);
      // Fallback to fold
      this.engine.executeAction(currentPlayer.id, { type: 'fold' });
      setTimeout(() => {
        this.processNextAITurn();
      }, this.speed.actionDelay);
    }
  }

  // Manual action for human players (future feature)
  executeAction(playerId: string, action: PlayerAction): void {
    const validActions = this.engine.getValidActions(playerId);
    if (!validActions.includes(action.type)) {
      console.error('Invalid action:', action);
      return;
    }

    this.engine.executeAction(playerId, action);
    
    this.emitEvent({
      type: 'action',
      playerId,
      action,
      timestamp: Date.now()
    });

    // Continue with AI turns
    setTimeout(() => {
      this.processNextAITurn();
    }, this.speed.animationDelay);
  }

  getFullDecisionHistory(): DecisionHistoryEntry[] {
    return [...this.fullDecisionHistory];
  }

  getCurrentHandDecisions(): DecisionHistoryEntry[] {
    return this.fullDecisionHistory.filter(entry => entry.handNumber === this.currentHandNumber);
  }

  getCurrentHandNumber(): number {
    return this.currentHandNumber;
  }

  getCurrentHandActionHistory(): { player: string; action: string; amount?: number; round: GamePhase }[] {
    return [...this.currentHandActionHistory];
  }

  getStyleLeaderboard() {
    const currentChips = new Map<string, number>();
    this.engine.getState().players.forEach(p => {
      currentChips.set(p.id, p.chips);
    });
    return this.styleScoring.getLeaderboard(currentChips);
  }

  getPlayerStyleStats(playerId: string) {
    return this.styleScoring.getPlayerStats(playerId);
  }

  getAllStyleStats() {
    return this.styleScoring.getAllStats();
  }
  
  getPointLeaderboard() {
    return this.pointScoring.getLeaderboard();
  }
  
  getPlayerPoints(playerId: string) {
    return this.pointScoring.getPlayerPoints(playerId);
  }
  
  setTournamentMode(mode: 'STYLE_MASTER' | 'BALANCED' | 'CLASSIC') {
    this.pointScoring.setTournamentMode(mode);
  }
  
  getPlayerAchievements(playerId: string) {
    return achievementSystem.getPlayerAchievements(playerId);
  }
  
  getAchievementProgress(playerId: string) {
    return achievementSystem.getAchievementProgress(playerId);
  }
  
  getAllAchievements() {
    return achievementSystem.getAllAchievements();
  }
  
  getTotalAchievementPoints(playerId: string) {
    return achievementSystem.getTotalAchievementPoints(playerId);
  }
  
  private handleGameFinish(): void {
    this.gameState = 'finished';
    
    // Award final position points based on chip count
    const state = this.engine.getState();
    const playersByChips = [...state.players]
      .filter(p => p.chips > 0)
      .sort((a, b) => b.chips - a.chips);
    
    // Award position points
    playersByChips.forEach((player, index) => {
      this.pointScoring.awardPositionPoints(player.id, index + 1, playersByChips.length);
    });
    
    // Get final point standings
    const pointLeaderboard = this.pointScoring.getLeaderboard();
    
    // Determine winner based on points
    const winner = pointLeaderboard[0];
    const finalWinners = winner ? [{
      playerId: winner.playerId,
      amount: winner.totalPoints,
      hand: `${winner.totalPoints} points (${winner.basePoints} base + ${winner.stylePoints} style - ${winner.penaltyPoints} penalty)`
    }] : [];
    
    // Emit special game-finished event
    this.emitEvent({
      type: 'hand-complete',
      winners: finalWinners,
      timestamp: Date.now()
    });
    
    // Log final results
    console.log('🏆 GAME FINISHED - Final Point Standings:');
    pointLeaderboard.forEach((entry, index) => {
      const player = this.players.get(entry.playerId);
      console.log(`${index + 1}. ${player?.name || entry.playerId}: ${entry.totalPoints} points`);
      console.log(`   Base: ${entry.basePoints}, Style: ${entry.stylePoints}, Penalty: -${entry.penaltyPoints}`);
    });
  }
  
  private getHandKey(cards: string[]): string {
    if (cards.length < 2) return '';
    
    const [card1, card2] = cards;
    const rank1 = card1[0];
    const rank2 = card2[0];
    const suit1 = card1[1];
    const suit2 = card2[1];
    
    // Handle 10 (T)
    const r1 = rank1 === '1' && card1.length === 3 ? 'T' : rank1;
    const r2 = rank2 === '1' && card2.length === 3 ? 'T' : rank2;
    
    // Sort ranks in descending order
    const rankOrder = '23456789TJQKA';
    const idx1 = rankOrder.indexOf(r1);
    const idx2 = rankOrder.indexOf(r2);
    
    if (idx1 > idx2) {
      return r1 + r2 + (suit1 === suit2 ? 's' : 'o');
    } else if (idx2 > idx1) {
      return r2 + r1 + (suit1 === suit2 ? 's' : 'o');
    } else {
      return r1 + r2;
    }
  }
  
  private isTrashOrGarbageTier(handKey: string): boolean {
    const trashHands = ['27o', '28o', '38o', '48o', '23o', '24o', '34o', '25o', '35o', '26o'];
    const garbageHands = ['29o', '39o', '49o', '59o', '36o', '46o', '56o', '37o', '47o', '57o'];
    return trashHands.includes(handKey) || garbageHands.includes(handKey);
  }
}