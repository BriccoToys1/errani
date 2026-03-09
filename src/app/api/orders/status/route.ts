import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderNumber = searchParams.get('number');

  if (!orderNumber) {
    return NextResponse.json({ error: 'Missing order number' }, { status: 400 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: { status: true, paymentMethod: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ status: order.status, paymentMethod: order.paymentMethod });
  } catch {
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
