import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import { ProductContent } from '../[slug]/ProductContent';

export const dynamic = 'force-dynamic';

const getTenderlyProduct = cache(async () =>
  Promise.race([
    (async () => {
      const bySlug = await prisma.product.findUnique({ where: { slug: 'tenderly-vibe' } });
      if (bySlug) return bySlug;

      // Keep `/tenderly-vibe` resilient if slug was edited in admin.
      return prisma.product.findFirst({
        where: {
          OR: [
            { slug: { startsWith: 'tenderly-vibe' } },
            { slug: { contains: 'tenderly' } },
            { name: { contains: 'Tenderly', mode: 'insensitive' } },
            { nameRu: { contains: 'Tenderly', mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      });
    })(),
    new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout in tenderly page')), 1200)
    ),
  ])
);

export async function generateMetadata(): Promise<Metadata> {
  let product = null;
  try { product = await getTenderlyProduct(); } catch { /* ignore */ }

  if (!product) {
    return { title: 'Tenderly Vibe — errani', robots: { index: false, follow: false } };
  }

  const name = product.nameRu || product.name;
  const desc = product.descriptionRu || product.description || '';
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

  if (!product) {
    notFound();
    return null;
  }

  return (
    <ProductContent
      product={{
        id: product.id,
        slug: product.slug,
        name: product.name,
        nameRu: product.nameRu,
        description: product.description,
        descriptionRu: product.descriptionRu,
        price: product.price,
        oldPrice: product.oldPrice,
        discount: product.discount,
        image: product.image,
        images: product.images,
        inStock: product.inStock && !product.isSaleDisabled && product.stock > 0,
        isPreorder: product.isPreorder,
        preorderClosed: product.preorderClosed,
        preorderAvailableDate: product.preorderAvailableDate?.toISOString() ?? null,
        isLimited: product.isLimited,
        limitedEditionText: product.limitedEditionText,
        isAuthor: product.isAuthor,
        characteristics: product.characteristics,
      }}
    />
  );
}
