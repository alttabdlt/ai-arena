# Testing the Inventory System

## Quick Start

1. **Start the metaverse game:**
   ```bash
   cd metaverse-game
   npm run dev
   ```

2. **Register a bot (if you haven't already):**
   ```bash
   # From the backend directory
   cd ../backend
   node test-bot-registration.js
   ```

3. **Add test lootboxes (Two Methods):**

   ### Method 1: Frontend UI (Recommended)
   - Open http://localhost:5173
   - Select a bot using the dropdown
   - Click the **Inventory** button (briefcase icon)
   - Go to the **Lootboxes** tab
   - Click the **"Create Test Lootbox"** button (yellow development panel)
   - The lootbox will appear instantly

   ### Method 2: Backend Script
   ```bash
   # From the metaverse-game directory
   node test-lootbox-sync.cjs
   ```
   Note: You'll need to update the `AI_ARENA_BOT_ID` in the script with your actual bot ID.

4. **Test in the UI:**
   - Click on a lootbox to open it
   - Watch the opening animation
   - Check the **Equipment** tab to see your items
   - Equip items to increase your power/defense

## Finding Your Bot ID

1. In the metaverse game, open the browser console
2. Run:
   ```javascript
   // Get all agents
   const world = await window.convex.query("world.worldState", { worldId: "YOUR_WORLD_ID" });
   console.log(world.agents);
   ```

3. Look for the `aiArenaBotId` field in the agents

## Manual Lootbox Creation (Alternative)

If the sync endpoint isn't working, you can manually create lootboxes in the Convex dashboard:

1. Go to http://localhost:8480 (Convex dashboard)
2. Navigate to the `lootboxQueue` table
3. Add a new document with this structure:
   ```json
   {
     "worldId": "YOUR_WORLD_ID",
     "playerId": "p:1",
     "aiArenaBotId": "YOUR_BOT_ID",
     "lootboxId": "test-1",
     "rarity": "EPIC",
     "rewards": [
       {
         "itemId": "test-item-1",
         "name": "Crimson Blade",
         "type": "WEAPON",
         "rarity": "EPIC",
         "stats": {
           "powerBonus": 25,
           "defenseBonus": 0
         }
       }
     ],
     "processed": false,
     "createdAt": 1234567890000
   }
   ```

## Troubleshooting

- **No bots in selector:** Make sure you've registered a bot from AI Arena
- **Inventory button not showing item count:** Select a bot first
- **Lootboxes not appearing:** Check the `lootboxQueue` table in Convex dashboard
- **Items not equipping:** Check browser console for errors

## What's Working

✅ Inventory UI with tabs
✅ Lootbox opening animation
✅ Equipment system with stats
✅ Item equipping/unequipping
✅ Real-time updates via Convex
✅ Crime-themed visuals

## Next Steps

- Add trading between bots
- Implement house placement for furniture
- Add item crafting/fusion
- Create robbery mechanics that use equipment