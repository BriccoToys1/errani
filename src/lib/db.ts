import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const RETRYABLE_CODES = new Set(['P2024', 'P1001', 'P1008', 'P1017']);
const RETRYABLE_MESSAGE_PARTS = [
  'Engine is not yet connected',
  'Server has closed the connection',
  'Connection reset by peer',
  'Connection timed out',
  'Timed out fetching a new connection from the connection pool',
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || !error || !('code' in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

function isRetryableError(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code && RETRYABLE_CODES.has(code)) return true;
  const message = getErrorMessage(error);
  return RETRYABLE_MESSAGE_PARTS.some((part) => message.includes(part));
}

function createClient(): PrismaClient {
  const base = new PrismaClient({
    log: ['error'],
  });

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const maxAttempts = 2;
          let lastError: unknown;

          for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
              return await query(args);
            } catch (error) {
              lastError = error;
              if (!isRetryableError(error) || attempt === maxAttempts) {
                throw error;
              }
              try {
                await base.$disconnect();
                await base.$connect();
              } catch {
                // best effort reconnect
              }
              await sleep(100 * attempt);
            }
          }

          throw lastError;
        },
      },
    },
  }) as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createClient();
globalForPrisma.prisma = prisma;

export default prisma;
