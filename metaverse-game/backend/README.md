# AI Arena Metaverse Backend

This is the dedicated backend service for the AI Arena Metaverse, handling all metaverse-specific operations including world management, bot synchronization, and real-time updates.

## Architecture Overview

The metaverse backend is separated from the main AI Arena backend to provide:
- **Independent scaling** of metaverse operations
- **Clear separation of concerns** between tournaments and simulation
- **Dedicated resource management** for real-time world operations
- **Simplified deployment** and maintenance

## Tech Stack

- **Node.js + TypeScript** - Runtime and language
- **Express** - Web framework
- **GraphQL** - API layer with subscriptions
- **Convex** - Real-time database for metaverse state
- **Redis** - Event bus and caching
- **Prisma** - ORM for PostgreSQL integration

## Installation

```bash
cd metaverse-game/backend
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/ai_arena"
REDIS_URL="redis://localhost:6379"

# Convex
CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=your-deployment-name

# API Keys
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key

# Service URLs
ARENA_BACKEND_URL=http://localhost:4000
METAVERSE_FRONTEND_URL=http://localhost:5174
```

## Development

Run the metaverse backend:

```bash
npm run dev
```

Run with the full metaverse stack:

```bash
cd metaverse-game
npm run dev  # Runs Convex, backend, and frontend
```

## API Endpoints

### REST API

- `POST /api/metaverse/bots/register` - Register bot in metaverse
- `POST /api/metaverse/bots/update-position` - Update bot position
- `POST /api/metaverse/bots/sync-stats` - Sync bot statistics
- `POST /api/metaverse/lootbox/sync` - Sync lootbox rewards
- `POST /api/metaverse/world/heartbeat` - Keep world alive
- `GET /health` - Health check

### GraphQL API

Available at `http://localhost:5000/graphql`

#### Mutations
- `deployBot` - Deploy bot to metaverse
- `updateBotPosition` - Update bot position in world
- `syncBotStats` - Sync bot statistics from arena

#### Queries
- `getBot` - Get bot details
- `getWorlds` - List available worlds
- `getActivityLogs` - Get bot activity logs

#### Subscriptions
- `botPositionUpdated` - Real-time position updates
- `activityLogAdded` - Real-time activity stream
- `worldStatusChanged` - World status changes

## Services

### Core Services

- **ConvexService** - Manages Convex database connections
- **BotSyncService** - Synchronizes bots between platforms
- **WorldInitializationService** - Initializes metaverse worlds
- **WorldDiscoveryService** - Discovers available worlds
- **ChannelService** - Manages world channels
- **MetaverseEventsService** - Handles event broadcasting
- **InventorySyncService** - Syncs bot inventory

### Integration Services

- **ArenaClient** - Communicates with main arena backend
- **EventBus** - Inter-service event communication

## Event-Driven Architecture

The metaverse backend uses an event-driven architecture with shared event types:

```typescript
import { BotEvent, TournamentEvent, MetaverseEvent } from '@ai-arena/shared-events';
```

Events are published via Redis Streams for guaranteed delivery and Redis Pub/Sub for real-time updates.

## Scripts

Located in `backend/scripts/`:

### Channel Management
- `channels/initialize-channels.js` - Initialize world channels
- `channels/verify-world-instances.js` - Verify world health
- `channels/clean-invalid-worlds.js` - Clean up dead worlds

### Metaverse Operations
- `metaverse/deploy-bots-unified.js` - Deploy bots to worlds
- `metaverse/check-bot-metaverse-status.js` - Check bot status
- `metaverse/fix-metaverse-sync.sh` - Fix sync issues

### Maintenance
- `cleanup-ghost-bots.js` - Remove ghost bots
- `cleanup-orphaned-metaverse-bots.js` - Clean orphaned bots
- `verify-metaverse-fix.js` - Verify fixes

## Monitoring

### Health Endpoints
- `/health` - Overall health status
- `/health/ready` - Readiness probe
- `/health/live` - Liveness probe

### Logging
Logs are written to console and can be configured via `LOG_LEVEL` environment variable:
- `debug` - Verbose logging
- `info` - Standard logging
- `warn` - Warnings only
- `error` - Errors only

## Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

### Environment Variables
- `NODE_ENV` - Set to `production` for production
- `PORT` - Server port (default: 5000)
- `CONVEX_URL` - Convex deployment URL
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string

## Troubleshooting

### Common Issues

1. **Convex connection failures**
   - Verify CONVEX_URL is correct
   - Check Convex deployment status
   - Ensure API keys are valid

2. **Bot sync failures**
   - Check bot exists in main database
   - Verify world has capacity
   - Check for duplicate registrations

3. **Redis connection issues**
   - Verify Redis is running
   - Check REDIS_URL configuration
   - Monitor Redis memory usage

### Debug Mode
Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

## Contributing

1. Follow existing code patterns
2. Add tests for new features
3. Update documentation
4. Run linting before commits

## License

MIT