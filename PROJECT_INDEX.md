# PROJECT_INDEX.md

> Быстрый индекс: Feature → files → API → DB → components.  
> Workflow: этот файл → раздел `PROJECT_CONTEXT.md` → открыть 1–5 файлов.  
> Полный контекст: [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md)

## Meta / ops

| Task | Files |
|---|---|
| Agent entry | `AGENTS.md`, этот индекс |
| Deploy | `deploy.sh`, `scripts/deploy-server.sh`, `DEPLOY_FOR_AGENTS.md`, `nginx.conf`, `ecosystem.config.js` |
| Env names | `README.md`, `PROJECT_CONTEXT.md` §13 (never values) |
| Security headers / CSP | `next.config.js` |
| Edge routing / admin host | `src/proxy.ts` |

---

## Auth / admin shell

| Feature | UI | API / lib | DB |
|---|---|---|---|
| Admin login | `src/app/admin/login/page.tsx` | `src/app/api/admin/login/route.ts`, `src/lib/admin-auth.ts`, `src/lib/jwt-secret.ts`, `src/lib/rate-limit.ts` | `Admin`, `SiteSettings(admin_sessions_v1)` |
| Admin gate | `src/proxy.ts` | cookie JWT verify (`jose`) | — |
| Sidebar / badges | `src/app/admin/AdminSidebar.tsx` | `src/app/api/admin/counts/route.ts` | Order, Inquiry, Waitlist, AdminEmail, Review |
| Mobile bottom nav | `AdminSidebar.tsx` + `src/lib/mobile-nav.ts` | `SiteSettings(mobile_nav_v1)`; configure in Settings→Основное (mobile-only) | 4 slots + search |
| Admin layout/CSS | `src/app/admin/layout.tsx`, `admin-ui.css`, `admin-modern.css`, `admin.css` | Flaticon UIcons | — |
| Shared admin UI kit | `src/components/admin/*`, `src/app/admin/AdminPage.tsx` | appearance: glass/wallpaper via `SiteSettings(admin_appearance)` | — |
| Account | `src/app/admin/account/page.tsx` | `src/app/api/admin/account/route.ts` | `Admin` (login = plain text) |
| Analytics | `src/app/admin/page.tsx` | `/api/admin/analytics`, `/api/admin/server-stats` | PageView, Order, Expense |
| Gallery | `src/app/admin/media/page.tsx` | `/api/admin/upload/images`, media upload | MediaAsset |

---

## Catalog / products

| Feature | UI | API / lib | DB |
|---|---|---|---|
| Home | `src/app/page.tsx` | products API, SiteContent/Settings | Product, SiteContent |
| Catalog | `src/app/catalog/page.tsx`, `CatalogContent.tsx` | `src/app/api/products/route.ts` | Product |
| Product page | `src/app/[slug]/`, `ProductContent.tsx`, `src/app/catalog/[slug]/` | `src/app/api/products/[id]/route.ts` | Product |
| Featured landing | `src/app/tenderly-vibe/page.tsx` | settings `featuredProductLink` | Product |
| Admin products | `src/app/admin/products/page.tsx` | `/api/products` (guarded mutations) | Product |
| Media library | `src/app/admin/media/page.tsx` | `src/app/api/admin/media/upload`, `src/lib/admin-media-library.ts`, `src/lib/product-media.ts` | MediaAsset |
| Defaults/helpers | — | `src/lib/product-defaults.ts`, `src/lib/utils.ts` | — |

---

## Cart / orders / payments / shipping

| Feature | UI | API / lib | DB |
|---|---|---|---|
| Cart / checkout | `src/app/cart/page.tsx`, `src/lib/cart.ts` | `POST /api/orders` | Order, OrderItem |
| Success | `src/app/cart/success/page.tsx` | payment status helpers | Order |
| Admin orders | `src/app/admin/orders/page.tsx` | `src/app/api/admin/orders/*`, `src/app/api/orders/*`; numbers via `allocateOrderNumber` (`ER-01-0XXXX`); shipped email + track fields | Order (`trackNumber`, `deliveryService`, `shippedNotifiedAt`) |
| Fulfillment | — | `src/lib/order-fulfillment.ts`, `src/lib/stock.ts` | Order, Product.stock |
| Receipts | — | `src/lib/receipt-builder.ts`, `src/lib/pdf.ts`, `api/orders/receipt*` | Order |
| YooKassa | — | `src/app/api/payment/yukassa/route.ts`, `src/lib/payment-status.ts` | Order.payment* |
| Tochka | — | `src/app/api/payment/tochka/route.ts`, `src/lib/tochka.ts` | Order |
| International | — | `src/app/api/payment/international/route.ts` | Order |
| CDEK quote/PVZ | `CdekPickupMap`, cart | `src/app/api/delivery/cdek/*`, `src/lib/cdek.ts` | Order.cdek* |
| Address suggest | `AddressSuggestField` | `src/app/api/delivery/address-suggestions` | — |

---

## Email / newsletter

| Feature | UI | API / lib | DB |
|---|---|---|---|
| Admin mailbox (messenger) | `src/app/admin/email/page.tsx` | `src/app/api/admin/email/*`, `src/lib/mail-thread.ts`, `src/lib/email-template.ts` | AdminEmail (`threadId`, `kind`, `inReplyTo`, `contactEmail`) |
| Transactional mail | — | `src/lib/email.ts` (`sendOrderShippedEmail`, branded templates) | AdminEmail + Order |
| Newsletter | email UI «Рассылки» | `src/app/api/admin/newsletter/route.ts` | AdminEmail `kind=newsletter` |
| Resend key / mailboxes | `src/app/admin/settings/page.tsx` (ResendSettings) | `src/lib/mailboxes.ts`, settings API | SiteSettings `resend_api_key`, `mailboxes_v1` |

