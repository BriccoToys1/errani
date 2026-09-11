import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

function hostname(req: NextRequest): string {
  const raw = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  return raw.split(',')[0].trim().split(':')[0].toLowerCase();
}

async function hasValidAdminToken(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin_token')?.value;
  const secret = process.env.JWT_SECRET;
  if (!token || !secret || secret.length < 32) return false;

  const key = new TextEncoder().encode(secret);
  try {
    const payload = await jwtVerify(token, key, {
      algorithms: ['HS256'],
      issuer: 'errani-admin',
      audience: 'errani-admin-panel',
    });
    return Boolean(payload?.payload?.adminId || payload?.payload?.email);
  } catch {
    try {
      const fallbackPayload = await jwtVerify(token, key, { algorithms: ['HS256'] });
      return Boolean(fallbackPayload?.payload?.adminId || fallbackPayload?.payload?.email);
    } catch {
      return false;
    }
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = hostname(req);
  const isAdminHost = host === 'admin.errani.ru';
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';
  const isPublicAsset =
    pathname.startsWith('/fonts') ||
    pathname.startsWith('/logos') ||
    pathname.startsWith('/media') ||
    pathname.startsWith('/uploads') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml';

  if (isAdminHost) {
    if (pathname === '/' || pathname === '') {
      // Go directly to the login page. Redirecting through /admin/ causes an
      // additional Next.js trailing-slash redirect on mobile clients.
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
    if (
      !isPublicAsset &&
      !pathname.startsWith('/admin') &&
      !pathname.startsWith('/_next') &&
      !pathname.startsWith('/api')
    ) {
      return NextResponse.redirect(new URL(`/admin${pathname}`, req.url));
    }
  }

  if (pathname.startsWith('/admin') && !isAdminHost && !isLocalHost) {
    return new NextResponse(null, { status: 404 });
  }

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!(await hasValidAdminToken(req))) {
      const loginUrl = new URL('/admin/login', req.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('admin_token');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
