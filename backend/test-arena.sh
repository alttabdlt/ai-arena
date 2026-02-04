#!/bin/bash
# End-to-end test for Arena PvP API
set -e

BASE="http://localhost:4000/api/v1"
PJ="python3 -m json.tool"

TIMESTAMP=$(date +%s)
echo "🏟️  AI Arena — End-to-End Test (run $TIMESTAMP)"
echo "================================"

# Register Shark (unique name per run)
echo -e "\n📝 Registering Shark_$TIMESTAMP..."
SHARK=$(curl -sf -X POST $BASE/agents/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Shark_$TIMESTAMP\",\"archetype\":\"SHARK\",\"modelId\":\"deepseek-v3\",\"systemPrompt\":\"Bluff aggressively\"}")
SHARK_KEY=$(echo $SHARK | python3 -c "import sys,json; print(json.load(sys.stdin)['apiKey'])")
SHARK_ID=$(echo $SHARK | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "  ✅ Shark registered (id: $SHARK_ID)"

# Register Rock
echo -e "\n📝 Registering Rock_$TIMESTAMP..."
ROCK=$(curl -sf -X POST $BASE/agents/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Rock_$TIMESTAMP\",\"archetype\":\"ROCK\",\"modelId\":\"deepseek-v3\",\"systemPrompt\":\"Play tight, fold weak\"}")
ROCK_KEY=$(echo $ROCK | python3 -c "import sys,json; print(json.load(sys.stdin)['apiKey'])")
ROCK_ID=$(echo $ROCK | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "  ✅ Rock registered (id: $ROCK_ID)"

# Check bankrolls
echo -e "\n💰 Starting bankrolls:"
curl -sf $BASE/agents | python3 -c "
import sys,json
for a in json.load(sys.stdin):
    print(f'  {a[\"name\"]}: {a[\"bankroll\"]} \$ARENA (ELO {a[\"elo\"]})')
"

# Create RPS match
echo -e "\n⚔️  SharkBot creates RPS match (wager: 500 \$ARENA)..."
MATCH=$(curl -sf -X POST $BASE/matches/create \
  -H "Authorization: Bearer $SHARK_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"gameType\":\"RPS\",\"wagerAmount\":500,\"opponentId\":\"$ROCK_ID\"}")
MATCH_ID=$(echo $MATCH | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "  ✅ Match created: $MATCH_ID"

# Check match state
echo -e "\n🎮 Match state:"
STATE=$(curl -sf $BASE/matches/$MATCH_ID/state -H "Authorization: Bearer $SHARK_KEY")
echo $STATE | python3 -c "
import sys,json
s = json.load(sys.stdin)
print(f'  Status: {s[\"status\"]}')
print(f'  Game: {s[\"gameType\"]}')
print(f'  Wager: {s[\"wagerAmount\"]} per player')
print(f'  Pot: {s[\"totalPot\"]}')
print(f'  Current turn: {s[\"currentTurnId\"][:12]}...')
"

# Check bankrolls after wager deduction
echo -e "\n💸 Bankrolls after wager:"
curl -sf $BASE/agents | python3 -c "
import sys,json
for a in json.load(sys.stdin):
    print(f'  {a[\"name\"]}: {a[\"bankroll\"]} \$ARENA (inMatch: {a[\"isInMatch\"]})')
"

# Play RPS rounds — manual moves (not AI, to test game logic)
echo -e "\n🎲 Playing RPS rounds manually..."

# Determine who goes first
FIRST_TURN=$(echo $STATE | python3 -c "import sys,json; print(json.load(sys.stdin)['currentTurnId'])")

if [ "$FIRST_TURN" = "$SHARK_ID" ]; then
  FIRST_KEY=$SHARK_KEY
  FIRST_NAME="SharkBot"
  SECOND_KEY=$ROCK_KEY
  SECOND_NAME="RockSolid"
else
  FIRST_KEY=$ROCK_KEY
  FIRST_NAME="RockSolid"
  SECOND_KEY=$SHARK_KEY
  SECOND_NAME="SharkBot"
fi

# Round 1: First plays rock, second plays scissors → first wins
echo "  Round 1: $FIRST_NAME plays rock..."
R1A=$(curl -sf -X POST $BASE/matches/$MATCH_ID/move \
  -H "Authorization: Bearer $FIRST_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"rock"}')
echo "  Round 1: $SECOND_NAME plays scissors..."
R1B=$(curl -sf -X POST $BASE/matches/$MATCH_ID/move \
  -H "Authorization: Bearer $SECOND_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"scissors"}')
COMPLETE=$(echo $R1B | python3 -c "import sys,json; print(json.load(sys.stdin).get('isComplete', False))")
echo "  ✅ Round 1 complete (game over: $COMPLETE)"

# Round 2: First plays paper, second plays rock → first wins
echo "  Round 2: $FIRST_NAME plays paper..."
R2A=$(curl -sf -X POST $BASE/matches/$MATCH_ID/move \
  -H "Authorization: Bearer $FIRST_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"paper"}')
echo "  Round 2: $SECOND_NAME plays rock..."
R2B=$(curl -sf -X POST $BASE/matches/$MATCH_ID/move \
  -H "Authorization: Bearer $SECOND_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"rock"}')
COMPLETE=$(echo $R2B | python3 -c "import sys,json; print(json.load(sys.stdin).get('isComplete', False))")
echo "  ✅ Round 2 complete (game over: $COMPLETE)"

# Round 3: First plays scissors, second plays paper → first wins (3-0, Bo5 over)
echo "  Round 3: $FIRST_NAME plays scissors..."
R3A=$(curl -sf -X POST $BASE/matches/$MATCH_ID/move \
  -H "Authorization: Bearer $FIRST_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"scissors"}')
echo "  Round 3: $SECOND_NAME plays paper..."
R3B=$(curl -sf -X POST $BASE/matches/$MATCH_ID/move \
  -H "Authorization: Bearer $SECOND_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"paper"}')
COMPLETE=$(echo $R3B | python3 -c "import sys,json; print(json.load(sys.stdin).get('isComplete', False))")
echo "  ✅ Round 3 complete (game over: $COMPLETE)"

# Check result
echo -e "\n🏆 Match result:"
RESULT=$(curl -sf $BASE/matches/$MATCH_ID/state -H "Authorization: Bearer $SHARK_KEY")
echo $RESULT | python3 -c "
import sys,json
s = json.load(sys.stdin)
print(f'  Status: {s[\"status\"]}')
gs = s.get('gameState', {})
if 'scores' in gs:
    for pid, score in gs['scores'].items():
        name = s['player1']['name'] if pid == s['player1']['id'] else (s['player2']['name'] if s.get('player2') and pid == s['player2']['id'] else pid[:12])
        print(f'  {name}: {score} pts')
if 'history' in gs:
    for h in gs['history']:
        print(f'  Round {h[\"round\"]}: {h[\"moves\"]} → winner: {(h[\"winner\"] or \"draw\")[:12]}')
"

# Check final bankrolls and ELO
echo -e "\n💰 Final state:"
curl -sf $BASE/agents | python3 -c "
import sys,json
for a in json.load(sys.stdin):
    print(f'  {a[\"name\"]}: {a[\"bankroll\"]} \$ARENA | ELO {a[\"elo\"]} | {a[\"wins\"]}W-{a[\"losses\"]}L | cost: \${a[\"apiCostCents\"]/100:.2f}')
"

# Check leaderboard
echo -e "\n🏅 Leaderboard:"
curl -sf $BASE/leaderboard | python3 -c "
import sys,json
for e in json.load(sys.stdin):
    print(f'  #{e[\"rank\"]} {e[\"name\"]} — ELO {e[\"elo\"]} | {e[\"wins\"]}W-{e[\"losses\"]}L | profit: {e[\"profit\"]:+d}')
"

echo -e "\n✅ End-to-end test complete!"
