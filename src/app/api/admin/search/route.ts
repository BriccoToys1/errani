import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const search = { contains: q, mode: 'insensitive' as const };

  const [orders, products, inquiries, users] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { not: 'pending' },
        OR: [
          { orderNumber: search },
          { customerName: search },
          { customerEmail: search },
          { customerPhone: search },
          { city: search },
          { country: search },
          { street: search },
          { notes: search },
          { paymentMethod: search },
          { shippingMethod: search },
        ],
      },
      take: 6,
      orderBy: { createdAt: 'desc' },
      select: { id: true, orderNumber: true, customerName: true, totalAmount: true, status: true },
    }),
    prisma.product.findMany({
      where: {
        OR: [
          { name: search },
          { nameRu: search },
          { slug: search },
          { description: search },
          { descriptionRu: search },
          { limitedEditionText: search },
        ],
      },
      take: 6,
      select: { id: true, name: true, nameRu: true, slug: true, price: true },
    }),
    prisma.inquiry.findMany({
      where: {
        OR: [
          { name: search },
          { email: search },
          { phone: search },
          { message: search },
          { source: search },
        ],
      },
      take: 6,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, status: true },
    }),
    prisma.user.findMany({
      where: {
        OR: [
          { name: search },
          { email: search },
          { phone: search },
          { city: search },
        ],
      },
      take: 4,
      select: { id: true, name: true, email: true },
    }),
  ]);

  return NextResponse.json({
    results: [
      ...orders.map((o) => ({ type: 'order', label: `${o.orderNumber} — ${o.customerName}`, sub: `${o.totalAmount} ₽`, href: '/admin/orders' })),
      ...products.map((p) => ({ type: 'product', label: p.nameRu || p.name, sub: `${p.price} ₽`, href: '/admin/products' })),
      ...inquiries.map((i) => ({ type: 'inquiry', label: i.name, sub: i.email, href: '/admin/inquiries' })),
      ...users.map((u) => ({ type: 'user', label: u.name, sub: u.email, href: '/admin/users' })),
    ],
  });
}
