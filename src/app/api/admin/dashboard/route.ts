import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const [orderCount, productCount, totalRevenue, recentOrders, inquiryCount, newInquiryCount] = await Promise.all([
      prisma.order.count(),
      prisma.product.count(),
      prisma.order.aggregate({ _sum: { totalAmount: true } }),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { product: true } } },
      }),
      prisma.inquiry.count(),
      prisma.inquiry.count({ where: { status: 'new' } }),
    ]);

    return NextResponse.json({
      orderCount,
      productCount,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      recentOrders,
      inquiryCount,
      newInquiryCount,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
