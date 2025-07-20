import { Context } from '../../config/context';
import { DateTimeResolver } from 'graphql-scalars';
import { AIService } from '../../services/aiService';

const aiService = new AIService();

export const resolvers = {
  DateTime: DateTimeResolver,

  Query: {
    user: async (_: any, { address }: { address: string }, ctx: Context) => {
      return ctx.prisma.user.findUnique({
        where: { address: address.toLowerCase() },
        include: {
          bots: true,
          transactions: true,
          achievements: true,
        },
      });
    },

    bot: async (_: any, { id }: { id: string }, ctx: Context) => {
      return ctx.prisma.bot.findUnique({
        where: { id },
        include: {
          creator: true,
          bondingCurve: true,
        },
      });
    },

    bots: async (_: any, args: any, ctx: Context) => {
      const { filter, sort, limit = 20, offset = 0 } = args;
      
      return ctx.prisma.bot.findMany({
        skip: offset,
        take: limit,
        include: {
          creator: true,
          bondingCurve: true,
        },
        orderBy: sort ? getOrderBy(sort) : { createdAt: 'desc' },
      });
    },

    trendingBots: async (_: any, { limit = 10 }: { limit?: number }, ctx: Context) => {
      const key = `trending:bots:${limit}`;
      
      // Try to get from cache if Redis is available
      try {
        const cached = await ctx.redis.get(key);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        // Redis not available, continue without cache
      }

      const bots = await ctx.prisma.bot.findMany({
        take: limit,
        include: {
          creator: true,
          bondingCurve: true,
        },
        orderBy: {
          bondingCurve: {
            volume24h: 'desc',
          },
        },
      });

      // Try to cache if Redis is available
      try {
        await ctx.redis.setex(key, 300, JSON.stringify(bots));
      } catch (err) {
        // Redis not available, skip caching
      }
      
      return bots;
    },

    platformStats: async (_: any, __: any, ctx: Context) => {
      const [totalBots, totalUsers] = await Promise.all([
        ctx.prisma.bot.count(),
        ctx.prisma.user.count(),
      ]);

      return {
        totalBots,
        totalUsers,
        totalVolume: '0',
        activeUsers24h: 0,
        graduatedBots: 0,
        avgGraduationTime: 0,
      };
    },
    
    getModelEvaluations: async (_: any, __: any, ctx: Context) => {
      const evaluations = aiService.getModelEvaluations();
      return Array.from(evaluations.values());
    },
    
    getModelEvaluation: async (_: any, { model }: { model: string }, ctx: Context) => {
      const evaluations = aiService.getModelEvaluations();
      return evaluations.get(model) || null;
    },
  },

  Mutation: {
    createBot: async (_: any, { input }: any, ctx: Context) => {
      if (!ctx.user) {
        throw new Error('Not authenticated');
      }

      // For now, just save to database
      // The actual blockchain interaction happens from the frontend
      // In a production app, you might want to verify the transaction here
      return ctx.prisma.bot.create({
        data: {
          name: input.name,
          description: input.description,
          imageUrl: input.imageUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${input.name}`,
          tags: input.tags || [],
          creatorAddress: ctx.user.address,
          address: generateBotAddress(),
          bondingCurve: {
            create: {
              currentSupply: '0',
              currentPrice: '0.00001',
              marketCap: '0',
              volume24h: '0',
              holders: 0,
              graduated: false,
            },
          },
        },
        include: {
          creator: true,
          bondingCurve: true,
        },
      });
    },

    getAIPokerDecision: async (
      _: any,
      { botId, model, gameState, playerState, opponents }: any,
      ctx: Context
    ) => {
      const decision = await aiService.getPokerDecision(
        botId,
        gameState,
        playerState,
        opponents,
        model
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
  },

  Subscription: {
    priceUpdate: {
      subscribe: (_: any, { botId }: { botId: string }, ctx: Context) => {
        return ctx.pubsub.asyncIterator([`PRICE_UPDATE_${botId}`]);
      },
    },

    allPriceUpdates: {
      subscribe: (_: any, __: any, ctx: Context) => {
        return ctx.pubsub.asyncIterator(['ALL_PRICE_UPDATES']);
      },
    },

    graduationEvent: {
      subscribe: (_: any, __: any, ctx: Context) => {
        return ctx.pubsub.asyncIterator(['GRADUATION_EVENT']);
      },
    },
  },

  Bot: {
    socialStats: async (bot: any) => {
      return {
        likes: 0,
        comments: 0,
        followers: 0,
      };
    },
  },
};

function getOrderBy(sort: string): any {
  const sortMap: Record<string, any> = {
    CREATED_DESC: { createdAt: 'desc' },
    CREATED_ASC: { createdAt: 'asc' },
    PRICE_DESC: { bondingCurve: { currentPrice: 'desc' } },
    PRICE_ASC: { bondingCurve: { currentPrice: 'asc' } },
    MARKET_CAP_DESC: { bondingCurve: { marketCap: 'desc' } },
    MARKET_CAP_ASC: { bondingCurve: { marketCap: 'asc' } },
    VOLUME_DESC: { bondingCurve: { volume24h: 'desc' } },
    VOLUME_ASC: { bondingCurve: { volume24h: 'asc' } },
  };

  return sortMap[sort] || { createdAt: 'desc' };
}

function generateBotAddress(): string {
  return '0x' + Array.from({ length: 40 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}