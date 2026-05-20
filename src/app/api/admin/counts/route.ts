import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { withPrismaRetry } from '@/lib/prisma-retry';
import { withFreshPrisma } from '@/lib/fresh-prisma';

const COUNTS_CACHE_TTL_MS = 20_000;
let countsCache: {
  expiresAt: number;
  payload: { newOrders: number; newInquiries: number; newWaitlist: number; newEmails: number };
} | null = null;

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const now = Date.now();
    if (countsCache && countsCache.expiresAt > now) {
      return NextResponse.json(countsCache.payload, {
        headers: { 'X-Admin-Counts-Cache': 'hit' },
      });
    }

    const [newOrders, newInquiries, newWaitlist, newEmails] = await withFreshPrisma((db) =>
      db.$transaction([
        db.order.count({ where: { status: { in: ['paid', 'assembling'] } } }),
        db.inquiry.count({ where: { status: 'new' } }),
        db.waitlistRequest.count({ where: { status: 'pending' } }),
        db.adminEmail.count({ where: { direction: 'inbound', isRead: false, status: { not: 'archived' } } }),
      ])
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
    return NextResponse.json(
      { newOrders: 0, newInquiries: 0, newWaitlist: 0, newEmails: 0, degraded: true },
      { headers: { 'X-Admin-Counts-Cache': 'degraded' } }
    );
  }
}
