import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

import { adminGuard } from '@/lib/admin-auth';
import prisma from '@/lib/db';
import { withPrismaRetry } from '@/lib/prisma-retry';

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_INPUT_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_SHARP_FORMAT = new Set(['jpeg', 'png', 'webp']);
const OUTPUT_MIME = 'image/webp';

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
      return NextResponse.json(
        { success: false, message: 'Максимальный размер файла: 10 MB' },
        { status: 400 }
      );
    }

    const mimeType = (filePart.type || '').toLowerCase();
    if (!ALLOWED_INPUT_MIME.has(mimeType)) {
      return NextResponse.json(
        { success: false, message: 'Разрешены только JPEG, PNG, WEBP' },
        { status: 400 }
      );
    }

    const sourceBuffer = Buffer.from(await filePart.arrayBuffer());

    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(sourceBuffer, { failOn: 'error' }).metadata();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Файл не является корректным изображением' },
        { status: 400 }
      );
    }

    const detectedFormat = (metadata.format || '').toLowerCase();
    if (!ALLOWED_SHARP_FORMAT.has(detectedFormat)) {
      return NextResponse.json(
        { success: false, message: 'Недопустимый формат изображения' },
        { status: 400 }
      );
    }

    const { data: outputBuffer, info } = await sharp(sourceBuffer, { failOn: 'error' })
      .rotate()
      .resize({ width: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 3 })
      .toBuffer({ resolveWithObject: true });

    const id = uuidv4();
    const filename = `${id}.webp`;
    const url = `/api/media/${id}`;
    const now = new Date();

    await withPrismaRetry(() =>
      prisma.mediaAsset.create({
        data: {
          id,
          filename,
          relativePath: url,
          url,
          data: outputBuffer as unknown as Uint8Array<ArrayBuffer>,
          size: info.size,
          width: info.width,
          height: info.height,
          mimeType: OUTPUT_MIME,
          source: 'admin',
          createdAt: now,
          updatedAt: now,
        },
      })
    );

    return NextResponse.json({
      success: true,
      url,
      fullUrl: url,
      filename,
      width: info.width,
      height: info.height,
      size: info.size,
      mimeType: OUTPUT_MIME,
    });
  } catch (error) {
    console.error('Admin media upload error:', error);
    return NextResponse.json(
      { success: false, message: 'Ошибка загрузки изображения' },
      { status: 500 }
    );
  }
}
