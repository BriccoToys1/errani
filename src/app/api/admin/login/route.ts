import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'errani-admin-secret-key-change-me';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 });
    }

    const admin = await prisma.admin.findUnique({ where: { email } });

    if (!admin) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, admin.password);

    if (!valid) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 });
    }

    const token = jwt.sign(
      { adminId: admin.id, email: admin.email, name: admin.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return NextResponse.json({ token, name: admin.name });
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
