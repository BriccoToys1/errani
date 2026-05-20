
./deploy.sh "fix: исправил"



# AI Agent Deploy Runbook (errani.ru)

Этот файл — рабочая инструкция для AI-агентов, которые деплоят проект на текущий production-сервер.

## 1) Текущий прод-контур

- Server name: `Cyan Caesium`
- OS: `Ubuntu 20.04 LTS`
- Host: `root@168.222.143.43`
- SSH key (локально): `~/.ssh/errani-deploy/key`
- Project path on server: `/var/www/errani-new`
- PM2 app name: `errani-site`
- Node path on server: `/root/.nvm/versions/node/v20.20.2/bin`

## 2) Важные правила перед деплоем

1. Не использовать `prisma db push` в build-пайплайне на этом сервере.
2. Не использовать destructive git-команды (`reset --hard` и т.п.).
3. Если `git pull` на сервере просит credentials, использовать `scp/rsync` (не блокироваться).
4. Всегда запускать build перед `pm2 restart`.
5. Для Prisma+Neon pooler в `.env` должен быть `DATABASE_URL` с параметрами пула:
   - `connection_limit=10`
   - `pool_timeout=4`

## 3) Стандартный деплой (рекомендуется)

### 3.1 Скопировать изменённые файлы

Локально:

```bash
scp -i ~/.ssh/errani-deploy/key -o StrictHostKeyChecking=no \
  <local_file_1> <local_file_2> ... \
  root@168.222.143.43:/var/www/errani-new/<target_path>
```

Если много файлов/папок — использовать `rsync`.

### 3.2 Собрать и перезапустить

```bash
ssh -i ~/.ssh/errani-deploy/key -o StrictHostKeyChecking=no root@168.222.143.43 'bash -s' <<'ENDSSH'
set -e
export PATH=/root/.nvm/versions/node/v20.20.2/bin:$PATH
cd /var/www/errani-new

npm run build
pm2 restart errani-site --update-env
ENDSSH
```

## 4) Быстрая проверка после деплоя

```bash
# Проверка процесса
ssh -i ~/.ssh/errani-deploy/key -o StrictHostKeyChecking=no root@168.222.143.43 \
  'bash -lc "export PATH=/root/.nvm/versions/node/v20.20.2/bin:$PATH; pm2 status"'

# Проверка публичных страниц
curl -I https://errani.ru/catalog
curl -I https://errani.ru/tenderly-vibe

# Проверка ключевого API
curl -I "https://admin.errani.ru/api/products?showAll=true&includeArchived=true"
```

## 5) Диагностика, если что-то не работает

### 5.1 Логи PM2

```bash
ssh -i ~/.ssh/errani-deploy/key -o StrictHostKeyChecking=no root@168.222.143.43 \
  'bash -lc "export PATH=/root/.nvm/versions/node/v20.20.2/bin:$PATH; pm2 logs errani-site --lines 150 --nostream"'
```

### 5.2 Частая проблема: Prisma pool timeout (`P2024`)

Проверить `DATABASE_URL` в `/var/www/errani-new/.env`.
Должны быть параметры:

- `connection_limit=10`
- `pool_timeout=4`

После правки:

```bash
ssh -i ~/.ssh/errani-deploy/key -o StrictHostKeyChecking=no root@168.222.143.43 \
  'bash -lc "export PATH=/root/.nvm/versions/node/v20.20.2/bin:$PATH; pm2 restart errani-site --update-env"'
```

### 5.3 Если build упал

```bash
ssh -i ~/.ssh/errani-deploy/key -o StrictHostKeyChecking=no root@168.222.143.43 \
  'tail -200 /tmp/build.log 2>/dev/null || true'
```

Или запускать build напрямую в интерактивной SSH-сессии.

## 6) Мини-checklist для агента

Перед деплоем:
- [ ] Проверил какие файлы изменены
- [ ] Не затронул случайно `.env`
- [ ] Не добавил `prisma db push` в build

После деплоя:
- [ ] `npm run build` прошёл без ошибок
- [ ] `pm2 status` = `online`
- [ ] `/catalog` и `/api/products` отвечают `200`
- [ ] Проверен критичный user-flow, который фиксился

## 7) Команда “всё в одном” (копи-паст)

```bash
ssh -i ~/.ssh/errani-deploy/key -o StrictHostKeyChecking=no root@168.222.143.43 'bash -s' <<'ENDSSH'
set -e
export PATH=/root/.nvm/versions/node/v20.20.2/bin:$PATH
cd /var/www/errani-new
npm run build
pm2 restart errani-site --update-env
pm2 status
ENDSSH
```

