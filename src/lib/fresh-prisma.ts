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

function isTransientDbError(error: unknown): boolean {
  const message =
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message || '')
      : String(error || '');
  return (
    message.includes('not yet accepting connections') ||
    message.includes('recovery state') ||
    message.includes('starting up') ||
    message.includes('Fresh Prisma operation timeout') ||
    message.includes('Timed out') ||
    message.includes('ECONNRESET') ||
    message.includes('ECONNREFUSED') ||
    message.includes('too many clients')
  );
}

export async function withFreshPrisma<T>(operation: (db: PrismaClient) => Promise<T>): Promise<T> {
  let lastError: unknown;
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const db = createFreshClient();
    try {
      return await withTimeout(operation(db));
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !isTransientDbError(error)) throw error;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    } finally {
      await disconnectQuietly(db);
    }
  }

  throw lastError;
}
