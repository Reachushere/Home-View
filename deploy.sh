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
export GIT_PAGER=cat
git fetch origin
echo ""
echo "Changes incoming:"
git diff --stat HEAD origin/main | tail -30
echo ""

OLD_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "none")

git reset --hard origin/main

echo "[3/7] Generating changelog..."
NEW_HEAD=$(git rev-parse --short HEAD)
DEPLOY_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
if [ "$OLD_HEAD" != "none" ]; then
  RAW_LOG=$(git log --pretty=format:'---COMMIT---%n%s%n%b' "$OLD_HEAD..HEAD" 2>/dev/null | head -80)
else
  RAW_LOG=$(git log --pretty=format:'---COMMIT---%n%s%n%b' -10 2>/dev/null | head -80)
fi

CHANGES_JSON="[]"
if [ -n "$RAW_LOG" ]; then
  CHANGES_JSON=$(echo "$RAW_LOG" | python3 -c "
import sys, json, re
raw = sys.stdin.read()
commits = [c.strip() for c in raw.split('---COMMIT---') if c.strip()]
result = []
for commit in commits:
    lines = [l.strip() for l in commit.splitlines() if l.strip()]
    if not lines:
        continue
    subject = lines[0]
    body_lines = []
    for bl in lines[1:]:
        if bl.startswith('Co-authored-by') or bl.startswith('Signed-off-by'):
            continue
        if bl.startswith('- ') or bl.startswith('* '):
            body_lines.append(bl.lstrip('-* ').strip())
        elif len(bl) > 10 and not bl.startswith('(') and not re.match(r'^[a-f0-9]{7,}$', bl):
            body_lines.append(bl)
    if body_lines:
        result.append(subject + ':\n' + '\n'.join('  - ' + b for b in body_lines[:6]))
    else:
        result.append(subject)
print(json.dumps(result[:15]))
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

echo "[5/7] Building (with swap for memory)..."
if [ ! -f /swapfile ]; then
  echo "  Creating 2GB swap file..."
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
elif ! swapon --show | grep -q /swapfile; then
  echo "  Enabling swap..."
  sudo swapon /swapfile 2>/dev/null || true
fi
NODE_OPTIONS="--max-old-space-size=2048" npm run build

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
