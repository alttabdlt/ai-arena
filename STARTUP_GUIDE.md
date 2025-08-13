# 🚀 AI Arena - Complete Startup Guide

## Prerequisites

### Required Software
- Node.js v18+ and npm
- PostgreSQL 14+
- Redis 6+
- Git

### Optional (for AI features)
- Ollama (for local AI models)
- OpenAI API key
- Anthropic API key
- DeepSeek API key

## Initial Setup (First Time Only)

### 1. Install Dependencies
```bash
# Install shared packages first
cd shared/types && npm install
cd ../events && npm install

# Install backend dependencies
cd ../../backend && npm install
cd ../metaverse-game/backend && npm install

# Install frontend dependencies
cd ../../app && npm install
cd ../metaverse-game && npm install
```

### 2. Setup Databases

#### PostgreSQL (AI Arena Database)
```bash
# Create database
createdb ai_arena

# Run migrations
cd backend
npx prisma migrate dev
npx prisma generate
```

#### Redis (Event Bus & Cache)
```bash
# Start Redis
redis-server

# Verify connection
redis-cli ping
# Should return: PONG
```

#### Convex (Metaverse Database)
```bash
cd metaverse-game

# Login to Convex
npx convex dev --configure

# Deploy schema
npx convex deploy
```

### 3. Environment Variables

#### Arena Backend (.env)
```bash
cd backend
cp .env.example .env
```

Edit `.env`:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/ai_arena"
REDIS_URL="redis://localhost:6379"

# Ports
PORT=4000
WS_PORT=4001

# AI Models
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=...

# Metaverse Integration
METAVERSE_BACKEND_URL=http://localhost:5000
```

#### Metaverse Backend (.env)
```bash
cd metaverse-game/backend
cp .env.example .env
```

Edit `.env`:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/ai_arena"
REDIS_URL="redis://localhost:6379"

# Ports
PORT=5000

# Convex
CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=your-deployment-name

# Arena Integration
ARENA_BACKEND_URL=http://localhost:4000

# AI Models (same as Arena backend)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

#### Arena Frontend (.env)
```bash
cd app
cp .env.example .env
```

Edit `.env`:
```env
VITE_GRAPHQL_URL=http://localhost:4000/graphql
VITE_WS_URL=ws://localhost:4000/graphql
VITE_GAME_WS_URL=ws://localhost:4001
VITE_METAVERSE_URL=http://localhost:5174
```

#### Metaverse Frontend (.env.local)
```bash
cd metaverse-game
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_OLLAMA_ENDPOINT=http://localhost:11434
VITE_OPENAI_API_KEY=sk-...
VITE_TOGETHER_API_KEY=...
```

## 🎮 Running Everything

### Option 1: Run All Services (Recommended)

Create a startup script:
```bash
#!/bin/bash
# save as start-all.sh in project root

echo "🚀 Starting AI Arena Platform..."

# Terminal 1: Arena Backend
osascript -e 'tell app "Terminal" to do script "cd ~/Desktop/Coding-Projects/ai-arena/backend && npm run dev"'

# Terminal 2: Metaverse Backend
osascript -e 'tell app "Terminal" to do script "cd ~/Desktop/Coding-Projects/ai-arena/metaverse-game/backend && npm run dev"'

# Terminal 3: Convex Backend
osascript -e 'tell app "Terminal" to do script "cd ~/Desktop/Coding-Projects/ai-arena/metaverse-game && npm run dev:backend"'

# Terminal 4: Arena Frontend
osascript -e 'tell app "Terminal" to do script "cd ~/Desktop/Coding-Projects/ai-arena/app && npm run dev"'

# Terminal 5: Metaverse Frontend
osascript -e 'tell app "Terminal" to do script "cd ~/Desktop/Coding-Projects/ai-arena/metaverse-game && npm run dev:frontend"'

