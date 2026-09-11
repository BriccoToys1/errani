/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV !== 'production';
const scriptPolicy = isDevelopment
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api-maps.yandex.ru https://yastatic.net"
  : "script-src 'self' 'unsafe-inline' https://api-maps.yandex.ru https://yastatic.net";
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  scriptPolicy,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com https://yastatic.net",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob:",
  "frame-src 'self' https://yandex.ru https://yandex.com https://api-maps.yandex.ru",
  "connect-src 'self' https://nominatim.openstreetmap.org https://api-maps.yandex.ru https://*.maps.yandex.net https://*.yandex.ru https://yastatic.net",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join('; ');

const nextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma'],
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'errani.ru',
      },
      {
        protocol: 'https',
        hostname: 'admin.errani.ru',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  // Сжатие
  compress: true,
  // Убираем лишние заголовки
  poweredByHeader: false,
  async headers() {
    return [
      // -----------------------------------------------------------------------
      // Глобальные заголовки безопасности
      // -----------------------------------------------------------------------
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
        ],
      },
      // -----------------------------------------------------------------------
      // Панель управления — не включаем COEP.
      // require-corp ломает загрузку Next.js-ресурсов/шрифтов в Safari/iOS
      // на поддомене admin.errani.ru, хотя сам HTML отдаётся с HTTP 200.
      // -----------------------------------------------------------------------
      {
        source: '/admin/(.*)',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      // -----------------------------------------------------------------------
      // Кэш медиа из БД — иммутабельно (UUID не меняется)
      // -----------------------------------------------------------------------
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
