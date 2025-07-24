import { GameAIAgentFactory, DefaultAIAgentFactory, AIAgentFactoryConfig } from '../../../ai/AIAgentFactory';
import { PokerGameState, PokerAction } from '../PokerTypes';
import { IGameAIAgent, IPlayerConfig } from '../../../core/interfaces';
import { IGameContext } from '../../../core/context';
import { AIModelConfig, AIPromptTemplate } from '../../../ai/AIDecisionStructure';
import { GameAIService } from '../../../services/AIService';
import { PokerAIDataCollector } from './PokerAIDataCollector';
import { PokerAIAgent } from './PokerAIAgent';

export class PokerAIAgentFactory extends DefaultAIAgentFactory<PokerGameState, PokerAction> {
  private dataCollector: PokerAIDataCollector;

  constructor(config: AIAgentFactoryConfig, context: IGameContext) {
    super(config, context);
    this.dataCollector = new PokerAIDataCollector();
  }

  createModelSpecificAgent(
    playerConfig: IPlayerConfig,
    modelConfig: AIModelConfig
  ): IGameAIAgent<PokerGameState, PokerAction> {
    const promptTemplate = this.getPromptTemplate(modelConfig);
    
    return new PokerAIAgent(
      playerConfig,
      this.context,
      this.config.aiService,
      promptTemplate,
      modelConfig,
      this.dataCollector
    );
  }

  getPromptTemplate(modelConfig: AIModelConfig): AIPromptTemplate {
    const customTemplate = this.config.promptTemplates?.get(modelConfig.id);
    if (customTemplate) {
      return customTemplate;
    }

    return {
      system: `You are an AI poker player using the {{modelName}} model.
Your personality traits are: {{personality}}

You are playing Texas Hold'em poker. Respond with a valid JSON object containing:
{
  "action": {
    "type": "fold" | "check" | "call" | "bet" | "raise" | "all-in",
    "amount": number (only for bet/raise)
  },
  "confidence": number between 0 and 1,
  "reasoning": "brief explanation of your decision"
}

Key information to consider:
- Your hole cards and community cards
- Current pot size and bet amounts
- Your chip stack and opponents' stacks
- Your position at the table
- Pot odds and implied odds
- Tournament dynamics if applicable

Play strategically while considering:
- Your stack size relative to blinds
- Position advantage
- Opponent tendencies (tight/loose)
- Risk vs reward
- Tournament survival if applicable

Remember: This is for entertainment purposes. Make decisions that are both strategic and engaging for spectators.`,

      user: `Current game state:
{{gameData}}

Valid actions you can take:
{{validActions}}

Additional context:
- Pot odds: {{gameData.gameSpecific.playerSpecific.potOdds}}%
- Stack to pot ratio: {{gameData.gameSpecific.playerSpecific.stackToPotRatio}}
- Position: {{gameData.gameSpecific.playerSpecific.positionName}} ({{gameData.gameSpecific.playerSpecific.positionType}})
- Amount to call: {{gameData.gameSpecific.playerSpecific.amountToCall}}

Make your decision based on the game state and your poker strategy.`,

      responseFormat: 'json',

      examples: [
        {
          input: {
            holeCards: ['As', 'Ah'],
            communityCards: ['Ks', 'Qh', '7d'],
            pot: 500,
            currentBet: 100,
            validActions: ['fold', 'call', 'raise']
          },
          output: {
            action: { type: 'raise', amount: 300 },
            confidence: 0.85,
            reasoning: 'Strong pocket aces with no obvious threats on board'
          }
        },
        {
          input: {
            holeCards: ['7h', '2c'],
            communityCards: [],
            pot: 150,
            currentBet: 100,
            validActions: ['fold', 'call', 'raise']
          },
          output: {
            action: { type: 'fold' },
            confidence: 0.95,
            reasoning: 'Weak starting hand not worth the investment'
          }
        }
      ]
    };
  }

  protected createGameSpecificPrompt(gameData: any): string {
    const validActions = this.dataCollector.collectValidActions(
      gameData.gameSpecific as PokerGameState,
      gameData.currentPlayer.id
    );

    return this.buildPrompt(gameData, validActions);
  }

  private buildPrompt(gameData: any, validActions: string[]): string {
    const template = this.getPromptTemplate(this.config.models.get(this.config.defaultModel)!);
    
    return template.user
      .replace(/\{\{gameData\}\}/g, JSON.stringify(gameData, null, 2))
      .replace(/\{\{validActions\}\}/g, JSON.stringify(validActions, null, 2))
      .replace(/\{\{gameData\.gameSpecific\.playerSpecific\.potOdds\}\}/g, 
        (gameData.gameSpecific?.playerSpecific?.potOdds * 100).toFixed(1))
      .replace(/\{\{gameData\.gameSpecific\.playerSpecific\.stackToPotRatio\}\}/g,
        gameData.gameSpecific?.playerSpecific?.stackToPotRatio.toFixed(2))
      .replace(/\{\{gameData\.gameSpecific\.playerSpecific\.positionName\}\}/g,
        gameData.gameSpecific?.playerSpecific?.positionName)
      .replace(/\{\{gameData\.gameSpecific\.playerSpecific\.positionType\}\}/g,
        gameData.gameSpecific?.playerSpecific?.positionType)
      .replace(/\{\{gameData\.gameSpecific\.playerSpecific\.amountToCall\}\}/g,
        gameData.gameSpecific?.playerSpecific?.amountToCall);
  }
}