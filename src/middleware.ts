import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'errani-admin-secret-key-change-me';

async function verifyToken(token: string): Promise<boolean> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';

  // ── Admin subdomain redirect: admin.errani.ru → /admin/ ─────────────
  if (host.startsWith('admin.')) {
    if (pathname === '/' || pathname === '') {
      return NextResponse.redirect(new URL('/admin/', req.url));
    }
    if (!pathname.startsWith('/admin') && !pathname.startsWith('/_next') && !pathname.startsWith('/api')) {
      return NextResponse.redirect(new URL(`/admin${pathname}`, req.url));
    }
  }

  // ── Block /admin on main domain (only admin.errani.ru allowed) ──────
  if (pathname.startsWith('/admin') && !host.startsWith('admin.') && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return new NextResponse(null, { status: 404 });
  }

  // ── Admin route protection ───────────────────────────────────────────
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    // Skip API routes — they have their own auth guard
    if (!pathname.startsWith('/api')) {
      const token = req.cookies.get('admin_token')?.value;
      if (!token) {
        // Redirect to login
        const loginUrl = new URL('/admin/login', req.url);
        return NextResponse.redirect(loginUrl);
      }
      const valid = await verifyToken(token);
      if (!valid) {
        const loginUrl = new URL('/admin/login', req.url);
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete('admin_token');
        return response;
      }
    }
  }

  // Never block API, static files
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(settingsUrl.toString(), { cache: 'no-store', signal: controller.signal });
    clearTimeout(timeout);
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
