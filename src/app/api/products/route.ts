import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import prisma from '@/lib/db';
import { adminGuard } from '@/lib/admin-auth';
import { withPrismaRetry } from '@/lib/prisma-retry';
import { normalizeProductMediaList } from '@/lib/product-media';
import { hasUsableProductImage, normalizeStockFlags, type StockLike } from '@/lib/product-stock';
import { DEFAULT_LIMITED_EDITION_TEXT_EN, DEFAULT_LIMITED_EDITION_TEXT_RU } from '@/lib/product-defaults';

const PRODUCTS_STALE_TTL_MS = 60 * 60 * 1000;
const PRODUCTS_FRESH_TTL_MS = 20 * 1000;
const QUERY_TIMEOUT_MS = 20_000;
const PRODUCTS_DISK_CACHE_FILE = path.join(process.cwd(), '.next', 'cache', 'products-cache.json');
const productsStaleCache = new Map<string, { ts: number; data: unknown }>();
const FALLBACK_PRODUCTS = [
  {
    id: 'tenderly-vibe-fallback',
    slug: 'tenderly-vibe',
    name: 'Tenderly Vibe',
    nameRu: 'Tenderly Vibe',
    description: 'Авторская колода Таро Tenderly Vibe.',
    descriptionRu: 'Авторская колода Таро Tenderly Vibe.',
    price: 5690,
    shippingFee: 0,
    freeDelivery: false,
    oldPrice: null,
    discount: 0,
    currency: 'RUB',
    image: '/media/photo-11.jpeg',
    images: '["/media/photo-1.jpeg","/media/photo-2.jpeg","/media/photo-3.jpeg","/media/photo-9.jpeg","/media/photo-10.jpeg","/media/photo-8.jpeg"]',
    stock: 0,
    inStock: false,
    isPreorder: false,
    preorderClosed: false,
    preorderAvailableDate: null,
    isAuthor: true,
    isLimited: true,
    limitedEditionText: DEFAULT_LIMITED_EDITION_TEXT_RU,
    limitedEditionTextEn: DEFAULT_LIMITED_EDITION_TEXT_EN,
    characteristics: '[]',
    colors: '[]',
    isActive: true,
    isSaleDisabled: true,
    isSoldOut: true,
    sortOrder: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  },
];

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
    summary: searchParams.get('summary') === '1',
  });
}

async function saveDiskCache(cacheKey: string, data: unknown) {
  try {
    const payload = JSON.stringify({ ts: Date.now(), cacheKey, data });
    await fs.mkdir(path.dirname(PRODUCTS_DISK_CACHE_FILE), { recursive: true });
    await fs.writeFile(PRODUCTS_DISK_CACHE_FILE, payload, 'utf8');
  } catch {
    // best effort cache
  }
}

