import type { Metadata } from 'next';
import { OfertaContent } from './OfertaContent';

const DEFAULT_META: Metadata = {
  title: 'Публичная оферта / Public Offer — errani',
  description: 'Договор купли-продажи между errani и покупателем / Sales agreement between errani and the buyer.',
  robots: { index: false },
};

export async function generateMetadata(): Promise<Metadata> {
  try {
    const prisma = (await import('@/lib/db')).default;
    const setting = await Promise.race([
      prisma.siteSettings.findUnique({ where: { key: 'seo_oferta' } }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    if (setting?.value) {
      const seo = JSON.parse(setting.value) as { title?: string; description?: string; keywords?: string[]; ogTitle?: string; ogDescription?: string; ogImage?: string };
      return {
        ...DEFAULT_META,
        ...(seo.title ? { title: seo.title } : {}),
        ...(seo.description ? { description: seo.description } : {}),
        ...(seo.keywords?.length ? { keywords: seo.keywords } : {}),
        openGraph: {
          ...(seo.ogTitle ? { title: seo.ogTitle } : {}),
          ...(seo.ogDescription ? { description: seo.ogDescription } : {}),
          ...(seo.ogImage ? { images: [{ url: seo.ogImage, width: 1200, height: 630 }] } : {}),
        },
      };
    }
  } catch { /* fall through */ }
  return DEFAULT_META;
}

export default function OfertaPage() {
  return <OfertaContent />;
}
