import { PrismaClient } from '@prisma/client';

const g = globalThis as unknown as {
  _prismaClient: PrismaClient;
  _prismaResetAt: number;
};

function tuneDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    // On serverless (Vercel) each function instance must use 1 connection
    // to avoid exhausting Neon's connection limit across concurrent invocations
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '1');
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '10');
    }
    if (!url.searchParams.has('connect_timeout')) {
      url.searchParams.set('connect_timeout', '15');
    }
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
