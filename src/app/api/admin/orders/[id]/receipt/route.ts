import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { buildReceiptHtml } from '@/lib/receipt-builder';
import { adminGuard } from '@/lib/admin-auth';
import { htmlToPdf } from '@/lib/pdf';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: true } } },
  });

  if (!order) return new Response('Not found', { status: 404 });

  const wantsDownload = req.nextUrl.searchParams.get('download') === '1';
  if (wantsDownload) {
    const html = buildReceiptHtml(
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

  const html = buildReceiptHtml(
    {
      ...order,
      items: order.items.map(i => ({
        quantity: i.quantity,
        price: i.price,
        productId: i.productId,
        product: i.product ? { name: i.product.name } : null,
      })),
    },
    {
      forPdf: false,
      downloadUrl: `/api/admin/orders/${encodeURIComponent(order.id)}/receipt?download=1`,
    }
  );

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
