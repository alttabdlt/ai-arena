/**
 * TelegramBotService — Telegram is the user interface for AI Town.
 *
 * Users chat with AI agents via Telegram:
 * - /tell <agent> <message> — give an agent instructions
 * - Free-text messages are routed to your bonded agent (or matched by @name)
 * - Agents decide autonomously whether to follow instructions
 * - Agents reply in-character with their reasoning
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
        'Autonomous AI agents build towns, trade $ARENA, and fight in Poker matches. <b>You can talk to them.</b>\n\n' +
        '<b>💬 Chat with Agents</b>\n' +
        '/tell &lt;agent&gt; &lt;message&gt; — Give an agent instructions\n' +
        'Or just type: <code>AlphaShark go claim a plot</code>\n' +
        'Agents decide if they listen. They have opinions. 😏\n\n' +
        '<b>⚔️ Wheel of Fate</b>\n' +
        '/wheel — Current fight status\n' +
        '/bet &lt;agent&gt; &lt;amount&gt; — Bet on a fight\n\n' +
        '<b>📊 Watch</b>\n' +
        '/agents — Agent leaderboard\n' +
        '/town — Town status\n' +
        '/buildings — Buildings list\n' +
        '/stats — World stats\n\n' +
        '<b>🎮 Control</b>\n' +
        '/go — Start agents\n' +
        '/stop — Pause agents\n' +
        '/stream — Live feed here',
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
        msg += `🧠 ${plot.apiCallsUsed} inference calls | 💰 ${plot.buildCostArena ?? 0} $ARENA\n\n`;

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

    // ============================================
    // /wheel — Check Wheel of Fate status
    // ============================================
    this.bot.command('wheel', async (ctx) => {
      try {
        const { wheelOfFateService } = await import('./wheelOfFateService');
        const status = wheelOfFateService.getStatus();
        const emoji = status.phase === 'FIGHTING' ? '⚔️' : status.phase === 'ANNOUNCING' ? '🎰' : status.phase === 'AFTERMATH' ? '🏆' : '⏳';

        if (status.phase === 'IDLE' || status.phase === 'PREP') {
          const nextIn = status.nextSpinAt ? Math.max(0, Math.round((status.nextSpinAt.getTime() - Date.now()) / 1000)) : '?';
          this.send(ctx.chat.id,
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
            msg += `Use: <code>/bet ${m.agent1.name} 100</code>`;
          }

          if (status.lastResult) {
            msg += `\n\n🏆 Winner: <b>${esc(status.lastResult.winnerName)}</b>`;
            if (status.lastResult.winnerQuip) {
              msg += `\n<i>"${esc(status.lastResult.winnerQuip)}"</i>`;
            }
          }

          this.send(ctx.chat.id, msg);
        }
      } catch (err: any) {
        ctx.reply(`Error: ${err.message}`);
      }
    });

    // ============================================
    // /bet — Bet on a Wheel of Fate fight
    // ============================================
    this.bot.command('bet', async (ctx) => {
      try {
        const parts = ctx.message.text.replace(/^\/bet\s*/i, '').trim();
        if (!parts) {
          this.send(ctx.chat.id,
            '🎲 <b>Bet on the fight!</b>\n\n' +
            'Usage: <code>/bet AgentName amount</code>\n' +
            'Example: <code>/bet AlphaShark 200</code>\n\n' +
            'Only works during ANNOUNCING phase (betting window).',
          );
          return;
        }

        const { wheelOfFateService } = await import('./wheelOfFateService');
        const status = wheelOfFateService.getStatus();

        if (status.phase !== 'ANNOUNCING') {
          ctx.reply(`❌ Betting is only open during ANNOUNCING phase. Current: ${status.phase}${status.nextSpinAt ? `. Next fight in ~${Math.round((status.nextSpinAt.getTime() - Date.now()) / 1000)}s` : ''}`);
          return;
        }

        if (!status.currentMatch) {
          ctx.reply('❌ No active match to bet on.');
          return;
        }

        // Parse: agent name + amount
        const firstSpace = parts.indexOf(' ');
        if (firstSpace === -1) {
          ctx.reply('❌ Usage: /bet <agent_name> <amount>');
          return;
        }
        const agentQuery = parts.slice(0, firstSpace).trim();
        const amountStr = parts.slice(firstSpace + 1).trim();
        const amount = parseInt(amountStr, 10);
        if (!Number.isFinite(amount) || amount <= 0) {
          ctx.reply('❌ Amount must be a positive number.');
          return;
        }

        // Match to one of the fighting agents
        const m = status.currentMatch;
        const agent = await this.fuzzyFindAgent(agentQuery);
        if (!agent) {
          ctx.reply(`❌ No agent found matching "${agentQuery}"\n\nFighting: ${m.agent1.name} vs ${m.agent2.name}`);
          return;
        }

        const isAgent1 = agent.id === m.agent1.id;
        const isAgent2 = agent.id === m.agent2.id;
        if (!isAgent1 && !isAgent2) {
          ctx.reply(`❌ ${agent.name} is not in this fight.\n\nFighting: ${m.agent1.name} vs ${m.agent2.name}`);
          return;
        }

        // Place the bet via prediction service
        const { predictionService } = await import('./predictionService');
        if (!m.marketId) {
          ctx.reply('❌ No prediction market for this fight.');
          return;
        }

        const side: 'A' | 'B' = isAgent1 ? 'A' : 'B';
        // Use telegram user ID as wallet address for betting
        const tgWallet = `tg:${ctx.from?.id || ctx.chat.id}`;

        // Ensure user has a balance record (create with free chips if new)
        let balance = await prisma.userBalance.findUnique({ where: { walletAddress: tgWallet } });
        if (!balance) {
          // Give new Telegram users 1000 free betting chips
          balance = await prisma.userBalance.create({
            data: { walletAddress: tgWallet, balance: 1000 },
          });
          this.send(ctx.chat.id, `🎁 Welcome! You've been given <b>1,000 $ARENA</b> betting chips.`);
        }

        if (balance.balance < amount) {
          ctx.reply(`❌ Insufficient balance. You have ${balance.balance} $ARENA. Bet: ${amount}`);
          return;
        }

        try {
          await predictionService.placeBet(tgWallet, m.marketId, side, amount);
          const emoji = this.archetypeEmoji(agent.archetype);
          this.send(ctx.chat.id,
            `${emoji} <b>Bet placed!</b>\n\n` +
            `${amount} $ARENA on <b>${esc(agent.name)}</b>\n` +
            `💰 Remaining balance: ${balance.balance - amount} $ARENA`,
          );
        } catch (betErr: any) {
          ctx.reply(`❌ Bet failed: ${betErr.message || 'Unknown error'}`);
        }
      } catch (err: any) {
        ctx.reply(`❌ Error: ${err.message}`);
      }
    });

    // ============================================
    // /tell — Talk to an agent
    // ============================================
    this.bot.command('tell', async (ctx) => {
      const parts = ctx.message.text.replace(/^\/tell\s*/i, '').trim();
      if (!parts) {
        this.send(ctx.chat.id,
          '💬 <b>Talk to an agent!</b>\n\n' +
          'Usage: <code>/tell AgentName your message</code>\n\n' +
          'Example:\n' +
          '<code>/tell AlphaShark go claim plot 5</code>\n' +
          '<code>/tell YoloDegen bet big on the next fight</code>\n\n' +
          'The agent will consider your suggestion and respond in character. They might follow it... or not! 😏',
        );
        return;
      }

      // Parse: first word = agent name (fuzzy match), rest = message
      const firstSpace = parts.indexOf(' ');
      if (firstSpace === -1) {
        ctx.reply('❌ Usage: /tell <agent_name> <message>');
        return;
      }
      const agentQuery = parts.slice(0, firstSpace).trim();
      const message = parts.slice(firstSpace + 1).trim();
      if (!message) {
        ctx.reply('❌ What do you want to tell them?');
        return;
      }

      const agent = await this.fuzzyFindAgent(agentQuery);
      if (!agent) {
        const agents = await prisma.arenaAgent.findMany({ where: { isActive: true }, select: { name: true }, take: 10 });
        const names = agents.map(a => a.name).join(', ');
        ctx.reply(`❌ No agent found matching "${agentQuery}"\n\nActive agents: ${names}`);
        return;
      }

      const fromUser = ctx.from?.first_name || ctx.from?.username || 'Anon';
      agentLoopService.queueInstruction(agent.id, message, ctx.chat.id.toString(), fromUser);

      const emoji = this.archetypeEmoji(agent.archetype);
      const isRunning = agentLoopService.isRunning();
      const statusNote = isRunning
        ? (agent.archetype === 'DEGEN' ? 'No promises they\'ll listen though... 🎲' : 'They\'ll consider it.')
        : '⚠️ Agents aren\'t running — use /go to start them first!';
      this.send(ctx.chat.id,
        `${emoji} Message queued for <b>${esc(agent.name)}</b>:\n` +
        `<i>"${esc(truncate(message, 200))}"</i>\n\n` +
        `${statusNote}`,
      );
    });

    // ============================================
    // Free-text handler — route to agents via @mention or name prefix
    // ============================================
    this.bot.on('text', async (ctx) => {
      // Skip commands
      if (ctx.message.text.startsWith('/')) return;

      const text = ctx.message.text.trim();
      // Minimum length to avoid accidental matches
      if (!text || text.length < 5) return;

      // Try to find an @mentioned agent
      const mentionMatch = text.match(/@(\w+)/);
      let agent: any = null;
      let message = text;

      if (mentionMatch) {
        agent = await this.fuzzyFindAgent(mentionMatch[1]);
        if (agent) {
          message = text.replace(/@\w+/, '').trim();
        }
      }

      // If no @mention match, try agent name at start — but require a separator (comma, colon, space + verb)
      if (!agent) {
        const agents = await prisma.arenaAgent.findMany({ where: { isActive: true }, select: { id: true, name: true, archetype: true } });
        for (const a of agents) {
          const nameLower = a.name.toLowerCase();
          const textLower = text.toLowerCase();
          // Require the name to be followed by a separator: comma, colon, or space
          if (textLower.startsWith(nameLower) && (textLower.length === nameLower.length || /^[,:\s]/.test(textLower.slice(nameLower.length)))) {
            const remainder = text.slice(a.name.length).replace(/^[,:\s]+/, '').trim();
            // In groups, require actual content after the name (not just "AlphaShark" alone)
            if (remainder.length >= 3) {
              agent = a;
              message = remainder;
              break;
            }
          }
        }
      }

      // In groups without a clear agent match, silently ignore
      if (!agent || !message || message.length < 3) return;

      const fromUser = ctx.from?.first_name || ctx.from?.username || 'Anon';
      agentLoopService.queueInstruction(agent.id, message, ctx.chat.id.toString(), fromUser);

      const emoji = this.archetypeEmoji(agent.archetype);
      const isRunning = agentLoopService.isRunning();
      const status = isRunning ? "They'll respond next tick." : "⚠️ Agents aren't running yet — use /go to start them.";
      await ctx.reply(`${emoji} ${agent.name} heard you. ${status}`);
    });
  }

  // ============================================
  // Agent Lookup
  // ============================================

  /** Fuzzy match an agent by name (case-insensitive, partial match) */
  private async fuzzyFindAgent(query: string): Promise<{ id: string; name: string; archetype: string } | null> {
    const q = query.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!q) return null;

    const agents = await prisma.arenaAgent.findMany({
      where: { isActive: true },
      select: { id: true, name: true, archetype: true },
    });

    // Exact match first
    const exact = agents.find(a => a.name.toLowerCase() === query.toLowerCase());
    if (exact) return exact;

    // Prefix match
    const prefix = agents.find(a => a.name.toLowerCase().startsWith(q));
    if (prefix) return prefix;

    // Fuzzy: contains
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

    // If this agent had user instructions, send personalized replies
    if (result.instructionSenders && result.instructionSenders.length > 0) {
      const emoji = this.archetypeEmoji(result.archetype);
      // Prefer humanReply (dedicated in-character response), fall back to reasoning
      const replyText = result.humanReply || result.action.reasoning || result.narrative || '';
      const actionLabel = result.action.type.replace(/_/g, ' ');
      const replyMsg =
        `${emoji} <b>${esc(result.agentName)}</b> says:\n\n` +
        `<i>"${esc(truncate(replyText, 500))}"</i>\n\n` +
        `→ Action: <b>${esc(actionLabel)}</b> ${result.success ? '✅' : '❌'}`;

      // Send to each unique chat that sent instructions
      const sentChats = new Set<string>();
      for (const sender of result.instructionSenders) {
        if (sentChats.has(sender.chatId)) continue;
        sentChats.add(sender.chatId);
        await this.send(sender.chatId, replyMsg);
      }
    }
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
