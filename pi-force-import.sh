#!/bin/bash
REPLIT="https://a0c66905-cda9-4d99-8753-e071287d758d-00-2dwx3zdd04dyo.picard.replit.dev"
PI="http://localhost:5000"

echo "=== STEP 1: Import Tasks ==="
echo "Fetching tasks from Replit..."
TASKS=$(curl -s "$REPLIT/api/tasks")
COUNT=$(echo "$TASKS" | node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>console.log(JSON.parse(d.join('')).length))")
echo "Got $COUNT tasks from Replit"

echo "Sending to Pi bulk-import endpoint..."
RESULT=$(curl -s -X POST "$PI/api/tasks/bulk-import" \
  -H "Content-Type: application/json" \
  -d "{\"tasks\": $TASKS}")
echo "Bulk import result: $RESULT"

echo ""
echo "=== STEP 2: Import Shifts ==="
echo "Fetching shifts from Replit..."
SHIFTS=$(curl -s "$REPLIT/api/shift-schedule")
SCOUNT=$(echo "$SHIFTS" | node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>console.log(JSON.parse(d.join('')).length))")
echo "Got $SCOUNT shifts from Replit"

echo "Importing shifts one by one..."
SCREATED=0
SSKIPPED=0
PI_SHIFTS=$(curl -s "$PI/api/shift-schedule")
for row in $(echo "$SHIFTS" | node -e "
const d=[];
process.stdin.on('data',c=>d.push(c));
process.stdin.on('end',()=>{
  const shifts=JSON.parse(d.join(''));
  shifts.forEach(s=>console.log(s.date+'|'+s.shiftType));
})"); do
  DATE=$(echo "$row" | cut -d'|' -f1)
  TYPE=$(echo "$row" | cut -d'|' -f2)
  EXISTS=$(echo "$PI_SHIFTS" | node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{const s=JSON.parse(d.join(''));console.log(s.some(x=>x.date==='$DATE')?'yes':'no')})")
  if [ "$EXISTS" = "yes" ]; then
    SSKIPPED=$((SSKIPPED+1))
  else
    curl -s -X POST "$PI/api/shift-schedule" \
      -H "Content-Type: application/json" \
      -d "{\"date\":\"$DATE\",\"shiftType\":\"$TYPE\"}" > /dev/null
    SCREATED=$((SCREATED+1))
  fi
done
echo "Shifts: $SCREATED created, $SSKIPPED already existed"

echo ""
echo "=== STEP 3: Verify ==="
PI_TASK_COUNT=$(curl -s "$PI/api/tasks" | node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>console.log(JSON.parse(d.join('')).length))")
PI_SHIFT_COUNT=$(curl -s "$PI/api/shift-schedule" | node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>console.log(JSON.parse(d.join('')).length))")
echo "Pi now has: $PI_TASK_COUNT tasks, $PI_SHIFT_COUNT shifts"
echo "Replit has:  $COUNT tasks, $SCOUNT shifts"
if [ "$PI_TASK_COUNT" -ge "$COUNT" ] && [ "$PI_SHIFT_COUNT" -ge "$SCOUNT" ]; then
  echo "✅ SUCCESS - All data transferred and verified!"
else
  echo "⚠️  Counts don't match - check errors above"
fi
