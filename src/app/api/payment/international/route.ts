import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { markOrderPaidAndDecrementStock } from '@/lib/stock';
import crypto from 'crypto';

const STRIPE_TOLERANCE_SECONDS = 300;

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyStripeSignature(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;

  const parts = header.split(',').map((p) => p.trim());
  const timestampPart = parts.find((p) => p.startsWith('t='));
  const signatureParts = parts.filter((p) => p.startsWith('v1='));
  if (!timestampPart || signatureParts.length === 0) return false;

  const timestamp = Number(timestampPart.slice(2));
  if (!Number.isFinite(timestamp)) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > STRIPE_TOLERANCE_SECONDS) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  return signatureParts.some((part) => safeEqual(part.slice(3), expected));
}

// Stripe webhook handler for international payments
export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Webhook misconfiguration' }, { status: 500 });
    }

    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    if (!verifyStripeSignature(body, sig, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);

    console.log('Stripe webhook received:', event.type);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata?.order_id;
        
        if (orderId) {
          await markOrderPaidAndDecrementStock(orderId, paymentIntent.id);
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
