import { BaseAIAgent } from '../../../base/BaseAIAgent';
import { Connect4GameState, Connect4GameAction } from '../Connect4Types';
import { IPlayerConfig, IGameDecision } from '../../../core/interfaces';
import { IGameContext } from '../../../core/context';
import { GameAIService } from '../../../services/AIService';
import { AIPromptTemplate, AIModelConfig } from '../../../ai/AIDecisionStructure';
import { Connect4AIDataCollector } from './Connect4AIDataCollector';

export class Connect4AIAgent extends BaseAIAgent<Connect4GameState, Connect4GameAction> {
  private aiService: GameAIService;
  private promptTemplate: AIPromptTemplate;
  private modelConfig: AIModelConfig;
  private dataCollector: Connect4AIDataCollector;

  constructor(
    config: IPlayerConfig,
    context: IGameContext,
    aiService: GameAIService,
    promptTemplate: AIPromptTemplate,
    modelConfig: AIModelConfig,
    dataCollector: Connect4AIDataCollector
  ) {
    super(config, context);
    this.aiService = aiService;
    this.promptTemplate = promptTemplate;
    this.modelConfig = modelConfig;
    this.dataCollector = dataCollector;
  }

  protected collectGameData(state: Connect4GameState): any {
    console.log('Connect4AIAgent.collectGameData called for player:', this.id);
    console.log('Game state:', { 
      hasState: !!state,
      gamePhase: state?.gamePhase,
      boardExists: !!state?.board,
      playersCount: state?.players?.length 
    });
    // Use Connect4AIDataCollector to collect game-specific data
    const data = this.dataCollector.collectNeutralData(state, this.id);
    console.log('Connect4AIAgent: Collected data keys:', Object.keys(data));
    return data;
  }

  protected buildPrompt(gameData: any, validActions: Connect4GameAction[]): string {
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
      .replace('{{modelName}}', this.modelConfig.name)
      .replace('{{aiStrategy}}', this.config.aiStrategy || 'balanced');
  }

  protected async makeAIRequest(systemPrompt: string, userPrompt: string): Promise<any> {
    console.log('=== Connect4AIAgent.makeAIRequest called ===');
    console.log('Agent class:', this.constructor.name);
    console.log('Model config:', {
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
      console.error('Connect4AIAgent.makeAIRequest failed:', {
        error,
        message: error?.message,
        stack: error?.stack,
        modelId: this.modelConfig.id
      });
      throw error;
    }
  }

  protected parseAIResponse(response: any, validActions: Connect4GameAction[]): Connect4GameAction {
    console.log('Connect4AIAgent.parseAIResponse:', {
      hasResponse: !!response,
      responseAction: response?.action,
      validActionsCount: validActions.length,
      validActionTypes: validActions.map(a => a.type)
    });
    
    // Validate that the response contains a valid column
    if (!response.action || typeof response.action.column !== 'number') {
      throw new Error('AI response missing column selection');
    }

    // Find the matching action in validActions
    const selectedAction = validActions.find(action => 
      action.type === 'place' && action.column === response.action.column
    );
    
    if (!selectedAction) {
      console.error('AI returned invalid action:', {
        response,
        validColumns: validActions.filter(a => a.type === 'place').map(a => a.column)
      });
      throw new Error(`AI selected invalid column: ${response.action.column}`);
    }
    
    console.log('Successfully validated action:', selectedAction);
    return selectedAction;
  }

  protected makeFallbackDecision(state: Connect4GameState, validActions: Connect4GameAction[]): IGameDecision {
    // Select a column based on personality
    const placeActions = validActions.filter(a => a.type === 'place');
    
    if (placeActions.length === 0) {
      // No valid moves, must be a timeout
      return this.createDecision(
        validActions[0],
        0.5,
        'No valid columns available'
      );
    }

    // Prefer center columns for balanced play (8x8 board has two center columns)
    const centerColumns = [3, 4];
    const centerActions = placeActions.filter(a => centerColumns.includes(a.column));
    
    if (centerActions.length > 0) {
      // Randomly choose between available center columns
      const randomIndex = Math.floor(Math.random() * centerActions.length);
      const centerAction = centerActions[randomIndex];
      return this.createDecision(
        centerAction,
        0.7,
        `Fallback: choosing center column ${centerAction.column + 1}`
      );
    }

    // Otherwise pick based on personality
    const personalityBasedIndex = Math.floor(
      (this.personality.riskTolerance + this.personality.aggressiveness) / 2 * placeActions.length
    );
    
    const index = Math.min(personalityBasedIndex, placeActions.length - 1);
    const action = placeActions[index];

    return this.createDecision(
      action,
      0.5,
      'Fallback decision based on personality'
    );
  }
}