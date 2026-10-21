import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/db';
import { Metadata } from 'next';
import Link from 'next/link';
import { withPrismaRetry } from '@/lib/prisma-retry';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  let page = null;
  try {
    page = await withPrismaRetry(
      () => prisma.customPage.findUnique({ where: { slug } }),
      2,
      80
    );
  } catch {
    page = null;
  }
  if (!page || !page.isPublished) return {};
  return {
    title: page.titleRu || page.title,
    description: (page.contentRu || page.content).slice(0, 160),
  };
}

export default async function CustomPublicPage({ params }: Props) {
  const { slug } = await params;
  let page = null;
  try {
    page = await withPrismaRetry(
      () => prisma.customPage.findUnique({ where: { slug } }),
      2,
      80
    );
  } catch {
    page = null;
  }

  if (!page || !page.isPublished) {
    // Legacy product links sometimes used /p/{slug}; send them to the real product route.
    try {
      const product = await withPrismaRetry(
        () => prisma.product.findUnique({ where: { slug }, select: { id: true, isActive: true } }),
        2,
        80
      );
      if (product?.isActive) redirect(`/${slug}`);
    } catch {
      // fall through to 404
    }
    notFound();
  }

  const title = page.titleRu || page.title;
  const content = page.contentRu || page.content;

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px' }}>
      <Link href="/" style={{ color: 'var(--accent, #f58bdc)', fontSize: 14, textDecoration: 'none', marginBottom: 20, display: 'inline-block' }}>
        ← На главную
      </Link>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>{title}</h1>
      <div
        style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary, #ccc)', whiteSpace: 'pre-wrap' }}
      >
        {content}
      </div>
    </div>
  );
}
