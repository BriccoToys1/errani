import { NextRequest, NextResponse } from 'next/server';
import { calculateCdekDelivery, CdekDeliveryMode, CdekError } from '@/lib/cdek';
import prisma from '@/lib/db';

interface CartItemInput {
  productId?: string;
  quantity?: number;
}

function formatHouseDetails(house: string, building?: string, corpus?: string) {
  return [
    house,
    building ? `стр. ${building}` : '',
    corpus ? `корп. ${corpus}` : '',
  ].filter(Boolean).join(' ');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items = Array.isArray(body.items) ? body.items as CartItemInput[] : [];
    const itemCount = items.reduce((sum, item) => {
      const quantity = Math.floor(Number(item.quantity));
      return sum + (Number.isInteger(quantity) && quantity > 0 ? quantity : 0);
    }, 0);

    if (body.country !== 'RU' || items.length === 0 || itemCount < 1 || itemCount > 100) {
      return NextResponse.json({ error: 'Некорректные данные для расчёта доставки.' }, { status: 400 });
    }

    const mode: CdekDeliveryMode = body.shippingMethod === 'cdek_pvz' ? 'pickup' : 'courier';
    const deliveryPoint = body.cdekDeliveryPoint && typeof body.cdekDeliveryPoint === 'object'
      ? body.cdekDeliveryPoint as { code?: string; cityCode?: number }
      : null;
    if (mode === 'pickup' && (!deliveryPoint?.code || !Number(deliveryPoint.cityCode))) {
      return NextResponse.json({ error: 'Выберите пункт выдачи СДЭК.' }, { status: 400 });
    }

    const productIds = [...new Set(items.map((item) => String(item.productId || '')).filter(Boolean))];
    const products = productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, freeDelivery: true },
        })
      : [];
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: 'Не удалось проверить товары в корзине.' }, { status: 400 });
    }
    const freeDelivery = products.some((product) => product.freeDelivery);

    const house = String(body.house || '').trim();
    const building = String(body.building || '').trim();
    const corpus = String(body.corpus || '').trim();
    const deliveryHouse = formatHouseDetails(house, building, corpus);

    const quote = await calculateCdekDelivery({
      city: String(body.city || ''),
      postalCode: String(body.zipCode || ''),
      address: [body.street, deliveryHouse].filter(Boolean).join(', '),
      street: String(body.street || ''),
      house,
      region: String(body.oblast || ''),
      itemCount,
      mode,
      cityCode: deliveryPoint?.cityCode,
      deliveryPointCode: deliveryPoint?.code,
      freeDelivery,
    });

    return NextResponse.json(quote, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof CdekError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Unexpected CDEK calculation error:', error);
    return NextResponse.json({ error: 'Не удалось рассчитать доставку СДЭК.' }, { status: 500 });
  }
}
