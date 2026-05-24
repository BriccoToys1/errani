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
    return (raw as unknown[]).map((r) => {
      if (typeof r === 'string') return r;
      const obj = r as Record<string, string>;
      return obj.address || obj.email || obj.name || '';
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
    return NextResponse.json({ error: 'RESEND_API_KEY не настроен', synced: 0 });
  }

  try {
    const resend = new Resend(apiKey);

    // Fetch received emails via Resend API
    const { data, error } = await resend.emails.receiving.list();

    if (error) {
      console.error('Resend receiving.list error:', error);
      return NextResponse.json({ error: `Resend error: ${error.message}`, synced: 0 });
    }

    // Resend returns { data: [...] } or { data: { data: [...] } }
    const rawData = data as unknown;
    let emails: Record<string, unknown>[] = [];
    if (Array.isArray(rawData)) {
      emails = rawData as Record<string, unknown>[];
    } else if (rawData && typeof rawData === 'object') {
      const nested = (rawData as Record<string, unknown>).data;
      if (Array.isArray(nested)) emails = nested as Record<string, unknown>[];
    }

    console.log(`Resend receiving: ${emails.length} emails found`);

    let synced = 0;
    for (const email of emails) {
      const resendId = String(email.id || '').trim();
      if (!resendId) continue;

      // Skip duplicates
      const existing = await prisma.adminEmail.findFirst({
        where: { resendId },
        select: { id: true },
      });
      if (existing) continue;

      // Fetch full email body via receiving.get()
      let body = '';
      let textBody = '';
      try {
        const { data: full } = await resend.emails.receiving.get(resendId);
        if (full) {
          const f = full as unknown as Record<string, unknown>;
          body = String(f.html || f.body || '');
          textBody = String(f.text || f.text_body || '');
        }
      } catch { /* use list data as fallback */ }

      if (!body) {
        body = String(email.html || email.body || `<pre style="white-space:pre-wrap;font-family:inherit;">${email.text || email.text_body || '(без текста)'}</pre>`);
      }
      if (!textBody) {
        textBody = String(email.text || email.text_body || email.subject || '');
      }

      const spamStatus = String(email.spam_status || 'pass').toLowerCase();
      const isSpam = spamStatus === 'spam';

      await withPrismaRetry(() => prisma.adminEmail.create({
        data: {
          direction: 'inbound',
          fromAddr: extractAddr(email.from) || 'unknown',
          toAddr: extractAddr(email.to) || 'mail@errani.ru',
          subject: String(email.subject || '(без темы)'),
          body,
          textBody,
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
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Email sync error:', msg);
    return NextResponse.json({ error: msg, synced: 0 });
  }
}
