#!/bin/bash
set -e

PROJECT_DIR="/home/byhomeyyz/Home-View"
APP_NAME="dashboard"
PORT=5000
PRELOAD="$PROJECT_DIR/preload.cjs"

echo "=== UniCal Deploy ==="
echo ""

cd "$PROJECT_DIR"

echo "[1/7] Stopping old process FIRST..."
pm2 stop "$APP_NAME" 2>/dev/null || true
pm2 delete "$APP_NAME" 2>/dev/null || true
fuser -k $PORT/tcp 2>/dev/null || true
sleep 2

echo "[2/7] Pulling latest from GitHub..."
git fetch origin
echo ""
echo "Changes incoming:"
git diff --stat HEAD origin/main
echo ""

OLD_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "none")

git reset --hard origin/main

echo "[3/7] Generating changelog..."
NEW_HEAD=$(git rev-parse --short HEAD)
DEPLOY_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
if [ "$OLD_HEAD" != "none" ]; then
  CHANGES=$(git log --pretty=format:'%s' "$OLD_HEAD..HEAD" 2>/dev/null | head -15)
else
  CHANGES=$(git log --pretty=format:'%s' -10 2>/dev/null)
fi

CHANGES_JSON="[]"
if [ -n "$CHANGES" ]; then
  CHANGES_JSON=$(echo "$CHANGES" | python3 -c "
import sys, json
lines = [l.strip() for l in sys.stdin if l.strip()]
print(json.dumps(lines))
" 2>/dev/null || echo "[]")
fi

cat > "$PROJECT_DIR/changelog-latest.json" <<EOFCL
{
  "version": "$NEW_HEAD",
  "deployedAt": "$DEPLOY_TIME",
  "changes": $CHANGES_JSON
}
EOFCL

echo "Changelog written: $NEW_HEAD ($DEPLOY_TIME)"

echo "[4/7] Installing dependencies..."
npm install --ignore-scripts

echo "[5/7] Building..."
npm run build

echo "[6/7] Verifying build..."
if [ ! -f dist/index.cjs ]; then
  echo "ERROR: Build failed — dist/index.cjs not found!"
  exit 1
fi

echo "[7/7] Starting with PM2..."
pm2 start dist/index.cjs --name "$APP_NAME" --cwd "$PROJECT_DIR" --node-args="-r $PRELOAD"
pm2 save

sleep 3
echo ""
echo "=== Deploy complete! App running at http://172.24.1.204:$PORT ==="
echo "Commit: $(git log --oneline -1)"
