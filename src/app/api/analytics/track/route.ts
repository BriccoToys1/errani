import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const ANALYTICS_DB_ENABLED = process.env.ANALYTICS_DB_ENABLED === 'true';

async function saveAnalytics(data: {
  sessionId: string;
  path: string;
  referrer: string;
  userAgent: string;
  ip: string;
  country: string;
  lang: string;
  duration: number;
}) {
  try {
    const today = new Date().toISOString().slice(0, 10);

    if (data.duration === 0) {
      // Arrival beacon: keep DB work minimal to avoid exhausting connection pool.
      await prisma.pageView.create({ data: { ...data, city: '' } });

      await prisma.dailyStat.upsert({
        where: { date: today },
        update: { views: { increment: 1 } },
        create: { date: today, views: 1, visitors: 0, orders: 0, revenue: 0 },
      });
    } else {
      // Departure beacon — just update duration on most recent matching record
      const recent = await prisma.pageView.findFirst({
        where: {
          sessionId: data.sessionId,
          path: data.path,
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (recent) {
        await prisma.pageView.update({
          where: { id: recent.id },
          data: { duration: data.duration },
        });
      }
    }
  } catch (e) {
    console.error('Analytics save error:', e);
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!ANALYTICS_DB_ENABLED) {
      return NextResponse.json({ ok: true });
    }

    const body = await req.json();
    const { sessionId, path, referrer, lang, duration } = body;

    if (!sessionId || !path) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip') || '';
    const userAgent = req.headers.get('user-agent') || '';
    const country = req.headers.get('x-vercel-ip-country') || '';

    // Отвечаем клиенту немедленно — не ждём записи в БД
    const response = NextResponse.json({ ok: true });

    // Запись в фоне (не блокирует ответ)
    saveAnalytics({
      sessionId,
      path,
      referrer: referrer || '',
      userAgent,
      ip,
      country,
      lang: lang || '',
      duration: duration || 0,
    });

    return response;
  } catch (e) {
    console.error('Analytics track error:', e);
    return NextResponse.json({ ok: true }); // Всегда 200 — не мешаем пользователю
  }
}
