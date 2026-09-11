# errani.ru — Project Overview

## Tech Stack

| Category        | Technology                        |
|-----------------|-----------------------------------|
| **Framework**   | Next.js 16 (App Router)           |
| **Language**    | TypeScript (strict mode)          |
| **Styling**     | Tailwind CSS 4                    |
| **Database**    | PostgreSQL + Prisma ORM           |
| **Auth**        | JWT (HS256, jsonwebtoken)         |
| **Email**       | Resend                            |
| **PDF**         | puppeteer-core + @sparticuz/chromium |
| **Images**      | sharp                             |
| **Runtime**     | Node.js (via PM2)                 |
| **Reverse Proxy** | Nginx + Cloudflare             |

## Architecture

Next.js 16 App Router monolith serving both public and admin routes from a single codebase. Server components are the default; client components explicitly opt in with `'use client'`. The app proxies through Nginx (SSL termination, rate limiting) with Cloudflare in front for CDN/DDoS protection.

- **Public site:** `errani.ru` — catalog, product pages, cart, checkout, reviews
- **Admin panel:** `admin.errani.ru` → Nginx rewrite → `errani.ru/admin/`
- **API routes:** all under `src/app/api/`

## Folder Structure

```
├── prisma/              # Schema + seed
│   ├── schema.prisma    # 17 models
│   └── seed.ts
├── public/              # Static assets
│   ├── fonts/           # Montserrat woff2
│   ├── logos/           # Payment logos, brand logo
│   └── media/           # Product images, photos
├── scripts/             # Deployment scripts
├── src/
│   ├── app/             # Next.js App Router
│   │   ├── [slug]/      # Dynamic product pages
│   │   ├── admin/       # Admin panel (pages + components)
│   │   ├── api/         # API routes
│   │   │   ├── admin/   # Admin CRUD endpoints
│   │   │   ├── products/, orders/, reviews/, etc.
│   │   │   └── ...
│   │   ├── cart/        # Cart + checkout
│   │   ├── catalog/     # Product catalog
│   │   └── ...
│   ├── components/      # Reusable UI components
│   ├── contexts/        # React contexts (LanguageContext)
│   └── lib/             # Utilities (db, auth, i18n, cart, etc.)
├── next.config.js       # Security headers, CSP, image config
├── nginx.conf           # Production Nginx config
├── ecosystem.config.js  # PM2 process config
├── deploy.sh            # Deploy script
└── tsconfig.json        # TypeScript strict config
```

## Coding Conventions

- **Strict TypeScript** with `@/*` path alias mapping to `./src/*`
- **PascalCase** for components, **camelCase** for utilities
- **Server Components** by default (Next.js App Router)
- **Client Components** marked with `'use client'` directive
- **CSS** via Tailwind utility classes
- **Prisma** models use UUID primary keys, JSON fields for complex data
- **Error handling:** try/catch with fallback defaults, Prisma retry wrapper

## Reusable Components

| Component            | Description                              |
|----------------------|------------------------------------------|
| Header               | Site header with navigation              |
| Footer               | Site footer with links                   |
| BottomNav            | Mobile bottom navigation bar             |
| Button               | Styled action button                     |
| Input                | Form input field                         |
| Loader / Spinner     | Loading indicators                       |
| LanguageSelector     | RU/EN language toggle                    |
| CookieConsent        | GDPR cookie consent banner               |
| ContactModal         | Contact form modal                       |
| AnalyticsTracker     | Client-side page view tracking           |
| PhoneInput           | Phone number input with mask             |
| AddressSuggestField  | Address autocomplete field               |
| CdekPickupMap        | CDEK pickup point map                    |
| ReviewsCarousel      | Product reviews carousel                 |
| ReviewsStack         | Stacked reviews display                  |
| Providers            | Wraps LanguageProvider + children        |

## Database (PostgreSQL via Prisma)

17 models total. Key models:

- **Product** — Rich product model with multilingual fields, JSON arrays for images/colors/badges/characteristics, preorder support, limited edition flags
- **Order / OrderItem** — Orders with full shipping info, CDEK integration, payment tracking
- **User** — Registered users with address fields, favorites, orders
- **Admin** — Admin credentials (bcrypt hashed)
- **Review / ReviewInvite** — Token-based review invites, approval workflow, media support
- **PageView / DailyStat** — Analytics tracking (page views, sessions, UTM params)
- **MediaAsset** — DB-stored media with binary data option
- **SiteContent / SiteSettings** — Key-value config store
- **CustomPage** — CMS-managed pages (bilingual)
- **Inquiry** — Contact form submissions
- **WaitlistRequest** — Product waitlist
- **AvitoProduct** — Avito marketplace integration
- **AdminEmail** — Email log (inbound/outbound via Resend)
- **Expense** — Expense tracking
- **Favorite** — User product favorites

## API Structure

RESTful routes under `src/app/api/`. All admin routes are JWT-guarded with `adminGuard()`.

**Public API:**
- `GET /api/products` — List products
- `GET /api/products/[id]` — Single product
- `POST /api/orders` — Create order
- `POST /api/inquiries` — Contact form
- `POST /api/reviews` — Submit review
- `GET /api/pages` — CMS pages
- `POST /api/waitlist` — Join waitlist
- `GET /api/media` — Media files
- `POST /api/analytics/track` — Track page view

**Admin API** (`/api/admin/`):
- `POST /api/admin/login` — Login (rate limited)
- `DELETE /api/admin/login` — Logout
- `GET /api/admin/dashboard` — Dashboard stats
- `CRUD /api/admin/products`, `orders`, `reviews`, `users`, `pages`, `settings`, `media`, `files`, `email`, `expenses`, `analytics`, `search`, `export`, `newsletter`, `server-stats`, `memory`, `public-status`, `account`, `counts`

**Integrations:**
- `POST /api/payment` — Payment processing
- `POST /api/delivery` — CDEK delivery calculation
- `GET /api/avito` — Avito feed proxy

## Authentication

- **JWT-based** (HS256, 12h expiry)
- Token stored in httpOnly cookie + accepts Bearer header
- `adminGuard()` middleware checks token + origin validation
- Rate limiting: 7 attempts per 15 min on login
- Supports both env-level admin (`ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_PASSWORD_HASH`) and DB-level admin
- Session tracking stored in `SiteSettings` (last 100 sessions)

## Deployment

**Target:** VPS (SmartApe, 188.127.251.184)  
**Process:** PM2 → Next.js (port 3000, localhost-only)  
**Reverse Proxy:** Nginx (SSL termination, rate limiting, caching)  
**CDN:** Cloudflare (DDoS protection, caching, SSL)

**Domains:**
- `errani.ru` — Main site
- `admin.errani.ru` → proxied to `errani.ru/admin/`

**Deploy flow:**
1. `deploy.sh` tars project (excluding git/node_modules/.next) → SSH to server
2. Remote `deploy-server.sh` installs deps, builds, reloads PM2
3. Health check: curls `errani.ru`, `www.errani.ru`, `admin.errani.ru/admin/login`

**Security headers:**
- CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Rate limiting on admin login (5 req/min via Nginx)
- Media file uploads blocked from script execution
- SSL via Let's Encrypt with OCSP stapling