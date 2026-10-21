#!/bin/bash
# Runs on the VPS from /var/www/errani.

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/errani}"
APP_NAME="${APP_NAME:-errani-site}"

cd "$APP_DIR"

# Remove deleted local modules that tar extract does not wipe on the server.
rm -rf \
  src/app/admin/phone \
  src/app/admin/sms \
  src/app/admin/ContactCard.tsx \
  src/app/api/admin/phone \
  src/app/api/admin/sms \
  src/app/api/admin/contact \
  src/app/api/admin/events \
  src/lib/twilio.ts \
  src/lib/contact-lookup.ts

if [ ! -f ".env" ]; then
  echo "Missing $APP_DIR/.env"
  echo "Create it from the production environment values before deploying."
  exit 1
fi

echo "Installing dependencies..."
# VPS ↔ registry.npmjs.org sometimes times out; retry with longer fetch window.
npm config set fetch-retries 5
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000
npm config set fetch-timeout 300000
ok=0
for attempt in 1 2 3 4 5; do
  if npm ci --ignore-scripts; then
    ok=1
    break
  fi
  echo "npm ci failed (attempt ${attempt}/5), waiting before retry..."
  sleep $((attempt * 15))
done
if [ "$ok" -ne 1 ]; then
  echo "npm ci failed after 5 attempts (network to registry)."
  exit 1
fi

echo "Generating Prisma client..."
npx prisma generate

echo "Applying additive SQL (admin redesign columns)..."
npx tsx scripts/apply-sql.ts prisma/sql/2026-10-07-admin-redesign.sql || {
  echo "WARNING: additive SQL failed — app will retry via ensureAdminSchema on first request"
}

echo "DB connectivity check..."
node <<'NODE' || true
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const products = await p.product.count();
    const media = await p.mediaAsset.count();
    const emails = await p.adminEmail.count();
    console.log(JSON.stringify({ ok: true, products, media, emails }));
  } catch (e) {
    console.error('DB_CHECK_FAILED', e && e.message ? e.message : e);
  } finally {
    await p.$disconnect().catch(() => {});
  }
})();
NODE

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
