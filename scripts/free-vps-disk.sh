#!/bin/bash
# Safe disk reclaim on the SmartApe VPS. Does NOT delete DB data or app source.
# Run from Mac: ./scripts/free-vps-disk.sh
# Or install as cron (already on server): /usr/local/bin/errani-free-disk.sh
set -euo pipefail

SERVER_HOST="${SERVER_HOST:-188.127.251.184}"
SERVER_USER="${SERVER_USER:-root}"
APP_DIR="${APP_DIR:-/var/www/errani}"

ssh -o StrictHostKeyChecking=accept-new "${SERVER_USER}@${SERVER_HOST}" bash -s <<EOF
set -euo pipefail
APP='$APP_DIR'

echo "=== before ==="
df -h /

# Caches / logs only — never touch postgres data dirs.
rm -rf /root/.npm/_cacache 2>/dev/null || true
rm -rf /root/.cache/prisma 2>/dev/null || true
rm -rf "\$APP"/.next/cache/images 2>/dev/null || true
find "\$APP"/.next/cache -type f -name '*.pack' -mtime +2 -delete 2>/dev/null || true
apt-get clean 2>/dev/null || true
journalctl --vacuum-size=80M >/dev/null 2>&1 || true

# Truncate oversized PM2 logs (keep files, zero content)
if [ -d /root/.pm2/logs ]; then
  find /root/.pm2/logs -type f -size +20M -exec truncate -s 0 {} \\; 2>/dev/null || true
fi

# Keep at most 3 DB dump files if a backup dir exists
for dir in /var/backups/errani /var/backups/postgresql /root/backups; do
  if [ -d "\$dir" ]; then
    ls -1t "\$dir"/*.{sql,sql.gz,dump,dump.gz} 2>/dev/null | tail -n +4 | xargs -r rm -f
  fi
done

echo "=== after ==="
df -h /
EOF
