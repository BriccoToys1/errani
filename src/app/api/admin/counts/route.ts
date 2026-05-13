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

  const withTimeout = async <T,>(promise: Promise<T>, ms = 12000): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('counts timeout')), ms)),
    ]);

  try {
    const now = Date.now();
    if (countsCache && countsCache.expiresAt > now) {
      return NextResponse.json(countsCache.payload, {
        headers: { 'X-Admin-Counts-Cache': 'hit' },
      });
    }

    const [newOrders, newInquiries, newWaitlist, newEmails] = await withTimeout(
      withPrismaRetry(
        () =>
          prisma.$transaction([
            prisma.order.count({ where: { status: { in: ['paid', 'assembling'] } } }),
            prisma.inquiry.count({ where: { status: 'new' } }),
            prisma.waitlistRequest.count({ where: { status: 'pending' } }),
            prisma.adminEmail.count({ where: { direction: 'inbound', isRead: false } }),
          ]),
        3,
        120
      )
    );

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
    if (countsCache) {
      return NextResponse.json(countsCache.payload, {
        headers: { 'X-Admin-Counts-Cache': 'stale' },
      });
    }
    return NextResponse.json({ error: 'Failed to load counts' }, { status: 503 });
  }
}
