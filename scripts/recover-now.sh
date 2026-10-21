#!/bin/bash
# One-shot recovery: deploy code + reload PM2 env + verify DB/API.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== 1/3 deploy ==="
./deploy.sh

echo "=== 2/3 db check on server ==="
ssh -o StrictHostKeyChecking=accept-new root@188.127.251.184 'bash -s' <<'EOF'
set -euo pipefail
cd /var/www/errani
echo "DATABASE_URL host:"
grep -E '^DATABASE_URL=' .env | sed -E 's/:[^:@]+@/:***@/; s/\?.*/?.../'
node <<'NODE'
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    console.log(JSON.stringify({
      ok: true,
      products: await p.product.count(),
      active: await p.product.count({ where: { isActive: true } }),
      media: await p.mediaAsset.count(),
      orders: await p.order.count(),
    }));
  } catch (e) {
    console.error('DB_ERROR:', e.message || e);
    process.exitCode = 1;
  } finally {
    await p.$disconnect().catch(() => {});
  }
})();
NODE
pm2 startOrReload ecosystem.config.js --update-env
pm2 save
EOF

echo "=== 3/3 live checks ==="
curl -sS "https://errani.ru/api/health/db"; echo
curl -sS -D - -o /tmp/errani-prods.json "https://errani.ru/api/products?showAll=true" | tr -d '\r' | grep -iE 'HTTP/|x-products'
python3 - <<'PY'
import json
d=json.load(open('/tmp/errani-prods.json'))
items=d if isinstance(d,list) else []
print('products', len(items))
print([p.get('name') for p in items[:10]])
PY

echo "Done."
