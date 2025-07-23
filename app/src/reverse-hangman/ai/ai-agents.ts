import { ReverseHangmanState } from '../engine/reverse-hangman-engine';
import { ReverseHangmanAIDataCollector } from './ai-data-collector';
import { ReverseHangmanAIDecision, parseAIResponse } from './ai-decision-structure';
import { ReverseHangmanAIApiService, ReverseHangmanGameStateAPI, ReverseHangmanPlayerStateAPI } from './ai-api-service';

export interface AIAgentConfig {
  id: string;
  name: string;
  model: string;
  strategy?: string;
  personality?: string;
  avatar?: string;
}

export abstract class BaseReverseHangmanAIAgent {
  protected config: AIAgentConfig;
  protected decisionHistory: ReverseHangmanAIDecision[] = [];

  constructor(config: AIAgentConfig) {
    this.config = config;
  }

  getId(): string {
    return this.config.id;
  }

  getName(): string {
    return this.config.name;
  }

  getModel(): string {
    return this.config.model;
  }

  getStrategy(): string {
    return this.config.strategy || 'Default strategy';
  }

  getAvatar(): string | undefined {
    return this.config.avatar;
  }

  async makeDecision(
    gameState: ReverseHangmanState,
    tournamentInfo?: { currentRound: number; totalRounds: number; currentScore: number }
  ): Promise<ReverseHangmanAIDecision> {
    try {
      // Collect game data in neutral format
      const gameData = ReverseHangmanAIDataCollector.collectNeutralData(gameState);
      
      // Convert to API format
      const apiGameState: ReverseHangmanGameStateAPI = {
        game_type: gameData.game_type,
        output_shown: gameData.output_shown,
        constraints: gameData.constraints,
        previous_guesses: gameData.previous_guesses,
        game_phase: gameData.game_phase,
        time_elapsed_seconds: gameData.time_elapsed_seconds
      };

      const apiPlayerState: ReverseHangmanPlayerStateAPI = {
        player_id: this.config.id,
        current_round: tournamentInfo?.currentRound || 1,
        total_rounds: tournamentInfo?.totalRounds || 1,
        current_score: tournamentInfo?.currentScore || 0,
        rounds_won: 0, // This could be tracked if needed
        rounds_lost: 0  // This could be tracked if needed
      };

      // Call AI API
      const startTime = Date.now();
      const apiDecision = await ReverseHangmanAIApiService.getAIDecision(
        this.config.id,
        this.config.model,
        apiGameState,
        apiPlayerState
      );
      const thinkingTime = Date.now() - startTime;

      // Parse and validate response
      const decision = parseAIResponse({
        decision: apiDecision,
        thinking_time_ms: thinkingTime,
        model: this.config.model
      });

      if (!decision) {
        throw new Error('Failed to parse AI response');
      }

      // Store in history
      this.decisionHistory.push(decision);

      return decision;
    } catch (error) {
      console.error(`AI Agent ${this.config.name} error:`, error);
      return this.generateFallbackDecision(gameState);
    }
  }

  protected abstract generateFallbackDecision(gameState: ReverseHangmanState): ReverseHangmanAIDecision;

  getDecisionHistory(): ReverseHangmanAIDecision[] {
    return [...this.decisionHistory];
  }

  reset(): void {
    this.decisionHistory = [];
  }
}

export class DetectiveAIAgent extends BaseReverseHangmanAIAgent {
  protected generateFallbackDecision(gameState: ReverseHangmanState): ReverseHangmanAIDecision {
    const output = gameState.currentPromptPair.output.toLowerCase();
    
    // Detective approach - look for clues
    const clues = [];
    if (output.includes('step')) clues.push('instructional content');
    if (output.includes('explain')) clues.push('explanatory content');
    if (output.includes('\n')) clues.push('formatted text');
    
    return {
      action: 'guess_prompt',
      prompt_guess: 'Create a guide explaining the process described',
      confidence: 0.5,
      reasoning: `As a detective, I've identified these clues: ${clues.join(', ')}. This suggests an instructional or explanatory prompt.`,
      analysis: {
        output_type: 'guide',
        key_indicators: clues,
        word_count_estimate: 8,
        difficulty_assessment: gameState.currentPromptPair.difficulty,
        pattern_observations: ['Structured content', 'Clear explanation']
      }
    };
  }
}

export class AnalystAIAgent extends BaseReverseHangmanAIAgent {
  protected generateFallbackDecision(gameState: ReverseHangmanState): ReverseHangmanAIDecision {
    const output = gameState.currentPromptPair.output;
    const wordCount = output.split(/\s+/).length;
    const hasLineBreaks = output.includes('\n');
    
    return {
      action: 'guess_prompt',
      prompt_guess: 'Analyze and explain the given topic in detail',
      confidence: 0.6,
      reasoning: `Analyzing the output structure: ${wordCount} words, ${hasLineBreaks ? 'formatted' : 'continuous'} text. This appears to be analytical content.`,
      analysis: {
        output_type: 'analysis',
        key_indicators: ['structured format', 'detailed content'],
        word_count_estimate: 8,
        difficulty_assessment: gameState.currentPromptPair.difficulty,
        pattern_observations: [`Word count: ${wordCount}`, hasLineBreaks ? 'Multiple paragraphs' : 'Single paragraph']
      }
    };
  }
}

export class CreativeAIAgent extends BaseReverseHangmanAIAgent {
  protected generateFallbackDecision(gameState: ReverseHangmanState): ReverseHangmanAIDecision {
    const output = gameState.currentPromptPair.output;
    const isCreative = output.includes('imagine') || output.includes('story') || output.includes('poem');
    
    return {
      action: 'guess_prompt',
      prompt_guess: 'Write a creative piece about the described scenario',
      confidence: 0.55,
      reasoning: `My creative instincts suggest this is ${isCreative ? 'definitely' : 'possibly'} creative writing based on the expressive language used.`,
      analysis: {
        output_type: 'creative',
        key_indicators: ['expressive language', 'narrative elements'],
        word_count_estimate: 8,
        difficulty_assessment: gameState.currentPromptPair.difficulty,
        pattern_observations: ['Creative expression', 'Imaginative content']
      }
    };
  }
}

export class GenericAIAgent extends BaseReverseHangmanAIAgent {
  protected generateFallbackDecision(gameState: ReverseHangmanState): ReverseHangmanAIDecision {
    return {
      action: 'guess_prompt',
      prompt_guess: 'Generate content based on the given requirements',
      confidence: 0.4,
      reasoning: 'Taking a general approach to guess the prompt based on the output format.',
      analysis: {
        output_type: 'general',
        key_indicators: ['standard format'],
        word_count_estimate: 7,
        difficulty_assessment: gameState.currentPromptPair.difficulty,
        pattern_observations: ['Generic content structure']
      }
    };
  }
}

export function createReverseHangmanAIAgent(config: AIAgentConfig): BaseReverseHangmanAIAgent {
  // Match agent type based on personality or strategy
  const strategy = (config.strategy || '').toLowerCase();
  const personality = (config.personality || '').toLowerCase();
  
  if (strategy.includes('detective') || personality.includes('sherlock')) {
    return new DetectiveAIAgent(config);
  } else if (strategy.includes('analys') || strategy.includes('data')) {
    return new AnalystAIAgent(config);
  } else if (strategy.includes('creative') || strategy.includes('artist')) {
    return new CreativeAIAgent(config);
  } else {
    return new GenericAIAgent(config);
  }
}