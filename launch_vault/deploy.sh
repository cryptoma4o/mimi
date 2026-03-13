#!/bin/bash
set -e

REMOTE="root@45.67.35.145"
REMOTE_DIR="/var/www/mimi"

echo "=== MiMi Deploy ==="

# 1. Build frontend
echo "[1/3] Building frontend..."
cd "$(dirname "$0")/app/web"
npm run build

# 2. Sync standalone build to VPS
echo "[2/3] Syncing to VPS..."
rsync -avz --delete .next/standalone/ "$REMOTE:$REMOTE_DIR/"
rsync -avz .next/static/ "$REMOTE:$REMOTE_DIR/.next/static/"
rsync -avz public/ "$REMOTE:$REMOTE_DIR/public/" 2>/dev/null || true

# 3. Restart on VPS
echo "[3/3] Restarting..."
ssh "$REMOTE" "cd $REMOTE_DIR && pm2 restart mimi"

echo ""
echo "Deployed to https://moono.me"
