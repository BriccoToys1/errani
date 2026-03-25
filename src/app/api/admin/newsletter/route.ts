import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { Resend } from 'resend';

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
    const { recipients, subject, body } = (await req.json()) as {
      recipients: { email: string; name: string }[];
      subject: string;
      body: string;
    };

    if (!recipients?.length || !subject?.trim() || !body?.trim()) {
      return NextResponse.json({ error: 'Заполните все поля' }, { status: 400 });
    }
    if (recipients.length > 500) {
      return NextResponse.json({ error: 'Максимум 500 получателей за раз' }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Email не настроен (RESEND_API_KEY)' }, { status: 500 });

    const resend = new Resend(apiKey);
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
        const html = buildNewsletterHtml(bodyHtml);
        const textBody = body.replace(/<[^>]*>/g, '').substring(0, 300);

        const result = await resend.emails.send({
          from: 'errani <mail@errani.ru>',
          to: recipient.email,
          subject,
          html,
        });

        await prisma.adminEmail.create({
          data: {
            direction: 'outbound',
            fromAddr: 'mail@errani.ru',
            toAddr: recipient.email,
            subject,
            body: html,
            textBody,
            status: 'sent',
            isRead: true,
            resendId: result.data?.id || '',
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

    return NextResponse.json({ sent, failed, errors });
  } catch (err) {
    console.error('Newsletter POST error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Ошибка' }, { status: 500 });
  }
}

function buildNewsletterHtml(bodyHtml: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:36px 16px 48px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">
        <tr><td style="padding:0 0 18px;text-align:center;">
          <span style="font-size:26px;font-weight:900;letter-spacing:-0.03em;color:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">errani</span>
        </td></tr>
        <tr>
          <td style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.09);">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="height:4px;background:#e8601c;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:28px 28px 24px;font-size:14px;line-height:1.8;color:#333;">
                  ${bodyHtml}
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="height:1px;background:#f0f0f0;font-size:0;">&nbsp;</td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:14px 28px 20px;font-size:11px;color:#bbb;line-height:1.7;">
                  errani.ru &nbsp;&middot;&nbsp; <a href="mailto:mail@errani.ru" style="color:#e8601c;text-decoration:none;">mail@errani.ru</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 0 0;text-align:center;font-size:11px;color:#bbb;">© ${year} errani.ru</td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
