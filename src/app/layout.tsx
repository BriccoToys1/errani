import type { Metadata, Viewport } from 'next';
import { Header, Footer, BottomNav, CookieConsent, AnalyticsTracker } from '@/components';
import { Providers } from '@/components/Providers';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#080808',
};

export const metadata: Metadata = {
  title: {
    default: 'errani — Авторская колода Таро',
    template: '%s — errani',
  },
  description: 'Авторская колода Таро «Tenderly Vibe» от Ekaterina Errani. 78 уникальных карт с оригинальными иллюстрациями.',
  keywords: ['таро', 'колода таро', 'авторская колода', 'Ekaterina Errani', 'errani', 'tenderly vibe', 'tarot deck', 'предзаказ'],
  authors: [{ name: 'Ekaterina Errani' }],
  creator: 'Ekaterina Errani',
  publisher: 'errani',
  metadataBase: new URL('https://errani.ru'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: 'https://errani.ru',
    siteName: 'errani',
    title: 'errani — Авторская колода Таро «Tenderly Vibe»',
    description: 'Авторская колода Таро «Tenderly Vibe» от Ekaterina Errani. 78 уникальных карт с оригинальными иллюстрациями и матовой ламинацией.',
    images: [
      {
        url: '/media/photo-11.jpeg',
        width: 1200,
        height: 630,
        alt: 'Tenderly Vibe — Авторская колода Таро',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'errani — Авторская колода Таро',
    description: 'Авторская колода Таро «Tenderly Vibe» от Ekaterina Errani.',
    images: ['/media/photo-11.jpeg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/logos/my_logo.png',
    apple: '/logos/my_logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'errani',
              url: 'https://errani.ru',
              description: 'Авторская колода Таро «Tenderly Vibe» от Ekaterina Errani.',
              author: {
                '@type': 'Person',
                name: 'Ekaterina Errani',
              },
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
