# errani.ru

E-commerce сайт для бренда **errani** — авторские колоды таро и аксессуары.

**Стек:** Next.js 16 · React 19 · TypeScript · Prisma · PostgreSQL (Neon) · Tailwind CSS 4  
**Хостинг:** VPS (89.169.152.115) · PM2 · Nginx · Let's Encrypt SSL  
**Платежи:** ЮKassa · **Email:** Resend · **Маркетплейс:** Avito API

---

## Быстрый старт

```bash
# 1. Установить зависимости
npm ci

# 2. Настроить переменные окружения
cp .env.example .env
# Заполнить DATABASE_URL, JWT_SECRET, RESEND_API_KEY, YUKASSA_SHOP_ID, YUKASSA_SECRET_KEY

# 3. Инициализировать базу данных
npm run setup        # prisma db push + seed

# 4. Запустить dev-сервер
npm run dev          # http://localhost:3000
```

## Переменные окружения

| Переменная | Описание |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon) |
| `JWT_SECRET` | Секрет для JWT токенов админ-панели |
| `RESEND_API_KEY` | API ключ Resend для отправки email |
| `YUKASSA_SHOP_ID` | Shop ID ЮKassa (1265018) |
| `YUKASSA_SECRET_KEY` | Секретный ключ ЮKassa |

---

## Архитектура проекта

```
errani-site/
├── prisma/
│   ├── schema.prisma        # 13 моделей БД
│   └── seed.ts              # Начальные данные
├── public/
│   ├── fonts/               # Шрифт Montserrat
│   ├── logos/               # Логотипы бренда
│   └── media/               # Изображения товаров
├── src/
│   ├── middleware.ts         # Auth, subdomain routing, maintenance mode
│   ├── app/
│   │   ├── page.tsx          # Главная страница
│   │   ├── catalog/          # Каталог товаров
│   │   ├── cart/             # Корзина и оформление заказа
│   │   ├── [slug]/           # Динамические страницы товаров
│   │   ├── p/[slug]/         # Кастомные страницы (CMS)
│   │   ├── tenderly-vibe/    # Лендинг featured-товара
│   │   ├── oferta/           # Публичная оферта
│   │   ├── privacy/          # Политика конфиденциальности
│   │   ├── admin/            # Админ-панель (14 разделов)
│   │   └── api/              # REST API роуты
│   ├── components/           # Переиспользуемые компоненты
│   ├── contexts/             # React контексты (i18n)
│   └── lib/                  # Утилиты, БД, авторизация
├── ecosystem.config.js       # PM2 конфигурация
├── nginx.conf                # Nginx reverse proxy
└── deploy.sh                 # Скрипт деплоя на VPS
```

## Админ-панель

Доступна по адресу `admin.errani.ru`. На основном домене `/admin` блокируется middleware (возвращает 404).

| Раздел | Описание |
|---|---|
| **Дашборд** | Статистика: заказы, выручка, конверсия, графики |
| **Заказы** | Управление заказами, смена статусов, экспорт CSV/XLS |
| **Товары** | CRUD товаров, характеристики, изображения, сортировка |
| **Обращения** | Заявки с контактной формы |
| **Почта** | Мини почтовый клиент mail@errani.ru (Resend) |
| **Контент** | CMS для редактирования блоков сайта (герой, оферта и т.д.) |
| **Страницы** | Создание кастомных страниц (публикуются на `/p/{slug}`) |
| **Файлы** | Файловый менеджер (загрузка/удаление медиа) |
| **SEO** | Meta-теги, robots.txt, sitemap |
| **База данных** | Статистика БД, очистка, экспорт |
| **Настройки** | Конфигурация сайта, интеграции (Avito, ЮKassa) |
| **Аккаунт** | Смена логина, email, пароля администратора |

## Схема базы данных

**13 моделей** на PostgreSQL (Neon):

| Модель | Назначение |
|---|---|
| `Admin` | Администраторы (email/password/JWT) |
| `User` | Зарегистрированные покупатели |
| `Product` | Товары каталога (цены, изображения, характеристики) |
| `Favorite` | Избранные товары пользователей |
| `Order` | Заказы (статусы: pending → paid → assembling → shipped → delivered) |
| `OrderItem` | Позиции заказа |
| `SiteContent` | Контент сайта (JSON ключ-значение) |
| `PageView` | Аналитика просмотров страниц |
| `DailyStat` | Агрегированная дневная статистика |
| `Inquiry` | Обращения покупателей |
| `AvitoProduct` | Синхронизация товаров с Avito |
| `SiteSettings` | Настройки сайта (ключ-значение) |
| `CustomPage` | Кастомные страницы (CMS) |
| `AdminEmail` | Входящие/исходящие письма mail@errani.ru |

## API роуты

