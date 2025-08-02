import { DefaultAIAgentFactory, AIAgentFactoryConfig, UniversalAIAgent } from '../../../ai/AIAgentFactory';
import { ReverseHangmanGameState, ReverseHangmanAction } from '../ReverseHangmanTypes';
import { AIModelConfig, AIPromptTemplate } from '../../../ai/AIDecisionStructure';
import { IGameContext } from '../../../core/context';
import { ReverseHangmanAIDataCollector } from './ReverseHangmanAIDataCollector';
import { IPlayerConfig, IGameAIAgent } from '../../../core/interfaces';
import { GameAIService } from '../../../services/AIService';

// Custom AI agent for Reverse Hangman that properly handles template replacements
class ReverseHangmanAIAgent extends UniversalAIAgent<ReverseHangmanGameState, ReverseHangmanAction> {
  private dataCollector: ReverseHangmanAIDataCollector;
  private template: AIPromptTemplate;
  
  constructor(
    config: IPlayerConfig,
    context: IGameContext,
    aiService: GameAIService,
    promptTemplate: AIPromptTemplate,
    modelConfig: AIModelConfig,
    dataCollector: ReverseHangmanAIDataCollector
  ) {
    super(config, context, aiService, promptTemplate, modelConfig);
    this.dataCollector = dataCollector;
    this.template = promptTemplate;
  }
  
  protected collectGameData(state: ReverseHangmanGameState): any {
    // Use our specialized data collector instead of the generic one
    const data = this.dataCollector.collectNeutralData(state, this.id);
    console.log('ReverseHangmanAIAgent.collectGameData:', {
      hasData: !!data,
      hasGameSpecific: !!data.gameSpecific,
      currentOutput: data.gameSpecific?.currentOutput,
      attemptsRemaining: data.gameSpecific?.attemptsRemaining
    });
    return data;
  }
  
  protected buildPrompt(gameData: any, validActions: ReverseHangmanAction[]): string {
    const template = this.template;
    
    // Extract values before stringifying
    const currentOutput = gameData.gameSpecific?.currentOutput || '';
    const previousGuesses = gameData.gameSpecific?.previousGuesses || [];
    const attemptsRemaining = gameData.gameSpecific?.attemptsRemaining || 0;
    const maxAttempts = gameData.gameSpecific?.maxAttempts || 7;
    const category = gameData.gameSpecific?.category || 'unknown';
    const difficulty = gameData.gameSpecific?.difficulty || 'unknown';
    const targetWordCount = gameData.gameSpecific?.targetWordCount || 0;
    const currentPositionTemplate = gameData.gameSpecific?.currentPositionTemplate || '';
    const matchedWordsCount = gameData.gameSpecific?.matchedWordsCount || 0;
    const playerId = gameData.currentPlayer?.id || '';
    
    // Build warning section
    let warningSection = '';
    if (gameData.gameSpecific?.warningFlags) {
      const warnings = [];
      if (gameData.gameSpecific.warningFlags.repeatedLastGuess) {
        warnings.push('- You repeated your last guess! Try a different approach.');
      }
      if (gameData.gameSpecific.warningFlags.noProgressInLastThree) {
        warnings.push('- No progress in last 3 attempts. Reconsider your strategy!');
      }
      if (warnings.length > 0) {
        warningSection = '\n⚠️ WARNINGS:\n' + warnings.join('\n') + '\n';
      }
    }
    
    // Build the prompt with replacements
    let prompt = template.user;
    
    // Replace nested template variables first (before stringifying)
    prompt = prompt.replace(/\{\{gameData\.gameSpecific\.currentOutput\}\}/g, currentOutput);
    prompt = prompt.replace(/\{\{gameData\.gameSpecific\.previousGuesses\}\}/g, JSON.stringify(previousGuesses, null, 2));
    prompt = prompt.replace(/\{\{gameData\.gameSpecific\.attemptsRemaining\}\}/g, String(attemptsRemaining));
    prompt = prompt.replace(/\{\{gameData\.gameSpecific\.maxAttempts\}\}/g, String(maxAttempts));
    prompt = prompt.replace(/\{\{gameData\.gameSpecific\.category\}\}/g, category);
    prompt = prompt.replace(/\{\{gameData\.gameSpecific\.difficulty\}\}/g, difficulty);
    prompt = prompt.replace(/\{\{gameData\.gameSpecific\.targetWordCount\}\}/g, String(targetWordCount));
    prompt = prompt.replace(/\{\{gameData\.gameSpecific\.currentPositionTemplate\}\}/g, currentPositionTemplate);
    prompt = prompt.replace(/\{\{gameData\.gameSpecific\.matchedWordsCount\}\}/g, String(matchedWordsCount));
    prompt = prompt.replace(/\{\{playerId\}\}/g, playerId);
    prompt = prompt.replace(/\{\{warningSection\}\}/g, warningSection);
    
    // Then replace the full objects
    prompt = prompt.replace(/\{\{gameData\}\}/g, JSON.stringify(gameData, null, 2));
    prompt = prompt.replace(/\{\{validActions\}\}/g, JSON.stringify(validActions, null, 2));
    
    console.log('ReverseHangmanAIAgent.buildPrompt - replaced templates (first 1000 chars):', prompt.substring(0, 1000));
    
    return prompt;
  }
}

