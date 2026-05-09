import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/jwt-secret';

export function verifyAdminToken(req: NextRequest): { adminId: string; email: string; name: string } | null {
  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;

  try {
    const secret = getJwtSecret();
    if (!secret) return null;
    const token = auth.substring(7);
    const payload = jwt.verify(token, secret) as { adminId: string; email: string; name: string };
    return payload;
  } catch {
    return null;
  }
}

export function adminGuard(req: NextRequest) {
  const admin = verifyAdminToken(req);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null; // access granted
}
