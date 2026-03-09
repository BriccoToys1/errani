import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import prisma from '@/lib/db';
import { ProductContent } from './ProductContent';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product) return { title: 'Товар не найден' };
  return {
    title: `${product.nameRu || product.name} — errani`,
    description: product.descriptionRu || product.description,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({ where: { slug } });

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
        limitedEditionText: (product as unknown as { limitedEditionText?: string }).limitedEditionText ?? '',
        isAuthor: product.isAuthor,
      }}
    />
  );
}
