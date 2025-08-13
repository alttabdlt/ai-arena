#!/bin/bash

# AI Arena - Start All Services
# This script starts all components of the AI Arena platform

echo "🚀 Starting AI Arena Platform..."
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL not found. Please install PostgreSQL first.${NC}"
    exit 1
fi

# Check Redis
if ! command -v redis-cli &> /dev/null; then
    echo -e "${RED}❌ Redis not found. Please install Redis first.${NC}"
    exit 1
fi

# Check Node
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites OK${NC}"
echo ""

# Start Redis if not running
if ! redis-cli ping &> /dev/null; then
    echo -e "${YELLOW}Starting Redis...${NC}"
    redis-server --daemonize yes
    sleep 2
fi

# Function to open new terminal tab and run command (macOS)
open_terminal_tab() {
    local dir=$1
    local cmd=$2
    local name=$3
    
    osascript <<EOF
        tell application "Terminal"
            activate
            tell application "System Events" to keystroke "t" using command down
            delay 0.5
            do script "cd $dir && echo '🚀 Starting $name...' && $cmd" in front window
        end tell
EOF
}

# Start all services
echo "Starting services in separate terminal tabs..."
echo ""

# Terminal 1: Arena Backend
echo "1. Starting Arena Backend (port 4000)..."
open_terminal_tab "$PWD/backend" "npm run dev" "Arena Backend"
sleep 2

# Terminal 2: Metaverse Backend  
echo "2. Starting Metaverse Backend (port 5000)..."
open_terminal_tab "$PWD/metaverse-game/backend" "npm run dev" "Metaverse Backend"
sleep 2

# Terminal 3: Convex Backend
echo "3. Starting Convex Backend..."
open_terminal_tab "$PWD/metaverse-game" "npm run dev:backend" "Convex Backend"
sleep 2

# Terminal 4: Arena Frontend
echo "4. Starting Arena Frontend (port 5173)..."
open_terminal_tab "$PWD/app" "npm run dev" "Arena Frontend"
sleep 2

# Terminal 5: Metaverse Frontend
echo "5. Starting Metaverse Frontend (port 5174)..."
open_terminal_tab "$PWD/metaverse-game" "npm run dev:frontend" "Metaverse Frontend"

echo ""
echo "================================"
echo -e "${GREEN}✅ All services starting!${NC}"
echo ""
echo "📍 Service URLs:"
echo "  Arena Frontend:      http://localhost:5173"
echo "  Arena Backend:       http://localhost:4000/graphql"
echo "  Metaverse Frontend:  http://localhost:5174"
echo "  Metaverse Backend:   http://localhost:5000"
echo "  WebSocket Games:     ws://localhost:4001"
echo ""
echo "💡 Tips:"
echo "  - Wait 10-15 seconds for all services to fully start"
echo "  - Check each terminal tab for any errors"
echo "  - Use './stop-all.sh' to stop all services"
echo ""
echo "🎮 Happy gaming!"