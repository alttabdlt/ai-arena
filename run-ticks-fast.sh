#!/bin/bash
for i in $(seq 1 8); do
  echo "=== Starting tick $i ==="
  curl -s -X POST http://localhost:4000/api/v1/agent-loop/tick --max-time 300 > /dev/null 2>&1
  town=$(curl -s http://localhost:4000/api/v1/towns)
  pct=$(echo "$town" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');const j=JSON.parse(d);console.log(j.towns[0].completionPct+'% built:'+j.towns[0].builtPlots+' invested:'+j.towns[0].totalInvested)" 2>/dev/null)
  echo "📊 $pct"
  sleep 1
done
echo "======== ALL TICKS DONE ========"
