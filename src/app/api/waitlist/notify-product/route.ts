import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { sendStockAvailableEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const productSlug = String(body.productSlug || '').trim();

    if (!productSlug) {
      return NextResponse.json({ error: 'productSlug is required' }, { status: 400 });
    }

    const pending = await prisma.waitlistRequest.findMany({
      where: {
        productSlug,
        status: 'pending',
      },
      orderBy: { createdAt: 'asc' },
    });

    if (pending.length === 0) {
      return NextResponse.json({ success: true, notified: 0 });
    }

    await Promise.all(
      pending.map((request) =>
        sendStockAvailableEmail({
          recipientEmail: request.email,
          recipientName: request.name,
          productName: request.productName,
          productSlug: request.productSlug,
        })
      )
    );

    await prisma.waitlistRequest.updateMany({
      where: {
        id: { in: pending.map((r) => r.id) },
      },
      data: { status: 'notified', notifiedAt: new Date() },
    });

    return NextResponse.json({ success: true, notified: pending.length });
  } catch (error) {
    console.error('Error notifying waitlist by product:', error);
    return NextResponse.json({ error: 'Failed to notify waitlist by product' }, { status: 500 });
  }
}
