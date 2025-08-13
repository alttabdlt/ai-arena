import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
// @ts-ignore - Module resolution issue with graphql-ws
import { useServer } from 'graphql-ws/use/ws';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config();

// Import services
import { ConvexService } from './services/convexService';
import { BotSyncService } from './services/botSyncService';
import { WorldInitializationService } from './services/worldInitializationService';
import { WorldDiscoveryService } from './services/worldDiscoveryService';
import { ChannelService } from './services/channelService';
import { MetaverseEventsService } from './services/metaverseEventsService';
import { InventorySyncService } from './services/inventorySync';

// Import routes
import metaverseRoutes from './routes/metaverse';
import healthRoutes from './routes/health';
import webhookRoutes from './routes/webhooks';

// Import GraphQL schema
import typeDefs from './graphql/schema';
import resolvers from './graphql/resolvers';

const PORT = process.env.PORT || 5001;

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  // Middleware
  app.use(cors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true
  }));
  app.use(express.json());

  // Initialize services
  console.log(chalk.blue('🚀 Initializing Metaverse Backend Services...'));
  
  const convexService = ConvexService.getInstance();
  const worldDiscoveryService = WorldDiscoveryService.getInstance();
  const worldInitService = new WorldInitializationService();
  const channelService = ChannelService.getInstance();
  const botSyncService = BotSyncService.getInstance();
  const metaverseEventsService = MetaverseEventsService.getInstance();
  const inventorySyncService = new InventorySyncService();

  // Create GraphQL schema
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // Create WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  // Set up WebSocket server
  const serverCleanup = useServer(
    {
      schema,
      context: async (ctx: any, msg: any, args: any) => ({
        // Add services to context
        convexService,
        worldDiscoveryService,
        worldInitService,
        channelService,
        botSyncService,
        metaverseEventsService,
        inventorySyncService,
      }),
    },
    wsServer
  );

  // Create Apollo Server
  const apolloServer = new ApolloServer({
    schema,
    introspection: true, // Enable introspection for debugging
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
    formatError: (err) => {
      console.error('GraphQL Error:', err);
      return err;
    },
  });

  await apolloServer.start();

  // Apply Apollo middleware
  app.use(
    '/graphql',
    expressMiddleware(apolloServer, {
      context: async ({ req }) => ({
        // Add services to context
        convexService,
        worldDiscoveryService,
        worldInitService,
        channelService,
        botSyncService,
        metaverseEventsService,
        inventorySyncService,
        req,
      }),
    }) as any // Type assertion to bypass middleware type checking
  );

  // REST Routes
  app.use('/api/metaverse', metaverseRoutes);
  app.use('/api/webhooks', webhookRoutes);
  app.use('/health', healthRoutes);

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      service: 'AI Arena Metaverse Backend',
      version: '1.0.0',
      status: 'operational',
      endpoints: {
        graphql: '/graphql',
        health: '/health',
        metaverse: '/api/metaverse'
      }
    });
  });

  // Start server
  httpServer.listen(PORT, async () => {
    console.log(chalk.green(`
╔════════════════════════════════════════════╗
║     AI Arena Metaverse Backend Started     ║
╠════════════════════════════════════════════╣
║  🌐 Server:     http://localhost:${PORT}      ║
║  📊 GraphQL:    http://localhost:${PORT}/graphql ║
║  🔌 WebSocket:  ws://localhost:${PORT}/graphql   ║
║  🏥 Health:     http://localhost:${PORT}/health  ║
╚════════════════════════════════════════════╝
    `));
    
    // Start the bot sync service after server is ready
    try {
      await botSyncService.start();
      console.log(chalk.cyan('🤖 Bot sync service started successfully'));
    } catch (error) {
      console.error(chalk.red('Failed to start bot sync service:'), error);
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log(chalk.yellow('SIGTERM signal received: closing HTTP server'));
    httpServer.close(() => {
      console.log(chalk.red('HTTP server closed'));
    });
  });
}

startServer().catch((error) => {
  console.error(chalk.red('Failed to start server:'), error);
  process.exit(1);
});