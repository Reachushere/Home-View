#!/bin/bash
# Sync tasks and shifts from sync-data.json to local Pi database
# Run from ~/Home-View on the Pi after pulling

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_FILE="$SCRIPT_DIR/sync-data.json"

if [ ! -f "$DATA_FILE" ]; then
  echo "ERROR: sync-data.json not found. Pull from git first."
  exit 1
fi

echo "=== Syncing tasks from dev to Pi ==="

# Import tasks via bulk-import endpoint
echo "Importing tasks..."
TASKS=$(node -e "const d=JSON.parse(require('fs').readFileSync('$DATA_FILE','utf8'));console.log(JSON.stringify({tasks:d.tasks}))")
TASK_RESULT=$(curl -s -X POST http://localhost:5000/api/tasks/bulk-import \
  -H "Content-Type: application/json" \
  -d "$TASKS")
echo "Task import result: $TASK_RESULT"

# Import shifts via bulk endpoint
echo "Importing shifts..."
SHIFTS=$(node -e "const d=JSON.parse(require('fs').readFileSync('$DATA_FILE','utf8'));console.log(JSON.stringify({bulk:d.shifts}))")
SHIFT_RESULT=$(curl -s -X POST http://localhost:5000/api/shift-schedule \
  -H "Content-Type: application/json" \
  -d "$SHIFTS")
echo "Shift import result: $(echo $SHIFT_RESULT | node -e "const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{const t=JSON.parse(d.join(''));console.log('Total shifts after import:',t.length)})")"

echo ""
echo "=== Sync complete ==="
echo "Verify: curl -s http://localhost:5000/api/tasks | node -e \"const d=[];process.stdin.on('data',c=>d.push(c));process.stdin.on('end',()=>{console.log('Total tasks:',JSON.parse(d.join('')).length)})\""
