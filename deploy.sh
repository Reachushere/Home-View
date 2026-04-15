#!/bin/bash
set -e

PROJECT_DIR="/home/byhomeyyz/Home-View"
APP_NAME="dashboard"
PORT=5000
PRELOAD="$PROJECT_DIR/preload.cjs"

echo "=== UniCal Deploy ==="
echo ""

cd "$PROJECT_DIR"

echo "[1/6] Stopping old process FIRST..."
pm2 stop "$APP_NAME" 2>/dev/null || true
pm2 delete "$APP_NAME" 2>/dev/null || true
fuser -k $PORT/tcp 2>/dev/null || true
sleep 2

echo "[2/6] Pulling latest from GitHub..."
git fetch origin
echo ""
echo "Changes incoming:"
git diff --stat HEAD origin/main
echo ""
git reset --hard origin/main

echo "[3/6] Installing dependencies..."
npm install --ignore-scripts

echo "[4/6] Building..."
npm run build

echo "[5/6] Verifying build..."
if [ ! -f dist/index.cjs ]; then
  echo "ERROR: Build failed — dist/index.cjs not found!"
  exit 1
fi

echo "[6/6] Starting with PM2..."
pm2 start dist/index.cjs --name "$APP_NAME" --cwd "$PROJECT_DIR" --node-args="-r $PRELOAD"
pm2 save

sleep 3
echo ""
echo "=== Deploy complete! App running at http://172.24.1.204:$PORT ==="
echo "Commit: $(git log --oneline -1)"
