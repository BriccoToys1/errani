import prisma from '@/lib/db';

const PAID_STATUS = 'paid';

export async function markOrderPaidAndDecrementStock(orderId: string, paymentId?: string) {
  return prisma.$transaction(async (tx) => {
    const markedAsPaid = await tx.order.updateMany({
      where: { id: orderId, status: { not: PAID_STATUS } },
      data: {
        status: PAID_STATUS,
        ...(paymentId ? { paymentId } : {}),
      },
    });

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (markedAsPaid.count === 0) {
      return { order, alreadyPaid: true as const };
    }

    for (const item of order.items) {
      if (item.quantity <= 0) continue;
      const updated = await tx.product.updateMany({
        where: {
          id: item.productId,
          isActive: true,
          inStock: true,
          stock: { gte: item.quantity },
        },
        data: {
          stock: { decrement: item.quantity },
        },
      });

      if (updated.count === 0) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }
    }

    const productIds = [...new Set(order.items.map((item) => item.productId))];
    if (productIds.length > 0) {
      const touched = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, stock: true, inStock: true },
      });

      for (const product of touched) {
        if (product.stock <= 0 && product.inStock) {
          await tx.product.update({
            where: { id: product.id },
            data: {
              inStock: false,
              isSoldOut: true,
            },
          });
        }
      }
    }

    const updatedOrder = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!updatedOrder) {
      throw new Error(`Order disappeared during stock update: ${orderId}`);
    }

    return { order: updatedOrder, alreadyPaid: false as const };
  });
}
