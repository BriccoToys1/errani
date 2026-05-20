import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { Resend } from 'resend';
import { withPrismaRetry } from '@/lib/prisma-retry';

// Resend sends inbound emails as POST to this webhook.
// Configure in Resend dashboard → Webhooks → Add endpoint:
//   URL: https://errani.ru/api/admin/email/webhook
//   Events: email.received (or all)
// Also needs MX record: errani.ru MX 10 inbound-smtp.resend.com
// And Resend Inbound domain: errani.ru

// GET: health check / webhook verification
export async function GET() {
  return NextResponse.json({ status: 'ok', webhook: 'email' });
}

// POST: receive inbound email from Resend
export async function POST(req: NextRequest) {
  try {
    const rawPayload = await req.text();
    const webhookSecret =
      process.env.RESEND_WEBHOOK_SECRET ||
      (await withPrismaRetry(
        () => prisma.siteSettings.findUnique({ where: { key: 'resend_webhook_secret' } }),
        2,
        80
      ).then((setting) => setting?.value || '').catch(() => ''));

    const resend = new Resend(process.env.RESEND_API_KEY || 'resend-webhook');
    const signatureHeaders = {
      id: req.headers.get('svix-id') || req.headers.get('x-svix-id') || '',
      timestamp: req.headers.get('svix-timestamp') || req.headers.get('x-svix-timestamp') || '',
      signature: req.headers.get('svix-signature') || req.headers.get('x-svix-signature') || '',
    };

    if (webhookSecret && (!signatureHeaders.id || !signatureHeaders.timestamp || !signatureHeaders.signature)) {
      return NextResponse.json({ error: 'Missing webhook signature' }, { status: 400 });
    }

    let payload: Record<string, unknown>;
    if (webhookSecret) {
      try {
        const verifiedPayload = resend.webhooks.verify({
          payload: rawPayload,
          headers: signatureHeaders,
          webhookSecret,
        });
        payload = verifiedPayload as unknown as Record<string, unknown>;
      } catch {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
      }
    } else {
      payload = JSON.parse(rawPayload) as Record<string, unknown>;
    }

    console.log('Email webhook received:', JSON.stringify(payload).substring(0, 1000));

    // Resend webhook wraps data in { type, data } or sends directly
    const type = String(payload.type || '');
    const data = (payload.data as Record<string, unknown>) || payload;

    // Handle Resend inbound email events
    if (type === 'email.received' || data.from || data.email_id || data.message_id) {
      const emailData = type ? data : payload;

      // Extract from - can be string, object, or array
      const rawFrom = emailData.from;
      let fromAddr = '';
      if (typeof rawFrom === 'string') {
        fromAddr = rawFrom;
      } else if (Array.isArray(rawFrom)) {
        fromAddr = rawFrom.map((f: Record<string, string>) => f.address || f.email || f.name || String(f)).join(', ');
      } else if (rawFrom && typeof rawFrom === 'object') {
        const f = rawFrom as Record<string, string>;
        fromAddr = f.address || f.email || f.name || JSON.stringify(f);
      }

      // Extract to - can be string, array of strings, or array of objects
      const rawTo = emailData.to;
      let toAddr = '';
      if (typeof rawTo === 'string') {
        toAddr = rawTo;
      } else if (Array.isArray(rawTo)) {
        toAddr = rawTo.map((t: string | Record<string, string>) => {
          if (typeof t === 'string') return t;
          return t.address || t.email || String(t);
        }).join(', ');
      } else if (rawTo && typeof rawTo === 'object') {
        const t = rawTo as Record<string, string>;
        toAddr = t.address || t.email || t.name || JSON.stringify(t);
      }

      const subject = String(emailData.subject || '(без темы)');
      const html = String(emailData.html || emailData.body || '');
      const text = String(emailData.text || emailData.text_body || '');
      const messageId = String(emailData.message_id || emailData.email_id || emailData.id || '').trim();
      const inReplyTo = String(emailData.in_reply_to || emailData.reply_to || '').trim();

      if (messageId) {
        const existing = await prisma.adminEmail.findFirst({
          where: { direction: 'inbound', resendId: messageId },
          select: { id: true },
        });
        if (existing) {
          return NextResponse.json({ received: true, duplicate: true });
        }
      }

      await prisma.adminEmail.create({
        data: {
          direction: 'inbound',
          fromAddr: fromAddr || 'unknown',
          toAddr: toAddr || 'mail@errani.ru',
          subject,
          body: html || `<pre style="white-space:pre-wrap;font-family:inherit;">${text || '(без текста)'}</pre>`,
          textBody: text || subject,
          status: 'received',
          isRead: false,
          resendId: messageId,
          inReplyTo,
        },
      });

      console.log(`Inbound email saved: from=${fromAddr}, subject=${subject}`);
      return NextResponse.json({ received: true });
    }

    // Handle other webhook event types (delivery status etc.)
    console.log('Email webhook: unhandled type:', type);
    return NextResponse.json({ ignored: true, type });
  } catch (error) {
    console.error('Email webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
