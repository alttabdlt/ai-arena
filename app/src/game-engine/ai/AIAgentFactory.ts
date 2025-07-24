import { 
  IGameState, 
  IGameAction, 
  IGameAIAgent,
  IPlayerConfig,
  IGameDecision
} from '../core/interfaces';
import { IGameContext } from '../core/context';
import { BaseAIAgent } from '../base/BaseAIAgent';
import { GameAIService } from '../services/AIService';
import { AIModelConfig, AIPromptTemplate, StandardAIResponse } from './AIDecisionStructure';

export interface AIAgentFactoryConfig {
  models: Map<string, AIModelConfig>;
  defaultModel: string;
  aiService: GameAIService;
  promptTemplates?: Map<string, AIPromptTemplate>;
}

export abstract class GameAIAgentFactory<TState extends IGameState, TAction extends IGameAction> {
  protected config: AIAgentFactoryConfig;
  protected context: IGameContext;

  constructor(config: AIAgentFactoryConfig, context: IGameContext) {
    this.config = config;
    this.context = context;
  }

  createAgent(playerConfig: IPlayerConfig): IGameAIAgent<TState, TAction> {
    const modelName = playerConfig.aiModel || this.config.defaultModel;
    const modelConfig = this.config.models.get(modelName);
    
    if (!modelConfig) {
      throw new Error(`Unknown AI model: ${modelName}`);
    }

    return this.createModelSpecificAgent(playerConfig, modelConfig);
  }

  abstract createModelSpecificAgent(
    playerConfig: IPlayerConfig,
    modelConfig: AIModelConfig
  ): IGameAIAgent<TState, TAction>;

  abstract getPromptTemplate(modelConfig: AIModelConfig): AIPromptTemplate;
}

export class UniversalAIAgent<TState extends IGameState, TAction extends IGameAction> 
  extends BaseAIAgent<TState, TAction> {
  
  private aiService: GameAIService;
  private promptTemplate: AIPromptTemplate;
  private modelConfig: AIModelConfig;

  constructor(
    config: IPlayerConfig,
    context: IGameContext,
    aiService: GameAIService,
    promptTemplate: AIPromptTemplate,
    modelConfig: AIModelConfig
  ) {
    super(config, context);
    this.aiService = aiService;
    this.promptTemplate = promptTemplate;
    this.modelConfig = modelConfig;
  }

  protected collectGameData(state: TState): any {
    return this.aiService.collectNeutralGameData(state, this.id);
  }

  protected buildPrompt(gameData: any, validActions: TAction[]): string {
    let prompt = this.promptTemplate.user
      .replace('{{gameData}}', JSON.stringify(gameData, null, 2))
      .replace('{{validActions}}', JSON.stringify(validActions, null, 2))
      .replace('{{playerId}}', this.id)
      .replace('{{playerName}}', this.name);

    if (this.promptTemplate.examples && this.promptTemplate.examples.length > 0) {
      const examplesText = this.promptTemplate.examples
        .map(ex => `Input: ${JSON.stringify(ex.input)}\nOutput: ${JSON.stringify(ex.output)}`)
        .join('\n\n');
      
      prompt += `\n\nExamples:\n${examplesText}`;
    }

    return prompt;
  }

  protected buildSystemPrompt(): string {
    return this.promptTemplate.system
      .replace('{{personality}}', JSON.stringify(this.personality))
      .replace('{{modelName}}', this.modelConfig.name);
  }

  protected async makeAIRequest(systemPrompt: string, userPrompt: string): Promise<any> {
    console.log('UniversalAIAgent.makeAIRequest called with:', {
      model: this.modelConfig.id,
      modelName: this.modelConfig.name,
      promptLength: userPrompt.length,
      hasAIService: !!this.aiService
    });
    
    try {
      const response = await this.aiService.makeRequest({
        model: this.modelConfig.id,
        systemPrompt,
        userPrompt,
        temperature: this.modelConfig.temperature || 0.7,
        maxTokens: this.modelConfig.maxTokens || 1000,
        responseFormat: this.promptTemplate.responseFormat || 'json'
      });

      console.log('AI Service response received:', {
        hasResponse: !!response,
        responseType: typeof response,
        responseKeys: response ? Object.keys(response) : []
      });

      return this.aiService.parseAIResponse(response);
    } catch (error: any) {
      console.error('UniversalAIAgent.makeAIRequest failed:', {
        error,
        message: error?.message,
        stack: error?.stack,
        modelId: this.modelConfig.id
      });
      throw error;
    }
  }

  protected parseAIResponse(response: any, validActions: TAction[]): TAction {
    console.log('UniversalAIAgent.parseAIResponse:', {
      hasResponse: !!response,
      responseAction: response?.action,
      validActionsCount: validActions.length,
      validActionTypes: validActions.map(a => (a as any).type || 'unknown')
    });
    
    const action = this.aiService.validateAction(response, validActions);
    
    if (!action) {
      console.error('AI returned invalid action:', {
        response,
        validActions: validActions.map(a => ({ type: (a as any).type, amount: (a as any).amount }))
      });
      throw new Error('AI returned invalid action');
    }

    console.log('Successfully validated action:', action);
    return action;
  }

  protected makeFallbackDecision(state: TState, validActions: TAction[]): IGameDecision {
    const personalityBasedIndex = Math.floor(
      (this.personality.riskTolerance + this.personality.aggressiveness) / 2 * validActions.length
    );
    
    const index = Math.min(personalityBasedIndex, validActions.length - 1);
    const action = validActions[index];

    return this.createDecision(
      action,
      0.5,
      'Fallback decision based on personality'
    );
  }
}

export class DefaultAIAgentFactory<TState extends IGameState, TAction extends IGameAction> 
  extends GameAIAgentFactory<TState, TAction> {
  
  createModelSpecificAgent(
    playerConfig: IPlayerConfig,
    modelConfig: AIModelConfig
  ): IGameAIAgent<TState, TAction> {
    const promptTemplate = this.getPromptTemplate(modelConfig);
    
    return new UniversalAIAgent<TState, TAction>(
      playerConfig,
      this.context,
      this.config.aiService,
      promptTemplate,
      modelConfig
    );
  }

  getPromptTemplate(modelConfig: AIModelConfig): AIPromptTemplate {
    const customTemplate = this.config.promptTemplates?.get(modelConfig.id);
    if (customTemplate) {
      return customTemplate;
    }

    return {
      system: `You are an AI player in a game. Your model is {{modelName}}.
Your personality traits are: {{personality}}

You must respond with a valid JSON object containing:
- action: one of the valid actions provided
- confidence: a number between 0 and 1
- reasoning: brief explanation of your decision

Play strategically while considering entertainment value.`,
      
      user: `Current game state:
{{gameData}}

Valid actions you can take:
{{validActions}}

Choose your action wisely.`,
      
      responseFormat: 'json'
    };
  }
}