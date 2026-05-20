import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { withPrismaRetry } from '@/lib/prisma-retry';
import { getJwtSecret } from '@/lib/jwt-secret';

// ── Rate limiting: in-memory store ──────────────────────────────────────
const loginAttempts = new Map<string, { count: number; firstAt: number; blockedUntil: number }>();

function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  
  if (!entry) return { allowed: true };
  
  // If IP is blocked, check if block has expired
  if (entry.blockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((entry.blockedUntil - now) / 1000) };
  }
  
  // Reset window if older than 15 minutes
  if (now - entry.firstAt > 15 * 60 * 1000) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }
  
  // Allow up to 5 attempts per 15 min window
  if (entry.count >= 5) {
    // Block for progressively longer: 1min, 5min, 15min, 30min
    const blockMinutes = entry.count >= 15 ? 30 : entry.count >= 10 ? 15 : entry.count >= 7 ? 5 : 1;
    entry.blockedUntil = now + blockMinutes * 60 * 1000;
    return { allowed: false, retryAfter: blockMinutes * 60 };
  }
  
  return { allowed: true };
}

function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) {
    loginAttempts.set(ip, { count: 1, firstAt: now, blockedUntil: 0 });
  } else {
    entry.count++;
  }
}

function clearAttempts(ip: string) {
  loginAttempts.delete(ip);
}

async function recordAdminSession(req: NextRequest, email: string, name: string) {
  const ip = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || '';
  const country =
    req.headers.get('x-vercel-ip-country') ||
    req.headers.get('cf-ipcountry') ||
    req.headers.get('x-country-code') ||
    '';
  const city =
    req.headers.get('x-vercel-ip-city') ||
    req.headers.get('cf-ipcity') ||
    '';

  const entry = {
    at: new Date().toISOString(),
    email,
    name,
    ip,
    country,
    city,
    userAgent,
  };

  try {
    const current = await withPrismaRetry(
      () => prisma.siteSettings.findUnique({ where: { key: 'admin_sessions_v1' } }),
      2,
      80
    );
    let list: typeof entry[] = [];
    try {
      const parsed = JSON.parse(current?.value || '[]');
      if (Array.isArray(parsed)) {
        list = parsed.filter((row) => typeof row === 'object' && row !== null) as typeof entry[];
      }
    } catch {
      list = [];
    }
    const next = [entry, ...list].slice(0, 100);
    await withPrismaRetry(
      () =>
        prisma.siteSettings.upsert({
          where: { key: 'admin_sessions_v1' },
          update: { value: JSON.stringify(next) },
          create: { key: 'admin_sessions_v1', value: JSON.stringify(next) },
        }),
      2,
      80
    );
  } catch (error) {
    console.error('Failed to record admin session:', error);
  }
}

// ── Challenge system: server-side nonce to prevent automated requests ──
const challenges = new Map<string, { answer: string; expiresAt: number }>();

// Clean up expired challenges periodically
function cleanChallenges() {
  const now = Date.now();
  for (const [key, val] of challenges) {
    if (val.expiresAt < now) challenges.delete(key);
  }
}

export async function GET() {
  cleanChallenges();
  // Generate a simple math challenge
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  const answer = String(a + b);
  const challengeId = crypto.randomUUID();
  
  challenges.set(challengeId, { answer, expiresAt: Date.now() + 5 * 60 * 1000 }); // 5 min TTL
  
  return NextResponse.json({ challengeId, question: `${a} + ${b}` });
}

export async function POST(req: NextRequest) {
  try {
    const jwtSecret = getJwtSecret();
    if (!jwtSecret) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const ip = getClientIP(req);
    
    // Check rate limit
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Слишком много попыток. Повторите через ${rateCheck.retryAfter} сек.` },
        { status: 429 }
      );
    }
    
    const { email, password, challengeId, challengeAnswer } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 });
    }

    // Verify challenge
    if (!challengeId || !challengeAnswer) {
      return NextResponse.json({ error: 'Пройдите проверку' }, { status: 400 });
    }
    
    const challenge = challenges.get(challengeId);
    if (!challenge || challenge.expiresAt < Date.now()) {
      challenges.delete(challengeId || '');
      return NextResponse.json({ error: 'Проверка истекла, обновите страницу' }, { status: 400 });
    }
    
    if (String(challengeAnswer).trim() !== challenge.answer) {
      recordFailedAttempt(ip);
      challenges.delete(challengeId);
      return NextResponse.json({ error: 'Неверный ответ на проверку' }, { status: 400 });
    }
    
    challenges.delete(challengeId); // One-time use

    const normalizedEmail = String(email).trim().toLowerCase();
    const envAdminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const envAdminPassword = String(process.env.ADMIN_PASSWORD || '');
    if (envAdminEmail && envAdminPassword && normalizedEmail === envAdminEmail && String(password) === envAdminPassword) {
      clearAttempts(ip);
      await recordAdminSession(req, String(email).trim(), 'Admin');
      const token = jwt.sign(
        { adminId: 'env-admin', email: String(email).trim(), name: 'Admin' },
        jwtSecret,
        { expiresIn: '7d' }
      );
      return NextResponse.json({ token, name: 'Admin' });
    }

    // Constant-time-ish lookup: always do bcrypt compare even if user not found
    let admin = null;
    try {
      admin = await withPrismaRetry(
        () => prisma.admin.findUnique({ where: { email } }),
        2,
        80
      );
    } catch {
      admin = null;
    }

    // Use a dummy hash if admin not found to prevent timing attacks
    const hashToCompare = admin?.password || '$2a$10$dummyHashThatWillNeverMatchAnything00000000000';
    const valid = await bcrypt.compare(password, hashToCompare);

    if (!admin || !valid) {
      recordFailedAttempt(ip);
      // Intentionally vague error
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 });
    }

    // Success — clear rate limit for this IP
    clearAttempts(ip);
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
