import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const paidFilter = { status: { in: ['paid', 'assembling', 'shipped', 'in_transit', 'delivered'] } };
    const [orderCount, productCount, totalRevenue, pendingCount, recentOrders, inquiryCount, newInquiryCount, newOrdersCount] = await Promise.all([
      prisma.order.count({ where: paidFilter }),
      prisma.product.count(),
      prisma.order.aggregate({ where: paidFilter, _sum: { totalAmount: true } }),
      prisma.order.count({ where: { status: 'pending' } }),
      prisma.order.findMany({
        where: paidFilter,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { product: true } } },
      }),
      prisma.inquiry.count(),
      prisma.inquiry.count({ where: { status: 'new' } }),
      prisma.order.count({ where: { status: 'assembling' } }),
    ]);

    return NextResponse.json({
      orderCount,
      productCount,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      pendingCount,
      recentOrders,
      inquiryCount,
      newInquiryCount,
      newOrdersCount,
      newInquiriesCount: newInquiryCount,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
