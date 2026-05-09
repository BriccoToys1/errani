import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { buildReceiptHtml } from '@/lib/receipt-builder';
import { adminGuard } from '@/lib/admin-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: true } } },
  });

  if (!order) return new Response('Not found', { status: 404 });

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
    false // include print/save buttons
  );

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
