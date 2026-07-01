import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { fulfillPaidOrder } from '@/lib/order-fulfillment';
import { getTochkaConfig, verifyTochkaWebhookToken } from '@/lib/tochka';

function extractWebhookToken(rawBody: string) {
  const trimmed = rawBody.trim();
  if (!trimmed) return '';

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const token = parsed.jwt || parsed.token || parsed.body || parsed.data;
    return typeof token === 'string' ? token : trimmed;
  } catch {
    return trimmed;
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = extractWebhookToken(await req.text());
    if (!token) {
      return NextResponse.json({ error: 'Missing webhook token' }, { status: 400 });
    }

    const payload = await verifyTochkaWebhookToken(token);
    const config = getTochkaConfig();

    if (config?.customerCode && payload.customerCode && payload.customerCode !== config.customerCode) {
      return NextResponse.json({ error: 'Webhook customer mismatch' }, { status: 400 });
    }

    if (payload.webhookType && payload.webhookType !== 'acquiringInternetPayment') {
      return NextResponse.json({ success: true, ignored: true });
    }

    if (payload.status !== 'APPROVED') {
      return NextResponse.json({ success: true, ignored: true, status: payload.status || null });
    }

    const paymentLinkId = payload.paymentLinkId ? String(payload.paymentLinkId) : '';
    const operationId = payload.operationId ? String(payload.operationId) : '';

    if (!paymentLinkId && !operationId) {
      return NextResponse.json({ error: 'Missing payment identifiers' }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: {
        OR: [
          ...(paymentLinkId ? [{ id: paymentLinkId }] : []),
          ...(paymentLinkId ? [{ orderNumber: paymentLinkId }] : []),
          ...(operationId ? [{ paymentId: operationId }] : []),
        ],
      },
      select: { id: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const paymentMethod = payload.paymentType === 'sbp' ? 'sbp' : payload.paymentType === 'card' ? 'card' : 'tochka';
    const { alreadyPaid } = await fulfillPaidOrder(order.id, operationId || undefined, { paymentMethod });
    if (alreadyPaid) {
      console.log(`Order ${order.id} is already paid, skipping duplicate Tochka webhook`);
    } else {
      console.log(`Order ${order.id} marked as paid by Tochka`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Tochka webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
