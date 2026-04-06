#!/bin/bash
# Fix TTS audio to save locally instead of Replit object storage
# Run on Pi: bash ~/Home-View/fix-pi-tts.sh

FILE=~/Home-View/server/routes.ts

# Create local TTS audio directory
mkdir -p ~/Home-View/dist/public/tts-audio

# 1. Fix generateAndSaveTTSAudio to save locally
# Replace the object storage check with local filesystem
sed -i 's|const publicPath = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split.*|const _fs = require("fs"); const _path = require("path"); const _ttsDir = _path.join(process.cwd(), "dist", "public", "tts-audio"); if (!_fs.existsSync(_ttsDir)) _fs.mkdirSync(_ttsDir, { recursive: true });|' "$FILE"

# Remove the "throw" line for PUBLIC_OBJECT_SEARCH_PATHS
sed -i '/throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not configured");/d' "$FILE"
sed -i '/if (!publicPath) {/{N;/^\s*}$/d}' "$FILE"

echo "Patch applied — verifying..."
grep -n "const _ttsDir" "$FILE" | head -3
echo "Done. Now run: cd ~/Home-View && npm run build && sudo systemctl restart unical"
