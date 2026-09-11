import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { generateOrderNumber } from '@/lib/utils';
import { adminGuard } from '@/lib/admin-auth';
import { withPrismaRetry } from '@/lib/prisma-retry';
import { withFreshPrisma } from '@/lib/fresh-prisma';
import { createTochkaPayment, getTochkaConfig } from '@/lib/tochka';
import { consumeRateLimit } from '@/lib/rate-limit';
import { refreshPaidOrderStatus } from '@/lib/payment-status';

interface OrderItemInput {
  productId: string;
  quantity: number;
  selectedColor?: string;
}

function formatHouseDetails(house: string, building?: string, corpus?: string) {
  return [
    house,
    building ? `стр. ${building}` : '',
    corpus ? `корп. ${corpus}` : '',
  ].filter(Boolean).join(' ');
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

    const pendingPayments = await prisma.order.findMany({
      where: {
        status: { in: ['pending', 'unpaid'] },
        paymentId: { not: '' },
      },
      select: { orderNumber: true },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    await Promise.allSettled(pendingPayments.map((order) => refreshPaidOrderStatus(order.orderNumber)));

    const { orders, items, products } = await withFreshPrisma(async (db) => {
      const orders = await db.order.findMany({
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
          entrance: true,
          floor: true,
          intercom: true,
          shippingMethod: true,
          cdekDeliveryPointCode: true,
          cdekDeliveryPointAddress: true,
          cdekTariffCode: true,
          cdekUuid: true,
          cdekNumber: true,
          cdekError: true,
          status: true,
          paymentMethod: true,
          totalAmount: true,
          currency: true,
          notes: true,
          isManual: true,
          createdAt: true,
        },
        orderBy: [{ isManual: 'desc' }, { createdAt: 'desc' }],
      });

      const orderIds = orders.map((order) => order.id);
      const items = orderIds.length > 0
        ? await db.orderItem.findMany({
            where: { orderId: { in: orderIds } },
            select: {
              id: true,
              orderId: true,
              productId: true,
              quantity: true,
              price: true,
              selectedColor: true,
            },
          })
        : [];

      const productIds = [...new Set(items.map((item) => item.productId).filter(Boolean))];
      const products = productIds.length > 0
        ? await db.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, nameRu: true },
          })
        : [];

      return { orders, items, products };
    });
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
    const rate = consumeRateLimit(req, { key: 'create-order', limit: 20, windowMs: 10 * 60_000 });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many checkout attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      );
    }

    const body = await req.json();
    const { name, email, phone, country, oblast, city, zipCode, street, house, building, corpus, apartment, entrance, floor, intercom, shippingMethod, items } = body as {
      name: string;
      email: string;
      phone: string;
      country: string;
      oblast?: string;
      city: string;
      zipCode: string;
      street: string;
      house: string;
      building?: string;
      corpus?: string;
      apartment: string;
      entrance?: string;
      floor?: string;
      intercom?: string;
      shippingMethod: string;
      items: OrderItemInput[];
    };

    // Validate
    if (!name || !email || !phone || !city || !Array.isArray(items) || !items.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (
      items.length > 30
      || String(name).trim().length > 120
      || String(email).trim().length > 254
      || String(phone).trim().length > 32
      || String(city).trim().length > 120
      || String(building || '').trim().length > 40
      || String(corpus || '').trim().length > 40
      || String(entrance || '').trim().length > 40
      || String(floor || '').trim().length > 40
      || String(intercom || '').trim().length > 80
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
    ) {
      return NextResponse.json({ error: 'Invalid order data' }, { status: 400 });
    }
    if (country !== 'RU') {
      return NextResponse.json({ error: 'Онлайн-заказ доступен только для доставки по России.' }, { status: 400 });
    }

    if (shippingMethod && shippingMethod !== 'manual_delivery') {
      return NextResponse.json({ error: 'Этот способ доставки больше недоступен. Обновите страницу и оформите заказ с ручным адресом.' }, { status: 400 });
    }
    if ((!street || !house) || (zipCode && !/^\d{6}$/.test(zipCode))) {
      return NextResponse.json({ error: 'Укажите адрес доставки.' }, { status: 400 });
    }

    // Check if user is blocked
    const normalizedEmail = String(email).trim().toLowerCase();
    const metaSetting = await prisma.siteSettings.findUnique({ where: { key: 'customer_profiles_meta_v1' } });
    if (metaSetting?.value) {
      try {
        const meta = JSON.parse(metaSetting.value) as Record<string, { badges?: string[] }>;
        if (meta[normalizedEmail]?.badges?.includes('__blocked__')) {
          return NextResponse.json({ error: 'Проверка по идентичности ФИО и номера телефона' }, { status: 403 });
        }
      } catch { /* ignore */ }
    }

    const normalizedItems = items
      .map((item) => ({
        productId: String(item.productId || ''),
        quantity: Number(item.quantity || 0),
        selectedColor: String(item.selectedColor || '').slice(0, 80),
      }))
      .filter((item) => (
        item.productId.length <= 64
        && Number.isSafeInteger(item.quantity)
        && item.quantity > 0
        && item.quantity <= 20
      ));

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

    const freeDelivery = products.some((product) => product.freeDelivery);
    const deliveryHouse = formatHouseDetails(String(house || '').trim(), String(building || '').trim(), String(corpus || '').trim());
    const shippingCost = freeDelivery
      ? 0
      : products.reduce((sum, product) => {
          const quantity = quantityByProductId.get(product.id) || 0;
          return sum + (product.shippingFee || 0) * quantity;
        }, 0);
    totalAmount += shippingCost;

    // Build notes from color selections
    const colorNotes = normalizedItems
      .filter(item => item.selectedColor)
      .map(item => {
        const product = products.find(p => p.id === item.productId)!;
        return `${product.nameRu || product.name}: ${item.selectedColor}`;
      });
    const deliveryNote = `Доставка: ${shippingCost.toLocaleString('ru-RU')} ₽`;
    const notes = [colorNotes.length > 0 ? `Цвета: ${colorNotes.join(', ')}` : '', deliveryNote]
      .filter(Boolean)
      .join('\n');

    // Create order
    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: null,
        customerName: name,
        customerEmail: email,
        customerPhone: phone || '',
        country: 'RU',
        oblast: oblast || '',
        city: city || '',
        zipCode: zipCode || '',
        street: street || '',
        house: deliveryHouse || house || '',
        apartment: apartment || '',
        entrance: apartment ? String(entrance || '').trim() : '',
        floor: apartment ? String(floor || '').trim() : '',
        intercom: apartment ? String(intercom || '').trim() : '',
        shippingMethod: 'manual_delivery',
        cdekDeliveryPointCode: '',
        cdekDeliveryPointAddress: '',
        cdekTariffCode: 0,
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
      const tochkaConfig = getTochkaConfig();
      const tochkaResponse = tochkaConfig ? await createTochkaPayment(order) : null;

      if (tochkaResponse?.paymentLink) {
        paymentUrl = tochkaResponse.paymentLink;
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentId: tochkaResponse.operationId || tochkaResponse.paymentLinkId || order.orderNumber, paymentMethod: 'tochka' },
        });
      } else {
        // Payment URL creation failed — cancel the order so it doesn't litter the DB
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'cancelled' },
        });
        const detail = (tochkaResponse?.raw as { __error?: string } | undefined)?.__error || 'no response';
        console.error('Payment link creation failed:', detail);
        return NextResponse.json(
          { error: 'Не удалось создать платёж. Попробуйте ещё раз или свяжитесь с нами.' },
          { status: 502 }
        );
      }
    } else {
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentMethod: 'tochka' },
      });
    }

    return NextResponse.json({
      orderNumber: order.orderNumber,
      total: totalAmount,
      shippingCost,
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
          return_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://errani.ru'}/cart/success?order=${order.orderNumber}`,
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
      return { __error: `YuKassa ${response.status}: ${error}` };
    }

    const result = await response.json();
    console.log('YuKassa success, paymentUrl:', result?.confirmation?.confirmation_url);
    return result;
  } catch (error) {
    console.error('YuKassa request error:', error);
    return null;
  }
}
