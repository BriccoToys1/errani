import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { withPrismaRetry } from '@/lib/prisma-retry';
import { getJwtSecret } from '@/lib/jwt-secret';
import { consumeRateLimit, getClientIp, resetRateLimit } from '@/lib/rate-limit';

const LOGIN_RATE_LIMIT_KEY = 'admin-login';
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

function signAdminToken(payload: { adminId: string; email: string; name: string }, secret: string) {
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: SESSION_MAX_AGE_SECONDS,
    issuer: 'errani-admin',
    audience: 'errani-admin-panel',
    jwtid: crypto.randomUUID(),
  });
}

function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

function safeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function recordAdminSession(req: NextRequest, email: string, name: string) {
  const ip = getClientIp(req);
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
export async function GET(req: NextRequest) {
  const rate = consumeRateLimit(req, { key: 'admin-challenge', limit: 60, windowMs: 10 * 60_000 });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Слишком много запросов. Попробуйте позже.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter), 'Cache-Control': 'no-store' } }
    );
  }

  const jwtSecret = getJwtSecret();
  if (!jwtSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });

  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  const answer = String(a + b);

  // Sign the expected answer — expires in 10 minutes
  const challengeToken = jwt.sign({ answer }, jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '10m',
    issuer: 'errani-admin',
    audience: 'errani-login-challenge',
    jwtid: crypto.randomUUID(),
  });

  return NextResponse.json(
    { challengeToken, question: `${a} + ${b}` },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const rate = consumeRateLimit(req, { key: LOGIN_RATE_LIMIT_KEY, limit: 7, windowMs: 15 * 60_000 });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Слишком много попыток входа. Попробуйте позже.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter), 'Cache-Control': 'no-store' } }
      );
    }

    const jwtSecret = getJwtSecret();
    if (!jwtSecret) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const { email, password, challengeToken, challengeAnswer } = await req.json();

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 });
    }
    if (email.length > 254 || password.length > 256) {
      return NextResponse.json({ error: 'Некорректные данные входа' }, { status: 400 });
    }

    // Verify stateless challenge
    if (!challengeToken || !challengeAnswer) {
      return NextResponse.json({ error: 'Пройдите проверку' }, { status: 400 });
    }

    let expectedAnswer: string;
    try {
      const decoded = jwt.verify(challengeToken, jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'errani-admin',
        audience: 'errani-login-challenge',
      }) as { answer: string };
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
    const envAdminPasswordHash = String(process.env.ADMIN_PASSWORD_HASH || '');
    const envPasswordValid = envAdminPasswordHash
      ? await bcrypt.compare(password, envAdminPasswordHash)
      : Boolean(envAdminPassword) && safeStringEqual(password, envAdminPassword);
    if (envAdminEmail && normalizedEmail === envAdminEmail && envPasswordValid) {
      await recordAdminSession(req, String(email).trim(), 'Admin');
      const token = signAdminToken(
        { adminId: 'env-admin', email: normalizedEmail, name: 'Admin' },
        jwtSecret
      );
      resetRateLimit(req, LOGIN_RATE_LIMIT_KEY);
      const response = NextResponse.json({ authenticated: true, name: 'Admin' }, { headers: { 'Cache-Control': 'no-store' } });
      setSessionCookie(response, token);
      return response;
    }

    // DB lookup
    let admin = null;
    try {
      admin = await withPrismaRetry(
        () => prisma.admin.findUnique({ where: { email: normalizedEmail } }),
        2, 80
      );
    } catch { admin = null; }

    const hashToCompare = admin?.password || '$2a$10$dummyHashThatWillNeverMatchAnything00000000000';
    const valid = await bcrypt.compare(password, hashToCompare);

    if (!admin || !valid) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 });
    }

    await recordAdminSession(req, admin.email, admin.name);
    const token = signAdminToken(
      { adminId: admin.id, email: admin.email, name: admin.name },
      jwtSecret
    );
    resetRateLimit(req, LOGIN_RATE_LIMIT_KEY);
    const response = NextResponse.json({ authenticated: true, name: admin.name }, { headers: { 'Cache-Control': 'no-store' } });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set('admin_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}
