import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { withPrismaRetry } from '@/lib/prisma-retry';

const PRODUCTS_STALE_TTL_MS = 60_000;
const QUERY_TIMEOUT_MS = 15_000;
const productsStaleCache = new Map<string, { ts: number; data: unknown }>();

const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function normalizeJsonArrayString(value: unknown, fallback = '[]'): string {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? JSON.stringify(parsed) : fallback;
    } catch {
      return fallback;
    }
  }
  if (Array.isArray(value)) return JSON.stringify(value);
  return fallback;
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeSlug(input: string): string {
  const transliterated = input
    .toLowerCase()
    .split('')
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join('');
  return transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

async function getUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let suffix = 1;
  while (slug) {
    const exists = await withPrismaRetry(() =>
      prisma.product.findUnique({ where: { slug }, select: { id: true } })
    , 2, 80);
    if (!exists) return slug;
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
  return `product-${Date.now()}`;
}

function getProductsCacheKey(req: NextRequest): string {
  const { searchParams } = new URL(req.url);
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
  const cacheKey = getProductsCacheKey(req);
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
      withPrismaRetry(() =>
        prisma.product.findMany({
          where,
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        }),
        2,
        80
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Products query timeout')), QUERY_TIMEOUT_MS)
      ),
    ]);

    productsStaleCache.set(cacheKey, { ts: Date.now(), data: products });

    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    const stale = productsStaleCache.get(cacheKey);
    if (stale && Date.now() - stale.ts < PRODUCTS_STALE_TTL_MS) {
      return NextResponse.json(stale.data, { headers: { 'X-Products-Cache': 'stale' } });
    }
    return NextResponse.json([], { headers: { 'X-Products-Cache': 'empty-fallback' } });
  }
}

// POST create product (admin only)
export async function POST(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const nameRu = String(body.nameRu || '').trim();
    const name = String(body.name || '').trim();
    const descriptionRu = String(body.descriptionRu || '').trim();
    const description = String(body.description || '').trim();
    const stock = Number(body.stock ?? 0);
    const inStock = Boolean(body.inStock ?? true);
    const slugInput = String(body.slug || '').trim() || nameRu || name;
    const baseSlug = normalizeSlug(slugInput) || `product-${Date.now()}`;
    const slug = await getUniqueSlug(baseSlug);
    
    const product = await withPrismaRetry(() =>
      prisma.product.create({
        data: {
        name: name || nameRu || 'Untitled product',
        nameRu: nullableString(nameRu),
        slug,
        description: description || descriptionRu || 'No description',
        descriptionRu: nullableString(descriptionRu),
        price: Number(body.price) || 0,
        oldPrice: body.oldPrice !== null && body.oldPrice !== undefined && body.oldPrice !== ''
          ? Number(body.oldPrice)
          : null,
        discount: Number(body.discount) || 0,
        currency: String(body.currency || 'RUB'),
        image: String(body.image || ''),
        images: normalizeJsonArrayString(body.images),
        stock,
        inStock,
        isPreorder: body.isPreorder ?? false,
        preorderClosed: body.preorderClosed ?? false,
        preorderAvailableDate: body.preorderAvailableDate ? new Date(body.preorderAvailableDate) : null,
        isAuthor: body.isAuthor ?? false,
        isLimited: body.isLimited ?? false,
        limitedEditionText: body.limitedEditionText ?? '',
        characteristics: normalizeJsonArrayString(body.characteristics),
        colors: normalizeJsonArrayString(body.colors),
        isActive: body.isActive ?? true,
        isSaleDisabled: body.isSaleDisabled ?? false,
        isSoldOut: body.isSoldOut ?? false,
        sortOrder: Number(body.sortOrder) || 0,
        },
      })
    );
    
    productsStaleCache.clear();
    return NextResponse.json(product, { status: 201 });
  } catch (error: unknown) {
    if (typeof error === 'object' && error && 'code' in error) {
      const code = (error as { code?: string }).code;
      if (code === 'P2002') {
        return NextResponse.json({ error: 'Товар с таким slug уже существует' }, { status: 409 });
      }
    }
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
