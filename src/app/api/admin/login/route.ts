import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { withPrismaRetry } from '@/lib/prisma-retry';
import { getJwtSecret } from '@/lib/jwt-secret';

function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

async function recordAdminSession(req: NextRequest, email: string, name: string) {
  const ip = getClientIP(req);
  const entry = {
    at: new Date().toISOString(),
    email,
    name,
    ip,
    country: req.headers.get('x-vercel-ip-country') || '',
    city: req.headers.get('x-vercel-ip-city') || '',
    userAgent: req.headers.get('user-agent') || '',
  };

  try {
    const current = await withPrismaRetry(
      () => prisma.siteSettings.findUnique({ where: { key: 'admin_sessions_v1' } }),
      2, 80
    );
    let list: typeof entry[] = [];
    try {
      const parsed = JSON.parse(current?.value || '[]');
      if (Array.isArray(parsed)) list = parsed as typeof entry[];
    } catch { list = []; }
    await withPrismaRetry(
      () => prisma.siteSettings.upsert({
        where: { key: 'admin_sessions_v1' },
        update: { value: JSON.stringify([entry, ...list].slice(0, 100)) },
        create: { key: 'admin_sessions_v1', value: JSON.stringify([entry]) },
      }),
      2, 80
    );
  } catch (error) {
    console.error('Failed to record admin session:', error);
  }
}

// Stateless challenge: signed JWT containing the expected answer
export async function GET() {
  const jwtSecret = getJwtSecret();
  if (!jwtSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });

  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  const answer = String(a + b);

  // Sign the expected answer — expires in 10 minutes
  const challengeToken = jwt.sign({ answer }, jwtSecret, { expiresIn: '10m' });

  return NextResponse.json({ challengeToken, question: `${a} + ${b}` });
}

export async function POST(req: NextRequest) {
  try {
    const jwtSecret = getJwtSecret();
    if (!jwtSecret) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const { email, password, challengeToken, challengeAnswer } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 });
    }

    // Verify stateless challenge
    if (!challengeToken || !challengeAnswer) {
      return NextResponse.json({ error: 'Пройдите проверку' }, { status: 400 });
    }

    let expectedAnswer: string;
    try {
      const decoded = jwt.verify(challengeToken, jwtSecret) as { answer: string };
      expectedAnswer = decoded.answer;
    } catch {
      return NextResponse.json({ error: 'Проверка истекла, обновите страницу' }, { status: 400 });
    }

    if (String(challengeAnswer).trim() !== expectedAnswer) {
      return NextResponse.json({ error: 'Неверный ответ на проверку' }, { status: 400 });
    }

    // Check env-level admin first
    const normalizedEmail = String(email).trim().toLowerCase();
    const envAdminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const envAdminPassword = String(process.env.ADMIN_PASSWORD || '');
    if (envAdminEmail && envAdminPassword && normalizedEmail === envAdminEmail && String(password) === envAdminPassword) {
      await recordAdminSession(req, String(email).trim(), 'Admin');
      const token = jwt.sign(
        { adminId: 'env-admin', email: String(email).trim(), name: 'Admin' },
        jwtSecret,
        { expiresIn: '7d' }
      );
      return NextResponse.json({ token, name: 'Admin' });
    }

    // DB lookup
    let admin = null;
    try {
      admin = await withPrismaRetry(
        () => prisma.admin.findUnique({ where: { email } }),
        2, 80
      );
    } catch { admin = null; }

    const hashToCompare = admin?.password || '$2a$10$dummyHashThatWillNeverMatchAnything00000000000';
    const valid = await bcrypt.compare(password, hashToCompare);

    if (!admin || !valid) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 });
    }

    await recordAdminSession(req, admin.email, admin.name);
    const token = jwt.sign(
      { adminId: admin.id, email: admin.email, name: admin.name },
      jwtSecret,
      { expiresIn: '7d' }
    );
    return NextResponse.json({ token, name: admin.name });
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
