import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';

const PRODUCTS_CACHE_TTL_MS = 15000;
const QUERY_TIMEOUT_MS = 5000;
const productsCache = new Map<string, { expiresAt: number; data: unknown }>();

function getCacheKey(url: string): string {
  const { searchParams } = new URL(url);
  return JSON.stringify({
    filter: searchParams.get('filter') || '',
    showAll: searchParams.get('showAll') === 'true',
    author: searchParams.get('author') === 'true',
    discount: searchParams.get('discount') === 'true',
    preorder: searchParams.get('preorder') === 'true',
    includeArchived: searchParams.get('includeArchived') === 'true',
  });
}

// GET all products
export async function GET(req: NextRequest) {
  const cacheKey = getCacheKey(req.url);
  const now = Date.now();
  const freshCache = productsCache.get(cacheKey);
  if (freshCache && freshCache.expiresAt > now) {
    return NextResponse.json(freshCache.data, {
      headers: { 'X-Products-Cache': 'hit' },
    });
  }

  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter'); // author, discount, preorder, all
    const showAll = searchParams.get('showAll') === 'true'; // include out of stock
    
    const isAuthor = filter === 'author' || searchParams.get('author') === 'true';
    const isDiscount = filter === 'discount' || searchParams.get('discount') === 'true';
    const isPreorder = filter === 'preorder' || searchParams.get('preorder') === 'true';
    const includeArchived = searchParams.get('includeArchived') === 'true';

    let where: Record<string, unknown> = includeArchived ? {} : { isActive: true };
    if (!showAll) where = { ...where, inStock: true };
    if (isAuthor) where = { ...where, isAuthor: true };
    if (isDiscount) where = { ...where, discount: { gt: 0 } };
    if (isPreorder) where = { ...where, isPreorder: true };
    
    const products = await Promise.race([
      prisma.product.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Products query timeout')), QUERY_TIMEOUT_MS)
      ),
    ]);

    productsCache.set(cacheKey, { expiresAt: now + PRODUCTS_CACHE_TTL_MS, data: products });

    return NextResponse.json(products, {
      headers: { 'X-Products-Cache': 'miss' },
    });
  } catch (error) {
    const staleCache = productsCache.get(cacheKey);
    if (staleCache) {
      return NextResponse.json(staleCache.data, {
        headers: { 'X-Products-Cache': 'stale' },
      });
    }

    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

// POST create product (admin only)
export async function POST(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const stock = Number(body.stock ?? 0);
    const inStock = Boolean(body.inStock ?? true) && stock > 0;
    
    const product = await prisma.product.create({
      data: {
        name: body.name,
        nameRu: body.nameRu || null,
        slug: body.slug,
        description: body.description,
        descriptionRu: body.descriptionRu || null,
        price: body.price,
        oldPrice: body.oldPrice || null,
        discount: body.discount || 0,
        currency: body.currency || 'RUB',
        image: body.image,
        images: typeof body.images === 'string' ? body.images : JSON.stringify(body.images || []),
        stock,
        inStock,
        isPreorder: body.isPreorder ?? false,
        preorderClosed: body.preorderClosed ?? false,
        preorderAvailableDate: body.preorderAvailableDate ? new Date(body.preorderAvailableDate) : null,
        isAuthor: body.isAuthor ?? false,
        isLimited: body.isLimited ?? false,
        limitedEditionText: body.limitedEditionText ?? '',
        characteristics: body.characteristics ?? '[]',
        isActive: body.isActive ?? true,
        isSaleDisabled: body.isSaleDisabled ?? false,
        isSoldOut: body.isSoldOut ?? false,
        sortOrder: body.sortOrder || 0,
      },
    });
    
    productsCache.clear();
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
