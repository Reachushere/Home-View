#!/bin/bash
set -e

PROJECT_DIR="/home/byhomeyyz/Home-View"
APP_NAME="dashboard"
PORT=5000
PRELOAD="$PROJECT_DIR/preload.cjs"

echo "=== UniCal Deploy ==="
echo ""

cd "$PROJECT_DIR"

echo "[1/5] Pulling latest from GitHub..."
git pull origin main

echo "[2/5] Installing dependencies..."
npm install --ignore-scripts

echo "[3/5] Building..."
npm run build

echo "[4/5] Stopping old process..."
fuser -k $PORT/tcp 2>/dev/null || true
sleep 2

echo "[5/5] Starting with PM2..."
pm2 delete "$APP_NAME" 2>/dev/null || true
pm2 start dist/index.cjs --name "$APP_NAME" --cwd "$PROJECT_DIR" --node-args="-r $PRELOAD"
pm2 save

echo ""
echo "=== Deploy complete! App running at http://172.24.1.204:$PORT ==="
