import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { clearAdminCountsCache, VIEWED_SETTING_KEYS } from '@/lib/admin-counts-cache';

// POST: mark all orders as viewed (update timestamp)
export async function POST(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const value = new Date().toISOString();
    await prisma.siteSettings.upsert({
      where: { key: VIEWED_SETTING_KEYS.orders },
      update: { value },
      create: { key: VIEWED_SETTING_KEYS.orders, value },
    });
    clearAdminCountsCache();
    return NextResponse.json({ success: true, value });
  } catch (error) {
    console.error('Error marking orders as viewed:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
