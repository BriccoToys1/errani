import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const paidFilter = { status: { in: ['paid', 'assembling', 'shipped', 'in_transit', 'delivered'] } };
    const withTimeout = async <T,>(promise: Promise<T>, fallback: T, ms = 5000): Promise<T> => {
      try {
        return await Promise.race([
          promise,
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error('dashboard query timeout')), ms)),
        ]);
      } catch {
        return fallback;
      }
    };

    const viewedSetting = await withTimeout(
      prisma.siteSettings.findUnique({ where: { key: 'ordersViewedAt' } }),
      null
    );
    const ordersViewedAt = viewedSetting ? new Date(viewedSetting.value) : new Date(0);

    const [
      orderCount,
      productCount,
      totalRevenue,
      pendingCount,
      recentOrders,
      inquiryCount,
      newInquiryCount,
      waitlistCount,
      newOrdersCount,
      newEmailsCount,
      expenseAgg,
      userCount,
      pageViewCount,
    ] = await Promise.all([
      withTimeout(prisma.order.count({ where: paidFilter }), 0),
      withTimeout(prisma.product.count(), 0),
      withTimeout(prisma.order.aggregate({ where: paidFilter, _sum: { totalAmount: true } }), { _sum: { totalAmount: 0 } }),
      withTimeout(prisma.order.count({ where: { status: 'pending' } }), 0),
      withTimeout(
        prisma.order.findMany({
          where: paidFilter,
          take: 5,
          orderBy: { createdAt: 'desc' },
        }),
        []
      ),
      withTimeout(prisma.inquiry.count({ where: { status: { not: 'archived' } } }), 0),
      withTimeout(prisma.inquiry.count({ where: { status: 'new' } }), 0),
      withTimeout(prisma.waitlistRequest.count({ where: { status: 'pending' } }), 0),
      withTimeout(prisma.order.count({ where: { status: { in: ['paid', 'assembling'] }, createdAt: { gt: ordersViewedAt } } }), 0),
      withTimeout(prisma.adminEmail.count({ where: { direction: 'inbound', isRead: false } }), 0),
      withTimeout(prisma.expense.aggregate({ _sum: { amount: true } }), { _sum: { amount: 0 } }),
      withTimeout(prisma.user.count(), 0),
      withTimeout(prisma.pageView.count(), 0),
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
      waitlistCount,
      newOrdersCount,
      newInquiriesCount: newInquiryCount,
      newEmailsCount,
      userCount,
      pageViewCount,
      // backward-compatible shape for older admin pages
      stats: {
        products: productCount,
        orders: orderCount,
        users: userCount,
        inquiries: inquiryCount,
        pageViews: pageViewCount,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
