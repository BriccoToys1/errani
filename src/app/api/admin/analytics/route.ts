import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { withPrismaRetry } from '@/lib/prisma-retry';

type AnalyticsPayload = {
  realtime: { onlineNow: number };
  today: { views: number; visitors: number; orders: number; avgDuration: number };
  chart: Array<{ date: string; views: number; visitors: number; orders: number; revenue: number }>;
  countries: Array<{ country: string; count: number }>;
  totals: { views: number; orders: number; revenue: number; products: number; uniqueIPs: number };
};

const cache = new Map<number, { data: AnalyticsPayload; at: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const STALE_TTL_MS = 24 * 60 * 60 * 1000;

function buildDateRange(period: number, now: Date): string[] {
  const days: string[] = [];
  for (let i = period - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function getStaleCache(period: number): AnalyticsPayload | null {
  const hit = cache.get(period);
  if (!hit) return null;
  if (Date.now() - hit.at > STALE_TTL_MS) return null;
  return hit.data;
}

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const period = Math.min(Math.max(parseInt(searchParams.get('period') || '30', 10), 7), 90);

  const cached = cache.get(period);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.data, { headers: { 'X-Analytics-Cache': 'hit' } });
  }

  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const days = buildDateRange(period, now);
    const startDay = days[0];

    const withTimeout = async <T,>(promise: Promise<T>, ms = 8000): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('analytics query timeout')), ms)),
      ]);

    const [
      recentViews,
      chartRows,
      countriesRaw,
      totalViews,
      totalPaidOrders,
      totalRevenueRaw,
      totalProducts,
    ] = await withTimeout(
      withPrismaRetry(
        () =>
          prisma.$transaction([
            prisma.pageView.findMany({
              where: { createdAt: { gte: fiveMinAgo } },
              distinct: ['sessionId'],
              select: { sessionId: true },
            }),
            prisma.dailyStat.findMany({
              where: { date: { gte: startDay, lte: today } },
              orderBy: { date: 'asc' },
            }),
            prisma.pageView.groupBy({
              by: ['country'],
              where: { createdAt: { gte: new Date(`${today}T00:00:00Z`) }, country: { not: '' } },
              _count: { country: true },
              orderBy: { _count: { country: 'desc' } },
              take: 8,
            }),
            prisma.pageView.count(),
            prisma.order.count({ where: { status: 'paid' } }),
            prisma.order.aggregate({ where: { status: 'paid' }, _sum: { totalAmount: true } }),
            prisma.product.count(),
          ]),
        3,
        120
      )
    );

    const uniqueIPsRaw = await withTimeout(
      withPrismaRetry(
        () =>
          prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(DISTINCT ip)::int AS count FROM "PageView" WHERE ip != ''`,
        2,
        120
      ),
      5000
    ).catch(() => [{ count: BigInt(0) }]);

    const chartMap = new Map(chartRows.map((row) => [row.date, row]));
    const chart = days.map((date) => ({
      date,
      views: chartMap.get(date)?.views ?? 0,
      visitors: chartMap.get(date)?.visitors ?? 0,
      orders: chartMap.get(date)?.orders ?? 0,
      revenue: chartMap.get(date)?.revenue ?? 0,
    }));

    const todayRow = chartMap.get(today);
    const fallbackTotalViews = chart.reduce((sum, day) => sum + day.views, 0);
    const fallbackTotalOrders = chart.reduce((sum, day) => sum + day.orders, 0);
    const fallbackTotalRevenue = chart.reduce((sum, day) => sum + day.revenue, 0);

    const payload: AnalyticsPayload = {
      realtime: { onlineNow: recentViews.length },
      today: {
        views: todayRow?.views ?? 0,
        visitors: todayRow?.visitors ?? 0,
        orders: todayRow?.orders ?? 0,
        avgDuration: 0,
      },
      chart,
      countries: countriesRaw.map((c) => ({ country: c.country, count: c._count.country })),
      totals: {
        views: totalViews || fallbackTotalViews,
        orders: totalPaidOrders || fallbackTotalOrders,
        revenue: totalRevenueRaw._sum.totalAmount ?? fallbackTotalRevenue,
        products: totalProducts,
        uniqueIPs: Number(uniqueIPsRaw[0]?.count ?? 0),
      },
    };

    cache.set(period, { data: payload, at: Date.now() });
    return NextResponse.json(payload, { headers: { 'X-Analytics-Cache': 'miss' } });
  } catch (error) {
    console.error('Analytics error:', error);
    const stale = getStaleCache(period);
    if (stale) {
      return NextResponse.json(stale, { headers: { 'X-Analytics-Cache': 'stale' } });
    }
    return NextResponse.json({
      realtime: { onlineNow: 0 },
      today: { views: 0, visitors: 0, orders: 0, avgDuration: 0 },
      chart: [],
      countries: [],
      totals: { views: 0, orders: 0, revenue: 0, products: 0, uniqueIPs: 0 },
    }, { headers: { 'X-Analytics-Cache': 'degraded' } });
  }
}
