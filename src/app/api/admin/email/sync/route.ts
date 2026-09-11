import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { Resend } from 'resend';
import { withPrismaRetry } from '@/lib/prisma-retry';

async function getApiKey(): Promise<string | null> {
  try {
    const s = await withPrismaRetry(
      () => prisma.siteSettings.findUnique({ where: { key: 'resend_api_key' } }),
      2, 80
    );
    const dbKey = s?.value?.trim();
    if (dbKey) return dbKey;
  } catch {
    // Fall back to the server environment when the database is unavailable.
  }
  return process.env.RESEND_API_KEY?.trim() || null;
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

function extractList(rawData: unknown): { emails: Record<string, unknown>[]; hasMore: boolean } {
  if (Array.isArray(rawData)) {
    return { emails: rawData as Record<string, unknown>[], hasMore: false };
  }
  if (rawData && typeof rawData === 'object') {
    const obj = rawData as Record<string, unknown>;
    const nested = Array.isArray(obj.data) ? obj.data : [];
    return {
      emails: nested as Record<string, unknown>[],
      hasMore: Boolean(obj.has_more),
    };
  }
  return { emails: [], hasMore: false };
}

function pickBody(email: Record<string, unknown>) {
  const html = String(email.html || email.body || '');
  const text = String(email.text || email.text_body || email.subject || '');
  return {
    body: html || `<pre style="white-space:pre-wrap;font-family:inherit;">${text || '(без текста)'}</pre>`,
    textBody: text,
  };
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

    const emails: Record<string, unknown>[] = [];
    let after: string | undefined;
    for (let page = 0; page < 5; page++) {
      const { data, error } = await resend.emails.receiving.list({ limit: 100, ...(after ? { after } : {}) });
      if (error) {
        console.error('Resend receiving.list error:', error);
        return NextResponse.json({ error: `Resend error: ${error.message}`, synced: 0 });
      }

      const pageData = extractList(data as unknown);
      emails.push(...pageData.emails);
      const lastId = String(pageData.emails.at(-1)?.id || '').trim();
      if (!pageData.hasMore || !lastId) break;
      after = lastId;
    }

    console.log(`Resend receiving: ${emails.length} emails found`);

    let synced = 0;
    for (const email of emails) {
      const resendId = String(email.id || '').trim();
      const messageId = String(email.message_id || '').trim();
      if (!resendId) continue;

      // Skip duplicates
      const existing = await prisma.adminEmail.findFirst({
        where: { OR: [{ resendId }, ...(messageId ? [{ resendId: messageId }] : [])] },
        select: { id: true },
      });
      if (existing) continue;

      // The receiving list already contains the message metadata/body needed by
      // the inbox. Calling receiving.get() for every message makes Resend's
      // current API stall the sync request, so use the list payload directly.
      const bodyData = pickBody(email);

      const spamStatus = String(email.spam_status || 'pass').toLowerCase();
      const isSpam = spamStatus === 'spam';

      await withPrismaRetry(() => prisma.adminEmail.create({
        data: {
          direction: 'inbound',
          fromAddr: extractAddr(email.from) || 'unknown',
          toAddr: extractAddr(email.to) || extractAddr(email.received_for) || 'mail@errani.ru',
          subject: String(email.subject || '(без темы)'),
          body: bodyData.body,
          textBody: bodyData.textBody,
          status: isSpam ? 'spam' : 'received',
          isRead: false,
          resendId: resendId || messageId,
          inReplyTo: String(email.in_reply_to || email.reply_to || ''),
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
