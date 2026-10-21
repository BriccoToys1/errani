/**
 * One-off: resolve `inReplyTo` for existing inbound emails to the AdminEmail.id
 * of the message they answer (old rows stored a raw header value or nothing).
 *   npx tsx scripts/backfill-mail-threads.ts
 */
import { PrismaClient } from '@prisma/client';
import { resolveInboundParent } from '../src/lib/mail-thread';

async function main() {
  const prisma = new PrismaClient();
  try {
    const inbound = await prisma.adminEmail.findMany({
      where: { direction: 'inbound' },
      select: { id: true, inReplyTo: true, contactEmail: true, subject: true, createdAt: true },
    });
    const ids = new Set((await prisma.adminEmail.findMany({ select: { id: true } })).map((r) => r.id));
    let linked = 0;
    let cleared = 0;
    for (const row of inbound) {
      if (row.inReplyTo && ids.has(row.inReplyTo)) continue;
      const parent = await resolveInboundParent(prisma, {
        contactEmail: row.contactEmail,
        subject: row.subject,
        inReplyToHeader: row.inReplyTo,
        before: row.createdAt,
      });
      const next = parent?.id || '';
      if (next !== row.inReplyTo) {
        await prisma.adminEmail.update({ where: { id: row.id }, data: { inReplyTo: next } });
        if (next) linked += 1;
        else cleared += 1;
      }
    }
    console.log(`inbound=${inbound.length} linked=${linked} cleared=${cleared}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
