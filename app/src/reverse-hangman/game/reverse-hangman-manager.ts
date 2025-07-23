import { ReverseHangmanEngine, PromptPair, ReverseHangmanState } from '../engine/reverse-hangman-engine';
import { getRandomPrompt } from '../engine/prompt-database';
import { PromptMatcher } from '../engine/prompt-matcher';
import { ReverseHangmanAIDataCollector } from '../ai/ai-data-collector';
import { ReverseHangmanScoringSystem, ScoreResult } from '../scoring/scoring-system';
import { ReverseHangmanAIAgentManager } from '../ai/ai-agent-manager';
import { ReverseHangmanAIDecision } from '../ai/ai-decision-structure';
import { AIAgentConfig } from '../ai/ai-agents';

export interface ReverseHangmanConfig {
  maxRounds: number;
  thinkingTime: number; // milliseconds
  playerConfigs: AIAgentConfig[];
}

export interface ReverseHangmanRound {
  roundNumber: number;
  promptPair: PromptPair;
  gameState: ReverseHangmanState;
  score: ScoreResult;
}

export interface ReverseHangmanTournament {
  id: string;
  config: ReverseHangmanConfig;
  rounds: ReverseHangmanRound[];
  totalScore: number;
  status: 'setup' | 'playing' | 'completed';
  startTime: Date;
  endTime?: Date;
}

export type AnimationPhase = 
  | 'idle'
  | 'selecting'
  | 'sending' 
  | 'processing'
  | 'generating'
  | 'revealing'
  | 'complete';

export class ReverseHangmanGameManager {
  private tournament: ReverseHangmanTournament;
  private currentEngine: ReverseHangmanEngine | null = null;
  private matcher: PromptMatcher;
  private eventHandlers: Map<string, ((data: any) => void)[]> = new Map();
  private aiAgentManager: ReverseHangmanAIAgentManager;
  private decisionHistory: Map<string, ReverseHangmanAIDecision[]> = new Map();
  private animationPhase: AnimationPhase = 'idle';
  private selectedPromptPair: PromptPair | null = null;

  constructor(config: ReverseHangmanConfig) {
    this.tournament = {
      id: `rh-tournament-${Date.now()}`,
      config,
      rounds: [],
      totalScore: 0,
      status: 'setup',
      startTime: new Date()
    };
    this.matcher = new PromptMatcher();
    this.aiAgentManager = new ReverseHangmanAIAgentManager(config.playerConfigs);
  }

  on(event: string, handler: (data: any) => void) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  private emit(event: string, data: any) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  async startTournament() {
    this.tournament.status = 'playing';
    this.emit('tournament:start', { tournament: this.tournament });
  }

  async startNewRound(difficulty?: PromptPair['difficulty']) {
    if (this.tournament.rounds.length >= this.tournament.config.maxRounds) {
      await this.endTournament();
      return;
    }

    // If no difficulty specified, default to medium
    const selectedDifficulty = difficulty || 'medium';

    // Start animation sequence
    await this.runPromptGenerationAnimation(selectedDifficulty);
  }

