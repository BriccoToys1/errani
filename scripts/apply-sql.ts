/**
 * Apply an additive SQL file statement-by-statement through Prisma.
 * Used instead of `prisma db push`, which would drop unrelated tables.
 *   npx tsx scripts/apply-sql.ts prisma/sql/<file>.sql
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let current = '';
  let inString = false;
  for (const line of sql.split('\n')) {
    const trimmed = line.trim();
    if (!inString && trimmed.startsWith('--')) continue;
    for (const ch of line) {
      if (ch === "'") inString = !inString;
      if (ch === ';' && !inString) {
        if (current.trim()) out.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    current += '\n';
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: tsx scripts/apply-sql.ts <file.sql>');
  const prisma = new PrismaClient();
  try {
    for (const statement of splitStatements(readFileSync(file, 'utf8'))) {
      const affected = await prisma.$executeRawUnsafe(statement);
      console.log(`ok (${affected}) ${statement.split('\n')[0].slice(0, 90)}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
