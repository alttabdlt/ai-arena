import { Prisma } from '@prisma/client';
// import axios from 'axios'; // Not needed after removing metaverse proxies
import { DateTimeResolver } from 'graphql-scalars';
import { PubSub } from 'graphql-subscriptions';
import GraphQLJSON from 'graphql-type-json';
import { Context } from '../../config/context';
import { aiService } from '../../services/aiService';
import { AuthService } from '../../services/authService';
// BotDeploymentService removed - metaverse deployment no longer needed
// botSyncService moved to metaverse backend
import { energyService } from '../../services/energyService';
import { getGameManagerService } from '../../services/gameManagerService';
// metaverseEventsService moved to metaverse backend
import { TransactionService } from '../../services/transactionService';
import { getMetaverseCharacter } from '@ai-arena/shared-utils';
import { logger } from '@ai-arena/shared-logger';
// channelResolvers moved to metaverse backend
// deploymentResolvers moved to metaverse backend
import { economyResolvers } from './economy';
import { energyResolvers } from './energy';
import { gameManagerResolvers } from './gameManager';
import { idleGameResolvers } from './idleGame';
import { jackpotResolvers } from './jackpot';
import { bettingTournamentResolvers } from './bettingTournament';

interface PubSubAsyncIterator<T> extends AsyncIterator<T> {
  return(): Promise<IteratorResult<T>>;
  throw(error?: any): Promise<IteratorResult<T>>;
}

interface TypedPubSub extends PubSub {
  asyncIterator<T = any>(triggers: string | string[]): PubSubAsyncIterator<T>;
}

