import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { makeServer, CloseCode } from 'graphql-ws';
import cors from 'cors';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { createContext } from './config/context';
import { setupWebSocketServer } from './websocket/server';
import { prisma } from './config/database';
import Redis from 'ioredis';
import { initializeGameManagerService, getGameManagerService } from './services/gameManagerService';
import { logWalletConfig } from './config/wallets';
import { PubSub } from 'graphql-subscriptions';
import { initializeServices } from './services';
import { fileLoggerService } from './services/fileLoggerService';
import { energyScheduler } from './services/energyScheduler';
import { initializeTournamentScheduler } from './services/tournamentScheduler';
import { aiService } from './services/aiService';
import { initializeStakingService } from './services/stakingService';
import { initializeXPEconomyService } from './services/xpEconomyService';

// Performance optimization flags
const FAST_STARTUP = process.env.FAST_STARTUP === 'true';
const ENABLE_SOLANA = FAST_STARTUP ? false : process.env.ENABLE_SOLANA !== 'false';
const ENABLE_ENERGY = FAST_STARTUP ? false : process.env.ENABLE_ENERGY !== 'false';
const ENABLE_STAKING = FAST_STARTUP ? false : process.env.ENABLE_STAKING !== 'false';
const ENABLE_FILE_LOGGING = FAST_STARTUP ? false : process.env.ENABLE_FILE_LOGGING !== 'false';
const ENABLE_CUSTOM_WS = FAST_STARTUP ? false : process.env.ENABLE_CUSTOM_WS !== 'false';
const ENABLE_MEMORY_MONITOR = FAST_STARTUP ? false : process.env.ENABLE_MEMORY_MONITOR !== 'false';
const ENABLE_TOURNAMENTS = FAST_STARTUP ? false : process.env.ENABLE_TOURNAMENTS === 'true';

if (FAST_STARTUP) {
  console.log('⚡ Fast startup mode enabled - non-essential services disabled');
}

// Override console methods to capture backend logs (only if file logging enabled)
if (ENABLE_FILE_LOGGING) {
  const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
  };

  const captureLog = (level: 'log' | 'warn' | 'error' | 'info' | 'debug') => {
    return (...args: any[]) => {
      // Always call original console method
      originalConsole[level](...args);
      
      // Log to file
      fileLoggerService.addLog({
        timestamp: new Date().toISOString(),
        level,
        source: 'backend',
        message: args.map(arg => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        }).join(' '),
        data: args.length > 1 ? args : args[0],
        stack: level === 'error' && args[0] instanceof Error ? args[0].stack : undefined
      });
    };
  };

  console.log = captureLog('log');
  console.warn = captureLog('warn');
  console.error = captureLog('error');
  console.info = captureLog('info');
  console.debug = captureLog('debug');
  
  console.log('📝 File logging enabled');
}

console.log('🎮 Backend starting...');

// Create Redis client with error handling
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  enableOfflineQueue: false,
  retryStrategy: () => null, // Disable retries
  reconnectOnError: () => false, // Don't reconnect on errors
});

// Handle Redis errors silently
redis.on('error', (err: any) => {
  if (err.code === 'ECONNREFUSED') {
    console.log('⚠️  Redis not available - caching disabled');
  }
});

const pubsub = new PubSub();

// Ensure asyncIterator is available on PubSub
if (typeof (pubsub as any).asyncIterator !== 'function') {
  console.log('⚠️ PubSub asyncIterator not found, patching...');
  (pubsub as any).asyncIterator = function(triggers: string | string[]) {
    return this.asyncIterableIterator ? this.asyncIterableIterator(triggers) : this.asyncIterator(triggers);
  };
}

// Initialize core services (always needed)
initializeServices(prisma, redis, pubsub, { enableSolana: ENABLE_SOLANA });
initializeGameManagerService(pubsub);

// Initialize tournament scheduler (optional based on feature flag)
let tournamentScheduler: ReturnType<typeof initializeTournamentScheduler> | null = null;
if (ENABLE_TOURNAMENTS) {
  tournamentScheduler = initializeTournamentScheduler(
    prisma,
    pubsub,
    getGameManagerService(),
    aiService
  );
}

// Initialize optional services
let stakingService: any = null;
if (ENABLE_STAKING) {
  stakingService = initializeStakingService(prisma, pubsub);
  console.log('💎 Staking service initialized');
}

