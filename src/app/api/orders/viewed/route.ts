import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// POST: mark all orders as viewed (update timestamp)
export async function POST() {
  try {
    await prisma.siteSettings.upsert({
      where: { key: 'ordersViewedAt' },
      update: { value: new Date().toISOString() },
      create: { key: 'ordersViewedAt', value: new Date().toISOString() },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking orders as viewed:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
