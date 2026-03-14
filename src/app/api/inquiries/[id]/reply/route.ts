import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';

interface Params {
  params: Promise<{ id: string }>;
}

// GET: email thread for this inquiry
export async function GET(req: NextRequest, { params }: Params) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const { id } = await params;
  const inquiry = await prisma.inquiry.findUnique({ where: { id } });
  if (!inquiry) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const emails = await prisma.adminEmail.findMany({
    where: {
      OR: [
        { toAddr: inquiry.email },
        { fromAddr: inquiry.email },
        { inquiryId: id },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(emails);
}

// POST: send reply email to client
export async function POST(req: NextRequest, { params }: Params) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const { id } = await params;
  const inquiry = await prisma.inquiry.findUnique({ where: { id } });
  if (!inquiry) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { subject, body } = await req.json();
  if (!body?.trim()) return NextResponse.json({ error: 'Body is required' }, { status: 400 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Email not configured' }, { status: 500 });

  const resend = new Resend(apiKey);
  const emailSubject = subject?.trim() || `Re: Ваше обращение — errani`;

  const html = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr><td style="background:#1a1a1a;padding:20px 28px;">
          <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:0.05em;">errani</span>
        </td></tr>
        <tr><td style="padding:28px 28px 20px;">
          <p style="margin:0 0 4px;font-size:13px;color:#999;">Здравствуйте, ${inquiry.name}!</p>
          <div style="margin-top:16px;font-size:14px;color:#333;line-height:1.7;white-space:pre-wrap;">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </td></tr>
        <tr><td style="padding:16px 28px 28px;border-top:1px solid #f0f0f0;">
          <p style="margin:0;font-size:12px;color:#aaa;">С уважением, команда <a href="https://errani.ru" style="color:#aaa;">errani.ru</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  try {
    const result = await resend.emails.send({
      from: 'errani <mail@errani.ru>',
      to: inquiry.email,
      subject: emailSubject,
      html,
    });

    await prisma.adminEmail.create({
      data: {
        direction: 'outbound',
        fromAddr: 'mail@errani.ru',
        toAddr: inquiry.email,
        subject: emailSubject,
        body: html,
        textBody: body,
        status: 'sent',
        isRead: true,
        resendId: result.data?.id || '',
        inquiryId: id,
      },
    });

    await prisma.inquiry.update({
      where: { id },
      data: { status: 'replied' },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Reply send error:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
