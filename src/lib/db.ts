import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function buildDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    // Always enforce safe pool settings regardless of what's in DATABASE_URL
    parsed.searchParams.set('connection_limit', '5');
    parsed.searchParams.set('pool_timeout', '20');
    parsed.searchParams.set('connect_timeout', '10');
    return parsed.toString();
  } catch {
    return url;
  }
}

function createClient(): PrismaClient {
  const datasourceUrl = buildDatabaseUrl();
  return new PrismaClient({
    log: ['error'],
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();
globalForPrisma.prisma = prisma;

export default prisma;
