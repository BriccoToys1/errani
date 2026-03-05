import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// Stripe webhook handler for international payments
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    // In production, verify the webhook signature
    // const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    // const event = stripe.webhooks.constructEvent(body, sig!, webhookSecret!);

    const event = JSON.parse(body);

    console.log('Stripe webhook received:', event.type);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata?.order_id;
        
        if (orderId) {
          await prisma.order.update({
            where: { id: orderId },
            data: {
              status: 'paid',
              paymentId: paymentIntent.id,
            },
          });
          console.log(`Order ${orderId} marked as paid via Stripe`);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata?.order_id;
        
        if (orderId) {
          await prisma.order.update({
            where: { id: orderId },
            data: {
              status: 'cancelled',
              notes: 'Payment failed',
            },
          });
          console.log(`Order ${orderId} payment failed`);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        const orderId = charge.metadata?.order_id;
        
        if (orderId) {
          await prisma.order.update({
            where: { id: orderId },
            data: {
              status: 'cancelled',
              notes: 'Refunded',
            },
          });
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
