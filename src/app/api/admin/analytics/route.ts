import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { withPrismaRetry } from '@/lib/prisma-retry';

// Server-side cache keyed by period (ms)
const cache = new Map<number, { data: unknown; at: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const period = Math.min(Math.max(parseInt(searchParams.get('period') || '30', 10), 7), 90);

    // Return cached response if fresh
    const cached = cache.get(period);
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const todayStart = new Date(`${today}T00:00:00Z`);
    const todayEnd = new Date(`${today}T23:59:59Z`);
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Run independent queries in parallel with retry on connection errors
    const [
      recentViews,
      todayViews,
      todayVisitors,
      todayOrderCount,
      avgDurationRaw,
      countriesRaw,
      uniqueIPsRaw,
      dailyStats,
      totalViews,
      totalOrdersRaw,
      totalRevenueRaw,
      totalProducts,
    ] = await withPrismaRetry(() => Promise.all([
      // Realtime: distinct sessions in last 5 min
      prisma.pageView.findMany({
        where: { createdAt: { gte: fiveMinAgo } },
        distinct: ['sessionId'],
        select: { sessionId: true },
      }),
      // Today views
      prisma.pageView.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
      // Today visitors (distinct sessions)
      prisma.pageView.findMany({
        where: { createdAt: { gte: todayStart, lte: todayEnd } },
        distinct: ['sessionId'],
        select: { sessionId: true },
      }),
      // Today orders
      prisma.order.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
      // Avg session duration today
      prisma.pageView.aggregate({
        where: { createdAt: { gte: todayStart, lte: todayEnd }, duration: { gt: 0 } },
        _avg: { duration: true },
      }),
      // Countries today
      prisma.pageView.groupBy({
        by: ['country'],
        where: { createdAt: { gte: todayStart, lte: todayEnd }, country: { not: '' } },
        _count: { country: true },
        orderBy: { _count: { country: 'desc' } },
        take: 8,
      }),
      // Unique IPs via raw SQL (avoids loading all rows)
      prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(DISTINCT ip)::int AS count FROM "PageView" WHERE ip != ''`,
      // Chart data: pull from DailyStat (pre-aggregated, fast)
      prisma.dailyStat.findMany({
        where: {
          date: {
            gte: (() => { const d = new Date(now); d.setDate(d.getDate() - (period - 1)); return d.toISOString().slice(0, 10); })(),
            lte: today,
          },
        },
        orderBy: { date: 'asc' },
      }),
      // Total views (fast with index)
      prisma.pageView.count(),
      // Total paid orders
      prisma.order.count({ where: { status: 'paid' } }),
      // Total revenue
      prisma.order.aggregate({ where: { status: 'paid' }, _sum: { totalAmount: true } }),
      // Product count
      prisma.product.count(),
    ]));

    // Build chart: fill gaps with 0
    const days: string[] = [];
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const dailyMap = new Map(dailyStats.map((s) => [s.date, s]));
    const chart = days.map((date) => ({
      date,
      views: dailyMap.get(date)?.views ?? 0,
      visitors: dailyMap.get(date)?.visitors ?? 0,
      orders: dailyMap.get(date)?.orders ?? 0,
      revenue: dailyMap.get(date)?.revenue ?? 0,
    }));

    const result = {
      realtime: { onlineNow: recentViews.length },
      today: {
        views: todayViews,
        visitors: todayVisitors.length,
        orders: todayOrderCount,
        avgDuration: Math.round(avgDurationRaw._avg.duration ?? 0),
      },
      chart,
      countries: countriesRaw.map((c) => ({ country: c.country, count: c._count.country })),
      totals: {
        views: totalViews,
        orders: totalOrdersRaw,
        revenue: totalRevenueRaw._sum.totalAmount ?? 0,
        products: totalProducts,
        uniqueIPs: Number(uniqueIPsRaw[0]?.count ?? 0),
      },
    };

    cache.set(period, { data: result, at: Date.now() });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
