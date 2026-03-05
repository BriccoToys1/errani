import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { generateOrderNumber } from '@/lib/utils';

interface OrderItemInput {
  productId: string;
  quantity: number;
}

// GET all orders (admin only)
export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

// POST create order
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, country, city, zipCode, street, house, apartment, shippingMethod, items } = body as {
      name: string;
      email: string;
      phone: string;
      country: string;
      city: string;
      zipCode: string;
      street: string;
      house: string;
      apartment: string;
      shippingMethod: string;
      items: OrderItemInput[];
    };

    // Validate
    if (!name || !email || !items?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get products and calculate total
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== items.length) {
      return NextResponse.json({ error: 'Some products not found' }, { status: 400 });
    }

    let totalAmount = 0;
    const orderItems = items.map(item => {
      const product = products.find(p => p.id === item.productId)!;
      totalAmount += product.price * item.quantity;
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
      };
    });

    // Create order
    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: null,
        customerName: name,
        customerEmail: email,
        customerPhone: phone || '',
        country: country || 'RU',
        city: city || '',
        zipCode: zipCode || '',
        street: street || '',
        house: house || '',
        apartment: apartment || '',
        shippingMethod: shippingMethod || '',
        totalAmount,
        currency: 'RUB',
        status: 'assembling',
        items: {
          create: orderItems,
        },
      },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    // Determine payment method based on country
    const isRussia = country === 'RU';
    let paymentUrl: string | null = null;

    if (isRussia) {
      const yukassaResponse = await createYukassaPayment(order);
      if (yukassaResponse?.confirmation?.confirmation_url) {
        paymentUrl = yukassaResponse.confirmation.confirmation_url;
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentId: yukassaResponse.id, paymentMethod: 'yukassa' },
        });
      }
    } else {
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentMethod: 'stripe' },
      });
    }

    return NextResponse.json({
      orderNumber: order.orderNumber,
      total: totalAmount,
      paymentUrl,
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}

// YuKassa payment creation
async function createYukassaPayment(order: { id: string; orderNumber: string; totalAmount: number }) {
  const shopId = process.env.YUKASSA_SHOP_ID;
  const secretKey = process.env.YUKASSA_SECRET_KEY;

  if (!shopId || !secretKey) {
    console.log('YuKassa credentials not configured');
    return null;
  }

  try {
    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': order.id,
        Authorization: `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString('base64')}`,
      },
      body: JSON.stringify({
        amount: {
          value: order.totalAmount.toFixed(2),
          currency: 'RUB',
        },
        confirmation: {
          type: 'redirect',
          return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/cart/success?order=${order.orderNumber}`,
        },
        capture: true,
        description: `Заказ ${order.orderNumber}`,
        metadata: {
          order_id: order.id,
          order_number: order.orderNumber,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('YuKassa error:', error);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('YuKassa request error:', error);
    return null;
  }
}
