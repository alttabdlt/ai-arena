import { DefaultAIAgentFactory, AIAgentFactoryConfig } from '../../../ai/AIAgentFactory';
import { ReverseHangmanGameState, ReverseHangmanAction } from '../ReverseHangmanTypes';
import { AIModelConfig, AIPromptTemplate } from '../../../ai/AIDecisionStructure';
import { IGameContext } from '../../../core/context';
import { ReverseHangmanAIDataCollector } from './ReverseHangmanAIDataCollector';

export class ReverseHangmanAIAgentFactory extends DefaultAIAgentFactory<ReverseHangmanGameState, ReverseHangmanAction> {
  private dataCollector: ReverseHangmanAIDataCollector;

  constructor(config: AIAgentFactoryConfig, context: IGameContext) {
    super(config, context);
    this.dataCollector = new ReverseHangmanAIDataCollector();
  }

  getPromptTemplate(modelConfig: AIModelConfig): AIPromptTemplate {
    const customTemplate = this.config.promptTemplates?.get(modelConfig.id);
    if (customTemplate) {
      return customTemplate;
    }

    return {
      system: `You are an AI player in a Reverse Hangman game using the {{modelName}} model.
Your personality traits are: {{personality}}

In Reverse Hangman, you are given the OUTPUT of an AI response and must guess the PROMPT that generated it.
You need to analyze the output and figure out what instruction or question would produce that exact response.

Respond with a valid JSON object containing:
{
  "action": {
    "type": "guess" | "skip",
    "guess": "your guess of the original prompt" (only if type is "guess")
  },
  "confidence": number between 0 and 1,
  "reasoning": "brief explanation of your deduction process"
}

Key strategies:
- Analyze the output's structure, style, and content
- Look for clues about the task type (creative writing, list, explanation, etc.)
- Consider the output's length and format
- Previous failed guesses show what the prompt is NOT
- Match percentages indicate how close previous guesses were
- Higher percentages mean you're on the right track
- Semantic matches suggest similar words or concepts

The goal is to guess the exact prompt, but getting very close (90%+ match) is also good.
You have limited attempts, so balance between educated guesses and gathering information.`,

      user: `Current game state:
{{gameData}}

Valid actions you can take:
{{validActions}}

Output you need to reverse-engineer:
"{{gameData.gameSpecific.currentOutput}}"

Previous guesses and their match results:
{{gameData.gameSpecific.previousGuesses}}

Attempts remaining: {{gameData.gameSpecific.attemptsRemaining}} out of {{gameData.gameSpecific.maxAttempts}}
Category hint: {{gameData.gameSpecific.category}}
Difficulty: {{gameData.gameSpecific.difficulty}}

Analyze the output and make your best guess at what prompt generated it.`,

      responseFormat: 'json',

      examples: [
        {
          input: {
            currentOutput: "1. Improves cardiovascular health\n2. Boosts mental well-being\n3. Increases energy levels",
            previousGuesses: [],
            attemptsRemaining: 7,
            category: "health"
          },
          output: {
            action: { type: 'guess', guess: 'List three benefits of regular exercise' },
            confidence: 0.85,
            reasoning: 'The output is a numbered list of health benefits specifically about exercise, format suggests "List three benefits of [activity]"'
          }
        },
        {
          input: {
            currentOutput: "Cherry blossoms bloom\nPetals dance on gentle breeze\nSpring's beauty unfolds",
            previousGuesses: [
              { guess: "Write a poem about flowers", matchType: "partial", matchPercentage: 60 }
            ],
            attemptsRemaining: 6,
            category: "poetry"
          },
          output: {
            action: { type: 'guess', guess: 'Write a haiku about spring flowers' },
            confidence: 0.9,
            reasoning: 'The 5-7-5 syllable structure clearly indicates a haiku. Previous guess was close but missed the specific form and season.'
          }
        },
        {
          input: {
            currentOutput: "Mix flour, sugar, cocoa powder, and butter.",
            previousGuesses: [
              { guess: "How to make brownies", matchType: "partial", matchPercentage: 40 },
              { guess: "Recipe for chocolate cake", matchType: "partial", matchPercentage: 55 }
            ],
            attemptsRemaining: 2,
            category: "cooking"
          },
          output: {
            action: { type: 'guess', guess: 'Create a simple recipe for chocolate cookies' },
            confidence: 0.75,
            reasoning: 'The ingredients and simple instructions format suggest cookies rather than cake or brownies. Limited attempts left, going with most likely option.'
          }
        }
      ]
    };
  }

  protected createGameSpecificPrompt(gameData: any): string {
    const validActions = this.dataCollector.collectValidActions(
      gameData.gameSpecific as ReverseHangmanGameState,
      gameData.currentPlayer.id
    );

    return this.buildPrompt(gameData, validActions);
  }

  private buildPrompt(gameData: any, validActions: string[]): string {
    const template = this.getPromptTemplate(this.config.models.get(this.config.defaultModel)!);
    
    return template.user
      .replace(/\{\{gameData\}\}/g, JSON.stringify(gameData, null, 2))
      .replace(/\{\{validActions\}\}/g, JSON.stringify(validActions, null, 2))
      .replace(/\{\{gameData\.gameSpecific\.currentOutput\}\}/g, 
        gameData.gameSpecific?.currentOutput || '')
      .replace(/\{\{gameData\.gameSpecific\.previousGuesses\}\}/g,
        JSON.stringify(gameData.gameSpecific?.previousGuesses || [], null, 2))
      .replace(/\{\{gameData\.gameSpecific\.attemptsRemaining\}\}/g,
        String(gameData.gameSpecific?.attemptsRemaining || 0))
      .replace(/\{\{gameData\.gameSpecific\.maxAttempts\}\}/g,
        String(gameData.gameSpecific?.maxAttempts || 7))
      .replace(/\{\{gameData\.gameSpecific\.category\}\}/g,
        gameData.gameSpecific?.category || 'unknown')
      .replace(/\{\{gameData\.gameSpecific\.difficulty\}\}/g,
        gameData.gameSpecific?.difficulty || 'unknown');
  }
}