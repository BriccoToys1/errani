import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getJwtSecret } from '@/lib/jwt-secret';

async function verifyToken(token: string): Promise<boolean> {
  try {
    const jwtSecret = getJwtSecret();
    if (!jwtSecret) return false;
    const secret = new TextEncoder().encode(jwtSecret);
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

  // Avoid extra DB load from middleware-level status checks.
  // This keeps public pages available even under temporary DB pressure.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
