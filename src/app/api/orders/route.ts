import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { generateOrderNumber } from '@/lib/utils';
import { adminGuard } from '@/lib/admin-auth';

interface OrderItemInput {
  productId: string;
  quantity: number;
  selectedColor?: string;
}

// DELETE unpaid (pending) orders
export async function DELETE(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const pendingOrders = await prisma.order.findMany({
      where: { status: 'pending' },
      select: { id: true },
    });
    const ids = pendingOrders.map(o => o.id);
    if (ids.length > 0) {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
      await prisma.order.deleteMany({ where: { id: { in: ids } } });
    }
    return NextResponse.json({ deleted: ids.length });
  } catch (error) {
    console.error('Error deleting pending orders:', error);
    return NextResponse.json({ error: 'Failed to delete pending orders' }, { status: 500 });
  }
}

// GET all orders (admin only)
export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    // Auto-purge pending orders older than 2 hours
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const stale = await prisma.order.findMany({
      where: { status: 'pending', createdAt: { lt: cutoff } },
      select: { id: true },
    });
    if (stale.length > 0) {
      const ids = stale.map(o => o.id);
      await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
      await prisma.order.deleteMany({ where: { id: { in: ids } } });
    }
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
      orderBy: [{ isManual: 'desc' }, { createdAt: 'desc' }],
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
    const { name, email, phone, country, customCountry, oblast, city, zipCode, street, house, apartment, shippingMethod, items, shippingCost: shippingCostInput } = body as {
      name: string;
      email: string;
      phone: string;
      country: string;
      customCountry?: string;
      oblast?: string;
      city: string;
      zipCode: string;
      street: string;
      house: string;
      apartment: string;
      shippingMethod: string;
      items: OrderItemInput[];
      shippingCost?: number;
    };

    // Validate
    if (!name || !email || !items?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedItems = items
      .map((item) => ({
        productId: String(item.productId || ''),
        quantity: Number(item.quantity || 0),
        selectedColor: item.selectedColor || '',
      }))
      .filter((item) => item.productId && item.quantity > 0);

    if (normalizedItems.length !== items.length) {
      return NextResponse.json({ error: 'Invalid cart items' }, { status: 400 });
    }

    const quantityByProductId = new Map<string, number>();
    for (const item of normalizedItems) {
      quantityByProductId.set(item.productId, (quantityByProductId.get(item.productId) || 0) + item.quantity);
    }

    // Get products and calculate total
    const productIds = [...quantityByProductId.keys()];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json({ error: 'Some products not found' }, { status: 400 });
    }

    const unavailable = products.filter((p) => !p.isActive || !p.inStock || p.isSaleDisabled || p.stock <= 0);
    if (unavailable.length > 0) {
      const names = unavailable.map(p => p.nameRu || p.name).join(', ');
      return NextResponse.json(
        { error: `These products are currently unavailable: ${names}` },
        { status: 409 }
      );
    }

    const insufficient = products.filter((product) => {
      const requestedQty = quantityByProductId.get(product.id) || 0;
      return requestedQty > product.stock;
    });
    if (insufficient.length > 0) {
      const names = insufficient.map((p) => `${p.nameRu || p.name} (доступно: ${p.stock})`).join(', ');
      return NextResponse.json(
        { error: `Not enough stock for: ${names}` },
        { status: 409 }
      );
    }

    // Per-color stock validation
    for (const item of normalizedItems) {
      if (!item.selectedColor) continue;
      const product = products.find(p => p.id === item.productId)!;
      try {
        const colors: Array<{ name: string; stock?: number }> = JSON.parse(product.colors || '[]');
        const colorEntry = colors.find(c => c.name === item.selectedColor);
        if (colorEntry && typeof colorEntry.stock === 'number') {
          if (item.quantity > colorEntry.stock) {
            return NextResponse.json(
              { error: `Недостаточно остатков цвета «${item.selectedColor}» для товара «${product.nameRu || product.name}» (доступно: ${colorEntry.stock})` },
              { status: 409 }
            );
          }
        }
      } catch {
        // ignore JSON parse errors
      }
    }

    let totalAmount = 0;
    const orderItems = normalizedItems.map(item => {
      const product = products.find(p => p.id === item.productId)!;
      totalAmount += product.price * item.quantity;
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        selectedColor: item.selectedColor || '',
      };
    });
    // Add shipping cost if provided (Russia only)
    totalAmount += Number(shippingCostInput) || 0;

    // Build notes from color selections
    const colorNotes = normalizedItems
      .filter(item => item.selectedColor)
      .map(item => {
        const product = products.find(p => p.id === item.productId)!;
        return `${product.nameRu || product.name}: ${item.selectedColor}`;
      });
    const notes = colorNotes.length > 0 ? `Цвета: ${colorNotes.join(', ')}` : '';

    // Create order
    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: null,
        customerName: name,
        customerEmail: email,
        customerPhone: phone || '',
        country: (country === 'OTHER' ? (customCountry || 'Другая страна') : country) || 'RU',
        oblast: oblast || '',
        city: city || '',
        zipCode: zipCode || '',
        street: street || '',
        house: house || '',
        apartment: apartment || '',
        shippingMethod: shippingMethod || '',
        totalAmount,
        currency: 'RUB',
        status: 'pending',
        notes,
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
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to create order', detail: msg }, { status: 500 });
  }
}

// YuKassa payment creation
async function createYukassaPayment(order: { id: string; orderNumber: string; totalAmount: number }) {
  const shopId = process.env.YUKASSA_SHOP_ID;
  const secretKey = process.env.YUKASSA_SECRET_KEY;

  console.log('YuKassa env check - shopId:', shopId ? `${shopId.slice(0,4)}...` : 'MISSING', 'secretKey:', secretKey ? 'present' : 'MISSING');

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
      console.error('YuKassa error:', response.status, error);
      return null;
    }

    const result = await response.json();
    console.log('YuKassa success, paymentUrl:', result?.confirmation?.confirmation_url);
    return result;
  } catch (error) {
    console.error('YuKassa request error:', error);
    return null;
  }
}
