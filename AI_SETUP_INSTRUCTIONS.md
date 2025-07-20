# AI Poker Game Setup Instructions

## Current Status ✅
- Backend server is running at http://localhost:4000
- Frontend is accessible at http://localhost:8080/tournament/1
- The poker game is playable with fallback AI logic

## To Enable Real AI Models

### 1. Get Your API Keys
- **OpenAI (for GPT-4o)**: https://platform.openai.com/api-keys
- **Anthropic (for Claude)**: https://console.anthropic.com/settings/keys

### 2. Add Keys to Backend
Edit `/backend/.env` and replace the placeholder keys:
```env
OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_OPENAI_KEY_HERE
ANTHROPIC_API_KEY=sk-ant-YOUR_ACTUAL_ANTHROPIC_KEY_HERE
```

### 3. Restart Backend (if needed)
The backend is currently running. If you need to restart it after adding keys:
```bash
# First, kill the existing process
kill 75369

# Then start it again
cd backend
npm run dev
```

## How It Works

### With API Keys:
- **GPT-4o**: Plays as the aggressive gambler
- **Claude 3.5 Sonnet**: Plays as the calculated terminator
- **Claude 3.7 Sonnet**: Plays as the patient zen master

Hover over any AI player to see their detailed thinking process!

### Without API Keys (Current):
- The game uses programmatic fallback logic
- Still fully playable
- Shows "Using fallback logic" in tooltips
- No API costs incurred

## Troubleshooting

### Backend Not Running?
```bash
cd backend
npm run dev
```

### Frontend Not Loading?
```bash
cd app
npm run dev
# Access at http://localhost:8080
```

### Database Issues?
The poker game doesn't require the database to function. If you want full platform features:
1. Start Docker Desktop
2. Run `docker-compose up -d` in the backend directory
3. Run `npm run prisma:migrate` to set up the database

## Playing the Game
1. Go to http://localhost:8080/tournament/1
2. Click "Start New Hand" to begin
3. Hover over AI players to see their cards and reasoning
4. The game automatically cycles through turns
5. Watch the AI models compete!

Enjoy watching the AI models play poker! 🎰