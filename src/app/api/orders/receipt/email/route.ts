import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendReceiptEmail } from '@/lib/email';
import { buildReceiptHtml } from '@/lib/receipt-builder';
import { htmlToPdf } from '@/lib/pdf';
import { consumeRateLimit } from '@/lib/rate-limit';

const recentSends = new Map<string, number>();
const RESEND_DELAY_MS = 60_000;

export async function POST(req: NextRequest) {
  try {
    const rate = consumeRateLimit(req, { key: 'receipt-email', limit: 5, windowMs: 60 * 60_000 });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many receipt requests' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      );
    }

    const body = await req.json() as { orderNumber?: string };
    const orderNumber = body.orderNumber?.trim();

    if (!orderNumber || orderNumber.length > 64 || !/^ER-[A-Z0-9-]+$/.test(orderNumber)) {
      return NextResponse.json({ error: 'Missing order number' }, { status: 400 });
    }

    const lastSentAt = recentSends.get(orderNumber) || 0;
    if (Date.now() - lastSentAt < RESEND_DELAY_MS) {
      return NextResponse.json({ error: 'Receipt was already sent recently' }, { status: 429 });
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status !== 'paid') {
      return NextResponse.json({ error: 'Receipt is available after successful payment' }, { status: 409 });
    }

    const receiptHtml = buildReceiptHtml({
      ...order,
      items: order.items.map((item) => ({
        quantity: item.quantity,
        price: item.price,
        productId: item.productId,
        product: item.product ? { name: item.product.name } : null,
      })),
    }, true);
    const receiptPdf = await htmlToPdf(receiptHtml);
    const sent = await sendReceiptEmail({
      recipientEmail: order.customerEmail,
      orderNumber: order.orderNumber,
      receiptPdf,
    });

    if (!sent) {
      return NextResponse.json({ error: 'Failed to send receipt' }, { status: 502 });
    }

    recentSends.set(orderNumber, Date.now());
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Receipt email error:', error);
    return NextResponse.json({ error: 'Failed to send receipt' }, { status: 500 });
  }
}
