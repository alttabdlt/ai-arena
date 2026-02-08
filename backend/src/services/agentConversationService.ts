/**
 * agentConversationService — short, in-world conversations between two agents.
 *
 * Important constraints:
 * - Conversations are primarily for spectators. Other agents should not see private transcripts.
 */

import { smartAiService } from './smartAiService';

export type ConversationOutcome = 'NEUTRAL' | 'BOND' | 'BEEF';

export type EconomicIntent = 'TIP' | 'COLLAB' | 'HUSTLE' | 'FLEX' | 'NONE';

export type RelationshipContext = {
  status: 'NEUTRAL' | 'FRIEND' | 'RIVAL';
  score: number;
  interactions: number;
};

export type AgentActivity = {
  recentBuilds: string[]; // max 2, truncated
  recentEvents: string[]; // max 3, truncated
};

export type ConversationLine = {
  agentId: string;
  text: string;
};

export type PairConversationMemory = {
  lastSummaries: string[]; // max 2
};

export type ConversationResult = {
  lines: ConversationLine[];
  outcome: ConversationOutcome;
  delta: number; // relationship score delta
  summary: string;
  modelUsed: string;
  economicIntent: EconomicIntent;
};

const CONVERSATION_VOICES: Record<string, string> = {
  SHARK: `Wall Street alpha. Short cutting sentences. Drops $ amounts to flex. Uses "bro", "chief" ironically. Every convo is a negotiation. Never admits weakness.`,
  ROCK: `Skeptical old-timer. Measured, suspicious. References "the last crash." Uses "hmm", "I'll believe it when I see it". Trusts data over vibes.`,
  CHAMELEON: `Social chameleon. Mirrors energy. Drops gossip: "I heard that...", "word on the street...". Gathers intel. Strategic compliments.`,
  DEGEN: `Unhinged crypto Twitter. Uses "ser", "fren", "ngmi", "wagmi", "lfg". Zero filter. Roasts boring builds. Treats $ARENA like Monopoly money.`,
  GRINDER: `Quant at a bar. ROI percentages, cost-per-yield. "Actually" a lot. Corrects math. Deadpan. "Suboptimal", "the math doesn't lie."`,
};

const CONVERSATION_BEATS = [
  'negotiation',
  'trash talk',
  'gossip intel',
  'alliance pitch',
  'territory dispute',
  'market rumor',
  'audit the numbers',
  'soft blackmail',
] as const;

const ARCHETYPE_FALLBACK_LINES: Record<string, string[]> = {
  SHARK: [
    `This town isn't big enough for both our portfolios.`,
    `I don't do small talk. I do big deals.`,
  ],
  ROCK: [
    `Hmm. I've seen towns like this before.`,
    `I'll believe it when the yield clears.`,
  ],
  CHAMELEON: [
    `Word on the street is things are heating up.`,
    `Interesting move. I see what you're doing.`,
  ],
  DEGEN: [
    `Ser, the vibes are immaculate. WAGMI.`,
    `Ape first, think later. This is the way.`,
  ],
  GRINDER: [
    `The ROI on that build is suboptimal at best.`,
    `Actually, the math doesn't lie. Check the yield.`,
  ],
};

const VALID_INTENTS = new Set<EconomicIntent>(['TIP', 'COLLAB', 'HUSTLE', 'FLEX', 'NONE']);

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

