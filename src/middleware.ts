import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Never block admin, API, static files
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/fonts') ||
    pathname.startsWith('/logos') ||
    pathname.startsWith('/media') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Check site enabled setting from DB via internal API
  try {
    const settingsUrl = new URL('/api/admin/public-status', req.url);
    const res = await fetch(settingsUrl.toString(), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.maintenanceMode) {
        return new NextResponse(
          `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Технические работы — errani</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #080808;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
    }
    .wrap { max-width: 480px; padding: 2rem; }
    h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; letter-spacing: 0.05em; }
    p { color: rgba(255,255,255,0.5); font-size: 0.9rem; line-height: 1.7; }
    .dot { width: 8px; height: 8px; background: #f59e0b; border-radius: 50%; display: inline-block; margin-bottom: 2rem; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.3} }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="dot"></div>
    <h1>Технические работы</h1>
    <p>${data.maintenanceMessage || 'Сайт временно недоступен. Мы скоро вернёмся.'}</p>
  </div>
</body>
</html>`,
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '300' } }
        );
      }
      if (data.siteDisabled) {
        return new NextResponse(
          `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>errani — скоро открытие</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #080808; color: #fff;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; text-align: center;
    }
    .wrap { max-width: 480px; padding: 2rem; }
    h1 { font-size: 2rem; font-weight: 700; margin-bottom: 1rem; letter-spacing: 0.15em; text-transform: uppercase; }
    p { color: rgba(255,255,255,0.4); font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>errani</h1>
    <p>Скоро открытие</p>
  </div>
</body>
</html>`,
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '3600' } }
        );
      }
    }
  } catch {
    // If check fails, allow through — don't block visitors due to internal error
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
