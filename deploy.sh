#!/bin/bash
# deploy.sh — скрипт деплоя на сервер
# Запускать на СЕРВЕРЕ в папке /var/www/errani
# Или локально: передать по SSH с git pull

set -e

echo "▶ Деплой errani.ru..."

# 1. Получить последнюю версию
git pull origin main

# 2. Установить зависимости (только production)
npm ci --omit=dev

# 3. Скопировать .env если ещё нет
if [ ! -f .env ]; then
  echo "⚠️  Файл .env не найден! Скопируйте .env.production.example в .env и заполните."
  exit 1
fi

# 4. Сгенерировать Prisma Client
npx prisma generate

# 5. Применить миграции БД (без потери данных)
npx prisma migrate deploy

# 6. Собрать проект
npm run build

# 7. Перезапустить через PM2
pm2 reload ecosystem.config.js --update-env

echo "✅ Деплой завершён!"
pm2 status
