import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function buildDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    // Apply safer defaults only when params are missing.
    // Overriding existing values can destabilize managed pools.
    if (!parsed.searchParams.get('connection_limit')) {
      parsed.searchParams.set('connection_limit', process.env.DB_CONNECTION_LIMIT || '12');
    }
    if (!parsed.searchParams.get('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', process.env.DB_POOL_TIMEOUT || '30');
    }
    if (!parsed.searchParams.get('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', process.env.DB_CONNECT_TIMEOUT || '15');
    }
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
