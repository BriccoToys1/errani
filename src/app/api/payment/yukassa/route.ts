import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// YuKassa webhook handler
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    console.log('YuKassa webhook received:', JSON.stringify(body, null, 2));

    const { event, object } = body;

    if (!object || !object.metadata?.order_id) {
      return NextResponse.json({ error: 'Invalid webhook data' }, { status: 400 });
    }

    const orderId = object.metadata.order_id;

    switch (event) {
      case 'payment.succeeded':
        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'paid',
            paymentId: object.id,
          },
        });
        console.log(`Order ${orderId} marked as paid`);
        break;

      case 'payment.canceled':
        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'cancelled',
          },
        });
        console.log(`Order ${orderId} cancelled`);
        break;

      case 'refund.succeeded':
        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'cancelled',
            notes: 'Refunded',
          },
        });
        console.log(`Order ${orderId} refunded`);
        break;

      default:
        console.log(`Unhandled event: ${event}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('YuKassa webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
