import { sendOrderConfirmation } from '@/lib/email';
import { htmlToPdf } from '@/lib/pdf';
import { buildReceiptHtml } from '@/lib/receipt-builder';
import { markOrderPaidAndDecrementStock } from '@/lib/stock';

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
