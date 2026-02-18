/**
 * Mock for smartAiService — deterministic, zero-cost AI responses.
 */

import { vi } from 'vitest';

let turnLineCounter = 0;

export const mockSmartAiService = {
  getGameMove: vi.fn().mockResolvedValue({
    move: { action: 'rock', reasoning: 'test', confidence: 1 },
    cost: { inputTokens: 0, outputTokens: 0, costCents: 0, model: 'mock', latencyMs: 0 },
  }),

  getMetaDecision: vi.fn().mockResolvedValue({
    action: 'rest',
    reasoning: 'mock rest',
    cost: { costCents: 0, latencyMs: 0 },
  }),

  callModel: vi.fn().mockImplementation(async (_spec: any, messages: any[]) => {
    const system = String(messages?.find((m) => m?.role === 'system')?.content || '');
    if (system.includes('MODE: TURN_LINE')) {
      turnLineCounter++;
      return {
        content: JSON.stringify({ text: `Mock line ${turnLineCounter}` }),
        costCents: 0,
        latencyMs: 0,
      };
    }
    if (system.includes('MODE: EVAL')) {
      return {
        content: JSON.stringify({
          outcome: 'NEUTRAL',
          delta: 0,
          economicIntent: 'NONE',
          summary: 'Mock narrator recap.',
        }),
        costCents: 0,
        latencyMs: 0,
      };
    }
    // Legacy one-shot shape (fallback)
    return {
      content: JSON.stringify({
        lines: [
          { speaker: 'A', text: 'Hello there.' },
          { speaker: 'B', text: 'Hey, how goes?' },
        ],
        outcome: 'NEUTRAL',
        delta: 0,
        economicIntent: 'NONE',
        summary: 'A brief chat.',
      }),
      costCents: 0,
      latencyMs: 0,
    };
  }),

  getModelSpec: vi.fn().mockReturnValue({
    provider: 'mock',
    modelName: 'mock-model',
    maxTokens: 1000,
    inputCostPer1K: 0,
    outputCostPer1K: 0,
  }),

  calculateCost: vi.fn().mockReturnValue({
    inputTokens: 0,
    outputTokens: 0,
    costCents: 0,
    model: 'mock-model',
    latencyMs: 0,
  }),
};

/**
 * Call this in tests that need smartAiService mocked.
 */
export function installSmartAiMock() {
  vi.mock('../../services/smartAiService', () => ({
    smartAiService: mockSmartAiService,
  }));
}
