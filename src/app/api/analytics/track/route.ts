import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST — record a page view (called from client-side tracker)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, path, referrer, lang, duration } = body;

    if (!sessionId || !path) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || '';
    const userAgent = req.headers.get('user-agent') || '';

    // Simple country detection from Accept-Language or Cloudflare header
    const country = req.headers.get('cf-ipcountry')
      || req.headers.get('x-vercel-ip-country')
      || '';

    await prisma.pageView.create({
      data: {
        sessionId,
        path,
        referrer: referrer || '',
        userAgent,
        ip,
        country,
        city: '',
        lang: lang || '',
        duration: duration || 0,
      },
    });

    // Update daily stats
    const today = new Date().toISOString().slice(0, 10);
    const existing = await prisma.dailyStat.findUnique({ where: { date: today } });

    if (existing) {
      // Count unique sessions today
      const uniqueVisitors = await prisma.pageView.findMany({
        where: {
          createdAt: {
            gte: new Date(`${today}T00:00:00Z`),
            lt: new Date(`${today}T23:59:59Z`),
          },
        },
        distinct: ['sessionId'],
        select: { sessionId: true },
      });

      await prisma.dailyStat.update({
        where: { date: today },
        data: {
          views: { increment: 1 },
          visitors: uniqueVisitors.length,
        },
      });
    } else {
      await prisma.dailyStat.create({
        data: { date: today, views: 1, visitors: 1 },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Analytics track error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
