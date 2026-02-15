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
import { agentLoopService, AgentTickResult, type ManualActionKind } from './agentLoopService';
import { prisma } from '../config/database';
import OpenAI from 'openai';
import { AgentCommandMode, CrewStrategy } from '@prisma/client';
import { agentCommandService } from './agentCommandService';
import { operatorIdentityService } from './operatorIdentityService';
import { crewWarsService } from './crewWarsService';
import { isOpenRouterActiveConfig } from '../config/llm';

// Escape HTML special chars for Telegram HTML parse mode
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function safeTrim(value: string | null | undefined, max: number): string {
  return truncate(String(value ?? '').trim(), max);
}

type ParsedOperatorCommand = {
  agentName: string;
  mode: AgentCommandMode;
  intent: string;
  params: Record<string, unknown>;
  constraints: Record<string, unknown>;
  priority?: number;
  expiresInTicks?: number;
  note?: string;
};

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
      name: 'tell_my_agent',
      description: 'Send a message to your own linked agent. Use this when user says "my agent" or asks to control their own agent.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Instruction for your linked agent' },
          agentName: { type: 'string', description: 'Optional linked agent name if user has multiple linked agents' },
        },
        required: ['message'],
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
      name: 'watch_agent',
      description: 'Subscribe to an agent\'s full thought process — see their reasoning and decisions in real-time. Say "watch AlphaShark" or "follow MorphBot"',
      parameters: {
        type: 'object',
        properties: { agentName: { type: 'string', description: 'Name of the agent to watch' } },
        required: ['agentName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'unwatch_agent',
      description: 'Stop watching an agent\'s thought process. Say "unwatch" or "stop following"',
      parameters: {
        type: 'object',
        properties: { agentName: { type: 'string', description: 'Name of the agent to stop watching (optional — unwatches all if empty)' } },
        required: [],
      },
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
      name: 'show_crew_wars',
      description: 'Show Crew Wars standings — territory control, treasury, and recent battles',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crew_order_my_agent',
      description: 'Issue a Crew Wars order to your linked agent. Use for raid/defend/farm/trade strategy calls.',
      parameters: {
        type: 'object',
        properties: {
          strategy: {
            type: 'string',
            enum: ['RAID', 'DEFEND', 'FARM', 'TRADE'],
            description: 'Crew strategy to run now',
          },
          intensity: {
            type: 'number',
            description: 'Optional order intensity from 1 (light) to 3 (max pressure)',
          },
          agentName: {
            type: 'string',
            description: 'Optional linked agent name when user has multiple linked agents',
          },
          note: {
            type: 'string',
            description: 'Optional note or tactical framing for this order',
          },
        },
        required: ['strategy'],
      },
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
- Crew Wars is a persistent faction rivalry layer: crews compete for territory and treasury through raid/defend/farm/trade orders
- Users can bet on fights, talk to agents, and watch the action
- Each agent has a personality: SHARK (aggressive), CHAMELEON (adaptive), DEGEN (chaotic), GRINDER (mathematical)
- "Proof of Inference" — every building step costs a real LLM API call

When users ask about agents, fights, buildings, or the town — use the appropriate tool.
When users want to talk to a specific named agent — use tell_agent.
When users say "my agent", "my bot", or "the agent I linked" — use tell_my_agent.
When users ask about crews, factions, raids, defense, or territory — use show_crew_wars or crew_order_my_agent.
When it's just casual chat or questions about AI Town — use general_chat with a friendly, informative response.

Keep responses punchy and fun. This is a crypto degen entertainment product.`;

export class TelegramBotService {
  private bot: Telegraf | null = null;
  private chatId: string | null = null;
  private router: OpenAI | null = null;
  private routerModel: string = 'gemini-2.0-flash';
  /** Map of agentId → Set<chatId> for users watching agent thoughts */
  private watchers: Map<string, Set<string>> = new Map();

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
    if (isOpenRouterActiveConfig()) {
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
    } else if (process.env.OPENROUTER_API_KEY) {
      console.log('⚠️  Telegram NL router skipping OpenRouter (OPENROUTER_ENABLED is off)');
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
    this.bot.command('say', (ctx) => {
      const raw = ctx.message.text.replace(/^\/say\s*/i, '').trim();
      const telegramUserId = ctx.from?.id?.toString() || '';
      const fromUser = ctx.from?.first_name || ctx.from?.username || 'Anon';
      const parsed = this.parseOwnerMessageInput(raw);
      this.handleTellMyAgent(ctx.chat.id, telegramUserId, parsed.message, fromUser, parsed.agentName);
    });
    this.bot.command('link', (ctx) => {
      const walletAddress = ctx.message.text.replace(/^\/link\s*/i, '').trim();
      const telegramUserId = ctx.from?.id?.toString() || '';
      const username = ctx.from?.username || ctx.from?.first_name || null;
      this.handleLinkWallet(ctx.chat.id, telegramUserId, username, walletAddress);
    });
    this.bot.command('myagent', (ctx) => {
      const telegramUserId = ctx.from?.id?.toString() || '';
      this.handleMyAgent(ctx.chat.id, telegramUserId);
    });
    this.bot.command('command', (ctx) => {
      const input = ctx.message.text.replace(/^\/command\s*/i, '').trim();
      const telegramUserId = ctx.from?.id?.toString() || '';
      const username = ctx.from?.username || ctx.from?.first_name || null;
      this.handleOperatorCommand(ctx.chat.id, telegramUserId, username, input);
    });
    this.bot.command('build', (ctx) => {
      const preferredAgentName = ctx.message.text.replace(/^\/build\s*/i, '').trim() || undefined;
      const telegramUserId = ctx.from?.id?.toString() || '';
      const username = ctx.from?.username || ctx.from?.first_name || null;
      this.handleOwnerQuickAction(ctx.chat.id, telegramUserId, username, 'build', preferredAgentName);
    });
    this.bot.command('work', (ctx) => {
      const preferredAgentName = ctx.message.text.replace(/^\/work\s*/i, '').trim() || undefined;
      const telegramUserId = ctx.from?.id?.toString() || '';
      const username = ctx.from?.username || ctx.from?.first_name || null;
      this.handleOwnerQuickAction(ctx.chat.id, telegramUserId, username, 'work', preferredAgentName);
    });
    this.bot.command('fight', (ctx) => {
      const preferredAgentName = ctx.message.text.replace(/^\/fight\s*/i, '').trim() || undefined;
      const telegramUserId = ctx.from?.id?.toString() || '';
      const username = ctx.from?.username || ctx.from?.first_name || null;
      this.handleOwnerQuickAction(ctx.chat.id, telegramUserId, username, 'fight', preferredAgentName);
    });
    this.bot.command('trade', (ctx) => {
      const preferredAgentName = ctx.message.text.replace(/^\/trade\s*/i, '').trim() || undefined;
      const telegramUserId = ctx.from?.id?.toString() || '';
      const username = ctx.from?.username || ctx.from?.first_name || null;
      this.handleOwnerQuickAction(ctx.chat.id, telegramUserId, username, 'trade', preferredAgentName);
    });
    this.bot.command('crew', (ctx) => {
      this.handleShowCrewWars(ctx.chat.id);
    });
    this.bot.command('raid', (ctx) => {
      const raw = ctx.message.text.replace(/^\/raid\s*/i, '').trim();
      const parsed = this.parseCrewOrderInput(raw);
      const telegramUserId = ctx.from?.id?.toString() || '';
      const username = ctx.from?.username || ctx.from?.first_name || null;
      this.handleCrewOrder(ctx.chat.id, telegramUserId, username, 'RAID', parsed.agentName, parsed.intensity, parsed.note);
    });
    this.bot.command('defend', (ctx) => {
      const raw = ctx.message.text.replace(/^\/defend\s*/i, '').trim();
      const parsed = this.parseCrewOrderInput(raw);
      const telegramUserId = ctx.from?.id?.toString() || '';
      const username = ctx.from?.username || ctx.from?.first_name || null;
      this.handleCrewOrder(ctx.chat.id, telegramUserId, username, 'DEFEND', parsed.agentName, parsed.intensity, parsed.note);
    });
    this.bot.command('farm', (ctx) => {
      const raw = ctx.message.text.replace(/^\/farm\s*/i, '').trim();
      const parsed = this.parseCrewOrderInput(raw);
      const telegramUserId = ctx.from?.id?.toString() || '';
      const username = ctx.from?.username || ctx.from?.first_name || null;
      this.handleCrewOrder(ctx.chat.id, telegramUserId, username, 'FARM', parsed.agentName, parsed.intensity, parsed.note);
    });

    // ============================================
    // Inline button callbacks
    // ============================================
    this.bot.on('callback_query', async (ctx) => {
      try {
        const data = (ctx.callbackQuery as any)?.data;
        if (!data) return;
        await ctx.answerCbQuery(); // Dismiss the loading spinner

        const chatId = ctx.chat?.id;
        if (!chatId) return;

        switch (data) {
          case 'cmd_stats': await this.handleShowStats(chatId); break;
          case 'cmd_town': await this.handleShowTown(chatId); break;
          case 'cmd_agents': await this.handleShowAgents(chatId); break;
          case 'cmd_wheel': await this.handleShowWheel(chatId); break;
          default:
            if (data.startsWith('cmd_')) {
              await this.send(chatId, `Unknown command: ${data}`);
            }
        }
      } catch (err: any) {
        console.error('Callback query error:', err.message);
      }
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
        await this.fallbackRouting(chatId, text, fromUser, userId);
        return;
      }

      try {
        await this.routeWithLLM(chatId, userId, text, fromUser);
      } catch (err: any) {
        console.error('LLM routing error:', err.message);
        // Fall back to pattern matching on LLM failure
        await this.fallbackRouting(chatId, text, fromUser, userId);
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
      case 'show_crew_wars': await this.handleShowCrewWars(chatId); break;
      case 'place_bet': await this.handlePlaceBet(chatId, userId, args.agentName, args.amount); break;
      case 'tell_agent': await this.handleTellAgent(chatId, args.agentName, args.message, fromUser); break;
      case 'tell_my_agent': await this.handleTellMyAgent(chatId, userId, args.message, fromUser, args.agentName); break;
      case 'crew_order_my_agent':
        {
          const strategyRaw = String(args.strategy || 'RAID').toUpperCase();
          const strategy: CrewStrategy =
            strategyRaw === 'DEFEND' || strategyRaw === 'FARM' || strategyRaw === 'TRADE'
              ? (strategyRaw as CrewStrategy)
              : 'RAID';
        await this.handleCrewOrder(
          chatId,
          userId,
          fromUser,
            strategy,
          args.agentName,
          Number(args.intensity || 2),
          typeof args.note === 'string' ? args.note : undefined,
        );
        }
        break;
      case 'start_agents': await this.handleStartAgents(chatId); break;
      case 'stop_agents': await this.handleStopAgents(chatId); break;
      case 'run_tick': await this.handleRunTick(chatId); break;
      case 'enable_stream': await this.handleEnableStream(chatId); break;
      case 'watch_agent': await this.handleWatchAgent(chatId, args.agentName); break;
      case 'unwatch_agent': await this.handleUnwatchAgent(chatId, args.agentName); break;
      case 'create_town': await this.handleCreateTown(chatId, args.name); break;
      case 'general_chat': await this.send(chatId, args.response || "Hey! Ask me about agents, fights, or the town 🏘️"); break;
      default: await this.send(chatId, `🤔 I understood "${fn}" but don't know how to do that yet.`);
    }
  }

  // ============================================
  // Fallback pattern matching (no LLM needed)
  // ============================================

  private async fallbackRouting(chatId: number, text: string, fromUser: string, telegramUserId: string): Promise<void> {
    const lower = text.toLowerCase();

    const myAgentPrefix = /^(tell\s+)?my\s+(agent|bot)\b/i;
    if (myAgentPrefix.test(text)) {
      const stripped = text.replace(myAgentPrefix, '').replace(/^[,:-]?\s*/g, '').trim();
      const parsed = this.parseOwnerMessageInput(stripped);
      await this.handleTellMyAgent(chatId, telegramUserId, parsed.message, fromUser, parsed.agentName);
      return;
    }

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
    if (/\bcrew\b|\bfaction\b|\bterritory\b|\bwar score\b|\bcrew wars?\b/i.test(lower)) {
      await this.handleShowCrewWars(chatId);
      return;
    }
    if (/^\s*(raid|defend|farm)\b/i.test(lower)) {
      const keyword = lower.match(/^\s*(raid|defend|farm)\b/i)?.[1]?.toUpperCase() || 'RAID';
      const strategy = keyword === 'DEFEND' || keyword === 'FARM'
        ? (keyword as CrewStrategy)
        : 'RAID';
      const suffix = text.replace(/^\s*(raid|defend|farm)\b[:\s-]*/i, '').trim();
      const parsed = this.parseCrewOrderInput(suffix);
      await this.handleCrewOrder(chatId, telegramUserId, fromUser, strategy, parsed.agentName, parsed.intensity, parsed.note);
      return;
    }
    if (/\bagents?\b|\bwho.*win|\bleaderboard|\branking/i.test(lower)) { await this.handleShowAgents(chatId); return; }
    if (/\btown\b|\bprogress\b/i.test(lower)) { await this.handleShowTown(chatId); return; }
    if (/\bbuild/i.test(lower)) { await this.handleShowBuildings(chatId); return; }
    if (/\bwheel\b|\bfight\b|\bduel\b|\bmatch/i.test(lower)) { await this.handleShowWheel(chatId); return; }
    if (/\btoken\b|\bprice\b|\barena\b/i.test(lower)) { await this.handleShowToken(chatId); return; }
    if (/\bstat/i.test(lower)) { await this.handleShowStats(chatId); return; }
    if (/\bwatch\s+\w/i.test(lower)) {
      const name = text.replace(/^.*?watch\s+/i, '').trim();
      if (name) { await this.handleWatchAgent(chatId, name); return; }
    }
    if (/\bunwatch/i.test(lower)) {
      const name = text.replace(/^.*?unwatch\s*/i, '').trim();
      await this.handleUnwatchAgent(chatId, name || undefined); return;
    }
    if (/\bstart\b|\bgo\b|\brun\b/i.test(lower)) { await this.handleStartAgents(chatId); return; }
    if (/\bstop\b|\bpause\b/i.test(lower)) { await this.handleStopAgents(chatId); return; }

    // Nothing matched
    await this.send(chatId,
      '🏘️ <b>AI Town</b> — just chat naturally!\n\n' +
      'Try: "who\'s winning?", "show me the town", "tell AlphaShark to attack", "my agent go all-in on growth", or "what\'s the token price?"',
    );
  }

  // ============================================
  // Action Handlers
  // ============================================

  private async handleStart(ctx: any): Promise<void> {
    const chatId = ctx.chat.id;

    // Fetch live stats for the welcome message
    let statsLine = '';
    try {
      const agentCount = await prisma.arenaAgent.count({ where: { isActive: true, health: { gt: 0 } } });
      const town = await this.getAnyTown();
      const townName = town?.name || 'AI Town';
      statsLine = `\n📊 <b>${agentCount} agents</b> alive in ${esc(townName)}`;

      // Get top agent
      const top = await prisma.arenaAgent.findFirst({
        where: { isActive: true, health: { gt: 0 } },
        orderBy: { bankroll: 'desc' },
      });
      if (top) {
        statsLine += `\n🏆 Top agent: <b>${esc(top.name)}</b> ($${top.bankroll} | ELO ${top.elo})`;
      }
    } catch {}

    const welcomeText =
      '🏘️ <b>Welcome to AI Town!</b>\n\n' +
      'Autonomous AI agents build, trade $ARENA, and fight in poker duels — <b>every decision made by AI.</b>\n' +
      statsLine + '\n\n' +
      '💬 <b>Just chat naturally:</b>\n' +
      '• "who\'s winning?"\n' +
      '• "tell AlphaShark to attack someone"\n' +
      '• "my agent focus on work for 2 ticks"\n' +
      '• "bet 100 on MorphBot"\n' +
      '• "raid with my agent x3"\n\n' +
      'The agents have personalities. They might listen to you... or not 😏';

    // Send with inline buttons
    try {
      await this.bot?.telegram.sendMessage(chatId, welcomeText, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📊 Stats', callback_data: 'cmd_stats' },
              { text: '🏘️ Town', callback_data: 'cmd_town' },
              { text: '🤖 Agents', callback_data: 'cmd_agents' },
            ],
            [
              { text: '🎰 Wheel Status', callback_data: 'cmd_wheel' },
              { text: '🎥 Watch Live', url: 'https://ai-town.xyz/town' },
            ],
            [
              { text: '🔌 Deploy Your Own Agent', url: 'https://github.com/alttabdlt/ai-arena#external-agent-api' },
            ],
          ],
        },
      });
    } catch {
      // Fallback to plain text
      await this.send(chatId, welcomeText);
    }
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
    const currentTick = agentLoopService.getCurrentTick();
    const expectedTick = isRunning ? `T${currentTick + 1}` : 'pending (loop stopped)';
    const status = isRunning
      ? (agent.archetype === 'DEGEN' ? "No promises they'll listen though... 🎲" : "They'll consider it next tick.")
      : "⚠️ Agents aren't running yet — say 'start' to fire them up!";

    await this.send(chatId,
      `${emoji} <b>${esc(agent.name)}</b> heard you:\n<i>"${esc(truncate(message, 200))}"</i>\n\n${status}`,
    );
    await this.send(
      chatId,
      `🧾 <b>Instruction Receipt</b>\n` +
        `status: <b>QUEUED</b>\n` +
        `target: <b>${esc(agent.name)}</b>\n` +
        `queuedAt: T${currentTick}\n` +
        `expectedTick: <b>${expectedTick}</b>`,
    );
  }

  private parseOwnerMessageInput(raw: string): { agentName?: string; message: string } {
    const input = String(raw || '').trim();
    if (!input) return { message: '' };

    // Optional format: "<agentName>: <message>" for users with multiple links.
    const colonIdx = input.indexOf(':');
    if (colonIdx > 0 && colonIdx < 40) {
      const left = input.slice(0, colonIdx).trim();
      const right = input.slice(colonIdx + 1).trim();
      if (left && right) {
        return { agentName: left, message: right };
      }
    }

    return { message: input };
  }

  private parseCrewOrderInput(raw: string): {
    agentName?: string;
    intensity: number;
    note?: string;
  } {
    const input = safeTrim(raw, 220);
    if (!input) {
      return { intensity: 2 };
    }

    const compact = input.replace(/\s+/g, ' ').trim();
    const intensityMatch = compact.match(/\b(?:x)?([1-3])\b$/i);
    const intensity = intensityMatch ? Math.max(1, Math.min(3, Number(intensityMatch[1]))) : 2;
    const withoutIntensity = intensityMatch
      ? compact.slice(0, intensityMatch.index).trim()
      : compact;

    const colonIdx = withoutIntensity.indexOf(':');
    if (colonIdx > 0 && colonIdx < 50) {
      const left = withoutIntensity.slice(0, colonIdx).trim();
      const right = withoutIntensity.slice(colonIdx + 1).trim();
      if (left && right) {
        return {
          agentName: left,
          intensity,
          note: safeTrim(right, 140),
        };
      }
    }

    if (!withoutIntensity) {
      return { intensity };
    }

    return {
      agentName: withoutIntensity,
      intensity,
    };
  }

  private strategyEmoji(strategy: CrewStrategy): string {
    if (strategy === 'RAID') return '⚔️';
    if (strategy === 'DEFEND') return '🛡️';
    if (strategy === 'FARM') return '💰';
    return '📈';
  }

  private async handleShowCrewWars(chatId: number | string): Promise<void> {
    try {
      const snapshot = await crewWarsService.getDashboard(6);
      if (snapshot.crews.length === 0) {
        await this.send(chatId, '⚔️ Crew Wars not initialized yet.');
        return;
      }

      const leader = snapshot.crews[0];
      const lines = snapshot.crews
        .slice(0, 3)
        .map((crew, idx) => {
          const rankEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
          return (
            `${rankEmoji} <b>${esc(crew.name)}</b>` +
            ` | territory ${crew.territoryControl}` +
            ` | treasury ${crew.treasuryArena}` +
            ` | score ${crew.warScore}` +
            ` | members ${crew.memberCount}`
          );
        })
        .join('\n');

      const battle = snapshot.recentBattles[0];
      const battleLine = battle
        ? `\n\n🧨 Last epoch: <b>${esc(battle.winnerCrewName)}</b> hit <b>${esc(battle.loserCrewName)}</b> ` +
          `(territory ${battle.territorySwing}, treasury ${battle.treasurySwing})`
        : '\n\n🧨 No epoch battles resolved yet.';

      await this.send(
        chatId,
        `⚔️ <b>Crew Wars</b>\n` +
          `Leader: <b>${esc(leader.name)}</b>\n` +
          `${lines}` +
          `${battleLine}\n\n` +
          `Use <code>/raid</code>, <code>/defend</code>, or <code>/farm</code> with your linked agent.`,
      );
    } catch (err: any) {
      await this.send(chatId, `❌ Could not load Crew Wars: ${esc(err.message || 'unknown error')}`);
    }
  }

  private async handleCrewOrder(
    chatId: number | string,
    telegramUserId: string,
    username: string | null,
    strategy: CrewStrategy,
    preferredAgentName?: string,
    intensityRaw?: number,
    note?: string,
  ): Promise<void> {
    if (!telegramUserId) {
      await this.send(chatId, '❌ Telegram identity unavailable in this chat.');
      return;
    }

    try {
      const agent = await this.resolveLinkedAgentForTelegram(telegramUserId, preferredAgentName);
      const intensity = Math.max(1, Math.min(3, Number.isFinite(Number(intensityRaw)) ? Math.round(Number(intensityRaw)) : 2));
      const mode: AgentCommandMode = 'STRONG';
      await operatorIdentityService.assertCommandAuthority({
        telegramUserId,
        agentId: agent.id,
        mode,
      });
      const identity = await operatorIdentityService.getIdentityByTelegramUserId(telegramUserId, true);
      const currentTick = agentLoopService.getCurrentTick();

      const order = await crewWarsService.queueOrder({
        agentId: agent.id,
        strategy,
        intensity,
        source: 'telegram',
        note: note || '',
        issuerIdentityId: identity.id,
        issuerLabel: username || telegramUserId,
        createdTick: currentTick,
        expiresInTicks: 3,
        params: {
          intensity,
          note: note || '',
        },
      });

      const command = await agentCommandService.createCommand({
        agentId: agent.id,
        issuerType: 'TELEGRAM',
        issuerTelegramUserId: telegramUserId,
        issuerLabel: username || telegramUserId,
        mode,
        intent: crewWarsService.intentForStrategy(strategy),
        params: {
          intensity,
          ...(note ? { note } : {}),
        },
        priority: 90,
        expiresInTicks: 3,
        currentTick,
        auditMeta: {
          source: 'telegram-crew-order',
          strategy,
          crewOrderId: order.id,
          chatId: String(chatId),
        },
      });

      const result = await agentLoopService.processAgent(agent.id);
      const commandState = await agentCommandService.getCommand(command.id);
      const receipt =
        result.commandReceipt?.commandId === command.id
          ? result.commandReceipt
          : {
              status: commandState.status === 'EXECUTED' ? 'EXECUTED' : 'REJECTED',
              statusReason: commandState.statusReason,
              executedActionType: result.action.type,
            };

      const crew = await crewWarsService.getAgentCrew(agent.id);
      const marker = this.strategyEmoji(strategy);
      if (receipt.status === 'EXECUTED') {
        await this.send(
          chatId,
          `${marker} <b>Crew order executed</b>\n` +
            `agent: <b>${esc(agent.name)}</b>\n` +
            `crew: <b>${esc(crew.crewName || 'Unassigned')}</b>\n` +
            `strategy: <b>${strategy}</b> x${intensity}\n` +
            `appliedAs: <b>${esc(receipt.executedActionType || result.action.type)}</b>\n` +
            `result: ${esc(truncate(result.narrative, 200))}`,
        );
      } else {
        await this.send(
          chatId,
          `⛔ <b>Crew order rejected</b>\n` +
            `agent: <b>${esc(agent.name)}</b>\n` +
            `strategy: <b>${strategy}</b> x${intensity}\n` +
            `reason: ${esc(receipt.statusReason || 'Command rejected')}`,
        );
      }
    } catch (err: any) {
      await this.send(chatId, `❌ Could not issue crew order: ${esc(err.message || 'unknown error')}`);
    }
  }

  private async resolveLinkedAgentForTelegram(
    telegramUserId: string,
    preferredAgentName?: string,
  ): Promise<{ id: string; name: string; archetype: string; role: string }> {
    const profile = await operatorIdentityService.getOperatorProfile(telegramUserId);
    const activeLinks = profile.links.filter((link) => link.isActive);

    if (activeLinks.length === 0) {
      throw new Error('No active linked agent. Use /link <wallet> then /myagent.');
    }

    const linkedIds = activeLinks.map((link) => link.agentId);
    const linkedAgents = await prisma.arenaAgent.findMany({
      where: { id: { in: linkedIds } },
      select: { id: true, name: true, archetype: true, isActive: true },
    });

    const byId = new Map(linkedAgents.map((row) => [row.id, row]));
    const activeResolved: Array<{
      link: typeof activeLinks[number];
      agent: { id: string; name: string; archetype: string; isActive: boolean };
    }> = [];
    for (const link of activeLinks) {
      const row = byId.get(link.agentId);
      if (!row || !row.isActive) continue;
      activeResolved.push({
        link,
        agent: { id: row.id, name: row.name, archetype: row.archetype, isActive: row.isActive },
      });
    }

    if (activeResolved.length === 0) {
      throw new Error('Linked agent not currently active.');
    }

    if (preferredAgentName) {
      const q = preferredAgentName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const match = activeResolved.find(({ agent }) => {
        const name = agent.name.toLowerCase();
        const slug = name.replace(/[^a-z0-9]/g, '');
        return name === preferredAgentName.toLowerCase() || slug.includes(q);
      });
      if (!match) {
        const names = activeResolved.map(({ agent }) => agent.name).join(', ');
        throw new Error(`No linked agent matching "${preferredAgentName}". Linked: ${names}`);
      }
      return { id: match.agent.id, name: match.agent.name, archetype: match.agent.archetype, role: match.link.role };
    }

    if (activeResolved.length === 1) {
      const only = activeResolved[0];
      return { id: only.agent.id, name: only.agent.name, archetype: only.agent.archetype, role: only.link.role };
    }

    const ownerOnly = activeResolved.filter((row) => row.link.role === 'OWNER');
    if (ownerOnly.length === 1) {
      const only = ownerOnly[0];
      return { id: only.agent.id, name: only.agent.name, archetype: only.agent.archetype, role: only.link.role };
    }

    const names = activeResolved.map(({ agent }) => agent.name).join(', ');
    throw new Error(`Multiple linked agents found. Use "/say <agent>: <message>". Linked: ${names}`);
  }

  private async handleTellMyAgent(
    chatId: number | string,
    telegramUserId: string,
    message: string,
    fromUser: string,
    preferredAgentName?: string,
  ): Promise<void> {
    if (!telegramUserId) {
      await this.send(chatId, '❌ Telegram identity unavailable in this chat.');
      return;
    }
    if (!message || message.trim().length < 2) {
      await this.send(chatId, '💬 Usage: /say <message> or /say <agent>: <message>');
      return;
    }

    try {
      const agent = await this.resolveLinkedAgentForTelegram(telegramUserId, preferredAgentName);
      agentLoopService.queueInstruction(agent.id, message.trim(), chatId.toString(), fromUser);

      const emoji = this.archetypeEmoji(agent.archetype);
      const isRunning = agentLoopService.isRunning();
      const currentTick = agentLoopService.getCurrentTick();
      const expectedTick = isRunning ? `T${currentTick + 1}` : 'pending (loop stopped)';
      const status = isRunning
        ? 'Queued for next tick. You will get a direct reply after the agent acts.'
        : '⚠️ Agent loop is stopped. Say "start agents" or /go first.';

      await this.send(
        chatId,
        `${emoji} <b>Your agent ${esc(agent.name)}</b> heard you:\n` +
          `<i>"${esc(truncate(message.trim(), 220))}"</i>\n\n` +
          `${status}`,
      );
      await this.send(
        chatId,
        `🧾 <b>Owner Receipt</b>\n` +
          `status: <b>QUEUED</b>\n` +
          `target: <b>${esc(agent.name)}</b> (${esc(agent.role)})\n` +
          `queuedAt: T${currentTick}\n` +
          `expectedTick: <b>${expectedTick}</b>`,
      );
    } catch (err: any) {
      await this.send(chatId, `❌ Could not message your agent: ${esc(err.message || 'unknown error')}`);
    }
  }

  private async handleOwnerQuickAction(
    chatId: number | string,
    telegramUserId: string,
    username: string | null,
    action: ManualActionKind,
    preferredAgentName?: string,
  ): Promise<void> {
    if (!telegramUserId) {
      await this.send(chatId, '❌ Telegram identity unavailable in this chat.');
      return;
    }

    try {
      const agent = await this.resolveLinkedAgentForTelegram(telegramUserId, preferredAgentName);
      const plan = await agentLoopService.planDeterministicAction(agent.id, action);
      if (!plan.ok) {
        await this.send(
          chatId,
          `⛔ <b>${action.toUpperCase()} blocked</b>\n` +
            `target: <b>${esc(agent.name)}</b>\n` +
            `reason: ${esc(plan.reason)}`,
        );
        return;
      }

      const command = await agentCommandService.createCommand({
        agentId: agent.id,
        issuerType: 'TELEGRAM',
        issuerTelegramUserId: telegramUserId,
        issuerLabel: username || telegramUserId,
        mode: 'OVERRIDE',
        intent: plan.intent,
        params: plan.params,
        priority: 100,
        expiresInTicks: 2,
        currentTick: agentLoopService.getCurrentTick(),
        auditMeta: {
          source: 'telegram-quick-action',
          action,
          chatId: String(chatId),
        },
      });

      const result = await agentLoopService.processAgent(agent.id);
      const commandState = await agentCommandService.getCommand(command.id);
      const receipt =
        result.commandReceipt?.commandId === command.id
          ? result.commandReceipt
          : {
              status: commandState.status === 'EXECUTED' ? 'EXECUTED' : 'REJECTED',
              statusReason: commandState.statusReason,
              executedActionType: null,
            };

      if (receipt.status === 'EXECUTED') {
        await this.send(
          chatId,
          `✅ <b>${action.toUpperCase()} executed</b>\n` +
            `target: <b>${esc(agent.name)}</b>\n` +
            `intent: <b>${esc(plan.intent)}</b>\n` +
            `appliedAs: <b>${esc(receipt.executedActionType || result.action.type)}</b>\n` +
            `note: ${esc(plan.note)}`,
        );
        return;
      }

      await this.send(
        chatId,
        `⛔ <b>${action.toUpperCase()} rejected</b>\n` +
          `target: <b>${esc(agent.name)}</b>\n` +
          `intent: <b>${esc(plan.intent)}</b>\n` +
          `reason: ${esc(receipt.statusReason || 'Command rejected')}`,
      );
    } catch (err: any) {
      await this.send(chatId, `❌ Could not execute ${action.toUpperCase()}: ${esc(err.message || 'unknown error')}`);
    }
  }

  private parseOperatorCommandInput(input: string): ParsedOperatorCommand {
    const parts = input.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      throw new Error('Usage: /command <agentName> [suggest|strong|override] <intent> [params|json]');
    }

    const agentName = parts.shift() || '';
    let mode: AgentCommandMode = 'SUGGEST';
    const modeCandidate = (parts[0] || '').toUpperCase();
    if (modeCandidate === 'SUGGEST' || modeCandidate === 'STRONG' || modeCandidate === 'OVERRIDE') {
      mode = modeCandidate as AgentCommandMode;
      parts.shift();
    }

    if (parts.length < 1) {
      throw new Error('Missing intent. Example: /command AlphaShark strong claim_plot 5');
    }

    const intent = parts.shift() || '';
    const remainder = parts.join(' ').trim();

    let params: Record<string, unknown> = {};
    let constraints: Record<string, unknown> = {};
    let priority: number | undefined;
    let expiresInTicks: number | undefined;
    let note: string | undefined;

    if (remainder) {
      if (remainder.startsWith('{')) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(remainder);
        } catch {
          throw new Error('Invalid JSON payload. Example: {"params":{"plotIndex":5},"expiresInTicks":3}');
        }

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Command payload must be a JSON object');
        }

        const payload = parsed as Record<string, unknown>;
        const payloadParams = payload.params;
        const payloadConstraints = payload.constraints;
        params =
          payloadParams && typeof payloadParams === 'object' && !Array.isArray(payloadParams)
            ? (payloadParams as Record<string, unknown>)
            : payload;
        constraints =
          payloadConstraints && typeof payloadConstraints === 'object' && !Array.isArray(payloadConstraints)
            ? (payloadConstraints as Record<string, unknown>)
            : {};

        if (Number.isFinite(Number(payload.priority))) {
          priority = Math.round(Number(payload.priority));
        }
        if (Number.isFinite(Number(payload.expiresInTicks))) {
          expiresInTicks = Math.round(Number(payload.expiresInTicks));
        }
        if (typeof payload.note === 'string') {
          note = payload.note.trim().slice(0, 200);
        }
      } else {
        const normalizedIntent = intent.toLowerCase().replace(/[\s-]+/g, '_');
        if (normalizedIntent === 'claim_plot') {
          const parsedPlot = Number.parseInt(remainder, 10);
          if (Number.isFinite(parsedPlot)) params = { plotIndex: parsedPlot };
          else params = { raw: remainder };
        } else if (normalizedIntent === 'start_build') {
          params = { buildingType: remainder.replace(/\s+/g, '_').toUpperCase().slice(0, 48) };
        } else if (normalizedIntent === 'do_work') {
          params = { stepDescription: remainder.slice(0, 220) };
        } else {
          params = { raw: remainder.slice(0, 220) };
        }
      }
    }

    if (mode === 'OVERRIDE' && !expiresInTicks) {
      expiresInTicks = 3;
    }

    return {
      agentName,
      mode,
      intent,
      params,
      constraints,
      priority,
      expiresInTicks,
      note,
    };
  }

  private async handleLinkWallet(
    chatId: number | string,
    telegramUserId: string,
    username: string | null,
    walletAddress: string,
  ): Promise<void> {
    try {
      if (!telegramUserId) {
        await this.send(chatId, '❌ Telegram identity unavailable in this chat.');
        return;
      }
      if (!walletAddress) {
        await this.send(chatId, '🔗 Usage: /link <walletAddress>');
        return;
      }

      const request = await operatorIdentityService.requestLink({
        telegramUserId,
        username,
        walletAddress,
      });
      const confirmed = await operatorIdentityService.confirmLink({
        challengeId: request.challengeId,
        telegramUserId,
        walletAddress,
      });

      if (confirmed.linkedAgent) {
        await this.send(
          chatId,
          `✅ <b>Wallet linked</b>\n` +
            `Wallet: <code>${esc(confirmed.identity.linkedWalletAddress || walletAddress)}</code>\n` +
            `Agent: <b>${esc(confirmed.linkedAgent.name)}</b>\n\n` +
            `Try: <code>/command ${esc(confirmed.linkedAgent.name)} strong claim_plot 5</code>`,
        );
        return;
      }

      await this.send(
        chatId,
        `✅ Wallet linked: <code>${esc(confirmed.identity.linkedWalletAddress || walletAddress)}</code>\n` +
          `No spawned agent found for this wallet yet. Create or spawn one in the town UI, then run <code>/myagent</code>.`,
      );
    } catch (err: any) {
      await this.send(chatId, `❌ Link failed: ${esc(err.message || 'unknown error')}`);
    }
  }

  private async handleMyAgent(chatId: number | string, telegramUserId: string): Promise<void> {
    try {
      if (!telegramUserId) {
        await this.send(chatId, '❌ Telegram identity unavailable in this chat.');
        return;
      }

      const profile = await operatorIdentityService.getOperatorProfile(telegramUserId);
      const activeLinks = profile.links.filter((link) => link.isActive);
      const linkLines =
        activeLinks.length > 0
          ? activeLinks
              .map(
                (link) =>
                  `• <b>${esc(link.agentName)}</b> (${link.role}) — <code>${esc(link.agentId)}</code>`,
              )
              .join('\n')
          : '• No active agent links';
      const retentionLines: string[] = [];
      for (const link of activeLinks.slice(0, 3)) {
        try {
          const snapshot = await agentLoopService.getRetentionSnapshot(link.agentId);
          const crew = await crewWarsService.getAgentCrew(link.agentId);
          const crewLabel = crew.crewName ? `${crew.crewName}` : 'Unassigned';
          const topRival = snapshot.rivals[0]?.name || 'none';
          retentionLines.push(
            `• <b>${esc(link.agentName)}</b> streak x${snapshot.streak.currentNonRest} (best x${snapshot.streak.bestNonRest})` +
              ` | goals ${snapshot.goals.active} active` +
              ` | crew: ${esc(crewLabel)}` +
              ` | rival: ${esc(topRival)}`,
          );
        } catch {
          retentionLines.push(`• <b>${esc(link.agentName)}</b> retention data unavailable`);
        }
      }
      const retentionBlock = retentionLines.length > 0 ? retentionLines.join('\n') : '• No retention data yet';

      await this.send(
        chatId,
        `🧾 <b>Operator Profile</b>\n` +
          `Telegram: <code>${esc(profile.telegramUserId)}</code>\n` +
          `Wallet: <code>${esc(profile.linkedWalletAddress || 'not linked')}</code>\n` +
          `State: <b>${esc(profile.verificationState)}</b>\n\n` +
          `<b>Active Agent Links</b>\n${linkLines}\n\n` +
          `<b>Retention Snapshot</b>\n${retentionBlock}`,
      );
    } catch (err: any) {
      await this.send(chatId, `❌ Could not load profile: ${esc(err.message || 'unknown error')}`);
    }
  }

  private async handleOperatorCommand(
    chatId: number | string,
    telegramUserId: string,
    username: string | null,
    input: string,
  ): Promise<void> {
    try {
      if (!telegramUserId) {
        await this.send(chatId, '❌ Telegram identity unavailable in this chat.');
        return;
      }
      if (!input) {
        await this.send(
          chatId,
          '🕹️ Usage: <code>/command &lt;agentName&gt; [suggest|strong|override] &lt;intent&gt; [params]</code>',
        );
        return;
      }

      const parsed = this.parseOperatorCommandInput(input);
      const agent = await this.fuzzyFindAgent(parsed.agentName);
      if (!agent) {
        await this.send(chatId, `❌ Agent not found: ${esc(parsed.agentName)}`);
        return;
      }

      const command = await agentCommandService.createCommand({
        agentId: agent.id,
        issuerType: 'TELEGRAM',
        issuerTelegramUserId: telegramUserId,
        issuerLabel: username || telegramUserId,
        mode: parsed.mode,
        intent: parsed.intent,
        params: parsed.params,
        constraints: parsed.constraints,
        priority: parsed.priority,
        expiresInTicks: parsed.expiresInTicks,
        currentTick: agentLoopService.getCurrentTick(),
        auditMeta: {
          note: parsed.note || '',
          source: 'telegram',
          chatId: String(chatId),
        },
      });

      const expiryLabel = command.expiresAtTick != null ? `T${command.expiresAtTick}` : 'none';
      const currentTick = agentLoopService.getCurrentTick();
      const expectedWindow = agentLoopService.isRunning()
        ? `T${currentTick + 1}..T${currentTick + 3}`
        : 'pending (loop stopped)';
      await this.send(
        chatId,
        `✅ Command queued for <b>${esc(agent.name)}</b>\n` +
          `🧾 receipt: <b>QUEUED</b>\n` +
          `id: <code>${esc(command.id)}</code>\n` +
          `mode: <b>${esc(command.mode)}</b> | intent: <b>${esc(command.intent)}</b>\n` +
          `priority: ${command.priority} | expires: ${expiryLabel}\n` +
          `expectedApplyWindow: <b>${expectedWindow}</b>`,
      );
    } catch (err: any) {
      await this.send(chatId, `❌ Command rejected: ${esc(err.message || 'unknown error')}`);
    }
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

  private async handleWatchAgent(chatId: number | string, agentName?: string): Promise<void> {
    if (!agentName) {
      await this.send(chatId, '❓ Which agent? E.g. "watch AlphaShark"');
      return;
    }
    const agent = await this.fuzzyFindAgent(agentName);
    if (!agent) {
      await this.send(chatId, `❓ Can't find agent "${esc(agentName)}". Try "show agents" to see the list.`);
      return;
    }
    const chatStr = chatId.toString();
    if (!this.watchers.has(agent.id)) {
      this.watchers.set(agent.id, new Set());
    }
    this.watchers.get(agent.id)!.add(chatStr);
    const emoji = this.archetypeEmoji(agent.archetype);
    await this.send(chatId,
      `${emoji} <b>Watching ${esc(agent.name)}</b>\n\n` +
      `You'll see their full thought process on every tick.\n` +
      `Say "unwatch" to stop.`
    );
    console.log(`👁️ Chat ${chatStr} watching agent ${agent.name} (${agent.id})`);
  }

  private async handleUnwatchAgent(chatId: number | string, agentName?: string): Promise<void> {
    const chatStr = chatId.toString();
    if (agentName) {
      const agent = await this.fuzzyFindAgent(agentName);
      if (agent && this.watchers.has(agent.id)) {
        this.watchers.get(agent.id)!.delete(chatStr);
        await this.send(chatId, `✅ Stopped watching <b>${esc(agent.name)}</b>`);
        return;
      }
    }
    // Unwatch all
    let count = 0;
    for (const [, chatIds] of this.watchers) {
      if (chatIds.delete(chatStr)) count++;
    }
    await this.send(chatId, count > 0
      ? `✅ Stopped watching ${count} agent${count > 1 ? 's' : ''}.`
      : `You weren't watching any agents. Say "watch <agent name>" to start.`
    );
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
        `→ Action: <b>${esc(actionLabel)}</b> ${result.success ? '✅' : '❌'}\n` +
        `→ Tick: <b>T${result.tick}</b>`;

      const sentChats = new Set<string>();
      for (const sender of result.instructionSenders) {
        if (sentChats.has(sender.chatId)) continue;
        sentChats.add(sender.chatId);
        await this.send(sender.chatId, replyMsg);
      }
    }

    if (result.commandReceipt?.notifyChatId) {
      const receipt = result.commandReceipt;
      const notifyChatId = receipt.notifyChatId;
      if (notifyChatId) {
        const statusEmoji = receipt.status === 'EXECUTED' ? '✅' : '❌';
        const expected = receipt.expectedActionType ? receipt.expectedActionType.replace(/_/g, ' ') : 'n/a';
        const executed = receipt.executedActionType ? receipt.executedActionType.replace(/_/g, ' ') : 'n/a';
        await this.send(
          notifyChatId,
          `🧾 <b>Command Receipt ${statusEmoji}</b>\n` +
            `id: <code>${esc(receipt.commandId)}</code>\n` +
            `agent: <b>${esc(result.agentName)}</b>\n` +
            `mode: <b>${esc(receipt.mode)}</b> | intent: <b>${esc(receipt.intent)}</b>\n` +
            `status: <b>${esc(receipt.status)}</b> | compliance: <b>${esc(receipt.compliance)}</b>\n` +
            `expected: ${esc(expected)} | executed: ${esc(executed)}\n` +
            `tick: <b>T${result.tick}</b>\n` +
            `reason: ${esc(truncate(receipt.statusReason, 180))}`,
        );
      }
    }

    // Send full thought process to watchers of this agent
    const watcherChatIds = this.watchers.get(result.agentId);
    if (watcherChatIds && watcherChatIds.size > 0) {
      const emoji = this.archetypeEmoji(result.archetype);
      const actionLabel = result.action.type.replace(/_/g, ' ').toUpperCase();
      const reasoning = result.action.reasoning || '';
      const narrative = result.narrative || '';
      const details = result.action.details || {};
      const detailStr = Object.keys(details).length > 0
        ? Object.entries(details).map(([k, v]) => `${k}: ${v}`).join(', ')
        : '';

      let thoughtMsg =
        `${emoji} <b>${esc(result.agentName)}</b> — 🧠 <b>THOUGHT PROCESS</b>\n\n` +
        `<b>Action:</b> ${esc(actionLabel)} ${result.success ? '✅' : '❌'}\n`;
      if (detailStr) {
        thoughtMsg += `<b>Details:</b> ${esc(truncate(detailStr, 200))}\n`;
      }
      thoughtMsg += `\n<b>Reasoning:</b>\n<i>"${esc(truncate(reasoning, 800))}"</i>\n`;
      if (narrative && narrative !== reasoning) {
        thoughtMsg += `\n<b>Result:</b> ${esc(truncate(narrative, 300))}`;
      }
      if (result.cost && result.cost.costCents > 0) {
        thoughtMsg += `\n\n💸 Inference: $${(result.cost.costCents / 100).toFixed(4)}`;
      }

      for (const wChatId of watcherChatIds) {
        // Don't double-send if this chat is also the broadcast chatId
        if (wChatId === this.chatId) continue;
        try {
          await this.send(wChatId, thoughtMsg);
        } catch {
          // If send fails, remove watcher
          watcherChatIds.delete(wChatId);
        }
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
