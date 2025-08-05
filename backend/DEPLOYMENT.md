# AI Arena Bot Deployment - Automated System

## Overview

The bot deployment system has been fully automated. Bots are now automatically deployed from AI Arena to the Crime City metaverse without any manual intervention.

## How It Works

### 1. Automatic World Initialization
- World instances are created automatically when the backend starts
- The system ensures 3 zones exist: `casino`, `darkAlley`, `suburb`
- No manual script execution required

### 2. Automatic Bot Deployment
- The bot sync service runs every 30 seconds
- Detects undeployed bots automatically
- Deploys them to the metaverse with proper zone assignment based on personality
- Handles failures and retries automatically

### 3. Self-Healing System
- Failed deployments are retried after 5 minutes
- Invalid world IDs are detected and cleaned up
- Bots stuck in invalid states are reset automatically

## Manual Operations (Optional)

### Unified Deployment Script
If you need to manually trigger deployment:
```bash
cd backend
node scripts/deploy-bots-unified.js
```
This script combines all three previous operations in one command.

### GraphQL Mutations
For programmatic control, use these GraphQL mutations:

```graphql
# Deploy all undeployed bots
mutation {
  deployAllBots(force: false) {
    success
    deployed
    failed
    message
  }
}

# Clean up invalid syncs
mutation {
  cleanupInvalidSyncs {
    success
    invalidSyncsCleared
    botsReset
  }
}

# Initialize world instances
mutation {
  initializeWorlds {
    success
    deployed
    message
  }
}

# Retry failed deployments
mutation {
  retryFailedDeployments {
    success
    deployed
    failed
  }
}
```

## Monitoring

### Deployment Status UI
Visit `/admin/deployment` in the frontend to:
- View deployment statistics
- Monitor world instances
- Trigger manual deployments
- See failed deployments
- Clean up invalid syncs

### Backend Logs
The backend logs all deployment activities:
```
🌍 Checking metaverse world instances...
✅ Found 3 existing world instances
🚀 Found 5 undeployed bots - deploying automatically...
✅ Auto-deployed bot: CrimeBoss (bot-123)
🎉 Auto-deployment complete: 5 succeeded, 0 failed
```

## Architecture

### Services
1. **WorldInitializationService** - Manages world instance creation
2. **BotSyncService** - Handles automatic deployment and synchronization
3. **DeploymentResolvers** - GraphQL API for deployment management
4. **MetaverseEventsService** - Publishes deployment events

### Data Flow
```
Bot Created → BotSyncService detects → Auto-deployment → Metaverse
     ↓              ↓                        ↓              ↓
  Database    Every 30 seconds        Register in       Update
              or on startup           Convex/AI Town    Position
```

### Error Recovery
- Transient failures: Retry after 5 minutes
- Invalid world IDs: Automatic cleanup and re-deployment
- Network issues: Exponential backoff with retry
- Rate limiting: 500ms delay between deployments

## Configuration

### Environment Variables
```bash
# Convex/Metaverse URL
NEXT_PUBLIC_CONVEX_URL=https://polished-otter-734.convex.cloud

# Sync interval (milliseconds)
BOT_SYNC_INTERVAL=30000  # Default: 30 seconds
```

### Personality-Based Zone Assignment
- **CRIMINAL**: Deployed to `darkAlley` (70%) or `casino` (30%)
- **GAMBLER**: Deployed to `casino` (80%) or `darkAlley` (20%)
- **WORKER**: Deployed to `suburb` (60%) or `downtown` (40%)

## Troubleshooting

### Bots Not Deploying
1. Check if world instances exist: Query `getWorldsStatus`
2. Check bot sync status: Query `getDeploymentStatus`
3. Review failed deployments: Query `getFailedDeployments`
4. Force retry: Mutation `retryFailedDeployments`

### Invalid World IDs
The system automatically detects and cleans invalid world IDs.
Known invalid ID: `m17dkz0psv5e7b812sjjxwpwgd7n374s`

### Manual Reset
To completely reset a bot's deployment:
```graphql
mutation {
  resetBotDeployment(botId: "bot-id-here") {
    success
    message
  }
}
```

## Migration from Manual Process

The old manual process required running:
1. `node init-world-instances.cjs`
2. `node scripts/cleanup-invalid-bot-syncs.js`
3. `node scripts/deploy-all-bots-to-metaverse.js`

**This is no longer necessary!** The system handles everything automatically.

## Performance

- Deployment rate: ~2 bots per second (with rate limiting)
- Sync interval: Every 30 seconds
- Cleanup cycle: Every 5th sync run (~2.5 minutes)
- Failed retry: After 5 minutes
- Max parallel deployments: Sequential (to avoid rate limits)

## Future Improvements

- [ ] Parallel deployment with smart rate limiting
- [ ] WebSocket notifications for deployment status
- [ ] Deployment queue priority system
- [ ] Bulk deployment API for large batches
- [ ] Deployment analytics and metrics