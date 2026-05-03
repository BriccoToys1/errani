import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { sendStockAvailableEmail } from '@/lib/email';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    const request = await prisma.waitlistRequest.findUnique({ where: { id } });

    if (!request) {
      return NextResponse.json({ error: 'Waitlist request not found' }, { status: 404 });
    }

    if (request.status === 'archived') {
      return NextResponse.json({ error: 'Waitlist request is archived' }, { status: 409 });
    }

    if (request.status === 'notified') {
      return NextResponse.json({ success: true, message: 'Already notified' });
    }

    await sendStockAvailableEmail({
      recipientEmail: request.email,
      recipientName: request.name,
      productName: request.productName,
      productSlug: request.productSlug,
    });

    await prisma.waitlistRequest.update({
      where: { id: request.id },
      data: { status: 'notified', notifiedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error notifying waitlist request:', error);
    return NextResponse.json({ error: 'Failed to notify waitlist request' }, { status: 500 });
  }
}
