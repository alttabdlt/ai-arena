/**
 * TelegramBotService — Conversational AI interface for AI Town.
 *
 * Users chat naturally with the bot. An LLM routes their intent to the right action.
 * No slash commands needed (though they still work as shortcuts).
 *
 * Examples:
 *   "who's winning?" → show_agents
 *   "tell alphashark to go attack" → tell_agent
 *   "start the game" → start_agents
 *   "what's the token price?" → show_token
 */

import { Telegraf } from 'telegraf';
import { townService } from './townService';
import { agentLoopService, AgentTickResult } from './agentLoopService';
import { prisma } from '../config/database';
import OpenAI from 'openai';

// Escape HTML special chars for Telegram HTML parse mode
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// ============================================
// Tool definitions for LLM router
// ============================================

const ROUTER_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'show_agents',
      description: 'Show the agent leaderboard — who is winning, agent stats, rankings, ELO, bankroll',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_town',
      description: 'Show current town status — progress, buildings count, investment, theme',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_buildings',
      description: 'List all buildings in the town',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_building_detail',
      description: 'Show detailed info about a specific building by plot number',
      parameters: {
        type: 'object',
        properties: { plotIndex: { type: 'number', description: 'Plot number to inspect' } },
        required: ['plotIndex'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_stats',
      description: 'Show world statistics — total towns, agents, API calls, compute cost, yield paid',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_token',
      description: 'Show $ARENA token info — address, links, explanation',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_map',
      description: 'Show the town plot map grid',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_wheel',
      description: 'Show Wheel of Fate status — current/next fight, phase, last result',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'place_bet',
      description: 'Place a bet on an agent in the current Wheel of Fate fight',
      parameters: {
        type: 'object',
        properties: {
          agentName: { type: 'string', description: 'Name of the agent to bet on' },
          amount: { type: 'number', description: 'Amount of $ARENA to bet' },
        },
        required: ['agentName', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'tell_agent',
      description: 'Send a message/instruction to a specific AI agent. The agent will consider it and may or may not follow it.',
      parameters: {
        type: 'object',
        properties: {
          agentName: { type: 'string', description: 'Name of the agent to talk to' },
          message: { type: 'string', description: 'Message or instruction for the agent' },
        },
        required: ['agentName', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_agents',
      description: 'Start the agent loop — agents begin thinking, building, and fighting autonomously',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stop_agents',
      description: 'Stop/pause the agent loop',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_tick',
      description: 'Manually trigger one agent tick (all agents act once)',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enable_stream',
      description: 'Enable live activity streaming to this chat',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_town',
      description: 'Create a new town for agents to build in',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Town name (optional)' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_events',
      description: 'Show recent town events',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'general_chat',
      description: 'Just chatting, greeting, or asking about AI Town in general — no specific action needed. Use this for greetings, questions about how AI Town works, or casual conversation.',
      parameters: {
        type: 'object',
        properties: { response: { type: 'string', description: 'Your conversational response' } },
        required: ['response'],
      },
    },
  },
];

const ROUTER_SYSTEM_PROMPT = `You are the AI Town bot — a conversational interface to a virtual town where autonomous AI agents build, trade $ARENA tokens, and fight each other in Poker duels.

Your job: understand what the user wants and call the right tool. Be natural and conversational.

Key context:
- AI Town has autonomous AI agents (AlphaShark, MorphBot, YoloDegen, MathEngine, Sophia the Wise) that build buildings, trade $ARENA, and fight in Wheel of Fate poker duels
- $ARENA is the in-game token on Monad blockchain
- Wheel of Fate randomly pits 2 agents against each other every ~15 minutes
- Users can bet on fights, talk to agents, and watch the action
- Each agent has a personality: SHARK (aggressive), CHAMELEON (adaptive), DEGEN (chaotic), GRINDER (mathematical)
- "Proof of Inference" — every building step costs a real LLM API call

When users ask about agents, fights, buildings, or the town — use the appropriate tool.
When users want to talk to an agent — use tell_agent.
When it's just casual chat or questions about AI Town — use general_chat with a friendly, informative response.

Keep responses punchy and fun. This is a crypto degen entertainment product.`;

export class TelegramBotService {
  private bot: Telegraf | null = null;
  private chatId: string | null = null;
  private router: OpenAI | null = null;
  private routerModel: string = 'gemini-2.0-flash';

  async start(token: string, chatId?: string): Promise<void> {
    if (!token) {
      console.log('⚠️  No Telegram bot token — bot disabled');
      return;
    }

    this.bot = new Telegraf(token);
    this.chatId = chatId || process.env.TELEGRAM_CHAT_ID || null;

    // Initialize LLM router — prefer Gemini Flash (fast + cheap), fall back to others
    this.initRouter();
    this.registerCommands();

    // Catch errors instead of crashing
    this.bot.catch((err: any) => {
      console.error('Telegram bot error (caught):', err.message);
    });

    this.bot.launch().catch((err) => {
      console.error('Telegram bot launch error:', err.message);
    });

    console.log(`📱 Telegram bot started${this.chatId ? ` (streaming to ${this.chatId})` : ''}${this.router ? ` [NL router: ${this.routerModel}]` : ' [no NL router — slash commands only]'}`);

    // Hook into agent loop for live broadcasting
    agentLoopService.onTickResult = (result) => {
      this.broadcastTickResult(result);
    };

    process.once('SIGINT', () => this.bot?.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot?.stop('SIGTERM'));
  }

  private initRouter(): void {
    // Prefer OpenRouter (single key, all models), then Gemini direct, then OpenAI, then DeepSeek
    if (process.env.OPENROUTER_API_KEY) {
      this.router = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
        timeout: 15000,
        defaultHeaders: {
          'HTTP-Referer': 'https://ai-town.xyz',
          'X-Title': 'AI Town',
        },
      });
      this.routerModel = 'google/gemini-2.0-flash-001';
    } else if (process.env.GEMINI_API_KEY) {
      this.router = new OpenAI({
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        timeout: 15000,
      });
      this.routerModel = 'gemini-2.0-flash';
    } else if (process.env.OPENAI_API_KEY) {
      this.router = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 15000 });
      this.routerModel = 'gpt-4o-mini';
    } else if (process.env.DEEPSEEK_API_KEY) {
      this.router = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com/v1',
        timeout: 15000,
      });
      this.routerModel = 'deepseek-chat';
    }
  }

  stop(): void {
    this.bot?.stop();
    this.bot = null;
    console.log('📱 Telegram bot stopped');
  }

  // Safe send — always falls back to plain text
  private async send(chatId: string | number, html: string): Promise<void> {
    if (!this.bot) return;
    try {
      await this.bot.telegram.sendMessage(chatId, html, { parse_mode: 'HTML' });
    } catch {
      try {
        const plain = html.replace(/<[^>]*>/g, '');
        await this.bot.telegram.sendMessage(chatId, plain);
      } catch (err: any) {
        console.error('Failed to send Telegram message:', err.message);
      }
    }
  }

  // ============================================
  // Command & Message Registration
  // ============================================

  private registerCommands(): void {
    if (!this.bot) return;

    // Keep slash commands as shortcuts (power users)
    this.bot.command('start', (ctx) => this.handleStart(ctx));
    this.bot.command('town', (ctx) => this.handleShowTown(ctx.chat.id));
    this.bot.command('agents', (ctx) => this.handleShowAgents(ctx.chat.id));
    this.bot.command('events', (ctx) => this.handleShowEvents(ctx.chat.id));
    this.bot.command('buildings', (ctx) => this.handleShowBuildings(ctx.chat.id));
    this.bot.command('building', (ctx) => {
      const idx = parseInt(ctx.message.text.split(' ')[1], 10);
      this.handleShowBuildingDetail(ctx.chat.id, idx);
    });
    this.bot.command('stats', (ctx) => this.handleShowStats(ctx.chat.id));
    this.bot.command('plots', (ctx) => this.handleShowMap(ctx.chat.id));
    this.bot.command('stream', (ctx) => this.handleEnableStream(ctx.chat.id));
    this.bot.command('token', (ctx) => this.handleShowToken(ctx.chat.id));
    this.bot.command('go', (ctx) => this.handleStartAgents(ctx.chat.id));
    this.bot.command('stop', (ctx) => this.handleStopAgents(ctx.chat.id));
    this.bot.command('tick', (ctx) => this.handleRunTick(ctx.chat.id));
    this.bot.command('wheel', (ctx) => this.handleShowWheel(ctx.chat.id));
    this.bot.command('newtown', (ctx) => {
      const name = ctx.message.text.split(' ').slice(1).join(' ').trim();
      this.handleCreateTown(ctx.chat.id, name);
    });
    this.bot.command('bet', (ctx) => {
      const parts = ctx.message.text.replace(/^\/bet\s*/i, '').trim();
      const firstSpace = parts.indexOf(' ');
      if (firstSpace === -1) { this.handleShowWheel(ctx.chat.id); return; }
      const agentName = parts.slice(0, firstSpace).trim();
      const amount = parseInt(parts.slice(firstSpace + 1).trim(), 10);
      this.handlePlaceBet(ctx.chat.id, ctx.from?.id?.toString() || ctx.chat.id.toString(), agentName, amount);
    });
    this.bot.command('tell', (ctx) => {
      const parts = ctx.message.text.replace(/^\/tell\s*/i, '').trim();
      const firstSpace = parts.indexOf(' ');
      if (firstSpace === -1) return;
      const agentName = parts.slice(0, firstSpace).trim();
      const message = parts.slice(firstSpace + 1).trim();
      const fromUser = ctx.from?.first_name || ctx.from?.username || 'Anon';
      this.handleTellAgent(ctx.chat.id, agentName, message, fromUser);
    });

    // ============================================
    // Natural language handler — the main entry point
    // ============================================
    this.bot.on('text', async (ctx) => {
      if (ctx.message.text.startsWith('/')) return;
      const text = ctx.message.text.trim();
      if (!text) return;

      const fromUser = ctx.from?.first_name || ctx.from?.username || 'Anon';
      const chatId = ctx.chat.id;
      const userId = ctx.from?.id?.toString() || chatId.toString();

      // If no LLM router, fall back to simple pattern matching
      if (!this.router) {
        await this.fallbackRouting(chatId, text, fromUser);
        return;
      }

      try {
        await this.routeWithLLM(chatId, userId, text, fromUser);
      } catch (err: any) {
        console.error('LLM routing error:', err.message);
        // Fall back to pattern matching on LLM failure
        await this.fallbackRouting(chatId, text, fromUser);
      }
    });
  }

  // ============================================
  // LLM Natural Language Router
  // ============================================

  private async routeWithLLM(chatId: number, userId: string, text: string, fromUser: string): Promise<void> {
    const startTime = Date.now();

    // Gather quick context for the LLM
    const isRunning = agentLoopService.isRunning();
    let wheelPhase = 'UNKNOWN';
    try {
      const { wheelOfFateService } = await import('./wheelOfFateService');
      wheelPhase = wheelOfFateService.getStatus().phase;
    } catch {}

    const contextNote = `[Agent loop: ${isRunning ? 'RUNNING' : 'STOPPED'} | Wheel: ${wheelPhase} | User: ${fromUser}]`;

    const response = await this.router!.chat.completions.create({
      model: this.routerModel,
      messages: [
        { role: 'system', content: ROUTER_SYSTEM_PROMPT },
        { role: 'user', content: `${contextNote}\n\n${text}` },
      ],
      tools: ROUTER_TOOLS,
      tool_choice: 'required',
      temperature: 0.3,
      max_tokens: 300,
    });

    const latencyMs = Date.now() - startTime;
    const msg = response.choices[0]?.message;

    if (!msg?.tool_calls?.length) {
      // No tool call — shouldn't happen with tool_choice: required, but handle gracefully
      const fallbackText = msg?.content || "Hmm, I didn't quite get that. Try asking about agents, the town, or fights!";
      await this.send(chatId, fallbackText);
      return;
    }

    // Execute the tool call
    const toolCall = msg.tool_calls[0];
    const fn = toolCall.function.name;
    let args: any = {};
    try { args = JSON.parse(toolCall.function.arguments || '{}'); } catch {}

    console.log(`📱 NL route: "${truncate(text, 50)}" → ${fn}(${JSON.stringify(args)}) [${latencyMs}ms]`);

    switch (fn) {
      case 'show_agents': await this.handleShowAgents(chatId); break;
      case 'show_town': await this.handleShowTown(chatId); break;
      case 'show_buildings': await this.handleShowBuildings(chatId); break;
      case 'show_building_detail': await this.handleShowBuildingDetail(chatId, args.plotIndex); break;
      case 'show_stats': await this.handleShowStats(chatId); break;
      case 'show_token': await this.handleShowToken(chatId); break;
      case 'show_map': await this.handleShowMap(chatId); break;
      case 'show_wheel': await this.handleShowWheel(chatId); break;
      case 'show_events': await this.handleShowEvents(chatId); break;
      case 'place_bet': await this.handlePlaceBet(chatId, userId, args.agentName, args.amount); break;
      case 'tell_agent': await this.handleTellAgent(chatId, args.agentName, args.message, fromUser); break;
      case 'start_agents': await this.handleStartAgents(chatId); break;
      case 'stop_agents': await this.handleStopAgents(chatId); break;
      case 'run_tick': await this.handleRunTick(chatId); break;
      case 'enable_stream': await this.handleEnableStream(chatId); break;
      case 'create_town': await this.handleCreateTown(chatId, args.name); break;
      case 'general_chat': await this.send(chatId, args.response || "Hey! Ask me about agents, fights, or the town 🏘️"); break;
      default: await this.send(chatId, `🤔 I understood "${fn}" but don't know how to do that yet.`);
    }
  }

  // ============================================
  // Fallback pattern matching (no LLM needed)
  // ============================================

  private async fallbackRouting(chatId: number, text: string, fromUser: string): Promise<void> {
    const lower = text.toLowerCase();

    // Try agent name match first (existing free-text behavior)
    const agents = await prisma.arenaAgent.findMany({ where: { isActive: true }, select: { id: true, name: true, archetype: true } });
    for (const a of agents) {
      const nameLower = a.name.toLowerCase();
      if (lower.startsWith(nameLower) && lower.length > nameLower.length && /^[,:\s]/.test(lower.slice(nameLower.length))) {
        const message = text.slice(a.name.length).replace(/^[,:\s]+/, '').trim();
        if (message.length >= 3) {
          await this.handleTellAgent(chatId, a.name, message, fromUser);
          return;
        }
      }
    }

    // Keyword fallback
    if (/\bagents?\b|\bwho.*win|\bleaderboard|\branking/i.test(lower)) { await this.handleShowAgents(chatId); return; }
    if (/\btown\b|\bprogress\b/i.test(lower)) { await this.handleShowTown(chatId); return; }
    if (/\bbuild/i.test(lower)) { await this.handleShowBuildings(chatId); return; }
    if (/\bwheel\b|\bfight\b|\bduel\b|\bmatch/i.test(lower)) { await this.handleShowWheel(chatId); return; }
    if (/\btoken\b|\bprice\b|\barena\b/i.test(lower)) { await this.handleShowToken(chatId); return; }
    if (/\bstat/i.test(lower)) { await this.handleShowStats(chatId); return; }
    if (/\bstart\b|\bgo\b|\brun\b/i.test(lower)) { await this.handleStartAgents(chatId); return; }
    if (/\bstop\b|\bpause\b/i.test(lower)) { await this.handleStopAgents(chatId); return; }

    // Nothing matched
    await this.send(chatId,
      '🏘️ <b>AI Town</b> — just chat naturally!\n\n' +
      'Try: "who\'s winning?", "show me the town", "tell AlphaShark to attack", "what\'s the token price?"',
    );
  }

  // ============================================
  // Action Handlers
  // ============================================

  private async handleStart(ctx: any): Promise<void> {
    this.send(ctx.chat.id,
      '🏘️ <b>Welcome to AI Town!</b>\n\n' +
      'Autonomous AI agents build towns, trade $ARENA, and fight in Poker duels. <b>Just chat with me naturally!</b>\n\n' +
      '💬 Try:\n' +
      '• "who\'s winning?"\n' +
      '• "show me the town"\n' +
      '• "tell AlphaShark to claim a plot"\n' +
      '• "start the game"\n' +
      '• "what\'s the wheel status?"\n' +
      '• "bet 100 on MorphBot"\n\n' +
      'The agents have personalities. They might listen to you... or not 😏',
    );
  }

  private async handleShowTown(chatId: number | string): Promise<void> {
    try {
      const town = await this.getAnyTown();
      if (!town) { await this.send(chatId, 'No active town yet. Try "create a new town"!'); return; }

      const built = town.plots.filter((p: any) => p.status === 'BUILT').length;
      const constructing = town.plots.filter((p: any) => p.status === 'UNDER_CONSTRUCTION').length;
      const claimed = town.plots.filter((p: any) => p.status === 'CLAIMED').length;
      const empty = town.plots.filter((p: any) => p.status === 'EMPTY').length;
      const bar = this.makeProgressBar(town.completionPct);

      await this.send(chatId,
        `🏘️ <b>${esc(town.name)}</b>\n` +
        `📍 Theme: <i>${esc(town.theme)}</i>\n` +
        `📊 Level ${town.level} | ${town.status}\n\n` +
        `${bar} ${town.completionPct.toFixed(1)}%\n\n` +
        `✅ Built: ${built}  🔨 Building: ${constructing}\n` +
        `📍 Claimed: ${claimed}  ⬜ Empty: ${empty}\n\n` +
        `💰 Invested: ${town.totalInvested} $ARENA\n` +
        `🎯 Yield: ${town.yieldPerTick} $ARENA/tick`,
      );
    } catch (err: any) {
      await this.send(chatId, `❌ Error: ${err.message}`);
    }
  }

  private async handleShowAgents(chatId: number | string): Promise<void> {
    try {
      const agents = await prisma.arenaAgent.findMany({
        where: { isActive: true },
        orderBy: { bankroll: 'desc' },
        take: 12,
      });

      const lines = agents.map((a, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        return `${medal} <b>${esc(a.name)}</b> (${a.archetype})\n   💰 ${a.bankroll} $ARENA | ELO ${a.elo} | HP ${a.health}`;
      });

      await this.send(chatId, `👥 <b>Agent Leaderboard</b>\n\n${lines.join('\n\n')}`);
    } catch (err: any) {
      await this.send(chatId, `❌ Error: ${err.message}`);
    }
  }

  private async handleShowEvents(chatId: number | string): Promise<void> {
    try {
      const town = await this.getAnyTown();
      if (!town) { await this.send(chatId, 'No active town.'); return; }
      const events = await townService.getRecentEvents(town.id, 10);
      if (events.length === 0) { await this.send(chatId, 'No events yet.'); return; }

      const lines = events.map((e: any) => {
        const time = new Date(e.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return `[${time}] ${esc(e.title || '')}\n${esc(truncate(e.description || '', 120))}`;
      });

      await this.send(chatId, `📰 <b>Recent Events</b>\n\n${lines.join('\n\n')}`);
    } catch (err: any) {
      await this.send(chatId, `❌ Error: ${err.message}`);
    }
  }

  private async handleShowBuildings(chatId: number | string): Promise<void> {
    try {
      const town = await this.getAnyTown();
      if (!town) { await this.send(chatId, 'No town yet.'); return; }

      const activePlots = town.plots.filter((p: any) => p.status === 'BUILT' || p.status === 'UNDER_CONSTRUCTION');
      if (activePlots.length === 0) { await this.send(chatId, 'No buildings yet. Agents need to start building!'); return; }

      let summary = `🏘️ <b>${esc(town.name)} — Buildings</b>\n\n`;
      for (const plot of activePlots) {
        const emoji = plot.status === 'BUILT' ? '✅' : '🔨';
        const name = plot.buildingName || plot.buildingType || '?';
        const calls = plot.apiCallsUsed || 0;
        summary += `${emoji} [${plot.plotIndex}] <b>${esc(truncate(name, 25))}</b> (${calls} API calls)\n`;
      }

      await this.send(chatId, summary);
    } catch (err: any) {
      await this.send(chatId, `❌ Error: ${err.message}`);
    }
  }

  private async handleShowBuildingDetail(chatId: number | string, plotIndex: number): Promise<void> {
    try {
      if (isNaN(plotIndex)) { await this.send(chatId, 'Which building? Give me a plot number.'); return; }

      const town = await this.getAnyTown();
      if (!town) { await this.send(chatId, 'No town yet.'); return; }

      const plot = town.plots.find((p: any) => p.plotIndex === plotIndex);
      if (!plot) { await this.send(chatId, `Plot ${plotIndex} not found.`); return; }
      if (plot.status === 'EMPTY') { await this.send(chatId, `Plot ${plotIndex} is empty.`); return; }

      const owner = await prisma.arenaAgent.findUnique({ where: { id: plot.ownerId || '' } });
      const statusEmoji = plot.status === 'BUILT' ? '✅' : plot.status === 'UNDER_CONSTRUCTION' ? '🔨' : '📍';

      let msg = `${statusEmoji} <b>${esc(plot.buildingName || plot.buildingType || '?')}</b>\n`;
      msg += `📍 Plot ${plot.plotIndex} | ${plot.zone} | ${plot.buildingType}\n`;
      msg += `👤 Owner: ${esc(owner?.name || 'Unknown')} (${owner?.archetype || '?'})\n`;
      msg += `🧠 ${plot.apiCallsUsed} inference calls | 💰 ${plot.buildCostArena ?? 0} $ARENA\n\n`;

      try {
        const data = JSON.parse(plot.buildingData || '{}');
        const steps = Object.entries(data).filter(([k]) => !k.startsWith('_')).slice(0, 3);
        for (const [_key, val] of steps) {
          const step = val as any;
          if (step.output) {
            msg += `📝 <b>${esc(truncate(step.description || 'Design', 50))}</b>\n`;
            msg += `<i>${esc(truncate(step.output, 400))}</i>\n\n`;
          }
        }
        if (steps.length === 0 && plot.buildingDesc) {
          msg += `<i>${esc(truncate(plot.buildingDesc, 400))}</i>`;
        }
      } catch {}

      await this.send(chatId, msg);
    } catch (err: any) {
      await this.send(chatId, `❌ Error: ${err.message}`);
    }
  }

  private async handleShowStats(chatId: number | string): Promise<void> {
    try {
      const stats = await townService.getWorldStats();
      await this.send(chatId,
        `📊 <b>World Statistics</b>\n\n` +
        `🏘️ Towns: ${stats.totalTowns} (${stats.completedTowns} complete)\n` +
        `👥 Agents: ${stats.totalAgents}\n` +
        `💰 Invested: ${stats.totalArenaInvested} $ARENA\n` +
        `🧠 Proof of Inference: ${stats.totalApiCalls} API calls\n` +
        `💵 Compute cost: $${(stats.totalApiCostCents / 100).toFixed(2)}\n` +
        `🎁 Yield paid: ${stats.totalYieldPaid} $ARENA`,
      );
    } catch (err: any) {
      await this.send(chatId, `❌ Error: ${err.message}`);
    }
  }

  private async handleShowToken(chatId: number | string): Promise<void> {
    const addr = process.env.ARENA_TOKEN_ADDRESS || '0x0bA5E04470Fe327AC191179Cf6823E667B007777';
    const nadUrl = `https://nad.fun/tokens/${addr}`;
    const explorerUrl = `https://explorer.monad.xyz/address/${addr}`;
    await this.send(chatId,
      `🪙 <b>$ARENA Token</b>\n\n` +
      `<b>Name:</b> Arena Town\n` +
      `<b>Symbol:</b> $ARENA\n` +
      `<b>Network:</b> Monad Testnet\n` +
      `<b>Address:</b> <code>${addr}</code>\n\n` +
      `Every building costs $ARENA. Completed towns yield passive $ARENA. The real cost? LLM inference — every design step is a real API call.\n\n` +
      `<a href="${nadUrl}">📈 Trade on nad.fun</a>  |  <a href="${explorerUrl}">🔍 Explorer</a>`,
    );
  }

  private async handleShowMap(chatId: number | string): Promise<void> {
    try {
      const town = await this.getAnyTown();
      if (!town) { await this.send(chatId, 'No active town.'); return; }

      const gridSize = Math.ceil(Math.sqrt(town.totalPlots));
      let grid = '';
      for (let y = 0; y < gridSize; y++) {
        let row = '';
        for (let x = 0; x < gridSize; x++) {
          const idx = y * gridSize + x;
          if (idx >= town.totalPlots) { row += '  '; continue; }
          const plot = town.plots.find((p: any) => p.plotIndex === idx);
          if (!plot) { row += '⬜'; continue; }
          switch (plot.status) {
            case 'BUILT': row += '🏠'; break;
            case 'UNDER_CONSTRUCTION': row += '🔨'; break;
            case 'CLAIMED': row += '📍'; break;
            default: row += '⬜';
          }
        }
        grid += row + '\n';
      }

      await this.send(chatId,
        `🗺️ <b>${esc(town.name)} — Map</b>\n\n${grid}\n⬜ Empty  📍 Claimed  🔨 Building  🏠 Built`,
      );
    } catch (err: any) {
      await this.send(chatId, `❌ Error: ${err.message}`);
    }
  }

  private async handleShowWheel(chatId: number | string): Promise<void> {
    try {
      const { wheelOfFateService } = await import('./wheelOfFateService');
      const status = wheelOfFateService.getStatus();
      const emoji = status.phase === 'FIGHTING' ? '⚔️' : status.phase === 'ANNOUNCING' ? '🎰' : status.phase === 'AFTERMATH' ? '🏆' : '⏳';

      if (status.phase === 'IDLE' || status.phase === 'PREP') {
        const nextIn = status.nextSpinAt ? Math.max(0, Math.round((status.nextSpinAt.getTime() - Date.now()) / 1000)) : '?';
        await this.send(chatId,
          `🎡 <b>Wheel of Fate</b>\n\n` +
          `Status: ${emoji} ${status.phase}\n` +
          `Next fight in: <b>${nextIn}s</b>\n` +
          `Cycle: #${status.cycleCount}\n\n` +
          `${status.lastResult ? `Last: ${esc(status.lastResult.winnerName)} beat ${esc(status.lastResult.loserName)} (${status.lastResult.gameType}, pot ${status.lastResult.pot})` : 'No fights yet.'}`,
        );
      } else if (status.currentMatch) {
        const m = status.currentMatch;
        let msg = `${emoji} <b>Wheel of Fate — ${status.phase}</b>\n\n`;
        msg += `🥊 <b>${esc(m.agent1.name)}</b> (${m.agent1.archetype}) vs <b>${esc(m.agent2.name)}</b> (${m.agent2.archetype})\n`;
        msg += `💰 Wager: ${m.wager} $ARENA each\n`;

        if (status.phase === 'ANNOUNCING' && status.bettingEndsIn) {
          msg += `\n⏱️ Betting closes in <b>${Math.round(status.bettingEndsIn / 1000)}s</b>!\n`;
          msg += `Say: "bet 100 on ${m.agent1.name}"`;
        }

        if (status.lastResult) {
          msg += `\n\n🏆 Winner: <b>${esc(status.lastResult.winnerName)}</b>`;
          if (status.lastResult.winnerQuip) {
            msg += `\n<i>"${esc(status.lastResult.winnerQuip)}"</i>`;
          }
        }

        await this.send(chatId, msg);
      }
    } catch (err: any) {
      await this.send(chatId, `❌ Error: ${err.message}`);
    }
  }

  private async handlePlaceBet(chatId: number | string, userId: string, agentName: string, amount: number): Promise<void> {
    try {
      if (!agentName || !Number.isFinite(amount) || amount <= 0) {
        await this.send(chatId, '🎲 Say something like: "bet 200 on AlphaShark"');
        return;
      }

      const { wheelOfFateService } = await import('./wheelOfFateService');
      const status = wheelOfFateService.getStatus();

      if (status.phase !== 'ANNOUNCING') {
        await this.send(chatId, `❌ Betting only open during ANNOUNCING phase. Current: ${status.phase}${status.nextSpinAt ? `. Next fight ~${Math.round((status.nextSpinAt.getTime() - Date.now()) / 1000)}s` : ''}`);
        return;
      }

      if (!status.currentMatch) { await this.send(chatId, '❌ No active match.'); return; }

      const m = status.currentMatch;
      const agent = await this.fuzzyFindAgent(agentName);
      if (!agent) {
        await this.send(chatId, `❌ No agent "${agentName}". Fighting: ${m.agent1.name} vs ${m.agent2.name}`);
        return;
      }

      const isAgent1 = agent.id === m.agent1.id;
      const isAgent2 = agent.id === m.agent2.id;
      if (!isAgent1 && !isAgent2) {
        await this.send(chatId, `❌ ${agent.name} isn't in this fight.\nFighting: ${m.agent1.name} vs ${m.agent2.name}`);
        return;
      }

      const { predictionService } = await import('./predictionService');
      if (!m.marketId) { await this.send(chatId, '❌ No prediction market for this fight.'); return; }

      const side: 'A' | 'B' = isAgent1 ? 'A' : 'B';
      const tgWallet = `tg:${userId}`;

      let balance = await prisma.userBalance.findUnique({ where: { walletAddress: tgWallet } });
      if (!balance) {
        balance = await prisma.userBalance.create({ data: { walletAddress: tgWallet, balance: 1000 } });
        await this.send(chatId, `🎁 Welcome! You've been given <b>1,000 $ARENA</b> betting chips.`);
      }

      if (balance.balance < amount) {
        await this.send(chatId, `❌ Insufficient balance. You have ${balance.balance} $ARENA.`);
        return;
      }

      await predictionService.placeBet(tgWallet, m.marketId, side, amount);
      const emoji = this.archetypeEmoji(agent.archetype);
      await this.send(chatId,
        `${emoji} <b>Bet placed!</b>\n\n${amount} $ARENA on <b>${esc(agent.name)}</b>\n💰 Balance: ${balance.balance - amount} $ARENA`,
      );
    } catch (err: any) {
      await this.send(chatId, `❌ Bet failed: ${err.message}`);
    }
  }

  private async handleTellAgent(chatId: number | string, agentName: string, message: string, fromUser: string): Promise<void> {
    if (!message || message.length < 2) {
      await this.send(chatId, '💬 What do you want to tell them?');
      return;
    }

    const agent = await this.fuzzyFindAgent(agentName);
    if (!agent) {
      const agents = await prisma.arenaAgent.findMany({ where: { isActive: true }, select: { name: true }, take: 10 });
      await this.send(chatId, `❌ No agent matching "${agentName}"\n\nAgents: ${agents.map(a => a.name).join(', ')}`);
      return;
    }

    agentLoopService.queueInstruction(agent.id, message, chatId.toString(), fromUser);

    const emoji = this.archetypeEmoji(agent.archetype);
    const isRunning = agentLoopService.isRunning();
    const status = isRunning
      ? (agent.archetype === 'DEGEN' ? "No promises they'll listen though... 🎲" : "They'll consider it next tick.")
      : "⚠️ Agents aren't running yet — say 'start' to fire them up!";

    await this.send(chatId,
      `${emoji} <b>${esc(agent.name)}</b> heard you:\n<i>"${esc(truncate(message, 200))}"</i>\n\n${status}`,
    );
  }

  private async handleStartAgents(chatId: number | string): Promise<void> {
    this.chatId = chatId.toString();
    if (agentLoopService.isRunning()) {
      await this.send(chatId, '⚠️ Agents are already running!');
      return;
    }
    agentLoopService.start(45000);
    await this.send(chatId, '🚀 <b>Agents are now LIVE!</b>\nTick every 45s. Actions will stream here.\nSay "stop" to pause.');
  }

  private async handleStopAgents(chatId: number | string): Promise<void> {
    if (!agentLoopService.isRunning()) {
      await this.send(chatId, '⚠️ Agents aren\'t running.');
      return;
    }
    agentLoopService.stop();
    await this.send(chatId, '⏸️ <b>Agents paused.</b> Say "start" to resume.');
  }

  private async handleRunTick(chatId: number | string): Promise<void> {
    this.chatId = chatId.toString();
    await this.send(chatId, '🤖 Running one tick...');
    try {
      const results = await agentLoopService.tick();
      for (const r of results) {
        await this.broadcastTickResult(r);
      }
      const town = await this.getAnyTown();
      const pct = town ? town.completionPct.toFixed(1) : '?';
      await this.send(chatId, `✅ <b>Tick complete</b> — ${results.length} agents acted\n📊 Town: ${pct}%`);
    } catch (err: any) {
      await this.send(chatId, `❌ Tick error: ${err.message}`);
    }
  }

  private async handleEnableStream(chatId: number | string): Promise<void> {
    this.chatId = chatId.toString();
    await this.send(chatId, '✅ <b>Live streaming enabled!</b>\nAgent actions will appear here in real-time.');
    console.log(`📱 Telegram streaming to chat ${this.chatId}`);
  }

  private async handleCreateTown(chatId: number | string, name?: string): Promise<void> {
    const townName = name?.trim() || `Town ${Date.now().toString(36).slice(-4)}`;
    await this.send(chatId, `🏗️ Creating <b>${esc(townName)}</b>...`);
    try {
      const town = await townService.createTown(townName);
      await this.send(chatId,
        `🎉 <b>${esc(town.name)}</b> founded!\n\n📍 ${town.totalPlots} plots\n🎨 Theme: <i>${esc(town.theme || 'random')}</i>\n\nSay "start" to let agents build!`,
      );
    } catch (err: any) {
      await this.send(chatId, `❌ Error: ${err.message}`);
    }
  }

  // ============================================
  // Agent Lookup
  // ============================================

  private async fuzzyFindAgent(query: string): Promise<{ id: string; name: string; archetype: string } | null> {
    const q = query.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!q) return null;

    const agents = await prisma.arenaAgent.findMany({
      where: { isActive: true },
      select: { id: true, name: true, archetype: true },
    });

    const exact = agents.find(a => a.name.toLowerCase() === query.toLowerCase());
    if (exact) return exact;

    const prefix = agents.find(a => a.name.toLowerCase().startsWith(q));
    if (prefix) return prefix;

    const contains = agents.find(a => a.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(q));
    if (contains) return contains;

    return null;
  }

  // ============================================
  // Broadcasting
  // ============================================

  async broadcastTickResult(result: AgentTickResult): Promise<void> {
    if (!this.bot || !this.chatId) return;

    if (!result.success) {
      await this.send(this.chatId, `❌ <b>${esc(result.agentName)}</b> failed: ${esc(truncate(result.narrative, 100))}`);
      return;
    }

    const archetypeEmoji = this.archetypeEmoji(result.archetype || '');
    const action = result.action;
    let msg = '';

    switch (action.type) {
      case 'claim_plot':
        msg = `${archetypeEmoji} <b>${esc(result.agentName)}</b> claimed plot ${action.details?.plotIndex ?? '?'} (${action.details?.zone || '?'})\n💬 <i>"${esc(truncate(action.reasoning || '', 200))}"</i>`;
        break;
      case 'start_build':
        msg = `🔨 <b>${esc(result.agentName)}</b> started building: <b>${esc(action.details?.buildingType || 'building')}</b>\n💬 <i>"${esc(truncate(action.reasoning || '', 200))}"</i>`;
        break;
      case 'do_work': {
        const narrative = result.narrative || '';
        const preview = narrative.includes('🔨') ? narrative.split('🔨')[1]?.trim() : narrative;
        msg = `🏗️ <b>${esc(result.agentName)}</b> worked on their building\n📝 <i>${esc(truncate(preview || action.reasoning || '', 250))}</i>`;
        break;
      }
      case 'complete_build':
        msg = `🎉🎉 <b>${esc(result.agentName)}</b> COMPLETED their building!\n${esc(truncate(result.narrative, 200))}`;
        break;
      case 'mine':
        msg = `⛏️ <b>${esc(result.agentName)}</b> mined $ARENA\n💬 <i>"${esc(truncate(action.reasoning || '', 150))}"</i>`;
        break;
      case 'play_arena':
        msg = `🎮 <b>${esc(result.agentName)}</b> heads to the arena!\n💬 <i>"${esc(truncate(action.reasoning || '', 150))}"</i>`;
        break;
      default:
        msg = `${this.actionEmoji(action.type)} <b>${esc(result.agentName)}</b> → ${action.type.replace(/_/g, ' ')}\n<i>${esc(truncate(action.reasoning || result.narrative, 200))}</i>`;
    }

    if (result.cost && result.cost.costCents > 0) {
      msg += `\n🧠 inference: $${(result.cost.costCents / 100).toFixed(4)}`;
    }

    await this.send(this.chatId, msg);

    // Send personalized replies to users who messaged agents
    if (result.instructionSenders && result.instructionSenders.length > 0) {
      const emoji = this.archetypeEmoji(result.archetype);
      const replyText = result.humanReply || result.action.reasoning || result.narrative || '';
      const actionLabel = result.action.type.replace(/_/g, ' ');
      const replyMsg =
        `${emoji} <b>${esc(result.agentName)}</b> says:\n\n` +
        `<i>"${esc(truncate(replyText, 500))}"</i>\n\n` +
        `→ Action: <b>${esc(actionLabel)}</b> ${result.success ? '✅' : '❌'}`;

      const sentChats = new Set<string>();
      for (const sender of result.instructionSenders) {
        if (sentChats.has(sender.chatId)) continue;
        sentChats.add(sender.chatId);
        await this.send(sender.chatId, replyMsg);
      }
    }
  }

  async broadcastMessage(text: string): Promise<void> {
    if (!this.bot || !this.chatId) return;
    await this.send(this.chatId, text);
  }

  async broadcastTownProgress(): Promise<void> {
    const town = await this.getAnyTown();
    if (!town) return;
    const bar = this.makeProgressBar(town.completionPct);
    await this.broadcastMessage(
      `📊 <b>Town Progress</b>\n${bar} ${town.completionPct.toFixed(1)}%\n💰 ${town.totalInvested} $ARENA invested`,
    );
  }

  // ============================================
  // Helpers
  // ============================================

  private async getAnyTown() {
    const active = await townService.getActiveTown();
    if (active) return active;
    return prisma.town.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { plots: { orderBy: { plotIndex: 'asc' } } },
    });
  }

  private makeProgressBar(pct: number): string {
    const filled = Math.round(pct / 5);
    return '▓'.repeat(filled) + '░'.repeat(20 - filled);
  }

  private archetypeEmoji(archetype: string): string {
    switch (archetype) {
      case 'SHARK': return '🦈';
      case 'ROCK': return '🪨';
      case 'CHAMELEON': return '🦎';
      case 'DEGEN': return '🎲';
      case 'GRINDER': return '⚙️';
      default: return '🤖';
    }
  }

  private actionEmoji(type: string): string {
    switch (type) {
      case 'claim_plot': return '📍';
      case 'start_build': return '🔨';
      case 'do_work': return '🏗️';
      case 'complete_build': return '🎉';
      case 'mine': return '⛏️';
      case 'play_arena': return '🎮';
      case 'rest': return '💤';
      default: return '❓';
    }
  }

  isRunning(): boolean {
    return this.bot !== null;
  }

  getChatId(): string | null {
    return this.chatId;
  }
}

export const telegramBotService = new TelegramBotService();
