import { NextRequest, NextResponse } from 'next/server';
import { refreshPaidOrderStatus } from '@/lib/payment-status';
import { consumeRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  const rate = consumeRateLimit(req, { key: 'order-status', limit: 60, windowMs: 10 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const orderNumber = searchParams.get('number');

  if (!orderNumber || orderNumber.length > 64 || !/^ER-[A-Z0-9-]+$/.test(orderNumber)) {
    return NextResponse.json({ error: 'Missing order number' }, { status: 400 });
  }

  try {
    const order = await refreshPaidOrderStatus(orderNumber);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ status: order.status, paymentMethod: order.paymentMethod });
  } catch (error) {
    console.error('Failed to get order status:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
