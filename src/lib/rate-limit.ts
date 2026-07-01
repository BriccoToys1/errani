import { NextRequest } from 'next/server';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

const buckets = new Map<string, RateLimitBucket>();
let lastCleanupAt = 0;

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function consumeRateLimit(req: NextRequest, options: RateLimitOptions) {
  const now = Date.now();
  const bucketKey = `${options.key}:${getClientIp(req)}`;
  const current = buckets.get(bucketKey);

  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + options.windowMs });
    cleanupExpiredBuckets(now);
    return { allowed: true, remaining: Math.max(0, options.limit - 1), retryAfter: 0 };
  }

  current.count += 1;
  const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  return {
    allowed: current.count <= options.limit,
    remaining: Math.max(0, options.limit - current.count),
    retryAfter,
  };
}

export function resetRateLimit(req: NextRequest, key: string) {
  buckets.delete(`${key}:${getClientIp(req)}`);
}

function cleanupExpiredBuckets(now: number) {
  if (now - lastCleanupAt < 60_000 || buckets.size < 100) return;
  lastCleanupAt = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