export class ReverseHangmanAIAgentFactory extends DefaultAIAgentFactory<ReverseHangmanGameState, ReverseHangmanAction> {
  private dataCollector: ReverseHangmanAIDataCollector;

  constructor(config: AIAgentFactoryConfig, context: IGameContext) {
    super(config, context);
    this.dataCollector = new ReverseHangmanAIDataCollector();
    console.log('ReverseHangmanAIAgentFactory created with config:', {
      defaultModel: config.defaultModel,
      modelCount: config.models.size,
      hasAIService: !!config.aiService
    });
  }
  
  createModelSpecificAgent(
    playerConfig: IPlayerConfig,
    modelConfig: AIModelConfig
  ): IGameAIAgent<ReverseHangmanGameState, ReverseHangmanAction> {
    const promptTemplate = this.getPromptTemplate(modelConfig);
    
    // Return our custom agent that properly handles template replacements
    return new ReverseHangmanAIAgent(
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
      system: `You are an AI player in a Reverse Hangman game using the {{modelName}} model.
Your personality traits are: {{personality}}

In Reverse Hangman, you are given the OUTPUT of an AI response and must guess the PROMPT that generated it.
You need to analyze the output and figure out what instruction or question would produce that exact response.

IMPORTANT: This is an ITERATIVE game! You should BUILD UPON your previous guesses using the detailed feedback:
- positionTemplate: Shows WHERE your correct words go (e.g., "_ _ review _ _ pizza _ _ _ _")
- matchedWordPositions: Exact positions of your correct words (0-indexed)
- matchedWords: These words are CORRECT - keep them in your next guess at their positions!
- extraWords: These words were wrong - try different words instead
- semanticMatches: You were close! The original used a synonym (e.g., you said "create", but it was "make")

Respond with a valid JSON object containing:
{
  "action": {
    "type": "guess" | "skip",
    "guess": "your guess of the original prompt" (only if type is "guess"),
    "playerId": "{{playerId}}",
    "timestamp": "current ISO timestamp"
  },
  "confidence": number between 0 and 1,
  "reasoning": "brief explanation of your deduction process"
}

CRITICAL STRATEGY - POSITION-BASED REFINEMENT:
1. First guess: Analyze the output structure and estimate total word count
2. Use the position template to understand sentence structure:
   - "_" represents a missing word
   - Words shown are in their EXACT positions
   - Example: "_ _ _ _ _ _ _ _ _ young heroes _ _" means "young" is word #10 and "heroes" is word #11
3. Build your next guess by:
   - KEEPING matched words in their shown positions
   - REASONING about what words would fit the blanks based on the output
   - CONSIDERING sentence structure (commands often start with verbs)
   - AVOIDING extraWords you already tried
4. Common patterns:
   - Commands: "[verb] [article] [noun]..." (e.g., "Write a poem...")
   - Questions: "[question word] [auxiliary verb]..." (e.g., "What is...")
   - Statements: "[subject] [verb]..." (e.g., "The sky is...")

Example progression:
- Guess 1: "Write a poem about nature" (40% match, pattern: "Write _ _ about _")
- Guess 2: "Write a haiku about spring" (75% match, pattern: "Write a haiku about _")
- Guess 3: "Write a haiku about cherry blossoms" (100% match!)

The goal is to guess the exact prompt with the fewest attempts possible.`,

      user: `TARGET PROMPT LENGTH: {{gameData.gameSpecific.targetWordCount}} words

CURRENT PATTERN: {{gameData.gameSpecific.currentPositionTemplate}}
(You have found {{gameData.gameSpecific.matchedWordsCount}} out of {{gameData.gameSpecific.targetWordCount}} words)

Output you need to reverse-engineer:
"{{gameData.gameSpecific.currentOutput}}"

Category: {{gameData.gameSpecific.category}} | Difficulty: {{gameData.gameSpecific.difficulty}}
Attempts remaining: {{gameData.gameSpecific.attemptsRemaining}} out of {{gameData.gameSpecific.maxAttempts}}

Previous guesses and their match results:
{{gameData.gameSpecific.previousGuesses}}

{{warningSection}}

CRITICAL INSTRUCTIONS:
1. The target prompt has EXACTLY {{gameData.gameSpecific.targetWordCount}} words
2. Use the position template above to see WHERE your correct words go
3. Build upon previous feedback - don't start from scratch each time
4. Focus on filling the blanks (_) in the position template

Current game state (for reference):
{{gameData}}

Valid actions:
{{validActions}}`,

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
              { 
                guess: "Write a poem about flowers", 
                matchType: "partial", 
                matchPercentage: 60,
                matchDetails: {
                  matchedWords: ["Write", "about"],
                  matchedWordPositions: [{ word: "Write", position: 0 }, { word: "about", position: 3 }],
                  extraWords: ["poem", "flowers"],
                  semanticMatches: [],
                  positionTemplate: "Write _ _ about _ _",
                  wordMatches: 2,
                  totalWords: 6
                }
              }
            ],
            attemptsRemaining: 6,
            category: "poetry"
          },
          output: {
            action: { type: 'guess', guess: 'Write a haiku about cherry blossoms' },
            confidence: 0.9,
            reasoning: 'Using position template "Write _ _ about _ _", I need to fill positions 1-2 and 4-5. The 5-7-5 syllable structure in the output suggests this is a haiku. Spring theme with cherry blossoms mentioned indicates the specific subject.'
          }
        },
        {
          input: {
            currentOutput: "Mix flour, sugar, cocoa powder, and butter.",
            previousGuesses: [
              { 
                guess: "How to make brownies", 
                matchType: "partial", 
                matchPercentage: 40,
                matchDetails: {
                  matchedWords: ["make"],
                  extraWords: ["How", "to", "brownies"],
                  semanticMatches: []
                }
              },
              { 
                guess: "Recipe for chocolate cake", 
                matchType: "partial", 
                matchPercentage: 55,
                matchDetails: {
                  matchedWords: ["recipe", "chocolate"],
                  matchedWordPositions: [{ word: "recipe", position: 0 }, { word: "chocolate", position: 3 }],
                  extraWords: ["for", "cake"],
                  semanticMatches: [{ original: "create", matched: "recipe", position: 0 }],
                  positionTemplate: "recipe _ _ chocolate _",
                  wordMatches: 2,
                  totalWords: 5
                }
              }
            ],
            attemptsRemaining: 2,
            category: "cooking"
          },
          output: {
            action: { type: 'guess', guess: 'Create a simple recipe chocolate cookies' },
            confidence: 0.75,
            reasoning: 'Pattern shows "recipe _ _ chocolate _". Semantic match indicates position 0 should be "create" not "recipe". The output mentions mixing ingredients, which suggests this is about making something simple. Since "cake" was wrong, trying "cookies" for the final word.'
          }
        }
      ]
    };
  }
}