echo "✅ All services starting..."
echo ""
echo "📍 Service URLs:"
echo "  Arena Frontend:      http://localhost:5173"
echo "  Arena Backend:       http://localhost:4000/graphql"
echo "  Metaverse Frontend:  http://localhost:5174"
echo "  Metaverse Backend:   http://localhost:5000"
echo "  WebSocket Games:     ws://localhost:4001"
echo ""
echo "🎮 Happy gaming!"
```

Make it executable and run:
```bash
chmod +x start-all.sh
./start-all.sh
```

### Option 2: Manual Start (Terminal Tabs)

Open 5 terminal tabs/windows:

#### Tab 1: Arena Backend
```bash
cd backend
npm run dev
# Runs on http://localhost:4000
```

#### Tab 2: Metaverse Backend
```bash
cd metaverse-game/backend
npm run dev
# Runs on http://localhost:5000
```

#### Tab 3: Convex Backend
```bash
cd metaverse-game
npm run dev:backend
# Connects to Convex cloud
```

#### Tab 4: Arena Frontend
```bash
cd app
npm run dev
# Runs on http://localhost:5173
```

#### Tab 5: Metaverse Frontend
```bash
cd metaverse-game
npm run dev:frontend
# Runs on http://localhost:5174
```

## ✅ Verify Everything is Running

### 1. Check Service Health
```bash
# Arena Backend
curl http://localhost:4000/health

# Metaverse Backend
curl http://localhost:5000/health

# GraphQL Playground
open http://localhost:4000/graphql
```

### 2. Test Database Connections
```bash
# PostgreSQL
psql -U your_username -d ai_arena -c "SELECT COUNT(*) FROM \"Bot\";"

# Redis
redis-cli ping

# Convex Dashboard
cd metaverse-game && npm run dashboard
```

### 3. Access Applications
- **AI Arena**: http://localhost:5173
- **Metaverse**: http://localhost:5174
- **GraphQL Playground**: http://localhost:4000/graphql

## 🔧 Troubleshooting

### Port Already in Use
```bash
# Find and kill process on port
lsof -i :4000
kill -9 <PID>
```

### Database Connection Failed
```bash
# Check PostgreSQL is running
pg_isready

# Check Redis is running
redis-cli ping

# Restart services if needed
brew services restart postgresql
brew services restart redis
```

### Convex Issues
```bash
# Re-authenticate
npx convex dev --configure

# Clear and redeploy
npx convex deploy --clear-cache
```

### TypeScript Errors
```bash
# Rebuild all packages
cd shared/types && npm run build
cd ../events && npm run build
cd ../../backend && npm run build
cd ../metaverse-game/backend && npm run build
```

### Module Not Found
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Link shared packages
cd shared/types && npm link
cd ../events && npm link
cd ../../backend && npm link @ai-arena/shared-types @ai-arena/shared-events
```

## 🎯 Quick Test Flow

1. **Create a Bot**:
   - Go to http://localhost:5173
   - Navigate to "Bot Management"
   - Create a new bot with any personality

2. **Join a Tournament**:
   - Go to "Tournaments"
   - Join a queue (Poker, Connect4, or Reverse Hangman)
   - Wait for matchmaking

3. **Enter Metaverse**:
   - Click "Enter Metaverse" button
   - Watch your bot in the crime world
   - Check activity logs

4. **Verify Integration**:
   - Bot should appear in metaverse
   - Tournament rewards should sync
   - Activity should be logged

## 📊 Monitoring

### Logs Location
```
backend/logs/           # Arena backend logs
metaverse-game/logs/    # Metaverse logs
debug-logs/             # Game debug logs
```

### Real-time Monitoring
```bash
# Arena Backend logs
tail -f backend/logs/app.log

# Metaverse activity
cd metaverse-game && npm run dashboard

# Redis events
redis-cli MONITOR
```

## 🛑 Stopping Everything

### Graceful Shutdown
```bash
# In each terminal, press Ctrl+C

# Or use the stop script:
pkill -f "node.*dev"
pkill -f "convex dev"
```

### Clean Shutdown Script
```bash
#!/bin/bash
# save as stop-all.sh

echo "🛑 Stopping AI Arena Platform..."

# Kill Node processes
pkill -f "node.*ai-arena"

# Stop Redis (if using brew)
brew services stop redis

echo "✅ All services stopped"
```

## 📝 Development Tips

1. **Start Order Matters**:
   - Databases first (PostgreSQL, Redis)
   - Backend services (Arena, Metaverse)
   - Convex backend
   - Frontend applications

2. **Use Multiple Terminals**:
   - Each service in its own terminal
   - Easier to see individual logs
   - Can restart services independently

3. **Watch for Errors**:
   - Red text in any terminal = service issue
   - Check environment variables first
   - Verify database connections

4. **Performance**:
   - Close unused browser tabs
   - Limit concurrent bot deployments
   - Monitor Redis memory usage

---
*Last Updated: 2025-08-12 | After repository refactoring*