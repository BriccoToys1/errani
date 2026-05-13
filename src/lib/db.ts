import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function tuneDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '10');
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '30');
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

export const prisma = globalForPrisma.prisma ?? createClient();
globalForPrisma.prisma = prisma;

export default prisma;
