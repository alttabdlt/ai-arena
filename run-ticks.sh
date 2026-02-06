#!/bin/bash
# Run N ticks sequentially and report progress
for i in $(seq 1 5); do
  echo "=== TICK $i ==="
  result=$(curl -s -X POST http://localhost:4000/api/v1/agent-loop/tick --max-time 300)
  echo "$result" | node -e "
    const d=require('fs').readFileSync('/dev/stdin','utf8');
    try {
      const j=JSON.parse(d);
      const r=j.results||[];
      r.forEach(a=>{
        const emoji=a.success?'✅':'❌';
        console.log(emoji+' '+a.agentName+' ['+a.action.type+']');
      });
    } catch(e) { console.log('Parse error:', d.slice(0,200)); }
  " 2>/dev/null
  
  # Check town progress
  town=$(curl -s http://localhost:4000/api/v1/towns)
  echo "$town" | node -e "
    const d=require('fs').readFileSync('/dev/stdin','utf8');
    const j=JSON.parse(d);
    const t=j.towns[0];
    console.log('📊 Progress: '+t.completionPct+'% — Built:'+t.builtPlots+' Invested: '+t.totalInvested+' ARENA');
  " 2>/dev/null
  echo ""
  sleep 2
done
echo "======== DONE ========"
