import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/db';
import { buildReceiptHtml } from '@/lib/receipt-builder';

const JWT_SECRET = process.env.JWT_SECRET || 'errani-admin-secret-key-change-me';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return new Response('Unauthorized', { status: 401 });
  try {
    jwt.verify(token, JWT_SECRET);
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }

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
