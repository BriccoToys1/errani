#!/bin/bash
# Run from your Mac (SSH must work): restores PM2 env from .env and prints DB status.
set -euo pipefail

SERVER_HOST="${SERVER_HOST:-188.127.251.184}"
SERVER_USER="${SERVER_USER:-root}"
APP_DIR="${APP_DIR:-/var/www/errani}"

ssh -o StrictHostKeyChecking=accept-new "${SERVER_USER}@${SERVER_HOST}" bash -s <<EOF
set -euo pipefail
cd '$APP_DIR'
echo "=== .env present? ==="
test -f .env && echo yes || echo MISSING
grep -E '^DATABASE_URL=' .env | sed -E 's/:[^:@]+@/:***@/; s/\?.*/?.../'
echo "=== node db check ==="
node <<'NODE'
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    console.log(JSON.stringify({
      products: await p.product.count(),
      active: await p.product.count({ where: { isActive: true } }),
      media: await p.mediaAsset.count(),
      orders: await p.order.count(),
    }));
  } catch (e) {
    console.error('DB_ERROR', e.message || e);
    process.exitCode = 1;
  } finally {
    await p.\$disconnect().catch(() => {});
  }
})();
NODE
echo "=== reload pm2 with ecosystem dotenv ==="
pm2 startOrReload ecosystem.config.js --update-env
pm2 save
pm2 logs errani-site --lines 30 --nostream || true
EOF
