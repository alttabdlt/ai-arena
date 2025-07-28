import { 
  IGameAIAgent, 
  IGameState, 
  IGameAction, 
  IGameDecision,
  IAIPersonality,
  IPlayerConfig
} from '../core/interfaces';
import { IGameContext } from '../core/context';

export interface AIServiceResponse {
  action: any;
  confidence: number;
  reasoning: string;
  metadata?: Record<string, any>;
}

export abstract class BaseAIAgent<TState extends IGameState, TAction extends IGameAction> 
  implements IGameAIAgent<TState, TAction> {
  
  public readonly id: string;
  public readonly name: string;
  public readonly model: string;
  
  protected context: IGameContext;
  protected config: IPlayerConfig;
  protected personality: IAIPersonality;
  protected decisionHistory: IGameDecision[] = [];

  constructor(config: IPlayerConfig, context: IGameContext) {
    this.id = config.id;
    this.name = config.name;
    this.model = config.aiModel || 'default';
    this.config = config;
    this.context = context;
    this.personality = this.generatePersonality();
  }

  async makeDecision(state: TState, validActions: TAction[]): Promise<IGameDecision> {
    console.log(`${this.constructor.name}.makeDecision called for player:`, this.id);
    if (validActions.length === 0) {
      throw new Error('No valid actions available');
    }

    if (validActions.length === 1) {
      return this.createDecision(validActions[0], 1.0, 'Only one valid action available');
    }

    try {
      const gameData = this.collectGameData(state);
      const aiResponse = await this.callAIService(gameData, validActions);
      
      const selectedAction = this.parseAIResponse(aiResponse, validActions);
      const decision = this.createDecision(
        selectedAction,
        aiResponse.confidence,
        aiResponse.reasoning
      );

      this.decisionHistory.push(decision);
      
      return decision;
    } catch (error) {
      this.context.logger.warn('AI decision failed, using fallback', {
        playerId: this.id,
        error
      });
      
      return this.makeFallbackDecision(state, validActions);
    }
  }

  getPersonality(): IAIPersonality {
    return { ...this.personality };
  }

  protected createDecision(action: TAction, confidence: number, reasoning: string): IGameDecision {
    return {
      action,
      confidence: Math.max(0, Math.min(1, confidence)),
      reasoning,
      metadata: {
        agentId: this.id,
        model: this.model,
        timestamp: new Date().toISOString()
      }
    };
  }

  protected async callAIService(gameData: any, validActions: TAction[]): Promise<AIServiceResponse> {
    const prompt = this.buildPrompt(gameData, validActions);
    const systemPrompt = this.buildSystemPrompt();
    
    try {
      const response = await this.makeAIRequest(systemPrompt, prompt);
      return this.validateAIResponse(response);
    } catch (error: any) {
      console.error('AI service call failed:', {
        error,
        message: error.message,
        stack: error.stack
      });
      // Preserve the original error message
      throw error;
    }
  }

  protected buildSystemPrompt(): string {
    return `You are playing a game. Your responses must be in valid JSON format with the following structure:
{
  "action": <action object matching one of the valid actions>,
  "confidence": <number between 0 and 1>,
  "reasoning": "<brief explanation of your decision>"
}

Play strategically but also consider entertainment value. Your personality traits:
- Aggressiveness: ${this.personality.aggressiveness}
- Risk Tolerance: ${this.personality.riskTolerance}
- Bluffing Tendency: ${this.personality.bluffingTendency}
- Adaptability: ${this.personality.adaptability}`;
  }

  protected validateAIResponse(response: any): AIServiceResponse {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid AI response format');
    }

    if (!response.action || typeof response.confidence !== 'number' || !response.reasoning) {
      throw new Error('Missing required fields in AI response');
    }

    return response;
  }

  protected generatePersonality(): IAIPersonality {
    const seed = this.id + this.model;
    const random = this.seededRandom(seed);
    
    return {
      aggressiveness: random(),
      riskTolerance: random(),
      bluffingTendency: random(),
      adaptability: random(),
      metadata: {
        seed,
        model: this.model
      }
    };
  }

  protected seededRandom(seed: string): () => number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return () => {
      hash = Math.sin(hash) * 10000;
      return hash - Math.floor(hash);
    };
  }

  protected abstract collectGameData(state: TState): any;
  protected abstract buildPrompt(gameData: any, validActions: TAction[]): string;
  protected abstract parseAIResponse(response: AIServiceResponse, validActions: TAction[]): TAction;
  protected abstract makeFallbackDecision(state: TState, validActions: TAction[]): IGameDecision;
  protected abstract makeAIRequest(systemPrompt: string, userPrompt: string): Promise<any>;
}