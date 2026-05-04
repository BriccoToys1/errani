import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

import prisma from '@/lib/db';
import { verifyAdminToken } from '@/lib/admin-auth';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const ALLOWED_SHARP_FORMATS = new Set(['jpeg', 'png', 'webp']);
const OUTPUT_WEBP_QUALITY = 84;
const MAX_IMAGE_WIDTH = 1600;

function getPublicBaseUrl(req: NextRequest): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'errani.ru';
  const publicHost = forwardedHost.startsWith('admin.') ? forwardedHost.replace(/^admin\./, '') : forwardedHost;
  return `${proto}://${publicHost}`;
}

function getYearMonth(): { year: string; month: string } {
  const now = new Date();
  return {
    year: String(now.getUTCFullYear()),
    month: String(now.getUTCMonth() + 1).padStart(2, '0'),
  };
}

function isCsrfValid(req: NextRequest): boolean {
  const cookieToken = req.cookies.get('csrf_token')?.value;
  if (!cookieToken) {
    return true;
  }

  const headerToken = req.headers.get('x-csrf-token');
  return Boolean(headerToken && headerToken === cookieToken);
}

export async function POST(req: NextRequest) {
  let tempFilePath = '';

  try {
    if (!isCsrfValid(req)) {
      return NextResponse.json(
        { success: false, message: 'CSRF validation failed' },
        { status: 403 }
      );
    }

    const admin = verifyAdminToken(req);
    if (!admin) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const adminExists = await prisma.admin.findUnique({
      where: { id: admin.adminId },
      select: { id: true },
    });

    if (!adminExists) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const imageFile = formData.get('image');

    if (!(imageFile instanceof File)) {
      return NextResponse.json(
        { success: false, message: 'Файл изображения не найден (поле image)' },
        { status: 400 }
      );
    }

    if (imageFile.size <= 0) {
      return NextResponse.json(
        { success: false, message: 'Пустой файл' },
        { status: 400 }
      );
    }

    if (imageFile.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, message: 'Размер файла превышает 10 MB' },
        { status: 400 }
      );
    }

    const incomingMimeType = (imageFile.type || '').toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(incomingMimeType)) {
      return NextResponse.json(
        { success: false, message: 'Допустимы только JPG, JPEG, PNG, WEBP' },
        { status: 400 }
      );
    }

    const originalBuffer = Buffer.from(await imageFile.arrayBuffer());

    const metadata = await sharp(originalBuffer, { failOn: 'error' }).metadata();
    const detectedFormat = (metadata.format || '').toLowerCase();

    if (!ALLOWED_SHARP_FORMATS.has(detectedFormat)) {
      return NextResponse.json(
        { success: false, message: 'Недопустимый формат изображения' },
        { status: 400 }
      );
    }

    const { year, month } = getYearMonth();
    const filename = `${uuidv4()}.webp`;

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products', year, month);
    await fs.mkdir(uploadDir, { recursive: true });

    tempFilePath = path.join(os.tmpdir(), `${uuidv4()}-${Date.now()}.upload`);
    await fs.writeFile(tempFilePath, originalBuffer);

    const outputPath = path.join(uploadDir, filename);
    const transformer = sharp(tempFilePath, { failOn: 'error' })
      .rotate()
      .resize({
        width: MAX_IMAGE_WIDTH,
        withoutEnlargement: true,
        fit: 'inside',
      })
      .webp({ quality: OUTPUT_WEBP_QUALITY, effort: 5 })
      .toFile(outputPath);

    await transformer;

    await fs.unlink(tempFilePath).catch(() => undefined);

    const relativePath = `/uploads/products/${year}/${month}/${filename}`;
    const publicUrl = `${getPublicBaseUrl(req)}${relativePath}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
    });
  } catch (error) {
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(() => undefined);
    }

    console.error('Admin image upload error:', error);
    return NextResponse.json(
      { success: false, message: 'Ошибка загрузки изображения' },
      { status: 500 }
    );
  }
}
