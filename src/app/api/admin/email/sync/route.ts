import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { Resend } from 'resend';
import { withPrismaRetry } from '@/lib/prisma-retry';

async function getApiKey(): Promise<string | null> {
  const envKey = process.env.RESEND_API_KEY;
  if (envKey) return envKey;
  try {
    const s = await withPrismaRetry(
      () => prisma.siteSettings.findUnique({ where: { key: 'resend_api_key' } }),
      2, 80
    );
    return s?.value || null;
  } catch { return null; }
}

function extractAddr(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw.map((r: unknown) => {
      if (typeof r === 'string') return r;
      const obj = r as Record<string, string>;
      return obj.address || obj.email || '';
    }).filter(Boolean).join(', ');
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, string>;
    return obj.address || obj.email || obj.name || '';
  }
  return '';
}

export async function POST(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const apiKey = await getApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: 'Resend API key not configured', synced: 0 }, { status: 200 });
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.receiving.list();

    console.log('Resend receiving.list raw:', JSON.stringify(result).substring(0, 500));

    if (result.error) {
      return NextResponse.json({ error: String(result.error?.message || 'API error'), synced: 0, debug: result.error }, { status: 200 });
    }

    if (!result.data) {
      return NextResponse.json({ error: 'no data returned', synced: 0 }, { status: 200 });
    }

    const emails: Record<string, unknown>[] = Array.isArray(result.data)
      ? (result.data as Record<string, unknown>[])
      : ((result.data as { data?: Record<string, unknown>[] }).data || []);

    console.log('Resend receiving emails count:', emails.length, 'first:', emails[0] ? JSON.stringify(emails[0]).substring(0, 200) : 'none');

    let synced = 0;
    for (const email of emails) {
      const resendId = String(email.id || '').trim();
      if (!resendId) continue;

      const existing = await prisma.adminEmail.findFirst({
        where: { resendId },
        select: { id: true },
      });
      if (existing) continue;

      const spamStatus = String(email.spam_status || 'pass').toLowerCase();
      const isSpam = spamStatus === 'spam' || spamStatus.includes('fail');

      await withPrismaRetry(() => prisma.adminEmail.create({
        data: {
          direction: 'inbound',
          fromAddr: extractAddr(email.from) || 'unknown',
          toAddr: extractAddr(email.to) || 'mail@errani.ru',
          subject: String(email.subject || '(без темы)'),
          body: String(email.html || email.body || `<pre style="white-space:pre-wrap;font-family:inherit;">${email.text || '(без текста)'}</pre>`),
          textBody: String(email.text || email.subject || ''),
          status: isSpam ? 'spam' : 'received',
          isRead: false,
          resendId,
          inReplyTo: String(email.in_reply_to || ''),
          createdAt: email.created_at ? new Date(String(email.created_at)) : new Date(),
        },
      }), 2, 80);
      synced++;
    }

    return NextResponse.json({ synced, total: emails.length, ok: true });
  } catch (error) {
    console.error('Email sync error:', error);
    return NextResponse.json({ error: 'Sync failed', synced: 0 }, { status: 200 });
  }
}
