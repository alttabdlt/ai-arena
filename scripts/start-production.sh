#!/bin/bash
# AI Town — Production startup script
set -e

cd /app/backend

echo "🔧 Syncing database schema..."
npx prisma db push --accept-data-loss
echo "✅ Database schema synced"

echo "🌱 Seeding initial data if needed..."
npx tsx scripts/seed-town.ts || echo "⚠️  Seed skipped"

echo "🚀 Starting AI Town server..."
exec npx tsx src/index.ts
