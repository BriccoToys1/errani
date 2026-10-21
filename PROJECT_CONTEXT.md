# PROJECT_CONTEXT.md

> Постоянный архитектурный контекст проекта **errani-site** (errani.ru).
> Для агентов: читать перед задачей; не пересканировать весь репозиторий без нужды.
> Обновлять точечно при изменении архитектуры / API / schema / интеграций / бизнес-логики.
>
> Связанные docs: [PROJECT_INDEX.md](PROJECT_INDEX.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md) · [AGENTS.md](AGENTS.md) · [DEPLOY_FOR_AGENTS.md](DEPLOY_FOR_AGENTS.md)

**Дата аудита:** 2026-10-06  
**Стек:** Next.js 16 (App Router) · React 19 · TypeScript strict · Prisma 6 · PostgreSQL (SmartApe VPS) · Tailwind CSS 4 · PM2 · Nginx · Cloudflare

---

## 1. Назначение продукта

E-commerce для бренда **errani** (авторские колоды таро и аксессуары).

- Публичный магазин: каталог, карточки товаров, корзина/чекаут, отзывы, CMS-страницы, оферта/privacy.
- Админка: заказы, товары, почта, заявки, waitlist, клиенты, отзывы, медиа, настройки, аналитика.
- Один монолитный Next.js-кодовый базис обслуживает и витрину, и admin.

**Домены:**
- `errani.ru` — витрина
- `admin.errani.ru` — админка (rewrite/proxy на `/admin/*`; на основном домене `/admin` → 404)
- Production VPS: SmartApe `188.127.251.184`, app dir `/var/www/errani`

---

## 2. Структура проекта

```
errani-site/
├── prisma/
│   ├── schema.prisma          # модели БД
│   └── seed.ts
├── public/                    # fonts, logos, media, static
├── scripts/
│   └── deploy-server.sh       # remote build/reload (+ cleanup orphan telephony)
├── src/
│   ├── proxy.ts               # Next.js 16 edge proxy (auth + subdomain routing)
│   ├── app/                   # App Router
│   │   ├── [slug]/            # product pages by slug
│   │   ├── admin/             # admin UI pages + AdminSidebar + CSS
│   │   ├── api/               # REST API (public + admin)
│   │   ├── cart/, catalog/, p/, review/, …
│   ├── components/            # публичные UI-примитивы
│   ├── contexts/              # LanguageContext
│   └── lib/                   # db, auth, email, payments, cdek, stock, …
├── deploy.sh
├── nginx.conf
├── ecosystem.config.js
├── next.config.js             # CSP, security headers, images
└── package.json
```

**Важно:** `src/middleware.ts` отсутствует; routing/auth edge-логика — в `src/proxy.ts`.

---

## 3. Frontend architecture

### Публичная витрина
- Server Components по умолчанию; `'use client'` только для интерактива.
- i18n RU/EN через `LanguageContext` + `src/lib/i18n.ts`.
- Стили: Tailwind 4 + `src/app/globals.css`; шрифт Montserrat из `public/fonts`.
- Ключевые страницы: `/`, `/catalog`, `/catalog/[slug]`, `/[slug]`, `/cart`, `/cart/success`, `/tenderly-vibe`, `/p/[slug]`, `/oferta`, `/privacy`, `/review/[token]`.

### Админка (`src/app/admin/`)
- Клиентские страницы (`'use client'`) + `AdminSidebar`.
- Стили: `admin-modern.css` (+ legacy `admin.css`).
- Auth token в `localStorage.admin_token` + httpOnly cookie `admin_token`.
- Навигация сайдбара (основная): Дашборд, Почта, Заказы, Товары, Медиа, Заявки, В ожидании, Клиенты, Отзывы, Настройки.
- Доп. разделы существуют как страницы/роуты (analytics, seo, database, files, content, pages, account, technical, info) — часть открывается из настроек/внутренних ссылок, не все в главном NAV.

### UI-компоненты (`src/components/`)
Экспорт через `index.ts`: Header, Footer, BottomNav, LanguageSelector, ContactModal, CookieConsent, AnalyticsTracker, Button, Input, Loader, Spinner.  
Также: PhoneInput, AddressSuggestField, CdekPickupMap, ReviewsCarousel, ReviewsStack, HeaderScroll, Providers.

Админские UI-паттерны: классы `cms-*`, messenger-layout для почты (`messenger-*`, `mail-*`).

---

## 4. Backend architecture

