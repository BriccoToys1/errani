import prisma from '@/lib/db';

const PAID_STATUS = 'paid';

type ColorEntry = { name: string; nameEn?: string; hex: string; stock?: number };

function parseColors(raw: string): ColorEntry[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function markOrderPaidAndDecrementStock(
  orderId: string,
  paymentId?: string,
  paymentMethod?: string,
) {
  return prisma.$transaction(async (tx) => {
    const markedAsPaid = await tx.order.updateMany({
      where: { id: orderId, status: { not: PAID_STATUS } },
      data: {
        status: PAID_STATUS,
        ...(paymentId ? { paymentId } : {}),
        ...(paymentMethod ? { paymentMethod } : {}),
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
      if (paymentMethod && order.paymentMethod !== paymentMethod) {
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: { paymentMethod },
          include: { items: { include: { product: true } } },
        });
        return { order: updatedOrder, alreadyPaid: true as const };
      }
      return { order, alreadyPaid: true as const };
    }

    for (const item of order.items) {
      if (item.quantity <= 0) continue;

      // Decrement global stock
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
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true },
        });

        if (product) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: 0,
              inStock: false,
              isSoldOut: true,
            },
          });
          console.warn(`Paid order ${orderId} exceeded stock for product ${item.productId}`);
        }
      }

      // Decrement per-color stock if selectedColor is specified
      const selectedColor = (item as typeof item & { selectedColor?: string }).selectedColor || '';
      if (selectedColor) {
        const productData = await tx.product.findUnique({
          where: { id: item.productId },
          select: { colors: true },
        });

        if (productData?.colors) {
          const colors = parseColors(productData.colors);
          const colorIdx = colors.findIndex((c) => c.name === selectedColor);
          if (colorIdx >= 0 && typeof colors[colorIdx].stock === 'number') {
            colors[colorIdx].stock = Math.max(0, (colors[colorIdx].stock as number) - item.quantity);
            await tx.product.update({
              where: { id: item.productId },
              data: { colors: JSON.stringify(colors) },
            });
          }
        }
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
