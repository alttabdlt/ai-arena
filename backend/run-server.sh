#!/bin/bash
# Auto-restart wrapper for AI Town backend
# Handles crashes gracefully by restarting after cleanup delay
set -o pipefail

LOGFILE="${LOGFILE:-/tmp/ai-town.log}"
MAX_RESTARTS=50
RESTART_DELAY=5
FAST_RESTART_WINDOW=30  # If crash within 30s, increase delay

restart_count=0
last_start=0

echo "🔄 AI Town auto-restart wrapper started (max restarts: $MAX_RESTARTS)" | tee -a "$LOGFILE"

while [ $restart_count -lt $MAX_RESTARTS ]; do
  last_start=$(date +%s)
  restart_count=$((restart_count + 1))
  
  echo "" | tee -a "$LOGFILE"
  echo "🚀 Starting server (attempt #$restart_count at $(date))" | tee -a "$LOGFILE"
  
  # Run the server
  env FAST_STARTUP="${FAST_STARTUP:-true}" \
      WHEEL_CYCLE_MS="${WHEEL_CYCLE_MS:-900000}" \
      WHEEL_BETTING_MS="${WHEEL_BETTING_MS:-45000}" \
      npx tsx src/index.ts >> "$LOGFILE" 2>&1
  
  EXIT_CODE=$?
  now=$(date +%s)
  runtime=$((now - last_start))
  
  echo "" | tee -a "$LOGFILE"
  echo "💀 Server died (exit code: $EXIT_CODE, runtime: ${runtime}s, attempt: $restart_count) at $(date)" | tee -a "$LOGFILE"
  
  # If it crashed very quickly, back off
  if [ $runtime -lt $FAST_RESTART_WINDOW ]; then
    RESTART_DELAY=$((RESTART_DELAY * 2))
    [ $RESTART_DELAY -gt 60 ] && RESTART_DELAY=60
    echo "⚠️  Quick crash (${runtime}s) — increasing delay to ${RESTART_DELAY}s" | tee -a "$LOGFILE"
  else
    RESTART_DELAY=5  # Reset delay for healthy runs
  fi
  
  echo "⏳ Restarting in ${RESTART_DELAY}s..." | tee -a "$LOGFILE"
  sleep $RESTART_DELAY
done

echo "❌ Max restarts ($MAX_RESTARTS) reached — giving up" | tee -a "$LOGFILE"
