// Simplified LLM stub for personality-based conversations
// This replaces the previous complex LLM integration with simple personality-driven responses

// Define personality type locally to avoid import issues
type BotPersonalityType = 'CRIMINAL' | 'GAMBLER' | 'WORKER';

// Simple personality-based barks/responses
const PERSONALITY_BARKS = {
  CRIMINAL: [
    "Your loot. Now.",
    "This is my turf!",
    "You look like you've got something valuable...",
    "Better watch your back around here.",
    "I know people who could use what you've got.",
    "Don't make me ask twice.",
    "You're in the wrong neighborhood.",
    "I've got a business proposition for you...",
  ],
  GAMBLER: [
    "Wanna bet on that?",
    "I'm feeling lucky today!",
    "The odds are in my favor.",
    "Double or nothing?",
    "Life's a gamble, might as well enjoy it.",
    "I've got a good feeling about this.",
    "Lady luck is on my side.",
    "Care to make things interesting?",
  ],
  WORKER: [
    "Just trying to make an honest living.",
    "Hard work pays off eventually.",
    "Another day, another dollar.",
    "Can't complain, staying busy.",
    "Slow and steady wins the race.",
    "Better get back to work.",
    "No shortcuts to success.",
    "Honest work for honest pay.",
  ],
};

// Simple greeting generator based on personality
export function generateGreeting(personality: BotPersonalityType): string {
  const barks = PERSONALITY_BARKS[personality] || PERSONALITY_BARKS.WORKER;
  return barks[Math.floor(Math.random() * barks.length)];
}

// Generate a response based on personality and context
export function generateResponse(
  personality: BotPersonalityType,
  context?: string
): string {
  const barks = PERSONALITY_BARKS[personality] || PERSONALITY_BARKS.WORKER;
  
  // Add some context-aware responses
  if (context?.includes('robbery')) {
    if (personality === 'CRIMINAL') {
      return "This is what I do best.";
    } else if (personality === 'WORKER') {
      return "Please, I worked hard for this!";
    }
  }
  
  if (context?.includes('gambling')) {
    if (personality === 'GAMBLER') {
      return "Now we're talking!";
    } else if (personality === 'WORKER') {
      return "I don't have money to waste.";
    }
  }
  
  // Default to random bark
  return barks[Math.floor(Math.random() * barks.length)];
}

// Simple conversation starter
export function startConversation(
  personality: BotPersonalityType,
  targetPersonality?: BotPersonalityType
): string {
  if (personality === 'CRIMINAL' && targetPersonality === 'WORKER') {
    return "Hey you, got a minute to talk business?";
  }
  if (personality === 'GAMBLER' && targetPersonality === 'GAMBLER') {
    return "Fellow risk-taker! Want to make a bet?";
  }
  
  return generateGreeting(personality);
}

// Export types for compatibility
export type LLMMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

// Stub function for any remaining LLM calls (returns personality-based response)
export async function callLLM(
  messages: LLMMessage[],
  personality?: BotPersonalityType
): Promise<string> {
  // Extract context from the last message
  const lastMessage = messages[messages.length - 1];
  const context = lastMessage?.content || '';
  
  // Return personality-based response
  return generateResponse(personality || 'WORKER', context);
}

// Stub for embedding generation (not used in simplified version)
export async function generateEmbedding(text: string): Promise<number[]> {
  // Return a dummy embedding vector
  return new Array(1536).fill(0);
}

// Stub for detecting mismatched LLM providers
export function detectMismatchedLLMProvider(): void {
  // No-op stub - LLM provider checking not needed in simplified version
}

// Export default for backward compatibility
export default {
  generateGreeting,
  generateResponse,
  startConversation,
  callLLM,
  generateEmbedding,
};