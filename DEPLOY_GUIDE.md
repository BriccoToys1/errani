# Деплой errani.ru — полное руководство

---

## Выбери способ деплоя

| | **Вариант A: Vercel + Neon** | **Вариант B: VPS Рег.ру** |
|---|---|---|
| Стоимость | **Бесплатно** (free tier) | ~700 ₽/мес |
| Сложность настройки | ⭐ Очень просто | ⭐⭐⭐ Сложнее |
| Автодеплой из GitHub | ✅ Встроен | ✅ Через Actions |
| Node.js / сборка Next.js | ✅ Автоматически | Вручную |
| PostgreSQL | ✅ Neon (бесплатно) | Нужно ставить |
| Загрузка медиафайлов | Vercel Blob (бесплатно до 512 MB) | Локальный диск |
| Домен Рег.ру | ✅ Подключается | ✅ Подключается |

> **Рекомендую Вариант A** — проще, дешевле, автодеплой из коробки.

---

# ВАРИАНТ A: Vercel + Neon (без VPS, бесплатно)

## Оглавление (Вариант A)

1. [Создать репозиторий GitHub](#a1-создать-репозиторий-github)
2. [Создать базу данных Neon](#a2-создать-базу-данных-neon-бесплатно)
3. [Исправить загрузку файлов под Vercel](#a3-исправить-загрузку-файлов-под-vercel)
4. [Задеплоить на Vercel](#a4-задеплоить-на-vercel)
5. [Подключить домен Рег.ру](#a5-подключить-домен-регру)
6. [Повседневная работа](#a6-повседневная-работа)

---

## A1. Создать репозиторий GitHub

```bash
# В папке проекта на вашем компьютере
cd "/Users/martin/Documents/coding/site katy/errani-site"

git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin git@github.com:ВАШ_ЛОГИН/errani-site.git
git push -u origin main
```

Убедитесь, что в `.gitignore` есть:
```
node_modules/
.next/
.env
.env.local
```

---

## A2. Создать базу данных Neon (бесплатно)

[Neon](https://neon.tech) — это управляемый PostgreSQL в облаке, бесплатный тариф даёт 512 MB.

1. Зайти на [neon.tech](https://neon.tech) → **Sign up** (через GitHub).
2. Создать проект: **New Project** → название `errani` → регион `Frankfurt (EU)`.
3. После создания появится строка подключения вида:

```
postgresql://errani:ПАРОЛЬ@ep-xxx.eu-central-1.aws.neon.tech/errani?sslmode=require
```

4. Скопировать её — это будет `DATABASE_URL`.

---

## A3. Исправить загрузку файлов под Vercel

На Vercel файловая система **read-only** — нельзя писать на диск. Нужно хранить файлы в **Vercel Blob** (бесплатно до 512 MB).

### Установить Vercel Blob

```bash
npm install @vercel/blob
```

### Заменить файл `src/app/api/upload/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' },
        { status: 400 }
      );
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Max size: 10MB' }, { status: 400 });
    }

    const blob = await put(`media/${Date.now()}-${file.name}`, file, {
      access: 'public',
    });

    return NextResponse.json({ url: blob.url, filename: blob.pathname });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
```

> После этого все загруженные картинки будут храниться на CDN Vercel, а не на сервере.

---

## A4. Задеплоить на Vercel

1. Зайти на [vercel.com](https://vercel.com) → **Sign up** через GitHub.
2. **Add New Project** → выбрать репозиторий `errani-site`.
3. Vercel автоматически определит Next.js — ничего не менять.
4. В разделе **Environment Variables** добавить переменные:

| Имя | Значение |
|-----|---------|
| `DATABASE_URL` | строка подключения Neon |
| `NEXTAUTH_SECRET` | любая длинная строка (можно сгенерировать: `openssl rand -base64 32`) |
| `JWT_SECRET` | любая длинная строка |
| _(остальные из .env)_ | |

5. Нажать **Deploy**.

Vercel сам:
- установит зависимости
- запустит `npm run build` (который включает `prisma generate`)
- опубликует сайт

### Применить миграции БД (один раз)

После первого деплоя выполнить локально:

```bash
# Установить DATABASE_URL от Neon в локальный .env.local
DATABASE_URL="postgresql://..." npx prisma migrate deploy
# или
DATABASE_URL="postgresql://..." npx prisma db push
```

---

## A5. Подключить домен Рег.ру

### В Vercel

1. Открыть проект → **Settings → Domains**.
2. Нажать **Add Domain** → ввести `errani.ru`.
3. Vercel покажет DNS-записи, которые нужно добавить:

| Тип | Хост | Значение |
|-----|------|---------|
| A | @ | `76.76.21.21` |
| CNAME | www | `cname.vercel-dns.com` |

### На Рег.ру

1. Личный кабинет → **Домены** → выбрать домен.
2. **DNS-записи** → удалить старые A-записи.
3. Добавить записи из таблицы выше.
4. Подождать 10–60 минут.

SSL-сертификат Vercel применит **автоматически** — ничего дополнительно делать не нужно.

---

## A6. Повседневная работа

```bash
# Сделал изменения → проверил локально
npm run dev

# Готово — публикуем
git add .
git commit -m "feat: описание изменений"
git push

# Через ~1-2 минуты Vercel автоматически пересобрал и опубликовал сайт ✅
```

Прогресс каждого деплоя можно видеть во вкладке **Deployments** на vercel.com.

---

---

# ВАРИАНТ B: VPS Рег.ру + GitHub Actions

## Оглавление (Вариант B)

1. [Покупка VPS на Рег.ру](#b1-покупка-vps-на-регру)
2. [Первоначальная настройка сервера](#b2-первоначальная-настройка-сервера)
3. [Привязка домена к VPS](#b3-привязка-домена-к-vps)
4. [Установка Node.js, PM2, Nginx](#b4-установка-nodejs-pm2-nginx)
5. [Заливка проекта на сервер через GitHub](#b5-заливка-проекта-на-сервер-через-github)
6. [Настройка Nginx и SSL](#b6-настройка-nginx-и-ssl)
7. [Автодеплой через GitHub Actions](#b7-автодеплой-через-github-actions)
8. [Как работает итоговая схема](#b8-как-работает-итоговая-схема)

---

## B1. Покупка VPS на Рег.ру

1. Зайти на [reg.ru](https://reg.ru) → раздел **VPS/VDS**.
2. Выбрать тариф (минимум **2 CPU / 2 GB RAM** для Next.js).
3. Операционная система — **Ubuntu 22.04 LTS**.
4. После покупки в личном кабинете появятся:
   - **IP-адрес сервера** (например `185.123.45.67`)
   - Логин `root` и пароль (или SSH-ключ)

> Запишите IP — он понадобится на каждом следующем шаге.

---

## B2. Первоначальная настройка сервера

### Подключиться по SSH

```bash
ssh root@185.123.45.67
```

### Обновить систему

```bash
apt update && apt upgrade -y
```

### Создать пользователя deploy (не работать под root)

```bash
adduser deploy
usermod -aG sudo deploy
```

### Добавить свой SSH-ключ новому пользователю

На **локальном компьютере** скопируйте публичный ключ:

```bash
cat ~/.ssh/id_ed25519.pub
```

На **сервере** (от `root`):

```bash
mkdir -p /home/deploy/.ssh
nano /home/deploy/.ssh/authorized_keys
# вставьте скопированный публичный ключ, сохраните Ctrl+O → Enter → Ctrl+X
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

Теперь можно заходить без пароля:

```bash
ssh deploy@185.123.45.67
```

---

## B3. Привязка домена к VPS

### На сайте Рег.ру

1. Войти в личный кабинет → **Домены** → выбрать нужный домен.
2. Перейти в раздел **DNS-записи**.
3. Удалить старые A-записи (если есть).
4. Добавить две A-записи:

| Тип | Хост | Значение            | TTL  |
|-----|------|---------------------|------|
| A   | @    | 185.123.45.67       | 3600 |
| A   | www  | 185.123.45.67       | 3600 |

5. Сохранить. Изменения DNS распространяются до **24 часов** (обычно 30–60 минут).

### Проверить распространение DNS

```bash
# С любого компьютера
nslookup errani.ru
# или
dig errani.ru +short
# Должен вернуть ваш IP
```

---

## B4. Установка Node.js, PM2, Nginx

Войти на сервер: `ssh deploy@185.123.45.67`

### Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v20.x.x
npm -v
```

### PM2 (менеджер процессов)

```bash
sudo npm install -g pm2
pm2 startup systemd -u deploy --hp /home/deploy
# Скопировать и выполнить команду, которую выдаст pm2 startup
```

### Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### PostgreSQL (если используете Prisma + Postgres)

```bash
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE USER errani WITH PASSWORD 'СЮДА_ПАРОЛЬ';"
sudo -u postgres psql -c "CREATE DATABASE errani OWNER errani;"
```

---

## B5. Заливка проекта на сервер через GitHub

### 5.1 Создать репозиторий на GitHub

1. Зайти на [github.com](https://github.com) → **New repository**.
2. Название: `errani-site`, приватный (Private).
3. **Не** инициализировать с README.

### 5.2 Добавить проект в Git (локально)

```bash
# В папке проекта на вашем компьютере
cd "/Users/martin/Documents/coding/site katy/errani-site"

git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin git@github.com:ВАШ_ЛОГИН/errani-site.git
git push -u origin main
```

> Убедитесь, что `.gitignore` содержит: `node_modules/`, `.next/`, `.env`

### 5.3 Создать SSH-ключ на сервере для GitHub

На **сервере**:

```bash
ssh-keygen -t ed25519 -C "deploy@errani.ru" -f ~/.ssh/github_deploy
cat ~/.ssh/github_deploy.pub
```

Скопировать вывод. В GitHub: **Settings → Deploy keys → Add deploy key**.
- Title: `reg.ru server`
- Key: вставить ключ
- Allow write access: **НЕТ** (только читать)

Настроить SSH на сервере:

```bash
nano ~/.ssh/config
```

```
Host github.com
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
```

### 5.4 Склонировать проект на сервер

```bash
sudo mkdir -p /var/www/errani
sudo chown deploy:deploy /var/www/errani

git clone git@github.com:ВАШ_ЛОГИН/errani-site.git /var/www/errani
cd /var/www/errani
```

### 5.5 Создать .env на сервере

```bash
nano /var/www/errani/.env
```

Заполнить переменные (DATABASE_URL, NEXTAUTH_SECRET, и др.). Этот файл **никогда** не попадает в GitHub.

### 5.6 Первый запуск вручную

```bash
cd /var/www/errani
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 start ecosystem.config.js
pm2 save
```

Проверить: `pm2 status` — статус должен быть `online`.

---

## B6. Настройка Nginx и SSL

### Скопировать конфиг

```bash
sudo cp /var/www/errani/nginx.conf /etc/nginx/sites-available/errani.ru
sudo ln -s /etc/nginx/sites-available/errani.ru /etc/nginx/sites-enabled/
sudo nginx -t          # проверить конфиг
```

### Получить SSL-сертификат (Let's Encrypt — бесплатно)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d errani.ru -d www.errani.ru
```

Certbot сам пропишет пути к сертификатам в Nginx. Сертификат обновляется автоматически.

```bash
sudo systemctl reload nginx
```

Открыть в браузере `https://errani.ru` — сайт должен работать.

---

## B7. Автодеплой через GitHub Actions

Каждый раз при `git push origin main` GitHub будет:
1. Подключаться к вашему серверу по SSH
2. Запускать `deploy.sh`
3. Сайт обновляется автоматически

### 7.1 Добавить секреты в GitHub

В репозитории: **Settings → Secrets and variables → Actions → New repository secret**

| Имя секрета       | Значение                                      |
|-------------------|-----------------------------------------------|
| `SERVER_HOST`     | `185.123.45.67`                               |
| `SERVER_USER`     | `deploy`                                      |
| `SERVER_SSH_KEY`  | содержимое `~/.ssh/id_ed25519` (приватный ключ с вашего компьютера) |
| `SERVER_PORT`     | `22`                                          |

> Приватный ключ — файл `~/.ssh/id_ed25519` на вашем **локальном** компьютере.  
> Получить: `cat ~/.ssh/id_ed25519` и скопировать вместе с `-----BEGIN` и `-----END`.

### 7.2 Создать файл GitHub Actions

Создать файл в репозитории по пути `.github/workflows/deploy.yml`:

```yaml
name: Deploy to reg.ru

on:
  push:
    branches:
      - main          # деплой при каждом push в main

jobs:
  deploy:
    name: SSH Deploy
    runs-on: ubuntu-latest

    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          port: ${{ secrets.SERVER_PORT }}
          script: |
            cd /var/www/errani
            bash deploy.sh
```

Закоммитить и запушить:

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions autodeploy"
git push
```

### 7.3 Проверить

1. В репозитории на GitHub перейти на вкладку **Actions**.
2. Должен запуститься workflow `Deploy to reg.ru`.
3. Зелёная галочка = деплой прошёл успешно.

---

## B8. Как работает итоговая схема

```
Ваш компьютер
     │
     │  git push origin main
     ▼
  GitHub
     │
     │  GitHub Actions запускает workflow
     ▼
  Сервер Рег.ру (SSH)
     │
     │  bash deploy.sh
     │    ├─ git pull origin main      ← новый код
     │    ├─ npm ci                    ← зависимости
     │    ├─ prisma migrate deploy     ← миграции БД
     │    ├─ npm run build             ← сборка Next.js
     │    └─ pm2 reload               ← перезапуск без даунтайма
     ▼
  Сайт errani.ru обновлён ✅
```

### Повседневная работа

```bash
# Сделал изменения → проверил локально
npm run dev

# Готово — публикуем
git add .
git commit -m "feat: описание изменений"
git push

# Через ~2-3 минуты сайт обновится автоматически
```

### Откат к предыдущей версии

```bash
# Посмотреть историю коммитов
git log --oneline

# Откатить до нужного коммита
git revert HEAD        # отменить последний коммит (создаёт новый коммит)
git push               # автодеплой запустится снова
```

---

## Частые проблемы

| Проблема | Решение |
|----------|---------|
| GitHub Actions не запускается | Проверить вкладку Actions, убедиться что ветка `main` |
| SSH: Permission denied | Перепроверить `SERVER_SSH_KEY` — должен быть **приватный** ключ целиком |
| Сайт недоступен после деплоя | `ssh deploy@IP`, затем `pm2 logs errani-site` |
| Домен не открывается | DNS еще не распространился, подождать или проверить `dig errani.ru` |
| SSL не работает | `sudo certbot renew --dry-run`, проверить `sudo nginx -t` |
| Ошибка Prisma migrate | Проверить `DATABASE_URL` в `.env` на сервере |
