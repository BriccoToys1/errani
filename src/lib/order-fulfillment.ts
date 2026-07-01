import { sendOrderConfirmation } from '@/lib/email';
import { htmlToPdf } from '@/lib/pdf';
import { buildReceiptHtml } from '@/lib/receipt-builder';
import { markOrderPaidAndDecrementStock } from '@/lib/stock';
import { createCdekOrder } from '@/lib/cdek';
import prisma from '@/lib/db';

export async function fulfillPaidOrder(
  orderId: string,
  paymentId?: string,
  options: { waitForNotifications?: boolean; paymentMethod?: string } = {},
) {
  const { order, alreadyPaid } = await markOrderPaidAndDecrementStock(
    orderId,
    paymentId,
    options.paymentMethod,
  );

  if (order.shippingMethod.startsWith('cdek_') && !order.cdekUuid && (!alreadyPaid || order.cdekError)) {
    try {
      const created = await createCdekOrder({
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        city: order.city,
        postalCode: order.zipCode,
        address: [order.street, order.house, order.apartment].filter(Boolean).join(', '),
        mode: order.shippingMethod === 'cdek_pvz' ? 'pickup' : 'courier',
        tariffCode: order.cdekTariffCode,
        deliveryPointCode: order.cdekDeliveryPointCode || undefined,
        items: order.items.map((item) => ({
          productId: item.productId,
          name: item.product?.nameRu || item.product?.name || item.productId,
          price: item.price,
          quantity: item.quantity,
        })),
      });
      await prisma.order.update({
        where: { id: order.id },
        data: {
          cdekUuid: created.uuid,
          cdekNumber: created.cdekNumber,
          cdekError: '',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось создать заказ СДЭК';
      console.error(`Failed to create CDEK order ${order.orderNumber}:`, error);
      await prisma.order.update({
        where: { id: order.id },
        data: { cdekError: message.slice(0, 500) },
      });
    }
  }

  if (alreadyPaid) {
    return { order, alreadyPaid };
  }

  const sendNotifications = async () => {
    const itemsSubtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shippingCost = Math.round(Math.max(0, order.totalAmount - itemsSubtotal));

    let receiptPdf: Buffer | undefined;
    let receiptHtml: string | undefined;

    try {
      const receiptOrder = {
        ...order,
        items: order.items.map((item) => ({
          quantity: item.quantity,
          price: item.price,
          productId: item.productId,
          product: item.product ? { name: item.product.name } : null,
        })),
      };

      receiptHtml = buildReceiptHtml(receiptOrder, false);
      receiptPdf = await htmlToPdf(buildReceiptHtml(receiptOrder, true));
    } catch (error) {
      console.error('Failed to generate receipt PDF:', error);
    }

    await sendOrderConfirmation({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      city: order.city,
      shippingMethod: order.shippingMethod,
      shippingCost,
      totalAmount: order.totalAmount,
      items: order.items.map((item) => ({
        name: item.product?.name ?? item.productId,
        quantity: item.quantity,
        price: item.price,
      })),
      receiptPdf,
      receiptHtml,
    });
  };

  if (options.waitForNotifications === false) {
    void sendNotifications().catch((error) => {
      console.error(`Failed to send notifications for order ${order.orderNumber}:`, error);
    });
  } else {
    await sendNotifications();
  }

  return { order, alreadyPaid };
}
