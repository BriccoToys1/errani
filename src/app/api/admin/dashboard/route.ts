import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const paidFilter = { status: { in: ['paid', 'assembling', 'shipped', 'in_transit', 'delivered'] } };
    
    // Get orders viewed timestamp
    const viewedSetting = await prisma.siteSettings.findUnique({ where: { key: 'ordersViewedAt' } });
    const ordersViewedAt = viewedSetting ? new Date(viewedSetting.value) : new Date(0);
    
    const [orderCount, productCount, totalRevenue, pendingCount, recentOrders, inquiryCount, newInquiryCount, newOrdersCount, newEmailsCount, expenseAgg] = await Promise.all([
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
      prisma.order.count({ where: { status: { in: ['paid', 'assembling'] }, createdAt: { gt: ordersViewedAt } } }),
      prisma.adminEmail.count({ where: { direction: 'inbound', isRead: false } }),
      prisma.expense.aggregate({ _sum: { amount: true } }),
    ]);

    const totalRevenueAmount = totalRevenue._sum.totalAmount || 0;
    const totalExpenses = expenseAgg._sum.amount || 0;

    return NextResponse.json({
      orderCount,
      productCount,
      totalRevenue: totalRevenueAmount,
      totalExpenses,
      profit: totalRevenueAmount - totalExpenses,
      pendingCount,
      recentOrders,
      inquiryCount,
      newInquiryCount,
      newOrdersCount,
      newInquiriesCount: newInquiryCount,
      newEmailsCount,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
