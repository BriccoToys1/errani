import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { verifyAdminToken } from '@/lib/admin-auth';
import { getJwtSecret } from '@/lib/jwt-secret';

// GET current admin profile
export async function GET(req: NextRequest) {
  const admin = verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const record = await prisma.admin.findUnique({ where: { id: admin.adminId }, select: { id: true, email: true, name: true, createdAt: true } });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(record);
}

// PUT update admin profile (email, name, password)
export async function PUT(req: NextRequest) {
  const admin = verifyAdminToken(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const jwtSecret = getJwtSecret();
    if (!jwtSecret) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const { email, name, currentPassword, newPassword } = await req.json();

    const record = await prisma.admin.findUnique({ where: { id: admin.adminId } });
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Must verify current password for any change
    if (!currentPassword) {
      return NextResponse.json({ error: 'Введите текущий пароль' }, { status: 400 });
    }

    const valid = await bcrypt.compare(currentPassword, record.password);
    if (!valid) {
      return NextResponse.json({ error: 'Неверный текущий пароль' }, { status: 400 });
    }

    const updateData: { email?: string; name?: string; password?: string } = {};

    if (email && email !== record.email) {
      // Check uniqueness
      const exists = await prisma.admin.findUnique({ where: { email } });
      if (exists) return NextResponse.json({ error: 'Этот email уже используется' }, { status: 400 });
      updateData.email = email;
    }

    if (name && name !== record.name) {
      updateData.name = name;
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'Пароль должен быть минимум 8 символов' }, { status: 400 });
      }
      updateData.password = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: 'Нет изменений' });
    }

    const updated = await prisma.admin.update({
      where: { id: admin.adminId },
      data: updateData,
      select: { id: true, email: true, name: true },
    });

    // Issue new token with updated info
    const token = jwt.sign(
      { adminId: updated.id, email: updated.email, name: updated.name },
      jwtSecret,
      { expiresIn: '7d' }
    );

    return NextResponse.json({ ...updated, token });
  } catch (error) {
    console.error('Account update error:', error);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
