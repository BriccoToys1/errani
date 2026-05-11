import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { withPrismaRetry } from '@/lib/prisma-retry';

const COUNTS_CACHE_TTL_MS = 20_000;
let countsCache: {
  expiresAt: number;
  payload: { newOrders: number; newInquiries: number; newWaitlist: number; newEmails: number };
} | null = null;

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const withTimeout = async <T,>(promise: Promise<T>, fallback: T, ms = 4000): Promise<T> => {
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('counts timeout')), ms)),
      ]);
    } catch {
      return fallback;
    }
  };

  try {
    const now = Date.now();
    if (countsCache && countsCache.expiresAt > now) {
      return NextResponse.json(countsCache.payload, {
        headers: { 'X-Admin-Counts-Cache': 'hit' },
      });
    }

    const [newOrders, newInquiries, newWaitlist, newEmails] = await Promise.all([
      withTimeout(withPrismaRetry(() => prisma.order.count({ where: { status: { in: ['paid', 'assembling'] } } }), 2, 80), 0),
      withTimeout(withPrismaRetry(() => prisma.inquiry.count({ where: { status: 'new' } }), 2, 80), 0),
      withTimeout(withPrismaRetry(() => prisma.waitlistRequest.count({ where: { status: 'pending' } }), 2, 80), 0),
      withTimeout(withPrismaRetry(() => prisma.adminEmail.count({ where: { direction: 'inbound', isRead: false } }), 2, 80), 0),
    ]);

    const payload = {
      newOrders,
      newInquiries,
      newWaitlist,
      newEmails,
    };

    countsCache = { expiresAt: now + COUNTS_CACHE_TTL_MS, payload };
    return NextResponse.json(payload, {
      headers: { 'X-Admin-Counts-Cache': 'miss' },
    });
  } catch (error) {
    console.error('Counts error:', error);
    return NextResponse.json({ error: 'Failed to load counts' }, { status: 500 });
  }
}
