import { gameRegistry } from '../registry/GameRegistry';
import { GameAIService, AIServiceConfig } from '../services/AIService';
import { AIModelConfig } from '../ai/AIDecisionStructure';
import { createPokerGameDescriptor } from './poker';
import { createReverseHangmanGameDescriptor } from './reverse-hangman/ReverseHangmanGame';
import { createConnect4GameDescriptor } from './connect4';
import { apolloClient } from '@/lib/apollo-client';

// AI Model configurations
const aiModels = new Map<string, AIModelConfig>([
  ['gpt-4o', {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    model: 'gpt-4o',
    maxTokens: 1000,
    temperature: 0.7
  }],
  ['claude-3-5-sonnet', {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 1000,
    temperature: 0.7
  }],
  ['claude-3-opus', {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    maxTokens: 1000,
    temperature: 0.7
  }],
  ['deepseek-chat', {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'custom',
    model: 'deepseek-chat',
    endpoint: import.meta.env.VITE_DEEPSEEK_API_URL,
    maxTokens: 1000,
    temperature: 0.7
  }]
]);

// AI Service configuration
const aiServiceConfig: AIServiceConfig = {
  apiEndpoint: import.meta.env.VITE_AI_API_ENDPOINT || '/api/ai',
  timeout: 60000,
  retryAttempts: 3,
  models: Object.fromEntries(aiModels)
};

// Create AI service instance with Apollo Client
const aiService = new GameAIService(aiServiceConfig, apolloClient);

// Register games
export function registerGames() {
  // Register Poker
  const pokerDescriptor = createPokerGameDescriptor(aiService, aiModels);
  gameRegistry.register(pokerDescriptor);

  // Register Reverse Hangman
  const reverseHangmanDescriptor = createReverseHangmanGameDescriptor(aiService, aiModels);
  gameRegistry.register(reverseHangmanDescriptor);

  // Register Connect4
  const connect4Descriptor = createConnect4GameDescriptor(aiService, aiModels);
  gameRegistry.register(connect4Descriptor);

  // Future games will be registered here
  // gameRegistry.register(createChessDescriptor(aiService, aiModels));
  // gameRegistry.register(createGoDescriptor(aiService, aiModels));
}

// Export for use in components
export { aiService, aiModels };

// Export game types and managers
export * from './poker';
export * from './reverse-hangman';
export * from './connect4';