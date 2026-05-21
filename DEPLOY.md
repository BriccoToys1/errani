# AI Agent Deploy Runbook (errani.ru)

Проект сейчас деплоится на Vercel, не на старый VPS `168.222.143.43`.

## Production

- Platform: `Vercel`
- Project: `briccotoys1s-projects/errani`
- Domains:
  - `https://errani.ru`
  - `https://www.errani.ru`
  - `https://admin.errani.ru`
- Database: Neon/Postgres через `DATABASE_URL`

## Деплой

```bash
./deploy.sh
```

Скрипт делает:

- синхронизацию зависимостей;
- локальный `prisma generate`;
- локальный `next build --webpack`;
- `vercel deploy --prod --yes`;
- быструю проверку доменов.

## Важные правила

- Не деплоить на `root@168.222.143.43`: этот контур устарел.
- Не запускать `prisma db push` автоматически во время деплоя.
- Секреты должны жить в Vercel Environment Variables, а не в git.
- Если Vercel CLI просит login, пройти device-flow и повторить `./deploy.sh`.
- Локальная `.vercel/project.json` должна быть привязана к `briccotoys1s-projects/errani`, потому что custom domains висят на этом проекте.

## Проверка После Деплоя

```bash
curl -I https://errani.ru/
curl -I https://www.errani.ru/
curl -I https://admin.errani.ru/admin/login
curl -I "https://errani.ru/api/products?showAll=true"
```

Ожидаемо:

- публичные страницы отвечают `200` или корректным redirect;
- `admin.errani.ru/admin/login` отвечает `200`;
- API отвечает JSON/HTTP 200, если env и база доступны.
