import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// POST: Resend inbound email webhook
// Configure in Resend dashboard: forward mail@errani.ru to this webhook
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Resend webhook payload for inbound emails
    const { type, data } = body;

    if (type === 'email.received') {
      const { from, to, subject, html, text, message_id } = data;

      const fromAddr = typeof from === 'string' ? from : (from?.address || from?.email || JSON.stringify(from));
      const toAddr = Array.isArray(to) ? to.map((t: { address?: string; email?: string }) => t.address || t.email || '').join(', ') : (typeof to === 'string' ? to : '');

      await prisma.adminEmail.create({
        data: {
          direction: 'inbound',
          fromAddr,
          toAddr,
          subject: subject || '(без темы)',
          body: html || `<pre>${text || ''}</pre>`,
          textBody: text || '',
          status: 'received',
          isRead: false,
          resendId: message_id || '',
        },
      });

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ ignored: true });
  } catch (error) {
    console.error('Email webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
