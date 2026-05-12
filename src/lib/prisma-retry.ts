import prisma from './db';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || !error || !('code' in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

// P1017 = Server has closed the connection (dropped idle connection)
// P1001 = Can't reach database server
// P1008 = Operations timed out
// P2024 = Timed out fetching a new connection from the pool
const RETRYABLE_CODES = new Set(['P2024', 'P1001', 'P1008', 'P1017']);
const RETRYABLE_MESSAGE_PARTS = [
  'Engine is not yet connected',
  'Server has closed the connection',
  'Connection reset by peer',
  'Connection timed out',
  'Timed out fetching a new connection from the connection pool',
];

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : '';
  }
  return '';
}

export function isRetryablePrismaError(error: unknown): boolean {
  if (RETRYABLE_CODES.has(getErrorCode(error) ?? '')) return true;
  const message = getErrorMessage(error);
  return RETRYABLE_MESSAGE_PARTS.some((part) => message.includes(part));
}

export async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 150
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryablePrismaError(error) || attempt === attempts) {
        throw error;
      }
      try {
        await prisma.$disconnect();
        await prisma.$connect();
      } catch {
        // ignore reconnect errors
      }
      await sleep(baseDelayMs * attempt);
    }
  }

  throw lastError;
}
