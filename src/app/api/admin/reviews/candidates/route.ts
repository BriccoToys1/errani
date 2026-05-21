import { NextRequest, NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import prisma from '@/lib/db';
import { withPrismaRetry } from '@/lib/prisma-retry';

// Returns clients with orders grouped by email, each order showing its products
// and whether a review invite has already been sent for that (email, productId) pair.
export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // last 90 days

    const [orders, items, invites] = await withPrismaRetry(() =>
      prisma.$transaction([
        prisma.order.findMany({
          where: { createdAt: { gte: cutoff }, status: { notIn: ['cancelled', 'archived'] } },
          select: { id: true, orderNumber: true, customerEmail: true, customerName: true },
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
        prisma.orderItem.findMany({
          where: { order: { createdAt: { gte: cutoff }, status: { notIn: ['cancelled', 'archived'] } } },
          select: { orderId: true, productId: true, product: { select: { name: true, nameRu: true } } },
        }),
        prisma.reviewInvite.findMany({
          where: { status: { in: ['sent', 'pending_send'] }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          select: { email: true, productId: true },
        }),
      ])
    );

    // Build invite set: "email:productId"
    const inviteSet = new Set(invites.map(i => `${i.email}:${i.productId}`));

    // Map items by orderId, deduplicate productId per order
    const itemsByOrder = new Map<string, Array<{ productId: string; productName: string; hasActiveInvite: boolean }>>();
    for (const item of items) {
      const list = itemsByOrder.get(item.orderId) || [];
      if (!list.some(l => l.productId === item.productId)) {
        list.push({ productId: item.productId, productName: item.product?.nameRu || item.product?.name || item.productId, hasActiveInvite: false });
      }
      itemsByOrder.set(item.orderId, list);
    }

    // Group orders by email, build candidates
    const byEmail = new Map<string, { email: string; name: string; orders: Array<{ orderId: string; orderNumber: string; items: typeof itemsByOrder extends Map<string, infer V> ? V : never }> }>();
    for (const order of orders) {
      const key = order.customerEmail.toLowerCase();
      if (!byEmail.has(key)) byEmail.set(key, { email: key, name: order.customerName, orders: [] });
      const items2 = (itemsByOrder.get(order.id) || []).map(i => ({
        ...i,
        hasActiveInvite: inviteSet.has(`${key}:${i.productId}`),
      }));
      if (items2.length > 0) byEmail.get(key)!.orders.push({ orderId: order.id, orderNumber: order.orderNumber, items: items2 });
    }

    return NextResponse.json(Array.from(byEmail.values()).filter(c => c.orders.length > 0));
  } catch (error) {
    console.error('Review candidates error:', error);
    return NextResponse.json({ error: 'Failed to load candidates' }, { status: 500 });
  }
}
