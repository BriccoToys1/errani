# ARCHITECTURE.md

> Архитектура и связи модулей errani-site.  
> Детали контекста: [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) · быстрый индекс: [PROJECT_INDEX.md](PROJECT_INDEX.md)

## High-level

```
Browser (errani.ru / admin.errani.ru)
        │
        ▼
   Cloudflare CDN
        │
        ▼
   Nginx (SSL, rate limit, proxy)
        │
        ▼
   PM2 → Next.js :3000 (localhost)
        │
   ┌────┴────────────────────────┐
   │  src/proxy.ts (edge)        │  subdomain + admin JWT gate
   └────┬────────────────────────┘
        │
   ┌────┴───────────────┐
   │ App Router         │
   │  pages (RSC/CSR)   │
   │  API route handlers│
   └────┬───────────────┘
        │
   ┌────┴──────────────────────────────────┐
   │ src/lib  (auth, db, email, cdek, pay) │
   └────┬──────────────────────────────────┘
        │
   ┌────┼──────────┬──────────┬────────────┐
   ▼    ▼          ▼          ▼            ▼
 PG@VPS Resend   YooKassa/  СДЭК API    Avito API
 PG             Tochka
```

## Request flows

### Public page render
`layout.tsx` → Providers (Language) → Header/Footer → page RSC → optional client islands (cart, maps, trackers).

### Admin page
`admin.errani.ru` → proxy rewrite to `/admin/*` → JWT cookie check → client page fetches `/api/admin/*` with Bearer token.

### Checkout → payment → fulfillment
```
cart/page.tsx
  → POST /api/orders          (create Order + items)
  → POST /api/payment/{provider}
  → provider webhook
  → fulfillPaidOrder (lib/order-fulfillment)
       → markOrderPaidAndDecrementStock (lib/stock)
       → sendOrderConfirmation + PDF (lib/email, pdf, receipt-builder)
       → optional CDEK shipment (lib/cdek)
```

### Admin email
```
admin/email/page.tsx
  ↔ GET/POST /api/admin/email
  ↔ POST /api/admin/email/sync
Resend inbound → POST /api/admin/email/webhook → AdminEmail rows
Newsletter → POST /api/admin/newsletter (отдельный контур)
```

### Delivery quote
```
cart → /api/delivery/cdek (+ points/locations)
     → lib/cdek.ts (OAuth + calculator)
CdekPickupMap (Yandex Maps) for PVZ selection
```

## Module boundaries

| Module | Owns | Must not own |
|---|---|---|
| `src/app/[slug]`, catalog, cart | Storefront UX | Payment secrets, direct DB writes from client |
| `src/app/admin/*` | Admin UX | Business mutations without API |
| `src/app/api/*` | HTTP contracts, authz | Heavy UI |
| `src/lib/db.ts` + prisma | Data access | Provider SDKs |
| `src/lib/admin-auth.ts` | Admin identity | Product logic |
| `src/lib/email.ts` | Transactional mail | Newsletter UI |
| `src/lib/order-fulfillment.ts` | Post-payment side effects | Checkout form |
| `src/lib/cdek.ts` | Shipping integration | Payment |
| `prisma/schema.prisma` | Canonical data model | Runtime secrets |

## Data ownership

- **Product catalog** — Product (+ AvitoProduct link)
- **Commerce** — Order / OrderItem / stock fields on Product
- **CRM-lite** — Inquiry, WaitlistRequest, User aggregation in admin/users
- **Comms** — AdminEmail (mail only; no SMS/calls tables)
- **Content** — SiteContent, CustomPage, SiteSettings
- **Analytics** — PageView, DailyStat
- **Reviews** — ReviewInvite → Review

## Deploy architecture

```
Local ./deploy.sh
  → tar (no delete) over SSH → /var/www/errani
  → scripts/deploy-server.sh
       1) rm orphan telephony/sms paths (tar leftover protection)
       2) npm ci --ignore-scripts
       3) prisma generate
       4) npm run build
       5) nginx reload
       6) pm2 reload
```

Secrets только в server `.env`. Не деплоить через Vercel.

## Security layers

1. Cloudflare
2. Nginx rate limits / SSL
3. `next.config.js` CSP + security headers
4. `proxy.ts` host isolation for `/admin`
5. `adminGuard` + JWT + origin check
6. Login rate limiting

## Non-goals (current architecture)

- Separate BFF / microservices
- Twilio / telephony / SMS realtime buses
- Shared WebSocket gateway
- Prisma migrate CI pipeline (schema changes applied carefully; avoid destructive `db push`)
