import { Context } from '../../config/context';
import { DateTimeResolver } from 'graphql-scalars';
import { AIService } from '../../services/aiService';
import { TransactionService } from '../../services/transactionService';
import { AuthService } from '../../services/authService';
import { PromptValidator } from '../../utils/promptValidation';
import { isHexString } from 'ethers';
import { Prisma, QueueType } from '@prisma/client';
import { PubSub } from 'graphql-subscriptions';

interface PubSubAsyncIterator<T> extends AsyncIterator<T> {
  return(): Promise<IteratorResult<T>>;
  throw(error?: any): Promise<IteratorResult<T>>;
}

interface TypedPubSub extends PubSub {
  asyncIterator<T = any>(triggers: string | string[]): PubSubAsyncIterator<T>;
}

const aiService = new AIService();
const DEPLOYMENT_FEE = '0.01'; // 0.01 HYPE

export const resolvers = {
  DateTime: DateTimeResolver,

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
            take: 1,
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
        if (filter.creatorAddress) where.creatorId = filter.creatorAddress;
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
      const entries = await ctx.prisma.queueEntry.groupBy({
        by: ['queueType'],
        where: { status: 'WAITING' },
        _count: true,
      });

      const totalInQueue = entries.reduce((sum, entry) => sum + entry._count, 0);
      
      return {
        totalInQueue,
        averageWaitTime: 120, // TODO: Calculate from historical data
        nextMatchTime: new Date(Date.now() + 60000), // TODO: Calculate from queue
        queueTypes: entries.map(entry => ({
          type: entry.queueType,
          count: entry._count,
          estimatedWaitTime: 120, // TODO: Calculate per queue type
        })),
      };
    },
    
    getModelEvaluations: async (_: any, __: any, _ctx: Context) => {
      const evaluations = aiService.getModelEvaluations();
      return Array.from(evaluations.values());
    },
    
    getModelEvaluation: async (_: any, { model }: { model: string }, _ctx: Context) => {
      const evaluations = aiService.getModelEvaluations();
      return evaluations.get(model) || null;
    },
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

    getAIPokerDecision: async (
      _: any,
      { botId, model, gameState, playerState, opponents }: any,
      ctx: Context
    ) => {
      // Check if this is a test bot request
      let prompt: string | undefined;
      if (botId.startsWith('test-bot-')) {
        // Get prompt from headers for test bots
        prompt = ctx.req?.headers?.['x-bot-prompt'] as string;
      }
      
      const decision = await aiService.getPokerDecision(
        botId,
        gameState,
        playerState,
        opponents,
        model,
        prompt
      );
      
      // Check if this decision involved a misread or illogical play
      const modelEval = aiService.getModelEvaluations().get(model);
      if (modelEval) {
        const lastMisread = modelEval.handMisreads[modelEval.handMisreads.length - 1];
        const lastIllogical = modelEval.illogicalDecisions[modelEval.illogicalDecisions.length - 1];
        
        // Check if this was a misread (check last entry's hand number)
        const handMisread = lastMisread && lastMisread.handNumber === gameState.handNumber;
        const illogicalPlay = lastIllogical && lastIllogical.handNumber === gameState.handNumber;
        
        return {
          ...decision,
          handMisread,
          illogicalPlay
        };
      }
      
      return decision;
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

    requestNonce: async (_: any, { address }: { address: string }, ctx: Context) => {
      const authService = new AuthService(ctx.prisma, ctx.redis);
      const nonce = authService.generateNonce();
      const message = authService.generateSignMessage(nonce);
      
      // Store nonce temporarily in Redis
      await ctx.redis.setex(`nonce:${address.toLowerCase()}`, 300, nonce); // 5 minutes expiry
      
      return { nonce, message };
    },

    connectWallet: async (_: any, { input }: { input: any }, ctx: Context) => {
      const { address, signature, nonce } = input;
      const authService = new AuthService(ctx.prisma, ctx.redis);
      
      // Verify nonce
      const storedNonce = await ctx.redis.get(`nonce:${address.toLowerCase()}`);
      if (!storedNonce || storedNonce !== nonce) {
        throw new Error('Invalid or expired nonce');
      }
      
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
  },

  Subscription: {
    tournamentUpdate: {
      subscribe: (_: any, { tournamentId }: { tournamentId: string }, ctx: Context) => {
        return (ctx.pubsub as TypedPubSub).asyncIterator([`TOURNAMENT_UPDATE_${tournamentId}`]);
      },
    },

    queueUpdate: {
      subscribe: (_: any, __: any, ctx: Context) => {
        return (ctx.pubsub as TypedPubSub).asyncIterator(['QUEUE_UPDATE']);
      },
    },

    botDeployed: {
      subscribe: (_: any, __: any, ctx: Context) => {
        return (ctx.pubsub as TypedPubSub).asyncIterator(['BOT_DEPLOYED']);
      },
    },
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

