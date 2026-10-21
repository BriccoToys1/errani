import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard, verifyAdminToken } from '@/lib/admin-auth';
import { Resend } from 'resend';
import { withPrismaRetry } from '@/lib/prisma-retry';
import { withFreshPrisma } from '@/lib/fresh-prisma';
import {
  dialogThreadId,
  extractDisplayName,
  extractEmailAddress,
  isSystemMailAddress,
  newsletterThreadId,
} from '@/lib/mail-thread';
import { buildBrandedEmailHtml, isBrandedEmail, textToHtml } from '@/lib/email-template';
import { ensureAdminSchema } from '@/lib/ensure-schema';
import {
  DEFAULT_MAILBOX,
  MAILBOXES_SETTING_KEY,
  mailboxMessageWhere,
  newsletterFromMailbox,
  normalizeMailbox,
  parseMailboxConfig,
  enabledMailboxes,
} from '@/lib/mailboxes';
import crypto from 'crypto';

async function getApiKey(): Promise<string | null> {
  try {
    const s = await withPrismaRetry(
      () => prisma.siteSettings.findUnique({ where: { key: 'resend_api_key' } }),
      2,
      80
    );
    const dbKey = s?.value?.trim();
    if (dbKey) return dbKey;
  } catch {
    // Fall back to the server environment when the database is unavailable.
  }
  return process.env.RESEND_API_KEY?.trim() || null;
}

const HIDDEN_STATUSES = ['archived', 'spam'];

function searchWhere(search: string) {
  if (!search) return {};
  return {
    OR: [
      { fromAddr: { contains: search, mode: 'insensitive' as const } },
      { toAddr: { contains: search, mode: 'insensitive' as const } },
      { subject: { contains: search, mode: 'insensitive' as const } },
      { textBody: { contains: search, mode: 'insensitive' as const } },
      { body: { contains: search, mode: 'insensitive' as const } },
    ],
  };
}

function parseRecipients(to: string | string[] | undefined): string[] {
  const raw = Array.isArray(to) ? to : String(to || '').split(/[,;\s]+/);
  const emails = raw.map((v) => extractEmailAddress(v)).filter(Boolean);
  return Array.from(new Set(emails.map((e) => e.toLowerCase())));
}

type MailAttachmentIn = { filename?: string; content?: string; contentType?: string };

function parseAttachments(list: MailAttachmentIn[] | undefined) {
  if (!Array.isArray(list) || list.length === 0) return [];
  return list
    .filter((a) => a?.filename && a?.content)
    .slice(0, 10)
    .map((a) => ({
      filename: String(a.filename).slice(0, 180),
      content: String(a.content).replace(/^data:[^;]+;base64,/, ''),
      contentType: a.contentType || undefined,
    }));
}

function preview(text: string, max = 160) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * GET
 *  ?view=dialogs[&search=]      → conversations (one per counterpart)
 *  ?view=newsletters[&search=]  → newsletter campaigns with recipients
 *  ?thread=<threadId>           → all messages of a conversation (+ quoted parents)
 *  ?folder=…                    → legacy flat list
 */
