#!/bin/bash

# AI Arena - Stop All Services
# This script stops all components of the AI Arena platform

echo "🛑 Stopping AI Arena Platform..."
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Kill processes by port
kill_port() {
    local port=$1
    local name=$2
    
    echo -e "${YELLOW}Stopping $name (port $port)...${NC}"
    lsof -ti:$port | xargs kill -9 2>/dev/null
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $name stopped${NC}"
    else
        echo -e "   $name was not running"
    fi
}

# Kill Node processes related to AI Arena
echo -e "${YELLOW}Stopping all AI Arena Node processes...${NC}"
pkill -f "node.*ai-arena" 2>/dev/null
pkill -f "ts-node.*ai-arena" 2>/dev/null
pkill -f "convex dev" 2>/dev/null

# Kill specific ports
kill_port 4000 "Arena Backend"
kill_port 4001 "WebSocket Server"
kill_port 5000 "Metaverse Backend"
kill_port 5173 "Arena Frontend"
kill_port 5174 "Metaverse Frontend"

# Optional: Stop Redis (comment out if you want to keep Redis running)
read -p "Stop Redis server? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Stopping Redis...${NC}"
    redis-cli shutdown 2>/dev/null
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Redis stopped${NC}"
    else
        echo -e "   Redis was not running"
    fi
fi

echo ""
echo "================================"
echo -e "${GREEN}✅ All AI Arena services stopped${NC}"
echo ""
echo "💡 To restart, run: ./start-all.sh"