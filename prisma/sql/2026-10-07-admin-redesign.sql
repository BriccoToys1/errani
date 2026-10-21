-- Additive migration for the admin redesign (safe to re-run).
-- Apply with: npx tsx scripts/apply-sql.ts prisma/sql/2026-10-07-admin-redesign.sql

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trackNumber" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryService" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippedNotifiedAt" TIMESTAMP(3);

ALTER TABLE "AdminEmail" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'dialog';
ALTER TABLE "AdminEmail" ADD COLUMN IF NOT EXISTS "threadId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AdminEmail" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AdminEmail" ADD COLUMN IF NOT EXISTS "messageId" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "AdminEmail_threadId_createdAt_idx" ON "AdminEmail"("threadId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminEmail_kind_createdAt_idx" ON "AdminEmail"("kind", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminEmail_messageId_idx" ON "AdminEmail"("messageId");

-- Backfill counterpart address: inbound → sender, outbound → first recipient.
UPDATE "AdminEmail"
SET "contactEmail" = lower(trim(coalesce(
  substring((CASE WHEN "direction" = 'inbound' THEN "fromAddr" ELSE "toAddr" END) from '<([^>]+)>'),
  split_part((CASE WHEN "direction" = 'inbound' THEN "fromAddr" ELSE "toAddr" END), ',', 1)
)))
WHERE "contactEmail" = '';

-- Inbound Message-IDs were stored in resendId.
UPDATE "AdminEmail" SET "messageId" = "resendId"
WHERE "direction" = 'inbound' AND "messageId" = '' AND "resendId" LIKE '%@%';

-- Historic newsletters: identical outbound subject+body sent to 2+ different people.
WITH campaigns AS (
  SELECT md5("subject" || '|' || "body") AS h
  FROM "AdminEmail"
  WHERE "direction" = 'outbound' AND "kind" = 'dialog'
  GROUP BY md5("subject" || '|' || "body")
  HAVING count(DISTINCT "contactEmail") >= 2
)
UPDATE "AdminEmail" e
SET "kind" = 'newsletter', "threadId" = 'nl_' || c.h
FROM campaigns c
WHERE e."direction" = 'outbound' AND e."kind" = 'dialog' AND md5(e."subject" || '|' || e."body") = c.h;

-- Dialog conversation key = counterpart email.
UPDATE "AdminEmail" SET "threadId" = "contactEmail"
WHERE "kind" = 'dialog' AND "threadId" = '';