- Все API — Route Handlers в `src/app/api/**/route.ts`.
- Admin endpoints: `adminGuard(req)` из `src/lib/admin-auth.ts` (JWT HS256, issuer `errani-admin`, audience `errani-admin-panel`; Bearer или cookie; CSRF-like origin check на mutating methods).
- Resilience: `withPrismaRetry`, `withFreshPrisma` для критичных чтений (counts/dashboard).
- Бизнес-хелперы в `src/lib/`: orders fulfillment, stock, CDEK, email, PDF receipts, payments (YooKassa/Tochka), reviews, rate-limit.

---

## 5. Database (Prisma / PostgreSQL на VPS)

Модели (17):

| Model | Назначение |
|---|---|
| `Admin` | админы (bcrypt) |
| `User` | покупатели + адреса, favorites, orders |
| `Product` | каталог: multilingual, stock, preorder, badges, colors, shippingFee, flags |
| `Favorite` | избранное |
| `Order` / `OrderItem` | заказы + CDEK поля + payment |
| `SiteContent` | CMS key→JSON |
| `MediaAsset` | медиатека (path/url, optional Bytes) |
| `ReviewInvite` / `Review` | инвайты по токену + модерация |
| `PageView` / `DailyStat` | аналитика |
| `Inquiry` | контактные заявки |
| `WaitlistRequest` | waitlist по товару |
| `AvitoProduct` | синк с Avito |
| `SiteSettings` | key/value конфиг |
| `CustomPage` | CMS страницы `/p/{slug}` |
| `Expense` | расходы |
| `AdminEmail` | лог писем (inbound/outbound) |

**Нет в schema (удалено после отката):** `PhoneCall`, `SmsMessage`. Телефония/SMS в продукте **не используются**.

### Ключи `SiteSettings` (важные)
`resend_api_key`, `resend_webhook_secret`, `avito_config`, `notificationsEnabled`, `notificationSoundUrl`, `general_settings`, `featuredProductLink`, `deliveryEstimate`, `orderDeliveryFootnote`, `seo_global`, `seo_catalog`, `seo_oferta`, `seo_privacy`, `seo_robots`, `admin_sessions_v1`, `ordersViewedAt`, `customer_profiles_meta_v1`.

---

## 6. API endpoints (карта)

### Public
- `GET/POST /api/products`, `GET/PUT/DELETE /api/products/[id]`
- `GET/POST/DELETE /api/orders`, `GET/PUT/DELETE /api/orders/[id]`, `POST /api/orders/status`, `POST /api/orders/viewed`, receipts
- `GET/POST/PUT /api/inquiries`, `…/[id]`, `…/[id]/reply`
- `GET/POST /api/pages`, `…/[id]`
- `GET/PUT /api/content/[key]`
- `POST /api/upload`
- `GET /api/media/[id]`
- `POST /api/analytics/track`
- `POST /api/waitlist`, notify routes
- `GET/POST /api/reviews`, `GET /api/reviews/public`, `POST /api/reviews/upload`
- Delivery: `/api/delivery/cdek`, `/points`, `/locations`, `/address-suggestions`
- Payment: `/api/payment/yukassa`, `/tochka`, `/international`
- Avito: `/api/avito/sync`, `/api/avito/export`

### Admin (`/api/admin/…`, JWT)
`login`, `dashboard`, `counts`, `analytics`, `account`, `settings`, `search`, `export`, `orders`, `users`, `reviews` (+candidates, invites), `email` (+sync, webhook), `newsletter`, `expenses`, `files`, `media/upload`, `upload/image(s)`, `notification-sound`, `server-stats`, `memory`, `public-status`, `terminal`

**Не должно существовать в working tree / prod (orphan risk):** `/api/admin/phone/*`, `/api/admin/sms/*`, `/api/admin/contact`, `/api/admin/events` — удалены локально; `deploy-server.sh` чистит их на VPS перед build (tar не удаляет orphan-файлы).

---

## 7. Authentication & permissions