// Use the singleton aiService instance
const DEPLOYMENT_FEE = '10000'; // 10,000 $IDLE tokens
// const METAVERSE_BACKEND_URL = process.env.METAVERSE_BACKEND_URL || 'http://localhost:5001'; // No longer needed

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
        // hasMetaverseAgent filter removed - metaverse fields no longer exist
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

    platformStats: async (_: any, __: any, ctx: Context) => {
      const [totalBots, activeBots, totalUsers] = await Promise.all([
        ctx.prisma.bot.count(),
        ctx.prisma.bot.count({ where: { isActive: true } }),
        ctx.prisma.user.count(),
      ]);

      return {
        totalBots,
        activeBots,
        totalUsers,
        activeUsers24h: 0, // TODO: Implement
        totalMatches: 0, // TODO: Implement
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
    
    // Economy queries
    ...economyResolvers.Query,
    
    // Deployment queries - moved to metaverse backend
    // ...deploymentResolvers.Query,
    
    // Channel queries - moved to metaverse backend
    // ...channelResolvers.Query,
    
    // Energy queries
    ...energyResolvers.Query,
    
    // Idle game queries
    ...idleGameResolvers.Query,
    
    // Channel queries removed - metaverse backend no longer exists
    channels: async () => [],
    channel: async () => null,
    
    myBotChannels: async (_: any, __: any, ctx: Context) => {
      if (!ctx.user) {
        return [];
      }
      
      try {
        // Get user's bots
        // Since channel field was removed, just return empty array
        return [];
      } catch (error: any) {
        console.error('Failed to fetch user channels:', error.message);
        return [];
      }
    },
    
    // Idle game queries
    ...idleGameResolvers.Query,
    
    // Jackpot queries
    ...jackpotResolvers.Query,
    
    // Betting tournament queries
    ...bettingTournamentResolvers.Query,
  },

  Mutation: {
    adoptCompanion: async (_: any, { input }: any, ctx: Context) => {
      if (!ctx.user) {
        throw new Error('Not authenticated');
      }

      // Validate input
      if (!input.name || input.name.length > 30) {
        throw new Error('Companion name must be between 1 and 30 characters');
      }
      
      // Validate personality
      if (!['CRIMINAL', 'GAMBLER', 'WORKER'].includes(input.personality)) {
        throw new Error('Invalid personality type');
      }
      
      // Validate Solana transaction signature (base58 encoded, typically 87-88 characters)
      if (!input.txHash || !/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(input.txHash)) {
        throw new Error('Invalid Solana transaction signature');
      }
      
      // Ensure user has an address
      if (!ctx.user.address) {
        throw new Error('User wallet address not found. Please reconnect your wallet.');
      }
      
      // Count existing companions for progressive pricing
      const companionCount = await ctx.prisma.bot.count({
        where: { creatorId: ctx.user.id }
      });
      
      // Calculate required $IDLE based on progressive pricing
      // 1st: 1k, 2nd: 5k, 3rd: 10k, 4th+: 20k
      let requiredIDLE: number;
      if (companionCount === 0) {
        requiredIDLE = 1000;
      } else if (companionCount === 1) {
        requiredIDLE = 5000;
      } else if (companionCount === 2) {
        requiredIDLE = 10000;
      } else {
        requiredIDLE = 20000;
      }
      
      // Check companion limit (max 10)
      if (companionCount >= 10) {
        throw new Error('Maximum companion limit reached (10 companions)');
      }
      
      // Use the original case-sensitive address for Solana validation
      const walletAddress = ctx.user.originalAddress || ctx.user.address;
      console.log('🐾 Starting companion adoption');
      console.log('   Transaction signature:', input.txHash);
      console.log('   User wallet address:', walletAddress);
      console.log('   Companion name:', input.name);
      console.log('   Existing companions:', companionCount);
      console.log('   Required $IDLE:', requiredIDLE);
      
      // Validate transaction on-chain
      const txService = new TransactionService(ctx.prisma);
      const validation = await txService.validateDeploymentTransactionWithAmount(
        input.txHash,
        walletAddress,
        requiredIDLE
      );
      
      if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid transaction');
      }
      
      // Create bot and deployment transaction in a transaction
      const bot = await ctx.prisma.$transaction(async (prisma) => {
        // Generate a unique token ID
        // Use timestamp + random number for uniqueness
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000000);
        const tokenId = parseInt(`${timestamp}${random}`.slice(-9)); // Take last 9 digits to fit in Int
        
        // Verify tokenId is unique (very unlikely to collide, but check anyway)
        const existingBot = await prisma.bot.findUnique({
          where: { tokenId }
        });
        
        if (existingBot) {
          throw new Error('Token ID collision, please try again');
        }
        
        // Generate avatar based on personality
        const avatarMap: Record<string, string> = {
          CRIMINAL: '/sprites/criminal.png',
          GAMBLER: '/sprites/gambler.png',
          WORKER: '/sprites/worker.png'
        };
        
        // Generate a simple companion prompt based on personality
        const promptMap: Record<string, string> = {
          CRIMINAL: 'A cunning companion who loves chaos and high-risk strategies',
          GAMBLER: 'A lucky companion who thrives on streaks and calculated risks',
          WORKER: 'A diligent companion who grinds steadily toward success'
        };
        
        // Create the companion (bot)
        const newBot = await prisma.bot.create({
          data: {
            tokenId,
            name: input.name,
            avatar: avatarMap[input.personality as string],
            prompt: promptMap[input.personality as string],
            personality: input.personality,
            character: getMetaverseCharacter(null, input.personality, input.name), // For sprite consistency
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
        
        // Initialize bot energy using the transaction
        await energyService.initializeBotEnergy(newBot.id, prisma);
        
        // Channel system removed - no longer updating channel bot counts
        
        // Note: Removed automatic queuing - bots must be manually queued by users
        // This allows users to manage their bots before entering tournaments
        
        return newBot;
      });
      
      // Companion is ready to generate XP immediately
      logger.info(`✅ Companion ${bot.name} successfully adopted (Companion #${companionCount + 1})`);
      
      // TODO: Emit companion adopted event for subscriptions
      
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

    // updateBotExperience moved to idleGameResolvers.Mutation
    
    burnCompanionForSOL: async (_: any, { companionId }: { companionId: string }, ctx: Context) => {
      if (!ctx.user) {
        throw new Error('Not authenticated');
      }
      
      // Get companion with experience data
      const companion = await ctx.prisma.bot.findUnique({
        where: { id: companionId },
        include: { 
          experience: true,
          creator: true
        }
      });
      
      if (!companion) {
        throw new Error('Companion not found');
      }
      
      if (companion.creatorId !== ctx.user.id) {
        throw new Error('This companion does not belong to you');
      }
      
      // Check if companion is at level 100
      if (!companion.experience || companion.experience.level < 100) {
        throw new Error(`Companion must be level 100 to burn. Current level: ${companion.experience?.level || 1}`);
      }
      
      const SOL_REWARD = 0.5; // 0.5 SOL reward for burning level 100 companion
      
      try {
        // In production, this would initiate a Solana transaction to send SOL to the user
        // For now, we'll simulate it
        console.log(`🔥 Burning companion ${companion.name} (Level ${companion.experience.level})`);
        console.log(`   Rewarding ${SOL_REWARD} SOL to ${ctx.user.address}`);
        
        // TODO: Implement actual Solana transaction
        // const txHash = await solanaService.sendSOL(ctx.user.address, SOL_REWARD);
        const txHash = `burn_${Date.now()}_${companionId}`; // Mock transaction hash
        
        // Delete companion and all related data
        await ctx.prisma.$transaction([
          // Delete related records first
          ctx.prisma.matchParticipant.deleteMany({ where: { botId: companionId } }),
          ctx.prisma.tournamentParticipant.deleteMany({ where: { botId: companionId } }),
          ctx.prisma.comment.deleteMany({ where: { botId: companionId } }),
          ctx.prisma.like.deleteMany({ where: { botId: companionId } }),
          ctx.prisma.bettingEntry.deleteMany({ where: { botId: companionId } }),
          // Delete the companion (cascade will handle other relations)
          ctx.prisma.bot.delete({ where: { id: companionId } })
        ]);
        
        console.log(`✅ Successfully burned companion ${companion.name} for ${SOL_REWARD} SOL`);
        
        return {
          success: true,
          message: `Successfully burned ${companion.name} for ${SOL_REWARD} SOL!`,
          burnedCompanionId: companionId,
          solReward: SOL_REWARD,
          txHash
        };
      } catch (error: any) {
        console.error('Error burning companion:', error);
        throw new Error(`Failed to burn companion: ${error.message}`);
      }
    },
    
    deleteBot: async (_: any, { botId }: { botId: string }, ctx: Context) => {
      if (!ctx.user) {
        throw new Error('Not authenticated');
      }

      // Find the bot with all related data
      const bot = await ctx.prisma.bot.findUnique({
        where: { id: botId },
        include: {
          queueEntries: true, // Get ALL queue entries, not just WAITING
        },
      });

      if (!bot) {
        throw new Error('Bot not found');
      }

      if (bot.creatorId !== ctx.user.id) {
        throw new Error('Not authorized to delete this bot');
      }

      let metaverseDeleted = false;

      try {
        // Metaverse system removed - skip metaverse cleanup

        // Manually delete related records that don't have cascade delete
        // Count records for logging
        const [matchCount, tournamentCount, commentCount, likeCount] = await Promise.all([
          ctx.prisma.matchParticipant.count({ where: { botId } }),
          ctx.prisma.tournamentParticipant.count({ where: { botId } }),
          ctx.prisma.comment.count({ where: { botId } }),
          ctx.prisma.like.count({ where: { botId } })
        ]);

        if (matchCount > 0 || tournamentCount > 0 || commentCount > 0 || likeCount > 0) {
          console.log(`Cleaning up related records for bot ${botId}:`);
          if (matchCount > 0) console.log(`  - ${matchCount} match participations`);
          if (tournamentCount > 0) console.log(`  - ${tournamentCount} tournament participations`);
          if (commentCount > 0) console.log(`  - ${commentCount} comments`);
          if (likeCount > 0) console.log(`  - ${likeCount} likes`);
        }

        // Delete in transaction to ensure atomicity
        await ctx.prisma.$transaction([
          ctx.prisma.matchParticipant.deleteMany({ where: { botId } }),
          ctx.prisma.tournamentParticipant.deleteMany({ where: { botId } }),
          ctx.prisma.comment.deleteMany({ where: { botId } }),
          ctx.prisma.like.deleteMany({ where: { botId } })
        ]);

        // Delete the bot from database (cascade will handle other related records)
        await ctx.prisma.bot.delete({
          where: { id: botId },
        });

        return {
          success: true,
          message: 'Bot deleted successfully',
          deletedBotId: botId,
          metaverseDeleted,
        };
      } catch (error: any) {
        console.error('Bot deletion error:', error);
        throw new Error(`Failed to delete bot: ${error.message}`);
      }
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
      
      if (!payload || !payload.userId) {
        throw new Error('Invalid refresh token payload');
      }
      
      const user = await ctx.prisma.user.findUnique({
        where: { id: payload.userId },
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
    
    // Economy mutations
    ...economyResolvers.Mutation,
    
    // Deployment mutations - moved to metaverse backend
    // ...deploymentResolvers.Mutation,
    
    // Channel mutations - moved to metaverse backend
    // ...channelResolvers.Mutation,
    
    // Energy mutations
    ...energyResolvers.Mutation,
    
    // Idle game mutations
    ...idleGameResolvers.Mutation,
    
    // Jackpot mutations
    ...jackpotResolvers.Mutation,
    
    // Betting tournament mutations
    ...bettingTournamentResolvers.Mutation,
    
    // Channel mutations removed - metaverse backend no longer exists
    switchChannel: async (_: any, { botId }: { botId: string; channelName?: string }, ctx: Context) => {
      // Metaverse system removed - just return the bot
      if (!ctx.user) {
        throw new Error('Not authenticated');
      }
      
      const bot = await ctx.prisma.bot.findUnique({
        where: { id: botId },
        include: { creator: true },
      });
      
      if (!bot) {
        throw new Error('Bot not found');
      }
      
      if (bot.creatorId !== ctx.user.id) {
        throw new Error('Not authorized');
      }
      
      return bot;
    },
  },

  Subscription: {
    tournamentUpdate: {
      subscribe: (_: any, { tournamentId }: { tournamentId: string }, ctx: Context) => {
        return (ctx.pubsub as TypedPubSub).asyncIterator([`TOURNAMENT_UPDATE_${tournamentId}`]);
      },
    },


    botDeployed: {
      subscribe: (_: any, __: any, ctx: Context) => {
        return (ctx.pubsub as TypedPubSub).asyncIterator(['BOT_DEPLOYED']);
      },
    },

    debugLog: {
      subscribe: (_: any, __: any, ctx: Context) => {
        return (ctx.pubsub as TypedPubSub).asyncIterator(['DEBUG_LOG']);
      },
    },
    
    // Game Manager subscriptions
    ...gameManagerResolvers.Subscription,
    
    // Economy subscriptions
    ...economyResolvers.Subscription,
    
    // Jackpot subscriptions
    ...jackpotResolvers.Subscription,
    
    // Betting tournament subscriptions
    ...bettingTournamentResolvers.Subscription,
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
      let stats = bot.stats;
      if (typeof stats === 'string') {
        try {
          stats = JSON.parse(stats);
        } catch (e) {
          stats = {};
        }
      }
      
      // Ensure all required fields have default values
      const wins = stats.wins || 0;
      const losses = stats.losses || 0;
      const totalGames = wins + losses;
      
      return {
        wins: wins,
        losses: losses,
        earnings: stats.earnings || '0',
        winRate: totalGames > 0 ? (wins / totalGames) : 0,
        avgFinishPosition: stats.avgFinishPosition || 0
      };
    },
    // Energy field from energyResolvers
    energy: async (parent: any) => {
      try {
        return await energyService.getBotEnergy(parent.id);
      } catch (error) {
        // Return default values if energy record doesn't exist
        return {
          currentEnergy: 100,
          maxEnergy: 100,
          isPaused: false,
          consumptionRate: 1,
          regenerationRate: 1,
          netConsumption: 0,
        };
      }
    },
    equipment: async (bot: any, _: any, ctx: Context) => {
      if (bot.equipment) return bot.equipment;
      const equipment = await ctx.prisma.botEquipment.findMany({
        where: { botId: bot.id },
      });
      return equipment || [];
    },
    house: async (bot: any, _: any, ctx: Context) => {
      if (bot.house) return bot.house;
      return ctx.prisma.botHouse.findUnique({
        where: { botId: bot.id },
        include: { furniture: true },
      });
    },
    activityScore: async (bot: any, _: any, ctx: Context) => {
      if (bot.activityScore) return bot.activityScore;
      return ctx.prisma.botActivityScore.findUnique({
        where: { botId: bot.id },
      });
    },
    experience: async (bot: any, _: any, ctx: Context) => {
      // Use idleGameResolvers.Bot.experience if available
      if (idleGameResolvers.Bot?.experience) {
        return idleGameResolvers.Bot.experience(bot);
      }
      
      // Fallback to existing logic
      // Try to get existing experience record
      let experience = await ctx.prisma.botExperience.findUnique({
        where: { botId: bot.id }
      });
      
      // If no experience record exists, create one with default values
      if (!experience) {
        experience = await ctx.prisma.botExperience.create({
          data: {
            botId: bot.id,
            level: 1,
            currentXP: 0,
            totalXP: 0,
            xpToNextLevel: 100,
            combatXP: 0,
            socialXP: 0,
            criminalXP: 0,
            gamblingXP: 0,
            tradingXP: 0,
            prestigeLevel: 0,
            prestigeTokens: 0,
            skillPoints: 0
          }
        });
      }
      
      return experience;
    },
    lootboxRewards: async (bot: any, _: any, ctx: Context) => {
      if (bot.lootboxRewards) return bot.lootboxRewards;
      return ctx.prisma.lootboxReward.findMany({
        where: { botId: bot.id },
        orderBy: { createdAt: 'desc' },
      });
    },
    robbingPower: async (bot: any) => {
      const { economyService } = await import('../../services/economyService');
      return economyService.calculateRobbingPower(bot.id);
    },
    defenseLevel: async (bot: any) => {
      const { economyService } = await import('../../services/economyService');
      return economyService.calculateDefenseLevel(bot.id);
    },
    // Metaverse fields removed - using idle game instead
    // BotSync removed - no longer needed
    // Queue system removed - no longer needed
    currentMatch: async (bot: any, _: any, ctx: Context) => {
      // Find active match where this bot is participating
      // Only return matches that are actually in progress and recent (within last hour)
      console.log(`Finding current match for bot ${bot.id} (${bot.name})`);
      
      // Calculate timestamp for 1 hour ago
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      
      const matches = await ctx.prisma.match.findMany({
        where: {
          status: 'IN_PROGRESS', // Only truly active matches
          createdAt: {
            gte: oneHourAgo, // Created within last hour
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
    // Idle game fields
    activityLogs: async (bot: any, _: any, ctx: Context) => {
      if (idleGameResolvers.Bot?.activityLogs) {
        return idleGameResolvers.Bot.activityLogs(bot);
      }
      // Fallback
      if (bot.activityLogs) return bot.activityLogs;
      return ctx.prisma.botActivityLog.findMany({
        where: { botId: bot.id },
        orderBy: { timestamp: 'desc' },
        take: 10,
      });
    },
    idleProgress: async (bot: any, _: any, ctx: Context) => {
      if (idleGameResolvers.Bot?.idleProgress) {
        return idleGameResolvers.Bot.idleProgress(bot);
      }
      // Fallback
      if (bot.idleProgress) return bot.idleProgress;
      return ctx.prisma.idleProgress.findUnique({
        where: { botId: bot.id },
      });
    },
    character: (bot: any) => {
      // Return the character field from the bot
      return bot.character || null;
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
  
  // Economy type resolvers
  BotEquipment: economyResolvers.BotEquipment,
  BotHouse: economyResolvers.BotHouse,
  Furniture: economyResolvers.Furniture,
  RobberyLog: economyResolvers.RobberyLog,
  BotActivityScore: economyResolvers.BotActivityScore,
  LootboxReward: economyResolvers.LootboxReward,
  Trade: economyResolvers.Trade,
  
  // Betting tournament type resolvers
  BettingTournament: bettingTournamentResolvers.BettingTournament,
  BettingParticipant: bettingTournamentResolvers.BettingParticipant,
  StakedIDLE: bettingTournamentResolvers.StakedIDLE,
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

