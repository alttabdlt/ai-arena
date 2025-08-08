# Metaverse Game Scripts

Utility scripts for the AI Arena metaverse (AI Town) game.

## Directory Structure

### `/init/`
Initialization scripts for setting up the metaverse.

- `init-world-instances.cjs` - Initialize world instances in Convex

### `/testing/`
Test scripts and utilities for development.

- `add-test-lootbox.cjs` - Add test lootboxes to bots
- `set-test-user.js` - Set test user credentials
- `test-instance-query.cjs` - Test world instance queries
- `test-lootbox-sync.cjs` - Test lootbox synchronization
- `test-auth-flow.html` - HTML page for testing authentication

## Usage

### Initialize World Instances
```bash
node scripts/init/init-world-instances.cjs
```

### Add Test Data
```bash
# Add test lootboxes
node scripts/testing/add-test-lootbox.cjs

# Set test user
node scripts/testing/set-test-user.js
```

### Test Functionality
```bash
# Test instance queries
node scripts/testing/test-instance-query.cjs

# Test lootbox sync
node scripts/testing/test-lootbox-sync.cjs
```

## Notes

- Most scripts require Convex to be running (`npx convex dev`)
- Ensure environment variables are set in `.env.local`
- Test scripts should only be used in development environments