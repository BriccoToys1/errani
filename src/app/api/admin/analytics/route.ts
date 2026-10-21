import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';

type Breakdown = { label: string; count: number; percentage: number };

const MOSCOW_DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
});
const MOSCOW_HOUR_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Moscow', hour: '2-digit', hourCycle: 'h23',
});

function moscowDateKey(date: Date): string {
  const parts = MOSCOW_DATE_FORMATTER.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function moscowDayStart(key: string): Date {
  return new Date(`${key}T00:00:00+03:00`);
}

function sourceLabel(referrer: string, utmSource: string): string {
  if (utmSource) return utmSource;
  if (!referrer) return 'Прямой заход';
  try {
    return new URL(referrer).hostname.replace(/^www\./, '') || 'Прямой заход';
  } catch {
    return referrer.slice(0, 80);
  }
}

function userAgentInfo(userAgent: string): { device: string; browser: string; os: string } {
  const device = /ipad|tablet|kindle/i.test(userAgent) ? 'Планшет'
    : /mobi|iphone|android/i.test(userAgent) ? 'Телефон' : 'Компьютер';
  const browser = /edg\//i.test(userAgent) ? 'Edge'
    : /opr\//i.test(userAgent) ? 'Opera'
      : /yabrowser/i.test(userAgent) ? 'Яндекс Браузер'
        : /firefox\//i.test(userAgent) ? 'Firefox'
          : /crios|chrome\//i.test(userAgent) ? 'Chrome'
            : /safari\//i.test(userAgent) ? 'Safari' : 'Другой';
  const os = /iphone|ipad|ios/i.test(userAgent) ? 'iOS'
    : /android/i.test(userAgent) ? 'Android'
      : /windows/i.test(userAgent) ? 'Windows'
        : /mac os|macintosh/i.test(userAgent) ? 'macOS'
          : /linux/i.test(userAgent) ? 'Linux' : 'Другая';
  return { device, browser, os };
}

function increment(map: Map<string, number>, label: string): void {
  const normalized = label.trim() || 'Не определено';
  map.set(normalized, (map.get(normalized) || 0) + 1);
}

function breakdown(map: Map<string, number>, total: number, limit = 12): Breakdown[] {
  return [...map.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count, percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0 }));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function buildDays(start: Date, end: Date): string[] {
  const days: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && days.length < 1500) {
    days.push(moscowDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return [...new Set(days)];
}

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const requestedPeriod = searchParams.get('period') || '30';
    const customFrom = searchParams.get('from');
    const customTo = searchParams.get('to');
    const period = requestedPeriod === 'all'
      ? null
      : requestedPeriod === 'custom'
        ? null
        : Math.min(Math.max(Number.parseInt(requestedPeriod, 10) || 30, 1), 365);
    const now = new Date();
    const todayKey = moscowDateKey(now);
    const todayStart = moscowDayStart(todayKey);
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const firstView = await prisma.pageView.findFirst({
      where: { isBot: false },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    let start = period === null
      ? firstView?.createdAt || todayStart
      : new Date(todayStart.getTime() - (period - 1) * 24 * 60 * 60 * 1000);
    let end = now;
    if (requestedPeriod === 'custom' && customFrom) {
      start = moscowDayStart(customFrom.slice(0, 10));
      end = customTo ? new Date(moscowDayStart(customTo.slice(0, 10)).getTime() + 24 * 60 * 60 * 1000 - 1) : now;
    }

    const paidStatuses = ['paid', 'assembling', 'shipped', 'in_transit', 'delivered'];
    const [views, orders, allTimeRows, totalProducts, lastView] = await Promise.all([
      prisma.pageView.findMany({
        where: { createdAt: { gte: start, lte: end }, isBot: false },
        orderBy: { createdAt: 'asc' },
        select: {
          sessionId: true, path: true, query: true, title: true, previousPath: true, referrer: true,
          ip: true, country: true, city: true, lang: true, userAgent: true, device: true,
          browser: true, os: true, screenWidth: true, screenHeight: true, timezone: true,
          utmSource: true, utmMedium: true, utmCampaign: true, duration: true, maxScroll: true,
          lastActiveAt: true, createdAt: true,
        },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { createdAt: true, status: true, totalAmount: true, customerEmail: true },
      }),
      prisma.$queryRaw<Array<{ views: number; sessions: number; unique_ips: number; avg_duration: number; bounces: number; pages_per_session: number }>>`
        WITH sessions AS (
          SELECT "sessionId", COUNT(*)::int AS page_count, SUM("duration")::int AS session_duration
          FROM "PageView" WHERE "isBot" = false GROUP BY "sessionId"
        )
        SELECT
          (SELECT COUNT(*)::int FROM "PageView" WHERE "isBot" = false) AS views,
          COUNT(*)::int AS sessions,
          (SELECT COUNT(DISTINCT NULLIF("ip", ''))::int FROM "PageView" WHERE "isBot" = false) AS unique_ips,
          COALESCE(ROUND(AVG(session_duration)), 0)::int AS avg_duration,
          COUNT(*) FILTER (WHERE page_count = 1)::int AS bounces,
          COALESCE(ROUND(AVG(page_count)::numeric, 2), 0)::float AS pages_per_session
        FROM sessions
      `,
      prisma.product.count(),
      prisma.pageView.findFirst({ where: { isBot: false }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);

    type SessionAggregate = {
      views: number;
      duration: number;
      firstAt: Date;
      lastAt: Date;
      entryPath: string;
      exitPath: string;
    };
    const sessions = new Map<string, SessionAggregate>();
    const pageMap = new Map<string, { title: string; views: number; sessions: Set<string>; durations: number[]; scrolls: number[] }>();
    const sources = new Map<string, number>();
    const countries = new Map<string, number>();
    const cities = new Map<string, number>();
    const devices = new Map<string, number>();
    const browsers = new Map<string, number>();
    const operatingSystems = new Map<string, number>();
    const languages = new Map<string, number>();
    const campaigns = new Map<string, number>();
    const mediums = new Map<string, number>();
    const screens = new Map<string, number>();
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, views: 0 }));
    const daily = new Map<string, { views: number; sessions: Set<string>; durations: number[]; orders: number; revenue: number }>();

    for (const view of views) {
      const day = moscowDateKey(view.createdAt);
      if (!daily.has(day)) daily.set(day, { views: 0, sessions: new Set(), durations: [], orders: 0, revenue: 0 });
      const dayRow = daily.get(day)!;
      dayRow.views += 1;
      dayRow.sessions.add(view.sessionId);
      if (view.duration > 0) dayRow.durations.push(view.duration);

      const session = sessions.get(view.sessionId);
      const firstSessionView = !session;
      if (!session) {
        sessions.set(view.sessionId, {
          views: 1, duration: view.duration, firstAt: view.createdAt, lastAt: view.createdAt,
          entryPath: view.path, exitPath: view.path,
        });
      } else {
        session.views += 1;
        session.duration += view.duration;
        if (view.createdAt < session.firstAt) {
          session.firstAt = view.createdAt;
          session.entryPath = view.path;
        }
        if (view.createdAt >= session.lastAt) {
          session.lastAt = view.createdAt;
          session.exitPath = view.path;
        }
      }

      const page = pageMap.get(view.path) || { title: '', views: 0, sessions: new Set<string>(), durations: [], scrolls: [] };
      page.title = view.title || page.title;
      page.views += 1;
      page.sessions.add(view.sessionId);
      if (view.duration > 0) page.durations.push(view.duration);
      if (view.maxScroll > 0) page.scrolls.push(view.maxScroll);
      pageMap.set(view.path, page);

      if (firstSessionView) {
        const agent = userAgentInfo(view.userAgent);
        increment(sources, sourceLabel(view.referrer, view.utmSource));
        increment(countries, view.country);
        increment(cities, [view.city, view.country].filter(Boolean).join(', '));
        increment(devices, view.device || agent.device);
        increment(browsers, view.browser || agent.browser);
        increment(operatingSystems, view.os || agent.os);
        increment(languages, view.lang);
        if (view.utmCampaign) increment(campaigns, view.utmCampaign);
        if (view.utmMedium) increment(mediums, view.utmMedium);
        if (view.screenWidth > 0) {
          const screen = view.screenWidth <= 480 ? '≤ 480 px'
            : view.screenWidth <= 768 ? '481–768 px'
              : view.screenWidth <= 1280 ? '769–1280 px'
                : view.screenWidth <= 1920 ? '1281–1920 px' : '> 1920 px';
          increment(screens, screen);
        }
      }
      const moscowHour = Number(MOSCOW_HOUR_FORMATTER.format(view.createdAt));
      if (Number.isInteger(moscowHour) && hourly[moscowHour]) hourly[moscowHour].views += 1;
    }

    for (const order of orders) {
      const day = moscowDateKey(order.createdAt);
      if (!daily.has(day)) daily.set(day, { views: 0, sessions: new Set(), durations: [], orders: 0, revenue: 0 });
      const dayRow = daily.get(day)!;
      dayRow.orders += 1;
      if (paidStatuses.includes(order.status)) dayRow.revenue += order.totalAmount;
    }

    const days = buildDays(start, now);
    const chart = days.map((date) => {
      const row = daily.get(date);
      return {
        date,
        views: row?.views || 0,
        visitors: row?.sessions.size || 0,
        orders: row?.orders || 0,
        revenue: Math.round((row?.revenue || 0) * 100) / 100,
        avgDuration: average(row?.durations || []),
      };
    });

    const sessionValues = [...sessions.values()];
    const bounces = sessionValues.filter((session) => session.views === 1).length;
    const entryMap = new Map<string, number>();
    const exitMap = new Map<string, number>();
    sessionValues.forEach((session) => {
      increment(entryMap, session.entryPath);
      increment(exitMap, session.exitPath);
    });
    const periodOrders = orders.length;
    const paidOrders = orders.filter((order) => paidStatuses.includes(order.status));
    const todayViews = views.filter((view) => view.createdAt >= todayStart && view.createdAt < tomorrowStart);
    const todaySessionIds = new Set(todayViews.map((view) => view.sessionId));
    const todaySessions = [...todaySessionIds].map((id) => sessions.get(id)).filter(Boolean) as SessionAggregate[];
    const todayOrders = orders.filter((order) => order.createdAt >= todayStart && order.createdAt < tomorrowStart);
    const onlineSince = new Date(now.getTime() - 5 * 60 * 1000);
    const onlineViews = views.filter((view) => view.lastActiveAt >= onlineSince);
    const onlineSessions = new Set(onlineViews.map((view) => view.sessionId));
    const activePageMap = new Map<string, number>();
    onlineViews.forEach((view) => increment(activePageMap, view.path));

    const pages = [...pageMap.entries()]
      .map(([path, data]) => ({
        path,
        title: data.title,
        views: data.views,
        visitors: data.sessions.size,
        avgDuration: average(data.durations),
        avgScroll: average(data.scrolls),
      }))
      .sort((left, right) => right.views - left.views)
      .slice(0, 30);

    const allTime = allTimeRows[0] || { views: 0, sessions: 0, unique_ips: 0, avg_duration: 0, bounces: 0, pages_per_session: 0 };
    const totalPaidOrders = await prisma.order.count({ where: { status: { in: paidStatuses } } });
    const totalRevenue = await prisma.order.aggregate({ where: { status: { in: paidStatuses } }, _sum: { totalAmount: true } });
    const periodRevenue = paidOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const aov = paidOrders.length > 0 ? Math.round((periodRevenue / paidOrders.length) * 100) / 100 : 0;

    const fromKey = moscowDateKey(start);
    const toKey = moscowDateKey(end);
    const expenses = await prisma.expense.findMany({
      where: { date: { gte: fromKey, lte: toKey } },
    });
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const marketingSpend = expenses
      .filter((e) => /market|ads|реклам|маркетинг/i.test(e.category || '') || /market|ads|реклам|маркетинг/i.test(e.description || ''))
      .reduce((sum, e) => sum + e.amount, 0);
    const hasCogs = totalExpenses > 0;
    const profit = hasCogs ? Math.round((periodRevenue - totalExpenses) * 100) / 100 : null;
    const margin = hasCogs && periodRevenue > 0 ? Math.round(((periodRevenue - totalExpenses) / periodRevenue) * 1000) / 10 : null;
    const uniqueCustomers = new Set(paidOrders.map((o) => o.customerEmail).filter(Boolean)).size;
    const roas = marketingSpend > 0 ? Math.round((periodRevenue / marketingSpend) * 100) / 100 : null;
    const cac = marketingSpend > 0 && uniqueCustomers > 0 ? Math.round((marketingSpend / uniqueCustomers) * 100) / 100 : null;
    const ltv = uniqueCustomers > 0 ? Math.round((periodRevenue / uniqueCustomers) * 100) / 100 : null;

    // SEO score from real site settings + product completeness
    const [seoKeys, productSeoSample, robotsSetting] = await Promise.all([
      prisma.siteSettings.findMany({ where: { key: { in: ['seo_global', 'seo_catalog', 'seo_oferta', 'seo_privacy'] } } }),
      prisma.product.findMany({
        where: { isActive: true },
        select: { name: true, description: true, image: true, slug: true },
        take: 50,
      }),
      prisma.siteSettings.findUnique({ where: { key: 'seo_robots' } }),
    ]);
    let seoPoints = 0;
    let seoMax = 0;
    const scoreSeoPage = (raw: string | undefined) => {
      seoMax += 4;
      if (!raw) return;
      try {
        const seo = JSON.parse(raw) as { title?: string; description?: string; ogImage?: string; keywords?: string[] };
        if (seo.title && seo.title.length >= 10 && seo.title.length <= 70) seoPoints += 1;
        if (seo.description && seo.description.length >= 50 && seo.description.length <= 160) seoPoints += 1;
        if (seo.ogImage) seoPoints += 1;
        if (Array.isArray(seo.keywords) ? seo.keywords.length > 0 : false) seoPoints += 1;
      } catch { /* ignore */ }
    };
    for (const key of ['seo_global', 'seo_catalog', 'seo_oferta', 'seo_privacy']) {
      scoreSeoPage(seoKeys.find((s) => s.key === key)?.value);
    }
    seoMax += 2;
    if (robotsSetting?.value && /Sitemap:/i.test(robotsSetting.value)) seoPoints += 1;
    if (robotsSetting?.value && /User-agent:/i.test(robotsSetting.value)) seoPoints += 1;
    seoMax += 3;
    if (productSeoSample.length > 0) {
      const withDesc = productSeoSample.filter((p) => (p.description || '').length >= 40).length;
      const withImage = productSeoSample.filter((p) => Boolean(p.image)).length;
      const withSlug = productSeoSample.filter((p) => Boolean(p.slug)).length;
      if (withDesc / productSeoSample.length >= 0.7) seoPoints += 1;
      if (withImage / productSeoSample.length >= 0.9) seoPoints += 1;
      if (withSlug / productSeoSample.length >= 0.95) seoPoints += 1;
    }
    const seoScore = seoMax > 0 ? Math.round((seoPoints / seoMax) * 100) : 0;

    const payload = {
      status: {
        enabled: process.env.ANALYTICS_DB_ENABLED !== 'false',
        firstEventAt: firstView?.createdAt?.toISOString() || null,
        lastEventAt: lastView?.createdAt?.toISOString() || null,
        hasFreshData: Boolean(lastView?.createdAt && now.getTime() - lastView.createdAt.getTime() < 24 * 60 * 60 * 1000),
      },
      period: { value: requestedPeriod, from: start.toISOString(), to: end.toISOString() },
      commerce: {
        revenue: Math.round(periodRevenue * 100) / 100,
        profit,
        margin,
        orders: paidOrders.length,
        aov,
        conversionRate: percent(paidOrders.length, sessions.size),
        visitors: sessions.size,
        roas,
        cac,
        ltv,
        hasCogs,
        marketingSpend: marketingSpend > 0 ? marketingSpend : null,
        expenses: totalExpenses,
      },
      seo: { score: seoScore, checks: seoMax, passed: seoPoints },
      realtime: {
        onlineNow: onlineSessions.size,
        activePages: breakdown(activePageMap, onlineViews.length, 10),
      },
      today: {
        views: todayViews.length,
        visitors: todaySessionIds.size,
        orders: todayOrders.length,
        revenue: todayOrders.filter((order) => paidStatuses.includes(order.status)).reduce((sum, order) => sum + order.totalAmount, 0),
        avgDuration: average(todaySessions.map((session) => session.duration)),
        bounceRate: percent(todaySessions.filter((session) => session.views === 1).length, todaySessions.length),
      },
      totals: {
        views: views.length,
        visitors: sessions.size,
        uniqueIPs: new Set(views.map((view) => view.ip).filter(Boolean)).size,
        orders: periodOrders,
        paidOrders: paidOrders.length,
        revenue: Math.round(periodRevenue * 100) / 100,
        products: totalProducts,
        avgDuration: average(sessionValues.map((session) => session.duration)),
        avgPageDuration: average(views.map((view) => view.duration).filter((duration) => duration > 0)),
        pagesPerSession: sessions.size > 0 ? Math.round((views.length / sessions.size) * 100) / 100 : 0,
        bounceRate: percent(bounces, sessions.size),
        conversionRate: percent(paidOrders.length, sessions.size),
        avgScroll: average(views.map((view) => view.maxScroll).filter((scroll) => scroll > 0)),
      },
      allTime: {
        views: Number(allTime.views || 0),
        visitors: Number(allTime.sessions || 0),
        uniqueIPs: Number(allTime.unique_ips || 0),
        orders: totalPaidOrders,
        revenue: totalRevenue._sum.totalAmount || 0,
        avgDuration: Number(allTime.avg_duration || 0),
        pagesPerSession: Number(allTime.pages_per_session || 0),
        bounceRate: percent(Number(allTime.bounces || 0), Number(allTime.sessions || 0)),
      },
      chart,
      pages,
      entryPages: breakdown(entryMap, sessions.size, 15),
      exitPages: breakdown(exitMap, sessions.size, 15),
      sources: breakdown(sources, sessions.size, 15),
      countries: breakdown(countries, sessions.size, 15).map((item) => ({ country: item.label === 'Не определено' ? '' : item.label, count: item.count, percentage: item.percentage })),
      cities: breakdown(cities, sessions.size, 15),
      devices: breakdown(devices, sessions.size),
      browsers: breakdown(browsers, sessions.size),
      operatingSystems: breakdown(operatingSystems, sessions.size),
      languages: breakdown(languages, sessions.size),
      campaigns: breakdown(campaigns, sessions.size, 20),
      mediums: breakdown(mediums, sessions.size, 20),
      screens: breakdown(screens, sessions.size),
      hourly,
      recent: [...views].reverse().slice(0, 50).map((view) => {
        const agent = userAgentInfo(view.userAgent);
        return {
          at: view.createdAt.toISOString(),
          path: view.path,
          title: view.title,
          duration: view.duration,
          scroll: view.maxScroll,
          device: view.device || agent.device,
          browser: view.browser || agent.browser,
          os: view.os || agent.os,
          country: view.country,
          city: view.city,
          source: sourceLabel(view.referrer, view.utmSource),
          session: view.sessionId.slice(0, 8),
        };
      }),
    };

    return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Не удалось загрузить аналитику.' }, { status: 500 });
  }
}
