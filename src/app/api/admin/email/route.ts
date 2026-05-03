import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard, verifyAdminToken } from '@/lib/admin-auth';
import { Resend } from 'resend';

async function getApiKey(): Promise<string | null> {
  const envKey = process.env.RESEND_API_KEY;
  if (envKey) return envKey;
  try {
    const s = await prisma.siteSettings.findUnique({ where: { key: 'resend_api_key' } });
    return s?.value || null;
  } catch { return null; }
}

// GET: list all emails (inbox + sent)
export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const folder = req.nextUrl.searchParams.get('folder') || 'all';
  const search = req.nextUrl.searchParams.get('search') || '';

  try {
    const where: Record<string, unknown> = {};
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

    const emails = await prisma.adminEmail.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const unreadCount = await prisma.adminEmail.count({
      where: { direction: 'inbound', isRead: false },
    });

    return NextResponse.json({ emails, unreadCount });
  } catch (error) {
    console.error('Email list error:', error);
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 });
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
    const email = await prisma.adminEmail.create({
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
    });

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
      await prisma.adminEmail.updateMany({
        where: { direction: 'inbound', isRead: false },
        data: { isRead: true },
      });
    } else if (ids?.length) {
      await prisma.adminEmail.updateMany({
        where: { id: { in: ids } },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// DELETE: delete email(s)
export async function DELETE(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { ids } = await req.json();
    if (ids?.length) {
      await prisma.adminEmail.deleteMany({ where: { id: { in: ids } } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete email error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
