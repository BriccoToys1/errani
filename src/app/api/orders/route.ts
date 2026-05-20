import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { generateOrderNumber } from '@/lib/utils';
import { adminGuard } from '@/lib/admin-auth';
import { withPrismaRetry } from '@/lib/prisma-retry';

interface OrderItemInput {
  productId: string;
  quantity: number;
  selectedColor?: string;
}

// Archive unpaid orders
export async function DELETE(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const archived = await prisma.order.updateMany({
      where: { status: { in: ['pending', 'unpaid'] } },
      data: { status: 'archived' },
    });
    return NextResponse.json({ archived: archived.count });
  } catch (error) {
    console.error('Error archiving unpaid orders:', error);
    return NextResponse.json({ error: 'Failed to archive unpaid orders' }, { status: 500 });
  }
}

// GET all orders (admin only)
export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const takeRaw = parseInt(searchParams.get('take') || '', 10);
    const take = Number.isFinite(takeRaw) && takeRaw > 0 ? Math.min(takeRaw, 1000) : undefined;
    const light = searchParams.get('light') === '1';
    const includeArchived = searchParams.get('includeArchived') === '1';

    const orders = await withPrismaRetry(() => prisma.order.findMany({
      ...(take ? { take } : {}),
      ...(includeArchived ? {} : { where: { status: { not: 'archived' } } }),
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        country: true,
        oblast: true,
        city: true,
        zipCode: true,
        street: true,
        house: true,
        apartment: true,
        shippingMethod: true,
        status: true,
        paymentMethod: true,
        totalAmount: true,
        currency: true,
        notes: true,
        isManual: true,
        createdAt: true,
      },
      orderBy: [{ isManual: 'desc' }, { createdAt: 'desc' }],
    }), 2, 80);

    const orderIds = orders.map((order) => order.id);
    const items = orderIds.length > 0
      ? await withPrismaRetry(() => prisma.orderItem.findMany({
          where: { orderId: { in: orderIds } },
          select: {
            id: true,
            orderId: true,
            productId: true,
            quantity: true,
            price: true,
            selectedColor: true,
          },
        }), 2, 80)
      : [];

    const productIds = [...new Set(items.map((item) => item.productId).filter(Boolean))];
    const products = productIds.length > 0
      ? await withPrismaRetry(() => prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, nameRu: true },
        }), 2, 80)
      : [];
    const productById = new Map(products.map((product) => [product.id, product]));
    const itemsByOrderId = new Map<string, Array<{
      id: string;
      productId: string;
      quantity: number;
      price: number;
      selectedColor: string;
      product: { name: string; nameRu?: string | null };
    }>>();

    for (const item of items) {
      const product = productById.get(item.productId);
      const normalizedItem = {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        selectedColor: item.selectedColor,
        product: {
          name: product?.name || 'Товар удалён',
          ...(!light ? { nameRu: product?.nameRu || null } : {}),
        },
      };
      const next = itemsByOrderId.get(item.orderId) || [];
      next.push(normalizedItem);
      itemsByOrderId.set(item.orderId, next);
    }

    return NextResponse.json(orders.map((order) => ({
      ...order,
      items: itemsByOrderId.get(order.id) || [],
    })));
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

// POST create order
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, country, customCountry, oblast, city, zipCode, street, house, apartment, shippingMethod, items } = body as {
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
    let perProductShippingAmount = 0;
    const orderItems = normalizedItems.map(item => {
      const product = products.find(p => p.id === item.productId)!;
      totalAmount += product.price * item.quantity;
      perProductShippingAmount += (Number((product as { shippingFee?: number }).shippingFee || 0) * item.quantity);
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
        selectedColor: item.selectedColor || '',
      };
    });

    // Legacy fallback for products without per-product shipping configured
    const totalItemCount = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
    const legacyShipping = country === 'RU'
      ? (totalItemCount <= 2 ? 350 : totalItemCount <= 5 ? 470 : 790)
      : 0;
    const hasConfiguredPerProductShipping = products.some((p) => Number((p as { shippingFee?: number }).shippingFee || 0) > 0);
    const shippingAmount = hasConfiguredPerProductShipping ? perProductShippingAmount : legacyShipping;
    totalAmount += shippingAmount;

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