// Initialize XP economy service (always needed for XP system)
const xpEconomyService = initializeXPEconomyService(prisma, pubsub);
void xpEconomyService; // Acknowledge future use

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const PORT = process.env.PORT || 4000;
  const WS_PORT = process.env.WS_PORT || 4001;

  // Global middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  // Create GraphQL WebSocket server
  const gqlWsServer = makeServer({
    schema,
    context: async (ctx) => {
      return createContext({ prisma, redis, connection: ctx, pubsub });
    },
  });

  // Handle WebSocket connections
  wsServer.on('connection', (socket, request) => {
    const closed = gqlWsServer.opened(
      {
        protocol: socket.protocol as string,
        send: (data) =>
          new Promise((resolve, reject) => {
            socket.send(data, (err) => (err ? reject(err) : resolve()));
          }),
        close: (code, reason) => socket.close(code, reason),
        onMessage: (cb) =>
          socket.on('message', async (event) => {
            try {
              await cb(event.toString());
            } catch (err: any) {
              socket.close(CloseCode.InternalServerError, err.message);
            }
          }),
      },
      { socket, request }
    );

    socket.once('close', closed);
  });

  const apolloServer = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await wsServer.close();
            },
          };
        },
      },
    ],
    formatError: (formattedError, error) => {
      console.error('GraphQL Error:', {
        message: formattedError.message,
        path: formattedError.path,
        extensions: formattedError.extensions,
        originalError: error
      });
      return formattedError;
    },
  });

  await apolloServer.start();

  app.use(
    '/graphql',
    cors<cors.CorsRequest>({
      origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:8080', 'http://localhost:8081'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'x-wallet-address', 'x-bot-prompt'],
      exposedHeaders: ['Authorization'],
    }),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => createContext({ req: req as any, prisma, redis, pubsub }),
    }) as any
  );

  // ============================================
  // Arena PvP REST API
  // ============================================
  const arenaApiRouter = (await import('./routes/arena-api')).default;
  app.use('/api/v1', cors<cors.CorsRequest>({ origin: '*' }), arenaApiRouter);
  console.log('🏟️  Arena PvP API ready at /api/v1');

  app.get('/health', async (_req, res) => {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Check database connection
    let dbStatus = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      dbStatus = 'error';
    }
    
    // Check Redis connection
    let redisStatus = redis.status;
    
    res.json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
      memory: {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
      },
      services: {
        database: dbStatus,
        redis: redisStatus,
        graphql: 'ok'
      },
      version: process.version
    });
  });

  // Webhook routes
  // Webhook routes moved to metaverse backend

  let customWsServer: any = null;
  if (ENABLE_CUSTOM_WS) {
    customWsServer = setupWebSocketServer(parseInt(WS_PORT.toString()));
  }

  httpServer.listen(PORT, async () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    console.log(`🔌 GraphQL subscriptions ready at ws://localhost:${PORT}/graphql`);
    
    // Try to connect to Redis
    try {
      await redis.connect();
      console.log('✅ Redis connected - caching enabled');
    } catch (err) {
      // Redis not available, already logged
    }
    
    // Transaction service is ready (Solana transaction validation)
    console.log('💰 Transaction service ready for Solana validation');
    
    // Game manager service is initialized as a singleton
    console.log('🎮 Game manager service ready');
    
    // Start energy scheduler (if enabled)
    if (ENABLE_ENERGY) {
      energyScheduler.start();
      console.log('⚡ Energy scheduler started - processing hourly consumption');
    }
    
    // Start tournament scheduler (if enabled)
    if (ENABLE_TOURNAMENTS && tournamentScheduler) {
      tournamentScheduler.start();
      console.log('🎰 Tournament scheduler started - tournaments every 15 minutes');
    }
    
    // Start staking service (if enabled)
    if (ENABLE_STAKING && stakingService) {
      stakingService.initialize();
      console.log('💎 Staking service started - XP generation every hour');
    }
    
    // Log WebSocket server info (if enabled)
    if (ENABLE_CUSTOM_WS) {
      console.log(`🔌 Custom WebSocket server ready at ws://localhost:${WS_PORT}`);
    }
    
    // Log wallet configuration
    if (!FAST_STARTUP) {
      logWalletConfig();
    }
  });

  process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    
    // Stop services
    await getGameManagerService().shutdown();
    
    if (ENABLE_ENERGY) {
      energyScheduler.stop();
    }
    
    if (ENABLE_TOURNAMENTS && tournamentScheduler) {
      tournamentScheduler.stop();
    }
    
    if (ENABLE_STAKING && stakingService) {
      stakingService.stop();
    }
    
    httpServer.close();
    
    if (ENABLE_CUSTOM_WS && customWsServer) {
      customWsServer.close();
    }
    await prisma.$disconnect();
    
    // Disconnect Redis if connected
    if (redis.status === 'ready') {
      redis.disconnect();
    }
    
    process.exit(0);
  });
}

// Process-level error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n=== UNHANDLED REJECTION ===');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  console.error('Stack:', reason instanceof Error ? reason.stack : 'No stack trace');
  console.error('========================\n');
  
  // Don't exit immediately - give time to handle ongoing requests
  setTimeout(() => {
    console.error('Exiting due to unhandled rejection...');
    process.exit(1);
  }, 1000);
});

process.on('uncaughtException', (error) => {
  console.error('\n=== UNCAUGHT EXCEPTION ===');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  console.error('=========================\n');
  
  // Exit immediately for uncaught exceptions
  process.exit(1);
});

// Memory usage monitoring (only if enabled)
if (ENABLE_MEMORY_MONITOR) {
  setInterval(() => {
    const usage = process.memoryUsage();
    const heapUsed = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotal = Math.round(usage.heapTotal / 1024 / 1024);
    const rss = Math.round(usage.rss / 1024 / 1024);
    
    if (heapUsed > 500) { // Alert if heap usage exceeds 500MB
      console.warn(`⚠️  High memory usage: Heap ${heapUsed}MB / ${heapTotal}MB, RSS: ${rss}MB`);
    }
  }, 30000); // Check every 30 seconds
}

startServer().catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});
