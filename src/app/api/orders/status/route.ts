import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { fulfillPaidOrder } from '@/lib/order-fulfillment';
import { getTochkaConfig, getTochkaPaymentOperation } from '@/lib/tochka';
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
    let order = await prisma.order.findUnique({
      where: { orderNumber },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentMethod: true,
        paymentId: true,
        totalAmount: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (['pending', 'unpaid', 'paid'].includes(order.status) && order.paymentMethod === 'tochka' && order.paymentId) {
      const config = getTochkaConfig();
      const operation = await getTochkaPaymentOperation(order.paymentId);
      const amountMatches = operation
        ? Math.round(operation.amount * 100) === Math.round(order.totalAmount * 100)
        : false;

      if (
        operation?.status === 'APPROVED'
        && operation.operationId === order.paymentId
        && operation.paymentLinkId === order.orderNumber
        && operation.customerCode === config?.customerCode
        && amountMatches
      ) {
        const paymentMethod = operation.paymentType === 'sbp' ? 'sbp' : operation.paymentType === 'card' ? 'card' : 'tochka';
        await fulfillPaidOrder(order.id, operation.operationId, {
          waitForNotifications: false,
          paymentMethod,
        });
        order = { ...order, status: 'paid', paymentMethod };
        console.log(`Order ${order.orderNumber} marked as paid after Tochka status check`);
      }
    }

    return NextResponse.json({ status: order.status, paymentMethod: order.paymentMethod });
  } catch (error) {
    console.error('Failed to get order status:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
