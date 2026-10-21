# DEVELOPMENT_RULES.md

> Правила безопасной разработки errani-site.  
> Нарушать только с **явного разрешения** владельца (Екатерина).

## 0. Как работать с кодовой базой

1. Сначала `PROJECT_INDEX.md` → нужный раздел `PROJECT_CONTEXT.md` / `ARCHITECTURE.md`.
2. Открывать только файлы задачи (обычно 1–5).
3. Не делать полный повторный аудит, если docs актуальны.
4. После архитектурных изменений — точечно обновить docs, не переписывать целиком.
5. Перед «готово» — релевантная проверка (`tsc` / `npm run build` для широких изменений).

## 1. Не ломать без разрешения

Следующие функции **нельзя** переписывать, удалять или радикально менять UX без явного запроса:

| Область | Почему критично |
|---|---|
| Admin UI/UX (`cms-*`, сайдбар, messenger-почта) | Пользовательский workflow уже устоялся |
| Email-клиент `/admin/email` + `/api/admin/email` | Рабочая почта |
| Newsletter `/api/admin/newsletter` | Рабочая рассылка |
| Transactional email `src/lib/email.ts` | Чеки/заказы/waitlist/reviews |
| Payment webhooks (YooKassa, Tochka, international) | Деньги |
| `fulfillPaidOrder` / `markOrderPaidAndDecrementStock` | Идемпотентность оплаты и стока |
| CDEK integration `src/lib/cdek.ts` + delivery API | Доставка |
| `adminGuard` / `proxy.ts` / login rate-limit | Безопасность |
| `prisma/schema.prisma` destructive changes | Риск data loss |
| Deploy/nginx/PM2 конфиги | Production availability |
| CSP / security headers в `next.config.js` | Security posture |

## 2. База данных

- Любые schema-изменения начинать с `prisma/schema.prisma`.
- **Не использовать** `prisma db push --accept-data-loss` без явного запроса.
- Если `db push` предлагает drop несвязанных таблиц — остановиться и применить additive SQL точечно.
- После schema: `npx prisma generate`; на prod не гонять `db push` в обычном deploy (`DEPLOY_FOR_AGENTS.md`).

## 3. Deploy

- Production только через `./deploy.sh` на SmartApe VPS.
- **Не** `vercel deploy` для prod.
- Tar-upload **не удаляет** orphan-файлы на сервере. Поэтому `scripts/deploy-server.sh` чистит известные удалённые пути (phone/sms/twilio leftovers). При удалении модулей — добавлять пути в этот cleanup.
- Не коммитить и не печатать секреты из `.env`.

## 4. Auth & admin

- Все `/api/admin/*` — через `adminGuard`.
- Не ослаблять JWT options (issuer/audience/algorithms).
- Не открывать `/admin` на публичном домене (логика в `proxy.ts`).
- Не логировать токены/пароли.

## 5. Frontend conventions

- Strict TypeScript; path alias `@/*`.
- Server Components по умолчанию; `'use client'` только при необходимости.
- Переиспользовать `src/components` и существующие admin CSS-паттерны.
- Не вводить новый дизайн-язык админки «с нуля».
- Публичный brand UI: следовать существующему visual language сайта (не generic AI-layouts).

## 6. Интеграции

- Новые провайдеры не подключать вслепую: сначала проверить существующие (`Resend`, payments, CDEK, Avito).
- **Telephony/SMS/Twilio** — сознательно удалены; не возвращать без запроса.
- Ключи предпочтительно через `SiteSettings` (как Resend) и/или server env — без хардкода.

## 7. Scope discipline

- Менять только то, что нужно для задачи.
- Не «顺便» рефакторить соседние модули.
- Не трогать email/newsletter при задачах про заказы/товары и наоборот.
- Не добавлять markdown/docs без запроса (исключение: поддержание этих context-файлов).

## 8. Verification

- Точечный фикс: typecheck затронутых модулей.
- Широкие изменения API/Prisma/admin: `npm run build`.
- После deploy: health checks из `DEPLOY_FOR_AGENTS.md`.

## 9. Git

- Коммиты — только по явной просьбе пользователя.
- Не force-push main, не `--no-verify`, не править git config.
- Не коммитить `.env`, credentials, dumps с секретами.

## 10. Когда можно / нельзя трогать docs

- **Обновлять** `PROJECT_*` / `ARCHITECTURE` / `DEVELOPMENT_RULES` при реальных изменениях архитектуры, API, schema, интеграций, критичных правил.
- **Не** переписывать docs целиком «для красоты».
- **Не** записывать реальные секреты/токены/пароли.
