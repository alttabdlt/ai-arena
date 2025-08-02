import { Context } from '../../config/context';
import { DateTimeResolver } from 'graphql-scalars';
import GraphQLJSON from 'graphql-type-json';
import { aiService } from '../../services/aiService';
import { TransactionService } from '../../services/transactionService';
import { AuthService } from '../../services/authService';
import { PromptValidator } from '../../utils/promptValidation';
import { isHexString } from 'ethers';
import { Prisma, QueueType } from '@prisma/client';
import { PubSub } from 'graphql-subscriptions';
import { gameManagerResolvers } from './gameManager';
import { getQueueService } from '../../services';
import { getGameManagerService } from '../../services/gameManagerService';

interface PubSubAsyncIterator<T> extends AsyncIterator<T> {
  return(): Promise<IteratorResult<T>>;
  throw(error?: any): Promise<IteratorResult<T>>;
}

interface TypedPubSub extends PubSub {
  asyncIterator<T = any>(triggers: string | string[]): PubSubAsyncIterator<T>;
}

// Use the singleton aiService instance
const DEPLOYMENT_FEE = '0.01'; // 0.01 HYPE

export const resolvers = {
  DateTime: DateTimeResolver,
  JSON: GraphQLJSON,

  Query: {
    user: async (_: any, { address }: { address: string }, ctx: Context) => {
      return ctx.prisma.user.findUnique({
        where: { address: address.toLowerCase() },
        include: {
          bots: true,
          deployments: true,
          achievements: true,
        },
      });
    },

    bot: async (_: any, { id }: { id: string }, ctx: Context) => {
      return ctx.prisma.bot.findUnique({
        where: { id },
        include: {
          creator: true,
          queueEntries: {
            where: { status: 'WAITING' },
          },
        },
      });
    },

    bots: async (_: any, args: any, ctx: Context) => {
      const { filter, sort, limit = 20, offset = 0 } = args;
      
      const where: Prisma.BotWhereInput = {};
      
      if (filter) {
        if (filter.modelType) where.modelType = filter.modelType;
        if (filter.isActive !== undefined) where.isActive = filter.isActive;
        if (filter.creatorAddress) {
          // Need to find user by address first
          const user = await ctx.prisma.user.findUnique({
            where: { address: filter.creatorAddress.toLowerCase() }
          });
          if (user) {
            where.creatorId = user.id;
          } else {
            // If user not found, return empty array
            return [];
          }
        }
      }
      
      return ctx.prisma.bot.findMany({
        where,
        skip: offset,
        take: limit,
        include: {
          creator: true,
        },
        orderBy: sort ? getOrderBy(sort) : { createdAt: 'desc' },
      });
    },

    topBots: async (_: any, { limit = 10 }: { limit?: number }, ctx: Context) => {
      const key = `top:bots:${limit}`;
      
      // Try to get from cache if Redis is available
      try {
        const cached = await ctx.redis.get(key);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        // Redis not available, continue without cache
      }

      // Get bots with parsed stats
      const botsWithStats = await ctx.prisma.bot.findMany({
        take: limit * 2, // Get more to filter out inactive
        where: { isActive: true },
        include: {
          creator: true,
        },
      });

      // Sort by win rate
      const sortedBots = botsWithStats
        .map(bot => ({
          ...bot,
          parsedStats: typeof bot.stats === 'string' ? JSON.parse(bot.stats) : bot.stats
        }))
        .sort((a, b) => {
          const aWinRate = a.parsedStats.winRate || 0;
          const bWinRate = b.parsedStats.winRate || 0;
          return bWinRate - aWinRate;
        })
        .slice(0, limit);

      // Try to cache if Redis is available
      try {
        await ctx.redis.setex(key, 300, JSON.stringify(sortedBots));
      } catch (err) {
        // Redis not available, skip caching
      }
      
      return sortedBots;
    },

    recentBots: async (_: any, { limit = 10 }: { limit?: number }, ctx: Context) => {
      return ctx.prisma.bot.findMany({
        take: limit,
        include: {
          creator: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    },

    queuedBots: async (_: any, { limit = 10 }: { limit?: number }, ctx: Context) => {
      const entries = await ctx.prisma.queueEntry.findMany({
        where: { status: 'WAITING' },
        take: limit,
        include: {
          bot: {
            include: {
              creator: true,
            },
          },
        },
        orderBy: { enteredAt: 'asc' },
      });
      
      return entries.map(entry => entry.bot);
    },

    platformStats: async (_: any, __: any, ctx: Context) => {
      const [totalBots, activeBots, totalUsers, queuedBots] = await Promise.all([
        ctx.prisma.bot.count(),
        ctx.prisma.bot.count({ where: { isActive: true } }),
        ctx.prisma.user.count(),
        ctx.prisma.queueEntry.count({ where: { status: 'WAITING' } }),
      ]);

      return {
        totalBots,
        activeBots,
        totalUsers,
        activeUsers24h: 0, // TODO: Implement
        totalMatches: 0, // TODO: Implement
        queuedBots,
        totalEarnings: '0', // TODO: Implement
      };
    },

    userStats: async (_: any, { address }: { address: string }, ctx: Context) => {
      const user = await ctx.prisma.user.findUnique({
        where: { address: address.toLowerCase() },
        include: {
          bots: {
            include: {
              _count: {
                select: { 
                  tournaments: true,
                  matches: true 
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const totalBots = user.bots.length;
      const activeBots = user.bots.filter(bot => bot.isActive).length;
      
      // Calculate total wins from bot stats
      let totalWins = 0;
      let totalEarnings = '0';
      let bestBot = null;
      let maxWinRate = 0;
      
      for (const bot of user.bots) {
        const stats = typeof bot.stats === 'string' ? JSON.parse(bot.stats) : bot.stats;
        totalWins += stats.wins || 0;
        if (stats.winRate > maxWinRate) {
          maxWinRate = stats.winRate;
          bestBot = bot;
        }
      }

      return {
        totalBots,
        activeBots,
        totalWins,
        totalEarnings,
        bestBot,
        recentMatches: [], // TODO: Implement when Match model is added
      };
    },

    queueStatus: async (_: any, __: any, ctx: Context) => {
      // Get both WAITING and MATCHED entries
      const [waitingEntries, matchedEntries] = await Promise.all([
        ctx.prisma.queueEntry.groupBy({
          by: ['queueType'],
          where: { status: 'WAITING' },
          _count: true,
        }),
        ctx.prisma.queueEntry.groupBy({
          by: ['queueType'],
          where: { status: 'MATCHED' },
          _count: true,
        })
      ]);

      // Count WAITING entries (these are actually in queue)
      const totalWaiting = waitingEntries.reduce((sum, entry) => sum + entry._count, 0);
      
      // Count MATCHED entries (these are in active matches)
      const totalMatched = matchedEntries.reduce((sum, entry) => sum + entry._count, 0);
      
      // For the queue display, we want to show WAITING players
      // but we can add matched count for debugging
      console.log(`Queue status: ${totalWaiting} waiting, ${totalMatched} matched`);
      
      // Get next match time from queue service
      const nextMatchTime = getQueueService().getNextMatchTime();
      
      return {
        totalInQueue: totalWaiting, // Only count waiting players as "in queue"
        totalMatched, // Add this for debugging
        averageWaitTime: 120, // TODO: Calculate from historical data
        nextMatchTime,
        queueTypes: waitingEntries.map(entry => ({
          type: entry.queueType,
          count: entry._count,
          estimatedWaitTime: 120, // TODO: Calculate per queue type
        })),
      };
    },
    
    match: async (_: any, { id }: { id: string }, ctx: Context) => {
      console.log(`\n=== Match Query ===`);
      console.log(`Match ID requested: ${id}`);
      console.log(`User authenticated: ${!!ctx.user}`);
      console.log(`User ID: ${ctx.user?.id || 'N/A'}`);
      
      try {
        const match = await ctx.prisma.match.findUnique({
          where: { id },
          include: {
            participants: {
              include: {
                bot: {
                  include: {
                    creator: true,
                  },
                },
              },
            },
            tournament: true,
          },
        });
        
        console.log(`Match found: ${!!match}`);
        if (match) {
          console.log(`Match status: ${match.status}`);
          console.log(`Participants: ${match.participants?.length || 0}`);
          console.log(`Tournament ID: ${match.tournamentId || 'N/A'}`);
          console.log(`Has tournament loaded: ${!!match.tournament}`);
        }
        
        if (!match) {
          console.error(`❌ Match not found in database: ${id}`);
          throw new Error(`Match not found: ${id}`);
        }
        
        // Ensure tournament is loaded
        if (!match.tournament && match.tournamentId) {
          console.log(`Loading tournament separately: ${match.tournamentId}`);
          match.tournament = await ctx.prisma.tournament.findUnique({
            where: { id: match.tournamentId },
          });
          console.log(`Tournament loaded: ${!!match.tournament}`);
        }
        
        console.log(`✅ Match query successful`);
        return match;
      } catch (error: any) {
        console.error(`❌ Match query error:`, {
          matchId: id,
          error: error.message,
          stack: error.stack,
          user: ctx.user?.address
        });
        throw error;
      }
    },
    
    getModelEvaluations: async (_: any, __: any, _ctx: Context) => {
      const evaluations = aiService.getModelEvaluations();
      return Array.from(evaluations.values());
    },
    
    getModelEvaluation: async (_: any, { model }: { model: string }, _ctx: Context) => {
      const evaluations = aiService.getModelEvaluations();
      return evaluations.get(model) || null;
    },
    
    // Game Manager queries
    ...gameManagerResolvers.Query,
  },

  Mutation: {
    deployBot: async (_: any, { input }: any, ctx: Context) => {
      if (!ctx.user) {
        throw new Error('Not authenticated');
      }

      // Validate input
      if (!input.name || input.name.length > 30) {
        throw new Error('Bot name must be between 1 and 30 characters');
      }
      
      // Validate and sanitize prompt
      const promptValidation = PromptValidator.validate(input.prompt);
      if (!promptValidation.isValid) {
        throw new Error(`Invalid prompt: ${promptValidation.errors.join(', ')}`);
      }
      
      if (!input.txHash || !isHexString(input.txHash, 32)) {
        throw new Error('Invalid transaction hash');
      }
      
      // Validate transaction on-chain
      const txService = new TransactionService(ctx.prisma);
      const validation = await txService.validateDeploymentTransaction(
        input.txHash,
        ctx.user.address
      );
      
      if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid transaction');
      }
      
      // Create bot and deployment transaction in a transaction
      const bot = await ctx.prisma.$transaction(async (prisma) => {
        // Create the bot
        const newBot = await prisma.bot.create({
          data: {
            name: input.name,
            avatar: input.avatar,
            prompt: promptValidation.sanitized,
            modelType: input.modelType,
            creatorId: ctx.user!.id,
            isActive: true,
            stats: {
              wins: 0,
              losses: 0,
              earnings: '0',
              winRate: 0,
              avgFinishPosition: 0,
            },
          },
          include: {
            creator: true,
          },
        });
        
        // Create deployment transaction record
        await prisma.deploymentTransaction.create({
          data: {
            botId: newBot.id,
            userId: ctx.user!.id,
            txHash: input.txHash,
            amount: DEPLOYMENT_FEE,
            status: 'PENDING',
          },
        });
        
        // Automatically add to standard queue
        await prisma.queueEntry.create({
          data: {
            botId: newBot.id,
            queueType: 'STANDARD',
            priority: 0,
            status: 'WAITING',
            enteredAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          },
        });
        
        return newBot;
      });
      
      // TODO: Emit bot deployed event for subscriptions
      
      return bot;
    },
    
    toggleBotActive: async (_: any, { botId }: { botId: string }, ctx: Context) => {
      if (!ctx.user) {
        throw new Error('Not authenticated');
      }
      
      const bot = await ctx.prisma.bot.findUnique({
        where: { id: botId },
      });
      
      if (!bot) {
        throw new Error('Bot not found');
      }
      
      if (bot.creatorId !== ctx.user.id) {
        throw new Error('Not authorized');
      }
      
      return ctx.prisma.bot.update({
        where: { id: botId },
        data: { isActive: !bot.isActive },
        include: { creator: true },
      });
    },
    
    enterQueue: async (_: any, { botId, queueType }: { botId: string; queueType: string }, ctx: Context) => {
      if (!ctx.user) {
        throw new Error('Not authenticated');
      }
      
      const bot = await ctx.prisma.bot.findUnique({
        where: { id: botId },
      });
      
      if (!bot) {
        throw new Error('Bot not found');
      }
      
      if (bot.creatorId !== ctx.user.id) {
        throw new Error('Not authorized');
      }
      
      if (!bot.isActive) {
        throw new Error('Bot is not active');
      }
      
      console.log(`User ${ctx.user.address} entering queue with bot ${bot.name} (${botId}), isDemo: ${bot.isDemo}`);
      
      // Check if already in queue
      const existingEntry = await ctx.prisma.queueEntry.findFirst({
        where: {
          botId,
          status: 'WAITING',
        },
      });
      
      if (existingEntry) {
        throw new Error('Bot is already in queue');
      }
      
      return ctx.prisma.queueEntry.create({
        data: {
          botId,
          queueType: queueType as QueueType,
          priority: queueType === 'PRIORITY' ? 1 : 0,
          status: 'WAITING',
          enteredAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        include: {
          bot: {
            include: { creator: true },
          },
        },
      });
    },
    
    leaveQueue: async (_: any, { botId }: { botId: string }, ctx: Context) => {
      if (!ctx.user) {
        throw new Error('Not authenticated');
      }
      
      const bot = await ctx.prisma.bot.findUnique({
        where: { id: botId },
      });
      
      if (!bot) {
        throw new Error('Bot not found');
      }
      
      if (bot.creatorId !== ctx.user.id) {
        throw new Error('Not authorized');
      }
      
      // Prevent demo bots from being removed from queue
      if (bot.isDemo) {
        throw new Error('Demo bots cannot be removed from queue');
      }
      
      const result = await ctx.prisma.queueEntry.updateMany({
        where: {
          botId,
          status: 'WAITING',
        },
        data: {
          status: 'CANCELLED',
        },
      });
      
      return result.count > 0;
    },
    
    signalFrontendReady: async (_: any, { matchId }: { matchId: string }, ctx: Context) => {
      if (!ctx.user) {
        throw new Error('Not authenticated');
      }
      
      const gameManagerService = getGameManagerService();
      return gameManagerService.signalFrontendReady(matchId);
    },
    
    startReverseHangmanRound: async (_: any, { matchId, difficulty }: { matchId: string; difficulty: string }, ctx: Context) => {
      if (!ctx.user) {
        throw new Error('Not authenticated');
      }
      
      const gameManagerService = getGameManagerService();
      return gameManagerService.startReverseHangmanRound(matchId, difficulty);
    },
    
    setTestGameType: async (_: any, { gameType }: { gameType: string | null }) => {
      // Only allow in development mode
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Test mode is not available in production');
      }
      
      const queueService = getQueueService();
      queueService.setTestGameTypeOverride(gameType);
      
      return true;
    },
    
    leaveGame: async (_: any, { gameId }: { gameId: string }, ctx: Context) => {
      if (!ctx.user) {
        throw new Error('Not authenticated');
      }
      
      const gameManagerService = getGameManagerService();
      const activeViewers = await gameManagerService.removeViewer(gameId, ctx.user.id);
      
      return {
        success: true,
        message: 'Left game successfully',
        activeViewers
      };
    },
    
    joinGame: async (_: any, { gameId }: { gameId: string }, ctx: Context) => {
      if (!ctx.user) {
        throw new Error('Not authenticated');
      }
      
      const gameManagerService = getGameManagerService();
      const activeViewers = await gameManagerService.addViewer(gameId, ctx.user.id);
      
      return {
        success: true,
        message: 'Joined game successfully',
        activeViewers
      };
    },

    updateGameSpeed: async (_: any, { gameId, speed }: { gameId: string; speed: string }, ctx: Context) => {
      if (!ctx.user) {
        throw new Error('Not authenticated');
      }
      
      const gameManagerService = getGameManagerService();
      await gameManagerService.updateGameSpeed(gameId, speed);
      
      return {
        success: true,
        message: 'Game speed updated successfully'
      };
    },
    
    startDebugLogging: async (_: any, { gameType, matchId }: { gameType: string; matchId?: string }) => {
      const { fileLoggerService } = await import('../../services/fileLoggerService');
      fileLoggerService.startGameLogging(gameType, matchId);
      return true;
    },
    
    stopDebugLogging: async () => {
      const { fileLoggerService } = await import('../../services/fileLoggerService');
      await fileLoggerService.stopGameLogging();
      return true;
    },
    
    sendDebugLog: async (_: any, { log }: { log: any }) => {
      // Filter out any logs that mention SendDebugLog to prevent flooding
      const message = (log.message || '').toLowerCase();
      const dataStr = JSON.stringify(log.data || {}).toLowerCase();
      
      if (message.includes('senddebuglog') || 
          message.includes('send_debug_log') ||
          message.includes('debuglog') ||
          dataStr.includes('senddebuglog') ||
          dataStr.includes('send_debug_log')) {
        return true; // Silently skip logging but return success
      }
      
      const { fileLoggerService } = await import('../../services/fileLoggerService');
      
      // Save to the appropriate game folder
      if (log.source === 'frontend') {
        // Extract game type from the log data
        const gameType = log.data?.gameType || 'poker'; // Default to poker if not specified
        
        // Write to console.log file in the game folder
        const fs = await import('fs');
        const path = await import('path');
        // From compiled location: dist/graphql/resolvers/index.js
        // Need to go up: dist/graphql/resolvers -> dist/graphql -> dist -> backend -> project root
        const logDir = path.join(__dirname, '..', '..', '..', '..', 'debug-logs', gameType);
        const consoleLogFile = path.join(logDir, 'console.log');
        
        // Ensure directory exists
        await fs.promises.mkdir(logDir, { recursive: true });
        
        // Format log entry
        let logEntry = `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`;
        
        // Add data if present
        if (log.data && Object.keys(log.data).length > 1) { // More than just gameType
          const dataWithoutGameType = { ...log.data };
          delete dataWithoutGameType.gameType;
          if (Object.keys(dataWithoutGameType).length > 0) {
            logEntry += `\nData: ${JSON.stringify(dataWithoutGameType, null, 2)}`;
          }
        }
        
        // Add stack trace if present
        if (log.stack) {
          logEntry += `\nStack: ${log.stack}`;
        }
        
        logEntry += '\n\n';
        
        // Write to file (overwrite mode for first log, append for subsequent)
        const isFirstLog = log.message.includes('Started capturing logs');
        await fs.promises.writeFile(
          consoleLogFile,
          logEntry,
          { flag: isFirstLog ? 'w' : 'a' }
        );
      } else {
        // Backend logs go through fileLoggerService
        fileLoggerService.addLog(log);
      }
      
      return true;
    },
    
    sendDebugLogBatch: async (_: any, { logs }: { logs: any[] }) => {
      const { fileLoggerService } = await import('../../services/fileLoggerService');
      const fs = await import('fs');
      const path = await import('path');
      
      // Filter out any logs that mention SendDebugLog to prevent flooding
      const filteredLogs = logs.filter(log => {
        const message = (log.message || '').toLowerCase();
        const dataStr = JSON.stringify(log.data || {}).toLowerCase();
        
        // Skip logs that mention SendDebugLog operations
        if (message.includes('senddebuglog') || 
            message.includes('send_debug_log') ||
            message.includes('debuglog') ||
            dataStr.includes('senddebuglog') ||
            dataStr.includes('send_debug_log')) {
          return false;
        }
        
        return true;
      });
      
      // Group logs by game type
      const logsByGameType = new Map<string, any[]>();
      
      for (const log of filteredLogs) {
        if (log.source === 'frontend') {
          const gameType = log.data?.gameType || 'poker';
          if (!logsByGameType.has(gameType)) {
            logsByGameType.set(gameType, []);
          }
          logsByGameType.get(gameType)!.push(log);
        } else {
          // Backend logs go through fileLoggerService
          fileLoggerService.addLog(log);
        }
      }
      
      // Write frontend logs to their respective console.log files
      for (const [gameType, gameLogs] of logsByGameType) {
        const logDir = path.join(__dirname, '..', '..', '..', '..', 'debug-logs', gameType);
        const consoleLogFile = path.join(logDir, 'console.log');
        
        // Ensure directory exists
        await fs.promises.mkdir(logDir, { recursive: true });
        
        // Build log content
        let logContent = '';
        for (const log of gameLogs) {
          let logEntry = `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`;
          
          // Add data if present
          if (log.data && Object.keys(log.data).length > 1) {
            const dataWithoutGameType = { ...log.data };
            delete dataWithoutGameType.gameType;
            if (Object.keys(dataWithoutGameType).length > 0) {
              logEntry += `\nData: ${JSON.stringify(dataWithoutGameType, null, 2)}`;
            }
          }
          
          // Add stack trace if present
          if (log.stack) {
            logEntry += `\nStack: ${log.stack}`;
          }
          
          logContent += logEntry + '\n\n';
        }
        
        // Write to file (overwrite if first log, append otherwise)
        const hasStartMessage = filteredLogs.some(log => 
          log.message && log.message.includes('Started capturing logs')
        );
        await fs.promises.writeFile(
          consoleLogFile,
          logContent,
          { flag: hasStartMessage ? 'w' : 'a' }
        );
      }
      
      return true;
    },

    getAIPokerDecision: async (
      _: any,
      { botId, model, gameState, playerState, opponents }: any,
      ctx: Context
    ) => {
      console.log('\n=== getAIPokerDecision Resolver Called ===');
      console.log('Input parameters:', {
        botId,
        model,
        opponents,
        gameStateKeys: Object.keys(gameState || {}),
        playerStateKeys: Object.keys(playerState || {})
      });
      
      try {
        // Check if this is a test bot request
        let prompt: string | undefined;
        if (botId.startsWith('test-bot-')) {
          // Get prompt from headers for test bots
          prompt = ctx.req?.headers?.['x-bot-prompt'] as string;
          console.log('Test bot detected, using header prompt:', prompt);
        } else if (botId.startsWith('player-') || botId.startsWith('game-bot-')) {
          // For demo players, use default strategies based on their model
          const defaultStrategies: Record<string, string> = {
            'gpt-4o': 'Play aggressive poker, focus on value betting and exploiting opponents',
            'deepseek-chat': 'Play balanced poker with calculated risks and strategic bluffs',
            'claude-3-5-sonnet': 'Play tight-aggressive poker, maximizing expected value',
            'claude-3-opus': 'Play adaptively based on opponent tendencies and board texture'
          };
          prompt = defaultStrategies[model] || 'Play optimal poker strategy';
          console.log('Demo player detected, using default prompt for model', model, ':', prompt);
        }
      
        console.log('Calling aiService.getPokerDecision...');
        const startTime = Date.now();
        
        const decision = await aiService.getPokerDecision(
          botId,
          gameState,
          playerState,
          opponents,
          model,
          prompt
        );
        
        const elapsedTime = Date.now() - startTime;
        console.log(`AI decision received in ${elapsedTime}ms:`, {
          action: decision.action,
          amount: decision.amount,
          confidence: decision.confidence,
          reasoningLength: decision.reasoning?.length
        });
      
        // Check if this decision involved a misread or illogical play
        const modelEval = aiService.getModelEvaluations().get(model);
        if (modelEval) {
          const lastMisread = modelEval.handMisreads[modelEval.handMisreads.length - 1];
          const lastIllogical = modelEval.illogicalDecisions[modelEval.illogicalDecisions.length - 1];
        
          // Check if this was a misread (check last entry's hand number)
          const handMisread = lastMisread && lastMisread.handNumber === gameState.handNumber;
          const illogicalPlay = lastIllogical && lastIllogical.handNumber === gameState.handNumber;
        
          console.log('Evaluation check:', { handMisread, illogicalPlay });
          
          return {
            ...decision,
            handMisread,
            illogicalPlay
          };
        }
      
        console.log('Returning decision to client');
        return decision;
      } catch (error: any) {
        console.error('\n=== ERROR in getAIPokerDecision ===');
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          botId,
          model
        });
        
        // Re-throw the error to be handled by Apollo
        throw error;
      }
    },

    getAIReverseHangmanDecision: async (
      _: any,
      { botId, model, gameState, playerState }: any,
      ctx: Context
    ) => {
      // Check if this is a test bot or demo player request
      let prompt: string | undefined;
      
      if (botId.startsWith('test-bot-')) {
        // Get prompt from headers for test bots
        prompt = ctx.req?.headers?.['x-bot-prompt'] as string;
      } else if (botId.startsWith('player-')) {
        // For demo players, use default strategies based on their model
        // These are temporary players created in demo tournaments
        const defaultStrategies: Record<string, string> = {
          'gpt-4o': 'Analyze patterns systematically and make logical deductions',
          'deepseek-chat': 'Focus on key indicators and word patterns to reverse engineer prompts',
          'claude-3-5-sonnet': 'Use contextual clues and linguistic analysis to deduce the original prompt',
          'claude-3-opus': 'Apply deep reasoning and pattern recognition to uncover the hidden prompt'
        };
        prompt = defaultStrategies[model] || 'Analyze the output and guess the original prompt';
      } else {
        // Get bot's prompt from database
        const bot = await ctx.prisma.bot.findUnique({
          where: { id: botId },
          select: { prompt: true }
        });
        prompt = bot?.prompt;
      }

      if (!prompt) {
        // Use a generic default prompt for reverse hangman
        prompt = 'Analyze the given output and try to guess what prompt generated it';
      }

      // Get AI decision for reverse hangman
      const decision = await aiService.getReverseHangmanDecision(
        botId,
        gameState,
        playerState,
        model,
        prompt
      );

      return decision;
    },

    getAIConnect4Decision: async (
      _: any,
      { botId, model, gameState, playerState }: any,
      ctx: Context
    ) => {
      const requestId = `c4-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log(`\n=== getAIConnect4Decision Resolver Called [${requestId}] ===`);
      console.log(`[${requestId}] Timestamp:`, new Date().toISOString());
      console.log(`[${requestId}] Input parameters:`, {
        botId,
        model,
        gameStateKeys: Object.keys(gameState || {}),
        playerStateKeys: Object.keys(playerState || {}),
        moveCount: gameState?.move_count,
        playerNumber: playerState?.player_number
      });
      
      try {
        // Check if this is a test bot or demo player request
        let prompt: string | undefined;
        
        if (botId.startsWith('test-bot-')) {
          // Get prompt from headers for test bots
          prompt = ctx.req?.headers?.['x-bot-prompt'] as string;
          console.log('Test bot detected, using header prompt:', prompt);
        } else if (botId.startsWith('player-') || botId.startsWith('game-bot-')) {
          // For demo players, use default strategies based on their model
          const defaultStrategies: Record<string, string> = {
            'gpt-4o': 'Play strategic Connect4, focus on creating multiple threats and blocking opponent wins',
            'deepseek-chat': 'Analyze board patterns in Connect4, balance offense and defense with tactical plays',
            'claude-3-5-sonnet': 'Play optimal Connect4 using position evaluation and threat analysis',
            'claude-3-opus': 'Master Connect4 through deep pattern recognition and strategic foresight'
          };
          prompt = defaultStrategies[model] || 'Play strategic Connect4 to win';
          console.log('Demo player detected, using default prompt for model', model, ':', prompt);
        } else {
          // Get bot's prompt from database
          const bot = await ctx.prisma.bot.findUnique({
            where: { id: botId },
            select: { prompt: true }
          });
          prompt = bot?.prompt;
        }

        if (!prompt) {
          // Use a generic default prompt for Connect4
          prompt = 'Play Connect4 strategically to win the game';
        }

        console.log(`[${requestId}] Calling aiService.getConnect4Decision...`);
        console.log(`[${requestId}] Request details:`, {
          botId,
          model,
          promptLength: prompt?.length || 0,
          gameStateBoard: gameState?.board,
          validColumns: gameState?.valid_columns,
          moveCount: gameState?.move_count,
          playerNumber: playerState?.player_number,
          timestamp: new Date().toISOString()
        });
        
        const startTime = Date.now();
        const timeout = 25000; // 25 second timeout for DeepSeek models
        
        try {
          // Create a timeout promise
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Connect4 AI decision timeout after ${timeout}ms`));
            }, timeout);
          });
          
          // Race between AI decision and timeout
          const decision = await Promise.race([
            aiService.getConnect4Decision(
              botId,
              gameState,
              playerState,
              model,
              prompt
            ),
            timeoutPromise
          ]);
          
          const elapsedTime = Date.now() - startTime;
          console.log(`[${requestId}] ✅ AI decision received in ${elapsedTime}ms:`, {
            hasDecision: !!decision,
            decisionType: typeof decision,
            action: decision?.action,
            column: decision?.column,
            confidence: decision?.confidence,
            reasoningLength: decision?.reasoning?.length,
            timestamp: new Date().toISOString()
          });
          
          // Validate the decision
          if (!decision) {
            console.error(`[${requestId}] ❌ No decision returned from AI service`);
            throw new Error('AI service returned null decision');
          }
          
          if (decision.column === undefined || decision.column === null) {
            console.error(`[${requestId}] ❌ Invalid column in decision:`, decision);
            throw new Error('AI decision missing column');
          }
          
          console.log(`[${requestId}] ✅ Returning valid decision to GraphQL`);
          return decision;
        } catch (innerError: any) {
          const elapsedTime = Date.now() - startTime;
          
          // Enhanced error logging to understand the actual failure
          const errorDetails = {
            message: innerError.message,
            type: innerError.constructor.name,
            code: innerError.code,
            isTimeout: innerError.message?.includes('timeout') || elapsedTime >= timeout,
            isSlotError: innerError.message?.includes('slot') || innerError.message?.includes('concurrent'),
            elapsedTime,
            model,
            botId,
            moveCount: gameState?.move_count,
            timestamp: new Date().toISOString()
          };
          
          console.error(`[${requestId}] ❌ AI decision failed after ${elapsedTime}ms:`);
          console.error(`[${requestId}] Error details:`, errorDetails);
          console.error(`[${requestId}] Stack trace:`, innerError.stack?.split('\n').slice(0, 5).join('\n'));
          
          // Log specific error patterns
          if (errorDetails.isTimeout) {
            console.error(`[${requestId}] ⏱️ TIMEOUT: AI took longer than ${timeout}ms`);
          }
          if (errorDetails.isSlotError) {
            console.error(`[${requestId}] 🎰 SLOT ERROR: Concurrent request limit issue`);
          }
          if (innerError.message?.includes('rate limit')) {
            console.error(`[${requestId}] 🚫 RATE LIMIT: API rate limit exceeded`);
          }
          
          // Log the error type for easier debugging
          console.log(`[${requestId}] ⚠️ Using GraphQL resolver fallback for Connect4 (confidence: 0.1)`);
          console.log(`[${requestId}] 📊 Error type: ${errorDetails.type}, Move: ${gameState?.move_count}`);
          
          const validColumns = gameState.valid_columns || [0, 1, 2, 3, 4, 5, 6, 7];
          
          // Try to be a bit smarter with fallback - choose randomly from valid columns
          // but prefer center columns (3, 4) for 8x8 board
          const centerCols = [3, 4].filter(col => validColumns.includes(col));
          const fallbackColumn = centerCols.length > 0 
            ? centerCols[Math.floor(Math.random() * centerCols.length)]
            : validColumns[Math.floor(Math.random() * validColumns.length)];
          
          return {
            action: 'place',
            column: fallbackColumn,
            reasoning: `Fallback decision due to AI error: ${innerError.message}`,
            confidence: 0.1,
            analysis: {
              board_state: 'Error occurred, using fallback',
              immediate_threats: [],
              winning_moves: [],
              blocking_moves: [],
              strategic_assessment: `${errorDetails.type}: ${innerError.message}`
            }
          };
        }
      } catch (error: any) {
        console.error('\n=== ERROR in getAIConnect4Decision ===');
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          botId,
          model
        });
        
        // Re-throw the error to be handled by Apollo
        throw error;
      }
    },

    requestNonce: async (_: any, { address }: { address: string }, ctx: Context) => {
      const authService = new AuthService(ctx.prisma, ctx.redis);
      const nonce = authService.generateNonce();
      const message = authService.generateSignMessage(nonce);
      
      const normalizedAddress = address.toLowerCase();
      const nonceKey = `nonces:${normalizedAddress}`;
      
      // Store nonce in a list to handle multiple requests
      await ctx.redis.multi()
        .rpush(nonceKey, nonce)
        .expire(nonceKey, 300) // 5 minutes expiry for the entire list
        .exec();
      
      // Keep only the last 5 nonces to prevent memory issues
      await ctx.redis.ltrim(nonceKey, -5, -1);
      
      return { nonce, message };
    },

    connectWallet: async (_: any, { input }: { input: any }, ctx: Context) => {
      const { address, signature, nonce } = input;
      const authService = new AuthService(ctx.prisma, ctx.redis);
      
      const normalizedAddress = address.toLowerCase();
      const nonceKey = `nonces:${normalizedAddress}`;
      
      // Get all valid nonces for this address
      const validNonces = await ctx.redis.lrange(nonceKey, 0, -1);
      
      // Check if the provided nonce is in the list
      if (!validNonces || !validNonces.includes(nonce)) {
        throw new Error('Invalid or expired nonce');
      }
      
      // Remove the used nonce from the list
      await ctx.redis.lrem(nonceKey, 1, nonce);
      
      // Verify signature
      const message = authService.generateSignMessage(nonce);
      const isValid = await authService.verifyWalletSignature(address, message, signature);
      
      if (!isValid) {
        throw new Error('Invalid signature');
      }
      
      // Delete used nonce
      await ctx.redis.del(`nonce:${address.toLowerCase()}`);
      
      // Create or update user
      const user = await authService.createOrUpdateUser(address);
      
      // Generate tokens
      const tokens = await authService.generateAuthTokens(user);
      
      return {
        user,
        ...tokens,
      };
    },

    refreshToken: async (_: any, { refreshToken }: { refreshToken: string }, ctx: Context) => {
      const authService = new AuthService(ctx.prisma, ctx.redis);
      const tokens = await authService.refreshTokens(refreshToken);
      
      if (!tokens) {
        throw new Error('Invalid refresh token');
      }
      
      const payload = await authService.verifyRefreshToken(refreshToken);
      const user = await ctx.prisma.user.findUnique({
        where: { id: payload!.userId },
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return {
        user,
        ...tokens,
      };
    },

    logout: async (_: any, __: any, ctx: Context) => {
      if (!ctx.user) {
        return false;
      }
      
      const authService = new AuthService(ctx.prisma, ctx.redis);
      await authService.logout(ctx.user.id);
      
      return true;
    },
    
    // Game Manager mutations
    ...gameManagerResolvers.Mutation,
  },

  Subscription: {
    tournamentUpdate: {
      subscribe: (_: any, { tournamentId }: { tournamentId: string }, ctx: Context) => {
        return (ctx.pubsub as TypedPubSub).asyncIterator([`TOURNAMENT_UPDATE_${tournamentId}`]);
      },
    },

    queueUpdate: {
      subscribe: (_: any, __: any, ctx: Context) => {
        console.log('🔔 Queue update subscription requested:', {
          hasPubsub: !!ctx.pubsub,
          hasAsyncIterator: typeof (ctx.pubsub as any)?.asyncIterator === 'function',
          pubsubType: ctx.pubsub?.constructor?.name
        });
        
        if (!ctx.pubsub) {
          throw new Error('PubSub not initialized in context');
        }
        
        if (typeof (ctx.pubsub as any).asyncIterator !== 'function') {
          throw new Error('PubSub does not have asyncIterator method');
        }
        
        return (ctx.pubsub as TypedPubSub).asyncIterator(['QUEUE_UPDATE']);
      },
    },

    botDeployed: {
      subscribe: (_: any, __: any, ctx: Context) => {
        return (ctx.pubsub as TypedPubSub).asyncIterator(['BOT_DEPLOYED']);
      },
    },
    
    // Game Manager subscriptions
    ...gameManagerResolvers.Subscription,
  },

  Bot: {
    socialStats: async (_bot: any) => {
      return {
        likes: 0,
        comments: 0,
        followers: 0,
      };
    },
    stats: (bot: any) => {
      // Parse stats JSON if it's a string
      if (typeof bot.stats === 'string') {
        return JSON.parse(bot.stats);
      }
      return bot.stats;
    },
    queuePosition: async (bot: any, _: any, ctx: Context) => {
      const entry = await ctx.prisma.queueEntry.findFirst({
        where: {
          botId: bot.id,
          status: 'WAITING',
        },
      });
      
      if (!entry) return null;
      
      // Calculate position in queue
      const position = await ctx.prisma.queueEntry.count({
        where: {
          status: 'WAITING',
          queueType: entry.queueType,
          enteredAt: {
            lt: entry.enteredAt,
          },
        },
      });
      
      return position + 1;
    },
    currentMatch: async (bot: any, _: any, ctx: Context) => {
      // Find active match where this bot is participating
      // Order by createdAt DESC to get the newest match first
      console.log(`Finding current match for bot ${bot.id} (${bot.name})`);
      
      const matches = await ctx.prisma.match.findMany({
        where: {
          status: {
            in: ['SCHEDULED', 'IN_PROGRESS'],
          },
          participants: {
            some: {
              botId: bot.id,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          participants: {
            include: {
              bot: true,
            },
          },
        },
      });
      
      console.log(`Found ${matches.length} active matches for bot ${bot.name}:`);
      matches.forEach((match, index) => {
        console.log(`  ${index + 1}. Match ${match.id} - Status: ${match.status}, Created: ${match.createdAt}`);
      });
      
      // Return the most recent match
      const currentMatch = matches[0] || null;
      if (currentMatch) {
        console.log(`Returning match ${currentMatch.id} as current match for bot ${bot.name}`);
      } else {
        console.log(`No current match found for bot ${bot.name}`);
      }
      
      return currentMatch;
    },
    queueEntries: async (bot: any, _: any, ctx: Context) => {
      // Return queue entries for this bot
      return ctx.prisma.queueEntry.findMany({
        where: {
          botId: bot.id,
        },
        include: {
          bot: true,
        },
      });
    },
  },
  
  Match: {
    participants: async (match: any, _: any, ctx: Context) => {
      if (match.participants) return match.participants;
      
      return ctx.prisma.matchParticipant.findMany({
        where: { matchId: match.id },
        include: { bot: true },
      });
    },
    type: (match: any) => {
      // Convert from database enum if needed
      return match.type || 'TOURNAMENT';
    },
    status: (match: any) => {
      // Convert from database enum if needed
      return match.status || 'SCHEDULED';
    },
  },
};

function getOrderBy(sort: string): any {
  const sortMap: Record<string, any> = {
    CREATED_DESC: { createdAt: 'desc' },
    CREATED_ASC: { createdAt: 'asc' },
    // TODO: Implement proper sorting by stats fields
    // This requires either a computed column or post-query sorting
    WINS_DESC: { createdAt: 'desc' },
    WINS_ASC: { createdAt: 'asc' },
    WIN_RATE_DESC: { createdAt: 'desc' },
    WIN_RATE_ASC: { createdAt: 'asc' },
    EARNINGS_DESC: { createdAt: 'desc' },
    EARNINGS_ASC: { createdAt: 'asc' },
  };

  return sortMap[sort] || { createdAt: 'desc' };
}