- Admin JWT (HS256, ~12h), cookie `admin_token` + Bearer.
- `src/proxy.ts`: на `admin.errani.ru` редиректы; на `errani.ru` путь `/admin` → 404; `/admin/*` кроме login требует валидный JWT.
- Login: rate limit (`src/lib/rate-limit.ts`), поддержка env admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_PASSWORD_HASH`) и DB `Admin`.
- Сессии админа пишутся в `SiteSettings` (`admin_sessions_v1`).
- Публичные покупатели: модель `User` есть; основной checkout работает без полноценного customer-auth flow в UI (guest checkout через orders API).

---

## 8. Email & mailing

**Провайдер:** Resend (`resend` npm). Ключ: `SiteSettings.resend_api_key` **или** `RESEND_API_KEY`.

**Системные письма** (`src/lib/email.ts`):
- `sendOrderConfirmation` (+ PDF чек)
- `sendReceiptEmail`
- `sendStockAvailableEmail` (waitlist)
- `sendReviewInviteEmail`

**Админ-почта** (`/admin/email`, `/api/admin/email`):
- Messenger UI (conversations / folders: inbox, sent, spam)
- Отправка через Resend, лог в `AdminEmail`
- Sync: `/api/admin/email/sync`
- Inbound webhook: `/api/admin/email/webhook` (svix / `RESEND_WEBHOOK_SECRET` / `resend_webhook_secret`)
- Newsletter: `/api/admin/newsletter` (рассылка клиентам) — **не ломать**

Отправитель: mail@errani.ru (см. UI/настройки).

---

## 9. Integrations / third-party

| Сервис | Назначение | Ключевые файлы |
|---|---|---|
| **Resend** | email outbound/inbound | `lib/email.ts`, `api/admin/email/*` |
| **ЮKassa** | платежи RU | `api/payment/yukassa`, `lib/payment-status.ts` |
| **Точка Банк** | acquiring / SBP | `api/payment/tochka`, `lib/tochka.ts` |
| **Stripe-related** | international webhook path | `api/payment/international` (`STRIPE_WEBHOOK_SECRET`) |
| **СДЭК** | расчёт, ПВЗ, создание отправления | `lib/cdek.ts`, `api/delivery/cdek/*` |
| **Yandex Maps** | карта ПВЗ | `CdekPickupMap`, `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` |
| **Avito** | sync/export фида | `api/avito/*` |
| **PostgreSQL (VPS SmartApe)** | БД | Prisma `DATABASE_URL` |
| **Cloudflare + Nginx + Let's Encrypt** | CDN/proxy/SSL | `nginx.conf` |
| **PM2** | process | `ecosystem.config.js` |

**Twilio / IP-телефония / SMS:** откатаны; не часть продукта. Не возвращать без явного запроса.

---

## 10. Storage

- Статика/медиа: `public/media`, uploads на диске VPS.
- `MediaAsset` в БД (metadata + optional binary).
- Admin files API: filesystem browse/edit под контролем (`api/admin/files`) — осторожно: fs-операции могут тянуть лишние файлы в NFT-граф Turbopack при orphan-коде.
- PDF чеков: `puppeteer-core` + `@sparticuz/chromium` (`lib/pdf.ts`).
- Изображения: `sharp`.

---

## 11. Webhooks

- Resend inbound: `POST /api/admin/email/webhook`
- YooKassa payment notifications: `POST /api/payment/yukassa`
- Tochka payment callbacks: `POST /api/payment/tochka`
- International/Stripe-style: `POST /api/payment/international`

Realtime: **нет** WebSocket/SSE в актуальном коде (SSE events для telephony удалены). Admin counts/email обновляются polling’ом на клиенте.

---

## 12. Важные зависимости (package.json)

Runtime: `next`, `react`/`react-dom`, `@prisma/client`, `prisma`, `resend`, `jsonwebtoken`, `jose`, `bcryptjs`, `sharp`, `puppeteer-core`, `@sparticuz/chromium`, `uuid`, `tailwindcss`, `tsx`.

**Нет:** `twilio`, `@twilio/voice-sdk`.

---

## 13. Environment variables (имена только, без значений)

| Var | Назначение |
|---|---|
| `DATABASE_URL` | Postgres |
| `PRISMA_CONNECTION_LIMIT` / `PRISMA_POOL_TIMEOUT` / `PRISMA_CONNECT_TIMEOUT` / `PRISMA_OPERATION_TIMEOUT_MS` | пул Prisma |
| `FRESH_PRISMA_CONNECTION_LIMIT` / `FRESH_PRISMA_TIMEOUT_MS` | short-lived Prisma |
| `JWT_SECRET` | admin JWT (≥32 chars) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_PASSWORD_HASH` | bootstrap admin |
| `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET` | email (fallback к SiteSettings) |
| `NEXT_PUBLIC_SITE_URL` | абсолютные URL писем/редиректов |
| `YUKASSA_SHOP_ID` / `YUKASSA_SECRET_KEY` | ЮKassa |
| `TOCHKA_JWT_TOKEN` / `TOCHKA_CLIENT_ID` / `TOCHKA_CUSTOMER_CODE` / `TOCHKA_MERCHANT_ID` / `TOCHKA_PAYMENT_MODES` / `TOCHKA_API_BASE_URL` / `TOCHKA_PAYMENT_TTL_MINUTES` | Точка |
| `STRIPE_WEBHOOK_SECRET` | international payments |
| `CDEK_CLIENT_ID` / `CDEK_CLIENT_SECRET` (или `CDEK_ACC_ID` / `CDEK_SEC_PASS`) | СДЭК OAuth |
| `CDEK_FROM_CITY_CODE` / `CDEK_SHIPMENT_POINT` / тарифы / unit dimensions / `CDEK_API_URL` | СДЭК |
| `AVITO_CLIENT_ID` / `AVITO_CLIENT_SECRET` / `AVITO_USER_ID` | Avito |
| `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` | карта ПВЗ |
| `ANALYTICS_DB_ENABLED` | включение записи PageView |

Секреты живут в серверном `/var/www/errani/.env` — **никогда не коммитить и не писать значения в docs**.

---

## 14. Основные бизнес-правила

1. **Заказ:** создаётся через `/api/orders` → оплата (YooKassa/Tochka/…) → webhook → `fulfillPaidOrder` → `markOrderPaidAndDecrementStock` → письмо+чек.
2. **Сток:** уменьшается при подтверждённой оплате (`lib/stock.ts`), идемпотентность через alreadyPaid.
3. **Доставка:** checkout считает СДЭК на сервере; после оплаты может создаваться отправление СДЭК (`createCdekOrder`). Методы: `cdek_courier`, `cdek_pvz` (+ legacy/manual).
4. **Товарные флаги:** `isActive`, `isAvailable`, `isSaleDisabled` («Скоро»), `isSoldOut`, preorder (`isPreorder`, `preorderClosed`, date).
5. **Отзывы:** только по invite-токену; модерация pending→approved/rejected.
6. **Waitlist:** заявка → notify при появлении товара.
7. **Админ-почта** и **newsletter** — отдельные контуры; оба на Resend.
8. **Аналитика:** client `AnalyticsTracker` → `/api/analytics/track` → `PageView` (можно отключить env).

---

## 15. Связи модулей (кратко)

```
Cart UI → /api/orders → Payment providers → fulfillPaidOrder → stock + email + (CDEK)
Product pages → /api/products + reviews/public
ContactModal → /api/inquiries → admin/inquiries (+ optional email reply)
Admin email UI → /api/admin/email ↔ Resend ↔ webhook → AdminEmail
Admin settings → SiteSettings → runtime config (Resend key, SEO, delivery copy, …)
```

См. [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 16. Критичные части (не трогать без явного запроса)

- `src/lib/admin-auth.ts`, `src/proxy.ts`, login rate-limit
- `src/lib/order-fulfillment.ts`, `src/lib/stock.ts`, payment webhooks
- `src/lib/cdek.ts` + delivery API
- `src/lib/email.ts` + newsletter route
- `prisma/schema.prisma` (особенно Order/Product/AdminEmail)
- `deploy.sh` / `scripts/deploy-server.sh` / `nginx.conf` / `ecosystem.config.js`
- CSP/security headers в `next.config.js`
- Существующий admin UI/UX (классы `cms-*`, messenger mail) — не «редизайнить»

---

## 17. Реализовано

- Полный storefront + checkout + платежи + СДЭК
- Админка: заказы, товары, медиа, заявки, waitlist, клиенты, отзывы, почта+newsletter, настройки/SEO, analytics API, files/DB tools
- Review invites, receipts PDF, Avito sync/export
- Admin JWT + subdomain isolation

## 18. В разработке / отсутствует

- IP-телефония и SMS — **откатили**; не реализованы в актуальном коде
- Полноценный customer account UI / wishlist UX — модель Favorite есть, публичный flow ограничен
- Realtime (SSE/WS) — нет в prod-коде

## 19. Известные ограничения и техдолг

1. **Deploy via tar не удаляет orphan-файлы на сервере.** Удалённый локально код может остаться на VPS и ломать `next build` (так падал деплой после отката Twilio). Mitigation: cleanup в `scripts/deploy-server.sh`.
2. **`prisma db push --accept-data-loss` опасен** — может снести несвязанные таблицы; для additive schema предпочтителен raw SQL / controlled migration.
3. **Admin files API** (fs walk) + dynamic imports могут давать Turbopack NFT warnings.
4. **README/PROJECT.md** частично устарели (число моделей, middleware vs proxy) — источником истины считать этот файл + schema.
5. **Два CSS для админки** (`admin.css` + `admin-modern.css`).
6. Connection pool PostgreSQL: держать низкий `PRISMA_CONNECTION_LIMIT` на VPS.

---

## 20. Workflow для агентов (обязательно)

1. Читать `PROJECT_INDEX.md`
2. Читать нужный раздел этого файла / `ARCHITECTURE.md` / `DEVELOPMENT_RULES.md`
3. Открывать только 1–5 релевантных файлов
4. Не делать full-repo audit заново, если docs актуальны
5. После существенных изменений — точечно обновить docs
