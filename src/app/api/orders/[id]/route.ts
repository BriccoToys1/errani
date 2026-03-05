import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

interface Params {
  params: Promise<{ id: string }>;
}

// GET single order
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

// PUT update order status (admin only)
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();

    const order = await prisma.order.update({
      where: { id },
      data: {
        status: body.status,
        notes: body.notes,
      },
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

// DELETE order (admin only)
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    // Delete order items first (cascade should handle, but explicit)
    await prisma.orderItem.deleteMany({ where: { orderId: id } });
    await prisma.order.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 });
  }
}
