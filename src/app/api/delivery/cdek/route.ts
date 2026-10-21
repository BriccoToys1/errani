import { NextRequest, NextResponse } from 'next/server';
import { calculateCdekDelivery, CdekDeliveryMode, CdekError } from '@/lib/cdek';
import prisma from '@/lib/db';
import { flash, langFromRequest } from '@/lib/flash';

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
    const lang = langFromRequest(req, body.lang ?? body.language);
    const items = Array.isArray(body.items) ? body.items as CartItemInput[] : [];
    const itemCount = items.reduce((sum, item) => {
      const quantity = Math.floor(Number(item.quantity));
      return sum + (Number.isInteger(quantity) && quantity > 0 ? quantity : 0);
    }, 0);

    if (body.country !== 'RU' || items.length === 0 || itemCount < 1 || itemCount > 100) {
      return NextResponse.json({ error: flash(lang, 'cdek.calc_invalid') }, { status: 400 });
    }

    const mode: CdekDeliveryMode = body.shippingMethod === 'cdek_pvz' ? 'pickup' : 'courier';
    const deliveryPoint = body.cdekDeliveryPoint && typeof body.cdekDeliveryPoint === 'object'
      ? body.cdekDeliveryPoint as { code?: string; cityCode?: number }
      : null;
    if (mode === 'pickup' && (!deliveryPoint?.code || !Number(deliveryPoint.cityCode))) {
      return NextResponse.json({ error: flash(lang, 'cdek.select_pvz') }, { status: 400 });
    }

    const productIds = [...new Set(items.map((item) => String(item.productId || '')).filter(Boolean))];
    const products = productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, freeDelivery: true },
        })
      : [];
    if (products.length !== productIds.length) {
      return NextResponse.json({ error: flash(lang, 'cdek.cart_check_failed') }, { status: 400 });
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
    const lang = langFromRequest(req);
    if (error instanceof CdekError) {
      return NextResponse.json({ error: error.localize(lang) }, { status: error.status });
    }
    console.error('Unexpected CDEK calculation error:', error);
    return NextResponse.json({ error: flash(lang, 'cdek.calc_failed') }, { status: 500 });
  }
}
