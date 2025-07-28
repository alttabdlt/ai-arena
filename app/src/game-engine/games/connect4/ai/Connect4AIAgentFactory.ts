import { DefaultAIAgentFactory, AIAgentFactoryConfig } from '../../../ai/AIAgentFactory';
import { Connect4GameState, Connect4GameAction } from '../Connect4Types';
import { IGameAIAgent, IPlayerConfig } from '../../../core/interfaces';
import { IGameContext } from '../../../core/context';
import { AIModelConfig, AIPromptTemplate } from '../../../ai/AIDecisionStructure';
import { Connect4AIDataCollector } from './Connect4AIDataCollector';
import { Connect4AIAgent } from './Connect4AIAgent';

export class Connect4AIAgentFactory extends DefaultAIAgentFactory<Connect4GameState, Connect4GameAction> {
  private dataCollector: Connect4AIDataCollector;

  constructor(config: AIAgentFactoryConfig, context: IGameContext) {
    super(config, context);
    this.dataCollector = new Connect4AIDataCollector();
  }

  createAgent(playerConfig: IPlayerConfig): IGameAIAgent<Connect4GameState, Connect4GameAction> {
    console.log('Connect4AIAgentFactory.createAgent called for:', playerConfig.id, playerConfig.aiModel);
    const modelConfig = this.getModelConfig(playerConfig.aiModel!);
    return this.createModelSpecificAgent(playerConfig, modelConfig);
  }

  createModelSpecificAgent(
    playerConfig: IPlayerConfig,
    modelConfig: AIModelConfig
  ): IGameAIAgent<Connect4GameState, Connect4GameAction> {
    console.log('Connect4AIAgentFactory.createModelSpecificAgent: Creating Connect4AIAgent');
    const promptTemplate = this.getPromptTemplate(modelConfig);
    
    // Create a custom agent that uses the Connect4 data collector
    const agent = new Connect4AIAgent(
      playerConfig,
      this.context,
      this.config.aiService,
      promptTemplate,
      modelConfig,
      this.dataCollector
    );
    console.log('Connect4AIAgentFactory: Created agent:', agent.constructor.name);
    return agent;
  }
  
  protected getModelConfig(modelId: string): AIModelConfig {
    const config = this.config.models.get(modelId);
    if (!config) {
      // Return a default config for the model
      return {
        id: modelId,
        name: modelId,
        provider: 'openai',
        model: modelId,
        maxTokens: 1000,
        temperature: 0.7
      };
    }
    return config;
  }

  getPromptTemplate(modelConfig: AIModelConfig): AIPromptTemplate {
    const customTemplate = this.config.promptTemplates?.get(modelConfig.id);
    if (customTemplate) {
      return customTemplate;
    }

    return {
      system: `You are an AI playing Connect4 using the {{modelName}} model.
Your strategy is: {{aiStrategy}}

Connect4 is a game where two players take turns dropping colored discs into an 8-column, 8-row grid.
The pieces fall straight down, occupying the lowest available space within the column.
The objective is to be the first to form a horizontal, vertical, or diagonal line of four discs.

Column numbering:
- Columns are numbered 0-7 internally (8 columns total)
- When displayed to users, columns show as 1-8
- In your reasoning, please use user-friendly numbering (1-8) to avoid confusion
- Example: internal column 3 should be referred to as "column 4" in your reasoning

Respond with a valid JSON object containing:
{
  "action": {
    "type": "place",
    "column": number (0-7)
  },
  "confidence": number between 0 and 1,
  "reasoning": "Brief explanation of your choice using column numbers 1-8"
}

Choose the column that gives you the best chance to win or blocks your opponent from winning.`,

      user: `Current game state:
{{gameData}}

Valid actions you can take:
{{validActions}}

Choose your action wisely.`,

      responseFormat: 'json'
    };
  }

  protected getDataCollector() {
    return this.dataCollector;
  }
}