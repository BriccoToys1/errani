import { PrismaClient } from '@prisma/client';

function tuneDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    url.searchParams.set('connection_limit', '3');
    url.searchParams.set('pool_timeout', '10');
    url.searchParams.set('connect_timeout', '10');
    return url.toString();
  } catch {
    return raw;
  }
}

function createFreshClient(): PrismaClient {
  const dbUrl = tuneDatabaseUrl(process.env.DATABASE_URL);
  return new PrismaClient({
    ...(dbUrl ? { datasources: { db: { url: dbUrl } } } : {}),
    log: ['error'],
  });
}

export async function withFreshPrisma<T>(operation: (db: PrismaClient) => Promise<T>): Promise<T> {
  const db = createFreshClient();
  try {
    return await operation(db);
  } finally {
    await db.$disconnect().catch(() => undefined);
  }
}
