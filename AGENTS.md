# AGENTS.md

This repository is a Next.js 16 e-commerce site for errani.ru with a single codebase serving both the public storefront and the admin panel. Most work should be done in the app router, shared components, Prisma models, and integration helpers.

## Start here

- Read [README.md](README.md) for setup and stack details.
- Read [PROJECT.md](PROJECT.md) for the broader architecture and conventions.
- Read [DEPLOY_FOR_AGENTS.md](DEPLOY_FOR_AGENTS.md) before any deployment-related changes.

## Common commands

Run these from the repository root:

- `npm ci` — install dependencies
- `npm run dev` — start the local development server
- `npm run build` — verify the production build
- `npm run setup` — apply Prisma schema changes and seed the database
- `npm run db:push` — push schema changes to the database
- `npm run db:seed` — seed initial data
- `npm run db:studio` — open Prisma Studio
- `./deploy.sh` — deploy to the SmartApe VPS production environment

## Project map

- Public storefront: [src/app](src/app)
  - catalog, product pages, cart/checkout, CMS pages, offer/privacy pages, reviews
- Admin panel: [src/app/admin](src/app/admin)
  - admin pages, dashboards, CRUD screens, settings, analytics, email, files, orders
- API routes: [src/app/api](src/app/api)
  - public and admin endpoints live here
- Shared UI: [src/components](src/components)
- Shared logic and integrations: [src/lib](src/lib)
- Database schema: [prisma/schema.prisma](prisma/schema.prisma)
- Deployment and server config: [deploy.sh](deploy.sh), [scripts/deploy-server.sh](scripts/deploy-server.sh), [nginx.conf](nginx.conf), [ecosystem.config.js](ecosystem.config.js)

## Working conventions

- Follow strict TypeScript and keep types explicit where possible.
- Prefer Server Components by default; add `'use client'` only when interactivity is required.
- Reuse existing UI primitives from [src/components](src/components) instead of introducing new ad-hoc styling.
- Keep changes localized and consistent with nearby routes or modules.
- For database changes, update [prisma/schema.prisma](prisma/schema.prisma) and propagate the change through Prisma tooling.
- For admin or auth changes, preserve existing guard patterns, rate limiting, and security checks.
- Avoid duplicating documentation already available in the repo; link to the relevant docs instead.

## Verification expectations

- Before claiming a change is complete, verify it with the relevant command.
- For broader code changes, run `npm run build`.
- For route, API, or Prisma changes, validate the affected flow and ensure the code still compiles.
- Do not use Vercel for production deploys; this project deploys through the VPS workflow in [DEPLOY_FOR_AGENTS.md](DEPLOY_FOR_AGENTS.md).
