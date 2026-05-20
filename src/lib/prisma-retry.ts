import { resetPrismaClient } from './db';

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
  'Prisma operation timeout',
];

const OPERATION_TIMEOUT_MS = Number(process.env.PRISMA_OPERATION_TIMEOUT_MS || 10_000);

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message : '';
  }
  return '';
}

function withOperationTimeout<T>(promise: Promise<T>): Promise<T> {
  if (!Number.isFinite(OPERATION_TIMEOUT_MS) || OPERATION_TIMEOUT_MS <= 0) return promise;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Prisma operation timeout')), OPERATION_TIMEOUT_MS)
    ),
  ]);
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
      return await withOperationTimeout(operation());
    } catch (error) {
      lastError = error;
      if (!isRetryablePrismaError(error) || attempt === attempts) {
        throw error;
      }
      // Replace the global Prisma client with a fresh one instead of
      // calling $disconnect()/$connect() on the singleton, which causes
      // concurrent-access races that leave the engine permanently broken.
      try {
        await resetPrismaClient();
      } catch {
        // ignore
      }
      await sleep(baseDelayMs * attempt);
    }
  }

  throw lastError;
}
