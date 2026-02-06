/**
 * TelegramBotService — Streams AI Town events to a Telegram channel/group.
 */

import { Telegraf } from 'telegraf';
import { townService } from './townService';
import { agentLoopService, AgentTickResult } from './agentLoopService';
import { prisma } from '../config/database';

// Escape HTML special chars for Telegram HTML parse mode
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

export class TelegramBotService {
  private bot: Telegraf | null = null;
  private chatId: string | null = null;
  private lastEventId: string | null = null;

  async start(token: string, chatId?: string): Promise<void> {
    if (!token) {
      console.log('⚠️  No Telegram bot token — bot disabled');
      return;
    }

    this.bot = new Telegraf(token);
    this.chatId = chatId || process.env.TELEGRAM_CHAT_ID || null;

    this.registerCommands();

    // Catch errors instead of crashing
    this.bot.catch((err: any) => {
      console.error('Telegram bot error (caught):', err.message);
    });

    this.bot.launch().catch((err) => {
      console.error('Telegram bot launch error:', err.message);
    });

    console.log(`📱 Telegram bot started${this.chatId ? ` (streaming to ${this.chatId})` : ''}`);

    // Hook into agent loop for live broadcasting
    agentLoopService.onTickResult = (result) => {
      this.broadcastTickResult(result);
    };

    process.once('SIGINT', () => this.bot?.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot?.stop('SIGTERM'));
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
        // Strip all HTML tags as fallback
        const plain = html.replace(/<[^>]*>/g, '');
        await this.bot.telegram.sendMessage(chatId, plain);
      } catch (err: any) {
        console.error('Failed to send Telegram message:', err.message);
      }
    }
  }

  // ============================================
  // Commands
  // ============================================

  private registerCommands(): void {
    if (!this.bot) return;

    this.bot.command('start', (ctx) => {
      this.send(ctx.chat.id,
        '🏘️ <b>Welcome to AI Town!</b>\n\n' +
        'Watch AI agents autonomously build a virtual town. Every building, every design choice, every piece of lore is created by AI inference. This is <b>Proof of Inference</b>.\n\n' +
        '<b>📊 Status</b>\n' +
        '/town — Current town status\n' +
        '/plots — Visual plot map\n' +
        '/agents — Agent leaderboard\n' +
        '/stats — World statistics\n\n' +
        '<b>🏗️ Buildings</b>\n' +
        '/buildings — List all buildings\n' +
        '/building &lt;n&gt; — Deep dive into a building\n' +
        '/events — Recent town events\n\n' +
        '<b>💰 Token</b>\n' +
        '/token — $ARENA token info + trade link\n' +
        '/newtown [name] — Found a new town\n\n' +
        '<b>🎮 Control</b>\n' +
        '/tick — Trigger one agent round\n' +
        '/go — Start auto-run (agents act every 45s)\n' +
        '/stop — Pause auto-run\n' +
        '/stream — Enable live broadcasting here',
      );
    });

    this.bot.command('town', async (ctx) => {
      try {
        const town = await this.getAnyTown();
        if (!town) { ctx.reply('No active town yet.'); return; }

        const built = town.plots.filter((p: any) => p.status === 'BUILT').length;
        const constructing = town.plots.filter((p: any) => p.status === 'UNDER_CONSTRUCTION').length;
        const claimed = town.plots.filter((p: any) => p.status === 'CLAIMED').length;
        const empty = town.plots.filter((p: any) => p.status === 'EMPTY').length;

        const bar = this.makeProgressBar(town.completionPct);

        this.send(ctx.chat.id,
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
        ctx.reply(`Error: ${err.message}`);
      }
    });

    this.bot.command('agents', async (ctx) => {
      try {
        const agents = await prisma.arenaAgent.findMany({
          where: { isActive: true },
          orderBy: { bankroll: 'desc' },
          take: 12,
        });

        const lines = agents.map((a, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          return `${medal} <b>${esc(a.name)}</b> (${a.archetype})\n   💰 ${a.bankroll} $ARENA | ELO ${a.elo}`;
        });

        this.send(ctx.chat.id, `👥 <b>Agent Leaderboard</b>\n\n${lines.join('\n\n')}`);
      } catch (err: any) {
        ctx.reply(`Error: ${err.message}`);
      }
    });

    this.bot.command('events', async (ctx) => {
      try {
        const town = await this.getAnyTown();
        if (!town) { ctx.reply('No active town.'); return; }
        const events = await townService.getRecentEvents(town.id, 10);
        if (events.length === 0) { ctx.reply('No events yet.'); return; }

        const lines = events.map((e: any) => {
          const time = new Date(e.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          const title = esc(e.title || '');
          const desc = esc(truncate(e.description || '', 120));
          return `[${time}] ${title}\n${desc}`;
        });

        this.send(ctx.chat.id, `📰 <b>Recent Events</b>\n\n${lines.join('\n\n')}`);
      } catch (err: any) {
        ctx.reply(`Error: ${err.message}`);
      }
    });

    this.bot.command('buildings', async (ctx) => {
      try {
        const town = await this.getAnyTown();
        if (!town) { ctx.reply('No town yet.'); return; }

        const activePlots = town.plots.filter((p: any) => p.status === 'BUILT' || p.status === 'UNDER_CONSTRUCTION');
        if (activePlots.length === 0) { ctx.reply('No buildings yet.'); return; }

        let summary = `🏘️ <b>${esc(town.name)} — Buildings</b>\n\n`;
        for (const plot of activePlots) {
          const emoji = plot.status === 'BUILT' ? '✅' : '🔨';
          const name = plot.buildingName || plot.buildingType || '?';
          const calls = plot.apiCallsUsed || 0;
          summary += `${emoji} [${plot.plotIndex}] <b>${esc(truncate(name, 25))}</b> (${calls} calls)\n`;
        }
        summary += `\nUse /building <number> for full details`;

        await this.send(ctx.chat.id, summary);
      } catch (err: any) {
        ctx.reply(`Error: ${err.message}`);
      }
    });

    // Deep dive into a specific building
    this.bot.command('building', async (ctx) => {
      try {
        const plotIndex = parseInt(ctx.message.text.split(' ')[1], 10);
        if (isNaN(plotIndex)) {
          ctx.reply('Usage: /building <plot number>\nExample: /building 1');
          return;
        }

        const town = await this.getAnyTown();
        if (!town) { ctx.reply('No town yet.'); return; }

        const plot = town.plots.find((p: any) => p.plotIndex === plotIndex);
        if (!plot) { ctx.reply(`Plot ${plotIndex} not found.`); return; }
        if (plot.status === 'EMPTY') { ctx.reply(`Plot ${plotIndex} is empty.`); return; }

        const owner = await prisma.arenaAgent.findUnique({ where: { id: plot.ownerId || '' } });
        const statusEmoji = plot.status === 'BUILT' ? '✅' : plot.status === 'UNDER_CONSTRUCTION' ? '🔨' : '📍';

        let msg = `${statusEmoji} <b>${esc(plot.buildingName || plot.buildingType || '?')}</b>\n`;
        msg += `📍 Plot ${plot.plotIndex} | ${plot.zone} | ${plot.buildingType}\n`;
        msg += `👤 Owner: ${esc(owner?.name || 'Unknown')} (${owner?.archetype || '?'})\n`;
        msg += `🧠 ${plot.apiCallsUsed} inference calls | 💰 ${plot.arenaInvested} $ARENA\n\n`;

        // Show design content
        const data = JSON.parse(plot.buildingData || '{}');
        const steps = Object.entries(data)
          .filter(([k]) => !k.startsWith('_'))
          .slice(0, 3); // Show first 3 steps

        for (const [_key, val] of steps) {
          const step = val as any;
          const content = step.output || '';
          if (content) {
            msg += `📝 <b>${esc(truncate(step.description || 'Design', 50))}</b>\n`;
            msg += `<i>${esc(truncate(content, 400))}</i>\n\n`;
          }
        }

        if (steps.length === 0 && plot.buildingDesc) {
          msg += `<i>${esc(truncate(plot.buildingDesc, 400))}</i>`;
        }

        await this.send(ctx.chat.id, msg);
      } catch (err: any) {
        ctx.reply(`Error: ${err.message}`);
      }
    });

    this.bot.command('stats', async (ctx) => {
      try {
        const stats = await townService.getWorldStats();
        this.send(ctx.chat.id,
          `📊 <b>World Statistics</b>\n\n` +
          `🏘️ Towns: ${stats.totalTowns} (${stats.completedTowns} complete)\n` +
          `👥 Agents: ${stats.totalAgents}\n` +
          `💰 Invested: ${stats.totalArenaInvested} $ARENA\n` +
          `🧠 Proof of Inference: ${stats.totalApiCalls} API calls\n` +
          `💵 Compute cost: $${(stats.totalApiCostCents / 100).toFixed(2)}\n` +
          `🎁 Yield paid: ${stats.totalYieldPaid} $ARENA`,
        );
      } catch (err: any) {
        ctx.reply(`Error: ${err.message}`);
      }
    });

    this.bot.command('plots', async (ctx) => {
      try {
        const town = await this.getAnyTown();
        if (!town) { ctx.reply('No active town.'); return; }

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

        this.send(ctx.chat.id,
          `🗺️ <b>${esc(town.name)} — Map</b>\n\n` +
          `${grid}\n` +
          `⬜ Empty  📍 Claimed  🔨 Building  🏠 Built`,
        );
      } catch (err: any) {
        ctx.reply(`Error: ${err.message}`);
      }
    });

    this.bot.command('stream', (ctx) => {
      this.chatId = ctx.chat.id.toString();
      this.send(ctx.chat.id, '✅ <b>Live streaming enabled!</b>\nAgent actions will appear here in real-time.\n\nTrigger a tick with /tick to see it in action.');
      console.log(`📱 Telegram streaming to chat ${this.chatId}`);
    });

    this.bot.command('tick', async (ctx) => {
      this.chatId = ctx.chat.id.toString();
      this.send(ctx.chat.id, '🤖 Triggering agent tick...');
      try {
        const results = await agentLoopService.tick();
        for (const r of results) {
          await this.broadcastTickResult(r);
        }
        
        // Send summary
        const town = await this.getAnyTown();
        const pct = town ? town.completionPct.toFixed(1) : '?';
        const invested = town ? town.totalInvested : 0;
        this.send(ctx.chat.id,
          `✅ <b>Tick complete</b> — ${results.length} agents acted\n` +
          `📊 Town progress: ${pct}% | 💰 ${invested} $ARENA invested`,
        );
      } catch (err: any) {
        ctx.reply(`❌ Tick error: ${err.message}`);
      }
    });

    this.bot.command('go', async (ctx) => {
      this.chatId = ctx.chat.id.toString();
      if (agentLoopService.isRunning()) {
        this.send(ctx.chat.id, '⚠️ Agents are already running! Use /stop to pause.');
        return;
      }
      const interval = 45; // seconds between ticks
      agentLoopService.start(interval * 1000);
      this.send(ctx.chat.id,
        `🚀 <b>Agents are now LIVE!</b>\n` +
        `Tick every ${interval}s. Actions will stream here.\n` +
        `Use /stop to pause.`,
      );
    });

    this.bot.command('stop', async (ctx) => {
      if (!agentLoopService.isRunning()) {
        this.send(ctx.chat.id, '⚠️ Agents are not running.');
        return;
      }
      agentLoopService.stop();
      this.send(ctx.chat.id, '⏸️ <b>Agents paused.</b> Use /go to resume.');
    });

    this.bot.command('token', async (ctx) => {
      const addr = process.env.ARENA_TOKEN_ADDRESS || '0x0bA5E04470Fe327AC191179Cf6823E667B007777';
      const nadUrl = `https://nad.fun/tokens/${addr}`;
      const explorerUrl = `https://explorer.monad.xyz/address/${addr}`;
      this.send(ctx.chat.id,
        `🪙 <b>$ARENA Token</b>\n\n` +
        `<b>Name:</b> Arena Town\n` +
        `<b>Symbol:</b> $ARENA\n` +
        `<b>Network:</b> Monad Testnet\n` +
        `<b>Address:</b> <code>${addr}</code>\n\n` +
        `Every building in AI Town costs $ARENA to build. Completed towns yield passive $ARENA to contributors. The real cost? LLM inference — every design step is a real API call.\n\n` +
        `<a href="${nadUrl}">📈 Trade on nad.fun</a>  |  <a href="${explorerUrl}">🔍 Explorer</a>`,
      );
    });

    this.bot.command('newtown', async (ctx) => {
      const parts = ctx.message.text.split(' ');
      const name = parts.slice(1).join(' ').trim() || `Town ${Date.now().toString(36).slice(-4)}`;
      this.chatId = ctx.chat.id.toString();
      this.send(ctx.chat.id, `🏗️ Creating a new town: <b>${esc(name)}</b>...`);
      try {
        const town = await townService.createTown(name);
        this.send(ctx.chat.id,
          `🎉 <b>${esc(town.name)}</b> founded!\n\n` +
          `📍 ${town.totalPlots} plots available\n` +
          `🎨 Theme: <i>${esc(town.theme || 'random')}</i>\n\n` +
          `Use /go to let agents start building, or /tick for manual rounds.`,
        );
      } catch (err: any) {
        ctx.reply(`❌ Error: ${err.message}`);
      }
    });
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

    const archetype = result.archetype || '';
    const archetypeEmoji = this.archetypeEmoji(archetype);
    const action = result.action;

    let msg = '';

    switch (action.type) {
      case 'claim_plot': {
        const zone = action.details?.zone || '?';
        const plotIdx = action.details?.plotIndex ?? '?';
        msg = `${archetypeEmoji} <b>${esc(result.agentName)}</b> claimed plot ${plotIdx} (${zone})\n`;
        msg += `💬 <i>"${esc(truncate(action.reasoning || '', 200))}"</i>`;
        break;
      }
      case 'start_build': {
        const buildType = action.details?.buildingType || 'building';
        msg = `🔨 <b>${esc(result.agentName)}</b> started building: <b>${esc(buildType)}</b>\n`;
        msg += `💬 <i>"${esc(truncate(action.reasoning || '', 200))}"</i>`;
        break;
      }
      case 'do_work': {
        // Show a snippet of the generated content (proof of inference!)
        const narrative = result.narrative || '';
        const contentPreview = narrative.includes('🔨')
          ? narrative.split('🔨')[1]?.trim()
          : narrative;
        msg = `🏗️ <b>${esc(result.agentName)}</b> worked on their building\n`;
        msg += `📝 <i>${esc(truncate(contentPreview || action.reasoning || '', 250))}</i>`;
        break;
      }
      case 'complete_build': {
        msg = `🎉🎉 <b>${esc(result.agentName)}</b> COMPLETED their building!\n`;
        msg += `${esc(truncate(result.narrative, 200))}`;
        break;
      }
      case 'mine': {
        msg = `⛏️ <b>${esc(result.agentName)}</b> mined $ARENA\n`;
        msg += `💬 <i>"${esc(truncate(action.reasoning || '', 150))}"</i>`;
        break;
      }
      case 'play_arena': {
        msg = `🎮 <b>${esc(result.agentName)}</b> heads to the arena!\n`;
        msg += `💬 <i>"${esc(truncate(action.reasoning || '', 150))}"</i>`;
        break;
      }
      default: {
        msg = `${this.actionEmoji(action.type)} <b>${esc(result.agentName)}</b> → ${action.type.replace(/_/g, ' ')}\n`;
        msg += `<i>${esc(truncate(action.reasoning || result.narrative, 200))}</i>`;
      }
    }

    if (result.cost && result.cost.costCents > 0) {
      msg += `\n🧠 inference: $${(result.cost.costCents / 100).toFixed(4)}`;
    }

    await this.send(this.chatId, msg);
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

  async broadcastMessage(text: string): Promise<void> {
    if (!this.bot || !this.chatId) return;
    await this.send(this.chatId, text);
  }

  async broadcastTownProgress(): Promise<void> {
    const town = await this.getAnyTown();
    if (!town) return;

    const bar = this.makeProgressBar(town.completionPct);
    await this.broadcastMessage(
      `📊 <b>Town Progress</b>\n${bar} ${town.completionPct.toFixed(1)}%\n` +
      `💰 ${town.totalInvested} $ARENA invested`,
    );
  }

  // ============================================
  // Helpers
  // ============================================

  /** Get any town (active first, then most recent) */
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
    const empty = 20 - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
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
