#!/bin/bash
# Run ON the VPS (or via: ssh root@188.127.251.184 'bash -s' < scripts/fix-vps-postgres.sh)
# Starts local PostgreSQL and reloads the app. Does not drop or migrate data.
set -euo pipefail

echo "=== disk / memory ==="
df -h / | tail -1
free -m | head -2

echo "=== find postgres service ==="
if systemctl list-unit-files | grep -q '^postgresql\.service'; then
  UNIT=postgresql
elif systemctl list-units --all | grep -q 'postgresql@'; then
  UNIT=$(systemctl list-units --all --type=service --no-legend 'postgresql@*' | awk '{print $1}' | head -1)
else
  UNIT=postgresql
fi
echo "unit=$UNIT"

echo "=== status before ==="
systemctl status "$UNIT" --no-pager -l 2>&1 | head -25 || true

echo "=== start ==="
systemctl start "$UNIT" || true
systemctl enable "$UNIT" 2>/dev/null || true
sleep 2
systemctl is-active "$UNIT" || {
  echo "FAILED to start. Last logs:"
  journalctl -u "$UNIT" -n 50 --no-pager || journalctl -u postgresql -n 50 --no-pager || true
  exit 1
}

echo "=== listening on 5432? ==="
ss -ltnp | grep 5432 || true

echo "=== app DATABASE_URL host (redacted) ==="
grep -E '^DATABASE_URL=' /var/www/errani/.env | sed -E 's/:[^:@]+@/:***@/; s/\?.*/?.../'

echo "=== reload app ==="
cd /var/www/errani
pm2 reload ecosystem.config.js --update-env || pm2 restart errani-site
sleep 2

echo "=== health ==="
curl -sS http://127.0.0.1:3000/api/health/db; echo
curl -sS -D - -o /tmp/p.json http://127.0.0.1:3000/api/products?showAll=true | tr -d '\r' | grep -iE 'HTTP/|x-products' || true
python3 - <<'PY' 2>/dev/null || true
import json
d=json.load(open('/tmp/p.json'))
items=d if isinstance(d,list) else []
print('products', len(items), [p.get('name') for p in items[:8]])
PY

echo "Done. If health still fails, paste this whole output."
