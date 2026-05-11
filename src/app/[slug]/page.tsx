import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { cache } from 'react';
import prisma from '@/lib/db';
import { withPrismaRetry } from '@/lib/prisma-retry';
import { ProductContent } from './ProductContent';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

const SAFE_SLUG_PATTERN = /^[a-z0-9_-]+$/i;

const getProductBySlug = cache(async (slug: string) => {
  return withPrismaRetry(() => prisma.product.findUnique({ where: { slug } }), 2, 80);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!SAFE_SLUG_PATTERN.test(slug)) return { title: 'Товар не найден' };

  // Keep metadata DB-free to reduce pressure on Neon during traffic spikes.
  const readable = slug.replace(/-/g, ' ');
  return { title: `${readable} — errani` };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  if (!SAFE_SLUG_PATTERN.test(slug)) notFound();

  let product = null;
  try {
    product = await getProductBySlug(slug);
  } catch (error) {
    console.error(`Product page DB error (${slug}):`, error);
  }

  if (!product || !product.isActive) notFound();
  const canBePurchased = product.inStock && !product.isSaleDisabled && product.stock > 0;

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
        shippingFee: product.shippingFee,
        oldPrice: product.oldPrice,
        discount: product.discount,
        image: product.image,
        images: product.images,
        inStock: canBePurchased,
        isPreorder: product.isPreorder,
        isLimited: product.isLimited,
        limitedEditionText: product.limitedEditionText,
        isAuthor: product.isAuthor,
        characteristics: product.characteristics,
        colors: product.colors,
      }}
    />
  );
}
