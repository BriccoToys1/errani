/** Admin mailbox addresses (Resend from / inbound). */

export const MAILBOXES = [
  'mail@errani.ru',
  'sales@errani.ru',
  'info@errani.ru',
  'katy@errani.ru',
] as const;

export type MailboxAddress = (typeof MAILBOXES)[number];

export const DEFAULT_MAILBOX: MailboxAddress = 'mail@errani.ru';
export const MAILBOXES_SETTING_KEY = 'mailboxes_v1';

/** Role mapping for automated / admin sends. */
export const MAILBOX_SALES: MailboxAddress = 'sales@errani.ru';
export const MAILBOX_INFO: MailboxAddress = 'info@errani.ru';
export const MAILBOX_GENERAL: MailboxAddress = 'mail@errani.ru';
export const MAILBOX_PERSONAL: MailboxAddress = 'katy@errani.ru';

/** mail@ must not send newsletters / bulk campaigns. */
export function newsletterFromMailbox(preferred?: string | null): MailboxAddress {
  const n = normalizeMailbox(preferred);
  if (n === MAILBOX_GENERAL) return MAILBOX_INFO;
  if (n === MAILBOX_SALES) return MAILBOX_INFO;
  return n === MAILBOX_PERSONAL ? MAILBOX_INFO : n;
}

export type MailboxConfig = Record<string, { enabled: boolean; label?: string }>;

export function defaultMailboxConfig(): MailboxConfig {
  const cfg: MailboxConfig = {};
  for (const addr of MAILBOXES) {
    cfg[addr] = { enabled: true };
  }
  return cfg;
}

export function parseMailboxConfig(raw: unknown): MailboxConfig {
  const base = defaultMailboxConfig();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  for (const addr of MAILBOXES) {
    const entry = obj[addr];
    if (entry && typeof entry === 'object' && 'enabled' in (entry as object)) {
      base[addr] = {
        enabled: Boolean((entry as { enabled?: unknown }).enabled),
        label: typeof (entry as { label?: unknown }).label === 'string'
          ? String((entry as { label?: string }).label)
          : undefined,
      };
    } else if (typeof entry === 'boolean') {
      base[addr] = { enabled: entry };
    }
  }
  return base;
}

export function normalizeMailbox(raw: string | null | undefined): MailboxAddress {
  const v = String(raw || '').trim().toLowerCase();
  const hit = MAILBOXES.find((m) => m === v);
  return hit || DEFAULT_MAILBOX;
}

export function enabledMailboxes(cfg: MailboxConfig): MailboxAddress[] {
  return MAILBOXES.filter((m) => cfg[m]?.enabled !== false);
}

/** Prisma-friendly filter: messages belonging to a specific own mailbox. */
export function mailboxMessageWhere(mailbox: string) {
  const addr = normalizeMailbox(mailbox);
  return {
    OR: [
      { AND: [{ direction: 'inbound' }, { toAddr: { contains: addr, mode: 'insensitive' as const } }] },
      { AND: [{ direction: 'outbound' }, { fromAddr: { contains: addr, mode: 'insensitive' as const } }] },
    ],
  };
}
