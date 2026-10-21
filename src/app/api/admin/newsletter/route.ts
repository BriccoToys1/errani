import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { Resend } from 'resend';
import crypto from 'crypto';
import { withPrismaRetry } from '@/lib/prisma-retry';
import { extractEmailAddress, newsletterThreadId } from '@/lib/mail-thread';
import { buildBrandedEmailHtml } from '@/lib/email-template';
import { newsletterFromMailbox } from '@/lib/mailboxes';

async function getApiKey(): Promise<string | null> {
  try {
    const s = await withPrismaRetry(
      () => prisma.siteSettings.findUnique({ where: { key: 'resend_api_key' } }),
      2,
      80
    );
    if (s?.value?.trim()) return s.value.trim();
  } catch {
    // fall back to env
  }
  return process.env.RESEND_API_KEY?.trim() || null;
}

// GET — unique customers from orders (for recipient list)
export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const orders = await prisma.order.findMany({
      where: { customerEmail: { not: '' } },
      select: { customerEmail: true, customerName: true, city: true },
      orderBy: { createdAt: 'desc' },
    });

    const emailMap = new Map<string, { email: string; name: string; city: string; orderCount: number }>();
    for (const o of orders) {
      const email = o.customerEmail.toLowerCase().trim();
      if (!email) continue;
      if (emailMap.has(email)) {
        emailMap.get(email)!.orderCount++;
      } else {
        emailMap.set(email, { email, name: o.customerName || '', city: o.city || '', orderCount: 1 });
      }
    }

    const customers = Array.from(emailMap.values()).sort((a, b) => b.orderCount - a.orderCount);
    return NextResponse.json({ customers });
  } catch (err) {
    console.error('Newsletter GET error:', err);
    return NextResponse.json({ error: 'Ошибка загрузки' }, { status: 500 });
  }
}

// POST — send newsletter to selected recipients
export async function POST(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { recipients, subject, body, from: fromRaw } = (await req.json()) as {
      recipients: { email: string; name: string }[];
      subject: string;
      body: string;
      from?: string;
    };
    // mail@ / sales@ / katy@ must not send bulk newsletters — force info@
    const fromMailbox = newsletterFromMailbox(fromRaw);

    if (!recipients?.length || !subject?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Заполните все поля' }, { status: 400 });
    }
    if (recipients.length > 500) {
      return NextResponse.json({ error: 'Максимум 500 получателей за раз' }, { status: 400 });
    }

    const apiKey = await getApiKey();
    if (!apiKey) return NextResponse.json({ error: 'Email не настроен: укажите Resend API Key в Настройках → Интеграции → Resend' }, { status: 500 });

    const resend = new Resend(apiKey);
    const threadId = newsletterThreadId(crypto.randomUUID());
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Convert plain text to HTML paragraphs if no HTML present
    const hasHtml = /<[a-z][\s\S]*>/i.test(body);
    const bodyHtml = hasHtml
      ? body
      : body
          .split('\n\n')
          .map(p => `<p style="margin:0 0 14px 0;">${p.replace(/\n/g, '<br />')}</p>`)
          .join('');

    for (const recipient of recipients) {
      try {
        const html = buildBrandedEmailHtml(bodyHtml);
        const textBody = body.replace(/<[^>]*>/g, '').substring(0, 300);

        const result = await resend.emails.send({
          from: `errani <${fromMailbox}>`,
          to: recipient.email,
          subject,
          html,
          replyTo: fromMailbox,
        });
        if (result.error) throw new Error(result.error.message);

        await prisma.adminEmail.create({
          data: {
            direction: 'outbound',
            fromAddr: fromMailbox,
            toAddr: recipient.email,
            subject,
            body: html,
            textBody,
            status: 'sent',
            isRead: true,
            resendId: result.data?.id || '',
            kind: 'newsletter',
            threadId,
            contactEmail: extractEmailAddress(recipient.email),
          },
        });

        sent++;
        // Respect Resend rate limit
        await new Promise(r => setTimeout(r, 120));
      } catch (err) {
        failed++;
        errors.push(`${recipient.email}: ${err instanceof Error ? err.message : 'Ошибка'}`);
      }
    }

    return NextResponse.json({ sent, failed, errors, threadId });
  } catch (err) {
    console.error('Newsletter POST error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Ошибка' }, { status: 500 });
  }
}
