import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard, verifyAdminToken } from '@/lib/admin-auth';
import { Resend } from 'resend';
import { withPrismaRetry } from '@/lib/prisma-retry';

const emailListCache = new Map<string, { ts: number; payload: { emails: unknown[]; unreadCount: number } }>();

async function getApiKey(): Promise<string | null> {
  const envKey = process.env.RESEND_API_KEY;
  if (envKey) return envKey;
  try {
    const s = await withPrismaRetry(
      () => prisma.siteSettings.findUnique({ where: { key: 'resend_api_key' } }),
      2,
      80
    );
    return s?.value || null;
  } catch { return null; }
}

// GET: list all emails (inbox + sent)
export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const folder = req.nextUrl.searchParams.get('folder') || 'all';
  const search = req.nextUrl.searchParams.get('search') || '';
  const cacheKey = JSON.stringify({ folder, search: search.trim().toLowerCase() });

  try {
    const where: Record<string, unknown> = { status: { not: 'archived' } };
    if (folder === 'inbox') where.direction = 'inbound';
    else if (folder === 'sent') where.direction = 'outbound';

    if (search) {
      where.OR = [
        { fromAddr: { contains: search, mode: 'insensitive' } },
        { toAddr: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { textBody: { contains: search, mode: 'insensitive' } },
      ];
    }

    const emails = await withPrismaRetry(() => prisma.adminEmail.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }), 2, 80);
    const unreadCount = await withPrismaRetry(() => prisma.adminEmail.count({
      where: { direction: 'inbound', isRead: false, status: { not: 'archived' } },
    }), 2, 80);

    const payload = { emails, unreadCount };
    emailListCache.set(cacheKey, { ts: Date.now(), payload });
    return NextResponse.json(payload, {
      headers: {
        'X-Email-Cache': 'bypass',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Email list error:', error);
    const stale = emailListCache.get(cacheKey);
    if (stale) {
      return NextResponse.json(stale.payload, { headers: { 'X-Email-Cache': 'stale' } });
    }
    return NextResponse.json({ emails: [], unreadCount: 0, degraded: true }, { headers: { 'X-Email-Cache': 'degraded' } });
  }
}

// POST: send an email
export async function POST(req: NextRequest) {
  const admin = verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { to, subject, body, replyTo } = await req.json();

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Заполните все поля' }, { status: 400 });
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'Email не настроен: укажите Resend API Key в Настройках → Интеграции → Resend' }, { status: 500 });
    }

    const resend = new Resend(apiKey);

    const result = await resend.emails.send({
      from: 'errani <mail@errani.ru>',
      to: to.trim(),
      subject: subject.trim(),
      html: body,
      replyTo: 'mail@errani.ru',
    });

    // Save to database
    const email = await withPrismaRetry(() => prisma.adminEmail.create({
      data: {
        direction: 'outbound',
        fromAddr: 'mail@errani.ru',
        toAddr: to.trim(),
        subject: subject.trim(),
        body,
        textBody: body.replace(/<[^>]*>/g, ''),
        status: 'sent',
        isRead: true,
        resendId: result.data?.id || '',
        inReplyTo: replyTo || '',
      },
    }), 2, 80);
    emailListCache.clear();

    return NextResponse.json({ success: true, id: email.id });
  } catch (error) {
    console.error('Send email error:', error);
    return NextResponse.json({ error: 'Ошибка отправки' }, { status: 500 });
  }
}

// PUT: mark email(s) as read
export async function PUT(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { ids, markAll } = await req.json();

    if (markAll) {
      await withPrismaRetry(() => prisma.adminEmail.updateMany({
        where: { direction: 'inbound', isRead: false },
        data: { isRead: true },
      }), 2, 80);
    } else if (ids?.length) {
      await withPrismaRetry(() => prisma.adminEmail.updateMany({
        where: { id: { in: ids } },
        data: { isRead: true },
      }), 2, 80);
    }
    emailListCache.clear();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// DELETE: archive email(s) without removing rows from the database
export async function DELETE(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { ids } = await req.json();
    if (ids?.length) {
      await withPrismaRetry(() => prisma.adminEmail.updateMany({
        where: { id: { in: ids } },
        data: { status: 'archived' },
      }), 2, 80);
    }
    emailListCache.clear();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete email error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
