#!/bin/bash

# Full Metaverse Reset Script
# This script performs a complete reset including cache clearing

echo "🔄 Full Metaverse Reset Script"
echo "================================"
echo ""
echo "This will:"
echo "  1. Stop the backend (if running)"
echo "  2. Clear all metaverse sync data from PostgreSQL"
echo "  3. Restart the backend with empty cache"
echo ""
read -p "Continue? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Reset cancelled"
    exit 1
fi

# Step 1: Kill any running backend process
echo ""
echo "1️⃣  Stopping backend process..."
pkill -f "node.*backend/dist/index.js" 2>/dev/null || true
pkill -f "tsx.*backend/src/index.ts" 2>/dev/null || true
pkill -f "npm.*run dev.*backend" 2>/dev/null || true
sleep 2

# Step 2: Run the reset script
echo ""
echo "2️⃣  Resetting metaverse sync data..."
cd "$(dirname "$0")"
node reset-metaverse-sync.js --force

# Step 3: Start the backend
echo ""
echo "3️⃣  Starting backend with fresh cache..."
echo ""
echo "✅ Reset complete! Starting backend now..."
echo ""
cd ../
npm run dev