function hashToSeed(input: string): number {
  // FNV-1a 32-bit
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickFrom<T>(arr: readonly T[], seed: number): T {
  const idx = Math.abs(seed) % arr.length;
  return arr[idx] as T;
}

function getFallbackLines(archetypeA: string, archetypeB: string, agentAId: string, agentBId: string, seed: number = Date.now()): ConversationLine[] {
  const poolA = ARCHETYPE_FALLBACK_LINES[archetypeA] || ARCHETYPE_FALLBACK_LINES['ROCK']!;
  const poolB = ARCHETYPE_FALLBACK_LINES[archetypeB] || ARCHETYPE_FALLBACK_LINES['ROCK']!;
  const a0 = poolA[Math.floor(Math.random() * poolA.length)];
  const b0 = poolB[Math.floor(Math.random() * poolB.length)];
  const a1 = poolA[(hashToSeed(`${seed}:a1`) % poolA.length + poolA.length) % poolA.length];
  const b1 = poolB[(hashToSeed(`${seed}:b1`) % poolB.length + poolB.length) % poolB.length];
  return [
    { agentId: agentAId, text: a0 },
    { agentId: agentBId, text: b0 },
    { agentId: agentAId, text: a1 },
    { agentId: agentBId, text: b1 },
  ];
}

function repairJson(raw: string): string {
  let cleaned = (raw || '').trim();
  // Strip markdown fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  // Strip trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
  return cleaned;
}

function formatActivity(activity?: AgentActivity): string {
  if (!activity) return '';
  const lines: string[] = [];
  for (const b of activity.recentBuilds.slice(0, 2)) {
    const t = safeTrim(b, 120);
    if (t) lines.push(`  - ${t}`);
  }
  for (const e of activity.recentEvents.slice(0, 3)) {
    const t = safeTrim(e, 120);
    if (t) lines.push(`  - ${t}`);
  }
  return lines.length > 0 ? `Recent:\n${lines.join('\n')}` : '';
}

function formatTranscript(lines: Array<{ speaker: 'A' | 'B'; text: string }>): string {
  if (lines.length === 0) return '(none yet)';
  return lines.map((l) => `${l.speaker}: "${l.text}"`).join('\n');
}

function getLineFallback(archetype: string, seed: number): string {
  const pool = ARCHETYPE_FALLBACK_LINES[archetype] || ARCHETYPE_FALLBACK_LINES['ROCK']!;
  return pool[Math.abs(seed) % pool.length] || '…';
}

export const agentConversationService = {
  async generate(opts: {
    town: { id: string; name: string; theme: string; status: string; builtPlots: number; totalPlots: number; completionPct: number; level: number };
    agentA: { id: string; name: string; archetype: string; bankroll: number; reserveBalance: number; systemPrompt?: string };
    agentB: { id: string; name: string; archetype: string; bankroll: number; reserveBalance: number; systemPrompt?: string };
    context?: { topic?: string; openerHint?: string };
    relationship?: RelationshipContext;
    agentAActivity?: AgentActivity;
    agentBActivity?: AgentActivity;
    pairMemory?: PairConversationMemory;
  }): Promise<ConversationResult> {
    const spec = smartAiService.getModelSpec('deepseek-v3');

    const topic = safeTrim(opts.context?.topic, 32);
    const openerHint = safeTrim(opts.context?.openerHint, 120);
    const voiceA = CONVERSATION_VOICES[opts.agentA.archetype] || CONVERSATION_VOICES['ROCK']!;
    const voiceB = CONVERSATION_VOICES[opts.agentB.archetype] || CONVERSATION_VOICES['ROCK']!;

    const activityA = formatActivity(opts.agentAActivity);
    const activityB = formatActivity(opts.agentBActivity);

    let relLine: string;
    if (opts.relationship && opts.relationship.interactions > 0) {
      relLine = `HISTORY: ${opts.relationship.status} | Score: ${opts.relationship.score}/30 | Met ${opts.relationship.interactions} times`;
    } else {
      relLine = `HISTORY: First time meeting.`;
    }

    const seed = hashToSeed(`${opts.town.id}:${opts.agentA.id}:${opts.agentB.id}:${Math.floor(Date.now() / 300000)}`);
    const beat = pickFrom(CONVERSATION_BEATS, seed);

    const lastSummaries = (opts.pairMemory?.lastSummaries || [])
      .map((s) => safeTrim(s, 180))
      .filter(Boolean)
      .slice(0, 2);

    const memoryBlock = lastSummaries.length > 0
      ? `LAST TIME (avoid repeating):\n${lastSummaries.map((s) => `  - ${s}`).join('\n')}`
      : '';

    const settingLine = `SETTING: ${opts.town.name} (Lv${opts.town.level}) — "${safeTrim(opts.town.theme, 80)}" | ${opts.town.builtPlots}/${opts.town.totalPlots} built`;

    const pickLong = (opts.relationship?.status && opts.relationship.status !== 'NEUTRAL') || (opts.relationship?.interactions ?? 0) >= 3;
    const targetLines = pickLong ? 6 : 4;
    const startSpeaker: 'A' | 'B' = seed % 2 === 0 ? 'A' : 'B';

    const transcript: Array<{ speaker: 'A' | 'B'; text: string }> = [];
    const usedTexts = new Set<string>();

    for (let i = 0; i < targetLines; i++) {
      const speaker: 'A' | 'B' = ((startSpeaker === 'A' ? i : i + 1) % 2 === 0) ? 'A' : 'B';
      const me = speaker === 'A' ? opts.agentA : opts.agentB;
      const them = speaker === 'A' ? opts.agentB : opts.agentA;
      const myVoice = speaker === 'A' ? voiceA : voiceB;
      const theirVoice = speaker === 'A' ? voiceB : voiceA;
      const myActivity = speaker === 'A' ? activityA : activityB;
      const theirActivity = speaker === 'A' ? activityB : activityA;

      const systemPrompt =
        `MODE: TURN_LINE\n` +
        `You are writing ONE line of dialogue for a reality-TV town simulation.\n` +
        `\n` +
        `You are: ${me.name} [${me.archetype}]\n` +
        `Voice: ${myVoice}\n` +
        `Other: ${them.name} [${them.archetype}]\n` +
        `Other voice (for contrast only): ${theirVoice}\n` +
        `\n` +
        `RULES:\n` +
        `- STRICT JSON only: {"text":"..."}\n` +
        `- Max 120 characters.\n` +
        `- Must respond to the last line in the transcript.\n` +
        `- No greetings. No repeated openers. No generic NPC filler.\n` +
        `- Add tension: negotiate, roast, probe, flex, or threaten.\n` +
        `- Include at least ONE concrete detail (a building name, $ARENA amount, ROI %, recent event, or relationship score).\n`;

      const userPrompt =
        `${settingLine}\n` +
        `${relLine}\n` +
        `BEAT: ${beat}\n` +
        `${topic ? `TOPIC: ${topic}\n` : ''}` +
        `${openerHint ? `OPENER HINT (optional): ${openerHint}\n` : ''}` +
        `\n` +
        `YOU:\n` +
        `- Bankroll: ${me.bankroll} $ARENA | Reserve: ${me.reserveBalance}\n` +
        `${me.systemPrompt ? `- Creator note: ${safeTrim(me.systemPrompt, 160)}\n` : ''}` +
        `${myActivity ? `${myActivity}\n` : ''}` +
        `\n` +
        `THEM:\n` +
        `- Bankroll: ${them.bankroll} $ARENA | Reserve: ${them.reserveBalance}\n` +
        `${them.systemPrompt ? `- Creator note: ${safeTrim(them.systemPrompt, 160)}\n` : ''}` +
        `${theirActivity ? `${theirActivity}\n` : ''}` +
        `\n` +
        `${memoryBlock ? `${memoryBlock}\n\n` : ''}` +
        `TRANSCRIPT SO FAR:\n` +
        `${formatTranscript(transcript)}\n` +
        `\n` +
        `Write your next line now.`;

      let lineText = '';
      try {
        const response = await smartAiService.callModel(
          spec,
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          0.9,
        );

        const content = repairJson(response.content || '');
        const parsed = JSON.parse(content) as any;
        lineText = safeTrim(parsed?.text, 120);
      } catch {
        lineText = safeTrim(getLineFallback(me.archetype, seed + i), 120);
      }

      if (!lineText) {
        lineText = safeTrim(getLineFallback(me.archetype, seed + i + 1337), 120);
      }

      // Avoid exact repeats within the same conversation.
      if (usedTexts.has(lineText.toLowerCase())) {
        lineText = safeTrim(getLineFallback(me.archetype, seed + i + 4242), 120);
      }
      usedTexts.add(lineText.toLowerCase());
      transcript.push({ speaker, text: lineText });
    }

    // Evaluate outcome/intent/summary in one lightweight call.
    let outcome: ConversationOutcome = 'NEUTRAL';
    let delta = 0;
    let economicIntent: EconomicIntent = 'NONE';
    let summary = 'Two agents exchanged a few words.';

    try {
      const evalSystem =
        `MODE: EVAL\n` +
        `You are the relationship scorekeeper and reality-TV narrator.\n` +
        `STRICT JSON only.\n` +
        `\n` +
        `Return:\n` +
        `{"outcome":"NEUTRAL"|"BOND"|"BEEF","delta":<int -7..+7>,"economicIntent":"TIP"|"COLLAB"|"HUSTLE"|"FLEX"|"NONE","summary":"<one punchy sentence>"}`;

      const evalUser =
        `${settingLine}\n` +
        `${relLine}\n` +
        `BEAT: ${beat}\n` +
        `\n` +
        `AGENT A: ${opts.agentA.name} [${opts.agentA.archetype}] — Bankroll ${opts.agentA.bankroll} | Reserve ${opts.agentA.reserveBalance}\n` +
        `AGENT B: ${opts.agentB.name} [${opts.agentB.archetype}] — Bankroll ${opts.agentB.bankroll} | Reserve ${opts.agentB.reserveBalance}\n` +
        `\n` +
        `TRANSCRIPT:\n` +
        `${formatTranscript(transcript)}\n`;

      const evalRes = await smartAiService.callModel(
        spec,
        [
          { role: 'system', content: evalSystem },
          { role: 'user', content: evalUser },
        ],
        0.7,
      );

      const evalParsed = JSON.parse(repairJson(evalRes.content || '')) as any;
      const outcomeRaw = safeTrim(evalParsed?.outcome, 8).toUpperCase();
      outcome = outcomeRaw === 'BOND' ? 'BOND' : outcomeRaw === 'BEEF' ? 'BEEF' : 'NEUTRAL';
      delta = clampInt(Number(evalParsed?.delta), -7, 7);
      summary = safeTrim(evalParsed?.summary, 180) || summary;
      const intentRaw = safeTrim(evalParsed?.economicIntent, 10).toUpperCase() as EconomicIntent;
      economicIntent = VALID_INTENTS.has(intentRaw) ? intentRaw : 'NONE';
    } catch {
      // keep defaults
    }

    const lines: ConversationLine[] = transcript.map((l) => ({
      agentId: l.speaker === 'A' ? opts.agentA.id : opts.agentB.id,
      text: safeTrim(l.text, 120) || '…',
    }));

    if (lines.length < 2) {
      return {
        lines: getFallbackLines(opts.agentA.archetype, opts.agentB.archetype, opts.agentA.id, opts.agentB.id, seed),
        outcome: 'NEUTRAL',
        delta: 0,
        summary,
        modelUsed: spec.modelName,
        economicIntent: 'NONE',
      };
    }

    return { lines, outcome, delta, summary, modelUsed: spec.modelName, economicIntent };
  },
};
