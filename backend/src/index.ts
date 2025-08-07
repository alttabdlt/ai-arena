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
import webhookRoutes from './routes/webhooks';
import { setupWebSocketServer } from './websocket/server';
import { prisma } from './config/database';
import Redis from 'ioredis';
import { initializeGameManagerService, getGameManagerService } from './services/gameManagerService';
import { logWalletConfig } from './config/wallets';
import { PubSub } from 'graphql-subscriptions';
import { initializeServices, getQueueService, getTransactionService } from './services';
import { fileLoggerService } from './services/fileLoggerService';
import { botSyncService } from './services/botSyncService';
import { worldInitializationService } from './services/worldInitializationService';
import { energyScheduler } from './services/energyScheduler';

// Override console methods to capture backend logs
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

console.log('🎮 Backend logging initialized');

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

// Initialize services
initializeServices(prisma, redis, pubsub);
initializeGameManagerService(pubsub);

console.log('🔍 Enhanced debugging enabled for queue and match flow');

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
      origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:8080', 'http://localhost:8081'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'x-wallet-address', 'x-bot-prompt'],
      exposedHeaders: ['Authorization'],
    }),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => createContext({ req: req as any, prisma, redis, pubsub }),
    }) as any
  );

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
  app.use('/api/webhooks', webhookRoutes);

  const customWsServer = setupWebSocketServer(parseInt(WS_PORT.toString()));

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
    
    // Clean up any stuck matches from previous runs
    await getQueueService().cleanupStuckMatches();
    console.log('🧹 Cleaned up stuck matches');
    
    // Start queue matchmaking service
    getQueueService().startMatchmaking();
    console.log('🎮 Queue matchmaking service started');
    
    // Ensure demo bots are in queue
    await getQueueService().ensureDemoBots();
    console.log('🤖 Demo bots queue status checked');
    
    // Start transaction monitoring
    getTransactionService().startMonitoring();
    console.log('💰 Transaction monitoring service started');
    
    // Game manager service is initialized as a singleton
    console.log('🎮 Game manager service ready');
    
    // Initialize metaverse world instances
    await worldInitializationService.initialize();
    
    // Start bot sync service
    await botSyncService.start();
    console.log('🤖 Bot sync service started');
    
    // Start energy scheduler
    energyScheduler.start();
    console.log('⚡ Energy scheduler started - processing hourly consumption');
    
    // Log WebSocket server info
    console.log(`🔌 Custom WebSocket server ready at ws://localhost:${WS_PORT}`);
    
    // Log wallet configuration
    logWalletConfig();
  });

  process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    
    // Stop services
    getQueueService().stopMatchmaking();
    await getGameManagerService().shutdown();
    botSyncService.stop();
    energyScheduler.stop();
    
    httpServer.close();
    customWsServer.close();
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

// Memory usage monitoring
setInterval(() => {
  const usage = process.memoryUsage();
  const heapUsed = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotal = Math.round(usage.heapTotal / 1024 / 1024);
  const rss = Math.round(usage.rss / 1024 / 1024);
  
  if (heapUsed > 500) { // Alert if heap usage exceeds 500MB
    console.warn(`⚠️  High memory usage: Heap ${heapUsed}MB / ${heapTotal}MB, RSS: ${rss}MB`);
  }
}, 30000); // Check every 30 seconds

startServer().catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});