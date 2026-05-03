import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  const withTimeout = async <T,>(promise: Promise<T>, fallback: T, ms = 4000): Promise<T> => {
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('counts timeout')), ms)),
      ]);
    } catch {
      return fallback;
    }
  };

  try {
    const [newOrders, newInquiries, newWaitlist, newEmails] = await Promise.all([
      withTimeout(prisma.order.count({ where: { status: { in: ['paid', 'assembling'] } } }), 0),
      withTimeout(prisma.inquiry.count({ where: { status: 'new' } }), 0),
      withTimeout(prisma.waitlistRequest.count({ where: { status: 'pending' } }), 0),
      withTimeout(prisma.adminEmail.count({ where: { direction: 'inbound', isRead: false } }), 0),
    ]);

    return NextResponse.json({
      newOrders,
      newInquiries,
      newWaitlist,
      newEmails,
    });
  } catch (error) {
    console.error('Counts error:', error);
    return NextResponse.json({ error: 'Failed to load counts' }, { status: 500 });
  }
}
