import { PrismaClient } from '@prisma/client';

function tuneDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    const connectionLimit = process.env.FRESH_PRISMA_CONNECTION_LIMIT || '1';
    const poolTimeout = process.env.PRISMA_POOL_TIMEOUT || '20';
    const connectTimeout = process.env.PRISMA_CONNECT_TIMEOUT || '10';

    url.searchParams.set('connection_limit', connectionLimit);
    url.searchParams.set('pool_timeout', poolTimeout);
    url.searchParams.set('connect_timeout', connectTimeout);
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

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  const timeoutMs = Number(process.env.FRESH_PRISMA_TIMEOUT_MS || 8_000);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Fresh Prisma operation timeout')), timeoutMs)
    ),
  ]);
}

async function disconnectQuietly(db: PrismaClient): Promise<void> {
  await Promise.race([
    db.$disconnect().catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 1_000)),
  ]);
}

export async function withFreshPrisma<T>(operation: (db: PrismaClient) => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const db = createFreshClient();
    try {
      return await withTimeout(operation(db));
    } catch (error) {
      lastError = error;
      if (attempt === 2) throw error;
    } finally {
      await disconnectQuietly(db);
    }
  }

  throw lastError;
}
