import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendOrderConfirmation } from '@/lib/email';
import { buildReceiptHtml } from '@/lib/receipt-builder';
import { htmlToPdf } from '@/lib/pdf';
import { markOrderPaidAndDecrementStock } from '@/lib/stock';

function getYukassaCredentials() {
  const shopId = process.env.YUKASSA_SHOP_ID;
  const secretKey = process.env.YUKASSA_SECRET_KEY;
  if (!shopId || !secretKey) return null;
  return { shopId, secretKey };
}

async function fetchYukassaObject(event: string, objectId: string) {
  const creds = getYukassaCredentials();
  if (!creds) return null;

  const endpoint = event.startsWith('refund.')
    ? `https://api.yookassa.ru/v3/refunds/${objectId}`
    : `https://api.yookassa.ru/v3/payments/${objectId}`;

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds.shopId}:${creds.secretKey}`).toString('base64')}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

// YuKassa webhook handler
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { event, object } = body;

    if (!event || !object || !object.id || !object.metadata?.order_id) {
      return NextResponse.json({ error: 'Invalid webhook data' }, { status: 400 });
    }

    const orderId = String(object.metadata.order_id);
    const verifiedObject = await fetchYukassaObject(String(event), String(object.id));
    if (!verifiedObject) {
      return NextResponse.json({ error: 'Unable to verify webhook event' }, { status: 400 });
    }

    const verifiedOrderId = verifiedObject?.metadata?.order_id ? String(verifiedObject.metadata.order_id) : '';
    if (!verifiedOrderId || verifiedOrderId !== orderId) {
      return NextResponse.json({ error: 'Webhook order mismatch' }, { status: 400 });
    }

    switch (event) {
      case 'payment.succeeded': {
        if (verifiedObject.status !== 'succeeded') {
          return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 });
        }
        const { order, alreadyPaid } = await markOrderPaidAndDecrementStock(orderId, object.id);
        if (alreadyPaid) {
          console.log(`Order ${orderId} is already paid, skipping duplicate webhook`);
          break;
        }
        console.log(`Order ${orderId} marked as paid`);

        // Compute shipping cost
        const itemsSubtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
        const shippingCost = Math.round(Math.max(0, order.totalAmount - itemsSubtotal));

        // Generate receipt PDF
        let receiptPdf: Buffer | undefined;
        let receiptHtml: string | undefined;
        try {
          const receiptHtmlForAdmin = buildReceiptHtml(
            {
              ...order,
              items: order.items.map(i => ({
                quantity: i.quantity,
                price: i.price,
                productId: i.productId,
                product: i.product ? { name: i.product.name } : null,
              })),
            },
            false
          );
          const receiptHtmlForPdf = buildReceiptHtml(
            {
              ...order,
              items: order.items.map(i => ({
                quantity: i.quantity,
                price: i.price,
                productId: i.productId,
                product: i.product ? { name: i.product.name } : null,
              })),
            },
            true
          );
          receiptHtml = receiptHtmlForAdmin;
          receiptPdf = await htmlToPdf(receiptHtmlForPdf);
        } catch (pdfErr) {
          console.error('Failed to generate receipt PDF:', pdfErr);
        }

        // Send single email with order details + PDF attachment
        await sendOrderConfirmation({
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          city: order.city,
          shippingMethod: order.shippingMethod,
          shippingCost,
          totalAmount: order.totalAmount,
          items: order.items.map(i => ({
            name: i.product?.name ?? i.productId,
            quantity: i.quantity,
            price: i.price,
          })),
          receiptPdf,
          receiptHtml,
        });
        break;
      }

      case 'payment.canceled':
        if (verifiedObject.status !== 'canceled') {
          return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 });
        }
        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'cancelled',
          },
        });
        console.log(`Order ${orderId} cancelled`);
        break;

      case 'refund.succeeded':
        if (verifiedObject.status !== 'succeeded') {
          return NextResponse.json({ error: 'Invalid refund status' }, { status: 400 });
        }
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
