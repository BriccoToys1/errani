/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
    unoptimized: true,
  },
  // Сжатие
  compress: true,
  // Убираем лишние заголовки
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
      // Кэш статики на год
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Кэш медиа из базы данных — иммутабельно (UUID не меняется)
      {
        source: '/api/media/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Кэш legacy статических медиа из public/
      {
        source: '/media/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000' },
        ],
      },
      {
        source: '/fonts/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
