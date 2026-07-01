import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/jwt-secret';

export interface AdminTokenPayload {
  adminId: string;
  email: string;
  name: string;
}

const JWT_OPTIONS: jwt.VerifyOptions = {
  algorithms: ['HS256'],
  issuer: 'errani-admin',
  audience: 'errani-admin-panel',
};

function verifyToken(token: string, secret: string): AdminTokenPayload | null {
  try {
    const payload = jwt.verify(token, secret, JWT_OPTIONS) as AdminTokenPayload;
    if (!payload.adminId || !payload.email) return null;
    return payload;
  } catch {
    // Legacy tokens did not include issuer/audience. Keep them valid until their
    // existing seven-day expiry, while all newly issued tokens use strict claims.
    try {
      const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as AdminTokenPayload;
      if (!payload.adminId || !payload.email) return null;
      return payload;
    } catch {
      return null;
    }
  }
}

export function verifyAdminToken(req: NextRequest): AdminTokenPayload | null {
  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.substring(7).trim() : '';
  const cookie = req.cookies.get('admin_token')?.value || '';
  const secret = getJwtSecret();
  if (!secret) return null;

  for (const token of [bearer, cookie]) {
    if (!token || token === 'cookie-session') continue;
    const payload = verifyToken(token, secret);
    if (payload) return payload;
  }
  return null;
}

export function adminGuard(req: NextRequest) {
  const admin = verifyAdminToken(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.headers.get('origin');
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    if (origin && host) {
      try {
        if (new URL(origin).host !== host) {
          return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
      }
    }
  }
  return null; // access granted
}