async function readDiskCache(cacheKey: string): Promise<{ ts: number; data: unknown } | null> {
  try {
    const raw = await fs.readFile(PRODUCTS_DISK_CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as { ts?: number; cacheKey?: string; data?: unknown };
    if (!parsed || typeof parsed.ts !== 'number' || !parsed.data) return null;
    if (parsed.cacheKey !== cacheKey) return null;
    if (Date.now() - parsed.ts > PRODUCTS_STALE_TTL_MS) return null;
    return { ts: parsed.ts, data: parsed.data };
  } catch {
    return null;
  }
}

// GET all products
export async function GET(req: NextRequest) {
  const cacheKey = getProductsCacheKey(req);
  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get('includeArchived') === 'true';
  const showAll = searchParams.get('showAll') === 'true';
  const isAdminDataRequest = includeArchived || showAll;
  const hasAdminCredentials = Boolean(
    req.headers.get('authorization')?.startsWith('Bearer ') || req.cookies.get('admin_token')?.value
  );
  const cached = productsStaleCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < PRODUCTS_FRESH_TTL_MS) {
    const fresh = Array.isArray(cached.data)
      ? cached.data.map((product: StockLike) => normalizeStockFlags(product))
      : cached.data;
    return NextResponse.json(fresh, { headers: { 'X-Products-Cache': 'fresh' } });
  }
  try {
    const filter = searchParams.get('filter'); // author, discount, preorder, all
    
    const isAuthor = filter === 'author' || searchParams.get('author') === 'true';
    const isDiscount = filter === 'discount' || searchParams.get('discount') === 'true';
    const isPreorder = filter === 'preorder' || searchParams.get('preorder') === 'true';
    const summary = searchParams.get('summary') === '1';

    let where: Record<string, unknown> = includeArchived ? {} : { isActive: true };
    if (!showAll) where = { ...where, inStock: true };
    if (isAuthor) where = { ...where, isAuthor: true };
    if (isDiscount) where = { ...where, discount: { gt: 0 } };
    if (isPreorder) where = { ...where, isPreorder: true };
    
    const products = await Promise.race([
      withPrismaRetry(() =>
        prisma.product.findMany({
          where,
          ...(summary
            ? {
                select: {
                  id: true,
                  name: true,
                  nameRu: true,
                  slug: true,
                  price: true,
                  stock: true,
                  inStock: true,
                  isActive: true,
                  isPreorder: true,
                  isLimited: true,
                  createdAt: true,
                },
              }
            : {}),
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        }),
        2,
        80
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Products query timeout')), QUERY_TIMEOUT_MS)
      ),
    ]);

    const mediaNormalized = await normalizeProductMediaList(products);
    const normalizedProducts = mediaNormalized.map((product) => normalizeStockFlags(product));
    productsStaleCache.set(cacheKey, { ts: Date.now(), data: normalizedProducts });
    await saveDiskCache(cacheKey, normalizedProducts);

    return NextResponse.json(normalizedProducts, { headers: { 'X-Products-Cache': 'miss' } });
  } catch (error) {
    console.error('Error fetching products:', error);
    if (isAdminDataRequest && hasAdminCredentials) {
      return NextResponse.json(
        {
          success: false,
          message: 'Не удалось загрузить товары из базы данных',
          code: typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : undefined,
          detail: (error instanceof Error ? error.message : String(error)).replace(/postgres(ql)?:\/\/\S+/gi, '[db-url]').slice(0, 300),
        },
        { status: 500, headers: { 'X-Products-Cache': 'admin-db-error' } }
      );
    }

    const stale = productsStaleCache.get(cacheKey);
    if (stale && Date.now() - stale.ts < PRODUCTS_STALE_TTL_MS) {
      return NextResponse.json(stale.data, { headers: { 'X-Products-Cache': 'stale' } });
    }

    // As a final fallback, try any freshest cache variant to avoid catalog drop.
    let freshest: { ts: number; data: unknown } | null = null;
    for (const entry of productsStaleCache.values()) {
      if (!freshest || entry.ts > freshest.ts) freshest = entry;
    }
    if (freshest) {
      return NextResponse.json(freshest.data, { headers: { 'X-Products-Cache': 'stale-global' } });
    }

    const disk = await readDiskCache(cacheKey);
    if (disk) {
      productsStaleCache.set(cacheKey, disk);
      return NextResponse.json(disk.data, { headers: { 'X-Products-Cache': 'stale-disk' } });
    }

    return NextResponse.json(FALLBACK_PRODUCTS, { headers: { 'X-Products-Cache': 'fallback-static' } });

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
    const image = String(body.image || '').trim();
    const images = normalizeJsonArrayString(body.images);
    if (Boolean(body.isActive ?? true) && !hasUsableProductImage(image)) {
      return NextResponse.json(
        { error: 'Для публикации товара нужна валидная картинка (/media/… или /api/media/…)' },
        { status: 400 }
      );
    }
    const stockFlags = normalizeStockFlags({
      stock: Number(body.stock ?? 0),
      inStock: body.inStock,
      isSoldOut: body.isSoldOut,
      isSaleDisabled: body.isSaleDisabled ?? false,
      isAvailable: body.isAvailable ?? true,
    });
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
        shippingFee: Number(body.shippingFee) || 0,
        freeDelivery: Boolean(body.freeDelivery),
        oldPrice: body.oldPrice !== null && body.oldPrice !== undefined && body.oldPrice !== ''
          ? Number(body.oldPrice)
          : null,
        discount: Number(body.discount) || 0,
        currency: String(body.currency || 'RUB'),
        image,
        images,
        stock: stockFlags.stock ?? 0,
        inStock: Boolean(stockFlags.inStock),
        isPreorder: body.isPreorder ?? false,
        preorderClosed: body.preorderClosed ?? false,
        preorderAvailableDate: body.preorderAvailableDate ? new Date(body.preorderAvailableDate) : null,
        isAuthor: body.isAuthor ?? false,
        isLimited: body.isLimited ?? false,
        limitedEditionText: body.limitedEditionText || (body.isLimited ? DEFAULT_LIMITED_EDITION_TEXT_RU : ''),
        limitedEditionTextEn: body.limitedEditionTextEn || (body.isLimited ? DEFAULT_LIMITED_EDITION_TEXT_EN : ''),
        noticeText: body.noticeText ?? '',
        noticeTextEn: body.noticeTextEn ?? '',
        characteristics: normalizeJsonArrayString(body.characteristics),
        colors: normalizeJsonArrayString(body.colors),
        isActive: body.isActive ?? true,
        isAvailable: Boolean(stockFlags.isAvailable),
        isSaleDisabled: Boolean(stockFlags.isSaleDisabled),
        isSoldOut: Boolean(stockFlags.isSoldOut),
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
