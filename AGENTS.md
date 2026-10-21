# AGENTS.md

This repository is a Next.js 16 e-commerce site for errani.ru with a single codebase serving both the public storefront and the admin panel. Most work should be done in the app router, shared components, Prisma models, and integration helpers.

## Start here (required context workflow)

**Do not re-scan the whole repo for every task.** Use the permanent docs first:

1. [PROJECT_INDEX.md](PROJECT_INDEX.md) — feature → files map (open this first)
2. [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) — full project context
3. [ARCHITECTURE.md](ARCHITECTURE.md) — module relationships
4. [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md) — what must not be broken

Then open only the 1–5 files needed for the task. Update those docs **sectionally** when architecture, API, schema, integrations, or critical rules change.

Also useful:

- [README.md](README.md) — setup and stack details
- [PROJECT.md](PROJECT.md) — older overview (may lag; prefer PROJECT_CONTEXT.md)
- [DEPLOY_FOR_AGENTS.md](DEPLOY_FOR_AGENTS.md) — before any deployment-related changes

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
- Edge routing / admin host gate: [src/proxy.ts](src/proxy.ts)
- Deployment and server config: [deploy.sh](deploy.sh), [scripts/deploy-server.sh](scripts/deploy-server.sh), [nginx.conf](nginx.conf), [ecosystem.config.js](ecosystem.config.js)

## Working conventions

- Follow strict TypeScript and keep types explicit where possible.
- Prefer Server Components by default; add `'use client'` only when interactivity is required.
- Reuse existing UI primitives from [src/components](src/components) instead of introducing new ad-hoc styling.
- Keep changes localized and consistent with nearby routes or modules.
- For database changes, update [prisma/schema.prisma](prisma/schema.prisma) and propagate the change through Prisma tooling.
- For admin or auth changes, preserve existing guard patterns, rate limiting, and security checks.
- Avoid duplicating documentation already available in the repo; link to the relevant docs instead.
- Do not reintroduce deleted telephony/SMS/Twilio modules without an explicit user request.

## Verification expectations

- Before claiming a change is complete, verify it with the relevant command.
- For broader code changes, run `npm run build`.
- For route, API, or Prisma changes, validate the affected flow and ensure the code still compiles.
- Do not use Vercel for production deploys; this project deploys through the VPS workflow in [DEPLOY_FOR_AGENTS.md](DEPLOY_FOR_AGENTS.md).
