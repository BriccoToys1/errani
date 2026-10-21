#!/bin/bash
# Run on the VPS: bash /var/www/errani/scripts/diagnose-prod.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== host ==="
hostname
date

echo "=== DATABASE_URL host ==="
grep -E '^DATABASE_URL=' .env | sed -E 's/:[^:@]+@/:***@/; s/\?.*/?.../'

echo "=== prisma ping ==="
node <<'NODE'
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const products = await p.product.count();
    const active = await p.product.count({ where: { isActive: true } });
    const media = await p.mediaAsset.count();
    const withData = await p.$queryRaw`SELECT COUNT(*)::int AS c FROM "MediaAsset" WHERE data IS NOT NULL AND octet_length(data) > 0`;
    const orders = await p.order.count();
    console.log(JSON.stringify({ products, active, media, withData, orders }, null, 2));
    const names = await p.product.findMany({
      where: { isActive: true },
      select: { name: true, slug: true, image: true },
      orderBy: { sortOrder: 'asc' },
    });
    console.log(names);
  } catch (e) {
    console.error('PRISMA_ERROR', e);
    process.exitCode = 1;
  } finally {
    await p.$disconnect();
  }
})();
NODE

echo "=== media on disk ==="
find public/media -type f 2>/dev/null | wc -l
ls public/media/products/2026/05 2>/dev/null | wc -l || true

echo "=== pm2 recent errors ==="
pm2 logs errani-site --lines 60 --nostream 2>&1 | tail -60
