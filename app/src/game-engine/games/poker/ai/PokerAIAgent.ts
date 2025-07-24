import { BaseAIAgent } from '../../../base/BaseAIAgent';
import { PokerGameState, PokerAction } from '../PokerTypes';
import { IPlayerConfig, IGameDecision } from '../../../core/interfaces';
import { IGameContext } from '../../../core/context';
import { GameAIService } from '../../../services/AIService';
import { AIPromptTemplate, AIModelConfig } from '../../../ai/AIDecisionStructure';
import { PokerAIDataCollector } from './PokerAIDataCollector';

export class PokerAIAgent extends BaseAIAgent<PokerGameState, PokerAction> {
  private aiService: GameAIService;
  private promptTemplate: AIPromptTemplate;
  private modelConfig: AIModelConfig;
  private dataCollector: PokerAIDataCollector;

  constructor(
    config: IPlayerConfig,
    context: IGameContext,
    aiService: GameAIService,
    promptTemplate: AIPromptTemplate,
    modelConfig: AIModelConfig,
    dataCollector: PokerAIDataCollector
  ) {
    super(config, context);
    this.aiService = aiService;
    this.promptTemplate = promptTemplate;
    this.modelConfig = modelConfig;
    this.dataCollector = dataCollector;
  }

  protected collectGameData(state: PokerGameState): any {
    // Use PokerAIDataCollector to collect poker-specific data
    return this.dataCollector.collectNeutralData(state, this.id);
  }

  protected buildPrompt(gameData: any, validActions: PokerAction[]): string {
    let prompt = this.promptTemplate.user
      .replace('{{gameData}}', JSON.stringify(gameData, null, 2))
      .replace('{{validActions}}', JSON.stringify(validActions, null, 2))
      .replace('{{playerId}}', this.id)
      .replace('{{playerName}}', this.name);

    // Replace poker-specific template variables
    if (gameData.gameSpecific?.playerSpecific) {
      const playerSpecific = gameData.gameSpecific.playerSpecific;
      prompt = prompt
        .replace(/\{\{gameData\.gameSpecific\.playerSpecific\.potOdds\}\}/g, 
          (playerSpecific.potOdds * 100).toFixed(1))
        .replace(/\{\{gameData\.gameSpecific\.playerSpecific\.stackToPotRatio\}\}/g,
          playerSpecific.stackToPotRatio.toFixed(2))
        .replace(/\{\{gameData\.gameSpecific\.playerSpecific\.positionName\}\}/g,
          playerSpecific.positionName)
        .replace(/\{\{gameData\.gameSpecific\.playerSpecific\.positionType\}\}/g,
          playerSpecific.positionType)
        .replace(/\{\{gameData\.gameSpecific\.playerSpecific\.amountToCall\}\}/g,
          playerSpecific.amountToCall.toString());
    }

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
    const response = await this.aiService.makeRequest({
      model: this.modelConfig.id,
      systemPrompt,
      userPrompt,
      temperature: this.modelConfig.temperature || 0.7,
      maxTokens: this.modelConfig.maxTokens || 1000,
      responseFormat: this.promptTemplate.responseFormat || 'json'
    });

    return this.aiService.parseAIResponse(response);
  }

  protected parseAIResponse(response: any, validActions: PokerAction[]): PokerAction {
    // Pass the full response object to validateAction
    const action = this.aiService.validateAction(response, validActions);
    
    if (!action) {
      console.error('AI response validation failed:', {
        response,
        validActionTypes: validActions.map(a => a.type),
        playerId: this.id,
        playerName: this.name
      });
      throw new Error(`AI returned invalid action. Response: ${JSON.stringify(response?.action || response)}`);
    }

    // If the validated action needs an amount, use it from the response
    if ((action.type === 'bet' || action.type === 'raise' || action.type === 'call') && response.amount !== undefined) {
      action.amount = response.amount;
    }

    return action;
  }

  protected makeFallbackDecision(state: PokerGameState, validActions: PokerAction[]): IGameDecision {
    // Personality-based fallback for poker
    const hasCheck = validActions.some(a => a.type === 'check');
    const hasCall = validActions.some(a => a.type === 'call');
    const hasFold = validActions.some(a => a.type === 'fold');
    
    let selectedAction: PokerAction;
    
    if (this.personality.riskTolerance < 0.3 && hasFold) {
      // Conservative: prefer folding when risk tolerance is low
      selectedAction = validActions.find(a => a.type === 'fold')!;
    } else if (this.personality.aggressiveness > 0.7 && validActions.some(a => a.type === 'raise' || a.type === 'bet')) {
      // Aggressive: prefer raising/betting
      selectedAction = validActions.find(a => a.type === 'raise' || a.type === 'bet')!;
    } else if (hasCheck) {
      // Default to check if available
      selectedAction = validActions.find(a => a.type === 'check')!;
    } else if (hasCall) {
      // Call if no check available
      selectedAction = validActions.find(a => a.type === 'call')!;
    } else {
      // Fallback to first valid action
      selectedAction = validActions[0];
    }

    return this.createDecision(
      selectedAction,
      0.5,
      'Fallback decision based on personality'
    );
  }
}