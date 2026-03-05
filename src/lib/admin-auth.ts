import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'errani-admin-secret-key-change-me';

export function verifyAdminToken(req: NextRequest): { adminId: string; email: string; name: string } | null {
  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;

  try {
    const token = auth.substring(7);
    const payload = jwt.verify(token, JWT_SECRET) as { adminId: string; email: string; name: string };
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