| Endpoint | Методы | Описание |
|---|---|---|
| `/api/products` | GET, POST | Список/создание товаров |
| `/api/products/[id]` | GET, PUT, DELETE | Отдельный товар |
| `/api/orders` | GET, POST, DELETE | Заказы (DELETE — удалить неоплаченные) |
| `/api/orders/[id]` | GET, PUT, DELETE | Отдельный заказ |
| `/api/orders/status` | POST | Обновление статуса |
| `/api/orders/viewed` | POST | Отметить все заказы просмотренными |
| `/api/inquiries` | GET, POST, PUT | Обращения (PUT — пометить все прочитанными) |
| `/api/pages` | GET, POST | Кастомные страницы |
| `/api/pages/[id]` | GET, PUT, DELETE | Отдельная страница |
| `/api/content/[key]` | GET, PUT | Контент сайта |
| `/api/upload` | POST | Загрузка файлов |
| `/api/payment/yukassa` | POST | Создание платежа ЮKassa |
| `/api/payment/international` | POST | Международные платежи |
| `/api/admin/login` | GET, POST | Авторизация (GET — math-challenge, POST — вход) |
| `/api/admin/dashboard` | GET | Данные дашборда |
| `/api/admin/analytics` | GET | Аналитика |
| `/api/admin/account` | GET, PUT | Профиль и смена данных администратора |
| `/api/admin/settings` | GET, POST | Настройки сайта |
| `/api/admin/files` | GET, POST, DELETE | Файловый менеджер |
| `/api/admin/export` | GET | Экспорт данных (CSV/XLS) |
| `/api/admin/email` | GET, POST, PUT, DELETE | Мини почтовый клиент (Resend) |
| `/api/admin/email/webhook` | POST | Получение входящих писем от Resend |
| `/api/admin/memory` | GET, DELETE | Статистика БД / очистка |
| `/api/admin/server-stats` | GET | Статистика сервера |
| `/api/avito/sync` | GET, POST | Синхронизация с Avito |
| `/api/avito/export` | GET | XML-фид для Avito |

## Безопасность входа в админку

- **Rate limiting:** IP-блокировка после 5 неудачных попыток за 15 мин (прогрессивная: 1→5→15→30 мин)
- **Math-challenge:** серверная задача перед формой (одноразовая, TTL 5 мин)
- **Timing-attack защита:** bcrypt.compare всегда выполняется, даже если admin не найден
- **JWT:** 7 дней, проверяется в middleware на каждом запросе к `/admin/*`

## Middleware

Файл `src/middleware.ts` обрабатывает:

1. **Subdomain routing** — `admin.errani.ru` → внутренние `/admin/` роуты
2. **Блокировка `/admin` на основном домене** — 404 для `errani.ru/admin`
3. **JWT авторизация** — проверка `admin_token` cookie для `/admin/*`
4. **Maintenance mode** — страница «Технические работы» (503)
5. **Site disabled** — страница «Скоро открытие» (503)

## Доставка и оплата

- **Способы доставки:** OZON, Яндекс Маркет (300 ₽, от 6 товаров — 650 ₽)
- **Оплата:** ЮKassa (Visa, Mastercard, МИР, СБП)
- **Валюта:** RUB

## Деплой

### Ручной деплой (VPS)

```bash
ssh -i ~/.ssh/id_ed25519 errani@89.169.152.115 "cd /var/www/errani && pm2 stop errani-site && git fetch --all && git reset --hard origin/main && rm -rf .next/lock && npm run build 2>&1 | tail -25 && pm2 start errani-site"
```

### Локальная разработка → деплой

```bash
# Коммит и пуш
git add . && git commit -m "feat: описание" && git push origin main

# Деплой на VPS (автоматически применяет схему БД)
ssh -i ~/.ssh/id_ed25519 errani@89.169.152.115 "cd /var/www/errani && pm2 stop errani-site && git fetch --all && git reset --hard origin/main && rm -rf .next/lock && npm run build && pm2 start errani-site"
```

### Изменение схемы БД

```bash
# Локально (тест + prod Neon)
npx prisma db push

# На VPS (схема применяется автоматически через npm run build → prisma generate)
# Для применения новых таблиц запусти явно:
ssh -i ~/.ssh/id_ed25519 errani@89.169.152.115 "cd /var/www/errani && npx prisma db push"
```

## Nginx

Конфигурация в `nginx.conf`:

- HTTP → HTTPS редирект
- `www.errani.ru` → `errani.ru`
- `errani.ru` → `127.0.0.1:3000` (Next.js)
- `admin.errani.ru` → `127.0.0.1:3000` с rewrite `/` → `/admin/`
- SSL: Let's Encrypt, TLS 1.2+1.3
- Кэширование: статика 1 год, медиа 30 дней

## Скрипты

