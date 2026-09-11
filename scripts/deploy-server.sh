#!/bin/bash
# Runs on the VPS from /var/www/errani.

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/errani}"
APP_NAME="${APP_NAME:-errani-site}"

cd "$APP_DIR"

if [ ! -f ".env" ]; then
  echo "Missing $APP_DIR/.env"
  echo "Create it from the production environment values before deploying."
  exit 1
fi

echo "Installing dependencies..."
npm ci --ignore-scripts

echo "Generating Prisma client..."
npx prisma generate

echo "Building Next.js app..."
npm run build

echo "Syncing nginx config..."
install -m 644 "$APP_DIR/nginx.conf" /etc/nginx/sites-available/errani.ru
ln -sf /etc/nginx/sites-available/errani.ru /etc/nginx/sites-enabled/errani.ru
nginx -t
systemctl reload nginx || service nginx reload

echo "Reloading PM2..."
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js --update-env
fi

pm2 save
pm2 status
