import type { PrismaClient } from '@prisma/client';

/**
 * Additive schema patches for the admin redesign.
 * Safe to re-run. Needed because deploys do not run `prisma db push`.
 */
let ensurePromise: Promise<void> | null = null;

async function runEnsure(db: PrismaClient): Promise<void> {
  await db.$executeRawUnsafe(
    `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trackNumber" TEXT NOT NULL DEFAULT ''`
  );
  await db.$executeRawUnsafe(
    `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryService" TEXT NOT NULL DEFAULT ''`
  );
  await db.$executeRawUnsafe(
    `ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippedNotifiedAt" TIMESTAMP(3)`
  );

  await db.$executeRawUnsafe(
    `ALTER TABLE "AdminEmail" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'dialog'`
  );
  await db.$executeRawUnsafe(
    `ALTER TABLE "AdminEmail" ADD COLUMN IF NOT EXISTS "threadId" TEXT NOT NULL DEFAULT ''`
  );
  await db.$executeRawUnsafe(
    `ALTER TABLE "AdminEmail" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT NOT NULL DEFAULT ''`
  );
  await db.$executeRawUnsafe(
    `ALTER TABLE "AdminEmail" ADD COLUMN IF NOT EXISTS "messageId" TEXT NOT NULL DEFAULT ''`
  );

  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "AdminEmail_threadId_createdAt_idx" ON "AdminEmail"("threadId", "createdAt")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "AdminEmail_kind_createdAt_idx" ON "AdminEmail"("kind", "createdAt")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "AdminEmail_messageId_idx" ON "AdminEmail"("messageId")`
  );

  // Backfill counterpart address for dialogs.
  await db.$executeRawUnsafe(`
    UPDATE "AdminEmail"
    SET "contactEmail" = lower(trim(coalesce(
      substring((CASE WHEN "direction" = 'inbound' THEN "fromAddr" ELSE "toAddr" END) from '<([^>]+)>'),
      split_part((CASE WHEN "direction" = 'inbound' THEN "fromAddr" ELSE "toAddr" END), ',', 1)
    )))
    WHERE "contactEmail" = ''
  `);

  await db.$executeRawUnsafe(`
    UPDATE "AdminEmail" SET "messageId" = "resendId"
    WHERE "direction" = 'inbound' AND "messageId" = '' AND "resendId" LIKE '%@%'
  `);

  await db.$executeRawUnsafe(`
    UPDATE "AdminEmail" SET "threadId" = "contactEmail"
    WHERE "kind" = 'dialog' AND "threadId" = '' AND "contactEmail" <> ''
  `);
}

export async function ensureAdminSchema(db: PrismaClient): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = runEnsure(db).catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  await ensurePromise;
}
