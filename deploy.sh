#!/bin/bash
# deploy.sh — деплой одной командой с локального компа
# Использование: ./deploy.sh
#                ./deploy.sh "сообщение коммита"

set -e

SSH_KEY="$HOME/.ssh/errani-deploy/key"
SSH_HOST="root@168.222.143.43"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o ServerAliveInterval=30"
REMOTE_DIR="/var/www/errani-new"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_PATH="/root/.nvm/versions/node/v20.20.2/bin"

cd "$LOCAL_DIR"

# ── 1. Коммит незакоммиченных изменений ──────────────────────────────────────
if ! git diff --quiet || ! git diff --cached --quiet; then
  MSG="${1:-deploy: $(date '+%Y-%m-%d %H:%M')}"
  echo "📝 Коммит: $MSG"
  git add -A
  git commit -m "$MSG" || true
fi

# ── 2. Пуш в GitHub (таймаут 15с, не блокирует деплой при ошибке) ────────────
echo "☁️  GitHub push..."
timeout 15 git push origin main --no-verify 2>/dev/null && echo "   ✓ OK" || echo "   ⚠️  пропущен (продолжаем)"

# ── 3. Rsync файлов на сервер ─────────────────────────────────────────────────
echo "📦 Отправка файлов на сервер..."
rsync -az \
  -e "ssh $SSH_OPTS" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='memory' \
  --exclude='txt.md' \
  "$LOCAL_DIR/" \
  "$SSH_HOST:$REMOTE_DIR/"
echo "   ✓ файлы отправлены"

# ── 4. Сборка и перезапуск на сервере ────────────────────────────────────────
echo "🔨 Сборка на сервере (1-2 мин)..."
ssh $SSH_OPTS "$SSH_HOST" /bin/bash <<ENDSSH
set -e
export PATH=$NODE_PATH:\$PATH
cd $REMOTE_DIR
echo "🔐 Нормализация прав для public..."
find public -type d -exec chmod 755 {} +
find public -type f -exec chmod 644 {} +
echo "🗄️  Синхронизация схемы БД..."
npm run db:push 2>&1 | tail -12
npm run build 2>&1 | tail -15
echo "🔄 Перезапуск PM2..."
pm2 reload ecosystem.config.js --update-env
sleep 2
pm2 status
ENDSSH

# ── 5. Проверка ───────────────────────────────────────────────────────────────
echo ""
echo "🔍 Проверка сайта..."
sleep 4

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://errani.ru/ 2>/dev/null || echo "err")
API=$(curl -s --max-time 15 "https://errani.ru/api/products?showAll=true" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d)} products')" 2>/dev/null || echo "?")

if [ "$HTTP" = "200" ]; then
  echo "✅ Готово!"
  echo "   Сайт: HTTP $HTTP"
  echo "   API:  $API"
else
  echo "⚠️  Сайт вернул HTTP $HTTP"
  echo "   Логи: ssh $SSH_OPTS $SSH_HOST 'export PATH=$NODE_PATH:\$PATH && pm2 logs errani-site --lines 30 --nostream'"
fi
