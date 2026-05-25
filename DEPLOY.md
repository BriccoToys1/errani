# Deploy Guide — errani.ru

## How deployments work

Changes deploy automatically: **commit → push to `main` → Vercel builds and goes live**.
No manual CLI steps. No `./deploy.sh`. The old VPS (`168.222.143.43`) is obsolete — ignore it.

- **Platform:** Vercel (GitHub auto-deploy, project `errani-site`)
- **Domains:** `errani.ru`, `www.errani.ru`, `admin.errani.ru`
- **Database:** Neon PostgreSQL (`ep-wispy-night-agz0zu29`) via `DATABASE_URL`

---

## Standard deploy flow

```bash
# 1. Type-check first — zero output means no errors
export PATH="/Users/martin/.nvm/versions/node/v22.22.2/bin:$PATH"
npx tsc --noEmit

# 2. Stage specific files (avoid git add . to prevent committing secrets)
git add src/components/Foo.tsx src/app/bar/page.tsx

# 3. Commit with a clear message
git commit -m "feat: describe the change"

# 4. Push — Vercel picks it up automatically (build takes ~1–2 min)
git push origin main
```

---

## Critical: commit author email

Vercel blocks deployments if the git commit author email does not match the Vercel account email.

**Required email:** `baxriya1961@gmail.com`

This is already set in the local repo config. Verify with:

```bash
git config user.email   # must print baxriya1961@gmail.com
```

If it's wrong, fix it before committing:

```bash
git config --local user.email "baxriya1961@gmail.com"
```

---

## Node version

Always use **Node v22**. Node v20 breaks `npx tsc` and the Vercel CLI.

```bash
export PATH="/Users/martin/.nvm/versions/node/v22.22.2/bin:$PATH"
```

---

## Environment variables

All secrets live in **Vercel Dashboard → errani-site → Settings → Environment Variables**.
Never commit `.env` files or secrets to git.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon DB — Vercel integration (`ep-wispy-night-agz0zu29`) |
| `RESEND_API_KEY` | Email (must be **Full Access** key, not send-only) |
| `YUKASSA_SHOP_ID` | YooKassa shop ID |
| `YUKASSA_SECRET_KEY` | YooKassa secret key |
| `NEXT_PUBLIC_SITE_URL` | `https://errani.ru` |

---

## Rules

- Do **not** run `prisma db push` automatically — schema migrations are manual.
- Do **not** use the Vercel CLI (`vercel deploy`) — GitHub auto-deploy is the only deploy path.
- Do **not** commit to branches other than `main` unless testing; only `main` auto-deploys.
- Secrets stay in Vercel env vars, never in code or `.env` files committed to git.
