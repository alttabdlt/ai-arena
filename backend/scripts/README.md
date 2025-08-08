# Backend Scripts

This directory contains utility and maintenance scripts for the AI Arena backend.

## Directory Structure

### `/metaverse/`
Scripts for managing bot deployments and synchronization with the metaverse (AI Town).

- **Deployment Scripts**
  - `deploy-all-bots-to-metaverse.js` - Deploy all undeployed bots
  - `redeploy-bots-to-metaverse.js` - Force redeploy all bots
  - `force-redeploy-bot.js` - Redeploy a specific bot
  - `deploy-bots-unified.js` - Unified deployment system

- **Sync & Cleanup Scripts**
  - `reset-metaverse-sync.js` - Reset metaverse synchronization
  - `fix-metaverse-sync.sh` - Shell script for fixing sync issues
  - `cleanup-metaverse-duplicates.js` - Remove duplicate bot entries
  - `cleanup-invalid-bot-syncs.js` - Clean invalid sync records
  - `cleanup-stale-syncs.js` - Remove stale sync entries

- **World Instance Management**
  - `fix-world-instances.js` - Fix invalid world instance IDs
  - `clear-convex-registrations.js` - Clear stuck Convex registrations
  - `fix-stuck-registrations.js` - Fix stuck bot registrations

- **Bot Management**
  - `check-bot-metaverse-status.js` - Check bot deployment status
  - `show-bot-channels.js` - Display bot channel assignments
  - `reset-all-undeployed-bots.js` - Reset all undeployed bots
  - `clear-metaverse-ids.js` - Clear metaverse agent IDs

### `/channels/`
Scripts for managing channels and world instances.

- `initialize-channels.js` - Set up initial channels
- `configure-channel.js` - Configure individual channels
- `create-test-channel.js` - Create test channels
- `channel-health.js` - Check channel health status
- `test-world-discovery.js` - Test world discovery service
- `test-multi-world.js` - Test multi-world functionality

### `/testing/`
Test scripts and utilities for development.

- `test-auth-flow.js` - Test authentication flow
- `test-batch-registration.js` - Test batch bot registration
- `test-channel-api.js` - Test channel API endpoints
- `test-convex-prod.js` - Test production Convex deployment
- `get-test-user.js` - Get test user credentials
- `add-test-lootboxes.js` - Add test lootbox rewards

### `/maintenance/`
System maintenance and verification scripts.

- `verify-ready-for-restart.js` - Pre-restart system check
- `verify-world-instances.js` - Verify world instance health
- `update-bot-token-ids.ts` - Update bot token IDs

## Usage

Most scripts can be run directly with Node.js:

```bash
node scripts/metaverse/deploy-all-bots-to-metaverse.js
```

Shell scripts should be executed with bash:

```bash
bash scripts/metaverse/fix-metaverse-sync.sh
```

## Common Workflows

### Fixing Bot Deployment Issues

1. Check world instances:
   ```bash
   node scripts/maintenance/verify-world-instances.js
   ```

2. Fix invalid instances:
   ```bash
   node scripts/metaverse/fix-world-instances.js
   ```

3. Reset stuck bots:
   ```bash
   node scripts/metaverse/reset-all-undeployed-bots.js
   ```

4. Verify system is ready:
   ```bash
   node scripts/maintenance/verify-ready-for-restart.js
   ```

5. Restart the backend service

### Complete Metaverse Reset

```bash
bash scripts/metaverse/full-metaverse-reset.sh
```

This will completely reset the metaverse synchronization and redeploy all bots.

## Important Notes

- Always backup your database before running cleanup scripts
- Some scripts require the backend service to be stopped
- Check script output for any required follow-up actions
- Most scripts will prompt for confirmation before making changes