---

## CRM-lite (inquiries, waitlist, users, reviews)

| Feature | UI | API / lib | DB |
|---|---|---|---|
| Contact form | `ContactModal` | `src/app/api/inquiries/*` | Inquiry |
| Admin inquiries | `src/app/admin/inquiries/page.tsx` | inquiries API + reply | Inquiry |
| Waitlist | product UI + `src/app/admin/waitlist/page.tsx` | `src/app/api/waitlist/*` | WaitlistRequest |
| Customers | `src/app/admin/users/page.tsx` | `src/app/api/admin/users/route.ts` | User, Order aggregation, SiteSettings meta |
| Reviews public | `ReviewsCarousel`, `ReviewsStack` | `src/app/api/reviews/public` | Review |
| Review submit | `src/app/review/[token]/*` | `src/app/api/reviews/*`, `src/lib/review-links.ts` | ReviewInvite, Review |
| Admin reviews | `src/app/admin/reviews/page.tsx` | `src/app/api/admin/reviews/*` | Review* |

---

## Content / SEO / settings

| Feature | UI | API / lib | DB |
|---|---|---|---|
| CMS blocks | `src/app/admin/content/` | `src/app/api/content/[key]` | SiteContent |
| Custom pages | `src/app/admin/pages/`, public `src/app/p/[slug]` | `src/app/api/pages/*` | CustomPage |
| Oferta / Privacy | `src/app/oferta`, `src/app/privacy` | content/settings | SiteContent / settings |
| SEO | `src/app/admin/seo/`, settings SEO tab | settings keys `seo_*` | SiteSettings |
| General settings | `src/app/admin/settings/page.tsx` | `src/app/api/admin/settings/route.ts` | SiteSettings |
| Sitemap/robots | `src/app/sitemap.ts` | seo_robots setting | — |

---

## Analytics / dashboard / ops tools

| Feature | UI | API / lib | DB |
|---|---|---|---|
| Tracking | `AnalyticsTracker` | `src/app/api/analytics/track` | PageView |
| Admin analytics | `src/app/admin/analytics/page.tsx` | `src/app/api/admin/analytics` | PageView, DailyStat |
| Dashboard | `src/app/admin/page.tsx` | `src/app/api/admin/dashboard` | Order, Inquiry, … |
| Search | sidebar + mobile overlay | `src/app/api/admin/search` | multi-model / all text fields |
| Export | orders/settings | `src/app/api/admin/export` | — |
| Files manager | `src/app/admin/files/page.tsx` | `src/app/api/admin/files/route.ts` | filesystem |
| Database tooling | `src/app/admin/database/page.tsx` | admin APIs | stats |
| Server stats/memory/terminal | admin technical/info | `server-stats`, `memory`, `terminal` | — |
| Expenses | (settings/dashboard area) | `src/app/api/admin/expenses` | Expense |
| Avito | settings IntegrationsTab | `src/app/api/avito/sync`, `export` | AvitoProduct |

---

## Shared libraries (quick)

| Lib | Role |
|---|---|
| `src/lib/db.ts` | Prisma singleton + pool tuning |
| `src/lib/fresh-prisma.ts` | short-lived client for critical reads |
| `src/lib/prisma-retry.ts` | retry wrapper |
| `src/lib/admin-client.ts` | admin fetch helpers (if used) |
| `src/lib/i18n.ts` | strings RU/EN |
| `src/contexts/LanguageContext.tsx` | language state |

---

## Explicitly OUT of scope (do not look for)

- `src/app/admin/phone`, `src/app/admin/sms`
- `src/app/api/admin/phone`, `…/sms`, `…/contact`, `…/events`
- `src/lib/twilio.ts`, `src/lib/contact-lookup.ts`
- Twilio deps

If these reappear on VPS only: cleanup is in `scripts/deploy-server.sh`.

---

## “Where do I start?” cheat sheet

| User asks about… | Open first |
|---|---|
| Admin mail / reply / folders | `admin/email/page.tsx`, `api/admin/email/route.ts` |
| Newsletter | `api/admin/newsletter/route.ts` (+ email page UI) |
| Orders list / statuses | `admin/orders/page.tsx`, `api/admin/orders`, `api/orders` |
| Payment bugs | `api/payment/*`, `lib/payment-status.ts`, `lib/order-fulfillment.ts`, `lib/stock.ts` |
| Delivery / PVZ | `lib/cdek.ts`, `api/delivery/cdek/*`, `cart/page.tsx` |
| Product flags / stock UI | `admin/products/page.tsx`, `prisma/schema.prisma` Product |
| Auth / can’t open admin | `proxy.ts`, `api/admin/login`, `lib/admin-auth.ts` |
| Deploy failed | `DEPLOY_FOR_AGENTS.md`, `deploy.sh`, `scripts/deploy-server.sh` |
| Schema change | `prisma/schema.prisma` only first |
| New admin page | copy nearby `admin/*/page.tsx` + `AdminSidebar.tsx` + API under `api/admin/` |
