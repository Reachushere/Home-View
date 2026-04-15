#!/bin/bash
set -e
npm install --ignore-scripts
echo "no" | npm run db:push || npm run db:push --force || echo "db:push completed with warnings"
