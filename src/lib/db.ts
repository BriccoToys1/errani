import { PrismaClient } from '@prisma/client';

const g = globalThis as unknown as {
  _prismaClient: PrismaClient;
  _prismaResetAt: number;
};

function tuneDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const defaultConnectionLimit = isServerless ? '1' : '5';
    const connectionLimit = process.env.PRISMA_CONNECTION_LIMIT || defaultConnectionLimit;
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

function createClient(): PrismaClient {
  const dbUrl = tuneDatabaseUrl(process.env.DATABASE_URL);
  return new PrismaClient({
    ...(dbUrl ? { datasources: { db: { url: dbUrl } } } : {}),
    log: ['error'],
  });
}

if (!g._prismaClient) {
  g._prismaClient = createClient();
  g._prismaResetAt = 0;
}

const RESET_COOLDOWN_MS = 5_000;

export async function resetPrismaClient(): Promise<void> {
  const now = Date.now();
  if (now - g._prismaResetAt < RESET_COOLDOWN_MS) return;
  g._prismaResetAt = now;

  const stale = g._prismaClient;
  g._prismaClient = createClient();

  try {
    await stale.$disconnect();
  } catch {
    // best effort
  }
}

// Proxy so every access to `prisma.X` reads the *current* g._prismaClient.
// After resetPrismaClient() swaps it out, all subsequent calls automatically
// use the fresh instance — including retries in withPrismaRetry.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop, receiver) {
    const client = g._prismaClient;
    const val = Reflect.get(client, prop, receiver);
    return typeof val === 'function' ? (val as (...args: unknown[]) => unknown).bind(client) : val;
  },
  set(_t, prop, value) {
    (g._prismaClient as unknown as Record<string | symbol, unknown>)[prop] = value;
    return true;
  },
}) as PrismaClient;

export default prisma;
