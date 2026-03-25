import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { sendOrderConfirmation } from '@/lib/email';
import { buildReceiptHtml } from '@/lib/receipt-builder';
import { htmlToPdf } from '@/lib/pdf';

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
      case 'payment.succeeded': {
        const order = await prisma.order.update({
          where: { id: orderId },
          data: { status: 'paid', paymentId: object.id },
          include: { items: { include: { product: true } } },
        });
        console.log(`Order ${orderId} marked as paid`);

        // Compute shipping cost
        const itemsSubtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
        const shippingCost = Math.round(Math.max(0, order.totalAmount - itemsSubtotal));

        // Generate receipt PDF
        let receiptPdf: Buffer | undefined;
        let receiptHtml: string | undefined;
        try {
          receiptHtml = buildReceiptHtml(
            {
              ...order,
              items: order.items.map(i => ({
                quantity: i.quantity,
                price: i.price,
                productId: i.productId,
                product: i.product ? { name: i.product.name } : null,
              })),
            },
            true // forPdf: no buttons/scripts
          );
          receiptPdf = await htmlToPdf(receiptHtml);
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
