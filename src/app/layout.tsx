import type { Metadata, Viewport } from 'next';
import { Header, Footer, BottomNav, CookieConsent, AnalyticsTracker } from '@/components';
import { Providers } from '@/components/Providers';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#080808',
};

const DEFAULT_METADATA: Metadata = {
  title: {
    default: 'errani — Авторские колоды Таро',
    template: '%s — errani',
  },
  description: 'Авторские колоды Таро Errani Studio: Gothic Vibe, Tenderly Vibe, Autumn Vibe и аксессуары. Оригинальные иллюстрации Ekaterina Errani.',
  keywords: ['таро', 'колода таро', 'авторская колода', 'Ekaterina Errani', 'errani', 'gothic vibe', 'tenderly vibe', 'autumn vibe', 'tarot deck', 'предзаказ'],
  authors: [{ name: 'Ekaterina Errani' }],
  creator: 'Ekaterina Errani',
  publisher: 'errani',
  metadataBase: new URL('https://errani.ru'),
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: 'https://errani.ru',
    siteName: 'errani',
    title: 'errani — Авторские колоды Таро',
    description: 'Авторские колоды Таро и аксессуары Errani Studio. Gothic Vibe, Tenderly Vibe и другие издания с оригинальными иллюстрациями.',
    images: [{ url: '/media/photo-11.jpeg', width: 1200, height: 630, alt: 'errani — Авторские колоды Таро' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'errani — Авторские колоды Таро',
    description: 'Авторские колоды Таро Errani Studio от Ekaterina Errani.',
    images: ['/media/photo-11.jpeg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  icons: {
    icon: '/logos/my_logo.png',
    apple: '/logos/my_logo.png',
  },
  verification: { other: {} },
};

export async function generateMetadata(): Promise<Metadata> {
  try {
    const prisma = (await import('@/lib/db')).default;
    const setting = await Promise.race([
      prisma.siteSettings.findUnique({ where: { key: 'seo_global' } }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    if (setting?.value) {
      const seo = JSON.parse(setting.value) as {
        title?: string;
        description?: string;
        keywords?: string[];
        ogImage?: string;
        ogTitle?: string;
        ogDescription?: string;
      };
      return {
        ...DEFAULT_METADATA,
        ...(seo.title ? { title: { default: seo.title, template: `%s — errani` } } : {}),
        ...(seo.description ? { description: seo.description } : {}),
        ...(seo.keywords ? { keywords: seo.keywords } : {}),
        openGraph: {
          ...DEFAULT_METADATA.openGraph,
          ...(seo.ogTitle ? { title: seo.ogTitle } : {}),
          ...(seo.ogDescription ? { description: seo.ogDescription } : {}),
          ...(seo.ogImage ? { images: [{ url: seo.ogImage, width: 1200, height: 630 }] } : {}),
        },
      };
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_METADATA;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <head>
        <link rel="preload" href="/fonts/Montserrat.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Montserrat-Italic.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'errani',
              url: 'https://errani.ru',
              description: 'Авторские колоды Таро Errani Studio от Ekaterina Errani.',
              author: { '@type': 'Person', name: 'Ekaterina Errani' },
            }),
          }}
        />
      </head>
      <body>
        <Providers>
          <Header />
          {children}
          <Footer />
          <BottomNav />
          <CookieConsent />
          <AnalyticsTracker />
        </Providers>
      </body>
    </html>
  );
}
