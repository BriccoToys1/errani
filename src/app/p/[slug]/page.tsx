import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import { Metadata } from 'next';
import Link from 'next/link';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await prisma.customPage.findUnique({ where: { slug } });
  if (!page || !page.isPublished) return {};
  return {
    title: `${page.titleRu || page.title} — errani`,
    description: (page.contentRu || page.content).slice(0, 160),
  };
}

export default async function CustomPublicPage({ params }: Props) {
  const { slug } = await params;
  const page = await prisma.customPage.findUnique({ where: { slug } });

  if (!page || !page.isPublished) {
    notFound();
  }

  const title = page.titleRu || page.title;
  const content = page.contentRu || page.content;

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px' }}>
      <Link href="/" style={{ color: 'var(--accent, #E8722A)', fontSize: 14, textDecoration: 'none', marginBottom: 20, display: 'inline-block' }}>
        ← На главную
      </Link>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>{title}</h1>
      <div
        style={{ fontSize: 15, lineHeight: 1.7, color: '#333' }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
}
