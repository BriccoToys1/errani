import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { generateOrderNumber } from '@/lib/utils';

// POST: create a manual order (admin only)
export async function POST(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const {
      customerName, customerEmail, customerPhone,
      country, oblast, city, zipCode, street, house, apartment,
      shippingMethod, paymentMethod, currency,
      notes, status, items, totalAmount,
    } = body;

    if (!customerName || !totalAmount) {
      return NextResponse.json({ error: 'Имя и сумма обязательны' }, { status: 400 });
    }

    // If items provided with productIds, create real order items; otherwise use empty
    const orderItemsData: { productId: string; quantity: number; price: number }[] = [];

    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (item.productId && item.quantity && item.price) {
          orderItemsData.push({
            productId: item.productId,
            quantity: Number(item.quantity),
            price: Number(item.price),
          });
        }
      }
    }

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: null,
        customerName: customerName.trim(),
        customerEmail: (customerEmail || '').trim(),
        customerPhone: (customerPhone || '').trim(),
        country: country || 'RU',
        oblast: oblast || '',
        city: city || '',
        zipCode: zipCode || '',
        street: street || '',
        house: house || '',
        apartment: apartment || '',
        shippingMethod: shippingMethod || '',
        paymentMethod: paymentMethod || 'tochka',
        currency: currency || 'RUB',
        totalAmount: Number(totalAmount),
        status: status || 'unpaid',
        notes: notes || '',
        isManual: true,
        ...(orderItemsData.length > 0 ? { items: { create: orderItemsData } } : {}),
      },
      include: {
        items: { include: { product: true } },
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Error creating manual order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