```bash
npm run dev          # Dev-сервер
npm run build        # Продакшн сборка (prisma generate + next build)
npm run start        # Продакшн сервер
npm run db:push      # Применить схему к БД
npm run db:seed      # Заполнить начальными данными
npm run db:studio    # Prisma Studio (GUI для БД)
npm run setup        # db:push + db:seed
```

## Технологии

| Категория | Технология |
|---|---|
| Фреймворк | Next.js 16.1.6 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Язык | TypeScript 5.9 |
| ORM | Prisma 6.19 |
| БД | PostgreSQL (Neon) |
| Auth | JWT (jose), bcryptjs |
| Email | Resend |
| Платежи | ЮKassa |
| Процесс-менеджер | PM2 |
| Веб-сервер | Nginx |
| SSL | Let's Encrypt (certbot) |
| CI/CD | git push → ручной деплой по SSH |


**Стек:** Next.js 16 · React 19 · TypeScript · Prisma · PostgreSQL (Neon) · Tailwind CSS 4  
**Хостинг:** VPS (89.169.152.115) · PM2 · Nginx · Let's Encrypt SSL  
**Платежи:** ЮKassa · **Email:** Resend · **Маркетплейс:** Avito API

---

## Быстрый старт

```bash
# 1. Установить зависимости
npm ci

# 2. Настроить переменные окружения
cp .env.example .env
# Заполнить DATABASE_URL, JWT_SECRET, RESEND_API_KEY, YUKASSA_SHOP_ID, YUKASSA_SECRET_KEY

# 3. Инициализировать базу данных
npm run setup        # prisma db push + seed

# 4. Запустить dev-сервер
npm run dev          # http://localhost:3000
```

## Переменные окружения

| Переменная | Описание |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon) |
| `JWT_SECRET` | Секрет для JWT токенов админ-панели |
| `RESEND_API_KEY` | API ключ Resend для отправки email |
| `YUKASSA_SHOP_ID` | Shop ID ЮKassa (1265018) |
| `YUKASSA_SECRET_KEY` | Секретный ключ ЮKassa |

---

## Архитектура проекта

```
errani-site/
├── prisma/
│   ├── schema.prisma        # 12 моделей БД
│   └── seed.ts              # Начальные данные
├── public/
│   ├── fonts/               # Шрифт Montserrat
│   ├── logos/                # Логотипы бренда
│   └── media/               # Изображения товаров
├── src/
│   ├── middleware.ts         # Auth, subdomain routing, maintenance mode
│   ├── app/
│   │   ├── page.tsx          # Главная страница
│   │   ├── catalog/          # Каталог товаров
│   │   ├── cart/             # Корзина и оформление заказа
│   │   ├── [slug]/           # Динамические страницы товаров
│   │   ├── p/[slug]/         # Кастомные страницы (CMS)
│   │   ├── tenderly-vibe/    # Лендинг featured-товара
│   │   ├── oferta/           # Публичная оферта
│   │   ├── privacy/          # Политика конфиденциальности
│   │   ├── admin/            # Админ-панель (12 разделов)
│   │   └── api/              # REST API роуты
│   ├── components/           # Переиспользуемые компоненты
│   ├── contexts/             # React контексты (i18n)
│   └── lib/                  # Утилиты, БД, авторизация
├── ecosystem.config.js       # PM2 конфигурация
├── nginx.conf                # Nginx reverse proxy
└── deploy.sh                 # Скрипт деплоя на VPS
```

## Админ-панель

Доступна по адресу `admin.errani.ru`. На основном домене `/admin` блокируется middleware (возвращает 404).

| Раздел | Описание |
|---|---|
| **Дашборд** | Статистика: заказы, выручка, конверсия, графики |
| **Заказы** | Управление заказами, смена статусов, экспорт CSV/XLS |
| **Товары** | CRUD товаров, характеристики, изображения, сортировка |
| **Обращения** | Заявки с контактной формы |
| **Контент** | CMS для редактирования блоков сайта (герой, оферта и т.д.) |
| **Страницы** | Создание кастомных страниц (публикуются на `/p/{slug}`) |
| **Файлы** | Файловый менеджер (загрузка/удаление медиа) |
| **SEO** | Meta-теги, robots.txt, sitemap |
| **База данных** | Статистика БД, очистка, экспорт |
| **Настройки** | Конфигурация сайта, интеграции (Avito, ЮKassa) |

## Схема базы данных

**12 моделей** на PostgreSQL (Neon):

