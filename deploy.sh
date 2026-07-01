#!/bin/bash
# deploy.sh — deploy production to SmartApe VPS
# Usage:
#   ./deploy.sh
#   SERVER_USER=deploy SERVER_PORT=22 ./deploy.sh

set -euo pipefail

SERVER_HOST="${SERVER_HOST:-188.127.251.184}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PORT="${SERVER_PORT:-22}"
APP_DIR="${APP_DIR:-/var/www/errani}"

echo "Deploy target: ${SERVER_USER}@${SERVER_HOST}:${APP_DIR}"

echo "Uploading project files..."
COPYFILE_DISABLE=1 tar \
  --exclude='./.git' \
  --exclude='./node_modules' \
  --exclude='node_modules' \
  --exclude='node_modules/*' \
  --exclude='./.next' \
  --exclude='.next' \
  --exclude='.next/*' \
  --exclude='./.vercel' \
  --exclude='./Montserrat' \
  --exclude='./.env' \
  --exclude='./.env.local' \
  --exclude='./.env.prod' \
  --exclude='./.env.production' \
  --exclude='./tsconfig.tsbuildinfo' \
  -czf - . | ssh \
    -p "$SERVER_PORT" \
    -o StrictHostKeyChecking=accept-new \
    "${SERVER_USER}@${SERVER_HOST}" \
    "mkdir -p '$APP_DIR' && tar -xzf - --no-same-owner -C '$APP_DIR'"

echo "Building and reloading on server..."
ssh \
  -p "$SERVER_PORT" \
  -o StrictHostKeyChecking=accept-new \
  "${SERVER_USER}@${SERVER_HOST}" \
  "APP_DIR='$APP_DIR' bash -s" < scripts/deploy-server.sh

echo "Checking domains..."
for url in \
  "https://errani.ru/" \
  "https://www.errani.ru/" \
  "https://admin.errani.ru/admin/login"; do
  code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$url" || true)"
  echo "$url -> HTTP $code"
done
