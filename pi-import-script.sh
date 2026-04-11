#!/bin/bash
# Run this on the Pi to import tasks from Replit dev
# Usage: cd ~/Home-View && bash pi-import-script.sh

PI_URL="http://localhost:5000"

echo "Importing tasks to Pi..."
RESULT=$(curl -s -X POST "$PI_URL/api/tasks/bulk-import" \
  -H "Content-Type: application/json" \
  -d "{\"tasks\": $(cat pi-import-tasks.json)}")

echo "Result: $RESULT"
echo ""
echo "Done! Refresh your Pi dashboard to see the tasks."
