# Deploy Instructions for AI Agents (errani.ru)

This project deploys to the SmartApe VPS, not to Vercel.

## Production target

- Host: `188.127.251.184` (`s1702748.smartape-vps.com`)
- OS: Ubuntu 24.04
- App dir: `/var/www/errani`
- Process manager: PM2 app `errani-site`
- Reverse proxy: Nginx config from `nginx.conf`

## Preconditions

- Run local commands from repository root.
- Do not print, commit, or store server passwords in the repository.
- Prefer SSH key access for deploys.
- Ensure `/var/www/errani/.env` exists on the server before deploying.
- For Tochka Bank acquiring, keep these only in server `.env`: `TOCHKA_JWT_TOKEN`, `TOCHKA_CLIENT_ID`, `TOCHKA_CUSTOMER_CODE`, optional `TOCHKA_MERCHANT_ID`, `TOCHKA_PAYMENT_MODES=sbp`.

## Standard Deploy Flow After Code Edits

1. Run type/build checks locally when practical:

```bash
npm ci --ignore-scripts
npx prisma generate
npm run build
```

2. Commit and push to `main`.

3. Deploy to SmartApe VPS:

```bash
./deploy.sh
```

`deploy.sh` uploads the current local project files to the VPS, excluding secrets and build artifacts, then runs `scripts/deploy-server.sh` remotely.

## Post-deploy Checks

```bash
curl -I https://errani.ru/
curl -I https://www.errani.ru/
curl -I https://admin.errani.ru/admin/login
curl -I "https://errani.ru/api/products?showAll=true"
```

Expected: HTTP 200, or a valid redirect where configured.

## Important Rules

- Do not deploy to the old VPS IPs.
- Do not use `vercel deploy` for production.
- Do not run `prisma db push` during regular deploys.
- Keep secrets only in server `.env` or managed secret stores.
