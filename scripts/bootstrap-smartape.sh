#!/bin/bash
# First-time SmartApe VPS setup for errani.ru.
# Run as root on Ubuntu 24.04.

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/errani}"
REPO_URL="${REPO_URL:-git@github.com:BriccoToys1/errani.git}"

apt update
apt install -y git curl nginx certbot python3-certbot-nginx

if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q '^v22\.'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt install -y nodejs
fi

npm install -g pm2

mkdir -p "$(dirname "$APP_DIR")"

if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

if [ ! -f ".env" ]; then
  cat > .env.example.server <<'ENV'
DATABASE_URL=
JWT_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD=
RESEND_API_KEY=
YUKASSA_SHOP_ID=
YUKASSA_SECRET_KEY=
NEXT_PUBLIC_SITE_URL=https://errani.ru
ENV
  echo "Created $APP_DIR/.env.example.server"
  echo "Create $APP_DIR/.env before building."
  exit 1
fi

npm ci --ignore-scripts
npx prisma generate
npm run build

cp "$APP_DIR/nginx.conf" /etc/nginx/sites-available/errani.ru
ln -sf /etc/nginx/sites-available/errani.ru /etc/nginx/sites-enabled/errani.ru
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

pm2 start ecosystem.config.js --update-env || pm2 reload ecosystem.config.js --update-env
pm2 save

echo "Bootstrap complete. Issue SSL after DNS points to this server:"
echo "certbot --nginx -d errani.ru -d www.errani.ru -d admin.errani.ru"
