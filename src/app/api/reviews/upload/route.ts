import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

import prisma from '@/lib/db';
import { withPrismaRetry } from '@/lib/prisma-retry';
import { hashReviewToken } from '@/lib/review-links';
import { consumeRateLimit } from '@/lib/rate-limit';

const MAX_IMAGE_SIZE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 40 * 1024 * 1024;

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_MIME_TO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

async function validateInvite(token: string) {
  const tokenHash = hashReviewToken(token);
  const invite = await withPrismaRetry(() =>
    prisma.reviewInvite.findUnique({
      where: { tokenHash },
      select: { id: true, status: true, usedAt: true, expiresAt: true },
    })
  );

  if (!invite) return { ok: false as const, code: 404, message: 'Ссылка не найдена' };
  if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) return { ok: false as const, code: 410, message: 'Ссылка истекла' };
  if (invite.usedAt || invite.status !== 'sent') return { ok: false as const, code: 409, message: 'Ссылка уже использована' };

  return { ok: true as const, inviteId: invite.id };
}

export async function POST(req: NextRequest) {
  try {
    const rate = consumeRateLimit(req, { key: 'review-upload', limit: 20, windowMs: 60 * 60_000 });
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, message: 'Слишком много загрузок. Попробуйте позже.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } }
      );
    }

    const formData = await req.formData();
    const token = String(formData.get('token') || '').trim();
    const filePart = formData.get('file');

    if (!token) {
      return NextResponse.json({ success: false, message: 'Токен обязателен' }, { status: 400 });
    }

    const invite = await validateInvite(token);
    if (!invite.ok) {
      return NextResponse.json({ success: false, message: invite.message }, { status: invite.code });
    }

    if (!(filePart instanceof File)) {
      return NextResponse.json({ success: false, message: 'Файл не найден' }, { status: 400 });
    }

    const mimeType = (filePart.type || '').toLowerCase();
    const isImage = IMAGE_MIME.has(mimeType);
    const videoExt = VIDEO_MIME_TO_EXT[mimeType];

    if (!isImage && !videoExt) {
      return NextResponse.json(
        { success: false, message: 'Поддерживаются JPG/PNG/WEBP/MP4/WEBM/MOV' },
        { status: 400 }
      );
    }

    if (isImage && filePart.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json({ success: false, message: 'Изображение слишком большое (макс. 12 MB)' }, { status: 400 });
    }
    if (videoExt && filePart.size > MAX_VIDEO_SIZE_BYTES) {
      return NextResponse.json({ success: false, message: 'Видео слишком большое (макс. 40 MB)' }, { status: 400 });
    }

    const sourceBuffer = Buffer.from(await filePart.arrayBuffer());
    const id = uuidv4();
    const now = new Date();

    if (isImage) {
      const { data: outputBuffer, info } = await sharp(sourceBuffer, { failOn: 'error' })
        .rotate()
        .resize({ width: 1800, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 3 })
        .toBuffer({ resolveWithObject: true });

      const filename = `${id}.webp`;
      const url = `/api/media/${id}`;

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
            mimeType: 'image/webp',
            source: 'review',
            createdAt: now,
            updatedAt: now,
          },
        })
      );

      return NextResponse.json({
        success: true,
        url,
        type: 'image',
        width: info.width,
        height: info.height,
        size: info.size,
      });
    }

    const filename = `${id}.${videoExt}`;
    const url = `/api/media/${id}`;

    await withPrismaRetry(() =>
      prisma.mediaAsset.create({
        data: {
          id,
          filename,
          relativePath: url,
          url,
          data: sourceBuffer as unknown as Uint8Array<ArrayBuffer>,
          size: sourceBuffer.length,
          width: 0,
          height: 0,
          mimeType,
          source: 'review',
          createdAt: now,
          updatedAt: now,
        },
      })
    );

    return NextResponse.json({
      success: true,
      url,
      type: 'video',
      size: sourceBuffer.length,
    });
  } catch (error) {
    console.error('Review upload error:', error);
    return NextResponse.json({ success: false, message: 'Ошибка загрузки файла' }, { status: 500 });
  }
}
