import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { withPrismaRetry } from '@/lib/prisma-retry';

const DASHBOARD_CACHE_TTL_MS = 20_000;
let dashboardCache: { ts: number; payload: unknown } | null = null;

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const now = Date.now();
    if (dashboardCache && now - dashboardCache.ts < DASHBOARD_CACHE_TTL_MS) {
      return NextResponse.json(dashboardCache.payload, { headers: { 'X-Dashboard-Cache': 'hit' } });
    }

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
      withPrismaRetry(() => prisma.siteSettings.findUnique({ where: { key: 'ordersViewedAt' } }), 2, 80),
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
      withTimeout(withPrismaRetry(() => prisma.order.count({ where: paidFilter }), 2, 80), 0),
      withTimeout(withPrismaRetry(() => prisma.product.count(), 2, 80), 0),
      withTimeout(withPrismaRetry(() => prisma.order.aggregate({ where: paidFilter, _sum: { totalAmount: true } }), 2, 80), { _sum: { totalAmount: 0 } }),
      withTimeout(withPrismaRetry(() => prisma.order.count({ where: { status: 'pending' } }), 2, 80), 0),
      withTimeout(
        withPrismaRetry(() => prisma.order.findMany({
          where: paidFilter,
          take: 5,
          orderBy: { createdAt: 'desc' },
        }), 2, 80),
        []
      ),
      withTimeout(withPrismaRetry(() => prisma.inquiry.count({ where: { status: { not: 'archived' } } }), 2, 80), 0),
      withTimeout(withPrismaRetry(() => prisma.inquiry.count({ where: { status: 'new' } }), 2, 80), 0),
      withTimeout(withPrismaRetry(() => prisma.waitlistRequest.count({ where: { status: 'pending' } }), 2, 80), 0),
      withTimeout(withPrismaRetry(() => prisma.order.count({ where: { status: { in: ['paid', 'assembling'] }, createdAt: { gt: ordersViewedAt } } }), 2, 80), 0),
      withTimeout(withPrismaRetry(() => prisma.adminEmail.count({ where: { direction: 'inbound', isRead: false } }), 2, 80), 0),
      withTimeout(withPrismaRetry(() => prisma.expense.aggregate({ _sum: { amount: true } }), 2, 80), { _sum: { amount: 0 } }),
      withTimeout(withPrismaRetry(() => prisma.user.count(), 2, 80), 0),
      withTimeout(withPrismaRetry(() => prisma.pageView.count(), 2, 80), 0),
    ]);

    const totalRevenueAmount = totalRevenue._sum.totalAmount || 0;
    const totalExpenses = expenseAgg._sum.amount || 0;

    const payload = {
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
    };

    dashboardCache = { ts: now, payload };
    return NextResponse.json(payload, { headers: { 'X-Dashboard-Cache': 'miss' } });
  } catch (error) {
    console.error('Dashboard error:', error);
    if (dashboardCache) {
      return NextResponse.json(dashboardCache.payload, { headers: { 'X-Dashboard-Cache': 'stale' } });
    }
    return NextResponse.json({
      orderCount: 0,
      productCount: 0,
      totalRevenue: 0,
      totalExpenses: 0,
      profit: 0,
      pendingCount: 0,
      recentOrders: [],
      inquiryCount: 0,
      newInquiryCount: 0,
      waitlistCount: 0,
      newOrdersCount: 0,
      newInquiriesCount: 0,
      newEmailsCount: 0,
      userCount: 0,
      pageViewCount: 0,
      stats: { products: 0, orders: 0, users: 0, inquiries: 0, pageViews: 0 },
      degraded: true,
    });
  }
}
