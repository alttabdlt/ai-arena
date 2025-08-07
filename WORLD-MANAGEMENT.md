# World Management System - Production Architecture

## Overview

The AI Arena metaverse now uses a **dynamic world discovery system** that automatically handles Convex world lifecycle events (restarts, wipes, creation) without manual intervention. This replaces the previous approach of storing hardcoded world IDs.

## Key Components

### 1. World Discovery Service (`backend/src/services/worldDiscoveryService.ts`)
- **Purpose**: Dynamically discovers or creates worlds at runtime
- **Caching**: 5-minute TTL to reduce Convex queries
- **Auto-recovery**: Creates new worlds if none exist
- **Channel support**: Ready for multi-world architecture

### 2. Reset Script (`backend/scripts/reset-metaverse-sync.js`)
- **Purpose**: Clear invalid world references after Convex wipes
- **Usage**: `node backend/scripts/reset-metaverse-sync.js`
- **When to use**: After `npx convex run testing:wipeAllTables`

### 3. Updated Bot Sync Service
- No longer stores world IDs permanently
- Discovers world on each sync cycle
- Auto-recovers from "World not found" errors
- Re-deploys bots automatically after wipes

## How It Works

### Normal Operation
```
1. BotSyncService runs every 30 seconds
2. Calls worldDiscoveryService.discoverWorld('main')
3. Discovery service checks cache (5 min TTL)
4. If cached, returns immediately
5. If not cached, queries Convex for default world
6. Deploys/syncs bots to discovered world
```

### After Convex Wipe
```
1. Old world IDs become invalid
2. Sync detects "World not found" error
3. Automatically clears bot references
4. Discovery service detects no world exists
5. Creates new default world via Convex init
6. Re-deploys all bots to new world
7. Normal operation resumes
```

## Common Scenarios

### Scenario 1: Daily Development
```bash
# Start metaverse
cd metaverse-game
npm run dev

# Start backend (bots auto-deploy)
cd backend
npm run dev
```

### Scenario 2: After Convex Wipe
```bash
# Wipe Convex tables
cd metaverse-game
npx convex run testing:wipeAllTables

# Reset backend references
cd backend
node scripts/reset-metaverse-sync.js

# Restart everything
cd metaverse-game && npm run dev
cd backend && npm run dev

# Bots will auto-deploy in ~30 seconds
```

### Scenario 3: Testing World Discovery
```bash
cd backend
npm run build
node scripts/test-world-discovery.js
```

## Production Benefits

### 1. **Zero Manual Intervention**
- No need to update world IDs after wipes
- Automatic recovery from Convex restarts
- Self-healing on world deletion

### 2. **Channel-Ready Architecture**
- Supports multiple worlds (tournaments, regions, shards)
- Each channel can have its own world
- Load balancing across worlds

### 3. **Graceful Degradation**
- Continues attempting world creation
- Queues bots if world unavailable
- Clears invalid references automatically

## Future Enhancements (Planned)

### Phase 1: Channel Support
```typescript
// Assign bots to channels
Bot {
  channel: "tournament-5" // or "main", "us-west", etc.
}

// Discover channel-specific world
const worldId = await worldDiscoveryService.discoverWorld(bot.channel);
```

### Phase 2: World Metadata
```typescript
// Track world statistics
worldMetadata {
  worldId: string
  channel: string
  region: string
  botCount: number
  status: 'active' | 'full' | 'draining'
}
```

### Phase 3: Load Balancing
```typescript
// Automatic sharding when world is full
if (world.botCount > MAX_BOTS_PER_WORLD) {
  const newShard = await createNewShard(channel);
  return assignToShard(bot, newShard);
}
```

## Monitoring

### Check World Status
```bash
# See current world assignments
cd backend
node scripts/test-world-discovery.js
```

### Monitor Sync Logs
```
🔍 Discovering world for channel "main"...
✅ Discovered world: m17...
📍 Using world m17... for channel "main"
✅ Auto-deployed bot: Strategic Analyzer
```

### Error Recovery Logs
```
❌ World not found for bot Strategic Analyzer
🔄 World m17... not found, clearing cache
📝 World was wiped/deleted, will re-deploy
🔍 Discovering world for channel "main"...
✅ Created new world: m18...
```

## Troubleshooting

### Issue: "No world found"
**Solution**: Ensure Convex is running and initialized
```bash
cd metaverse-game
npm run dev
npx convex run init
```

### Issue: Bots not deploying
**Solution**: Run reset script
```bash
cd backend
node scripts/reset-metaverse-sync.js
npm run dev
```

### Issue: World cache issues
**Solution**: Clear cache in code
```javascript
worldDiscoveryService.clearCache();
```

## Architecture Principles

1. **Never store world IDs permanently** - They're ephemeral
2. **Always discover at runtime** - Ensures freshness
3. **Cache with short TTL** - Balance performance and accuracy
4. **Handle failures gracefully** - Auto-recover, don't crash
5. **Design for scale** - Channel/shard support from day one

## Migration Checklist

- [x] Create world discovery service
- [x] Update bot sync to use discovery
- [x] Create reset script for recovery
- [x] Add Convex queries for world lookup
- [x] Test full wipe/recovery cycle
- [ ] Add channel field to database (Phase 2)
- [ ] Implement world metadata tracking (Phase 2)
- [ ] Add load balancing logic (Phase 3)

---

This architecture ensures the AI Arena metaverse can scale to production with thousands of bots across multiple worlds, while maintaining zero-downtime deployments and automatic recovery from any Convex lifecycle event.