# Deploy Guide — errani.ru on SmartApe VPS

## Current production target

- **Provider:** SmartApe VPS
- **Server:** `188.127.251.184` (`s1702748.smartape-vps.com`, `vm1702748`)
- **OS:** Ubuntu 24.04
- **App dir:** `/var/www/errani`
- **Runtime:** Node.js 22, PM2, Nginx, Let's Encrypt
- **Domains:** `errani.ru`, `www.errani.ru`, `admin.errani.ru`
- **Database:** Neon PostgreSQL via `DATABASE_URL`

Do not commit passwords, `.env` files, or hosting panel credentials.

---

## DNS

Point the public domains to the VPS:

| Type | Host | Value |
|---|---|---|
| `A` | `@` | `188.127.251.184` |
| `A` | `www` | `188.127.251.184` |
| `A` | `admin` | `188.127.251.184` |

Wait for DNS propagation before issuing SSL certificates.

---

## First server setup

SSH to the server, preferably with an SSH key:

```bash
ssh root@188.127.251.184
```

Install base packages:

```bash
apt update
apt install -y git curl nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm install -g pm2
```

Upload the app from the local machine:

```bash
./deploy.sh
```

Create `/var/www/errani/.env` from production values:

```bash
nano /var/www/errani/.env
```

Required variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `PRISMA_CONNECTION_LIMIT` | Optional Prisma pool size for VPS, default `5` |
| `PRISMA_POOL_TIMEOUT` | Optional DB pool wait timeout in seconds, default `20` |
| `JWT_SECRET` | Admin JWT secret |
| `ADMIN_EMAIL` | Initial/admin fallback email |
| `ADMIN_PASSWORD` | Initial/admin fallback password |
| `RESEND_API_KEY` | Resend API key |
| `YUKASSA_SHOP_ID` | YooKassa shop ID |
| `YUKASSA_SECRET_KEY` | YooKassa secret key |
| `NEXT_PUBLIC_SITE_URL` | `https://errani.ru` |
| `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` | Yandex Maps JavaScript API key for the CDEK pickup map |
| `RESEND_WEBHOOK_SECRET` | Optional webhook verification secret |
| `AVITO_CLIENT_ID` | Optional Avito API client ID |
| `AVITO_CLIENT_SECRET` | Optional Avito API client secret |
| `AVITO_USER_ID` | Optional Avito user ID |

Install and build:

```bash
npm ci --ignore-scripts
npx prisma generate
npm run build
pm2 start ecosystem.config.js --update-env
pm2 save
pm2 startup systemd -u root --hp /root
```

Configure Nginx:

```bash
cp /var/www/errani/nginx.conf /etc/nginx/sites-available/errani.ru
ln -sf /etc/nginx/sites-available/errani.ru /etc/nginx/sites-enabled/errani.ru
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

Issue SSL certificates after DNS points to the server:

```bash
certbot --nginx -d errani.ru -d www.errani.ru -d admin.errani.ru
systemctl reload nginx
```

---

## Standard deploy

From local machine:

```bash
./deploy.sh
```

Defaults:

```bash
SERVER_HOST=188.127.251.184
SERVER_USER=root
SERVER_PORT=22
APP_DIR=/var/www/errani
```

Override them when needed:

```bash
SERVER_USER=deploy SERVER_PORT=2222 ./deploy.sh
```

`deploy.sh` uploads the current local project files to the VPS, excluding `.env`, `.git`, `node_modules`, `.next`, and other local-only files.

On the server, `scripts/deploy-server.sh` runs:

1. `npm ci --ignore-scripts`
2. `npx prisma generate`
3. `npm run build`
4. `pm2 reload ecosystem.config.js --update-env`

Schema changes are manual unless the migration was explicitly planned:

```bash
cd /var/www/errani
npx prisma db push
```

---

## Post-deploy checks

```bash
curl -I https://errani.ru/
curl -I https://www.errani.ru/
curl -I https://admin.errani.ru/admin/login
curl -I "https://errani.ru/api/products?showAll=true"
```

Useful server checks:

```bash
pm2 status
pm2 logs errani-site --lines 100
nginx -t
systemctl status nginx --no-pager
certbot renew --dry-run
```

---

## GitHub Actions

The repository workflow always runs a build check. On push to `main`, it also deploys to the VPS when these repository secrets are configured:

| Secret | Value |
|---|---|
| `SMARTAPE_HOST` | `188.127.251.184` |
| `SMARTAPE_USER` | SSH user, preferably `deploy` |
| `SMARTAPE_PORT` | `22` |
| `SMARTAPE_SSH_KEY` | Private SSH key for deploy access |

Password-based deploys from GitHub Actions are not recommended.
