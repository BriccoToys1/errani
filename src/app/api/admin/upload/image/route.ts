import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

import { adminGuard } from '@/lib/admin-auth';
import { upsertMediaItem } from '@/lib/admin-media-library';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_INPUT_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_SHARP_FORMAT = new Set(['jpeg', 'png', 'webp']);

function getBaseUrl(req: NextRequest): string {
  const envUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'errani.ru';
  const normalizedHost = host.startsWith('admin.') ? host.replace(/^admin\./, '') : host;
  return `${proto}://${normalizedHost}`;
}

function getStorageDirParts(): { year: string; month: string } {
  const now = new Date();
  return {
    year: String(now.getUTCFullYear()),
    month: String(now.getUTCMonth() + 1).padStart(2, '0'),
  };
}

export async function POST(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;

  try {
    const formData = await req.formData();
    const filePart = formData.get('image') || formData.get('file');

    if (!(filePart instanceof File)) {
      return NextResponse.json(
        { success: false, message: 'Файл не найден. Используйте поле image или file.' },
        { status: 400 }
      );
    }

    if (filePart.size <= 0) {
      return NextResponse.json({ success: false, message: 'Пустой файл' }, { status: 400 });
    }

    if (filePart.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ success: false, message: 'Максимальный размер файла: 10 MB' }, { status: 400 });
    }

    const mimeType = (filePart.type || '').toLowerCase();
    if (!ALLOWED_INPUT_MIME.has(mimeType)) {
      return NextResponse.json({ success: false, message: 'Разрешены только JPEG, PNG, WEBP' }, { status: 400 });
    }

    const sourceBuffer = Buffer.from(await filePart.arrayBuffer());

    const metadata = await sharp(sourceBuffer, { failOn: 'error' }).metadata().catch(() => null);
    if (!metadata) {
      return NextResponse.json({ success: false, message: 'Файл не является корректным изображением' }, { status: 400 });
    }

    const detectedFormat = (metadata.format || '').toLowerCase();
    if (!ALLOWED_SHARP_FORMAT.has(detectedFormat)) {
      return NextResponse.json({ success: false, message: 'Недопустимый формат изображения' }, { status: 400 });
    }

    const { year, month } = getStorageDirParts();
    const filename = `${uuidv4()}.webp`;
    const relativeDir = `/media/products/${year}/${month}`;
    const targetDir = path.join(process.cwd(), 'public', 'media', 'products', year, month);
    const targetPath = path.join(targetDir, filename);

    await fs.mkdir(targetDir, { recursive: true });

    const { data: outputBuffer, info } = await sharp(sourceBuffer, { failOn: 'error' })
      .rotate()
      .resize({ width: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84, effort: 5 })
      .toBuffer({ resolveWithObject: true });

    await fs.writeFile(targetPath, outputBuffer);

    const url = `${relativeDir}/${filename}`;
    const fullUrl = `${getBaseUrl(req)}${url}`;
    const nowIso = new Date().toISOString();

    await upsertMediaItem({
      id: uuidv4(),
      filename,
      relativePath: url,
      url: fullUrl,
      size: info.size,
      width: info.width,
      height: info.height,
      mimeType: 'image/webp',
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
    }).catch((error) => {
      console.error('Legacy media DB sync warning:', error);
    });

    return NextResponse.json({
      success: true,
      url,
      fullUrl,
      filename,
      width: info.width,
      height: info.height,
      size: info.size,
      mimeType: 'image/webp',
    });
  } catch (error) {
    console.error('Admin legacy upload route error:', error);
    return NextResponse.json({ success: false, message: 'Ошибка загрузки изображения' }, { status: 500 });
  }
}
