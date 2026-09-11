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

// The list endpoint only returns metadata (no html/text). Fetch the full
// message body for a single inbound email; falls back to metadata on error.
async function fetchFullBody(
  resend: Resend,
  resendId: string,
  fallback: Record<string, unknown>
): Promise<{ body: string; textBody: string }> {
  try {
    const { data, error } = await resend.emails.receiving.get(resendId);
    if (!error && data) {
      return pickBody(data as unknown as Record<string, unknown>);
    }
  } catch {
    // fall through to metadata-only body
  }
  return pickBody(fallback);
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

    // Cap the number of per-message body fetches per run so a large backlog
    // can't stall the request; remaining items get picked up on the next sync.
    const MAX_BODY_FETCHES = 40;
    let bodyFetches = 0;
    let synced = 0;
    let backfilled = 0;
    for (const email of emails) {
      const resendId = String(email.id || '').trim();
      const messageId = String(email.message_id || '').trim();
      if (!resendId) continue;

      // Skip duplicates, but backfill placeholder bodies saved by the old sync logic.
      const existing = await prisma.adminEmail.findFirst({
        where: { OR: [{ resendId }, ...(messageId ? [{ resendId: messageId }] : [])] },
        select: { id: true, body: true },
      });
      if (existing) {
        const isPlaceholder = existing.body.startsWith('<pre');
        if (isPlaceholder && bodyFetches < MAX_BODY_FETCHES) {
          bodyFetches++;
          const bodyData = await fetchFullBody(resend, resendId, email);
          if (!bodyData.body.startsWith('<pre')) {
            await withPrismaRetry(() => prisma.adminEmail.update({
              where: { id: existing.id },
              data: { body: bodyData.body, textBody: bodyData.textBody },
            }), 2, 80);
            backfilled++;
          }
        }
        continue;
      }

      const spamStatus = String(email.spam_status || 'pass').toLowerCase();
      const isSpam = spamStatus === 'spam';

      let bodyData: { body: string; textBody: string };
      if (bodyFetches < MAX_BODY_FETCHES) {
        bodyFetches++;
        bodyData = await fetchFullBody(resend, resendId, email);
      } else {
        bodyData = pickBody(email);
      }

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

    return NextResponse.json({ synced, backfilled, total: emails.length, ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Email sync error:', msg);
    return NextResponse.json({ error: msg, synced: 0 });
  }
}
