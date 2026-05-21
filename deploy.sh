#!/bin/bash
# deploy.sh — production deploy на Vercel
# Использование: ./deploy.sh

set -euo pipefail

LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_22_NPM="$HOME/.nvm/versions/node/v22.22.2/bin/npm"
NODE_22_NPX="$HOME/.nvm/versions/node/v22.22.2/bin/npx"

cd "$LOCAL_DIR"

if [ ! -x "$NODE_22_NPX" ]; then
  echo "Не найден npx: $NODE_22_NPX"
  exit 1
fi

echo "Проверка зависимостей и lockfile..."
if [ -x "$NODE_22_NPM" ]; then
  "$NODE_22_NPM" install --ignore-scripts
fi

echo "Локальная сборка..."
./node_modules/.bin/prisma generate
./node_modules/.bin/next build --webpack

echo "Деплой на Vercel production..."
"$NODE_22_NPX" vercel@latest deploy --prod --yes

echo "Проверка доменов..."
for url in \
  "https://errani.ru/" \
  "https://www.errani.ru/" \
  "https://admin.errani.ru/admin/login"; do
  code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$url" || true)"
  echo "$url -> HTTP $code"
done
