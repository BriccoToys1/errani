# Аудит безопасности ERRANI

Дата: 2026-06-29

Область проверки: исходный код Next.js/Prisma, admin API, аутентификация, загрузки, webhooks, платежи, публичные order/review endpoints, HTTP headers и npm-зависимости. Это source-code assessment и локальная проверка; активное сканирование production-инфраструктуры не выполнялось.

## Исправлено

| Риск | Уровень | Исправление |
|---|---:|---|
| JWT администратора был доступен JavaScript через `localStorage` и обычную cookie | Высокий | JWT перенесён в `HttpOnly`, `Secure`, `SameSite=Strict` cookie; в `localStorage` остаётся только несекретный маркер совместимости |
| Вход без реального ограничения попыток | Высокий | Rate limit по IP, строгая проверка challenge JWT, короткая 12-часовая сессия, защищённые JWT claims |
| Stored XSS при просмотре входящих писем | Высокий | Email HTML изолирован в sandboxed iframe с собственным CSP и без сетевых запросов |
| Email webhook принимал неподписанные события при отсутствии секрета | Высокий | Fail-closed: без `RESEND_WEBHOOK_SECRET` webhook возвращает 503; подпись обязательна |
| Next.js 16.1.x и транзитивные зависимости имели известные advisory | Высокий | Next/Resend/UUID/Puppeteer/Chromium обновлены; PostCSS/esbuild закреплены безопасными overrides; `npm audit`: 0 |
| Любой HTTPS-хост был разрешён Next Image Optimizer | Высокий | Remote image allowlist ограничен доменами ERRANI и localhost для разработки |
| Слабая энтропия номера заказа через `Math.random()` | Средний/высокий | Новые номера используют 48 бит криптографической случайности через Web Crypto UUID |
| Path traversal/prefix bypass и symlink traversal в файловом менеджере | Средний/высокий | Каноническая проверка пути, запрет symlink, лимит 1 MB и allowlist редактируемых расширений |
| Публичные order/review операции не имели лимитов и строгих границ входа | Средний | Rate limits, ограничения количества/размера, email/quantity validation, скрытие внутренних ошибок провайдера |
| Слабые browser security headers | Средний | CSP, HSTS, Permissions-Policy, COOP, CORP, nosniff, DENY frame policy |
| Proxy проверял лишь наличие cookie и доверял широкому host pattern | Средний | Proxy проверяет JWT, принимает только точный `admin.errani.ru`, очищает невалидную cookie |
| Публичная custom page могла исполнять сохранённый HTML | Средний | Контент выводится как безопасный текст, без `dangerouslySetInnerHTML` |

## Остаточные замечания

1. Старые заказы сохраняют прежние короткие номера. Receipt/status API всё ещё используют номер заказа как bearer-секрет. Для полной защиты исторических заказов нужна миграция `receiptAccessToken` и проверка этого токена.
2. Rate limiter хранится в памяти процесса. Для нескольких PM2-инстансов его следует заменить на Redis/Upstash или лимит на Nginx.
3. На локальной БД обнаружен schema drift: отсутствует `Order.cdekDeliveryPointCode`, уже присутствующий в `prisma/schema.prisma`. Перед production-перезапуском нужна штатная миграция/`prisma db push` после резервной копии.
4. Для production обязательны `JWT_SECRET` длиной не менее 32 символов и `RESEND_WEBHOOK_SECRET`. Для env-admin предпочтителен `ADMIN_PASSWORD_HASH` (bcrypt), а не `ADMIN_PASSWORD`.
5. Next build успешен, но предупреждает о широком file tracing для admin file-manager из-за динамических filesystem paths. На безопасность выполнения это не влияет, однако может увеличить deploy artifact.

## Проверки

- `npm audit`: 0 vulnerabilities
- `npm run build`: успешно, 72 страницы
- TypeScript: успешно
- Mobile QA: 375×812, без document-level horizontal overflow
- Desktop QA: 1440×900, sidebar 264 px, mobile dock скрыт
- Touch targets mobile dock: 52 px
- Проверены dark-only login, dashboard и mobile drawer; console errors: 0