export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const params = req.nextUrl.searchParams;
  const view = params.get('view') || '';
  const thread = params.get('thread') || '';
  const search = (params.get('search') || '').trim();
  const mailbox = normalizeMailbox(params.get('mailbox'));

  try {
    await ensureAdminSchema(prisma);

    if (params.get('mailboxes') === '1') {
      const row = await withPrismaRetry(
        () => prisma.siteSettings.findUnique({ where: { key: MAILBOXES_SETTING_KEY } }),
        2,
        80
      ).catch(() => null);
      let raw: unknown = null;
      try { raw = row?.value ? JSON.parse(row.value) : null; } catch { raw = null; }
      const config = parseMailboxConfig(raw);
      return NextResponse.json({
        mailboxes: enabledMailboxes(config),
        config,
        default: DEFAULT_MAILBOX,
      });
    }

    if (thread) {
      const messages = await withFreshPrisma((db) =>
        db.adminEmail.findMany({
          where: {
            threadId: thread,
            status: { notIn: HIDDEN_STATUSES },
            ...mailboxMessageWhere(mailbox),
          },
          orderBy: { createdAt: 'asc' },
          take: 500,
        })
      );
      const inThread = new Set(messages.map((m) => m.id));
      const outsideParentIds = Array.from(
        new Set(messages.map((m) => m.inReplyTo).filter((id) => id && !inThread.has(id)))
      );
      const outsideParents = outsideParentIds.length
        ? await withPrismaRetry(
            () =>
              prisma.adminEmail.findMany({
                where: { id: { in: outsideParentIds } },
                select: { id: true, subject: true, textBody: true, body: true, direction: true, kind: true, createdAt: true, fromAddr: true },
              }),
            2,
            80
          )
        : [];
      return NextResponse.json(
        { messages, parents: outsideParents },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (view === 'newsletters') {
      const rows = await withFreshPrisma((db) =>
        db.adminEmail.findMany({
          where: {
            kind: 'newsletter',
            status: { not: 'archived' },
            ...searchWhere(search),
            ...mailboxMessageWhere(mailbox),
          },
          orderBy: { createdAt: 'desc' },
          take: 2000,
          select: { id: true, threadId: true, subject: true, body: true, textBody: true, toAddr: true, contactEmail: true, status: true, createdAt: true, fromAddr: true },
        })
      );
      const map = new Map<string, {
        threadId: string; subject: string; body: string; preview: string; createdAt: Date;
        recipients: string[]; sent: number; failed: number;
      }>();
      for (const r of rows) {
        const key = r.threadId || r.id;
        const email = r.contactEmail || extractEmailAddress(r.toAddr);
        const entry = map.get(key);
        if (!entry) {
          map.set(key, {
            threadId: key,
            subject: r.subject,
            body: r.body,
            preview: preview(r.textBody),
            createdAt: r.createdAt,
            recipients: email ? [email] : [],
            sent: r.status === 'failed' ? 0 : 1,
            failed: r.status === 'failed' ? 1 : 0,
          });
        } else {
          if (email && !entry.recipients.includes(email)) entry.recipients.push(email);
          if (r.status === 'failed') entry.failed += 1;
          else entry.sent += 1;
          if (r.createdAt < entry.createdAt) entry.createdAt = r.createdAt;
        }
      }
      const campaigns = Array.from(map.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return NextResponse.json({ campaigns }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (view === 'dialogs') {
      const rows = await withFreshPrisma(async (db) => {
        return db.adminEmail.findMany({
          where: {
            kind: 'dialog',
            status: { notIn: HIDDEN_STATUSES },
            threadId: { not: '' },
            ...searchWhere(search),
            ...mailboxMessageWhere(mailbox),
          },
          orderBy: { createdAt: 'desc' },
          take: 3000,
          select: {
            id: true, threadId: true, contactEmail: true, direction: true, fromAddr: true, toAddr: true,
            subject: true, textBody: true, isRead: true, createdAt: true, inReplyTo: true,
          },
        });
      });

      const map = new Map<string, {
        threadId: string; contactEmail: string; name: string; subject: string;
        lastText: string; lastAt: Date; lastDirection: string; unread: number; count: number;
      }>();
      for (const r of rows) {
        const contact = r.contactEmail || extractEmailAddress(r.direction === 'inbound' ? r.fromAddr : r.toAddr);
        if (isSystemMailAddress(contact) || isSystemMailAddress(r.fromAddr)) continue;
        const entry = map.get(r.threadId);
        const name = r.direction === 'inbound' ? extractDisplayName(r.fromAddr) : '';
        if (!entry) {
          map.set(r.threadId, {
            threadId: r.threadId,
            contactEmail: contact,
            name,
            subject: r.subject,
            lastText: preview(r.textBody) || r.subject,
            lastAt: r.createdAt,
            lastDirection: r.direction,
            unread: r.direction === 'inbound' && !r.isRead ? 1 : 0,
            count: 1,
          });
        } else {
          entry.count += 1;
          if (r.direction === 'inbound' && !r.isRead) entry.unread += 1;
          if (!entry.name && name) entry.name = name;
        }
      }
      const conversations = Array.from(map.values());
      const visibleUnread = conversations.reduce((sum, c) => sum + c.unread, 0);
      return NextResponse.json(
        { conversations, unreadCount: visibleUnread },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Legacy flat list (kept for compatibility).
    const folder = params.get('folder') || 'all';
    const where: Record<string, unknown> = { ...searchWhere(search) };
    if (folder === 'inbox') {
      where.direction = 'inbound';
      where.status = 'received';
    } else if (folder === 'sent') {
      where.direction = 'outbound';
      where.status = { not: 'archived' };
    } else if (folder === 'spam') {
      where.direction = 'inbound';
      where.status = 'spam';
    } else {
      where.status = { notIn: HIDDEN_STATUSES };
    }
    const { emails, unreadCount, spamCount } = await withFreshPrisma(async (db) => {
      const emails = await db.adminEmail.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
      const unreadCount = await db.adminEmail.count({ where: { direction: 'inbound', isRead: false, status: 'received' } });
      const spamCount = await db.adminEmail.count({ where: { direction: 'inbound', status: 'spam' } });
      return { emails, unreadCount, spamCount };
    });
    return NextResponse.json({ emails, unreadCount, spamCount }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Email list error:', error);
    // Do not return empty 200 — that looks like "all mail disappeared".
    return NextResponse.json(
      {
        error: 'Не удалось загрузить почту. База временно недоступна — обновите страницу.',
        degraded: true,
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

// POST: send an email (new dialog message or reply inside an existing conversation)
export async function POST(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;
  const admin = verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await ensureAdminSchema(prisma);

    const { to, subject, body, replyTo, attachments: rawAttachments, from: fromRaw } = (await req.json()) as {
      to?: string | string[];
      subject?: string;
      body?: string;
      replyTo?: string;
      attachments?: MailAttachmentIn[];
      from?: string;
    };
    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Заполните все поля' }, { status: 400 });
    }
    const recipients = parseRecipients(to);
    if (recipients.length === 0) {
      return NextResponse.json({ error: 'Некорректный email получателя' }, { status: 400 });
    }
    for (const email of recipients) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: `Некорректный email: ${email}` }, { status: 400 });
      }
    }

    const multi = recipients.length > 1;
    // Multi-recipient = newsletter/campaign → never from mail@
    const fromMailbox = multi ? newsletterFromMailbox(fromRaw) : normalizeMailbox(fromRaw);

    const apiKey = await getApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'Email не настроен: укажите Resend API Key в Настройках → Интеграции → Resend' }, { status: 500 });
    }

    const parent = replyTo
      ? await withPrismaRetry(
          () => prisma.adminEmail.findUnique({ where: { id: String(replyTo) }, select: { id: true, messageId: true } }),
          2,
          80
        )
      : null;

    const headers: Record<string, string> = {};
    if (parent?.messageId && recipients.length === 1) {
      headers['In-Reply-To'] = parent.messageId;
      headers.References = parent.messageId;
    }

    const html = isBrandedEmail(body) ? body : buildBrandedEmailHtml(textToHtml(body));
    const textBody = body.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').trim();
    const attachments = parseAttachments(rawAttachments);
    const resend = new Resend(apiKey);
    const threadId = multi ? newsletterThreadId(crypto.randomUUID()) : dialogThreadId(recipients[0]);
    const kind = multi ? 'newsletter' : 'dialog';
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    let lastId = '';

    for (const contactEmail of recipients) {
      try {
        const result = await resend.emails.send({
          from: `errani <${fromMailbox}>`,
          to: contactEmail,
          subject: subject.trim(),
          html,
          replyTo: fromMailbox,
          ...(Object.keys(headers).length ? { headers } : {}),
          ...(attachments.length ? { attachments } : {}),
        });
        if (result.error) throw new Error(result.error.message);

        const email = await withPrismaRetry(() => prisma.adminEmail.create({
          data: {
            direction: 'outbound',
            fromAddr: fromMailbox,
            toAddr: contactEmail,
            subject: subject.trim(),
            body: html,
            textBody,
            status: 'sent',
            isRead: true,
            resendId: result.data?.id || '',
            inReplyTo: multi ? '' : (parent?.id || ''),
            kind,
            contactEmail,
            threadId: multi ? threadId : dialogThreadId(contactEmail),
          },
        }), 2, 80);
        lastId = email.id;
        sent += 1;
      } catch (err) {
        failed += 1;
        errors.push(`${contactEmail}: ${err instanceof Error ? err.message : 'ошибка'}`);
      }
    }

    if (sent === 0) {
      return NextResponse.json({ error: errors[0] || 'Ошибка отправки' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      id: lastId,
      threadId: multi ? threadId : dialogThreadId(recipients[0]),
      kind,
      sent,
      failed,
      errors,
    });
  } catch (error) {
    console.error('Send email error:', error);
    return NextResponse.json({ error: 'Ошибка отправки' }, { status: 500 });
  }
}

// PUT: mark email(s) / a whole conversation as read
export async function PUT(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { ids, markAll, threadId } = await req.json();

    if (markAll) {
      await withPrismaRetry(() => prisma.adminEmail.updateMany({
        where: { direction: 'inbound', isRead: false },
        data: { isRead: true },
      }), 2, 80);
    } else if (typeof threadId === 'string' && threadId) {
      await withPrismaRetry(() => prisma.adminEmail.updateMany({
        where: { threadId, direction: 'inbound', isRead: false },
        data: { isRead: true },
      }), 2, 80);
    } else if (ids?.length) {
      await withPrismaRetry(() => prisma.adminEmail.updateMany({
        where: { id: { in: ids } },
        data: { isRead: true },
      }), 2, 80);
    }

    const { clearAdminCountsCache } = await import('@/lib/admin-counts-cache');
    clearAdminCountsCache();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// DELETE: archive message(s) or a whole conversation (rows stay in the database)
export async function DELETE(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { ids, threadId } = await req.json();
    if (typeof threadId === 'string' && threadId) {
      await withPrismaRetry(() => prisma.adminEmail.updateMany({
        where: { threadId },
        data: { status: 'archived' },
      }), 2, 80);
    } else if (ids?.length) {
      await withPrismaRetry(() => prisma.adminEmail.updateMany({
        where: { id: { in: ids } },
        data: { status: 'archived' },
      }), 2, 80);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete email error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
