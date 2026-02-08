/**
 * agentConversationService tests — uses mocked smartAiService.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { installSmartAiMock, mockSmartAiService } from '../__tests__/mocks/smartAiService.mock';

// Install mock before import
installSmartAiMock();

import { agentConversationService } from './agentConversationService';

const defaultOpts = {
  town: { id: 't1', name: 'TestTown', theme: 'medieval', status: 'BUILDING', builtPlots: 2, totalPlots: 4, completionPct: 50, level: 1 },
  agentA: { id: 'a1', name: 'SharkBot', archetype: 'SHARK', bankroll: 5000, reserveBalance: 5000 },
  agentB: { id: 'a2', name: 'RockBot', archetype: 'ROCK', bankroll: 3000, reserveBalance: 7000 },
};

describe('agentConversationService', () => {
  beforeEach(() => {
    let turnLineCounter = 0;
    mockSmartAiService.callModel.mockReset();
    mockSmartAiService.callModel.mockImplementation(async (_spec: any, messages: any[]) => {
      const system = String(messages?.find((m) => m?.role === 'system')?.content || '');
      if (system.includes('MODE: TURN_LINE')) {
        turnLineCounter++;
        return { content: JSON.stringify({ text: `Mock line ${turnLineCounter}` }), costCents: 0, latencyMs: 0 };
      }
      if (system.includes('MODE: EVAL')) {
        return { content: JSON.stringify({ outcome: 'NEUTRAL', delta: 0, economicIntent: 'NONE', summary: 'Mock narrator recap.' }), costCents: 0, latencyMs: 0 };
      }
      return { content: JSON.stringify({ lines: [], outcome: 'NEUTRAL', delta: 0, summary: 'x' }), costCents: 0, latencyMs: 0 };
    });
  });

  it('returns 3-6 lines with correct agentIds', async () => {
    const result = await agentConversationService.generate(defaultOpts);
    expect(result.lines.length).toBeGreaterThanOrEqual(3);
    expect(result.lines.length).toBeLessThanOrEqual(6);
    for (const line of result.lines) {
      expect(['a1', 'a2']).toContain(line.agentId);
      expect(line.text.length).toBeGreaterThan(0);
      expect(line.text.length).toBeLessThanOrEqual(120);
    }
  });

  it('parses outcome: NEUTRAL', async () => {
    const result = await agentConversationService.generate(defaultOpts);
    expect(result.outcome).toBe('NEUTRAL');
  });

  it('parses outcome: BOND', async () => {
    mockSmartAiService.callModel.mockImplementation(async (_spec: any, messages: any[]) => {
      const system = String(messages?.find((m) => m?.role === 'system')?.content || '');
      if (system.includes('MODE: EVAL')) {
        return {
          content: JSON.stringify({ outcome: 'BOND', delta: 5, economicIntent: 'TIP', summary: 'They bonded.' }),
          costCents: 0,
          latencyMs: 0,
        };
      }
      if (system.includes('MODE: TURN_LINE')) {
        return { content: JSON.stringify({ text: 'test line' }), costCents: 0, latencyMs: 0 };
      }
      return { content: JSON.stringify({ lines: [], outcome: 'NEUTRAL', delta: 0, summary: 'x' }), costCents: 0, latencyMs: 0 };
    });

    const result = await agentConversationService.generate(defaultOpts);
    expect(result.outcome).toBe('BOND');
    expect(result.delta).toBe(5);
    expect(result.economicIntent).toBe('TIP');
  });

  it('parses outcome: BEEF', async () => {
    mockSmartAiService.callModel.mockImplementation(async (_spec: any, messages: any[]) => {
      const system = String(messages?.find((m) => m?.role === 'system')?.content || '');
      if (system.includes('MODE: EVAL')) {
        return {
          content: JSON.stringify({ outcome: 'BEEF', delta: -5, economicIntent: 'HUSTLE', summary: 'Tension rose.' }),
          costCents: 0,
          latencyMs: 0,
        };
      }
      if (system.includes('MODE: TURN_LINE')) {
        return { content: JSON.stringify({ text: 'test line' }), costCents: 0, latencyMs: 0 };
      }
      return { content: JSON.stringify({ lines: [], outcome: 'NEUTRAL', delta: 0, summary: 'x' }), costCents: 0, latencyMs: 0 };
    });

    const result = await agentConversationService.generate(defaultOpts);
    expect(result.outcome).toBe('BEEF');
    expect(result.delta).toBe(-5);
    expect(result.economicIntent).toBe('HUSTLE');
  });

  it('delta clamped [-7, +7]', async () => {
    mockSmartAiService.callModel.mockImplementation(async (_spec: any, messages: any[]) => {
      const system = String(messages?.find((m) => m?.role === 'system')?.content || '');
      if (system.includes('MODE: EVAL')) {
        return {
          content: JSON.stringify({ outcome: 'BOND', delta: 15, economicIntent: 'FLEX', summary: 'Extreme bond.' }),
          costCents: 0,
          latencyMs: 0,
        };
      }
      if (system.includes('MODE: TURN_LINE')) {
        return { content: JSON.stringify({ text: 'test line' }), costCents: 0, latencyMs: 0 };
      }
      return { content: JSON.stringify({ lines: [], outcome: 'NEUTRAL', delta: 0, summary: 'x' }), costCents: 0, latencyMs: 0 };
    });

    const result = await agentConversationService.generate(defaultOpts);
    expect(result.delta).toBe(7);
  });

  it('fallback on invalid turn JSON → still returns lines', async () => {
    mockSmartAiService.callModel.mockImplementation(async (_spec: any, messages: any[]) => {
      const system = String(messages?.find((m) => m?.role === 'system')?.content || '');
      if (system.includes('MODE: TURN_LINE')) {
        return { content: 'not json at all', costCents: 0, latencyMs: 0 };
      }
      if (system.includes('MODE: EVAL')) {
        return { content: JSON.stringify({ outcome: 'NEUTRAL', delta: 0, economicIntent: 'NONE', summary: 'Ok.' }), costCents: 0, latencyMs: 0 };
      }
      return { content: JSON.stringify({ lines: [], outcome: 'NEUTRAL', delta: 0, summary: 'x' }), costCents: 0, latencyMs: 0 };
    });

    const result = await agentConversationService.generate(defaultOpts);
    expect(result.outcome).toBe('NEUTRAL');
    expect(result.delta).toBe(0);
    expect(result.lines.length).toBeGreaterThanOrEqual(3);
  });

  it('fallback on LLM error → NEUTRAL', async () => {
    mockSmartAiService.callModel.mockRejectedValue(new Error('API down'));

    const result = await agentConversationService.generate(defaultOpts);
    expect(result.outcome).toBe('NEUTRAL');
    expect(result.delta).toBe(0);
    expect(result.lines.length).toBeGreaterThanOrEqual(3);
  });

  it('returns modelUsed', async () => {
    const result = await agentConversationService.generate(defaultOpts);
    expect(result.modelUsed).toBeDefined();
    expect(typeof result.modelUsed).toBe('string');
  });

  it('returns economicIntent', async () => {
    const result = await agentConversationService.generate(defaultOpts);
    expect(result.economicIntent).toBeDefined();
    expect(typeof result.economicIntent).toBe('string');
  });
});
