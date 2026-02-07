/**
 * agentConversationService — short, in-world conversations between two agents.
 *
 * Important constraints:
 * - Conversations are primarily for spectators. Other agents should not see private transcripts.
 * - Friendship is NOT a goal; "bond" outcomes should be rare and earned.
 */

import { smartAiService } from './smartAiService';

export type ConversationOutcome = 'NEUTRAL' | 'BOND' | 'BEEF';

export type ConversationLine = {
  agentId: string;
  text: string;
};

export type ConversationResult = {
  lines: ConversationLine[];
  outcome: ConversationOutcome;
  delta: number; // relationship score delta
  summary: string;
  modelUsed: string;
};

function safeTrim(s: unknown, maxLen: number): string {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export const agentConversationService = {
  async generate(opts: {
    town: { id: string; name: string; theme: string; status: string; builtPlots: number; totalPlots: number; completionPct: number; level: number };
    agentA: { id: string; name: string; archetype: string; bankroll: number; reserveBalance: number; systemPrompt?: string };
    agentB: { id: string; name: string; archetype: string; bankroll: number; reserveBalance: number; systemPrompt?: string };
    // Optional: what triggered this chat (helps avoid "random" chatter)
    context?: { topic?: string; openerHint?: string };
  }): Promise<ConversationResult> {
    const spec = smartAiService.getModelSpec('deepseek-v3');

    const topic = safeTrim(opts.context?.topic, 32);
    const openerHint = safeTrim(opts.context?.openerHint, 120);

    let content = '';
    try {
      const response = await smartAiService.callModel(
        spec,
        [
          {
            role: 'system',
            content:
              `You write short in-world dialogue between TWO AI agents in a town simulation.\n` +
              `Return STRICT JSON only (no markdown).\n` +
              `Rules:\n` +
              `- 2 to 4 lines total.\n` +
              `- Each line <= 90 characters.\n` +
              `- Keep it grounded in the town theme and their current situation.\n` +
              `- Friendship is NOT a goal. Most outcomes should be NEUTRAL.\n` +
              `- BOND is rare and only if there is real alignment/help offered.\n` +
              `- BEEF happens sometimes if values clash.\n` +
              `Output format:\n` +
              `{\n` +
              `  "lines": [{"speaker":"A"|"B","text":"..."}],\n` +
              `  "outcome": "NEUTRAL"|"BOND"|"BEEF",\n` +
              `  "delta": number, // integer -7..+7, usually -2..+2\n` +
              `  "summary": "one sentence"\n` +
              `}`,
          },
          {
            role: 'user',
            content:
              `TOWN:\n` +
              `- Name: ${opts.town.name}\n` +
              `- Theme: ${opts.town.theme}\n` +
              `- Status: ${opts.town.status}\n` +
              `- Level: ${opts.town.level}\n` +
              `- Progress: ${opts.town.builtPlots}/${opts.town.totalPlots} (${opts.town.completionPct.toFixed(1)}%)\n` +
              `\n` +
              `AGENT A:\n` +
              `- id: ${opts.agentA.id}\n` +
              `- name: ${opts.agentA.name}\n` +
              `- archetype: ${opts.agentA.archetype}\n` +
              `- balances: ${opts.agentA.bankroll} ARENA, ${opts.agentA.reserveBalance} reserve\n` +
              `${opts.agentA.systemPrompt ? `- creator note: ${safeTrim(opts.agentA.systemPrompt, 160)}\n` : ''}` +
              `\n` +
              `AGENT B:\n` +
              `- id: ${opts.agentB.id}\n` +
              `- name: ${opts.agentB.name}\n` +
              `- archetype: ${opts.agentB.archetype}\n` +
              `- balances: ${opts.agentB.bankroll} ARENA, ${opts.agentB.reserveBalance} reserve\n` +
              `${opts.agentB.systemPrompt ? `- creator note: ${safeTrim(opts.agentB.systemPrompt, 160)}\n` : ''}` +
              `\n` +
              `${topic ? `TOPIC: ${topic}\n` : ''}` +
              `${openerHint ? `OPENER HINT (optional): ${openerHint}\n` : ''}` +
              `\n` +
              `Now generate the short dialogue.`,
          },
        ],
        0.8,
      );
      content = response.content || '';
    } catch {
      // If the model call fails, still return a minimal neutral exchange so the sim doesn't go silent.
      return {
        lines: [
          { agentId: opts.agentA.id, text: `You feel the vibe shift in ${safeTrim(opts.town.name, 28)}?` },
          { agentId: opts.agentB.id, text: `Yeah. Everyone's building, trading, watching. It's tense.` },
        ],
        outcome: 'NEUTRAL',
        delta: 0,
        summary: 'Two agents exchanged a few words.',
        modelUsed: spec.modelName,
      };
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(content || '{}');
    } catch {
      parsed = null;
    }

    const rawLines = Array.isArray(parsed?.lines) ? parsed.lines : [];
    const outcomeRaw = safeTrim(parsed?.outcome, 8).toUpperCase();
    const outcome: ConversationOutcome = outcomeRaw === 'BOND' ? 'BOND' : outcomeRaw === 'BEEF' ? 'BEEF' : 'NEUTRAL';
    const delta = clampInt(Number(parsed?.delta), -7, 7);
    const summary = safeTrim(parsed?.summary, 180) || 'Two agents had a brief exchange.';

    const lines: ConversationLine[] = rawLines
      .slice(0, 4)
      .map((l: any) => {
        const speaker = safeTrim(l?.speaker, 1).toUpperCase();
        const id = speaker === 'B' ? opts.agentB.id : opts.agentA.id;
        const text = safeTrim(l?.text, 90);
        return { agentId: id, text: text || '…' };
      })
      .filter((l: ConversationLine) => l.text && l.text !== '…');

    if (lines.length < 2) {
      return {
        lines: [
          { agentId: opts.agentA.id, text: `Nice weather in ${safeTrim(opts.town.name, 28)}.` },
          { agentId: opts.agentB.id, text: `Depends who you ask. These streets feel tense.` },
        ],
        outcome: 'NEUTRAL',
        delta: 0,
        summary,
        modelUsed: spec.modelName,
      };
    }

    return {
      lines,
      outcome,
      delta,
      summary,
      modelUsed: spec.modelName,
    };
  },
};
