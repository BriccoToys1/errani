import prisma from '@/lib/db';
import { fulfillPaidOrder } from '@/lib/order-fulfillment';
import { getTochkaConfig, getTochkaPaymentOperation } from '@/lib/tochka';

type PaymentOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentId: string;
  totalAmount: number;
};

function amountMatches(left: number, right: number) {
  return Math.round(left * 100) === Math.round(right * 100);
}

async function fetchYukassaPayment(paymentId: string) {
  const shopId = process.env.YUKASSA_SHOP_ID;
  const secretKey = process.env.YUKASSA_SECRET_KEY;
  if (!shopId || !secretKey || !paymentId) return null;

  const response = await fetch(`https://api.yookassa.ru/v3/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString('base64')}`,
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    console.error('YuKassa payment status error:', response.status, await response.text());
    return null;
  }
  return response.json() as Promise<{
    id?: string;
    status?: string;
    paid?: boolean;
    amount?: { value?: string; currency?: string };
    metadata?: { order_id?: string; order_number?: string };
  }>;
}

export async function refreshPaidOrderStatus(orderNumber: string): Promise<PaymentOrder | null> {
  let order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      paymentId: true,
      totalAmount: true,
    },
  });

  if (!order || order.status === 'paid' || !order.paymentId || !['pending', 'unpaid'].includes(order.status)) {
    return order;
  }

  if (order.paymentMethod === 'tochka') {
    const config = getTochkaConfig();
    const operation = await getTochkaPaymentOperation(order.paymentId);
    const sameCustomer = !config?.customerCode || !operation?.customerCode || operation.customerCode === config.customerCode;
    const samePayment = operation?.operationId === order.paymentId || operation?.paymentLinkId === order.orderNumber;

    if (operation?.status === 'APPROVED' && sameCustomer && samePayment && amountMatches(operation.amount, order.totalAmount)) {
      const paymentMethod = operation.paymentType === 'sbp' ? 'sbp' : operation.paymentType === 'card' ? 'card' : 'tochka';
      await fulfillPaidOrder(order.id, operation.operationId || order.paymentId, {
        waitForNotifications: false,
        paymentMethod,
      });
      order = { ...order, status: 'paid', paymentMethod };
    }
  }

  if (order.paymentMethod === 'yukassa') {
    const payment = await fetchYukassaPayment(order.paymentId);
    const paidAmount = Number(payment?.amount?.value || 0);
    const sameOrder = payment?.metadata?.order_id === order.id || payment?.metadata?.order_number === order.orderNumber;

    if (payment?.status === 'succeeded' && payment.paid !== false && sameOrder && amountMatches(paidAmount, order.totalAmount)) {
      await fulfillPaidOrder(order.id, payment.id || order.paymentId, {
        waitForNotifications: false,
        paymentMethod: 'yukassa',
      });
      order = { ...order, status: 'paid', paymentMethod: 'yukassa' };
    }
  }

  return order;
}
