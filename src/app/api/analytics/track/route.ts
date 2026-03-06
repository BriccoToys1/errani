import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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
    await prisma.pageView.create({ data: { ...data, city: '' } });

    const today = new Date().toISOString().slice(0, 10);
    const todayStart = new Date(`${today}T00:00:00Z`);
    const todayEnd = new Date(`${today}T23:59:59Z`);

    const [existing, uniqueVisitors] = await Promise.all([
      prisma.dailyStat.findUnique({ where: { date: today } }),
      prisma.pageView.findMany({
        where: { createdAt: { gte: todayStart, lt: todayEnd } },
        distinct: ['sessionId'],
        select: { sessionId: true },
      }),
    ]);

    if (existing) {
      await prisma.dailyStat.update({
        where: { date: today },
        data: { views: { increment: 1 }, visitors: uniqueVisitors.length },
      });
    } else {
      await prisma.dailyStat.create({
        data: { date: today, views: 1, visitors: 1 },
      });
    }
  } catch (e) {
    console.error('Analytics save error:', e);
  }
}

export async function POST(req: NextRequest) {
  try {
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

