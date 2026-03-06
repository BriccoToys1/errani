import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const period = Math.min(Math.max(parseInt(searchParams.get('period') || '30', 10), 7), 90);
    
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const todayStart = new Date(`${today}T00:00:00Z`);
    const todayEnd = new Date(`${today}T23:59:59Z`);

    // --- Real-time: online in last 5 minutes ---
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const recentViews = await prisma.pageView.findMany({
      where: { createdAt: { gte: fiveMinAgo } },
      distinct: ['sessionId'],
      select: { sessionId: true },
    });
    const onlineNow = recentViews.length;

    // --- Today stats ---
    const todayViews = await prisma.pageView.count({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
    });
    const todayVisitors = await prisma.pageView.findMany({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
      distinct: ['sessionId'],
      select: { sessionId: true },
    });
    const todayOrderCount = await prisma.order.count({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
    });

    // --- Chart data for selected period ---
    const days = [];
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const dailyStats = await prisma.dailyStat.findMany({
      where: { date: { in: days } },
      orderBy: { date: 'asc' },
    });
    const dailyMap = new Map(dailyStats.map((s) => [s.date, s]));
    const chartData = days.map((date) => ({
      date,
      views: dailyMap.get(date)?.views ?? 0,
      visitors: dailyMap.get(date)?.visitors ?? 0,
      orders: dailyMap.get(date)?.orders ?? 0,
      revenue: dailyMap.get(date)?.revenue ?? 0,
    }));

    // --- Top pages today ---
    const topPagesRaw = await prisma.pageView.groupBy({
      by: ['path'],
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
      _count: { path: true },
      orderBy: { _count: { path: 'desc' } },
      take: 10,
    });
    const topPages = topPagesRaw.map((p) => ({
      path: p.path,
      views: p._count.path,
    }));

    // --- Countries ---
    const countriesRaw = await prisma.pageView.groupBy({
      by: ['country'],
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        country: { not: '' },
      },
      _count: { country: true },
      orderBy: { _count: { country: 'desc' } },
      take: 10,
    });
    const countries = countriesRaw.map((c) => ({
      country: c.country,
      count: c._count.country,
    }));

    // --- Languages ---
    const langsRaw = await prisma.pageView.groupBy({
      by: ['lang'],
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        lang: { not: '' },
      },
      _count: { lang: true },
      orderBy: { _count: { lang: 'desc' } },
      take: 10,
    });
    const languages = langsRaw.map((l) => ({
      lang: l.lang,
      count: l._count.lang,
    }));

    // --- Average session duration ---
    const avgDuration = await prisma.pageView.aggregate({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        duration: { gt: 0 },
      },
      _avg: { duration: true },
    });

    // --- Referrers ---
    const referrersRaw = await prisma.pageView.groupBy({
      by: ['referrer'],
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        referrer: { not: '' },
      },
      _count: { referrer: true },
      orderBy: { _count: { referrer: 'desc' } },
      take: 10,
    });
    const referrers = referrersRaw.map((r) => ({
      referrer: r.referrer,
      count: r._count.referrer,
    }));

    // --- Unique IPs (all time) ---
    const uniqueIPsRaw = await prisma.pageView.findMany({
      distinct: ['ip'],
      where: { ip: { not: '' } },
      select: { ip: true },
    });
    const uniqueIPs = uniqueIPsRaw.length;

    // --- Device detection (mobile vs desktop) from userAgent ---
    const userAgentsRaw = await prisma.pageView.findMany({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        userAgent: { not: '' },
      },
      select: { userAgent: true },
    });
    
    let mobileCount = 0;
    let desktopCount = 0;
    const mobileRegex = /mobile|android|iphone|ipad|ipod|blackberry|opera mini|iemobile/i;
    
    for (const row of userAgentsRaw) {
      if (mobileRegex.test(row.userAgent)) {
        mobileCount++;
      } else {
        desktopCount++;
      }
    }
    
    const devices = [
      { device: 'desktop', count: desktopCount },
      { device: 'mobile', count: mobileCount },
    ].filter(d => d.count > 0);

    // --- Total stats ---
    const totalViews = await prisma.pageView.count();
    const totalOrders = await prisma.order.count();
    const totalRevenue = await prisma.order.aggregate({ _sum: { totalAmount: true } });
    const totalProducts = await prisma.product.count();

    return NextResponse.json({
      realtime: { onlineNow },
      today: {
        views: todayViews,
        visitors: todayVisitors.length,
        orders: todayOrderCount,
        avgDuration: Math.round(avgDuration._avg.duration ?? 0),
      },
      chart: chartData,
      topPages,
      countries,
      languages,
      referrers,
      devices,
      totals: {
        views: totalViews,
        orders: totalOrders,
        revenue: totalRevenue._sum.totalAmount ?? 0,
        products: totalProducts,
        uniqueIPs,
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