| Модель | Назначение |
|---|---|
| `Admin` | Администраторы (email/password/JWT) |
| `User` | Зарегистрированные покупатели |
| `Product` | Товары каталога (цены, изображения, характеристики) |
| `Favorite` | Избранные товары пользователей |
| `Order` | Заказы (статусы: pending → paid → assembling → shipped → delivered) |
| `OrderItem` | Позиции заказа |
| `SiteContent` | Контент сайта (JSON ключ-значение) |
| `PageView` | Аналитика просмотров страниц |
| `DailyStat` | Агрегированная дневная статистика |
| `Inquiry` | Обращения покупателей |
| `AvitoProduct` | Синхронизация товаров с Avito |
| `SiteSettings` | Настройки сайта (ключ-значение) |
| `CustomPage` | Кастомные страницы (CMS) |

## API роуты

| Endpoint | Методы | Описание |
|---|---|---|
| `/api/products` | GET, POST | Список/создание товаров |
| `/api/products/[id]` | GET, PUT, DELETE | Отдельный товар |
| `/api/orders` | GET, POST, DELETE | Заказы (DELETE — удалить неоплаченные) |
| `/api/orders/[id]` | GET, PUT, DELETE | Отдельный заказ |
| `/api/orders/status` | POST | Обновление статуса |
| `/api/inquiries` | GET, POST | Обращения |
| `/api/pages` | GET, POST | Кастомные страницы |
| `/api/pages/[id]` | GET, PUT, DELETE | Отдельная страница |
| `/api/content/[key]` | GET, PUT | Контент сайта |
| `/api/upload` | POST | Загрузка файлов |
| `/api/payment/yukassa` | POST | Создание платежа ЮKassa |
| `/api/payment/international` | POST | Международные платежи |
| `/api/admin/login` | POST | Авторизация админа |
| `/api/admin/dashboard` | GET | Данные дашборда |
| `/api/admin/analytics` | GET | Аналитика |
| `/api/admin/settings` | GET, POST | Настройки сайта |
| `/api/admin/files` | GET, POST, DELETE | Файловый менеджер |
| `/api/admin/export` | GET | Экспорт данных (CSV/XLS) |
| `/api/admin/memory` | GET, DELETE | Статистика БД / очистка |
| `/api/admin/server-stats` | GET | Статистика сервера |
| `/api/avito/sync` | GET, POST | Синхронизация с Avito |
| `/api/avito/export` | GET | XML-фид для Avito |

## Middleware

Файл `src/middleware.ts` обрабатывает:

1. **Subdomain routing** — `admin.errani.ru` → внутренние `/admin/` роуты
2. **Блокировка `/admin` на основном домене** — 404 для `errani.ru/admin`
3. **JWT авторизация** — проверка `admin_token` cookie для `/admin/*`
4. **Maintenance mode** — страница «Технические работы» (503)
5. **Site disabled** — страница «Скоро открытие» (503)

## Доставка и оплата

- **Способы доставки:** OZON, Яндекс Маркет (300 ₽, от 6 товаров — 650 ₽)
- **Оплата:** ЮKassa (Visa, Mastercard, МИР, СБП)
- **Валюта:** RUB

## Деплой

### GitHub Actions (автоматический)

Push в `main` → `.github/workflows/deploy.yml` → SSH на VPS → `git fetch && git reset --hard origin/main` → build → PM2 reload.

### Ручной деплой

```bash
ssh -i ~/.ssh/id_ed25519 errani@89.169.152.115
cd /var/www/errani
./deploy.sh
```

### Шаги деплоя (`deploy.sh`):

1. `git pull origin main`
2. `npm ci --omit=dev`
3. `npx prisma generate && npx prisma migrate deploy`
4. `npm run build`
5. `pm2 reload ecosystem.config.js --update-env`

## Nginx

Конфигурация в `nginx.conf`:

- HTTP → HTTPS редирект
- `www.errani.ru` → `errani.ru`
- `errani.ru` → `127.0.0.1:3000` (Next.js)
- `admin.errani.ru` → `127.0.0.1:3000` с rewrite `/` → `/admin/`
- SSL: Let's Encrypt, TLS 1.2+1.3
- Кэширование: статика 1 год, медиа 30 дней

## Скрипты

```bash
npm run dev          # Dev-сервер
npm run build        # Продакшн сборка
npm run start        # Продакшн сервер
npm run db:push      # Применить схему к БД
npm run db:seed      # Заполнить начальными данными
npm run db:studio    # Prisma Studio (GUI для БД)
npm run setup        # db:push + db:seed
```

## Технологии

| Категория | Технология |
|---|---|
| Фреймворк | Next.js 16.1.6 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Язык | TypeScript 5.9 |
| ORM | Prisma 6.19 |
| БД | PostgreSQL (Neon) |
| Auth | JWT (jose), bcryptjs |
| Email | Resend |
| Платежи | ЮKassa |
| Процесс-менеджер | PM2 |
| Веб-сервер | Nginx |
| SSL | Let's Encrypt (certbot) |
| CI/CD | GitHub Actions |
