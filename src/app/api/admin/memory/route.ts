import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import * as fs from 'fs';
import * as path from 'path';

// Get database stats
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Count page views
    const pageViews = await prisma.pageView.count();

    // Count inquiries
    const inquiries = await prisma.inquiry.count();

    // Count unique days in daily stats
    const dailyStats = await prisma.dailyStat.count();

    // Get database file size
    let dbSize = '0 KB';
    try {
      const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        const bytes = stats.size;
        if (bytes < 1024) {
          dbSize = `${bytes} B`;
        } else if (bytes < 1024 * 1024) {
          dbSize = `${(bytes / 1024).toFixed(1)} KB`;
        } else {
          dbSize = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        }
      }
    } catch {
      // Ignore file size errors
    }

    return NextResponse.json({ pageViews, inquiries, dailyStats, dbSize });
  } catch (error) {
    console.error('Memory stats error:', error);
    return NextResponse.json({ error: 'Failed to get memory stats' }, { status: 500 });
  }
}

// Clean data
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, type } = body;

    if (action !== 'clean') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    let deletedCount = 0;

    switch (type) {
      case 'old_pageviews': {
        // Delete page views older than 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const result = await prisma.pageView.deleteMany({
          where: {
            createdAt: { lt: thirtyDaysAgo }
          }
        });
        deletedCount = result.count;
        return NextResponse.json({ 
          success: true, 
          message: `Удалено ${deletedCount} записей просмотров старше 30 дней` 
        });
      }

      case 'closed_inquiries': {
        // Delete closed inquiries
        const result = await prisma.inquiry.deleteMany({
          where: { status: 'closed' }
        });
        deletedCount = result.count;
        return NextResponse.json({ 
          success: true, 
          message: `Удалено ${deletedCount} закрытых обращений` 
        });
      }

      case 'all_pageviews': {
        // Delete ALL page views
        const result = await prisma.pageView.deleteMany({});
        deletedCount = result.count;
        
        // Also clear daily stats since they come from page views
        await prisma.dailyStat.deleteMany({});
        
        return NextResponse.json({ 
          success: true, 
          message: `Аналитика полностью очищена (${deletedCount} записей)` 
        });
      }

      case 'recalculate_stats': {
        // Recalculate dailyStats from actual PageView records (fixes inflated counts)
        // Get all distinct dates from PageViews
        const allViews = await prisma.pageView.findMany({
          select: { createdAt: true, sessionId: true },
          orderBy: { createdAt: 'asc' },
        });

        // Group by UTC date
        const byDate: Record<string, { views: Set<string>; all: number }> = {};
        for (const v of allViews) {
          const date = v.createdAt.toISOString().slice(0, 10);
          if (!byDate[date]) byDate[date] = { views: new Set(), all: 0 };
          byDate[date].views.add(v.sessionId);
          byDate[date].all++;
        }

        // Recalculate orders per day
        const allOrders = await prisma.order.findMany({
          select: { createdAt: true, totalAmount: true },
        });
        const ordersByDate: Record<string, { count: number; revenue: number }> = {};
        for (const o of allOrders) {
          const date = o.createdAt.toISOString().slice(0, 10);
          if (!ordersByDate[date]) ordersByDate[date] = { count: 0, revenue: 0 };
          ordersByDate[date].count++;
          ordersByDate[date].revenue += o.totalAmount;
        }

        // Upsert dailyStats
        await prisma.dailyStat.deleteMany({});
        for (const [date, stat] of Object.entries(byDate)) {
          await prisma.dailyStat.create({
            data: {
              date,
              views: stat.all,
              visitors: stat.views.size,
              orders: ordersByDate[date]?.count ?? 0,
              revenue: ordersByDate[date]?.revenue ?? 0,
            },
          });
        }

        return NextResponse.json({ 
          success: true, 
          message: `Статистика пересчитана по ${Object.keys(byDate).length} дням` 
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid cleanup type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Memory clean error:', error);
    return NextResponse.json({ error: 'Failed to clean data' }, { status: 500 });
  }
}
