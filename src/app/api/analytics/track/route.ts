import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const ANALYTICS_DB_ENABLED = process.env.ANALYTICS_DB_ENABLED !== 'false';
const BOT_PATTERN = /bot|crawler|spider|crawling|headless|preview|facebookexternalhit|telegrambot|whatsapp/i;
const activeHeartbeats = new Set<string>();

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function integer(value: unknown, min: number, max: number): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : min;
}

function dateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function moscowDayStart(key: string): Date {
  return new Date(`${key}T00:00:00+03:00`);
}

function parseUserAgent(userAgent: string): { device: string; browser: string; os: string } {
  const device = /ipad|tablet|kindle/i.test(userAgent)
    ? 'Планшет'
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

function headerLocation(req: NextRequest, name: string): string {
  const value = req.headers.get(name) || '';
  try {
    return decodeURIComponent(value).slice(0, 120);
  } catch {
    return value.slice(0, 120);
  }
}

export async function POST(req: NextRequest) {
  if (!ANALYTICS_DB_ENABLED) return NextResponse.json({ ok: true, disabled: true });

  try {
    const body = await req.json();
    const type = body.type === 'heartbeat' ? 'heartbeat' : 'pageview';
    const sessionId = text(body.sessionId, 100);
    const viewId = text(body.viewId, 100);
    const path = text(body.path, 500);
    if (!sessionId || !viewId || !path.startsWith('/') || path.startsWith('/admin') || path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Invalid analytics event' }, { status: 400 });
    }

    const duration = integer(body.duration, 0, 86_400);
    const maxScroll = integer(body.maxScroll, 0, 100);
    if (type === 'heartbeat') {
      const heartbeatKey = `${sessionId}:${viewId}`;
      if (activeHeartbeats.has(heartbeatKey)) {
        return NextResponse.json({ ok: true, skipped: true }, { headers: { 'Cache-Control': 'no-store' } });
      }
      activeHeartbeats.add(heartbeatKey);
      try {
        await prisma.$executeRaw`
          UPDATE "PageView"
          SET "duration" = GREATEST("duration", ${duration}),
              "maxScroll" = GREATEST("maxScroll", ${maxScroll}),
              "lastActiveAt" = NOW()
          WHERE "viewId" = ${viewId} AND "sessionId" = ${sessionId}
        `;
        return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
      } finally {
        activeHeartbeats.delete(heartbeatKey);
      }
    }

    const userAgent = text(req.headers.get('user-agent'), 1000);
    const parsedAgent = parseUserAgent(userAgent);
    const now = new Date();
    const today = dateKey(now);
    const dayStart = moscowDayStart(today);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const ip = text(
      req.headers.get('cf-connecting-ip')
        || req.headers.get('x-forwarded-for')?.split(',')[0]
        || req.headers.get('x-real-ip'),
      120,
    );
    const country = text(req.headers.get('cf-ipcountry') || req.headers.get('x-vercel-ip-country'), 8).toUpperCase();
    const city = headerLocation(req, 'x-vercel-ip-city') || headerLocation(req, 'cf-ipcity');

    await prisma.$transaction(async (tx) => {
      const duplicate = await tx.pageView.findFirst({ where: { viewId, sessionId }, select: { id: true } });
      if (duplicate) return;
      const sessionSeenToday = await tx.pageView.count({
        where: { sessionId, createdAt: { gte: dayStart, lt: dayEnd }, isBot: false },
      });
      await tx.pageView.create({
        data: {
          viewId,
          sessionId,
          path,
          query: text(body.query, 500),
          title: text(body.title, 300),
          previousPath: text(body.previousPath, 500),
          referrer: text(body.referrer, 1000),
          userAgent,
          ip,
          country,
          city,
          lang: text(body.lang, 12),
          ...parsedAgent,
          screenWidth: integer(body.screenWidth, 0, 20_000),
          screenHeight: integer(body.screenHeight, 0, 20_000),
          timezone: text(body.timezone, 120),
          utmSource: text(body.utmSource, 120),
          utmMedium: text(body.utmMedium, 120),
          utmCampaign: text(body.utmCampaign, 180),
          utmContent: text(body.utmContent, 180),
          utmTerm: text(body.utmTerm, 180),
          duration,
          maxScroll,
          isBot: BOT_PATTERN.test(userAgent),
          lastActiveAt: now,
        },
      });
      if (!BOT_PATTERN.test(userAgent)) {
        await tx.dailyStat.upsert({
          where: { date: today },
          update: {
            views: { increment: 1 },
            visitors: { increment: sessionSeenToday === 0 ? 1 : 0 },
          },
          create: { date: today, views: 1, visitors: 1, orders: 0, revenue: 0 },
        });
      }
    });

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.warn('Analytics event skipped:', error);
    return NextResponse.json({ ok: true, skipped: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  }
}
