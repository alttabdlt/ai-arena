#!/bin/bash

echo "🔧 AI Arena Metaverse Sync Fix Script"
echo "====================================="
echo ""

# Step 1: Clean up invalid bot syncs
echo "Step 1: Cleaning up invalid bot syncs..."
node scripts/cleanup-invalid-bot-syncs.js
echo ""

# Step 2: Wait for user to restart backend
echo "Step 2: Please restart the backend server to apply CORS changes:"
echo "   1. Stop the backend server (Ctrl+C)"
echo "   2. Run: npm run dev"
echo ""
read -p "Press Enter when the backend is restarted..."
echo ""

# Step 3: Deploy all bots
echo "Step 3: Deploying all bots to the metaverse..."
node scripts/deploy-all-bots-to-metaverse.js
echo ""

echo "✅ Metaverse sync fix complete!"
echo ""
echo "You can now:"
echo "1. Open the metaverse game at http://localhost:5174"
echo "2. Your bots should appear in the game"
echo "3. The bot selector should show your bots"