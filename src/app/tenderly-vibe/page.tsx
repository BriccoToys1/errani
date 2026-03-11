import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import { ProductContent } from '../[slug]/ProductContent';

export async function generateMetadata() {
  const product = await prisma.product.findUnique({ where: { slug: 'tenderly-vibe' } });
  if (!product) return { title: 'Tenderly Vibe Tarot' };
  return {
    title: `${product.nameRu || product.name} — errani`,
    description: product.descriptionRu || product.description,
  };
}

export default async function TenderlyVibePage() {
  const product = await prisma.product.findUnique({ where: { slug: 'tenderly-vibe' } });
  if (!product || !product.isActive) notFound();

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
        isPreorder: product.isPreorder,
        isLimited: product.isLimited,
        limitedEditionText: product.limitedEditionText,
        isAuthor: product.isAuthor,
        characteristics: product.characteristics,
      }}
    />
  );
}
