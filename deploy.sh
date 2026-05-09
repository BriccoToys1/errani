#!/bin/bash
# deploy.sh — деплой одной командой с локального компа
# Использование: ./deploy.sh
#                ./deploy.sh "сообщение коммита"

set -e

SSH_KEY="$HOME/.ssh/errani-deploy/key"
SSH_HOST="root@168.222.143.43"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no"
REMOTE_DIR="/var/www/errani-new"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── 1. Коммит (если есть незакоммиченные изменения) ──────────────────────────
cd "$LOCAL_DIR"

if ! git diff --quiet || ! git diff --cached --quiet; then
  MSG="${1:-deploy: $(date '+%Y-%m-%d %H:%M')}"
  echo "📝 Коммит: $MSG"
  git add -A
  git commit -m "$MSG" || true
fi

# ── 2. Пуш в GitHub (фоновый бэкап, не блокирует деплой) ────────────────────
echo "☁️  Пуш в GitHub..."
git push origin main --no-verify 2>/dev/null || echo "⚠️  GitHub push не удался (продолжаем)"

# ── 3. Rsync файлов на сервер ─────────────────────────────────────────────────
echo "📦 Отправка файлов на сервер..."
rsync -az --delete \
  -e "ssh $SSH_OPTS" \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='deploy.sh' \
  --exclude='memory' \
  --exclude='txt.md' \
  "$LOCAL_DIR/" \
  "$SSH_HOST:$REMOTE_DIR/"

# ── 4. Сборка и перезапуск на сервере ────────────────────────────────────────
echo "🔨 Сборка на сервере..."
ssh $SSH_OPTS "$SSH_HOST" "bash -s" <<'ENDSSH'
set -e
export PATH=/root/.nvm/versions/node/v20.20.2/bin:$PATH
cd /var/www/errani-new

npm run build 2>&1 | tail -20

echo "🔄 Перезапуск..."
pm2 reload ecosystem.config.js --update-env

sleep 2
pm2 status
ENDSSH

# ── 5. Проверка ───────────────────────────────────────────────────────────────
echo "🔍 Проверка..."
sleep 3

STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://errani.ru/)
API=$(curl -s --max-time 15 "https://errani.ru/api/products" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d)} products')" 2>/dev/null || echo "?")

echo ""
if [ "$STATUS" = "200" ]; then
  echo "✅ Деплой успешен!"
  echo "   🌐 Сайт: $STATUS OK"
  echo "   📦 API: $API"
else
  echo "⚠️  Сайт вернул $STATUS — проверь логи:"
  echo "   ssh $SSH_OPTS $SSH_HOST 'pm2 logs errani-site --lines 30 --nostream'"
fi
