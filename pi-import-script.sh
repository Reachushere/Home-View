#!/bin/bash
# Run this on the Pi to import tasks AND partner shifts from Replit dev
# Usage: cd ~/Home-View && bash pi-import-script.sh

PI_URL="http://localhost:5000"

echo "========================================="
echo "  Pi Data Import from Replit Dev"
echo "========================================="
echo ""

# Import tasks
if [ -f "pi-import-tasks.json" ]; then
  TASK_COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('pi-import-tasks.json','utf8')).length)" 2>/dev/null)
  echo "[1/2] Importing $TASK_COUNT tasks..."
  RESULT=$(curl -s -X POST "$PI_URL/api/tasks/bulk-import" \
    -H "Content-Type: application/json" \
    -d "{\"tasks\": $(cat pi-import-tasks.json)}")
  echo "  Result: $RESULT"
else
  echo "[1/2] SKIPPED - pi-import-tasks.json not found"
fi

echo ""

# Import shift schedule
if [ -f "pi-import-shifts.json" ]; then
  SHIFT_COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('pi-import-shifts.json','utf8')).length)" 2>/dev/null)
  echo "[2/2] Importing $SHIFT_COUNT partner shift entries..."
  SHIFTS=$(node -e "
    const shifts = JSON.parse(require('fs').readFileSync('pi-import-shifts.json','utf8'));
    const bulk = shifts.map(s => ({ date: s.date, shiftType: s.shiftType }));
    console.log(JSON.stringify({ bulk }));
  ")
  RESULT=$(curl -s -X POST "$PI_URL/api/shift-schedule" \
    -H "Content-Type: application/json" \
    -d "$SHIFTS")
  IMPORTED=$(echo "$RESULT" | node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{try{console.log(JSON.parse(d.join('')).length,'entries now in schedule')}catch(e){console.log(d.join('').slice(0,200))}})" 2>/dev/null)
  echo "  Result: $IMPORTED"
else
  echo "[2/2] SKIPPED - pi-import-shifts.json not found"
fi

echo ""
echo "========================================="
echo "  Import complete! Refresh your Pi dashboard."
echo "========================================="