  private async runPromptGenerationAnimation(difficulty: PromptPair['difficulty']) {
    // Phase 1: Selecting prompt
    this.animationPhase = 'selecting';
    this.emit('animation:phase', { phase: 'selecting' });
    await this.delay(2000);

    // Actually select the prompt (hidden from players)
    this.selectedPromptPair = getRandomPrompt(difficulty);
    
    // Phase 2: Sending to AI
    this.animationPhase = 'sending';
    this.emit('animation:phase', { phase: 'sending' });
    await this.delay(1500);

    // Phase 3: AI Processing
    this.animationPhase = 'processing';
    this.emit('animation:phase', { phase: 'processing' });
    await this.delay(2500);

    // Phase 4: Generating output
    this.animationPhase = 'generating';
    this.emit('animation:phase', { phase: 'generating' });
    await this.delay(1500);

    // Phase 5: Revealing output
    this.animationPhase = 'revealing';
    this.emit('animation:phase', { 
      phase: 'revealing',
      output: this.selectedPromptPair.output
    });
    await this.delay(3000); // Time for typewriter effect

    // Phase 6: Complete - start the game
    this.animationPhase = 'complete';
    this.emit('animation:phase', { phase: 'complete' });
    
    // Initialize the game engine with the selected prompt
    this.currentEngine = new ReverseHangmanEngine(this.selectedPromptPair);

    // Select one random agent for this entire round
    const selectedAgentId = this.aiAgentManager.selectRandomAgentForRound();
    const selectedAgent = this.tournament.config.playerConfigs.find(p => p.id === selectedAgentId);
    
    this.emit('round:start', {
      roundNumber: this.tournament.rounds.length + 1,
      promptPair: this.selectedPromptPair,
      gameState: this.currentEngine.getState(),
      selectedAgent: selectedAgent
    });
    
    // Start AI turn processing after a short delay
    setTimeout(() => {
      this.animationPhase = 'idle';
      this.processAITurn();
    }, 1000);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async processAIGuess(guess: string): Promise<void> {
    if (!this.currentEngine) {
      throw new Error('No active game');
    }

    const validation = ReverseHangmanAIDataCollector.validateGuess(guess);
    if (!validation.valid) {
      this.emit('guess:invalid', { error: validation.error });
      return;
    }

    const attempt = this.currentEngine.makeGuess(guess);
    const gameState = this.currentEngine.getState();

    this.emit('guess:made', {
      attempt,
      gameState,
      attemptsRemaining: this.currentEngine.getAttemptsRemaining()
    });

    if (this.currentEngine.isGameOver()) {
      await this.endRound();
    } else {
      // Continue with next AI turn after a delay
      setTimeout(() => this.processAITurn(), 1000);
    }
  }

  async processAITurn(): Promise<void> {
    if (!this.currentEngine || this.tournament.status !== 'playing') return;
    
    const gameState = this.currentEngine.getState();
    
    if (gameState.phase !== 'playing') {
      return;
    }
    
    try {
      // Get AI decision from agent manager
      const { agentId, agentName, decision } = await this.aiAgentManager.getNextDecision(
        gameState,
        {
          currentRound: this.tournament.rounds.length + 1,
          totalRounds: this.tournament.config.maxRounds,
          currentScore: this.tournament.totalScore
        }
      );
      
      this.emit('ai:thinking', {
        agentId,
        agentName,
        model: decision.analysis?.output_type || 'unknown'
      });
      
      // Simulate thinking time
      await new Promise(resolve => setTimeout(resolve, this.tournament.config.thinkingTime));
      
      // Store decision in history
      if (!this.decisionHistory.has(agentId)) {
        this.decisionHistory.set(agentId, []);
      }
      this.decisionHistory.get(agentId)!.push(decision);
      
      this.emit('ai:decision', {
        agentId,
        agentName,
        decision,
        reasoning: decision.reasoning
      });
      
      // Process the guess
      await this.processAIGuess(decision.prompt_guess);
      
    } catch (error) {
      console.error('AI decision error:', error);
      this.emit('ai:error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async endRound() {
    if (!this.currentEngine) return;

    const gameState = this.currentEngine.getState();
    const score = ReverseHangmanScoringSystem.calculateScore(gameState);

    const round: ReverseHangmanRound = {
      roundNumber: this.tournament.rounds.length + 1,
      promptPair: gameState.currentPromptPair,
      gameState,
      score
    };

    this.tournament.rounds.push(round);
    this.tournament.totalScore += score.totalScore;

    this.emit('round:end', {
      round,
      revealedPrompt: this.currentEngine.getRevealedPrompt(),
      totalScore: this.tournament.totalScore
    });

    this.currentEngine = null;
    
    // Release the agent lock for next round
    this.aiAgentManager.releaseCurrentAgent();

    if (this.tournament.rounds.length < this.tournament.config.maxRounds) {
      // Emit event to request difficulty selection for next round
      this.emit('round:request-difficulty', {
        nextRoundNumber: this.tournament.rounds.length + 2
      });
    } else {
      await this.endTournament();
    }
  }

  private async endTournament() {
    this.tournament.status = 'completed';
    this.tournament.endTime = new Date();

    const averageScore = Math.round(this.tournament.totalScore / this.tournament.rounds.length);
    const successRate = this.tournament.rounds.filter(r => r.gameState.phase === 'won').length / this.tournament.rounds.length;

    this.emit('tournament:end', {
      tournament: this.tournament,
      stats: {
        totalScore: this.tournament.totalScore,
        averageScore,
        successRate,
        roundsPlayed: this.tournament.rounds.length
      }
    });
  }

  getTournament(): ReverseHangmanTournament {
    return { ...this.tournament };
  }

  getCurrentGameState(): ReverseHangmanState | null {
    return this.currentEngine?.getState() || null;
  }

  getAIData(): any {
    if (!this.currentEngine) return null;
    return ReverseHangmanAIDataCollector.collectNeutralData(this.currentEngine.getState());
  }
  
  getDecisionHistory(playerId?: string): ReverseHangmanAIDecision[] {
    if (playerId) {
      return this.decisionHistory.get(playerId) || [];
    }
    
    const allDecisions: ReverseHangmanAIDecision[] = [];
    this.decisionHistory.forEach(decisions => {
      allDecisions.push(...decisions);
    });
    return allDecisions;
  }
  
  getCurrentAgent(): AIAgentConfig | null {
    const agent = this.aiAgentManager.getCurrentAgent();
    if (!agent) return null;
    
    // Find the config for this agent
    return this.tournament.config.playerConfigs.find(
      config => config.id === agent.getId()
    ) || null;
  }
}