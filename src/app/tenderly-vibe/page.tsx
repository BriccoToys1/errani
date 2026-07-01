import type { Metadata } from 'next';
import { cache } from 'react';
import prisma from '@/lib/db';
import { withPrismaRetry } from '@/lib/prisma-retry';
import { normalizeProductMedia } from '@/lib/product-media';
import { ProductContent } from '../[slug]/ProductContent';
import { DEFAULT_LIMITED_EDITION_TEXT_EN, DEFAULT_LIMITED_EDITION_TEXT_RU } from '@/lib/product-defaults';

export const dynamic = 'force-dynamic';
const DB_PAGE_TIMEOUT_MS = 4_000;

const TENDERLY_FALLBACK_PRODUCT = {
  id: 'tenderly-vibe-fallback',
  slug: 'tenderly-vibe',
  name: 'Tenderly Vibe',
  nameRu: 'Tenderly Vibe',
  description:
    'When I created this deck, I wanted to preserve warmth, softness, and tenderness in every card.',
  descriptionRu:
    'Создавая эту колоду, я хотела передать тёплую, добрую атмосферу и искреннюю нежность, которые живут в каждом из нас.',
  price: 5690,
  shippingFee: 0,
  oldPrice: null,
  discount: 0,
  image: '/media/photo-11.jpeg',
  images: '["/media/photo-1.jpeg","/media/photo-2.jpeg","/media/photo-3.jpeg","/media/photo-9.jpeg","/media/photo-10.jpeg","/media/photo-8.jpeg"]',
  inStock: false,
  isPreorder: false,
  preorderClosed: false,
  preorderAvailableDate: null,
  isLimited: true,
  limitedEditionText: DEFAULT_LIMITED_EDITION_TEXT_RU,
  limitedEditionTextEn: DEFAULT_LIMITED_EDITION_TEXT_EN,
  isAuthor: true,
  characteristics: '[]',
  colors: '[]',
};

type TenderlyProduct = Awaited<ReturnType<typeof prisma.product.findUnique>>;

async function withDbTimeout<T>(operation: Promise<T>): Promise<T | null> {
  try {
    return await Promise.race([
      operation,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), DB_PAGE_TIMEOUT_MS)),
    ]);
  } catch {
    return null;
  }
}

const getTenderlyProduct = cache(async (): Promise<TenderlyProduct> => {
  const bySlug = await withDbTimeout(
    withPrismaRetry(() =>
      prisma.product.findUnique({ where: { slug: 'tenderly-vibe' } })
    , 2, 80)
  );
  if (bySlug) return bySlug;

  return withDbTimeout(
    withPrismaRetry(() =>
      prisma.product.findFirst({
        where: {
          OR: [
            { slug: { startsWith: 'tenderly-vibe' } },
            { slug: { contains: 'tenderly' } },
            { name: { contains: 'Tenderly', mode: 'insensitive' } },
            { nameRu: { contains: 'Tenderly', mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      })
    , 2, 80)
  );
});

export async function generateMetadata(): Promise<Metadata> {
  let product = null;
  try { product = await getTenderlyProduct(); } catch { /* ignore */ }

  const effective = await normalizeProductMedia(product || TENDERLY_FALLBACK_PRODUCT);

  const name = effective.nameRu || effective.name;
  const desc = effective.descriptionRu || effective.description || '';
  return {
    title: `${name} — errani`,
    description: desc.slice(0, 160) || undefined,
    robots: { index: true, follow: true },
  };
}

export default async function TenderlyVibePage() {
  let product = null;
  try {
    product = await getTenderlyProduct();
  } catch (error) {
    console.error('Tenderly page DB error:', error);
  }

  const effectiveProduct = await normalizeProductMedia(product || TENDERLY_FALLBACK_PRODUCT);
  const preorderAvailableDate = product?.preorderAvailableDate?.toISOString() ?? null;

  return (
    <ProductContent
      product={{
        id: effectiveProduct.id,
        slug: effectiveProduct.slug,
        name: effectiveProduct.name,
        nameRu: effectiveProduct.nameRu,
        description: effectiveProduct.description,
        descriptionRu: effectiveProduct.descriptionRu,
        price: effectiveProduct.price,
        shippingFee: (effectiveProduct as { shippingFee?: number }).shippingFee ?? 0,
        oldPrice: effectiveProduct.oldPrice,
        discount: effectiveProduct.discount,
        image: effectiveProduct.image,
        images: effectiveProduct.images,
        inStock: product
          ? product.inStock && !product.isSaleDisabled && product.stock > 0
          : effectiveProduct.inStock,
        isPreorder: effectiveProduct.isPreorder,
        preorderClosed: effectiveProduct.preorderClosed,
        preorderAvailableDate,
        isLimited: effectiveProduct.isLimited,
        limitedEditionText: effectiveProduct.limitedEditionText,
        isAuthor: effectiveProduct.isAuthor,
        characteristics: effectiveProduct.characteristics,
        colors: effectiveProduct.colors,
      }}
    />
  );
}
