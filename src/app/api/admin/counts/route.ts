import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { withFreshPrisma } from '@/lib/fresh-prisma';
import {
  getAdminCountsCache,
  setAdminCountsCache,
  VIEWED_SETTING_KEYS,
  type AdminCountsPayload,
} from '@/lib/admin-counts-cache';

const COUNTS_CACHE_TTL_MS = 20_000;

async function readViewedAt(db: typeof prisma, key: string): Promise<Date> {
  const row = await db.siteSettings.findUnique({ where: { key } });
  return row?.value ? new Date(row.value) : new Date(0);
}

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const now = Date.now();
    const cached = getAdminCountsCache();
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(cached.payload, {
        headers: { 'X-Admin-Counts-Cache': 'hit' },
      });
    }

    const payload = await withFreshPrisma(async (db) => {
      const [ordersViewedAt, waitlistViewedAt, reviewsViewedAt] = await Promise.all([
        readViewedAt(db, VIEWED_SETTING_KEYS.orders),
        readViewedAt(db, VIEWED_SETTING_KEYS.waitlist),
        readViewedAt(db, VIEWED_SETTING_KEYS.reviews),
      ]);

      const [newOrders, newInquiries, newWaitlist, newEmails, newReviews] = await db.$transaction([
        db.order.count({
          where: {
            status: { in: ['paid', 'assembling'] },
            createdAt: { gt: ordersViewedAt },
          },
        }),
        db.inquiry.count({ where: { status: 'new' } }),
        db.waitlistRequest.count({
          where: { status: 'pending', createdAt: { gt: waitlistViewedAt } },
        }),
        db.adminEmail.count({
          where: { direction: 'inbound', isRead: false, status: { not: 'archived' } },
        }),
        db.review.count({
          where: { status: 'pending', createdAt: { gt: reviewsViewedAt } },
        }),
      ]);

      return {
        newOrders,
        newInquiries,
        newWaitlist,
        newEmails,
        newReviews,
      } satisfies AdminCountsPayload;
    });

    setAdminCountsCache({ expiresAt: now + COUNTS_CACHE_TTL_MS, payload });
    return NextResponse.json(payload, {
      headers: { 'X-Admin-Counts-Cache': 'miss' },
    });
  } catch (error) {
    console.error('Counts error:', error);
    const cached = getAdminCountsCache();
    if (cached) {
      // Never invent zeros — serve last known good counts while DB recovers.
      return NextResponse.json(cached.payload, {
        headers: { 'X-Admin-Counts-Cache': 'stale' },
      });
    }
    return NextResponse.json(
      {
        error: 'Не удалось загрузить счётчики',
        degraded: true,
      },
      { status: 503, headers: { 'X-Admin-Counts-Cache': 'unavailable' } }
    );
  }
}
