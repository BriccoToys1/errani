import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { htmlToPdf } from '@/lib/pdf';
import { buildReceiptHtml } from '@/lib/receipt-builder';
import { consumeRateLimit } from '@/lib/rate-limit';
import { refreshPaidOrderStatus } from '@/lib/payment-status';

export async function GET(req: NextRequest) {
  const rate = consumeRateLimit(req, { key: 'receipt-download', limit: 30, windowMs: 10 * 60_000 });
  if (!rate.allowed) {
    return new Response('Too many requests', {
      status: 429,
      headers: { 'Retry-After': String(rate.retryAfter), 'Cache-Control': 'no-store' },
    });
  }

  const { searchParams } = new URL(req.url);
  const orderNumber = searchParams.get('number')?.trim();

  if (!orderNumber || orderNumber.length > 64 || !/^ER-[A-Z0-9-]+$/.test(orderNumber)) {
    return new Response('Missing order number', { status: 400 });
  }

  const refreshed = await refreshPaidOrderStatus(orderNumber);
  if (!refreshed) {
    return new Response('Not found', { status: 404 });
  }

  if (refreshed.status !== 'paid') {
    return new Response('Receipt is available after successful payment', { status: 409 });
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: { include: { product: true } } },
  });

  if (!order) {
    return new Response('Not found', { status: 404 });
  }

  if (order.status !== 'paid') {
    return new Response('Receipt is available after successful payment', { status: 409 });
  }

  const html = buildReceiptHtml(
    {
      ...order,
      items: order.items.map((item) => ({
        quantity: item.quantity,
        price: item.price,
        productId: item.productId,
        product: item.product ? { name: item.product.name } : null,
      })),
    },
    true
  );

  const pdf = await htmlToPdf(html);
  const safeOrderNumber = order.orderNumber.replace(/[^a-zA-Z0-9_-]/g, '');

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt-${safeOrderNumber}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
