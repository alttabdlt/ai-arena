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
// import { setupWebSocketServer } from './websocket/server';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { QueueService } from './services/queueService';
import { TransactionService } from './services/transactionService';
import { logWalletConfig } from './config/wallets';
import { PubSub } from 'graphql-subscriptions';

const prisma = new PrismaClient();

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

// Initialize services
const queueService = new QueueService(prisma, redis);
const transactionService = new TransactionService(prisma);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const PORT = process.env.PORT || 4000;
  // const WS_PORT = process.env.WS_PORT || 4001;

  // Global middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
  });

  await apolloServer.start();

  app.use(
    '/graphql',
    cors<cors.CorsRequest>({
      origin: ['http://localhost:5173', 'http://localhost:8080', 'http://localhost:8081'],
      credentials: true,
    }),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => createContext({ req: req as any, prisma, redis, pubsub }),
    }) as any
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // const customWsServer = setupWebSocketServer(parseInt(WS_PORT.toString()));

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
    
    // Start queue matchmaking service
    queueService.startMatchmaking();
    console.log('🎮 Queue matchmaking service started');
    
    // Start transaction monitoring
    transactionService.startMonitoring();
    console.log('💰 Transaction monitoring service started');
    
    // Log wallet configuration
    logWalletConfig();
  });

  process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    
    // Stop services
    queueService.stopMatchmaking();
    
    httpServer.close();
    await prisma.$disconnect();
    
    // Disconnect Redis if connected
    if (redis.status === 'ready') {
      redis.disconnect();
    }
    
    process.exit(0);
  });
}

startServer().catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});