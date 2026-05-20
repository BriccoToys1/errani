import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { withPrismaRetry } from '@/lib/prisma-retry';

const DASHBOARD_CACHE_TTL_MS = 20_000;

type DashboardPayload = {
  orderCount: number;
  productCount: number;
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  pendingCount: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    totalAmount: number;
    status: string;
    createdAt: Date;
  }>;
  inquiryCount: number;
  newInquiryCount: number;
  waitlistCount: number;
  newOrdersCount: number;
  newInquiriesCount: number;
  newEmailsCount: number;
  userCount: number;
  pageViewCount: number;
  stats: {
    products: number;
    orders: number;
    users: number;
    inquiries: number;
    pageViews: number;
  };
};

let dashboardCache: { ts: number; payload: DashboardPayload } | null = null;

function fallbackPayload(): DashboardPayload {
  return dashboardCache?.payload || {
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
  };
}

async function safeQuery<T>(query: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await withPrismaRetry(query, 2, 80);
  } catch {
    return fallback;
  }
}

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const cached = dashboardCache;
  if (cached && Date.now() - cached.ts < DASHBOARD_CACHE_TTL_MS) {
    return NextResponse.json(cached.payload, { headers: { 'X-Dashboard-Cache': 'hit' } });
  }

  const prev = fallbackPayload();
  const paidFilter = { status: { in: ['paid', 'assembling', 'shipped', 'in_transit', 'delivered'] } };
  const ordersViewedAtRaw = await safeQuery(
    () => prisma.siteSettings.findUnique({ where: { key: 'ordersViewedAt' } }),
    null
  );
  const ordersViewedAt = ordersViewedAtRaw?.value ? new Date(ordersViewedAtRaw.value) : new Date(0);

  const [
    orderCount,
    productCount,
    totalRevenueAgg,
    pendingCount,
    recentOrders,
    inquiryCount,
    newInquiryCount,
    waitlistCount,
    newOrdersCount,
    newEmailsCount,
    expenseAgg,
    userCount,
  ] = await Promise.all([
    safeQuery(() => prisma.order.count({ where: paidFilter }), prev.orderCount),
    safeQuery(() => prisma.product.count(), prev.productCount),
    safeQuery(
      () => prisma.order.aggregate({ where: paidFilter, _sum: { totalAmount: true } }),
      { _sum: { totalAmount: prev.totalRevenue } }
    ),
    safeQuery(() => prisma.order.count({ where: { status: { in: ['pending', 'unpaid'] } } }), prev.pendingCount),
    safeQuery(
      () =>
        prisma.order.findMany({
          where: paidFilter,
          take: 5,
          orderBy: { createdAt: 'desc' },
        }),
      prev.recentOrders
    ),
    safeQuery(() => prisma.inquiry.count({ where: { status: { not: 'archived' } } }), prev.inquiryCount),
    safeQuery(() => prisma.inquiry.count({ where: { status: 'new' } }), prev.newInquiryCount),
    safeQuery(() => prisma.waitlistRequest.count({ where: { status: 'pending' } }), prev.waitlistCount),
    safeQuery(
      () => prisma.order.count({ where: { status: { in: ['paid', 'assembling'] }, createdAt: { gt: ordersViewedAt } } }),
      prev.newOrdersCount
    ),
    safeQuery(() => prisma.adminEmail.count({ where: { direction: 'inbound', isRead: false } }), prev.newEmailsCount),
    safeQuery(() => prisma.expense.aggregate({ _sum: { amount: true } }), { _sum: { amount: prev.totalExpenses } }),
    safeQuery(() => prisma.user.count(), prev.userCount),
  ]);

  const totalRevenue = totalRevenueAgg._sum.totalAmount || 0;
  const totalExpenses = expenseAgg._sum.amount || 0;
  const pageViewCount = prev.pageViewCount;

  const payload: DashboardPayload = {
    orderCount,
    productCount,
    totalRevenue,
    totalExpenses,
    profit: totalRevenue - totalExpenses,
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
    stats: {
      products: productCount,
      orders: orderCount,
      users: userCount,
      inquiries: inquiryCount,
      pageViews: pageViewCount,
    },
  };

  dashboardCache = { ts: Date.now(), payload };
  return NextResponse.json(payload, {
    headers: { 'X-Dashboard-Cache': cached ? 'stale-refresh' : 'miss' },
  });
}
