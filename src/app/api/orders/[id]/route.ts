import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { markOrderPaidAndDecrementStock } from '@/lib/stock';
import { adminGuard } from '@/lib/admin-auth';

interface Params {
  params: Promise<{ id: string }>;
}

// GET single order
export async function GET(req: NextRequest, { params }: Params) {
  const denied = adminGuard(req);
  if (denied) return denied;

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
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await req.json();

    if (body.status === 'paid') {
      const { order } = await markOrderPaidAndDecrementStock(id);
      return NextResponse.json(order);
    }

    const order = await prisma.order.update({
      where: { id },
      data: {
        status: body.status,
        notes: body.notes,
        ...(body.customerName !== undefined ? { customerName: body.customerName } : {}),
        ...(body.customerEmail !== undefined ? { customerEmail: body.customerEmail } : {}),
        ...(body.customerPhone !== undefined ? { customerPhone: body.customerPhone } : {}),
        ...(body.city !== undefined ? { city: body.city } : {}),
        ...(body.totalAmount !== undefined ? { totalAmount: Number(body.totalAmount) } : {}),
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
  const denied = adminGuard(req);
  if (denied) return denied;

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
