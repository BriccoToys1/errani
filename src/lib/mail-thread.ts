/**
 * Conversation (thread) rules for the admin mailbox.
 *  - Dialog thread = all messages with one counterpart address (threadId = normalized email).
 *  - Newsletter = one AdminEmail row per recipient sharing threadId "nl_<campaign>".
 *  - inReplyTo = AdminEmail.id of the exact message a reply answers.
 */
import type { PrismaClient } from '@prisma/client';

export const OWN_DOMAIN = 'errani.ru';
export const OWN_ADDRESS = 'mail@errani.ru';
/** @deprecated prefer MAILBOXES from `@/lib/mailboxes` */
export const OWN_ADDRESSES = [
  'mail@errani.ru',
  'sales@errani.ru',
  'info@errani.ru',
  'katy@errani.ru',
] as const;

/** "Name <a@b.c>", "a@b.c, d@e.f" → "a@b.c" (lower-case). */
export function extractEmailAddress(raw: string | null | undefined): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  const angle = value.match(/<([^>]+)>/);
  const candidate = (angle ? angle[1] : value.split(',')[0]).trim().toLowerCase();
  const plain = candidate.match(/[^\s<>"']+@[^\s<>"']+/);
  return plain ? plain[0] : candidate;
}

/** Display name from "Name <a@b>" (empty if none). */
export function extractDisplayName(raw: string | null | undefined): string {
  const value = String(raw || '').trim();
  const m = value.match(/^"?([^"<]+?)"?\s*<[^>]+>/);
  if (m) return m[1].trim();
  // "noreply@x" → empty; keep local-part only when it looks human (no dots of system ids).
  const email = extractEmailAddress(value);
  if (!email) return '';
  const local = email.split('@')[0] || '';
  if (/^(noreply|no-reply|mailer-daemon|postmaster|dmarc|bounce)/i.test(local)) return '';
  if (local.includes('.') || local.includes('+') || local.length < 2) return '';
  return local;
}

/** System / automated senders that should not clutter dialogs. */
export function isSystemMailAddress(email: string | null | undefined): boolean {
  const e = extractEmailAddress(email);
  if (!e) return false;
  if (/dmarc|mailer-daemon|postmaster|noreply-dmarc/i.test(e)) return true;
  if (e.endsWith('@google.com') && /dmarc|noreply/i.test(e)) return true;
  if (/^(noreply|no-reply|mailer-daemon|postmaster)@/i.test(e)) return true;
  return false;
}

export function isOwnAddress(email: string): boolean {
  const e = email.toLowerCase();
  return e === OWN_ADDRESS || e.endsWith(`@${OWN_DOMAIN}`);
}

export function counterpartEmail(direction: string, fromAddr: string, toAddr: string): string {
  return extractEmailAddress(direction === 'inbound' ? fromAddr : toAddr);
}

export function dialogThreadId(contactEmail: string): string {
  return contactEmail.trim().toLowerCase();
}

export function newsletterThreadId(campaignId: string): string {
  return `nl_${campaignId}`;
}

/** Strip any number of Re:/Fwd:/Ответ: prefixes. */
export function normalizeSubject(subject: string): string {
  let s = String(subject || '').trim();
  const re = /^(re|fw|fwd|aw|ответ|отв|на)\s*(\[\d+\])?\s*:\s*/i;
  while (re.test(s)) s = s.replace(re, '').trim();
  return s.toLowerCase();
}

/** Normalize Message-ID header value: keep the bracketed id(s), first one. */
export function normalizeMessageId(raw: string | null | undefined): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  const m = value.match(/<[^>]+>/);
  return (m ? m[0] : `<${value.replace(/^<|>$/g, '')}>`).toLowerCase();
}

/** Read In-Reply-To from a webhook payload (direct field or headers list/object). */
export function readInReplyToHeader(data: Record<string, unknown>): string {
  const direct = data.in_reply_to ?? data.inReplyTo;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const headers = data.headers;
  if (Array.isArray(headers)) {
    for (const h of headers as Record<string, unknown>[]) {
      const name = String(h.name || h.key || '').toLowerCase();
      if (name === 'in-reply-to') return String(h.value || '').trim();
    }
  } else if (headers && typeof headers === 'object') {
    for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
      if (k.toLowerCase() === 'in-reply-to') return String(v || '').trim();
    }
  }
  return '';
}

type Db = Pick<PrismaClient, 'adminEmail'>;

/**
 * Find which stored message an inbound email replies to:
 *  1) In-Reply-To header ↔ stored messageId/resendId;
 *  2) same normalized subject: latest outbound to this contact (dialog or newsletter).
 */
export async function resolveInboundParent(
  db: Db,
  input: { contactEmail: string; subject: string; inReplyToHeader: string; before?: Date },
): Promise<{ id: string; kind: string } | null> {
  const header = normalizeMessageId(input.inReplyToHeader);
  if (header) {
    const bare = header.replace(/^<|>$/g, '');
    const byHeader = await db.adminEmail.findFirst({
      where: { OR: [{ messageId: header }, { messageId: bare }, { resendId: bare }] },
      select: { id: true, kind: true },
    });
    if (byHeader) return byHeader;
  }
  const subject = normalizeSubject(input.subject);
  if (!subject || !input.contactEmail) return null;
  const candidates = await db.adminEmail.findMany({
    where: {
      direction: 'outbound',
      contactEmail: input.contactEmail,
      ...(input.before ? { createdAt: { lte: input.before } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, kind: true, subject: true },
  });
  const match = candidates.find((c) => normalizeSubject(c.subject) === subject);
  return match ? { id: match.id, kind: match.kind } : null;
}

/** Fields to persist for an inbound message (thread + parent link). */
export async function inboundThreadFields(
  db: Db,
  input: { fromAddr: string; subject: string; inReplyToHeader: string; messageId: string; receivedAt?: Date },
) {
  const contactEmail = extractEmailAddress(input.fromAddr);
  const parent = await resolveInboundParent(db, {
    contactEmail,
    subject: input.subject,
    inReplyToHeader: input.inReplyToHeader,
    before: input.receivedAt,
  });
  return {
    kind: 'dialog',
    contactEmail,
    threadId: dialogThreadId(contactEmail),
    messageId: normalizeMessageId(input.messageId),
    inReplyTo: parent?.id || '',
  };
}

/** Thread fields for any outbound dialog message stored in AdminEmail. */
export function dialogFieldsFor(toAddr: string) {
  const contactEmail = extractEmailAddress(toAddr);
  return { kind: 'dialog', contactEmail, threadId: dialogThreadId(contactEmail) };
}
