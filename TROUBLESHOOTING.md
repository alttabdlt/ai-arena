# AI Arena Troubleshooting Guide

## Critical Architecture Issues

### 1. Agent Overwriting in Metaverse (Solved)
**Problem**: When multiple bots deployed simultaneously, they overwrote each other
**Root Cause**: AI Town engine processes inputs in steps and replaces the entire world document instead of merging changes
**Solution**: Implemented batch registration queue system
- Queue registrations in `pendingBotRegistrations` table
- Process in batches with same timestamp
- Cron job runs every 3 seconds
- Files: `convex/aiTown/batchRegistration.ts`, `convex/aiTown/botHttp.ts`

### 2. TypeScript Deep Type Instantiation
**Problem**: "Type instantiation is excessively deep and possibly infinite" errors
**Root Cause**: Convex's generated API types become too complex for TypeScript
**Solution**: Use `@ts-ignore` comments or type casting with `as any`
```typescript
// @ts-ignore - TypeScript has issues with deep type instantiation here
await ctx.runQuery(internal.aiTown.batchRegistration.getWorldsWithPendingRegistrations);
```

### 3. World ID Persistence After Wipe
**Problem**: After `testing:wipeAllTables`, old world IDs remain cached/hardcoded
**Solution**: 
- Remove all hardcoded world IDs
- Clear `channelMetadata` table
- Use dynamic world lookup:
```typescript
const worldStatus = await ctx.db
  .query('worldStatus')
  .filter((q) => q.eq(q.field('isDefault'), true))
  .first();
```

## Schema & Type Mismatches

### Field Naming Inconsistencies
| Backend (Prisma) | Convex | Notes |
|-----------------|---------|-------|
| `botSync.convexAgentId` | `world.agents[].id` | Different naming conventions |
| `botSync.convexWorldId` | `worldStatus.worldId` | ID format: 32-char alphanumeric |
| `bot.stats.earnings` | Number expected | Stored as string "0", needs `Number()` conversion |

### Convex ID Validation
```typescript
// Valid Convex world ID format
if (!worldId.match(/^[a-z0-9]{32}$/)) {
  throw new Error('Invalid worldId format');
}
```

### Type Conversions Required
```typescript
// Bot stats - ensure all numeric fields are numbers
const metaverseStats = {
  wins: Number(stats?.wins) || 0,
  losses: Number(stats?.losses) || 0,
  earnings: Number(stats?.earnings) || 0,  // Critical: was string "0"
};
```

## Integration Gotchas

### 1. World Discovery Service Caching
- Cache TTL: 5 minutes
- Stores in `channelMetadata` table
- Must clear after world changes:
```sql
UPDATE channel_metadata SET world_id = NULL;
```

### 2. Agent Existence Checks
Always verify agent exists before operations:
```typescript
const agentExists = await convexService.getAgentPosition(worldId, agentId);
if (agentExists === null) {
  // Mark sync as FAILED, clear agent IDs
  await prisma.botSync.update({
    where: { id: sync.id },
    data: {
      syncStatus: 'FAILED',
      convexAgentId: null,
      convexPlayerId: null,
    }
  });
}
```

### 3. Bot Position Lookup Fallback
Search by both agent ID and aiArenaBotId:
```typescript
let agent = world.agents.find((a: any) => a.id === args.agentId);
if (!agent) {
  agent = world.agents.find((a: any) => a.aiArenaBotId === args.agentId);
}
```

## Common Error Patterns

### "Invalid world ID"
**Cause**: World was deleted but ID still cached
**Fix**: Clear channelMetadata, restart backend

### "Agent not found"
**Cause**: Agent doesn't exist or wrong ID used
**Fix**: Return null instead of throwing, implement fallback search

### "Value does not match validator"
**Cause**: Type mismatch (usually string vs number)
**Fix**: Explicit type conversion with `Number()`

### "Failed to create bot agent: Internal Server Error"
**Causes**: 
1. World doesn't exist
2. Registration queue backed up
3. Network timeout during polling
**Fix**: Check world exists, increase polling timeout, verify registration queue

## Debugging Utilities

### Essential Scripts
```bash
# Check world and agents
npx convex run debugging:checkWorldDocument
npx convex run debugging:checkAgentDetails
npx convex run debugging:checkRegistrationQueue

# Clean up stale data
node scripts/cleanup-stale-syncs.js
node scripts/cleanup-invalid-bot-syncs.js

# Force sync
node scripts/test-batch-registration.js
```

### Recovery Procedures

#### After `wipeAllTables`
1. Run `testing:resume` to create new world
2. Clear channelMetadata: `UPDATE channel_metadata SET world_id = NULL`
3. Delete invalid bot syncs: `DELETE FROM bot_sync WHERE convex_world_id IS NULL`
4. Restart backend to clear caches

#### For Stuck Registrations
1. Check queue: `npx convex run debugging:checkRegistrationQueue`
2. Clear queue if needed: `npx convex run debugging:clearRegistrationQueue`
3. Manually trigger: `npx convex run debugging:triggerBatchProcessing`

## Production Considerations

### Data Persistence
- World IDs change after wipes
- Bot syncs must be resilient to world changes
- Never hardcode world/agent IDs

### Multi-System Sync
- Backend (Prisma) → Convex → Frontend
- Each system has own cache layer
- Polling required for async operations (90s timeout)

### Error Handling Best Practices
1. Return null instead of throwing for missing entities
2. Implement graceful degradation
3. Log but don't fail on non-critical errors
4. Always validate IDs before operations
5. Use existence checks before mutations

### Critical Files to Monitor
- `convex/aiTown/batchRegistration.ts` - Registration queue
- `backend/src/services/botSyncService.ts` - Bot synchronization
- `backend/src/services/worldDiscoveryService.ts` - World caching
- `convex/debugging.ts` - Debug utilities

## Environment Variables
```bash
# Backend (.env)
CONVEX_URL=https://reliable-ocelot-928.convex.cloud

# Frontend (.env.local)
CONVEX_DEPLOYMENT=dev:reliable-ocelot-928
VITE_CONVEX_URL=https://reliable-ocelot-928.convex.cloud
```

## Key Insights
1. **Batch Processing**: Essential for preventing race conditions in distributed systems
2. **Dynamic Lookups**: Never hardcode IDs that can change
3. **Type Safety**: Convex/TypeScript integration has limits, pragmatic solutions needed
4. **Graceful Failures**: Return null/empty rather than throwing errors
5. **Cache Invalidation**: One of the hardest problems - always provide manual clear options